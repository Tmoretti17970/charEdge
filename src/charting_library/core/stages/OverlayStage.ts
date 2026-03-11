// ═══════════════════════════════════════════════════════════════════
// charEdge — OverlayStage
// Renders: order flow overlays — delta histogram, volume profile,
//          large trade markers, OI overlay, liquidation markers
// Layer: DATA (drawn after candles, before axes)
//
// v16: GPU-accelerated volume profile + heatmap via WebGLRenderer
//      when WebGL is available; Canvas2D fallback otherwise.
// ═══════════════════════════════════════════════════════════════════

import { getAggregator } from '../../../data/OrderFlowAggregator.js';
import { renderDeltaHistogram, renderVolumeProfile, renderLargeTradeMarkers } from '../../renderers/OrderFlowOverlays.js';
import { renderOIOverlay, renderLiquidationMarkers } from '../../renderers/DerivativesOverlays.js';
import { drawSessionBands } from '../../renderers/ExchangeTimezoneOverlay.js';

// ─── #41: Overlay Color Legend ─────────────────────────────────
interface LegendItem { color: string; label: string; }

function drawOverlayLegend(
  ctx: CanvasRenderingContext2D,
  items: LegendItem[],
  x: number, y: number, pr: number,
) {
  const fontSize = 10 * pr;
  const dotSize = 6 * pr;
  const gap = 10 * pr;
  const padding = 6 * pr;

  ctx.save();
  ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  // Measure total width for background pill
  let totalW = padding * 2;
  for (let i = 0; i < items.length; i++) {
    const it = items[i]!;
    totalW += dotSize + 4 * pr + ctx.measureText(it.label).width;
    if (i < items.length - 1) totalW += gap;
  }

  const h = fontSize + padding * 2;
  const rx = x - totalW;
  const ry = y;

  // Background pill
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath();
  const r = 4 * pr;
  ctx.roundRect(rx, ry, totalW, h, r);
  ctx.fill();

  // Items
  let cx = rx + padding;
  const cy = ry + h / 2;
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    // Dot
    ctx.fillStyle = item.color;
    ctx.beginPath();
    ctx.arc(cx + dotSize / 2, cy, dotSize / 2, 0, Math.PI * 2);
    ctx.fill();
    cx += dotSize + 4 * pr;
    // Label
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(item.label, cx, cy);
    cx += ctx.measureText(item.label).width + gap;
  }

  ctx.restore();
}

// ─── #42: Mini-Axis Labels ─────────────────────────────────────
function drawMiniAxis(
  ctx: CanvasRenderingContext2D,
  min: number, max: number,
  x: number, yTop: number, yBot: number, pr: number,
) {
  const fontSize = 9 * pr;
  ctx.save();
  ctx.font = `500 ${fontSize}px Inter, system-ui, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';

  const mid = (min + max) / 2;
  const fmt = (v: number) => {
    const abs = Math.abs(v);
    if (abs >= 1e9) return (v / 1e9).toFixed(1) + 'B';
    if (abs >= 1e6) return (v / 1e6).toFixed(1) + 'M';
    if (abs >= 1e3) return (v / 1e3).toFixed(1) + 'K';
    return v.toFixed(0);
  };

  const pad = 4 * pr;
  ctx.fillText(fmt(max), x - pad, yTop + fontSize / 2 + pad);
  ctx.fillText(fmt(mid), x - pad, (yTop + yBot) / 2);
  ctx.fillText(fmt(min), x - pad, yBot - fontSize / 2 - pad);

  ctx.restore();
}

// ─── #43: Footprint onboarding hint ────────────────────────────
const FP_HINT_KEY = 'charEdge-footprint-hint-seen';

function drawFootprintHint(
  ctx: CanvasRenderingContext2D,
  cW: number, mainH: number, pr: number,
) {
  try { if (localStorage.getItem(FP_HINT_KEY)) return; } catch { /* noop */ }

  const fontSize = 11 * pr;
  const text = 'Zoom in to see bid/ask footprint data';

  ctx.save();
  ctx.font = `500 ${fontSize}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const tw = ctx.measureText(text).width;
  const px = 12 * pr, py = 8 * pr;
  const w = tw + px * 2, h = fontSize + py * 2;
  const x = (cW * pr) / 2 - w / 2;
  const y = mainH * pr * 0.4;
  const r = 6 * pr;

  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(text, (cW * pr) / 2, y + h / 2);

  ctx.restore();

  // Auto-dismiss after first render
  try { localStorage.setItem(FP_HINT_KEY, '1'); } catch { /* noop */ }
}

