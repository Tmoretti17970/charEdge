// ═══════════════════════════════════════════════════════════════════
// charEdge — DrawingRenderer
// Renders all drawing types pixel-perfectly on canvas.
//
// Committed drawings render on the MAIN canvas.
// Active/selected drawings + anchors render on the TOP canvas.
// This maintains the dual-canvas performance split.
// ═══════════════════════════════════════════════════════════════════

import { FIB_LEVELS, FIB_COLORS } from './DrawingModel.js';

const ANCHOR_RADIUS = 4;
const ANCHOR_FILL = '#FFFFFF';
const ANCHOR_STROKE = '#2962FF';
const _SELECTED_COLOR = '#2962FF';

/**
 * Create a DrawingRenderer.
 *
 * @param {Object} drawingEngine - DrawingEngine instance
 * @returns {Object} Renderer with drawMain() and drawTop()
 */
export function createDrawingRenderer(drawingEngine) {
  /**
   * Render committed (non-selected) drawings on the main canvas.
   * Called as part of the main canvas render pipeline.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} size - { pixelRatio, bitmapWidth, bitmapHeight, mediaWidth, mediaHeight }
   */
  function drawMain(ctx, size) {
    const drawings = drawingEngine.drawings;
    const pr = size.pixelRatio;
    const hoveredId = drawingEngine.hoveredDrawingId;

    for (const d of drawings) {
      if (!d.visible) continue;
      if (d.state === 'creating') continue; // Creating drawings render on top canvas
      if (d.state === 'selected') continue; // Selected renders on top canvas

      // Apply hover glow effect
      const isHovered = d.id === hoveredId;
      if (isHovered) {
        ctx.save();
        ctx.shadowColor = d.style?.color || '#2962FF';
        ctx.shadowBlur = 8 * pr;
      }

      renderDrawing(ctx, d, pr, size);

      if (isHovered) {
        ctx.restore();
      }
    }
  }

  /**
   * Render active/selected drawings and anchors on the top canvas.
   * Called as part of the top canvas render pipeline.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} size
   */
  function drawTop(ctx, size) {
    const drawings = drawingEngine.drawings;
    const pr = size.pixelRatio;

    for (const d of drawings) {
      if (!d.visible) continue;
      if (d.state !== 'creating' && d.state !== 'selected') continue;

      // ── Sprint 12.2: Ghost preview styling for creating state ──
      if (d.state === 'creating' && d.points.length >= 1) {
        ctx.save();
        ctx.globalAlpha = 0.45;
        ctx.setLineDash([Math.round(6 * pr), Math.round(4 * pr)]);
        // Pulsing glow effect
        const pulsePhase = (Date.now() % 1500) / 1500;
        const pulseGlow = 4 + Math.sin(pulsePhase * Math.PI * 2) * 3;
        ctx.shadowColor = d.style?.color || '#2962FF';
        ctx.shadowBlur = pulseGlow * pr;
        renderDrawing(ctx, d, pr, size);
        ctx.restore();
      } else {
        renderDrawing(ctx, d, pr, size);
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

          // Sprint 13.2: Hover animation — enlarge when hovered
          const isHoveredAnchor = isHoveredDrawing && pi === hoveredAnchor;
          const baseR = Math.round(ANCHOR_RADIUS * pr);
          const hoverR = Math.round(ANCHOR_RADIUS * 1.75 * pr);
          const r = isHoveredAnchor ? hoverR : baseR;

          ctx.save();

          if (isHoveredAnchor) {
            // Glow ring for hovered anchor
            ctx.shadowColor = ANCHOR_STROKE;
            ctx.shadowBlur = 8 * pr;
          } else {
            ctx.shadowColor = 'rgba(0,0,0,0.4)';
            ctx.shadowBlur = 4 * pr;
          }

          // Outer circle (blue ring)
          ctx.beginPath();
          ctx.arc(bx, by, r + Math.round(1.5 * pr), 0, Math.PI * 2);
          ctx.fillStyle = ANCHOR_STROKE;
          ctx.fill();

          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;

          // Inner circle (white dot)
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

              // Pill background
              const pillW = tw + padding * 2;
              const pillH = fontSize + padding * 2;
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

        // Sprint 13.5: Render drawing label (meta.label) near midpoint
        if (d.meta?.label && d.points.length >= 1) {
          const pts = d.points.map(p => drawingEngine.anchorToPixel(p)).filter(Boolean);
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

            // Compute angle
            const angle = Math.atan2(-(byL - by0), bxL - bx0) * (180 / Math.PI);

            const isUp = priceDiff >= 0;
            const arrow = isUp ? '▲' : '▼';
            const sign = isUp ? '+' : '';
            const deltaText = `${arrow} ${sign}${priceDiff >= 1000 ? priceDiff.toFixed(0) : priceDiff.toFixed(2)} (${sign}${pricePct.toFixed(2)}%) · ${angle.toFixed(1)}°`;

            const fontSize = Math.round(10 * pr);
            const padding = Math.round(5 * pr);
            ctx.font = `bold ${fontSize}px -apple-system, Arial`;
            const tw = ctx.measureText(deltaText).width;

            // Position at midpoint between anchors
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

            // Border
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
    }

    // ── Sprint 12.1: Snap indicator overlay ──
    renderSnapIndicator(ctx, pr);

    // ── Smart guide alignment lines ──
    renderSmartGuides(ctx, pr, size);
  }

  /**
   * Sprint 12.1 + Deep Dive Sprint 2: Render a glowing snap indicator at the snap target.
   * Shows a crosshair dot + label with type-differentiated colors:
   *   OHLC = blue, Drawing = orange, Round$ = green, Indicator = purple, Grid = gray
   */
  function renderSnapIndicator(ctx, pr) {
    const snapInfo = drawingEngine.lastSnapInfo;
    if (!snapInfo) return;

    const snapPx = drawingEngine.anchorToPixel({ price: snapInfo.price, time: snapInfo.time });
    if (!snapPx) return;

    const sx = Math.round(snapPx.x * pr);
    const sy = Math.round(snapPx.y * pr);

    // Type-differentiated colors
    const SNAP_COLORS = {
      ohlc:      { glow: 'rgba(41, 98, 255, 0.25)',   mid: 'rgba(41, 98, 255, 0.6)',   pill: 'rgba(41, 98, 255, 0.85)',   guide: 'rgba(41, 98, 255, 0.15)' },
      drawing:   { glow: 'rgba(255, 152, 0, 0.25)',    mid: 'rgba(255, 152, 0, 0.6)',    pill: 'rgba(255, 152, 0, 0.85)',    guide: 'rgba(255, 152, 0, 0.15)' },
      round:     { glow: 'rgba(76, 175, 80, 0.25)',    mid: 'rgba(76, 175, 80, 0.6)',    pill: 'rgba(76, 175, 80, 0.85)',    guide: 'rgba(76, 175, 80, 0.15)' },
      indicator: { glow: 'rgba(156, 39, 176, 0.25)',   mid: 'rgba(156, 39, 176, 0.6)',   pill: 'rgba(156, 39, 176, 0.85)',   guide: 'rgba(156, 39, 176, 0.15)' },
      grid:      { glow: 'rgba(120, 123, 134, 0.25)',  mid: 'rgba(120, 123, 134, 0.5)',  pill: 'rgba(120, 123, 134, 0.75)',  guide: 'rgba(120, 123, 134, 0.1)' },
    };
    const colors = SNAP_COLORS[snapInfo.type] || SNAP_COLORS.ohlc;

    ctx.save();

    // Horizontal guide line from snap dot to right edge (price axis)
    ctx.strokeStyle = colors.guide;
    ctx.lineWidth = Math.max(1, pr);
    ctx.setLineDash([Math.round(3 * pr), Math.round(3 * pr)]);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ctx.canvas.width, sy);
    ctx.stroke();
    ctx.setLineDash([]);

    // Outer glow ring (pulsing)
    const phase = (Date.now() % 1200) / 1200;
    const outerR = Math.round((6 + Math.sin(phase * Math.PI * 2) * 2) * pr);
    ctx.beginPath();
    ctx.arc(sx, sy, outerR, 0, Math.PI * 2);
    ctx.fillStyle = colors.glow;
    ctx.fill();

    // Middle ring
    ctx.beginPath();
    ctx.arc(sx, sy, Math.round(4 * pr), 0, Math.PI * 2);
    ctx.fillStyle = colors.mid;
    ctx.fill();

    // Inner dot
    ctx.beginPath();
    ctx.arc(sx, sy, Math.round(2 * pr), 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();

    // Snap label pill
    if (snapInfo.label) {
      const fontSize = Math.round(9 * pr);
      const padding = Math.round(4 * pr);
      ctx.font = `bold ${fontSize}px -apple-system, Arial`;
      const labelText = snapInfo.label;
      const tw = ctx.measureText(labelText).width;
      const pillW = tw + padding * 2;
      const pillH = fontSize + padding * 2;
      const pillR = Math.round(3 * pr);
      const lx = sx + Math.round(10 * pr);
      const ly = sy - pillH / 2;

      // Pill background
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
      ctx.fillText(labelText, lx + padding, sy);
    }

    ctx.restore();
  }

  /**
   * Render smart guide alignment lines (horizontal/vertical dashed lines
   * connecting the current cursor to aligned drawing anchors).
   */
  function renderSmartGuides(ctx, pr, size) {
    if (!drawingEngine.getSmartGuides) return;
    const mouseState = drawingEngine.state;
    if (mouseState !== 'creating' && mouseState !== 'dragging') return;

    // getSmartGuides needs cursor position — use last point of active drawing
    const activeDrawings = drawingEngine.drawings.filter(d => d.state === 'creating');
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
   * Render a single drawing on the given context.
   */
  function renderDrawing(ctx, drawing, pr, size) {
    const points = drawing.points.map((p) => drawingEngine.anchorToPixel(p)).filter(Boolean);
    if (points.length === 0) return;

    // Convert to bitmap coordinates (with NaN guard)
    const bPoints = points.map((p) => ({
      x: Math.round(p.x * pr),
      y: Math.round(p.y * pr),
    }));

    // NaN crash guard: skip rendering if any point is invalid
    if (bPoints.some((p) => !isFinite(p.x) || !isFinite(p.y))) return;

    const style = drawing.style;
    const lineWidth = Math.max(1, Math.round(style.lineWidth * pr));

    switch (drawing.type) {
      case 'trendline':
        renderTrendline(ctx, bPoints, style, lineWidth, pr);
        break;
      case 'hray':
        renderHorizontalRay(ctx, bPoints, style, lineWidth, pr, size);
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
        renderFibRetracement(ctx, bPoints, drawing.points, style, lineWidth, pr, size);
        break;
      case 'fibext':
        renderFibExtension(ctx, bPoints, drawing.points, style, lineWidth, pr, size);
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

  // ═══ Individual Tool Renderers ═══

  function renderTrendline(ctx, pts, style, lw, pr) {
    if (pts.length < 2) return;
    ctx.strokeStyle = style.color;
    ctx.lineWidth = lw;
    ctx.setLineDash(style.dash ? style.dash.map((d) => Math.round(d * pr)) : []);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    ctx.lineTo(pts[1].x, pts[1].y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function renderHorizontalRay(ctx, pts, style, lw, pr, size) {
    if (pts.length < 1) return;
    const y = pts[0].y;
    ctx.strokeStyle = style.color;
    ctx.lineWidth = lw;
    ctx.setLineDash(style.dash ? style.dash.map((d) => Math.round(d * pr)) : []);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, y);
    ctx.lineTo(size.bitmapWidth, y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Price label
    if (style.showLabel) {
      const pricePoint = drawingEngine.drawings.find((d) =>
        d.points.some((p) => {
          const px = drawingEngine.anchorToPixel(p);
          return px && Math.round(px.y * pr) === y;
        }),
      );
      if (pricePoint && pricePoint.points[0]) {
        drawLabel(
          ctx,
          pricePoint.points[0].price.toFixed(2),
          size.bitmapWidth - Math.round(60 * pr),
          y,
          style.color,
          pr,
        );
      }
    }
  }

  function renderHorizontalLine(ctx, pts, style, lw, pr, size) {
    if (pts.length < 1) return;
    const y = pts[0].y;
    ctx.strokeStyle = style.color;
    ctx.lineWidth = lw;
    ctx.setLineDash(style.dash ? style.dash.map((d) => Math.round(d * pr)) : []);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size.bitmapWidth, y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function renderRay(ctx, pts, style, lw, pr, size) {
    if (pts.length < 2) return;
    ctx.strokeStyle = style.color;
    ctx.lineWidth = lw;
    ctx.setLineDash(style.dash ? style.dash.map((d) => Math.round(d * pr)) : []);

    // Extend from p0 through p1 to edge of canvas
    const dx = pts[1].x - pts[0].x;
    const dy = pts[1].y - pts[0].y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return;

    const scale = (Math.max(size.bitmapWidth, size.bitmapHeight) * 2) / len;
    const endX = pts[0].x + dx * scale;
    const endY = pts[0].y + dy * scale;

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function renderExtendedLine(ctx, pts, style, lw, pr, size) {
    if (pts.length < 2) return;
    ctx.strokeStyle = style.color;
    ctx.lineWidth = lw;
    ctx.setLineDash(style.dash ? style.dash.map((d) => Math.round(d * pr)) : []);

    const dx = pts[1].x - pts[0].x;
    const dy = pts[1].y - pts[0].y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return;

    const scale = (Math.max(size.bitmapWidth, size.bitmapHeight) * 2) / len;

    ctx.beginPath();
    ctx.moveTo(pts[0].x - dx * scale, pts[0].y - dy * scale);
    ctx.lineTo(pts[0].x + dx * scale, pts[0].y + dy * scale);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function renderFibRetracement(ctx, pts, pricePoints, style, lw, pr, size) {
    if (pts.length < 2 || pricePoints.length < 2) return;

    const startPrice = pricePoints[0].price;
    const endPrice = pricePoints[1].price;
    const priceRange = endPrice - startPrice;
    const left = Math.min(pts[0].x, pts[1].x);
    const right = size.bitmapWidth;

    const fontSize = Math.round(11 * pr);
    ctx.font = `${fontSize}px Arial`;
    ctx.textBaseline = 'middle';

    for (let i = 0; i < FIB_LEVELS.length; i++) {
      const level = FIB_LEVELS[i];
      const price = startPrice + priceRange * (1 - level);
      const anchorForY = drawingEngine.anchorToPixel({ price, time: pricePoints[0].time });
      if (!anchorForY) continue;
      const y = Math.round(anchorForY.y * pr);

      const levelColor = FIB_COLORS[level] || style.color;

      // Horizontal line
      ctx.strokeStyle = levelColor;
      ctx.lineWidth = lw;
      ctx.globalAlpha = level === 0 || level === 1 ? 0.8 : 0.5;
      ctx.setLineDash(level === 0.5 ? [Math.round(4 * pr), Math.round(4 * pr)] : []);
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Fill between levels
      if (i < FIB_LEVELS.length - 1 && style.opacity) {
        const nextLevel = FIB_LEVELS[i + 1];
        const nextPrice = startPrice + priceRange * (1 - nextLevel);
        const nextAnchor = drawingEngine.anchorToPixel({ price: nextPrice, time: pricePoints[0].time });
        if (nextAnchor) {
          const nextY = Math.round(nextAnchor.y * pr);
          ctx.fillStyle = levelColor;
          ctx.globalAlpha = style.opacity;
          ctx.fillRect(left, Math.min(y, nextY), right - left, Math.abs(nextY - y));
        }
      }

      // Label
      if (style.showLabel) {
        ctx.globalAlpha = 0.9;
        const labelText = `${(level * 100).toFixed(1)}% (${price.toFixed(2)})`;
        ctx.fillStyle = levelColor;
        ctx.textAlign = 'left';
        ctx.fillText(labelText, left + Math.round(8 * pr), y);
      }

      ctx.globalAlpha = 1;
    }
  }

  function renderRectangle(ctx, pts, style, lw, pr) {
    if (pts.length < 2) return;

    const x = Math.min(pts[0].x, pts[1].x);
    const y = Math.min(pts[0].y, pts[1].y);
    const w = Math.abs(pts[1].x - pts[0].x);
    const h = Math.abs(pts[1].y - pts[0].y);

    // Fill
    if (style.fillColor) {
      ctx.fillStyle = style.fillColor;
      ctx.fillRect(x, y, w, h);
    }

    // Stroke
    ctx.strokeStyle = style.color;
    ctx.lineWidth = lw;
    ctx.setLineDash(style.dash ? style.dash.map((d) => Math.round(d * pr)) : []);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);
  }

  function renderChannel(ctx, pts, style, lw, _pr, _size) {
    if (pts.length < 2) return;

    // Draw two parallel lines
    ctx.strokeStyle = style.color;
    ctx.lineWidth = lw;

    // Main line
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    ctx.lineTo(pts[1].x, pts[1].y);
    ctx.stroke();

    if (pts.length >= 3) {
      // Parallel line through third point
      const dx = pts[1].x - pts[0].x;
      const dy = pts[1].y - pts[0].y;

      ctx.beginPath();
      ctx.moveTo(pts[2].x, pts[2].y);
      ctx.lineTo(pts[2].x + dx, pts[2].y + dy);
      ctx.stroke();

      // Fill between
      if (style.fillColor) {
        ctx.fillStyle = style.fillColor;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        ctx.lineTo(pts[1].x, pts[1].y);
        ctx.lineTo(pts[2].x + dx, pts[2].y + dy);
        ctx.lineTo(pts[2].x, pts[2].y);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  function renderCrossline(ctx, pts, style, lw, pr, size) {
    if (pts.length < 1) return;
    ctx.strokeStyle = style.color;
    ctx.lineWidth = lw;
    ctx.setLineDash(style.dash ? style.dash.map((d) => Math.round(d * pr)) : []);

    // Horizontal
    ctx.beginPath();
    ctx.moveTo(0, pts[0].y);
    ctx.lineTo(size.bitmapWidth, pts[0].y);
    ctx.stroke();

    // Vertical
    ctx.beginPath();
    ctx.moveTo(pts[0].x, 0);
    ctx.lineTo(pts[0].x, size.bitmapHeight);
    ctx.stroke();

    ctx.setLineDash([]);
  }

  function renderArrow(ctx, pts, style, lw, pr) {
    if (pts.length < 2) return;

    // Draw the main segment
    ctx.strokeStyle = style.color;
    ctx.lineWidth = lw;
    ctx.setLineDash(style.dash ? style.dash.map((d) => Math.round(d * pr)) : []);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    ctx.lineTo(pts[1].x, pts[1].y);
    ctx.stroke();

    // Draw arrowhead
    const dx = pts[1].x - pts[0].x;
    const dy = pts[1].y - pts[0].y;
    const angle = Math.atan2(dy, dx);
    const headlen = Math.max(10, lw * 4) * pr;

    ctx.beginPath();
    ctx.moveTo(pts[1].x, pts[1].y);
    ctx.lineTo(pts[1].x - headlen * Math.cos(angle - Math.PI / 6), pts[1].y - headlen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(pts[1].x - headlen * Math.cos(angle + Math.PI / 6), pts[1].y - headlen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();

    ctx.fillStyle = style.color;
    ctx.fill();
    ctx.setLineDash([]);
  }

  function renderText(ctx, pts, drawing, style, pr) {
    if (pts.length < 1) return;
    const text = drawing.meta?.text || 'Text';
    const fontSize = Math.round(parseInt(style.font || '14') * pr);
    ctx.font = `${fontSize}px Arial`;
    ctx.fillStyle = style.color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(text, pts[0].x, pts[0].y);
  }

  function renderTriangle(ctx, pts, style, lw, pr) {
    if (pts.length < 3) return;

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    ctx.lineTo(pts[1].x, pts[1].y);
    ctx.lineTo(pts[2].x, pts[2].y);
    ctx.closePath();

    if (style.fillColor) {
      ctx.fillStyle = style.fillColor;
      ctx.fill();
    }

    ctx.strokeStyle = style.color;
    ctx.lineWidth = lw;
    ctx.setLineDash(style.dash ? style.dash.map((d) => Math.round(d * pr)) : []);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function renderEllipse(ctx, pts, style, lw, pr) {
    if (pts.length < 2) return;

    const minX = Math.min(pts[0].x, pts[1].x);
    const maxX = Math.max(pts[0].x, pts[1].x);
    const minY = Math.min(pts[0].y, pts[1].y);
    const maxY = Math.max(pts[0].y, pts[1].y);

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const radiusX = Math.max(1, (maxX - minX) / 2);
    const radiusY = Math.max(1, (maxY - minY) / 2);

    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);

    if (style.fillColor) {
      ctx.fillStyle = style.fillColor;
      ctx.fill();
    }

    ctx.strokeStyle = style.color;
    ctx.lineWidth = lw;
    ctx.setLineDash(style.dash ? style.dash.map((d) => Math.round(d * pr)) : []);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function renderPitchfork(ctx, pts, drawing, style, lw, pr, size) {
    if (pts.length < 3) return;

    ctx.strokeStyle = style.color;
    ctx.lineWidth = lw;
    ctx.setLineDash(style.dash ? style.dash.map((d) => Math.round(d * pr)) : []);

    // Base line (from pt1 to pt2)
    ctx.beginPath();
    ctx.moveTo(pts[1].x, pts[1].y);
    ctx.lineTo(pts[2].x, pts[2].y);
    ctx.stroke();

    // Midpoint of base line
    const midX = (pts[1].x + pts[2].x) / 2;
    const midY = (pts[1].y + pts[2].y) / 2;

    // Median line (from pt0 through midpoint, extending outwards)
    const dx = midX - pts[0].x;
    const dy = midY - pts[0].y;
    const len = Math.sqrt(dx * dx + dy * dy);

    if (len > 0) {
      const scale = (Math.max(size.bitmapWidth, size.bitmapHeight) * 2) / len;
      const endX = pts[0].x + dx * scale;
      const endY = pts[0].y + dy * scale;

      // Draw Median line
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      // Draw Parallel lines from pt1 and pt2
      ctx.beginPath();
      ctx.moveTo(pts[1].x, pts[1].y);
      ctx.lineTo(pts[1].x + dx * scale, pts[1].y + dy * scale);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(pts[2].x, pts[2].y);
      ctx.lineTo(pts[2].x + dx * scale, pts[2].y + dy * scale);
      ctx.stroke();

      // Optional: fill between the parallels
      if (style.fillColor) {
        ctx.fillStyle = style.fillColor;
        ctx.beginPath();
        ctx.moveTo(pts[1].x, pts[1].y);
        ctx.lineTo(pts[2].x, pts[2].y);
        ctx.lineTo(pts[2].x + dx * scale, pts[2].y + dy * scale);
        ctx.lineTo(pts[1].x + dx * scale, pts[1].y + dy * scale);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.setLineDash([]);
  }

  function renderCallout(ctx, pts, drawing, style, lw, pr) {
    if (pts.length < 1) return;
    const text = drawing.meta?.text || 'Price Note';
    const fontSize = Math.round(parseInt(style.font || '12') * pr);
    const padding = Math.round(6 * pr);
    const pointerSize = Math.round(8 * pr);

    ctx.font = `${fontSize}px Arial`;
    const tw = ctx.measureText(text).width;
    const th = fontSize;
    const boxW = tw + padding * 2;
    const boxH = th + padding * 2;

    // Position box above and to the right of the anchor point
    const boxX = pts[0].x + pointerSize;
    const boxY = pts[0].y - boxH - pointerSize;

    // Draw balloon background with pointer
    ctx.fillStyle = style.fillColor || '#2962FF';
    ctx.beginPath();
    ctx.moveTo(boxX, boxY);
    ctx.lineTo(boxX + boxW, boxY);
    ctx.lineTo(boxX + boxW, boxY + boxH);
    ctx.lineTo(boxX + pointerSize * 2, boxY + boxH);
    ctx.lineTo(pts[0].x, pts[0].y); // Pointer to anchor
    ctx.lineTo(boxX, boxY + boxH - pointerSize);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = style.color;
    ctx.lineWidth = lw;
    ctx.stroke();

    // Draw text
    ctx.fillStyle = style.color || '#FFFFFF'; // Ensure high contrast
    if (style.fillColor && style.color === style.fillColor) {
      ctx.fillStyle = '#FFFFFF';
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(text, boxX + padding, boxY + padding);
  }

  function renderVerticalLine(ctx, pts, style, lw, pr, size) {
    if (pts.length < 1) return;
    const x = pts[0].x;
    ctx.strokeStyle = style.color;
    ctx.lineWidth = lw;
    ctx.setLineDash(style.dash ? style.dash.map((d) => Math.round(d * pr)) : []);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size.bitmapHeight);
    ctx.stroke();
    ctx.setLineDash([]);
  }

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

  function renderFibExtension(ctx, pts, pricePoints, style, lw, pr, size) {
    if (pts.length < 3 || pricePoints.length < 3) return;

    // Pt 1: Start of trend, Pt 2: End of trend, Pt 3: Retracement point (origin for extension)
    const trendRange = pricePoints[1].price - pricePoints[0].price;
    const originPrice = pricePoints[2].price;
    const left = Math.min(...pts.map((p) => p.x));
    const right = size.bitmapWidth;

    const fontSize = Math.round(11 * pr);
    ctx.font = `${fontSize}px Arial`;
    ctx.textBaseline = 'middle';

    // Draw the baseline connecting the 3 points
    ctx.strokeStyle = style.color;
    ctx.lineWidth = Math.max(1, Math.round(1 * pr));
    ctx.setLineDash([Math.round(4 * pr), Math.round(4 * pr)]);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    ctx.lineTo(pts[1].x, pts[1].y);
    ctx.lineTo(pts[2].x, pts[2].y);
    ctx.stroke();
    ctx.setLineDash([]);

    for (let i = 0; i < FIB_LEVELS.length; i++) {
      const level = FIB_LEVELS[i];
      const price = originPrice + trendRange * level;
      const anchorForY = drawingEngine.anchorToPixel({ price, time: pricePoints[2].time });
      if (!anchorForY) continue;
      const y = Math.round(anchorForY.y * pr);

      const levelColor = FIB_COLORS[level] || style.color;

      ctx.strokeStyle = levelColor;
      ctx.lineWidth = lw;
      ctx.globalAlpha = level === 1 ? 0.8 : 0.5;
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
      ctx.stroke();

      // Label
      if (style.showLabel) {
        ctx.globalAlpha = 0.9;
        const labelText = `${(level * 100).toFixed(1)}% (${price.toFixed(2)})`;
        ctx.fillStyle = levelColor;
        ctx.textAlign = 'left';
        ctx.fillText(labelText, left + Math.round(8 * pr), y);
      }
      ctx.globalAlpha = 1;
    }
  }

  function renderElliottWaves(ctx, pts, drawing, style, lw, pr) {
    if (pts.length < 1) return;

    const labels = ['(1)', '(2)', '(3)', '(4)', '(5)'];

    // Draw lines between points
    ctx.strokeStyle = style.color;
    ctx.lineWidth = lw;
    ctx.setLineDash(style.dash ? style.dash.map((d) => Math.round(d * pr)) : []);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw Labels
    const fontSize = Math.round(parseInt(style.font || '14') * pr);
    ctx.font = `${fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // First point (Start) usually has no label, or we label from 0
    // For standard 5-wave impulse, points 1-5 get labels '(1)' through '(5)'
    for (let i = 1; i < pts.length; i++) {
      const text = labels[i - 1] || `(${i})`;

      // determine if we should draw above or below based on previous point
      const isUpWave = pts[i].y < pts[i - 1].y;
      const yOffset = isUpWave ? -Math.round(15 * pr) : Math.round(15 * pr);

      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(text, pts[i].x, pts[i].y + yOffset);

      ctx.strokeStyle = style.color;
      ctx.lineWidth = 1;
      ctx.strokeText(text, pts[i].x, pts[i].y + yOffset);
      ctx.fillStyle = style.color;
      ctx.fillText(text, pts[i].x, pts[i].y + yOffset);
    }
  }

  function renderLongPosition(ctx, pts, drawing, style, lw, pr, size) {
    if (pts.length < 2) return;
    const isCreating = drawing.state === 'creating';

    const entryY = pts[0].y;
    const targetY = pts[1].y;
    // Default symmetric stop if creating, else actual stop point if we supported 3 points
    // For 2 points, we hardcode symmetric stop for simplicity
    const stopY = entryY + (entryY - targetY);

    const x = pts[0].x;
    const w = isCreating ? Math.max(100 * pr, Math.abs(pts[1].x - x)) : Math.max(40 * pr, Math.abs(pts[1].x - x));

    // Target (Profit) Box - Green
    ctx.fillStyle = style.fillColor || 'rgba(8, 153, 129, 0.2)';
    ctx.fillRect(x, Math.min(entryY, targetY), w, Math.abs(entryY - targetY));

    // Stop (Loss) Box - Red
    ctx.fillStyle = 'rgba(242, 54, 69, 0.2)'; // Hardcoded red for loss
    ctx.fillRect(x, Math.min(entryY, stopY), w, Math.abs(entryY - stopY));

    // Dividing line
    ctx.strokeStyle = style.color;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(x, entryY);
    ctx.lineTo(x + w, entryY);
    ctx.stroke();

    // Risk / Reward Text
    if (drawing.points.length >= 2) {
      const entryP = drawing.points[0].price;
      const targetP = drawing.points[1].price;
      const stopP = entryP - (targetP - entryP);

      const profit = Math.abs(targetP - entryP);
      const loss = Math.abs(entryP - stopP);
      const rr = profit / loss;

      const fontSize = Math.round(11 * pr);
      ctx.font = `${fontSize}px Arial`;
      ctx.fillStyle = style.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const textX = x + w / 2;
      ctx.fillText(`Target: ${targetP.toFixed(2)}`, textX, (entryY + targetY) / 2);
      ctx.fillText(`Stop: ${stopP.toFixed(2)}`, textX, (entryY + stopY) / 2);
      ctx.fillText(`Risk/Reward: ${rr.toFixed(2)}`, textX, entryY);
    }
  }

  function renderShortPosition(ctx, pts, drawing, style, lw, pr, size) {
    if (pts.length < 2) return;
    const isCreating = drawing.state === 'creating';

    const entryY = pts[0].y;
    const targetY = pts[1].y; // Target is below entry (so higher Y pixel)
    const stopY = entryY - (targetY - entryY); // Stop is above entry (so lower Y pixel)

    const x = pts[0].x;
    const w = isCreating ? Math.max(100 * pr, Math.abs(pts[1].x - x)) : Math.max(40 * pr, Math.abs(pts[1].x - x));

    // Target (Profit) Box - Green (Actually red for short default, but passing style handles it)
    ctx.fillStyle = style.fillColor || 'rgba(242, 54, 69, 0.2)';
    ctx.fillRect(x, Math.min(entryY, targetY), w, Math.abs(entryY - targetY));

    // Stop (Loss) Box - Red (Actually green for short)
    ctx.fillStyle = 'rgba(8, 153, 129, 0.2)';
    ctx.fillRect(x, Math.min(entryY, stopY), w, Math.abs(entryY - stopY));

    // Dividing line
    ctx.strokeStyle = style.color;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(x, entryY);
    ctx.lineTo(x + w, entryY);
    ctx.stroke();

    // Risk / Reward Text
    if (drawing.points.length >= 2) {
      const entryP = drawing.points[0].price;
      const targetP = drawing.points[1].price;
      const stopP = entryP + (entryP - targetP);

      const profit = Math.abs(entryP - targetP);
      const loss = Math.abs(stopP - entryP);
      const rr = profit / loss;

      const fontSize = Math.round(11 * pr);
      ctx.font = `${fontSize}px Arial`;
      ctx.fillStyle = style.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const textX = x + w / 2;
      ctx.fillText(`Target: ${targetP.toFixed(2)}`, textX, (entryY + targetY) / 2);
      ctx.fillText(`Stop: ${stopP.toFixed(2)}`, textX, (entryY + stopY) / 2);
      ctx.fillText(`Risk/Reward: ${rr.toFixed(2)}`, textX, entryY);
    }
  }

  function renderGannFan(ctx, pts, drawing, style, lw, pr, size) {
    if (pts.length < 2) return;

    const origin = pts[0];
    const target = pts[1];

    const dx = target.x - origin.x;
    const dy = target.y - origin.y;
    if (dx === 0) return;

    // Classic Gann angles (y/x multiplier) relative to the 1x1 line drawn to target
    const angles = [8 / 1, 4 / 1, 3 / 1, 2 / 1, 1 / 1, 1 / 2, 1 / 3, 1 / 4, 1 / 8];

    const maxDim = Math.max(size.bitmapWidth, size.bitmapHeight) * 2;

    ctx.strokeStyle = style.color;
    ctx.lineWidth = lw;
    ctx.setLineDash(style.dash ? style.dash.map((d) => Math.round(d * pr)) : []);

    for (let i = 0; i < angles.length; i++) {
      const mul = angles[i];

      ctx.beginPath();
      ctx.moveTo(origin.x, origin.y);

      // This is a simplified Gann Fan that rotates the user's 1x1 vector
      let endX, endY;
      if (i === 4) {
        // 1x1
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len === 0) continue;
        const scale = maxDim / len;
        endX = origin.x + dx * scale;
        endY = origin.y + dy * scale;
      } else {
        // To project proper Gann Angles based on price/time, we need chart scaling
        // For visual approximation, we adjust the DY slope
        const newDy = dy * mul;
        const len = Math.sqrt(dx * dx + newDy * newDy);
        if (len === 0) continue;
        const scale = maxDim / len;
        endX = origin.x + dx * scale;
        endY = origin.y + newDy * scale;
      }

      ctx.lineTo(endX, endY);
      ctx.stroke();

      if (style.showLabel) {
        const lbl = angles[i] >= 1 ? `${angles[i]}/1` : `1/${1 / angles[i]}`;
        ctx.font = `${Math.round(10 * pr)}px Arial`;
        ctx.fillStyle = style.color;
        // draw label near the end of the visible segment
        const tX = origin.x + (endX - origin.x) * 0.3;
        const tY = origin.y + (endY - origin.y) * 0.3;
        if (tX > 0 && tX < size.bitmapWidth && tY > 0 && tY < size.bitmapHeight) {
          ctx.fillText(lbl, tX, tY);
        }
      }
    }
    ctx.setLineDash([]);
  }

  function renderFibTimeZone(ctx, pts, drawing, style, lw, pr, size) {
    if (pts.length < 2) return;

    const x1 = pts[0].x;
    const x2 = pts[1].x;
    const unitDist = x2 - x1;
    if (unitDist === 0) return;

    // Standard Fibonacci Sequence
    const fibs = [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144];

    ctx.strokeStyle = style.color;
    ctx.lineWidth = lw;
    ctx.setLineDash(style.dash ? style.dash.map((d) => Math.round(d * pr)) : []);

    const fontSize = Math.round(11 * pr);
    ctx.font = `${fontSize}px Arial`;
    ctx.textAlign = 'center';

    for (let i = 0; i < fibs.length; i++) {
      const fibX = x1 + unitDist * fibs[i];

      // Stop drawing if we go way off screen
      if (unitDist > 0 && fibX > size.bitmapWidth * 2) break;
      if (unitDist < 0 && fibX < -size.bitmapWidth) break;

      ctx.beginPath();
      ctx.moveTo(fibX, 0);
      ctx.lineTo(fibX, size.bitmapHeight);
      ctx.stroke();

      if (style.showLabel) {
        ctx.fillStyle = style.color;
        ctx.fillText(fibs[i], fibX, size.bitmapHeight - 20 * pr);
      }

      // Fill background mildly
      if (i < fibs.length - 1 && style.opacity) {
        const nextX = x1 + unitDist * fibs[i + 1];
        const w = Math.abs(nextX - fibX);
        const lX = Math.min(fibX, nextX);
        ctx.fillStyle = i % 2 === 0 ? style.color : 'transparent';
        ctx.globalAlpha = style.opacity * 0.5;
        ctx.fillRect(lX, 0, w, size.bitmapHeight);
        ctx.globalAlpha = 1;
      }
    }

    ctx.setLineDash([]);
  }

  /**
   * Render a measure tool — dashed rectangle with info overlay.
   * Shows: price change ($, %), bar count, and time elapsed.
   */
  function renderMeasure(ctx, pts, drawing, style, lw, pr, size) {
    if (pts.length < 2) return;

    const x1 = Math.min(pts[0].x, pts[1].x);
    const x2 = Math.max(pts[0].x, pts[1].x);
    const y1 = Math.min(pts[0].y, pts[1].y);
    const y2 = Math.max(pts[0].y, pts[1].y);
    const w = x2 - x1;
    const h = y2 - y1;

    // Dashed rectangle
    ctx.strokeStyle = style.color;
    ctx.lineWidth = lw;
    ctx.setLineDash([Math.round(4 * pr), Math.round(3 * pr)]);
    ctx.strokeRect(x1, y1, w, h);
    ctx.setLineDash([]);

    // Semi-transparent fill
    if (style.fillColor) {
      ctx.fillStyle = style.fillColor;
      ctx.fillRect(x1, y1, w, h);
    }

    // Diagonal dashed line from pt0 to pt1
    ctx.strokeStyle = style.color;
    ctx.lineWidth = lw;
    ctx.setLineDash([Math.round(3 * pr), Math.round(3 * pr)]);
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    ctx.lineTo(pts[1].x, pts[1].y);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);

    // Build info label from anchor point data
    if (drawing.points.length >= 2) {
      const p0 = drawing.points[0];
      const p1 = drawing.points[1];
      const priceDiff = p1.price - p0.price;
      const pricePct = p0.price !== 0 ? (priceDiff / p0.price) * 100 : 0;
      const timeDiffMs = Math.abs(p1.time - p0.time);

      // Format time
      let timeStr;
      if (timeDiffMs < 60000) timeStr = `${Math.round(timeDiffMs / 1000)}s`;
      else if (timeDiffMs < 3600000) timeStr = `${Math.round(timeDiffMs / 60000)}m`;
      else if (timeDiffMs < 86400000) timeStr = `${(timeDiffMs / 3600000).toFixed(1)}h`;
      else timeStr = `${(timeDiffMs / 86400000).toFixed(1)}d`;

      // Estimate bar count from meta if available, otherwise from time
      const bars = drawing.meta?.barCount || '—';

      const lines = [
        `${priceDiff >= 0 ? '+' : ''}${priceDiff.toFixed(2)} (${priceDiff >= 0 ? '+' : ''}${pricePct.toFixed(2)}%)`,
        `${bars} bars · ${timeStr}`,
      ];

      // R-multiple line (if risk per trade is available via meta)
      const riskPerTrade = drawing.meta?.riskPerTrade;
      if (riskPerTrade && riskPerTrade > 0) {
        const rMultiple = Math.abs(priceDiff) / riskPerTrade;
        lines.push(`${priceDiff >= 0 ? '' : '-'}${rMultiple.toFixed(2)}R`);
      }

      // Draw info box at center of the rectangle
      const fontSize = Math.round(11 * pr);
      const lineHeight = Math.round(15 * pr);
      const padding = Math.round(6 * pr);
      ctx.font = `bold ${fontSize}px Arial`;

      // Measure text widths
      const maxTW = Math.max(...lines.map((l) => ctx.measureText(l).width));
      const boxW = maxTW + padding * 2;
      const boxH = lineHeight * lines.length + padding * 2;

      // Position: center of the measured area
      const cx = (x1 + x2) / 2 - boxW / 2;
      const cy = (y1 + y2) / 2 - boxH / 2;

      // Background
      ctx.fillStyle = '#1E222DEB';
      const radius = Math.round(4 * pr);
      ctx.beginPath();
      ctx.moveTo(cx + radius, cy);
      ctx.lineTo(cx + boxW - radius, cy);
      ctx.quadraticCurveTo(cx + boxW, cy, cx + boxW, cy + radius);
      ctx.lineTo(cx + boxW, cy + boxH - radius);
      ctx.quadraticCurveTo(cx + boxW, cy + boxH, cx + boxW - radius, cy + boxH);
      ctx.lineTo(cx + radius, cy + boxH);
      ctx.quadraticCurveTo(cx, cy + boxH, cx, cy + boxH - radius);
      ctx.lineTo(cx, cy + radius);
      ctx.quadraticCurveTo(cx, cy, cx + radius, cy);
      ctx.closePath();
      ctx.fill();

      // Border
      ctx.strokeStyle = style.color;
      ctx.lineWidth = Math.round(1 * pr);
      ctx.stroke();

      // Text
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const textX = cx + boxW / 2;
      let textY = cy + padding;

      // Price line (color based on direction)
      ctx.fillStyle = priceDiff >= 0 ? '#26A69A' : '#EF5350';
      ctx.fillText(lines[0], textX, textY);
      textY += lineHeight;

      // Bars/time line
      ctx.fillStyle = '#D1D4DC';
      ctx.font = `${fontSize}px Arial`;
      ctx.fillText(lines[1], textX, textY);
    }
  }

  /**
   * Render an alert zone — full-width shaded rectangle between two prices with label.
   */
  function renderAlertZone(ctx, pts, drawing, style, lw, pr, size) {
    if (pts.length < 2) return;

    const y1 = Math.min(pts[0].y, pts[1].y);
    const y2 = Math.max(pts[0].y, pts[1].y);
    const h = y2 - y1;

    // Semi-transparent fill spanning the entire chart width
    ctx.fillStyle = style.fillColor || 'rgba(245, 158, 11, 0.12)';
    ctx.fillRect(0, y1, size.bitmapWidth, h);

    // Top and bottom borders
    ctx.strokeStyle = style.color;
    ctx.lineWidth = lw;
    ctx.setLineDash(style.dash ? style.dash.map((d) => Math.round(d * pr)) : []);
    ctx.beginPath();
    ctx.moveTo(0, y1); ctx.lineTo(size.bitmapWidth, y1);
    ctx.moveTo(0, y2); ctx.lineTo(size.bitmapWidth, y2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Label
    const label = drawing.meta?.text || 'Alert Zone';
    const fontSize = Math.round(11 * pr);
    const padding = Math.round(4 * pr);
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.fillStyle = style.color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(label, Math.round(8 * pr), y1 + padding);

    // Price labels on the right
    if (drawing.points.length >= 2) {
      const topPrice = Math.max(drawing.points[0].price, drawing.points[1].price);
      const botPrice = Math.min(drawing.points[0].price, drawing.points[1].price);
      ctx.font = `${Math.round(10 * pr)}px Arial`;
      ctx.textAlign = 'right';
      ctx.fillText(topPrice.toFixed(2), size.bitmapWidth - Math.round(8 * pr), y1 + padding);
      ctx.textBaseline = 'bottom';
      ctx.fillText(botPrice.toFixed(2), size.bitmapWidth - Math.round(8 * pr), y2 - padding);
    }
  }

  // ─── Fibonacci Arc ─────────────────────────────────────────────
  function renderFibArc(ctx, pts, pricePoints, style, lw, pr, size) {
    if (pts.length < 2) return;

    const cx = pts[0].x, cy = pts[0].y;
    const dx = pts[1].x - cx, dy = pts[1].y - cy;
    const baseRadius = Math.sqrt(dx * dx + dy * dy);
    if (baseRadius < 2) return;

    const levels = [0.236, 0.382, 0.5, 0.618, 0.786, 1];
    const fontSize = Math.round(10 * pr);
    ctx.font = `${fontSize}px Arial`;
    ctx.textBaseline = 'middle';

    for (const level of levels) {
      const r = baseRadius * level;
      const levelColor = FIB_COLORS[level] || style.color;

      // Arc fill
      if (style.opacity) {
        ctx.fillStyle = levelColor;
        ctx.globalAlpha = style.opacity;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI, dy > 0);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Arc stroke
      ctx.strokeStyle = levelColor;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI, dy > 0);
      ctx.stroke();

      // Label
      if (style.showLabel) {
        ctx.fillStyle = levelColor;
        ctx.textAlign = 'left';
        ctx.fillText(`${(level * 100).toFixed(1)}%`, cx + r + 4 * pr, cy);
      }
    }
  }

  // ─── Fibonacci Fan ─────────────────────────────────────────────
  function renderFibFan(ctx, pts, pricePoints, style, lw, pr, size) {
    if (pts.length < 2) return;

    const levels = [0.236, 0.382, 0.5, 0.618, 0.786];
    const dx = pts[1].x - pts[0].x;
    const dy = pts[1].y - pts[0].y;
    if (Math.abs(dx) < 1) return;

    const maxExtend = Math.max(size.bitmapWidth, size.bitmapHeight) * 2;
    const len = Math.sqrt(dx * dx + dy * dy);
    const scaleFactor = maxExtend / len;

    const fontSize = Math.round(10 * pr);
    ctx.font = `${fontSize}px Arial`;

    // Draw the baseline
    ctx.strokeStyle = style.color;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    ctx.lineTo(pts[0].x + dx * scaleFactor, pts[0].y + dy * scaleFactor);
    ctx.stroke();

    for (const level of levels) {
      const fanDy = dy * level;
      const fanLen = Math.sqrt(dx * dx + fanDy * fanDy);
      const fanScale = maxExtend / fanLen;
      const endX = pts[0].x + dx * fanScale;
      const endY = pts[0].y + fanDy * fanScale;

      const levelColor = FIB_COLORS[level] || style.color;

      ctx.strokeStyle = levelColor;
      ctx.lineWidth = lw;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      ctx.globalAlpha = 1;

      if (style.showLabel) {
        const labelX = pts[0].x + dx * 0.4;
        const labelY = pts[0].y + fanDy * 0.4;
        if (labelX > 0 && labelX < size.bitmapWidth && labelY > 0 && labelY < size.bitmapHeight) {
          ctx.fillStyle = levelColor;
          ctx.textAlign = 'left';
          ctx.fillText(`${(level * 100).toFixed(1)}%`, labelX, labelY);
        }
      }
    }
  }

  // ─── Fibonacci Channel ─────────────────────────────────────────
  function renderFibChannel(ctx, pts, pricePoints, style, lw, pr, size) {
    if (pts.length < 3) return;

    const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
    const dx = pts[1].x - pts[0].x;
    const dy = pts[1].y - pts[0].y;

    // Channel offset from point 3
    const offsetX = pts[2].x - pts[0].x;
    const offsetY = pts[2].y - pts[0].y;

    const fontSize = Math.round(10 * pr);
    ctx.font = `${fontSize}px Arial`;

    for (let i = 0; i < levels.length; i++) {
      const level = levels[i];
      const ox = offsetX * level;
      const oy = offsetY * level;

      const levelColor = FIB_COLORS[level] || style.color;

      ctx.strokeStyle = levelColor;
      ctx.lineWidth = lw;
      ctx.globalAlpha = level === 0 || level === 1 ? 0.8 : 0.5;
      ctx.beginPath();
      ctx.moveTo(pts[0].x + ox, pts[0].y + oy);
      ctx.lineTo(pts[1].x + ox, pts[1].y + oy);
      ctx.stroke();

      // Fill between this and next level
      if (i < levels.length - 1 && style.fillColor) {
        const nextLevel = levels[i + 1];
        const nox = offsetX * nextLevel;
        const noy = offsetY * nextLevel;
        ctx.fillStyle = style.fillColor;
        ctx.globalAlpha = 0.04;
        ctx.beginPath();
        ctx.moveTo(pts[0].x + ox, pts[0].y + oy);
        ctx.lineTo(pts[1].x + ox, pts[1].y + oy);
        ctx.lineTo(pts[1].x + nox, pts[1].y + noy);
        ctx.lineTo(pts[0].x + nox, pts[0].y + noy);
        ctx.closePath();
        ctx.fill();
      }

      ctx.globalAlpha = 1;

      if (style.showLabel) {
        ctx.fillStyle = levelColor;
        ctx.textAlign = 'left';
        ctx.fillText(`${(level * 100).toFixed(1)}%`, pts[1].x + ox + 4 * pr, pts[1].y + oy);
      }
    }
  }

  // ─── Regression Channel ────────────────────────────────────────
  function renderRegressionChannel(ctx, pts, drawing, style, lw, pr, size) {
    if (pts.length < 2 || !drawing.points || drawing.points.length < 2) return;

    // Use pixel-space linear regression between the two anchor points
    const x1 = pts[0].x, y1 = pts[0].y;
    const x2 = pts[1].x, y2 = pts[1].y;
    const dx = x2 - x1;
    if (Math.abs(dx) < 2) return;

    // Regression line (already defined by 2 points)
    // Standard deviation approximation: use distance from midpoint
    const midY = (y1 + y2) / 2;
    const halfRange = Math.abs(y2 - y1) * 0.15; // ~1 stddev estimate

    // Regression line
    ctx.strokeStyle = style.color;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Upper band (+1σ)
    ctx.setLineDash([Math.round(4 * pr), Math.round(4 * pr)]);
    ctx.beginPath();
    ctx.moveTo(x1, y1 - halfRange);
    ctx.lineTo(x2, y2 - halfRange);
    ctx.stroke();

    // Lower band (-1σ)
    ctx.beginPath();
    ctx.moveTo(x1, y1 + halfRange);
    ctx.lineTo(x2, y2 + halfRange);
    ctx.stroke();
    ctx.setLineDash([]);

    // Fill between bands
    if (style.fillColor) {
      ctx.fillStyle = style.fillColor;
      ctx.beginPath();
      ctx.moveTo(x1, y1 - halfRange);
      ctx.lineTo(x2, y2 - halfRange);
      ctx.lineTo(x2, y2 + halfRange);
      ctx.lineTo(x1, y1 + halfRange);
      ctx.closePath();
      ctx.fill();
    }

    // Labels
    if (style.showLabel) {
      const fontSize = Math.round(10 * pr);
      ctx.font = `${fontSize}px Arial`;
      ctx.fillStyle = style.color;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText('Reg', x2 - 4 * pr, y2);
      ctx.fillText('+1σ', x2 - 4 * pr, y2 - halfRange);
      ctx.fillText('-1σ', x2 - 4 * pr, y2 + halfRange);
    }
  }

  // ─── Gann Square ─────────────────────────────────────────────

  function renderGannSquare(ctx, pts, drawing, style, lw, pr, size) {
    if (pts.length < 2) return;
    const [p0, p1] = pts;
    const x1 = p0.x, y1 = p0.y;
    const x2 = p1.x, y2 = p1.y;
    const w = x2 - x1, h = y2 - y1;

    ctx.strokeStyle = style.color;
    ctx.lineWidth = lw;
    ctx.setLineDash(style.dash?.length ? style.dash.map(d => d * pr) : []);

    // Outer rectangle
    ctx.strokeRect(x1, y1, w, h);

    // Grid lines (3×3)
    for (let i = 1; i < 3; i++) {
      const frac = i / 3;
      // Horizontal
      ctx.beginPath();
      ctx.moveTo(x1, y1 + h * frac);
      ctx.lineTo(x2, y1 + h * frac);
      ctx.stroke();
      // Vertical
      ctx.beginPath();
      ctx.moveTo(x1 + w * frac, y1);
      ctx.lineTo(x1 + w * frac, y2);
      ctx.stroke();
    }

    // Diagonal lines
    ctx.beginPath();
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.moveTo(x2, y1); ctx.lineTo(x1, y2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Labels
    if (style.showLabel) {
      const fontSize = Math.round(9 * pr);
      ctx.font = `${fontSize}px Arial`;
      ctx.fillStyle = style.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('Gann', (x1 + x2) / 2, y1 - fontSize - 2 * pr);
    }
  }

  // ─── XABCD Harmonic Pattern ──────────────────────────────────

  function renderXABCD(ctx, pts, drawing, style, lw, pr, size) {
    if (pts.length < 2) return;
    const labels = ['X', 'A', 'B', 'C', 'D'];

    ctx.strokeStyle = style.color;
    ctx.lineWidth = lw;
    ctx.setLineDash(style.dash?.length ? style.dash.map(d => d * pr) : []);

    // Draw connected lines
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.stroke();

    // Fill if enough points
    if (pts.length >= 4 && style.fillColor) {
      ctx.fillStyle = style.fillColor;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
      ctx.fill();
    }

    // Dashed XA-BD retracement lines
    if (pts.length >= 4) {
      ctx.save();
      ctx.setLineDash([4 * pr, 4 * pr]);
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y); // X to C
      ctx.lineTo(pts[3].x, pts[3].y);
      ctx.stroke();
      if (pts.length >= 5) {
        ctx.beginPath();
        ctx.moveTo(pts[1].x, pts[1].y); // A to D
        ctx.lineTo(pts[4].x, pts[4].y);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.setLineDash([]);

    // Labels
    if (style.showLabel) {
      const fontSize = Math.round(10 * pr);
      ctx.font = `bold ${fontSize}px Arial`;
      ctx.fillStyle = style.color;
      ctx.textAlign = 'center';
      for (let i = 0; i < pts.length && i < labels.length; i++) {
        const yOff = (i % 2 === 0) ? -8 * pr : 12 * pr;
        ctx.fillText(labels[i], pts[i].x, pts[i].y + yOff);
      }
    }
  }

  // ─── Head & Shoulders ────────────────────────────────────────

  function renderHeadShoulders(ctx, pts, drawing, style, lw, pr, size) {
    if (pts.length < 2) return;
    const labels = ['LS', 'V1', 'H', 'V2', 'RS', 'NL1', 'NL2'];

    ctx.strokeStyle = style.color;
    ctx.lineWidth = lw;
    ctx.setLineDash(style.dash?.length ? style.dash.map(d => d * pr) : []);

    // Draw pattern line
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < Math.min(pts.length, 5); i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.stroke();

    // Neckline (points 5-6 or auto from valleys)
    if (pts.length >= 6) {
      ctx.save();
      ctx.setLineDash([6 * pr, 4 * pr]);
      ctx.beginPath();
      ctx.moveTo(pts[5].x, pts[5].y);
      if (pts.length >= 7) {
        ctx.lineTo(pts[6].x, pts[6].y);
      } else {
        // Extend neckline across chart
        ctx.lineTo(size.bitmapWidth, pts[5].y);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Fill
    if (pts.length >= 5 && style.fillColor) {
      ctx.fillStyle = style.fillColor;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < 5; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
      ctx.fill();
    }

    ctx.setLineDash([]);

    // Labels
    if (style.showLabel) {
      const fontSize = Math.round(9 * pr);
      ctx.font = `bold ${fontSize}px Arial`;
      ctx.fillStyle = style.color;
      ctx.textAlign = 'center';
      for (let i = 0; i < pts.length && i < labels.length; i++) {
        const yOff = (i % 2 === 0) ? -8 * pr : 12 * pr;
        ctx.fillText(labels[i], pts[i].x, pts[i].y + yOff);
      }
    }
  }

  // ─── Emoji ───────────────────────────────────────────────────

  function renderEmoji(ctx, pts, drawing, style, pr) {
    if (pts.length < 1) return;
    const emoji = drawing.meta?.emoji || '📌';
    const fontSize = Math.round(parseInt(style.font) * pr) || Math.round(24 * pr);
    ctx.font = `${fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, pts[0].x, pts[0].y);
  }

  // ─── Flat Top / Flat Bottom Zone ─────────────────────────────

  function renderFlatZone(ctx, pts, drawing, style, lw, pr, size, direction) {
    if (pts.length < 2) return;
    const [p0, p1] = pts;
    const x1 = Math.min(p0.x, p1.x);
    const x2 = Math.max(p0.x, p1.x);
    const y = p0.y;
    const thickness = Math.round(8 * pr);

    // Thick horizontal zone line
    ctx.strokeStyle = style.color;
    ctx.lineWidth = lw;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.stroke();

    // Fill zone
    if (style.fillColor) {
      ctx.fillStyle = style.fillColor;
      const yOffset = direction === 'top' ? -thickness : 0;
      ctx.fillRect(x1, y + yOffset, x2 - x1, thickness);
    }

    // Caps
    ctx.lineWidth = Math.max(1, Math.round(2 * pr));
    ctx.beginPath();
    const capH = Math.round(6 * pr);
    ctx.moveTo(x1, y - capH); ctx.lineTo(x1, y + capH);
    ctx.moveTo(x2, y - capH); ctx.lineTo(x2, y + capH);
    ctx.stroke();

    // Label
    if (style.showLabel) {
      const label = direction === 'top' ? 'Resistance' : 'Support';
      const fontSize = Math.round(9 * pr);
      ctx.font = `${fontSize}px Arial`;
      ctx.fillStyle = style.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = direction === 'top' ? 'bottom' : 'top';
      ctx.fillText(label, (x1 + x2) / 2, y + (direction === 'top' ? -4 * pr : 4 * pr));
    }
  }

  // ─── Info Line ─────────────────────────────────────────────────
  function renderInfoLine(ctx, pts, drawing, style, lw, pr, size) {
    if (pts.length < 2) return;
    const [p0, p1] = pts;

    // Main line segment
    ctx.strokeStyle = style.color;
    ctx.lineWidth = lw;
    ctx.setLineDash(style.dash ? style.dash.map(d => Math.round(d * pr)) : []);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Compute info values from price anchors
    const pricePoints = drawing.points;
    if (!pricePoints || pricePoints.length < 2) return;
    const priceDiff = pricePoints[1].price - pricePoints[0].price;
    const pricePct = pricePoints[0].price !== 0
      ? (priceDiff / pricePoints[0].price) * 100 : 0;
    const timeDiff = Math.abs(pricePoints[1].time - pricePoints[0].time);
    const bars = Math.round(timeDiff / 60000); // approximate bar count
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const angle = Math.atan2(-dy, dx) * (180 / Math.PI);
    const isUp = priceDiff >= 0;
    const sign = isUp ? '+' : '';
    const arrow = isUp ? '▲' : '▼';
    const infoText = `${arrow} ${sign}${priceDiff >= 1000 ? priceDiff.toFixed(0) : priceDiff.toFixed(2)} (${sign}${pricePct.toFixed(2)}%) · ${bars} bars · ${angle.toFixed(1)}°`;

    // Info badge
    const fontSize = Math.round(10 * pr);
    const padding = Math.round(5 * pr);
    ctx.font = `bold ${fontSize}px -apple-system, Arial`;
    const tw = ctx.measureText(infoText).width;
    const mx = (p0.x + p1.x) / 2;
    const my = Math.min(p0.y, p1.y) - Math.round(20 * pr);
    const pillW = tw + padding * 2;
    const pillH = fontSize + padding * 2;
    const pillR = Math.round(4 * pr);

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
    ctx.fillText(infoText, mx, my + padding);
  }

  // ─── Parallel Channel ─────────────────────────────────────────
  function renderParallelChannel(ctx, pts, style, lw, pr, size) {
    if (pts.length < 2) return;
    const [p0, p1] = pts;

    ctx.strokeStyle = style.color;
    ctx.lineWidth = lw;
    ctx.setLineDash(style.dash ? style.dash.map(d => Math.round(d * pr)) : []);

    // Baseline
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();

    if (pts.length >= 3) {
      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;

      // Parallel line through third point
      ctx.beginPath();
      ctx.moveTo(pts[2].x, pts[2].y);
      ctx.lineTo(pts[2].x + dx, pts[2].y + dy);
      ctx.stroke();

      // Midline (dashed)
      const midY0 = (p0.y + pts[2].y) / 2;
      const midX0 = (p0.x + pts[2].x) / 2;
      ctx.setLineDash([Math.round(4 * pr), Math.round(4 * pr)]);
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.moveTo(midX0, midY0);
      ctx.lineTo(midX0 + dx, midY0 + dy);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Fill between parallel lines
      if (style.fillColor) {
        ctx.fillStyle = style.fillColor;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.lineTo(pts[2].x + dx, pts[2].y + dy);
        ctx.lineTo(pts[2].x, pts[2].y);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.setLineDash([]);
  }

  // ─── Polyline ─────────────────────────────────────────────────
  function renderPolyline(ctx, pts, style, lw, pr) {
    if (pts.length < 2) return;

    ctx.strokeStyle = style.color;
    ctx.lineWidth = lw;
    ctx.setLineDash(style.dash ? style.dash.map(d => Math.round(d * pr)) : []);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Small dots at each vertex
    const dotR = Math.round(2 * pr);
    ctx.fillStyle = style.color;
    for (const p of pts) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, dotR, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ─── Price Range ──────────────────────────────────────────────
  function renderPriceRange(ctx, pts, drawing, style, lw, pr, size) {
    if (pts.length < 2) return;
    const y1 = Math.min(pts[0].y, pts[1].y);
    const y2 = Math.max(pts[0].y, pts[1].y);
    const left = Math.min(pts[0].x, pts[1].x);
    const right = Math.max(pts[0].x, pts[1].x);
    const w = right - left;

    // Shaded fill
    if (style.fillColor) {
      ctx.fillStyle = style.fillColor;
      ctx.fillRect(left, y1, w, y2 - y1);
    }

    // Top and bottom border lines
    ctx.strokeStyle = style.color;
    ctx.lineWidth = lw;
    ctx.setLineDash(style.dash ? style.dash.map(d => Math.round(d * pr)) : []);
    ctx.beginPath();
    ctx.moveTo(left, y1); ctx.lineTo(right, y1);
    ctx.moveTo(left, y2); ctx.lineTo(right, y2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Info label
    if (style.showLabel && drawing.points && drawing.points.length >= 2) {
      const priceDiff = drawing.points[1].price - drawing.points[0].price;
      const pricePct = drawing.points[0].price !== 0
        ? (priceDiff / drawing.points[0].price) * 100 : 0;
      const isUp = priceDiff >= 0;
      const sign = isUp ? '+' : '';
      const labelText = `${sign}${priceDiff >= 1000 ? priceDiff.toFixed(0) : priceDiff.toFixed(2)} (${sign}${pricePct.toFixed(2)}%)`;

      const fontSize = Math.round(10 * pr);
      ctx.font = `bold ${fontSize}px -apple-system, Arial`;
      ctx.fillStyle = isUp ? '#26A69A' : '#EF5350';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText, (left + right) / 2, (y1 + y2) / 2);
    }
  }

  // ─── Date Range ───────────────────────────────────────────────
  function renderDateRange(ctx, pts, drawing, style, lw, pr, size) {
    if (pts.length < 2) return;
    const x1 = Math.min(pts[0].x, pts[1].x);
    const x2 = Math.max(pts[0].x, pts[1].x);

    // Full-height shaded fill
    if (style.fillColor) {
      ctx.fillStyle = style.fillColor;
      ctx.fillRect(x1, 0, x2 - x1, size.bitmapHeight);
    }

    // Left and right border lines
    ctx.strokeStyle = style.color;
    ctx.lineWidth = lw;
    ctx.setLineDash(style.dash ? style.dash.map(d => Math.round(d * pr)) : []);
    ctx.beginPath();
    ctx.moveTo(x1, 0); ctx.lineTo(x1, size.bitmapHeight);
    ctx.moveTo(x2, 0); ctx.lineTo(x2, size.bitmapHeight);
    ctx.stroke();
    ctx.setLineDash([]);

    // Info label
    if (style.showLabel && drawing.points && drawing.points.length >= 2) {
      const timeDiff = Math.abs(drawing.points[1].time - drawing.points[0].time);
      const hours = Math.floor(timeDiff / 3600000);
      const mins = Math.floor((timeDiff % 3600000) / 60000);
      const barCount = Math.round(timeDiff / 60000);
      const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
      const labelText = `${barCount} bars · ${timeStr}`;

      const fontSize = Math.round(10 * pr);
      ctx.font = `bold ${fontSize}px -apple-system, Arial`;
      ctx.fillStyle = style.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(labelText, (x1 + x2) / 2, Math.round(12 * pr));
    }
  }

  // ─── Note ─────────────────────────────────────────────────────
  function renderNote(ctx, pts, drawing, style, pr) {
    if (pts.length < 1) return;
    const [p] = pts;
    const text = drawing.meta?.text || 'Note';
    const fontSize = Math.round(parseInt(style.font || '12') * pr);
    const padding = Math.round(6 * pr);
    const maxW = Math.round(140 * pr);

    ctx.font = `${fontSize}px -apple-system, Arial`;
    const lines = [];
    const words = text.split(' ');
    let currentLine = '';
    for (const word of words) {
      const test = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(test).width > maxW && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = test;
      }
    }
    if (currentLine) lines.push(currentLine);

    const lineH = fontSize + Math.round(2 * pr);
    const boxW = Math.min(maxW + padding * 2, Math.max(...lines.map(l => ctx.measureText(l).width)) + padding * 2);
    const boxH = lines.length * lineH + padding * 2;
    const r = Math.round(4 * pr);

    // Note background
    ctx.fillStyle = style.fillColor || 'rgba(245, 158, 11, 0.08)';
    ctx.strokeStyle = style.color;
    ctx.lineWidth = Math.max(1, Math.round(1 * pr));
    ctx.beginPath();
    ctx.moveTo(p.x + r, p.y); ctx.lineTo(p.x + boxW - r, p.y);
    ctx.quadraticCurveTo(p.x + boxW, p.y, p.x + boxW, p.y + r);
    ctx.lineTo(p.x + boxW, p.y + boxH - r);
    ctx.quadraticCurveTo(p.x + boxW, p.y + boxH, p.x + boxW - r, p.y + boxH);
    ctx.lineTo(p.x + r, p.y + boxH);
    ctx.quadraticCurveTo(p.x, p.y + boxH, p.x, p.y + boxH - r);
    ctx.lineTo(p.x, p.y + r);
    ctx.quadraticCurveTo(p.x, p.y, p.x + r, p.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Fold corner
    const foldS = Math.round(10 * pr);
    ctx.fillStyle = style.color;
    ctx.globalAlpha = 0.15;
    ctx.beginPath();
    ctx.moveTo(p.x + boxW - foldS, p.y);
    ctx.lineTo(p.x + boxW, p.y + foldS);
    ctx.lineTo(p.x + boxW - foldS, p.y + foldS);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // Text
    ctx.fillStyle = style.color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], p.x + padding, p.y + padding + i * lineH);
    }
  }

  // ─── Signpost ─────────────────────────────────────────────────
  function renderSignpost(ctx, pts, drawing, style, pr) {
    if (pts.length < 1) return;
    const [p] = pts;
    const text = drawing.meta?.text || 'Label';
    const fontSize = Math.round(parseInt(style.font || '11') * pr);
    const padding = Math.round(5 * pr);
    const arrowH = Math.round(14 * pr);

    ctx.font = `bold ${fontSize}px -apple-system, Arial`;
    const tw = ctx.measureText(text).width;
    const tagW = tw + padding * 2;
    const tagH = fontSize + padding * 2;
    const r = Math.round(3 * pr);

    // Vertical line from anchor up to tag
    ctx.strokeStyle = style.color;
    ctx.lineWidth = Math.max(1, Math.round(1.5 * pr));
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x, p.y - arrowH);
    ctx.stroke();

    // Arrow point at anchor
    const aSize = Math.round(4 * pr);
    ctx.fillStyle = style.color;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x - aSize, p.y - aSize * 1.5);
    ctx.lineTo(p.x + aSize, p.y - aSize * 1.5);
    ctx.closePath();
    ctx.fill();

    // Tag background
    const tagY = p.y - arrowH - tagH;
    ctx.fillStyle = style.color;
    ctx.beginPath();
    ctx.moveTo(p.x - tagW / 2 + r, tagY);
    ctx.lineTo(p.x + tagW / 2 - r, tagY);
    ctx.quadraticCurveTo(p.x + tagW / 2, tagY, p.x + tagW / 2, tagY + r);
    ctx.lineTo(p.x + tagW / 2, tagY + tagH - r);
    ctx.quadraticCurveTo(p.x + tagW / 2, tagY + tagH, p.x + tagW / 2 - r, tagY + tagH);
    ctx.lineTo(p.x - tagW / 2 + r, tagY + tagH);
    ctx.quadraticCurveTo(p.x - tagW / 2, tagY + tagH, p.x - tagW / 2, tagY + tagH - r);
    ctx.lineTo(p.x - tagW / 2, tagY + r);
    ctx.quadraticCurveTo(p.x - tagW / 2, tagY, p.x - tagW / 2 + r, tagY);
    ctx.closePath();
    ctx.fill();

    // Tag text
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, p.x, tagY + tagH / 2);
  }

  return {
    drawMain,
    drawTop,
  };
}
