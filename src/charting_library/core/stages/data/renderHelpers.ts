// ═══════════════════════════════════════════════════════════════════
// DataStage — Render Helpers
// Price line, overlays, volume, bar transforms, chart type dispatch.
// ═══════════════════════════════════════════════════════════════════

import { drawSessionDividers } from '../../../renderers/SessionDividers.js';
import { getChartDrawFunction } from '../../../renderers/renderers/ChartTypes.js';
import { createTimeTransform } from '../../TimeAxis.js';
import { toRenkoBricks, toRangeBars, toHeikinAshi } from '../../barTransforms.js';
import { getAggregator } from '../../../../data/OrderFlowAggregator.js';

// ─── Price Line + Pulsing Dot ────────────────────────────────────

export function renderPriceLine(mCtx, bars, p2y, pr, cBW, mainBH, thm) {
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

/** Helper: pulsing dot radius for price line clear calculation */
export function dotRadius(pr) {
    return Math.round(4 * pr) * 2.5;
}

// ─── Overlays (S/R, Session Dividers, Trade Markers, Alerts, Shimmer) ──

export function renderOverlays(mCtx, fs, engine, bars, vis, start, endIdx,
    p2y, pr, cBW, mainBH, mainHeight, bSp, thm, timeTransform) {
    // S/R Levels
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

    // Session Dividers
    if (fs.showSessions && vis.length > 0) {
        drawSessionDividers(mCtx, vis, start, timeTransform, mainHeight, pr, thm);
    }

    // Trade Markers
    engine.renderTradeMarkers(mCtx, fs.trades, fs.symbol, bars, start, endIdx + 1, timeTransform, p2y, pr);

    // Price Line + Pulsing Dot
    renderPriceLine(mCtx, bars, p2y, pr, cBW, mainBH, thm);
    const last = bars[bars.length - 1];
    if (last) {
        engine._prevPriceLineY = Math.round(p2y(last.close) * pr);
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

    // Shimmer Bars (history loading ghost preview)
    if (engine.state.historyLoading && start <= 5 && bars.length === 0) {
        const shimmerCount = 12;
        const pulsePhase = (performance.now() % 1500) / 1500;
        const baseAlpha = 0.08 + Math.sin(pulsePhase * Math.PI * 2) * 0.05;
        const shimmerColor = `rgba(41, 98, 255, ${baseAlpha.toFixed(3)})`;
        for (let si = 0; si < shimmerCount; si++) {
            const gx = Math.round(timeTransform.indexToPixel(start - shimmerCount + si) * pr);
            const gw = Math.max(1, Math.floor(bSp * 0.65 * pr));
            const gh = Math.round((0.3 + Math.random() * 0.2) * mainBH);
            const gy = Math.round((mainBH - gh) * 0.4 + Math.random() * mainBH * 0.2);
            mCtx.fillStyle = shimmerColor;
            mCtx.fillRect(gx - Math.floor(gw / 2), gy, gw, gh);
        }
        engine.markDirty();
    }
}

// ─── Volume Rendering ────────────────────────────────────────────

export function renderVolume(
    mCtx, ctx, fs,
    vis, webgl, start, timeTransform,
    pr, bSp, mainHeight, mainBH, thm,
) {
    if (!fs.showVolume || !fs.lod?.volume) return;

    if (webgl?.available) {
        const volDrawFn = () => webgl.drawVolume(vis, {
            pixelRatio: pr, barSpacing: bSp, startIdx: start,
            timeTransform: { indexToPixel: (idx) => timeTransform.indexToPixel(idx) },
            mainH: mainHeight,
        }, thm);
        const cmdBuf = ctx.commandBuffer;
        if (cmdBuf) {
            cmdBuf.push({
                program: webgl.getProgram('volume'),
                blendMode: 0, texture: null, zOrder: 0,
                label: 'volume',
                drawFn: volDrawFn,
            });
        } else {
            volDrawFn();
        }
        return;
    }

    // Canvas2D fallback
    let mV = 0;
    for (const b of vis) if ((b.volume || 0) > mV) mV = b.volume;
    if (mV <= 0) return;

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

// ─── Bar Transforms (Renko/Range/Heikin-Ashi) ────────────────────

export function transformBars(
    fs, engine, bars, vis, chartType,
    start, endIdx, cW, timeTransform,
) {
    let renderBars = vis;
    let renderTimeTransform = timeTransform;
    let renderStart = start;
    const isRenko = chartType === 'renko';
    const isRange = chartType === 'range';
    const isHeikinAshi = chartType === 'heikinashi';
    const needsTransform = isRenko || isRange || isHeikinAshi;

    if (!needsTransform) return { renderBars, renderTimeTransform, renderStart };

    // Check for cached worker result from a previous frame's async dispatch
    const workerBridge = engine._workerBridge;
    const workerCache = engine._dataStageWorkerCache;
    let usedWorkerCache = false;

    if (workerCache
        && workerCache.chartType === chartType
        && workerCache.barCount === bars.length
        && workerCache.bars) {
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

    if (!usedWorkerCache) {
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
    if (workerBridge?.hasDataStageWorker) {
        workerBridge.transformBars({
            bars, chartType, visibleBars: fs.visibleBars,
            startIdx: start, endIdx,
            renkoBrickSize: fs.renkoBrickSize,
            rangeBarSize: fs.rangeBarSize,
        }).then((result: unknown) => {
            if (!result) return;
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
            engine._dataStageWorkerCache = {
                chartType,
                barCount: bars.length,
                bars: reconstructed,
                renderStart: result.renderStart,
                transformMeta: result.transformMeta,
            };
            engine.markDirty();
        }).catch(() => { /* worker timeout — sync fallback already handled */ });
    }

    return { renderBars, renderTimeTransform, renderStart };
}

// ─── Chart Type Renderer Dispatch ────────────────────────────────

export function renderChartType(
    mCtx, ctx, engine, fs,
    renderBars, renderStart, chartType, webgl,
    p2y, pr, bSp, mainBH, mainHeight, cBW,
    renderTimeTransform, yMin, yMax, thm,
) {
    const drawParams = {
        startIdx: renderStart, barSpacing: bSp, priceToY: p2y,
        pixelRatio: pr, bitmapHeight: mainBH, mainH: mainHeight,
        chartWidth: cBW, timeTransform: renderTimeTransform, yMin, yMax,
    };

    let renderedViaWebGL = false;

    if (webgl?.available) {
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
            const baselinePrice = renderBars[0]?.close ?? yMin;
            const baselineY = Math.round(p2y(baselinePrice) * pr);
            const gl = webgl.gl;
            const cH = webgl.canvas.height;

            const baselineDrawFn = () => {
                const areaParams = { ...webglParams, priceToY: p2y };
                gl.enable(gl.SCISSOR_TEST);
                gl.scissor(0, cH - baselineY, webgl.canvas.width, baselineY);
                webgl.drawArea(renderBars, areaParams, '#26A69A', 'rgba(38,166,154,0.12)');
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
        // P1 MEGA-2: Use cached drawFn — only re-lookup when chartType changes
        if (!engine._cachedDrawFn || engine._cachedChartType !== chartType) {
            engine._cachedDrawFn = getChartDrawFunction(chartType);
            engine._cachedChartType = chartType;
        }
        const drawFn = engine._cachedDrawFn;
        if (chartType === 'footprint') {
            const fpAggregator = getAggregator(fs.aggregatorKey || `${fs.symbol}_${fs.timeframe}`);
            drawFn(mCtx, renderBars, drawParams, thm, fpAggregator);
        } else {
            drawFn(mCtx, renderBars, drawParams, thm);
        }
    }
}
