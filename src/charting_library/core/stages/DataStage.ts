import { LAYERS } from '../LayerManager.js';
import { CHANGED } from '../FrameState.js';
import { niceScale, formatPrice, createPriceTransform } from '../CoordinateSystem.js';
import { createTimeTransform } from '../TimeAxis.js';
import { HeatmapRenderer } from '../../renderers/HeatmapRenderer.js';
import { getAggregator } from '../../../data/OrderFlowAggregator.js';
import { drawSessionDividers } from '../../renderers/SessionDividers.js';
import { toRenkoBricks, toRangeBars, toHeikinAshi } from '../barTransforms.js';
import { getChartDrawFunction } from '../../renderers/renderers/ChartTypes.js';

// ─── Phase 1.1.2: Incremental Bar Append helpers ─────────────────

/**
 * Render the price line and pulsing dot for the last bar.
 * Extracted so both full-redraw and tick-update paths can call it.
 */
function renderPriceLine(mCtx, bars, p2y, pr, cBW, mainBH, thm) {
  const last = bars[bars.length - 1];
  if (!last) return;
  const yB = Math.round(p2y(last.close) * pr);
  const priceLineColor = last.close >= last.open ? thm.bullCandle || '#26A69A' : thm.bearCandle || '#EF5350';
  mCtx.strokeStyle = priceLineColor;
  mCtx.lineWidth = Math.max(1, pr);
  mCtx.setLineDash([Math.round(4 * pr), Math.round(4 * pr)]);
  mCtx.beginPath();
  mCtx.moveTo(0, yB + 0.5);
  mCtx.lineTo(cBW, yB + 0.5);
  mCtx.stroke();
  mCtx.setLineDash([]);

  // Pulsing dot
  const dotX = cBW - Math.round(6 * pr);
  const dotR = Math.round(4 * pr);
  const pulsePhase = (performance.now() % 2000) / 2000;
  const pulseAlpha = 0.3 + Math.sin(pulsePhase * Math.PI * 2) * 0.2;
  const glowColor = last.close >= last.open
    ? `rgba(38,166,154,${(pulseAlpha * 0.3).toFixed(2)})`
    : `rgba(239,83,80,${(pulseAlpha * 0.3).toFixed(2)})`;
  mCtx.beginPath();
  mCtx.arc(dotX, yB, dotR * 2.5, 0, Math.PI * 2);
  mCtx.fillStyle = glowColor;
  mCtx.fill();
  mCtx.beginPath();
  mCtx.arc(dotX, yB, dotR, 0, Math.PI * 2);
  mCtx.fillStyle = priceLineColor;
  mCtx.fill();
}

/**
 * Render the data layer: candles, volume, price line, grid lines, alerts, S/R, trade markers.
 *
 * @param {import('../FrameState.js').FrameState} fs
 * @param {Object} ctx - Render contexts
 * @param {Object} engine - ChartEngine instance
 */
