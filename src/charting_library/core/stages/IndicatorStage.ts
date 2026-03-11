// ═══════════════════════════════════════════════════════════════════
// charEdge — IndicatorStage
// Renders: overlay indicators (SMA, EMA, BB, etc.) on the main canvas.
// Pane indicators (RSI, MACD, etc.) are rendered by RenderPipeline._renderIndicatorPanes()
// via PaneManager's per-pane DOM canvases.
// Layer: INDICATORS
//
// Phase 2: Syncs IndicatorNode instances into the scene graph
// for spatial-index-accelerated queries.
// ═══════════════════════════════════════════════════════════════════

import { LAYERS } from '../LayerManager.js';
import { renderOverlayIndicator } from '../../studies/indicators/renderer.js';
import { IndicatorNode } from '../../scene/RenderNode.js';
import { cachedIndicatorRender, tickIndicatorCache } from '../../studies/indicators/IndicatorCache.js';

/**
 * Render the indicators layer: overlay indicators on the main canvas.
 * Pane indicators are rendered separately by RenderPipeline._renderIndicatorPanes()
 * via the PaneManager's per-pane DOM canvases.
 *
 * @param {import('../FrameState.js').FrameState} fs
 * @param {Object} ctx - Render contexts
 * @param {Object} engine - ChartEngine instance
 */
export function executeIndicatorStage(fs, ctx, engine) {
  const { layers, theme: _thm, indicatorCtx: iCtx } = ctx;

  if (!layers.isDirty(LAYERS.INDICATORS) && !fs.viewportChanged) return;

  const R = engine.state.lastRender;
  // If candle stage hasn't produced a render yet (p2y not available),
  // skip but DON'T clear dirty — so we retry next frame.
  if (!R) return;

  layers.clearDirty(LAYERS.INDICATORS);

  const {
    bitmapWidth: bw, bitmapHeight: bh, pixelRatio: pr,
    chartWidth: cW, mainHeight, bars, startIdx: start,
    exactStart, endIdx, barSpacing: bSp,
    overlayInds, paneInds, paneCount, paneHeight,
  } = fs;

  const cBW = Math.round(cW * pr);
  const mainBH = Math.round(mainHeight * pr);

  iCtx.clearRect(0, 0, bw, bh);

  // Strategy Item #10: Advance indicator cache frame counter
  tickIndicatorCache();

  // Sprint 12: Highlight/dim state from engine
  const highlightIdx = engine.state._highlightedIndicator;
  const hiddenSet = engine.state.hiddenIndicators || new Set();
  // Overlay indicators are indexed 0..N-1, pane indicators N..N+M-1
  const _overlayCount = overlayInds.length;

  // ─── Overlay Indicators ──────────────────────────────────────
  iCtx.save();
  iCtx.beginPath();
  iCtx.rect(0, 0, cBW, mainBH);
  iCtx.clip();

  // GPU path: render line-type overlay indicators via WebGL AA lines
  const webgl = ctx.webgl;
  if (webgl?.available && R.p2y) {
    const gpuSeries = [];

    for (let oi = 0; oi < overlayInds.length; oi++) {
      const ind = overlayInds[oi];
      if (!ind.computed || !ind.visible) continue;
      if (hiddenSet.has(oi)) continue; // Sprint 12: skip hidden
      // Collect all line outputs that can be GPU-rendered
      for (const output of ind.outputs) {
        if (output.type !== 'line') continue;
        const values = ind.computed[output.key];
        if (!values) continue;
        gpuSeries.push({
          values,
          color: output.color,
          lineWidth: output.width || 2,
        });
      }
    }

    if (gpuSeries.length > 0) {
      const indDrawFn = () => webgl.drawIndicatorLines(gpuSeries, {
        pixelRatio: pr,
        barSpacing: bSp,
        startIdx: start,
        endIdx: Math.min(endIdx, bars.length - 1),
        priceToY: R.p2y,
        timeTransform: R.timeTransform ? { indexToPixel: (idx) => R.timeTransform.indexToPixel(idx) } : null,
      });
      const cmdBuf = ctx.commandBuffer;
      if (cmdBuf) {
        cmdBuf.push({
          program: webgl.getProgram('aaLine'),
          blendMode: 0,
          texture: null,
          zOrder: 2,
          label: 'indicator-lines',
          drawFn: indDrawFn,
        });
      } else {
        indDrawFn();
      }
    }
  }

  // Canvas2D: render overlay indicators (with Item #10 offscreen cache for complex ones)
  for (let oi = 0; oi < overlayInds.length; oi++) {
    const ind = overlayInds[oi];
    if (hiddenSet.has(oi)) continue; // Sprint 12: skip hidden
    if (!ind.computed || !ind.visible) continue;
    // Sprint 12: dim non-highlighted
    const isDimmed = highlightIdx >= 0 && highlightIdx !== oi;
    if (isDimmed) iCtx.globalAlpha = 0.3;

    // Strategy Item #10: Pre-render complex indicators (those with fills)
    // to OffscreenCanvas bitmap cache. Simple line-only indicators skip
    // the cache overhead since they're already cheap.
    const isComplex = !!(ind.fills && ind.fills.length > 0);
    const indId = ind.indicatorId || ind.shortName || `overlay_${oi}`;
    const safeEnd = Math.min(endIdx + 1, bars.length - 1);

    if (isComplex) {
      // Use computed data ref as a stamp — changes when data recomputes
      const stamp = ind.computed._stamp || (ind.computed._stamp = Date.now());
      const cachedCanvas = cachedIndicatorRender(
        indId, start, safeEnd, bSp, bw, mainBH, pr,
        ind.params || {}, stamp,
        (offCtx) => {
          renderOverlayIndicator(offCtx, ind, {
            rawBars: bars, startIdx: start, exactStart,
            endIdx: safeEnd, barSpacing: bSp,
            priceToY: R.p2y, pixelRatio: pr,
            bitmapWidth: bw, bitmapHeight: mainBH,
          });
        },
      );
      iCtx.drawImage(cachedCanvas, 0, 0);
    } else {
      renderOverlayIndicator(iCtx, ind, {
        rawBars: bars, startIdx: start, exactStart,
        endIdx: safeEnd, barSpacing: bSp,
        priceToY: R.p2y, pixelRatio: pr,
        bitmapWidth: bw, bitmapHeight: mainBH,
      });
    }
    if (isDimmed) iCtx.globalAlpha = 1;
  }

  iCtx.restore();

  // ─── Sync IndicatorNodes with scene graph ──────────────────
  if (ctx.sceneGraph) {
    _syncIndicatorNodes(ctx.sceneGraph, overlayInds, paneInds, cW, mainHeight, paneCount, paneHeight);
  }
}

