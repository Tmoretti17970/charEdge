// ═══════════════════════════════════════════════════════════════════
// charEdge — DrawingRenderer (Core Dispatcher)
//
// Committed drawings render on the MAIN canvas.
// Active/selected drawings + anchors render on the TOP canvas.
// Individual tool renderers live in tools/renderers/*.js sub-modules.
// ═══════════════════════════════════════════════════════════════════

// ── Sub-renderers ────────────────────────────────────────────────
import { RESIZABLE_TOOLS, computeResizeHandles, renderResizeHandles } from '../engines/ResizeHandles.js';
import {
  renderChannel,
  renderPitchfork,
  renderParallelChannel,
  renderRegressionChannel,
} from '../renderers/ChannelDraw.js';
import {
  renderFibRetracement,
  renderFibExtension,
  renderFibTimeZone,
  renderFibArc,
  renderFibFan,
  renderFibChannel,
  renderElliottWaves,
} from '../renderers/FibDraw.js';
import {
  renderHorizontalLine,
  renderHorizontalRay,
  renderVerticalLine,
  renderCrossline,
} from '../renderers/HLineDraw.js';
import { renderMeasureLabels } from '../renderers/MeasureLabels.js';
import { renderGannFan, renderGannSquare, renderXABCD, renderHeadShoulders } from '../renderers/PatternDraw.js';
import {
  renderRectangle,
  renderTriangle,
  renderEllipse,
  renderText,
  renderCallout,
  renderEmoji,
  renderNote,
  renderSignpost,
} from '../renderers/ShapeDraw.js';
import {
  renderMeasure,
  renderLongPosition,
  renderShortPosition,
  renderAlertZone,
  renderInfoLine,
  renderFlatZone,
  renderPriceRange,
  renderDateRange,
} from '../renderers/TradeDraw.js';
import {
  renderTrendline,
  renderRay,
  renderExtendedLine,
  renderArrow,
  renderPolyline,
} from '../renderers/TrendlineDraw.js';

const ANCHOR_RADIUS = 4;
const ANCHOR_FILL = '#FFFFFF';
const ANCHOR_STROKE = '#2962FF';
const _SELECTED_COLOR = '#2962FF';
const MAX_DRAWINGS = 500; // BUG-02: drawing count cap

/**
 * Create a DrawingRenderer.
 *
 * @param {Object} drawingEngine - DrawingEngine instance
 * @returns {Object} Renderer with drawMain() and drawTop()
 */
