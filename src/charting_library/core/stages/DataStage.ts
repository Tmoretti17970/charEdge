// ═══════════════════════════════════════════════════════════════════
// DataStage — Main Coordinator
//
// Renders the data layer: candles, volume, price line, grid lines,
// alerts, S/R, trade markers, shimmer, heatmap.
//
// Decomposed: fast paths in data/tickUpdate.ts and data/gpuPan.ts,
// render helpers in data/renderHelpers.ts.
// ═══════════════════════════════════════════════════════════════════

import { niceScale, createPriceTransform } from '../CoordinateSystem.js';
import { createTimeTransform } from '../TimeAxis.js';
import { getAggregator } from '../../../data/OrderFlowAggregator.js';

// Sub-stage imports
import { handleTickUpdate } from './data/tickUpdate';
import { handleGPUPan } from './data/gpuPan';
import { renderOverlays, renderVolume, transformBars, renderChartType } from './data/renderHelpers';

// ═══════════════════════════════════════════════════════════════════
// executeDataStage — Main coordinator
// Delegates to sub-functions for each rendering path.
// ═══════════════════════════════════════════════════════════════════

/**
 * Render the data layer: candles, volume, price line, grid lines, alerts, S/R, trade markers.
 *
 * @param {import('../FrameState.js').FrameState} fs
 * @param {Object} ctx - Render contexts
 * @param {Object} engine - ChartEngine instance
 */
