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
import { cachedIndicatorRender, tickIndicatorCache } from '../../studies/indicators/IndicatorCache.js';

// ─── Strategy Item #5: Pane Header Bitmap Cache ──────────────────
// Pane headers (separator lines, background bars, indicator labels)
// only change on viewport geometry / theme changes, not on data ticks.
// Cache them to an OffscreenCanvas and blit on cache hits.
let _paneHeaderCache: { canvas: any; ctx: any; key: string } = { canvas: null, ctx: null, key: '' };

function _paneHeaderCacheKey(
  paneCount: number, paneHeight: number, mainHeight: number,
  chartWidth: number, pr: number, bitmapHeight: number,
  themeBg: string, themeAxisText: string, themeGridLine: string,
  paneInds: any[], collapsedPanes: Set<number>,
): string {
  // Include indicator labels and collapsed state in cache key
  const labels = paneInds.map((ind: any, i: number) =>
    `${ind?.label || ind?.shortName || 'ind'}:${collapsedPanes.has(i) ? 'c' : 'o'}`
  ).join(',');
  return `${paneCount}:${paneHeight}:${mainHeight}:${chartWidth}:${pr}:${bitmapHeight}:${themeBg}:${themeAxisText}:${themeGridLine}:${labels}`;
}

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

  const R = engine.state.lastRender;
  // If candle stage hasn't produced a render yet (p2y not available),
  // skip but DON'T clear dirty — so we retry next frame.
  if (!R) return;

  layers.clearDirty(LAYERS.INDICATORS);

  const {
    bitmapWidth: bw, bitmapHeight: bh, pixelRatio: pr,
    chartWidth: cW, mainHeight, bars, startIdx: start,
    exactStart, endIdx, barSpacing: bSp, mediaWidth: mw,
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

  // ─── Pane Indicators ────────────────────────────────────────
  if (paneCount > 0) {
    const HEADER_H = 18; // px header bar height
    const collapsedPanes = fs.collapsedPanes || new Set();
    const paneTransforms = fs.paneTransforms || [];
    let runningPaneTop = mainHeight;

    // Strategy Item #5: Pane header bitmap cache
    // Headers (separator lines, bg, labels, chevrons) only change on
    // viewport geometry / theme changes — not on data ticks.
    const headerCacheKey = _paneHeaderCacheKey(
      paneCount, paneHeight, mainHeight, cW, pr, bh,
      thm.bg || '#131722', thm.axisText || '#787B86',
      thm.gridLine || 'rgba(54,58,69,0.3)', paneInds, collapsedPanes,
    );
    const headerCacheHit = (_paneHeaderCache.key === headerCacheKey && _paneHeaderCache.canvas);

    if (!headerCacheHit) {
      // Cache miss — render headers to offscreen canvas
      if (!_paneHeaderCache.canvas || _paneHeaderCache.canvas.width !== Math.round(mw * pr) || _paneHeaderCache.canvas.height !== bh) {
        if (typeof OffscreenCanvas !== 'undefined') {
          _paneHeaderCache.canvas = new OffscreenCanvas(Math.round(mw * pr), bh);
        } else {
          _paneHeaderCache.canvas = document.createElement('canvas');
          _paneHeaderCache.canvas.width = Math.round(mw * pr);
          _paneHeaderCache.canvas.height = bh;
        }
        _paneHeaderCache.ctx = _paneHeaderCache.canvas.getContext('2d');
      }
      const hCtx = _paneHeaderCache.ctx;
      hCtx.clearRect(0, 0, _paneHeaderCache.canvas.width, _paneHeaderCache.canvas.height);

      let headerPaneTop = mainHeight;
      for (let i = 0; i < paneCount; i++) {
        const isCollapsed = collapsedPanes.has(i);
        const thisPaneH = isCollapsed ? HEADER_H : paneHeight;
        const headerY = headerPaneTop;

        // Separator line
        hCtx.fillStyle = thm.gridLine || 'rgba(54,58,69,0.3)';
        hCtx.fillRect(0, Math.round(headerY * pr), Math.round(mw * pr), Math.max(1, pr));

        // Header background
        hCtx.fillStyle = (thm.bg || '#131722') + 'DD';
        hCtx.fillRect(0, Math.round(headerY * pr), Math.round(mw * pr), Math.round(HEADER_H * pr));

        // Static label (name + collapse chevron)
        const ind = paneInds[i];
        if (ind) {
          const hFs = Math.round(10 * pr);
          hCtx.font = `bold ${hFs}px Arial`;
          hCtx.fillStyle = thm.axisText || '#787B86';
          hCtx.textAlign = 'left';
          hCtx.textBaseline = 'middle';
          const label = ind.label || ind.shortName || ind.indicatorId || 'Indicator';
          const toggleChar = isCollapsed ? '▶' : '▼';
          hCtx.fillText(
            `${toggleChar} ${label}`,
            Math.round(8 * pr),
            Math.round((headerY + HEADER_H / 2) * pr)
          );
        }

        headerPaneTop += thisPaneH;
      }
      _paneHeaderCache.key = headerCacheKey;
    }

    // Composite cached headers
    iCtx.drawImage(_paneHeaderCache.canvas, 0, 0);

    // Draw dynamic parts: crosshair values + indicator content
    for (let i = 0; i < paneCount; i++) {
      const isCollapsed = collapsedPanes.has(i);
      const thisPaneH = isCollapsed ? HEADER_H : paneHeight;
      const headerY = runningPaneTop;
      const ind = paneInds[i];

      // Dynamic crosshair value on header (changes with mouse position)
      if (ind && fs.hoverIdx != null && ind.computed) {
        const hFs = Math.round(10 * pr);
        iCtx.font = `bold ${hFs}px Arial`;
        const label = ind.label || ind.shortName || ind.indicatorId || 'Indicator';
        const toggleChar = isCollapsed ? '▶' : '▼';
        const staticText = `${toggleChar} ${label}`;
        const staticWidth = iCtx.measureText(staticText).width;

        for (const out of ind.outputs) {
          const vals = ind.computed[out.key];
          if (!vals) continue;
          const val = fs.hoverIdx < vals.length ? vals[fs.hoverIdx] : NaN;
          if (!isNaN(val)) {
            iCtx.fillStyle = thm.axisText || '#787B86';
            iCtx.font = `bold ${hFs}px Arial`;
            iCtx.textAlign = 'left';
            iCtx.textBaseline = 'middle';
            iCtx.fillText(
              `  ${val.toFixed(2)}`,
              Math.round(8 * pr) + staticWidth,
              Math.round((headerY + HEADER_H / 2) * pr)
            );
            break;
          }
        }
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