export function createDrawingRenderer(drawingEngine) {
  /** Draw a small text label */
  function drawLabel(ctx, text, x, y, color, pr) {
    const fontSize = Math.round(10 * pr);
    const padding = Math.round(3 * pr);
    ctx.font = `${fontSize}px Arial`;
    const tw = ctx.measureText(text).width;

    ctx.fillStyle = color;
    ctx.globalAlpha = 0.15;
    ctx.fillRect(x - padding, y - fontSize / 2 - padding, tw + padding * 2, fontSize + padding * 2);
    ctx.globalAlpha = 1;

    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
  }

  // Shared deps object for sub-renderers that need closure access
  const deps = { drawingEngine, drawLabel, anchorToPixel: (p) => drawingEngine.anchorToPixel(p) };

  /**
   * Render committed (non-selected) drawings on the main canvas.
   */
  function drawMain(ctx, size) {
    const drawings = drawingEngine.drawings;
    const pr = size.pixelRatio;
    const hoveredId = drawingEngine.hoveredDrawingId;

    // BUG-02: Warn if drawings exceed cap
    if (drawings.length > MAX_DRAWINGS) {
      // eslint-disable-next-line no-console
      console.warn(`[DrawingRenderer] ${drawings.length} drawings exceed cap of ${MAX_DRAWINGS}`);
    }

    for (const d of drawings) {
      if (!d.visible) continue;
      if (d.state === 'creating') continue;
      if (d.state === 'selected') continue;

      // BUG-02: Off-screen culling — skip drawings entirely outside viewport
      const pts = d.points?.map((p) => drawingEngine.anchorToPixel(p)).filter(Boolean);
      if (pts && pts.length > 0 && _isOffScreen(pts, size)) continue;

      const isHovered = d.id === hoveredId;
      const isMultiSelected = drawingEngine.selectedDrawingIds && drawingEngine.selectedDrawingIds.has(d.id);

      if (isHovered || isMultiSelected) {
        ctx.save();
        ctx.shadowColor = isMultiSelected ? '#2962FF' : d.style?.color || '#2962FF';
        ctx.shadowBlur = (isMultiSelected ? 10 : 8) * pr;
      }

      renderDrawing(ctx, d, pr, size);

      // Multi-select blue tint outline
      if (isMultiSelected && pts && pts.length >= 2) {
        ctx.save();
        ctx.setLineDash([Math.round(4 * pr), Math.round(3 * pr)]);
        ctx.strokeStyle = 'rgba(41, 98, 255, 0.4)';
        ctx.lineWidth = Math.round(1.5 * pr);
        const bpts = pts.map((p) => ({ x: Math.round(p.x * pr), y: Math.round(p.y * pr) }));
        let minX = Infinity,
          minY = Infinity,
          maxX = -Infinity,
          maxY = -Infinity;
        for (const p of bpts) {
          minX = Math.min(minX, p.x);
          minY = Math.min(minY, p.y);
          maxX = Math.max(maxX, p.x);
          maxY = Math.max(maxY, p.y);
        }
        const pad = Math.round(6 * pr);
        ctx.strokeRect(minX - pad, minY - pad, maxX - minX + pad * 2, maxY - minY + pad * 2);
        ctx.restore();
      }

      // Measurement info labels for idle drawings
      const mpts = d.points?.map((p) => drawingEngine.anchorToPixel(p)).filter(Boolean);
      if (mpts && mpts.length >= 2) {
        const bitmapPts = mpts.map((p) => ({ x: Math.round(p.x * pr), y: Math.round(p.y * pr) }));
        renderMeasureLabels(ctx, d, bitmapPts, pr, drawingEngine.pixelToPrice, drawingEngine.pixelToTime);
      }

      // 🔔 Alert icon for drawings with active alerts
      if (drawingEngine.hasAlert && drawingEngine.hasAlert(d.id)) {
        const firstPt = d.points?.[0];
        const px = firstPt ? drawingEngine.anchorToPixel(firstPt) : null;
        if (px) {
          const bx = Math.round(px.x * pr);
          const by = Math.round(px.y * pr) - Math.round(18 * pr);
          const radius = Math.round(10 * pr);
          // Pulsing glow
          const pulsePhase = (Date.now() % 2000) / 2000;
          const pulseAlpha = 0.6 + Math.sin(pulsePhase * Math.PI * 2) * 0.3;

          ctx.save();
          // Background circle
          ctx.beginPath();
          ctx.arc(bx, by, radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(41, 98, 255, ${pulseAlpha})`;
          ctx.fill();
          // Bell text
          ctx.font = `${Math.round(10 * pr)}px Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#FFFFFF';
          ctx.fillText('🔔', bx, by);
          ctx.restore();
        }
      }

      if (isHovered || isMultiSelected) {
        ctx.restore();
      }
    }
  }

  /**
   * Render active/selected drawings and anchors on the top canvas.
   */
  function drawTop(ctx, size) {
    const drawings = drawingEngine.drawings;
    const pr = size.pixelRatio;

    for (const d of drawings) {
      if (!d.visible) continue;
      if (d.state !== 'creating' && d.state !== 'selected') continue;

      // Ghost preview styling for creating state
      if (d.state === 'creating' && d.points.length >= 1) {
        ctx.save();
        ctx.globalAlpha = 0.45;
        ctx.setLineDash([Math.round(6 * pr), Math.round(4 * pr)]);
        // Marching-ant animation — dashes crawl along the line
        ctx.lineDashOffset = (-(Date.now() % 1000) / 1000) * 16 * pr;
        const pulsePhase = (Date.now() % 1500) / 1500;
        const pulseGlow = 4 + Math.sin(pulsePhase * Math.PI * 2) * 3;
        ctx.shadowColor = d.style?.color || '#2962FF';
        ctx.shadowBlur = pulseGlow * pr;
        renderDrawing(ctx, d, pr, size);
        ctx.restore();

        // Cursor crosshair at last ghost point — pulsing placement indicator
        const lastPt = d.points[d.points.length - 1];
        if (lastPt) {
          const px = drawingEngine.anchorToPixel(lastPt);
          if (px) {
            const bx = Math.round(px.x * pr),
              by = Math.round(px.y * pr);
            const crossSize = Math.round(8 * pr);
            const ringPhase = (Date.now() % 1200) / 1200;
            const ringRadius = (6 + Math.sin(ringPhase * Math.PI * 2) * 3) * pr;
            ctx.save();
            ctx.globalAlpha = 0.5;
            ctx.strokeStyle = d.style?.color || '#2962FF';
            ctx.lineWidth = Math.round(1.5 * pr);
            ctx.setLineDash([]);
            // Crosshair lines
            ctx.beginPath();
            ctx.moveTo(bx - crossSize, by);
            ctx.lineTo(bx + crossSize, by);
            ctx.moveTo(bx, by - crossSize);
            ctx.lineTo(bx, by + crossSize);
            ctx.stroke();
            // Pulsing ring
            ctx.globalAlpha = 0.3;
            ctx.beginPath();
            ctx.arc(bx, by, ringRadius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }
        }
      } else {
        renderDrawing(ctx, d, pr, size);
      }

      // Measurement labels for selected/creating drawings
      const mpts = d.points?.map((p) => drawingEngine.anchorToPixel(p)).filter(Boolean);
      if (mpts && mpts.length >= 2) {
        const bitmapPts = mpts.map((p) => ({ x: Math.round(p.x * pr), y: Math.round(p.y * pr) }));
        renderMeasureLabels(ctx, d, bitmapPts, pr, drawingEngine.pixelToPrice, drawingEngine.pixelToTime);
      }

      // Draw anchor points for selected/creating drawings
      if (d.state === 'selected' || d.state === 'creating') {
        const hoveredAnchor = drawingEngine.hoveredAnchorIdx;
        const isHoveredDrawing = d.id === drawingEngine.hoveredDrawingId;

        for (let pi = 0; pi < d.points.length; pi++) {
          const point = d.points[pi];
          const px = drawingEngine.anchorToPixel(point);
          if (!px) continue;

          const bx = Math.round(px.x * pr);
          const by = Math.round(px.y * pr);

          const isHoveredAnchor = isHoveredDrawing && pi === hoveredAnchor;
          const baseR = Math.round(ANCHOR_RADIUS * pr);
          const hoverR = Math.round(ANCHOR_RADIUS * 1.75 * pr);
          const r = isHoveredAnchor ? hoverR : baseR;

          ctx.save();

          if (isHoveredAnchor) {
            ctx.shadowColor = ANCHOR_STROKE;
            ctx.shadowBlur = 8 * pr;
          } else {
            ctx.shadowColor = 'rgba(0,0,0,0.4)';
            ctx.shadowBlur = 4 * pr;
          }

          ctx.beginPath();
          ctx.arc(bx, by, r + Math.round(1.5 * pr), 0, Math.PI * 2);
          ctx.fillStyle = ANCHOR_STROKE;
          ctx.fill();

          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;

          ctx.beginPath();
          ctx.arc(bx, by, r, 0, Math.PI * 2);
          ctx.fillStyle = ANCHOR_FILL;
          ctx.fill();

          ctx.restore();

          // Price label at each anchor during creation/dragging
          if (d.state === 'creating' || drawingEngine.state === 'dragging') {
            const price = point.price;
            if (typeof price === 'number' && isFinite(price)) {
              const labelText = price >= 1000 ? price.toFixed(0) : price.toFixed(2);
              const fontSize = Math.round(10 * pr);
              const padding = Math.round(4 * pr);
              ctx.font = `bold ${fontSize}px -apple-system, Arial`;
              const tw = ctx.measureText(labelText).width;

              const lx = bx + Math.round(12 * pr);
              const ly = by - Math.round(fontSize / 2);

              const pillW = tw + padding * 2;
              const _pillH = fontSize + padding * 2;
              const pillR = Math.round(4 * pr);

              ctx.fillStyle = 'rgba(24,26,32,0.92)';
              ctx.beginPath();
              ctx.moveTo(lx + pillR, ly - padding);
              ctx.lineTo(lx + pillW - pillR, ly - padding);
              ctx.quadraticCurveTo(lx + pillW, ly - padding, lx + pillW, ly - padding + pillR);
              ctx.lineTo(lx + pillW, ly + fontSize + padding - pillR);
              ctx.quadraticCurveTo(lx + pillW, ly + fontSize + padding, lx + pillW - pillR, ly + fontSize + padding);
              ctx.lineTo(lx + pillR, ly + fontSize + padding);
              ctx.quadraticCurveTo(lx, ly + fontSize + padding, lx, ly + fontSize + padding - pillR);
              ctx.lineTo(lx, ly - padding + pillR);
              ctx.quadraticCurveTo(lx, ly - padding, lx + pillR, ly - padding);
              ctx.closePath();
              ctx.fill();

              ctx.fillStyle = '#D1D4DC';
              ctx.textAlign = 'left';
              ctx.textBaseline = 'top';
              ctx.fillText(labelText, lx + padding, ly);
            }
          }
        }

        // Drawing label (meta.label) near midpoint
        if (d.meta?.label && d.points.length >= 1) {
          const pts = d.points.map((p) => drawingEngine.anchorToPixel(p)).filter(Boolean);
          if (pts.length > 0) {
            const midX = pts.reduce((s, p) => s + p.x, 0) / pts.length;
            const midY = pts.reduce((s, p) => s + p.y, 0) / pts.length;
            const bx = Math.round(midX * pr);
            const by = Math.round(midY * pr) - Math.round(16 * pr);

            const fontSize = Math.round(9 * pr);
            const pad = Math.round(4 * pr);
            ctx.font = `${fontSize}px -apple-system, Arial`;
            const tw = ctx.measureText(d.meta.label).width;
            const tagW = tw + pad * 2;
            const tagH = fontSize + pad * 2;
            const tagR = Math.round(3 * pr);

            ctx.fillStyle = 'rgba(24,26,32,0.85)';
            ctx.beginPath();
            ctx.moveTo(bx - tagW / 2 + tagR, by);
            ctx.lineTo(bx + tagW / 2 - tagR, by);
            ctx.quadraticCurveTo(bx + tagW / 2, by, bx + tagW / 2, by + tagR);
            ctx.lineTo(bx + tagW / 2, by + tagH - tagR);
            ctx.quadraticCurveTo(bx + tagW / 2, by + tagH, bx + tagW / 2 - tagR, by + tagH);
            ctx.lineTo(bx - tagW / 2 + tagR, by + tagH);
            ctx.quadraticCurveTo(bx - tagW / 2, by + tagH, bx - tagW / 2, by + tagH - tagR);
            ctx.lineTo(bx - tagW / 2, by + tagR);
            ctx.quadraticCurveTo(bx - tagW / 2, by, bx - tagW / 2 + tagR, by);
            ctx.closePath();
            ctx.fill();

            ctx.strokeStyle = d.style?.color || '#2962FF';
            ctx.lineWidth = Math.max(1, Math.round(0.5 * pr));
            ctx.stroke();

            ctx.fillStyle = '#FFFFFF';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(d.meta.label, bx, by + tagH / 2);
          }
        }

        // Distance / delta label between first and last anchor
        if (d.points.length >= 2 && (d.state === 'creating' || drawingEngine.state === 'dragging')) {
          const p0 = d.points[0];
          const pLast = d.points[d.points.length - 1];
          const priceDiff = pLast.price - p0.price;
          const pricePct = p0.price !== 0 ? (priceDiff / p0.price) * 100 : 0;

          const px0 = drawingEngine.anchorToPixel(p0);
          const pxL = drawingEngine.anchorToPixel(pLast);

          if (px0 && pxL) {
            const bx0 = Math.round(px0.x * pr);
            const by0 = Math.round(px0.y * pr);
            const bxL = Math.round(pxL.x * pr);
            const byL = Math.round(pxL.y * pr);

            const angle = Math.atan2(-(byL - by0), bxL - bx0) * (180 / Math.PI);

            const isUp = priceDiff >= 0;
            const arrow = isUp ? '▲' : '▼';
            const sign = isUp ? '+' : '';
            const deltaText = `${arrow} ${sign}${priceDiff >= 1000 ? priceDiff.toFixed(0) : priceDiff.toFixed(2)} (${sign}${pricePct.toFixed(2)}%) · ${angle.toFixed(1)}°`;

            const fontSize = Math.round(10 * pr);
            const padding = Math.round(5 * pr);
            ctx.font = `bold ${fontSize}px -apple-system, Arial`;
            const tw = ctx.measureText(deltaText).width;

            const mx = (bx0 + bxL) / 2;
            const my = Math.min(by0, byL) - Math.round(24 * pr);

            const pillW = tw + padding * 2;
            const pillH = fontSize + padding * 2;
            const pillR = Math.round(5 * pr);

            ctx.fillStyle = 'rgba(24,26,32,0.92)';
            ctx.beginPath();
            ctx.moveTo(mx - pillW / 2 + pillR, my);
            ctx.lineTo(mx + pillW / 2 - pillR, my);
            ctx.quadraticCurveTo(mx + pillW / 2, my, mx + pillW / 2, my + pillR);
            ctx.lineTo(mx + pillW / 2, my + pillH - pillR);
            ctx.quadraticCurveTo(mx + pillW / 2, my + pillH, mx + pillW / 2 - pillR, my + pillH);
            ctx.lineTo(mx - pillW / 2 + pillR, my + pillH);
            ctx.quadraticCurveTo(mx - pillW / 2, my + pillH, mx - pillW / 2, my + pillH - pillR);
            ctx.lineTo(mx - pillW / 2, my + pillR);
            ctx.quadraticCurveTo(mx - pillW / 2, my, mx - pillW / 2 + pillR, my);
            ctx.closePath();
            ctx.fill();

            ctx.strokeStyle = isUp ? 'rgba(38,166,154,0.4)' : 'rgba(239,83,80,0.4)';
            ctx.lineWidth = Math.round(1 * pr);
            ctx.stroke();

            ctx.fillStyle = isUp ? '#26A69A' : '#EF5350';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(deltaText, mx, my + padding);
          }
        }
      }

      // ─── 8-handle resize overlay for shapes ──────────────────
      if (d.state === 'selected' && RESIZABLE_TOOLS.has(d.type)) {
        const pts = d.points.map((p) => drawingEngine.anchorToPixel(p)).filter(Boolean);
        if (pts.length >= 2) {
          const handles = computeResizeHandles(pts);
          const hoveredHandle = drawingEngine._hoveredResizeHandle || null;
          renderResizeHandles(ctx, handles, pr, hoveredHandle);
        }
      }
    }

    renderSnapIndicator(ctx, pr);
    renderSmartGuides(ctx, pr, size);
  }

  /**
   * Render snap indicator overlay.
   */
  function renderSnapIndicator(ctx, pr) {
    const snapInfo = drawingEngine.lastSnapInfo;
    if (!snapInfo) return;
    const snapPx = drawingEngine.anchorToPixel({ price: snapInfo.price, time: snapInfo.time });
    if (!snapPx) return;
    const sx = Math.round(snapPx.x * pr),
      sy = Math.round(snapPx.y * pr);
    const SNAP_COLORS = {
      ohlc: {
        glow: 'rgba(41, 98, 255, 0.25)',
        mid: 'rgba(41, 98, 255, 0.6)',
        pill: 'rgba(41, 98, 255, 0.85)',
        guide: 'rgba(41, 98, 255, 0.15)',
      },
      drawing: {
        glow: 'rgba(255, 152, 0, 0.25)',
        mid: 'rgba(255, 152, 0, 0.6)',
        pill: 'rgba(255, 152, 0, 0.85)',
        guide: 'rgba(255, 152, 0, 0.15)',
      },
      round: {
        glow: 'rgba(76, 175, 80, 0.25)',
        mid: 'rgba(76, 175, 80, 0.6)',
        pill: 'rgba(76, 175, 80, 0.85)',
        guide: 'rgba(76, 175, 80, 0.15)',
      },
      indicator: {
        glow: 'rgba(156, 39, 176, 0.25)',
        mid: 'rgba(156, 39, 176, 0.6)',
        pill: 'rgba(156, 39, 176, 0.85)',
        guide: 'rgba(156, 39, 176, 0.15)',
      },
      grid: {
        glow: 'rgba(120, 123, 134, 0.25)',
        mid: 'rgba(120, 123, 134, 0.5)',
        pill: 'rgba(120, 123, 134, 0.75)',
        guide: 'rgba(120, 123, 134, 0.1)',
      },
    };
    const colors = SNAP_COLORS[snapInfo.type] || SNAP_COLORS.ohlc;
    ctx.save();
    ctx.strokeStyle = colors.guide;
    ctx.lineWidth = Math.max(1, pr);
    ctx.setLineDash([Math.round(3 * pr), Math.round(3 * pr)]);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ctx.canvas.width, sy);
    ctx.stroke();
    ctx.setLineDash([]);
    const phase = (Date.now() % 1200) / 1200;
    const outerR = Math.round((6 + Math.sin(phase * Math.PI * 2) * 2) * pr);
    ctx.beginPath();
    ctx.arc(sx, sy, outerR, 0, Math.PI * 2);
    ctx.fillStyle = colors.glow;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sx, sy, Math.round(4 * pr), 0, Math.PI * 2);
    ctx.fillStyle = colors.mid;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sx, sy, Math.round(2 * pr), 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    if (snapInfo.label) {
      const fontSize = Math.round(9 * pr),
        padding = Math.round(4 * pr);
      ctx.font = `bold ${fontSize}px -apple-system, Arial`;
      const tw = ctx.measureText(snapInfo.label).width;
      const pillW = tw + padding * 2,
        pillH = fontSize + padding * 2,
        pillR = Math.round(3 * pr);
      const lx = sx + Math.round(10 * pr),
        ly = sy - pillH / 2;
      ctx.fillStyle = colors.pill;
      ctx.beginPath();
      ctx.moveTo(lx + pillR, ly);
      ctx.lineTo(lx + pillW - pillR, ly);
      ctx.quadraticCurveTo(lx + pillW, ly, lx + pillW, ly + pillR);
      ctx.lineTo(lx + pillW, ly + pillH - pillR);
      ctx.quadraticCurveTo(lx + pillW, ly + pillH, lx + pillW - pillR, ly + pillH);
      ctx.lineTo(lx + pillR, ly + pillH);
      ctx.quadraticCurveTo(lx, ly + pillH, lx, ly + pillH - pillR);
      ctx.lineTo(lx, ly + pillR);
      ctx.quadraticCurveTo(lx, ly, lx + pillR, ly);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(snapInfo.label, lx + padding, sy);
    }
    ctx.restore();
  }

  /**
   * Render smart guide alignment lines.
   */
  function renderSmartGuides(ctx, pr, _size) {
    if (!drawingEngine.getSmartGuides) return;
    const mouseState = drawingEngine.state;
    if (mouseState !== 'creating' && mouseState !== 'dragging') return;
    const activeDrawings = drawingEngine.drawings.filter((d) => d.state === 'creating');
    if (activeDrawings.length === 0) return;
    const lastPt = activeDrawings[0].points[activeDrawings[0].points.length - 1];
    if (!lastPt) return;
    const cursorPx = drawingEngine.anchorToPixel(lastPt);
    if (!cursorPx) return;
    const guides = drawingEngine.getSmartGuides(cursorPx.x, cursorPx.y);
    if (!guides || guides.length === 0) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(41, 98, 255, 0.35)';
    ctx.lineWidth = Math.max(1, Math.round(0.5 * pr));
    ctx.setLineDash([Math.round(3 * pr), Math.round(3 * pr)]);
    for (const g of guides) {
      ctx.beginPath();
      if (g.type === 'horizontal') {
        const y = Math.round(g.y * pr);
        ctx.moveTo(Math.round(g.fromX * pr), y);
        ctx.lineTo(Math.round(g.toX * pr), y);
      } else {
        const x = Math.round(g.x * pr);
        ctx.moveTo(x, Math.round(g.fromY * pr));
        ctx.lineTo(x, Math.round(g.toY * pr));
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  /**
   * Render a single drawing — dispatcher to sub-renderers.
   */
  function renderDrawing(ctx, drawing, pr, size) {
    const points = drawing.points.map((p) => drawingEngine.anchorToPixel(p)).filter(Boolean);
    if (points.length === 0) return;
    const bPoints = points.map((p) => ({ x: Math.round(p.x * pr), y: Math.round(p.y * pr) }));
    if (bPoints.some((p) => !isFinite(p.x) || !isFinite(p.y))) return;
    const style = drawing.style;
    const lineWidth = Math.max(1, Math.round(style.lineWidth * pr));

    switch (drawing.type) {
      case 'trendline':
        renderTrendline(ctx, bPoints, style, lineWidth, pr);
        break;
      case 'hray':
        renderHorizontalRay(ctx, bPoints, style, lineWidth, pr, size, deps);
        break;
      case 'hline':
        renderHorizontalLine(ctx, bPoints, style, lineWidth, pr, size);
        break;
      case 'ray':
        renderRay(ctx, bPoints, style, lineWidth, pr, size);
        break;
      case 'extendedline':
        renderExtendedLine(ctx, bPoints, style, lineWidth, pr, size);
        break;
      case 'fib':
        renderFibRetracement(ctx, bPoints, drawing.points, style, lineWidth, pr, size, deps);
        break;
      case 'fibext':
        renderFibExtension(ctx, bPoints, drawing.points, style, lineWidth, pr, size, deps);
        break;
      case 'longposition':
        renderLongPosition(ctx, bPoints, drawing, style, lineWidth, pr, size);
        break;
      case 'shortposition':
        renderShortPosition(ctx, bPoints, drawing, style, lineWidth, pr, size);
        break;
      case 'gannfan':
        renderGannFan(ctx, bPoints, drawing, style, lineWidth, pr, size);
        break;
      case 'fibtimezone':
        renderFibTimeZone(ctx, bPoints, drawing, style, lineWidth, pr, size);
        break;
      case 'elliott':
        renderElliottWaves(ctx, bPoints, drawing, style, lineWidth, pr);
        break;
      case 'rect':
        renderRectangle(ctx, bPoints, style, lineWidth, pr);
        break;
      case 'channel':
        renderChannel(ctx, bPoints, style, lineWidth, pr, size);
        break;
      case 'crossline':
        renderCrossline(ctx, bPoints, style, lineWidth, pr, size);
        break;
      case 'arrow':
        renderArrow(ctx, bPoints, style, lineWidth, pr);
        break;
      case 'text':
        renderText(ctx, bPoints, drawing, style, pr);
        break;
      case 'triangle':
        renderTriangle(ctx, bPoints, style, lineWidth, pr);
        break;
      case 'ellipse':
        renderEllipse(ctx, bPoints, style, lineWidth, pr);
        break;
      case 'pitchfork':
        renderPitchfork(ctx, bPoints, drawing, style, lineWidth, pr, size);
        break;
      case 'callout':
        renderCallout(ctx, bPoints, drawing, style, lineWidth, pr);
        break;
      case 'vline':
        renderVerticalLine(ctx, bPoints, style, lineWidth, pr, size);
        break;
      case 'measure':
        renderMeasure(ctx, bPoints, drawing, style, lineWidth, pr, size);
        break;
      case 'alertzone':
        renderAlertZone(ctx, bPoints, drawing, style, lineWidth, pr, size);
        break;
      case 'fibarc':
        renderFibArc(ctx, bPoints, drawing.points, style, lineWidth, pr, size);
        break;
      case 'fibfan':
        renderFibFan(ctx, bPoints, drawing.points, style, lineWidth, pr, size);
        break;
      case 'fibchannel':
        renderFibChannel(ctx, bPoints, drawing.points, style, lineWidth, pr, size);
        break;
      case 'regressionchannel':
        renderRegressionChannel(ctx, bPoints, drawing, style, lineWidth, pr, size);
        break;
      case 'gannsquare':
        renderGannSquare(ctx, bPoints, drawing, style, lineWidth, pr, size);
        break;
      case 'xabcd':
        renderXABCD(ctx, bPoints, drawing, style, lineWidth, pr, size);
        break;
      case 'headshoulders':
        renderHeadShoulders(ctx, bPoints, drawing, style, lineWidth, pr, size);
        break;
      case 'emoji':
        renderEmoji(ctx, bPoints, drawing, style, pr);
        break;
      case 'flattop':
        renderFlatZone(ctx, bPoints, drawing, style, lineWidth, pr, size, 'top');
        break;
      case 'flatbottom':
        renderFlatZone(ctx, bPoints, drawing, style, lineWidth, pr, size, 'bottom');
        break;
      case 'infoline':
        renderInfoLine(ctx, bPoints, drawing, style, lineWidth, pr, size);
        break;
      case 'parallelchannel':
        renderParallelChannel(ctx, bPoints, style, lineWidth, pr, size);
        break;
      case 'polyline':
        renderPolyline(ctx, bPoints, style, lineWidth, pr);
        break;
      case 'pricerange':
        renderPriceRange(ctx, bPoints, drawing, style, lineWidth, pr, size);
        break;
      case 'daterange':
        renderDateRange(ctx, bPoints, drawing, style, lineWidth, pr, size);
        break;
      case 'note':
        renderNote(ctx, bPoints, drawing, style, pr);
        break;
      case 'signpost':
        renderSignpost(ctx, bPoints, drawing, style, pr);
        break;
    }
  }

  return {
    drawMain,
    drawTop,
  };
}

/**
 * BUG-02: Check if all points are outside the viewport (with margin).
 * @param {Array<{x:number,y:number}>} pts  Pixel-space points
 * @param {{width:number,height:number}} size  Canvas size
 * @returns {boolean} true if entirely off-screen
 */
function _isOffScreen(pts, size) {
  const MARGIN = 200;
  const w = size.width + MARGIN;
  const h = size.height + MARGIN;
  return pts.every((p) => p.x < -MARGIN || p.x > w || p.y < -MARGIN || p.y > h);
}
