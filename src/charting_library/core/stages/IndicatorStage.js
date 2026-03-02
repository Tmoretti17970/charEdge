// ═══════════════════════════════════════════════════════════════════
// charEdge — IndicatorStage
// Renders: overlay indicators (SMA, EMA, BB, etc.), pane indicators
//          (RSI, MACD, etc.)
// Layer: INDICATORS
//
// Phase 2: Syncs IndicatorNode instances into the scene graph
// for spatial-index-accelerated queries.
// ═══════════════════════════════════════════════════════════════════

import { LAYERS } from '../LayerManager.js';
import { renderOverlayIndicator, renderPaneIndicator } from '../../studies/indicators/renderer.js';
import { IndicatorNode } from '../../scene/RenderNode.js';

/**
 * Render the indicators layer: overlay indicators + pane indicators.
 *
 * @param {import('../FrameState.js').FrameState} fs
 * @param {Object} ctx - Render contexts
 * @param {Object} engine - ChartEngine instance
 */
export function executeIndicatorStage(fs, ctx, engine) {
  const { layers, theme: thm, indicatorCtx: iCtx } = ctx;

  if (!layers.isDirty(LAYERS.INDICATORS) && !fs.viewportChanged) return;
  layers.clearDirty(LAYERS.INDICATORS);

  const {
    bitmapWidth: bw, bitmapHeight: bh, pixelRatio: pr,
    chartWidth: cW, mainHeight, bars, startIdx: start,
    exactStart, endIdx, barSpacing: bSp, mediaWidth: mw,
    overlayInds, paneInds, paneCount, paneHeight,
  } = fs;

  const R = engine.state.lastRender;
  if (!R) return;

  const cBW = Math.round(cW * pr);
  const mainBH = Math.round(mainHeight * pr);

  iCtx.clearRect(0, 0, bw, bh);

  // ─── Overlay Indicators ──────────────────────────────────────
  iCtx.save();
  iCtx.beginPath();
  iCtx.rect(0, 0, cBW, mainBH);
  iCtx.clip();

  // GPU path: render line-type overlay indicators via WebGL AA lines
  const webgl = ctx.webgl;
  if (webgl?.available && R.p2y) {
    const gpuSeries = [];
    const gpuHandled = new Set();

    for (const ind of overlayInds) {
      if (!ind.computed || !ind.visible) continue;
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
      // Mark indicators that ONLY have line outputs (+ optional fills) as GPU-handled
      const hasNonLine = ind.outputs.some(o => o.type !== 'line');
      if (!hasNonLine) gpuHandled.add(ind);
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

    // Fall through to Canvas2D for non-GPU indicators (VRVP, fills, etc.)
    for (const ind of overlayInds) {
      if (gpuHandled.has(ind)) continue;
      renderOverlayIndicator(iCtx, ind, {
        rawBars: bars,
        startIdx: start,
        exactStart,
        endIdx: Math.min(endIdx + 1, bars.length - 1),
        barSpacing: bSp,
        priceToY: R.p2y,
        pixelRatio: pr,
        bitmapWidth: bw,
        bitmapHeight: mainBH,
      });
    }
  } else {
    // Canvas2D fallback: render all indicators the traditional way
    for (const ind of overlayInds) {
      renderOverlayIndicator(iCtx, ind, {
        rawBars: bars,
        startIdx: start,
        exactStart,
        endIdx: Math.min(endIdx + 1, bars.length - 1),
        barSpacing: bSp,
        priceToY: R.p2y,
        pixelRatio: pr,
        bitmapWidth: bw,
        bitmapHeight: mainBH,
      });
    }
  }

  iCtx.restore();

  // ─── Pane Indicators ────────────────────────────────────────
  if (paneCount > 0) {
    for (let i = 0; i < paneCount; i++) {
      const paneTop = mainHeight + i * paneHeight;
      iCtx.fillStyle = thm.gridLine || 'rgba(54,58,69,0.3)';
      iCtx.fillRect(0, Math.round(paneTop * pr), Math.round(mw * pr), Math.max(1, pr));
      renderPaneIndicator(iCtx, paneInds[i], {
        startIdx: start,
        endIdx: Math.min(endIdx, bars.length - 1),
        barSpacing: bSp,
        pixelRatio: pr,
        paneTop: Math.round(paneTop * pr),
        paneHeight: Math.round(paneHeight * pr),
        paneWidth: Math.round(cW * pr),
      }, thm);
    }
  }

  // ─── Sync IndicatorNodes with scene graph ──────────────────
  if (ctx.sceneGraph) {
    _syncIndicatorNodes(ctx.sceneGraph, overlayInds, paneInds, cW, mainHeight, paneCount, paneHeight);
  }
}

/**
 * Synchronize indicator model → scene graph nodes.
 * Adds new nodes, removes deleted ones, updates bounds.
 */
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