/**
 * Synchronize indicator model → scene graph nodes.
 * Adds new nodes, removes deleted ones, updates bounds.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
function _syncIndicatorNodes(sceneGraph, overlayInds, paneInds, chartWidth, mainHeight, paneCount, paneHeight) {
  const activeIds = new Set();

  // Overlay indicators span the full chart area
  for (const ind of overlayInds) {
    if (!ind.visible || !ind.computed) continue;
    const nodeId = `ind_${ind.id || ind.shortName}`;
    activeIds.add(nodeId);

    const bounds = { x: 0, y: 0, w: chartWidth, h: mainHeight };
    let node = sceneGraph.getNode(nodeId);
    if (!node) {
      node = new IndicatorNode(ind);
      sceneGraph.addNode(node);
    }
    node.data = ind;
    node.updateBounds(bounds);
  }

  // Pane indicators each occupy their respective pane
  for (let i = 0; i < paneCount; i++) {
    const ind = paneInds[i];
    if (!ind || !ind.visible) continue;
    const nodeId = `ind_${ind.id || ind.shortName}`;
    activeIds.add(nodeId);

    const paneTop = mainHeight + i * paneHeight;
    const bounds = { x: 0, y: paneTop, w: chartWidth, h: paneHeight };
    let node = sceneGraph.getNode(nodeId);
    if (!node) {
      node = new IndicatorNode(ind);
      sceneGraph.addNode(node);
    }
    node.data = ind;
    node.updateBounds(bounds);
  }

  // Remove stale indicator nodes
  const toRemove = [];
  sceneGraph.root.traverse((node) => {
    if (node.type === 'indicator' && !activeIds.has(node.id)) {
      toRemove.push(node.id);
    }
  });
  for (const id of toRemove) {
    sceneGraph.removeNode(id);
  }
}