export function executeDataStage(fs, ctx, engine) {
  const { theme: thm, dataCtx: mCtx, webgl } = ctx;
  const {
    bitmapWidth: bw,
    bitmapHeight: bh,
    pixelRatio: pr,
    chartWidth: cW,
    mainHeight,
    visBars: vis,
    barSpacing: bSp,
    startIdx: start,
    endIdx,
    exactStart,
    bars,
    yMin,
    yMax,
    chartType,
  } = fs;

  const cBW = Math.round(cW * pr);
  const mainBH = Math.round(mainHeight * pr);
  const changeMask = ctx.changeMask;

  // ─── Compute transforms (always needed for coordinate converters) ──
  const priceTransform = createPriceTransform(yMin, yMax, mainHeight, fs.scaleMode, fs.percentBase);
  const timeTransform = createTimeTransform(bars, start, exactStart, fs.visibleBars, cW);
  const p2y = priceTransform.priceToY;

  // Store computed transforms on engine for drawing engine + other consumers
  engine.state.lastRender = {
    start,
    end: endIdx,
    vis,
    bSp,
    p2y,
    yMin,
    yMax,
    cW,
    mainH: mainHeight,
    axW: fs.axW,
    txH: fs.txH,
    thm,
    pr,
    paneH: fs.paneHeight,
    paneCount: fs.paneCount,
    paneInds: fs.paneInds,
    timeTransform,
    barWidth: Math.max(1, Math.floor(bSp * 0.65 * pr)),
    _splitterHoverIdx: engine.state._splitterHoverIdx,
    collapsedPanes: fs.collapsedPanes || new Set(),
    paneHeights: fs.paneHeights || {},
  };

  // Update drawing engine coordinate converters
  if (engine.drawingEngine) {
    engine.drawingEngine.setCoordinateConverters({
      pixelToPrice: priceTransform.yToPrice,
      priceToPixel: priceTransform.priceToY,
      pixelToTime: timeTransform.pixelToTime,
      timeToPixel: timeTransform.timeToPixel,
    });

    const nStep = niceScale(yMin, yMax, Math.floor(mainHeight / 50));
    engine.drawingEngine.setGridTicks(nStep.ticks || []);

    const snapInds = fs.overlayInds
      .filter((ind) => ind.computed)
      .map((ind) => ({
        label: ind.label || ind.shortName || ind.id,
        outputs: (ind.outputs || []).map((out) => ({
          key: out.key,
          values: ind.computed[out.key] || [],
        })),
      }));
    engine.drawingEngine.setIndicatorData(snapInds);
    engine.drawingEngine.setHoverBarIdx(fs.hoverIdx);
  }

  // Store niceStep/displayTicks for axes stage (needed on all paths)
  const niceStep = niceScale(yMin, yMax, Math.floor(mainHeight / 50));
  const displayTicks = priceTransform.formatTicks(niceStep.ticks);
  engine._lastNiceStep = niceStep;
  engine._lastDisplayTicks = displayTicks;
  engine._lastPriceTransform = priceTransform;
  engine._lastTimeTransform = timeTransform;

  // B2.4: Detect niceStep tick change → start cross-fade transition
  const niceStepKey = niceStep.ticks?.join(',') ?? '';
  if (engine._prevNiceStepKey && niceStepKey !== engine._prevNiceStepKey && !engine._niceStepTransition) {
    const fromTicks = engine._prevNiceStepKey
      .split(',')
      .map(Number)
      .filter((n) => !isNaN(n));
    engine._niceStepTransition = {
      startTime: performance.now(),
      fromTicks,
      toTicks: niceStep.ticks.slice(),
      duration: 120,
    };
  }
  engine._prevNiceStepKey = niceStepKey;

  // B2.4: Clear expired cross-fade transition
  if (engine._niceStepTransition) {
    const elapsed = performance.now() - engine._niceStepTransition.startTime;
    if (elapsed >= engine._niceStepTransition.duration) {
      engine._niceStepTransition = null;
    }
  }

  // ─── Fast path 1: Tick-only update ─────────────────────────────
  if (
    handleTickUpdate(
      mCtx,
      ctx,
      fs,
      engine,
      bars,
      vis,
      changeMask,
      chartType,
      webgl,
      p2y,
      pr,
      cBW,
      mainBH,
      mainHeight,
      bSp,
      thm,
      start,
      timeTransform,
      yMin,
      yMax,
    )
  )
    return;

  // ─── Fast path 2: GPU pan ─────────────────────────────────────
  const prevFs = engine._pipeline?._prevFrameState;
  if (
    handleGPUPan(
      mCtx,
      ctx,
      fs,
      engine,
      changeMask,
      chartType,
      webgl,
      prevFs,
      bars,
      p2y,
      pr,
      cBW,
      mainBH,
      bSp,
      thm,
      yMin,
      yMax,
    )
  )
    return;

  // ═══════════════════════════════════════════════════════════════════
  // FULL REDRAW (original path — zoom, resize, theme change, etc.)
  // ═══════════════════════════════════════════════════════════════════

  mCtx.clearRect(0, 0, cBW, mainBH);
  mCtx.imageSmoothingEnabled = true;
  mCtx.imageSmoothingQuality = 'high';

  // Sync WebGL canvas size
  if (ctx.webglCanvas && (ctx.webglCanvas.width !== bw || ctx.webglCanvas.height !== bh)) {
    ctx.webglCanvas.width = bw;
    ctx.webglCanvas.height = bh;
    ctx.webglCanvas.style.width = fs.mediaWidth + 'px';
    ctx.webglCanvas.style.height = fs.mediaHeight + 'px';
  }

  // Clip to chart area
  mCtx.save();
  mCtx.beginPath();
  mCtx.rect(0, 0, cBW, mainBH);
  mCtx.clip();

  // ─── Liquidity Heatmap Background (WebGL) ──────────────────
  if (fs.showHeatmap && webgl?.available) {
    const aggregator = getAggregator(fs.aggregatorKey || `${fs.symbol}_${fs.timeframe}`);
    if (aggregator?.domHistory?.length > 0) {
      const history = aggregator.domHistory;
      const latestSnapshot = history[history.length - 1];
      if (latestSnapshot.bids?.length || latestSnapshot.asks?.length) {
        const intensity = fs.heatmapIntensity || 1.0;
        const priceRange = yMax - yMin;
        if (priceRange > 0) {
          const NUM_BUCKETS = 60;
          const bucketSize = priceRange / NUM_BUCKETS;
          const bidBuckets = new Map();
          const askBuckets = new Map();
          let maxQty = 0;

          const aggregate = (levels: [string, string][], target: Map<number, number>) => {
            for (const [priceStr, qtyStr] of levels) {
              const price = parseFloat(priceStr);
              if (price < yMin || price > yMax) continue;
              const qty = parseFloat(qtyStr);
              const bucket = Math.floor(price / bucketSize) * bucketSize;
              const existing = target.get(bucket) || 0;
              const newTotal = existing + qty;
              target.set(bucket, newTotal);
              if (newTotal > maxQty) maxQty = newTotal;
            }
          };

          aggregate(latestSnapshot.bids || [], bidBuckets);
          aggregate(latestSnapshot.asks || [], askBuckets);

          if (maxQty > 0) {
            const askCells: Array<{ x: number; y: number; w: number; h: number; intensity: number }> = [];
            const bidCells: Array<{ x: number; y: number; w: number; h: number; intensity: number }> = [];
            const totalW = cW;

            // Build cells for asks (resistance — warm/red)
            askBuckets.forEach((qty: number, bp: number) => {
              const norm = Math.min((qty / maxQty) * intensity, 1.0);
              if (norm > 0.05) {
                const yTop = p2y(bp + bucketSize);
                const yBot = p2y(bp);
                const h = Math.max(3, Math.abs(yBot - yTop));
                askCells.push({ x: 0, y: Math.min(yTop, yBot), w: totalW, h, intensity: norm });
              }
            });

            // Build cells for bids (support — blue)
            bidBuckets.forEach((qty: number, bp: number) => {
              const norm = Math.min((qty / maxQty) * intensity, 1.0);
              if (norm > 0.05) {
                const yTop = p2y(bp + bucketSize);
                const yBot = p2y(bp);
                const h = Math.max(3, Math.abs(yBot - yTop));
                bidCells.push({ x: 0, y: Math.min(yTop, yBot), w: totalW, h, intensity: norm });
              }
            });

            const cmdBuf = ctx.commandBuffer;

            // Draw ask heatmap (warm/red palette)
            if (askCells.length > 0) {
              const ac = askCells;
              const drawAsks = () =>
                webgl.drawHeatmap(
                  ac,
                  { pixelRatio: 1, globalAlpha: 0.7 },
                  {
                    coldColor: 'rgba(255, 200, 100, 0.3)',
                    warmColor: 'rgba(255, 140, 40, 0.7)',
                    hotColor: 'rgba(255, 50, 20, 0.9)',
                  },
                );
              if (cmdBuf) {
                cmdBuf.push({
                  program: webgl.getProgram('heatmap'),
                  blendMode: 0,
                  texture: null,
                  zOrder: 0,
                  label: 'heatmap-asks',
                  drawFn: drawAsks,
                });
              } else {
                drawAsks();
              }
            }

            // Draw bid heatmap (blue palette)
            if (bidCells.length > 0) {
              const bc = bidCells;
              const drawBids = () =>
                webgl.drawHeatmap(
                  bc,
                  { pixelRatio: 1, globalAlpha: 0.7 },
                  {
                    coldColor: 'rgba(60, 120, 200, 0.3)',
                    warmColor: 'rgba(30, 144, 255, 0.7)',
                    hotColor: 'rgba(20, 100, 255, 0.9)',
                  },
                );
              if (cmdBuf) {
                cmdBuf.push({
                  program: webgl.getProgram('heatmap'),
                  blendMode: 0,
                  texture: null,
                  zOrder: 0,
                  label: 'heatmap-bids',
                  drawFn: drawBids,
                });
              } else {
                drawBids();
              }
            }
          }
        }
      }
    }
  }

  // ─── Horizontal Grid Lines ──────────────────────────────────
  const gridTicks = niceStep.ticks;
  const useWebGLGrid = webgl?.available;
  if (useWebGLGrid) {
    const gridHorizontal = gridTicks.map((t, gi) => ({
      y: p2y(t),
      isMajor: gi % 2 === 0,
    }));
    const cmdBuf = ctx.commandBuffer;
    if (cmdBuf) {
      cmdBuf.push({
        program: webgl.getProgram('fibFill'),
        blendMode: 0,
        texture: null,
        zOrder: -1,
        label: 'grid-lines',
        drawFn: () =>
          webgl.drawGrid({ horizontal: gridHorizontal }, { pixelRatio: pr, chartWidth: cW, mainHeight }, thm),
      });
    } else {
      webgl.drawGrid({ horizontal: gridHorizontal }, { pixelRatio: pr, chartWidth: cW, mainHeight }, thm);
    }
  } else {
    for (let gi = 0; gi < gridTicks.length; gi++) {
      const t = gridTicks[gi];
      const gy = Math.round(p2y(t) * pr);
      const isMajor = gi % 2 === 0;
      mCtx.fillStyle = isMajor ? thm.gridLine || 'rgba(54,58,69,0.4)' : thm.gridLine || 'rgba(54,58,69,0.18)';
      mCtx.fillRect(0, gy, cBW, isMajor ? Math.max(1, pr) : Math.max(1, Math.round(pr * 0.5)));
    }
  }

  // ─── Volume ──────────────────────────────────────────────────
  renderVolume(mCtx, ctx, fs, vis, webgl, start, timeTransform, pr, bSp, mainHeight, mainBH, thm);

  // ─── Candle Entrance Animation ─────────────────────────────
  let entranceAlpha = 1;
  let entranceOffsetX = 0;
  if (fs.loadTimestamp) {
    const elapsed = performance.now() - fs.loadTimestamp;
    const duration = 300;
    if (elapsed < duration) {
      const t = elapsed / duration;
      const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      entranceAlpha = ease;
      entranceOffsetX = (1 - ease) * 20 * (devicePixelRatio || 1);
      mCtx.globalAlpha = entranceAlpha;
      mCtx.translate(entranceOffsetX, 0);
      engine.markDirty();
    } else {
      engine._loadTimestamp = null;
    }
  }

  // ─── Bar Transforms (Renko/Range/Heikin-Ashi) ─────────────────
  const { renderBars, renderTimeTransform, renderStart } = transformBars(
    fs,
    engine,
    bars,
    vis,
    chartType,
    start,
    endIdx,
    cW,
    timeTransform,
  );

  // ─── Delegate to Chart Type Renderer ─────────────────────────
  renderChartType(
    mCtx,
    ctx,
    engine,
    fs,
    renderBars,
    renderStart,
    chartType,
    webgl,
    p2y,
    pr,
    bSp,
    mainBH,
    mainHeight,
    cBW,
    renderTimeTransform,
    yMin,
    yMax,
    thm,
  );

  // Reset entrance animation transform
  if (entranceAlpha < 1) {
    mCtx.globalAlpha = 1;
    mCtx.setTransform(devicePixelRatio || 1, 0, 0, devicePixelRatio || 1, 0, 0);
  }

  // ─── Delegate overlays to extracted sub-function ──────────────
  renderOverlays(mCtx, fs, engine, bars, vis, start, endIdx, p2y, pr, cBW, mainBH, mainHeight, bSp, thm, timeTransform);

  mCtx.restore();
}