/**
 * Render order flow overlays onto the DATA layer.
 *
 * @param {import('../FrameState.js').FrameState} fs
 * @param {Object} ctx - Render contexts
 * @param {Object} engine - ChartEngine instance
 */
export function executeOverlayStage(fs, ctx, _engine) {
  // DATA context may be null when layer is offscreen (Phase 1.3.3).
  // Fall back to UI context, or skip if nothing available.
  const mCtx = ctx.dataCtx || ctx.uiCtx;
  if (!mCtx) return;
  const { webgl, commandBuffer } = ctx;
  const {
    pixelRatio: pr, chartWidth: cW, mainHeight, visBars: vis,
    barSpacing: bSp, startIdx: start, symbol, timeframe,
  } = fs;

  const R = _engine.state.lastRender;
  if (!R) return;
  const { p2y, timeTransform } = R;

  // Legend items accumulator (rendered once at the end)
  const legendItems: LegendItem[] = [];

  // ─── P1-A #6: Exchange Timezone Session Bands ─────────────────
  if (fs.showSessions && timeTransform?.indexToPixel) {
    drawSessionBands({
      ctx: mCtx,
      visBars: vis,
      pr,
      chartHeight: Math.round(mainHeight * pr),
      chartWidth: Math.round(cW * pr),
      indexToPixel: timeTransform.indexToPixel,
      startIdx: start,
    });
  }

  const aggregator = getAggregator(fs.aggregatorKey || `${symbol}_${timeframe}`);

  // ─── Delta Histogram ─────────────────────────────────────────
  if (fs.showDelta) {
    const deltaH = mainHeight * 0.15;
    renderDeltaHistogram(mCtx, vis, {
      startIdx: start,
      barSpacing: bSp,
      pixelRatio: pr,
      chartWidth: cW,
      y: mainHeight - deltaH,
      height: deltaH,
      timeTransform,
    });

    // #41: Delta legend
    legendItems.push(
      { color: ctx.theme?.bullCandle || '#26A69A', label: 'Positive' },
      { color: ctx.theme?.bearCandle || '#EF5350', label: 'Negative' },
    );

    // #42: Delta mini-axis
    if (vis?.length) {
      const deltaY = (mainHeight - deltaH) * pr;
      const deltaBotY = mainHeight * pr;
      // Rough min/max from visible delta data
      let dMin = 0, dMax = 0;
      for (let i = 0; i < vis.length; i++) {
        const d = vis[i]?.delta ?? 0;
        if (d < dMin) dMin = d;
        if (d > dMax) dMax = d;
      }
      if (dMax > 0 || dMin < 0) {
        drawMiniAxis(mCtx, dMin, dMax, cW * pr, deltaY, deltaBotY, pr);
      }
    }
  }

  // ─── Volume Profile ──────────────────────────────────────────
  if (fs.showVP && aggregator.isEngineBridged) {
    const vpData = aggregator.getVolumeProfile();
    if (vpData) {
      // GPU path: instanced horizontal bars via WebGLRenderer.drawVolumeProfile
      if (webgl?.available && typeof webgl.drawVolumeProfile === 'function' && vpData.rows?.length) {
        const rows = vpData.rows.map(row => ({
          priceY: p2y(row.price) * pr,
          volume: row.volume,
          isPoc: row.isPoc || false,
        }));
        const maxVol = Math.max(...vpData.rows.map(r => r.volume), 1);

        const vpDrawFn = () => webgl.drawVolumeProfile(rows, {
          pixelRatio: pr,
          rowHeight: (vpData.rowHeight || 2) * pr,
          maxVolume: maxVol,
          rightEdge: cW * pr,
          maxBarWidth: 120 * pr,
        }, {
          buyColor: ctx.theme.bullCandle || '#26A69A',
          sellColor: ctx.theme.bearCandle || '#EF5350',
          pocColor: '#FFD54F',
        });

        if (commandBuffer) {
          commandBuffer.push({
            program: webgl.getProgram('vprofile'),
            blendMode: 0,
            texture: null,
            zOrder: 3,
            label: 'volume-profile',
            drawFn: vpDrawFn,
          });
        } else {
          vpDrawFn();
        }
      } else {
        // Canvas2D fallback
        renderVolumeProfile(mCtx, vpData, {
          priceToY: p2y,
          pixelRatio: pr,
          chartWidth: cW,
          maxWidth: 120,
        });
      }

      // #41: VP legend
      legendItems.push(
        { color: ctx.theme?.bullCandle || '#26A69A', label: 'Buy Vol' },
        { color: ctx.theme?.bearCandle || '#EF5350', label: 'Sell Vol' },
        { color: '#FFD54F', label: 'POC' },
      );
    }
  }

  // ─── Large Trade Markers ─────────────────────────────────────
  if (fs.showLargeTrades && aggregator.isEngineBridged) {
    const largeTrades = aggregator.getLargeTrades(30);
    if (largeTrades.length > 0) {
      renderLargeTradeMarkers(mCtx, largeTrades, {
        priceToY: p2y,
        timeToX: (ts) => timeTransform.timeToPixel?.(ts) ?? null,
        pixelRatio: pr,
      });
    }
  }

  // ─── Heatmap (GPU path when available) ───────────────────────
  if (fs.showHeatmap && _engine.props?.heatmapData?.length) {
    const cells = _engine.props.heatmapData;

    if (webgl?.available && typeof webgl.drawHeatmap === 'function') {
      const heatmapDrawFn = () => webgl.drawHeatmap(cells, {
        pixelRatio: pr,
        globalAlpha: 0.7,
      }, {
        coldColor: '#1565C0',
        warmColor: '#FF8F00',
        hotColor: '#D32F2F',
      });

      if (commandBuffer) {
        commandBuffer.push({
          program: webgl.getProgram('heatmap'),
          blendMode: 0,
          texture: null,
          zOrder: 2,
          label: 'heatmap',
          drawFn: heatmapDrawFn,
        });
      } else {
        heatmapDrawFn();
      }
    }
    // Existing HeatmapRenderer Canvas2D path is handled in DataStage
  }

  // ─── OI Overlay ──────────────────────────────────────────────
  if (fs.showOI && fs.oiData?.length) {
    const oiY = mainHeight * 0.72;
    const oiH = mainHeight * 0.12;
    renderOIOverlay(mCtx, fs.oiData, {
      pixelRatio: pr,
      chartWidth: cW,
      y: oiY,
      height: oiH,
    });

    // #41: OI legend
    legendItems.push(
      { color: '#42A5F5', label: 'Open Interest' },
    );

    // #42: OI mini-axis
    if (fs.oiData.length > 1) {
      let oiMin = Infinity, oiMax = -Infinity;
      for (const pt of fs.oiData) {
        const v = pt.value ?? pt.oi ?? 0;
        if (v < oiMin) oiMin = v;
        if (v > oiMax) oiMax = v;
      }
      if (oiMax > oiMin) {
        drawMiniAxis(mCtx, oiMin, oiMax, cW * pr, oiY * pr, (oiY + oiH) * pr, pr);
      }
    }
  }

  // ─── Liquidation Markers ─────────────────────────────────────
  if (fs.showOI && fs.liquidations?.length) {
    renderLiquidationMarkers(mCtx, fs.liquidations, {
      priceToY: p2y,
      timeToX: (ts) => timeTransform.timeToPixel?.(ts) ?? null,
      pixelRatio: pr,
    });
  }

  // ─── #41: Render accumulated legend ──────────────────────────
  if (legendItems.length > 0) {
    drawOverlayLegend(mCtx, legendItems, cW * pr - 8 * pr, 8 * pr, pr);
  }

  // ─── #43: Footprint onboarding hint ──────────────────────────
  if (fs.showFootprint && vis?.length > 80) {
    drawFootprintHint(mCtx, cW, mainHeight, pr);
  }
}

