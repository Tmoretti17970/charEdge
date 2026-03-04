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

  // Sprint 12: Highlight/dim state from engine
  const highlightIdx = engine.state._highlightedIndicator;
  const hiddenSet = engine.state.hiddenIndicators || new Set();
  // Overlay indicators are indexed 0..N-1, pane indicators N..N+M-1
  const overlayCount = overlayInds.length;

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
    for (let oi = 0; oi < overlayInds.length; oi++) {
      const ind = overlayInds[oi];
      if (gpuHandled.has(ind)) continue;
      if (hiddenSet.has(oi)) continue; // Sprint 12: skip hidden
      // Sprint 12: dim non-highlighted
      const isDimmed = highlightIdx >= 0 && highlightIdx !== oi;
      if (isDimmed) iCtx.globalAlpha = 0.3;
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
      if (isDimmed) iCtx.globalAlpha = 1;
    }
  } else {
    // Canvas2D fallback: render all indicators the traditional way
    for (let oi = 0; oi < overlayInds.length; oi++) {
      const ind = overlayInds[oi];
      if (hiddenSet.has(oi)) continue; // Sprint 12: skip hidden
      // Sprint 12: dim non-highlighted
      const isDimmed = highlightIdx >= 0 && highlightIdx !== oi;
      if (isDimmed) iCtx.globalAlpha = 0.3;
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
      if (isDimmed) iCtx.globalAlpha = 1;
    }
  }

  iCtx.restore();

  // ─── Pane Indicators ────────────────────────────────────────
  if (paneCount > 0) {
    const HEADER_H = 18; // px header bar height
    const collapsedPanes = fs.collapsedPanes || new Set();
    const paneTransforms = fs.paneTransforms || [];
    let runningPaneTop = mainHeight;

    for (let i = 0; i < paneCount; i++) {
      const isCollapsed = collapsedPanes.has(i);
      const thisPaneH = isCollapsed ? HEADER_H : paneHeight;

      // ─── Pane Header Bar ─────────────────────────────────
      const headerY = runningPaneTop;
      iCtx.fillStyle = thm.gridLine || 'rgba(54,58,69,0.3)';
      iCtx.fillRect(0, Math.round(headerY * pr), Math.round(mw * pr), Math.max(1, pr));

      // Header background
      iCtx.fillStyle = (thm.bg || '#131722') + 'DD';
      iCtx.fillRect(0, Math.round(headerY * pr), Math.round(mw * pr), Math.round(HEADER_H * pr));

      // Indicator name + value
      const ind = paneInds[i];
      if (ind) {
        const hFs = Math.round(10 * pr);
        iCtx.font = `bold ${hFs}px Arial`;
        iCtx.fillStyle = thm.axisText || '#787B86';
        iCtx.textAlign = 'left';
        iCtx.textBaseline = 'middle';
        const label = ind.label || ind.shortName || ind.indicatorId || 'Indicator';
        let displayText = label;

        // Show value at crosshair position
        if (fs.hoverIdx != null && ind.computed) {
          for (const out of ind.outputs) {
            const vals = ind.computed[out.key];
            if (!vals) continue;
            const val = fs.hoverIdx < vals.length ? vals[fs.hoverIdx] : NaN;
            if (!isNaN(val)) {
              displayText += `  ${val.toFixed(2)}`;
              break; // Show first output value only in header
            }
          }
        }

        // Collapse/expand indicator: ▶ or ▼
        const toggleChar = isCollapsed ? '▶' : '▼';
        iCtx.fillText(
          `${toggleChar} ${displayText}`,
          Math.round(8 * pr),
          Math.round((headerY + HEADER_H / 2) * pr)
        );
      }

      // ─── Pane Content (skip if collapsed) ─────────────────
      if (!isCollapsed && ind) {
        const contentTop = headerY + HEADER_H;
        const contentH = thisPaneH - HEADER_H;
        // Use per-pane price transform from FrameState
        const paneXform = paneTransforms[i];
        renderPaneIndicator(iCtx, ind, {
          startIdx: start,
          endIdx: Math.min(endIdx, bars.length - 1),
          barSpacing: bSp,
          pixelRatio: pr,
          paneTop: Math.round(contentTop * pr),
          paneHeight: Math.round(contentH * pr),
          paneWidth: Math.round(cW * pr),
          paneYMin: paneXform?.yMin,
          paneYMax: paneXform?.yMax,
        }, thm);
      }

      runningPaneTop += thisPaneH;
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