export function executeDataStage(fs, ctx, engine) {
  const { layers, theme: thm, dataCtx: mCtx, webgl } = ctx;
  const {
    bitmapWidth: bw, bitmapHeight: bh, pixelRatio: pr,
    chartWidth: cW, mainHeight, visBars: vis, barSpacing: bSp,
    startIdx: start, endIdx, exactStart, bars, yMin, yMax,
    viewportChanged, lod, chartType,
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
    start, end: endIdx, vis, bSp, p2y, yMin, yMax, cW, mainH: mainHeight,
    axW: fs.axW, txH: fs.txH, thm, pr, paneH: fs.paneHeight,
    paneCount: fs.paneCount, paneInds: fs.paneInds, timeTransform,
    _splitterHoverIdx: engine.state._splitterHoverIdx, // Sprint 11
    collapsedPanes: fs.collapsedPanes || new Set(),     // Sprint 11
    paneHeights: fs.paneHeights || {},                  // Per-pane height fractions for splitter hit-test
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
      .filter(ind => ind.computed)
      .map(ind => ({
        label: ind.label || ind.shortName || ind.id,
        outputs: (ind.outputs || []).map(out => ({
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
    // Parse previous tick positions from the key
    const fromTicks = engine._prevNiceStepKey.split(',').map(Number).filter(n => !isNaN(n));
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

  // ═══════════════════════════════════════════════════════════════════
  // Phase 1.1.2: TICK-UPDATE FAST PATH
  // When only the last bar's OHLC changed (streaming tick), skip the
  // full clear+redraw.  Instead, clear only the last 2 bars' region
  // and re-render them + the price line.
  // ═══════════════════════════════════════════════════════════════════
  const isTickOnly = (changeMask & CHANGED.TICK) !== 0
    && (changeMask & ~(CHANGED.TICK | CHANGED.ANIMATION | CHANGED.MOUSE)) === 0
    && chartType === 'candlestick'
    && !fs.showHeatmap
    && vis.length > 2;

  if (isTickOnly && webgl?.available) {
    // Sprint 7: WebGL tick fast path — single-instance update via bufferSubData
    const lastBar = bars[bars.length - 1];
    if (lastBar && webgl.updateLastCandle(lastBar, {
      pixelRatio: pr, barSpacing: bSp, startIdx: start,
      timeTransform, yMin, yMax,
    }, thm)) {
      // Task 2.3.13: Also sub-update the last volume bar
      if (fs.showVolume && webgl.updateLastVolume) {
        webgl.updateLastVolume(lastBar, {
          pixelRatio: pr, barSpacing: bSp, startIdx: start,
          timeTransform: { indexToPixel: (idx) => timeTransform.indexToPixel(idx) },
          mainH: mainHeight,
        }, thm);
      }

      // Queue a redraw command so the updated buffer data is rendered during flush
      const cmdBuf = ctx.commandBuffer;
      if (cmdBuf) {
        const tickYMin = yMin, tickYMax = yMax;
        cmdBuf.push({
          program: webgl.getProgram('candle'),
          blendMode: 0, texture: null, zOrder: 1,
          label: 'candles-tick',
          drawFn: () => webgl.redrawWithPanOffset(0, { yMin: tickYMin, yMax: tickYMax }),
        });
      }

      // Redraw Canvas 2D price line only
      mCtx.clearRect(0, 0, cBW, mainBH);
      mCtx.save();
      mCtx.beginPath();
      mCtx.rect(0, 0, cBW, mainBH);
      mCtx.clip();
      renderPriceLine(mCtx, bars, p2y, pr, cBW, mainBH, thm);

      // Sprint 7: Subtle pulse glow on price line dot during tick
      const plY = Math.round(p2y(lastBar.close) * pr);
      const plX = cBW - 1;
      const glowR = Math.round(6 * pr);
      const grad = mCtx.createRadialGradient(plX, plY, 0, plX, plY, glowR);
      grad.addColorStop(0, 'rgba(41, 98, 255, 0.35)');
      grad.addColorStop(1, 'rgba(41, 98, 255, 0)');
      mCtx.fillStyle = grad;
      mCtx.fillRect(plX - glowR, plY - glowR, glowR * 2, glowR * 2);

      engine._prevPriceLineY = plY;
      mCtx.restore();
      return; // Skip full redraw
    }
  }

  if (isTickOnly && !webgl?.available) {
    // Calculate the region covering the last 2 bars + price line
    const lastIdx = vis.length - 1;
    const penultIdx = Math.max(0, lastIdx - 1);
    const x1 = Math.round(timeTransform.indexToPixel(start + penultIdx) * pr) - Math.round(bSp * pr);
    const x2 = cBW; // extend to right edge (price line + dot)
    const clearW = x2 - Math.max(0, x1);

    // Clear the region
    mCtx.save();
    mCtx.beginPath();
    mCtx.rect(0, 0, cBW, mainBH);
    mCtx.clip();

    // Clear last bars region
    mCtx.clearRect(Math.max(0, x1), 0, clearW, mainBH);

    // Clear entire width for price line (it spans full width)
    // Just clear a thin strip around the old and new price Y
    const lastBar = bars[bars.length - 1];
    if (lastBar) {
      const plY = Math.round(p2y(lastBar.close) * pr);
      const plClear = Math.round(dotRadius(pr) * 3);
      mCtx.clearRect(0, plY - plClear, cBW, plClear * 2);
      // Also clear previous price line position if available
      if (engine._prevPriceLineY != null && engine._prevPriceLineY !== plY) {
        mCtx.clearRect(0, engine._prevPriceLineY - plClear, cBW, plClear * 2);
      }
      engine._prevPriceLineY = plY;
    }

    // Re-draw the last 2 candles
    const drawFn = getChartDrawFunction(chartType);
    const partialBars = vis.slice(penultIdx);
    const drawParams = {
      startIdx: start + penultIdx, barSpacing: bSp, priceToY: p2y,
      pixelRatio: pr, bitmapHeight: mainBH, mainH: mainHeight,
      chartWidth: cBW, timeTransform, yMin, yMax,
    };
    drawFn(mCtx, partialBars, drawParams, thm);

    // Re-draw price line (full width)
    renderPriceLine(mCtx, bars, p2y, pr, cBW, mainBH, thm);

    mCtx.restore();
    return; // Skip full redraw
  }

  const prevFs = engine._pipeline?._prevFrameState;

  // ═══════════════════════════════════════════════════════════════════
  // Sprint 3: GPU PAN FAST PATH
  // When only the scroll position changed (no zoom, no data change) and
  // WebGL has a previous frame's instance data, shift candles + volume via
  // a single u_panOffset uniform update. This avoids rebuilding instance
  // buffers (~16ms → ~1ms per pan frame).
  // ═══════════════════════════════════════════════════════════════════
  const isGpuPanCandidate = webgl?.available
    && prevFs
    && (changeMask & CHANGED.VIEWPORT) !== 0
    && (changeMask & ~(CHANGED.VIEWPORT | CHANGED.MOUSE | CHANGED.TICK)) === 0
    && chartType === 'candlestick'
    && !fs.showHeatmap
    && fs.visibleBars === prevFs.visibleBars   // same zoom level
    && fs.bitmapWidth === prevFs.bitmapWidth
    && fs.bitmapHeight === prevFs.bitmapHeight
    && fs.barCount === prevFs.barCount         // no new bars added
    && fs.startIdx === prevFs.startIdx         // Sprint 3: no bar entry/exit (same virtual window)
    && fs.endIdx === prevFs.endIdx;

  if (isGpuPanCandidate) {
    // Calculate sub-bar pixel offset from previous frame
    const scrollDelta = fs.scrollOffset - prevFs.scrollOffset;
    const panOffsetPx = scrollDelta * bSp * fs.pixelRatio;

    // Only use GPU path for small-to-medium pans (within the visible bar window)
    if (Math.abs(scrollDelta) < fs.visibleBars * 0.8 && webgl._lastCandleInstanceCount) {
      // Queue the pan-offset redraw into the command buffer so it participates
      // in the centralized clear+flush cycle. Drawing directly here would be
      // wiped by webgl.clear() when the buffer flushes later.
      const cmdBuf = ctx.commandBuffer;
      const capturedYMin = yMin;
      const capturedYMax = yMax;
      const capturedPanOffset = panOffsetPx;
      if (cmdBuf) {
        cmdBuf.push({
          program: webgl.getProgram('candle'),
          blendMode: 0,
          texture: null,
          zOrder: 1,
          label: 'candles-pan',
          drawFn: () => webgl.redrawWithPanOffset(capturedPanOffset, { yMin: capturedYMin, yMax: capturedYMax }),
        });
      }

      // Redraw Canvas 2D overlays on the DATA layer
      mCtx.clearRect(0, 0, cBW, mainBH);
      mCtx.save();
      mCtx.beginPath();
      mCtx.rect(0, 0, cBW, mainBH);
      mCtx.clip();

      // Re-draw price line (spans full width)
      renderPriceLine(mCtx, bars, p2y, pr, cBW, mainBH, thm);
      const last = bars[bars.length - 1];
      if (last) engine._prevPriceLineY = Math.round(p2y(last.close) * pr);

      // S/R levels
      if (fs.srLevels?.length) {
        const maxStr = Math.max(...fs.srLevels.map(l => l.strength));
        for (const lvl of fs.srLevels) {
          const y = Math.round(p2y(lvl.price) * pr);
          if (y < 0 || y > mainBH) continue;
          const alpha = 0.15 + (lvl.strength / maxStr) * 0.4;
          const color = lvl.type === 'support' ? `rgba(38,166,154,${alpha})` : (lvl.type === 'resistance' ? `rgba(239,83,80,${alpha})` : `rgba(245,158,11,${alpha})`);
          mCtx.strokeStyle = color;
          mCtx.lineWidth = Math.max(1, Math.round(2 * pr));
          mCtx.setLineDash([Math.round(4 * pr), Math.round(4 * pr)]);
          mCtx.beginPath();
          mCtx.moveTo(0, y + 0.5);
          mCtx.lineTo(cBW, y + 0.5);
          mCtx.stroke();
          mCtx.setLineDash([]);
        }
      }

      // Alerts
      const symAlerts = (fs.alerts || []).filter(a => a.symbol?.toUpperCase() === fs.symbol?.toUpperCase());
      if (symAlerts.length > 0) {
        mCtx.setLineDash([Math.round(6 * pr), Math.round(4 * pr)]);
        for (const al of symAlerts) {
          const ay = Math.round(p2y(al.price) * pr);
          if (ay < 0 || ay > mainBH) continue;
          mCtx.strokeStyle = (al.active ? '#F59E0B' : '#EF4444') + 'AA';
          mCtx.lineWidth = Math.max(1, Math.round(1.5 * pr));
          mCtx.beginPath();
          mCtx.moveTo(0, ay + 0.5);
          mCtx.lineTo(cBW, ay + 0.5);
          mCtx.stroke();
        }
        mCtx.setLineDash([]);
      }

      mCtx.restore();
      return; // Skip full redraw — GPU pan handled candles via command buffer
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // FULL REDRAW (original path — zoom, resize, theme change, etc.)
  // ═══════════════════════════════════════════════════════════════════

  // Clear the data layer (chart area only — axes gutter is managed by AxesStage)
  mCtx.clearRect(0, 0, cBW, mainBH);

  // ─── Canvas Rendering Quality ──────────────────────────────
  mCtx.imageSmoothingEnabled = true;
  mCtx.imageSmoothingQuality = 'high';

  // ─── Sync WebGL canvas size ─────────────────────────────────
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

  // ─── Liquidity Heatmap Background ─────────────────────────
  if (fs.showHeatmap) {
    const aggregator = getAggregator(fs.aggregatorKey || `${fs.symbol}_${fs.timeframe}`);
    HeatmapRenderer.draw(
      mCtx, aggregator, start, endIdx,
      Math.floor(bSp * pr),
      (p) => Math.round(p2y(p) * pr),
      { min: yMin, max: yMax },
      fs.heatmapIntensity
    );
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
        drawFn: () => webgl.drawGrid(
          { horizontal: gridHorizontal },
          { pixelRatio: pr, chartWidth: cW, mainHeight },
          thm
        ),
      });
    } else {
      webgl.drawGrid(
        { horizontal: gridHorizontal },
        { pixelRatio: pr, chartWidth: cW, mainHeight },
        thm
      );
    }
  } else {
    // Canvas2D fallback
    for (let gi = 0; gi < gridTicks.length; gi++) {
      const t = gridTicks[gi];
      const gy = Math.round(p2y(t) * pr);
      const isMajor = gi % 2 === 0;
      mCtx.fillStyle = isMajor
        ? (thm.gridLine || 'rgba(54,58,69,0.4)')
        : (thm.gridLine || 'rgba(54,58,69,0.18)');
      mCtx.fillRect(0, gy, cBW, isMajor ? Math.max(1, pr) : Math.max(1, Math.round(pr * 0.5)));
    }
  }

  // ─── Volume ──────────────────────────────────────────────────
  if (fs.showVolume && lod.volume) {
    const useWebGLVol = webgl?.available;
    if (useWebGLVol) {
      const volDrawFn = () => webgl.drawVolume(vis, {
        pixelRatio: pr, barSpacing: bSp, startIdx: start,
        timeTransform: { indexToPixel: (idx) => timeTransform.indexToPixel(idx) },
        mainH: mainHeight,
      }, thm);
      const cmdBuf = ctx.commandBuffer;
      if (cmdBuf) {
        cmdBuf.push({
          program: webgl.getProgram('volume'),
          blendMode: 0,
          texture: null,
          zOrder: 0,
          label: 'volume',
          drawFn: volDrawFn,
        });
      } else {
        volDrawFn();
      }
    } else if (!webgl?.available) {
      let mV = 0;
      for (const b of vis) if ((b.volume || 0) > mV) mV = b.volume;
      if (mV > 0) {
        const vH = mainHeight * 0.12, vbw = Math.max(1, Math.floor(bSp * 0.7));
        for (let i = 0; i < vis.length; i++) {
          const bull = vis[i].close >= vis[i].open;
          const vHp = Math.max(1, Math.round(vH * (vis[i].volume || 0) / mV * pr));
          const x = Math.round(timeTransform.indexToPixel(start + i) * pr);
          const barW = Math.max(1, Math.floor(vbw * pr));
          const barTop = mainBH - vHp;
          const vGrad = mCtx.createLinearGradient(0, barTop, 0, mainBH);
          if (bull) {
            vGrad.addColorStop(0, 'rgba(38,166,154,0.4)');
            vGrad.addColorStop(1, 'rgba(38,166,154,0.06)');
          } else {
            vGrad.addColorStop(0, 'rgba(239,83,80,0.4)');
            vGrad.addColorStop(1, 'rgba(239,83,80,0.06)');
          }
          mCtx.fillStyle = vGrad;
          mCtx.fillRect(x - Math.floor(barW / 2), barTop, barW, vHp);
        }
      }
    }
  }

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

  // ─── Transform bars for Renko/Range/Heikin-Ashi ─────────────────────────
  // Task 2.3.15: Off-thread bar transforms via DataStageWorker.
  // Uses cached result pattern: dispatch async, use cached data in render.
  let renderBars = vis;
  let renderTimeTransform = timeTransform;
  let renderStart = start;
  const isRenko = chartType === 'renko';
  const isRange = chartType === 'range';
  const isHeikinAshi = chartType === 'heikinashi';
  const needsTransform = isRenko || isRange || isHeikinAshi;

  // Check for cached worker result from a previous frame's async dispatch
  const workerBridge = engine._workerBridge;
  const workerCache = engine._dataStageWorkerCache;
  let usedWorkerCache = false;

  if (needsTransform && workerCache
    && workerCache.chartType === chartType
    && workerCache.barCount === bars.length
    && workerCache.bars) {
    // Use cached worker-computed transformed bars
    renderBars = workerCache.bars;
    renderStart = workerCache.renderStart;
    if (isRenko || isRange) {
      renderTimeTransform = createTimeTransform(
        workerCache.allTransformedBars || renderBars,
        renderStart, renderStart, fs.visibleBars, cW
      );
    }
    usedWorkerCache = true;
  }

  if (needsTransform && !usedWorkerCache) {
    // Synchronous fallback (first frame or no worker available)
    if (isRenko) {
      const { bricks } = toRenkoBricks(bars, fs.renkoBrickSize);
      const rEnd = bricks.length;
      const rStart = Math.max(0, rEnd - fs.visibleBars);
      renderBars = bricks.slice(rStart, rEnd);
      renderStart = rStart;
      renderTimeTransform = createTimeTransform(bricks, rStart, rStart, fs.visibleBars, cW);
    } else if (isRange) {
      const { rangeBars } = toRangeBars(bars, fs.rangeBarSize);
      const rEnd = rangeBars.length;
      const rStart = Math.max(0, rEnd - fs.visibleBars);
      renderBars = rangeBars.slice(rStart, rEnd);
      renderStart = rStart;
      renderTimeTransform = createTimeTransform(rangeBars, rStart, rStart, fs.visibleBars, cW);
    } else if (isHeikinAshi) {
      const haBars = toHeikinAshi(bars);
      renderBars = haBars.slice(start, Math.min(haBars.length, endIdx + 2));
    }
  }

  // Dispatch async worker transform for NEXT frame (non-blocking)
  if (needsTransform && workerBridge?.hasDataStageWorker) {
    workerBridge.transformBars({
      bars, chartType, visibleBars: fs.visibleBars,
      startIdx: start, endIdx,
      renkoBrickSize: fs.renkoBrickSize,
      rangeBarSize: fs.rangeBarSize,
    }).then((result: any) => {
      if (!result) return;
      // Reconstruct bar objects from typed arrays
      const len = result.length;
      const reconstructed = new Array(len);
      const time = new Float64Array(result.time);
      const open = new Float64Array(result.open);
      const high = new Float64Array(result.high);
      const low = new Float64Array(result.low);
      const close = new Float64Array(result.close);
      const volume = new Float64Array(result.volume);
      for (let i = 0; i < len; i++) {
        reconstructed[i] = {
          time: time[i], open: open[i], high: high[i],
          low: low[i], close: close[i], volume: volume[i],
        };
      }
      // Cache for use in the next render frame
      engine._dataStageWorkerCache = {
        chartType,
        barCount: bars.length,
        bars: reconstructed,
        renderStart: result.renderStart,
        transformMeta: result.transformMeta,
      };
      // Mark dirty so next frame picks up the cached result
      engine.markDirty();
    }).catch(() => { /* worker timeout — sync fallback already handled */ });
  }

  // ─── Delegate to Chart Type Renderer ─────────────────────────
  const drawParams = {
    startIdx: renderStart, barSpacing: bSp, priceToY: p2y,
    pixelRatio: pr, bitmapHeight: mainBH, mainH: mainHeight,
    chartWidth: cBW, timeTransform: renderTimeTransform, yMin, yMax,
  };

  const useWebGL = webgl?.available;
  let renderedViaWebGL = false;

  if (useWebGL) {
    const timeXform = { indexToPixel: (idx) => renderTimeTransform.indexToPixel(idx) };
    const webglParams = {
      pixelRatio: pr, barSpacing: bSp, startIdx: renderStart,
      timeTransform: timeXform, mainH: mainHeight, yMin, yMax,
    };

    if (chartType === 'candlestick' || chartType === 'hollow' || chartType === 'heikinashi') {
      const hollowParams = chartType === 'hollow' ? { ...webglParams, hollow: true } : webglParams;
      const candleDrawFn = () => webgl.drawCandles(renderBars, hollowParams, thm);
      const cmdBuf = ctx.commandBuffer;
      if (cmdBuf) {
        cmdBuf.push({ program: webgl.getProgram('candle'), blendMode: 0, texture: null, zOrder: 1, label: 'candles', drawFn: candleDrawFn });
      } else { candleDrawFn(); }
      renderedViaWebGL = true;
    } else if (chartType === 'line') {
      const lineDrawFn = () => webgl.drawLine(renderBars, { ...webglParams, priceToY: p2y }, thm.bullCandle || '#2962FF', 2);
      const cmdBuf = ctx.commandBuffer;
      if (cmdBuf) {
        cmdBuf.push({ program: webgl.getProgram('aaLine'), blendMode: 0, texture: null, zOrder: 1, label: 'line-chart', drawFn: lineDrawFn });
      } else { lineDrawFn(); }
      renderedViaWebGL = true;
    } else if (chartType === 'area') {
      const areaDrawFn = () => webgl.drawArea(renderBars, { ...webglParams, priceToY: p2y }, thm.bullCandle || '#2962FF', 'rgba(41,98,255,0.12)');
      const cmdBuf = ctx.commandBuffer;
      if (cmdBuf) {
        cmdBuf.push({ program: webgl.getProgram('line'), blendMode: 0, texture: null, zOrder: 1, label: 'area-chart', drawFn: areaDrawFn });
      } else { areaDrawFn(); }
      renderedViaWebGL = true;
    } else if (chartType === 'baseline') {
      // Baseline: green fill above baseline price, red fill below
      // Uses GL scissor to clip two drawArea passes
      const baselinePrice = renderBars[0]?.close ?? yMin;
      const baselineY = Math.round(p2y(baselinePrice) * pr);
      const gl = webgl.gl;
      const cH = webgl.canvas.height;

      const baselineDrawFn = () => {
        const areaParams = { ...webglParams, priceToY: p2y };

        // Upper half: green fill (above baseline)
        gl.enable(gl.SCISSOR_TEST);
        gl.scissor(0, cH - baselineY, webgl.canvas.width, baselineY);
        webgl.drawArea(renderBars, areaParams, '#26A69A', 'rgba(38,166,154,0.12)');

        // Lower half: red fill (below baseline)
        gl.scissor(0, 0, webgl.canvas.width, cH - baselineY);
        webgl.drawArea(renderBars, areaParams, '#EF5350', 'rgba(239,83,80,0.12)');

        gl.disable(gl.SCISSOR_TEST);
      };

      const cmdBuf = ctx.commandBuffer;
      if (cmdBuf) {
        cmdBuf.push({ program: webgl.getProgram('line'), blendMode: 0, texture: null, zOrder: 1, label: 'baseline-chart', drawFn: baselineDrawFn });
      } else { baselineDrawFn(); }
      renderedViaWebGL = true;
    }
  }

  if (!renderedViaWebGL) {
    const drawFn = getChartDrawFunction(chartType);
    if (chartType === 'footprint') {
      const fpAggregator = getAggregator(fs.aggregatorKey || `${fs.symbol}_${fs.timeframe}`);
      drawFn(mCtx, renderBars, drawParams, thm, fpAggregator);
    } else {
      drawFn(mCtx, renderBars, drawParams, thm);
    }
  }

  // Reset entrance animation transform
  if (entranceAlpha < 1) {
    mCtx.globalAlpha = 1;
    mCtx.setTransform(devicePixelRatio || 1, 0, 0, devicePixelRatio || 1, 0, 0);
  }

  // ─── S/R Levels ──────────────────────────────────────────────
  if (fs.srLevels?.length) {
    const maxStr = Math.max(...fs.srLevels.map(l => l.strength));
    for (const lvl of fs.srLevels) {
      const y = Math.round(p2y(lvl.price) * pr);
      if (y < 0 || y > mainBH) continue;
      const alpha = 0.15 + (lvl.strength / maxStr) * 0.4;
      const color = lvl.type === 'support' ? `rgba(38,166,154,${alpha})` : (lvl.type === 'resistance' ? `rgba(239,83,80,${alpha})` : `rgba(245,158,11,${alpha})`);
      mCtx.strokeStyle = color;
      mCtx.lineWidth = Math.max(1, Math.round(2 * pr));
      mCtx.setLineDash([Math.round(4 * pr), Math.round(4 * pr)]);
      mCtx.beginPath();
      mCtx.moveTo(0, y + 0.5);
      mCtx.lineTo(cBW, y + 0.5);
      mCtx.stroke();
      mCtx.setLineDash([]);
    }
  }

  // ─── Session Dividers ──────────────────────────────────────
  if (fs.showSessions && vis.length > 0) {
    drawSessionDividers(mCtx, vis, start, timeTransform, mainHeight, pr, thm);
  }

  // ─── Trade Markers ──────────────────────────────────────────
  engine.renderTradeMarkers(mCtx, fs.trades, fs.symbol, bars, start, endIdx + 1, timeTransform, p2y, pr);

  // ─── Price Line + Pulsing Dot ────────────────────────────────
  renderPriceLine(mCtx, bars, p2y, pr, cBW, mainBH, thm);
  // Track price line Y for incremental clear
  const last = bars[bars.length - 1];
  if (last) {
    engine._prevPriceLineY = Math.round(p2y(last.close) * pr);
  }

  // ─── Alerts ──────────────────────────────────────────────────
  const symAlerts = (fs.alerts || []).filter(a => a.symbol?.toUpperCase() === fs.symbol?.toUpperCase());
  if (symAlerts.length > 0) {
    mCtx.setLineDash([Math.round(6 * pr), Math.round(4 * pr)]);
    for (const al of symAlerts) {
      const ay = Math.round(p2y(al.price) * pr);
      if (ay < 0 || ay > mainBH) continue;
      mCtx.strokeStyle = (al.active ? '#F59E0B' : '#EF4444') + 'AA';
      mCtx.lineWidth = Math.max(1, Math.round(1.5 * pr));
      mCtx.beginPath();
      mCtx.moveTo(0, ay + 0.5);
      mCtx.lineTo(cBW, ay + 0.5);
      mCtx.stroke();
    }
    mCtx.setLineDash([]);
  }

  // ─── Sprint 1: Shimmer Bars (history loading ghost preview) ──
  if (engine.state.historyLoading && start <= 5) {
    const shimmerCount = 12;
    const pulsePhase = (performance.now() % 1500) / 1500;
    const baseAlpha = 0.08 + Math.sin(pulsePhase * Math.PI * 2) * 0.05;
    const shimmerColor = `rgba(41, 98, 255, ${baseAlpha.toFixed(3)})`;

    for (let si = 0; si < shimmerCount; si++) {
      // Draw ghost bars to the LEFT of the visible range
      const gx = Math.round(timeTransform.indexToPixel(start - shimmerCount + si) * pr);
      const gw = Math.max(1, Math.floor(bSp * 0.65 * pr));
      const gh = Math.round((0.3 + Math.random() * 0.2) * mainBH);
      const gy = Math.round((mainBH - gh) * 0.4 + Math.random() * mainBH * 0.2);

      mCtx.fillStyle = shimmerColor;
      mCtx.fillRect(gx - Math.floor(gw / 2), gy, gw, gh);
    }
    // Keep re-rendering for shimmer animation
    engine.markDirty();
  }

  mCtx.restore();
}

/** Helper: pulsing dot radius for price line clear calculation */
function dotRadius(pr) {
  return Math.round(4 * pr) * 2.5;
}

