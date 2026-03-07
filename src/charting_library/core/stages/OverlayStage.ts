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
    renderOIOverlay(mCtx, fs.oiData, {
      pixelRatio: pr,
      chartWidth: cW,
      y: mainHeight * 0.72,
      height: mainHeight * 0.12,
    });
  }

  // ─── Liquidation Markers ─────────────────────────────────────
  if (fs.showOI && fs.liquidations?.length) {
    renderLiquidationMarkers(mCtx, fs.liquidations, {
      priceToY: p2y,
      timeToX: (ts) => timeTransform.timeToPixel?.(ts) ?? null,
      pixelRatio: pr,
    });
  }
}
