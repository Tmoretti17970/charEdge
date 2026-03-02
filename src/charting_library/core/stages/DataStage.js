import { LAYERS } from '../LayerManager.js';
import { CHANGED } from '../FrameState.js';
import { niceScale, formatPrice, createPriceTransform } from '../CoordinateSystem.js';
import { createTimeTransform } from '../TimeAxis.js';
import { HeatmapRenderer } from '../../renderers/HeatmapRenderer.js';
import { getAggregator } from '../../../data/OrderFlowAggregator.js';
import { drawSessionDividers } from '../../renderers/SessionDividers.js';
import { toRenkoBricks, toRangeBars } from '../barTransforms.js';
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
  const pulsePhase = (Date.now() % 2000) / 2000;
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

  // ═══════════════════════════════════════════════════════════════════
  // Phase 1.1.2: BLIT-PAN FAST PATH
  // When viewport shifted by a small number of bars (1-5), shift the
  // existing pixels via drawImage and only render the newly-exposed edge.
  // ═══════════════════════════════════════════════════════════════════
  const prevFs = engine._pipeline?._prevFrameState;
  const isSmallPan = prevFs
    && (changeMask & CHANGED.VIEWPORT) !== 0
    && (changeMask & ~(CHANGED.VIEWPORT | CHANGED.MOUSE | CHANGED.TICK)) === 0
    && chartType === 'candlestick'
    && !fs.showHeatmap
    && fs.visibleBars === prevFs.visibleBars
    && fs.bitmapWidth === prevFs.bitmapWidth
    && fs.bitmapHeight === prevFs.bitmapHeight;

  if (isSmallPan && !webgl?.available) {
    const barShift = fs.startIdx - prevFs.startIdx;
    const absShift = Math.abs(barShift);

    if (absShift >= 1 && absShift <= 5) {
      const shiftPx = Math.round(barShift * bSp * pr);

      mCtx.save();
      mCtx.beginPath();
      mCtx.rect(0, 0, cBW, mainBH);
      mCtx.clip();

      // Blit-shift existing pixels
      const canvas = mCtx.canvas;
      mCtx.clearRect(0, 0, cBW, mainBH);
      mCtx.drawImage(canvas, shiftPx, 0, cBW - Math.abs(shiftPx), mainBH,
                      0, 0, cBW - Math.abs(shiftPx), mainBH);

      // Determine the exposed strip and render only those bars
      let stripX, stripW, stripStartIdx, stripEndIdx;
      if (barShift > 0) {
        // Scrolled right: new bars exposed on the right edge
        stripX = cBW - Math.round(absShift * bSp * pr) - Math.round(bSp * pr);
        stripW = cBW - stripX;
        stripStartIdx = Math.max(0, endIdx - absShift);
        stripEndIdx = endIdx;
      } else {
        // Scrolled left: new bars exposed on the left edge
        stripX = 0;
        stripW = Math.round(absShift * bSp * pr) + Math.round(bSp * pr);
        stripStartIdx = start;
        stripEndIdx = Math.min(bars.length - 1, start + absShift);
      }

      // Clear and render the strip
      mCtx.clearRect(stripX, 0, stripW, mainBH);
      const stripBars = bars.slice(stripStartIdx, stripEndIdx + 1);
      if (stripBars.length > 0) {
        const drawFn = getChartDrawFunction(chartType);
        const drawParams = {
          startIdx: stripStartIdx, barSpacing: bSp, priceToY: p2y,
          pixelRatio: pr, bitmapHeight: mainBH, mainH: mainHeight,
          chartWidth: cBW, timeTransform, yMin, yMax,
        };
        drawFn(mCtx, stripBars, drawParams, thm);
      }

      // Re-draw price line (it spans full width)
      renderPriceLine(mCtx, bars, p2y, pr, cBW, mainBH, thm);

      mCtx.restore();

      // Still need grid/axes/niceStep stored on engine (already set above)
      return; // Skip full redraw
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // FULL REDRAW (original path — zoom, resize, theme change, etc.)
  // ═══════════════════════════════════════════════════════════════════

  // Clear the data layer
  mCtx.clearRect(0, 0, bw, bh);

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
  const useWebGLGrid = webgl?.available && viewportChanged;
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
    const useWebGLVol = webgl?.available && viewportChanged;
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
    const elapsed = Date.now() - fs.loadTimestamp;
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

  // ─── Transform bars for Renko/Range ─────────────────────────
  let renderBars = vis;
  let renderTimeTransform = timeTransform;
  let renderStart = start;
  const isRenko = chartType === 'renko';
  const isRange = chartType === 'range';

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
  }

  // ─── Delegate to Chart Type Renderer ─────────────────────────
  const drawParams = {
    startIdx: renderStart, barSpacing: bSp, priceToY: p2y,
    pixelRatio: pr, bitmapHeight: mainBH, mainH: mainHeight,
    chartWidth: cBW, timeTransform: renderTimeTransform, yMin, yMax,
  };

  const useWebGL = webgl?.available && viewportChanged;
  let renderedViaWebGL = false;

  if (useWebGL) {
    webgl.clear();
    const timeXform = { indexToPixel: (idx) => renderTimeTransform.indexToPixel(idx) };
    const webglParams = {
      pixelRatio: pr, barSpacing: bSp, startIdx: renderStart,
      timeTransform: timeXform, mainH: mainHeight, yMin, yMax,
    };

    if (chartType === 'candlestick') {
      const candleDrawFn = () => webgl.drawCandles(renderBars, webglParams, thm);
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

  mCtx.restore();
}

/** Helper: pulsing dot radius for price line clear calculation */
function dotRadius(pr) {
  return Math.round(4 * pr) * 2.5;
}

