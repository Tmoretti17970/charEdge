// ═══════════════════════════════════════════════════════════════════
// DataStage — Tick Update Fast Path
// WebGL + Canvas2D fast path for streaming tick updates.
// Skips full clear+redraw when only the last bar's OHLC changed.
// ═══════════════════════════════════════════════════════════════════

import { CHANGED } from '../../FrameState.js';
import { getChartDrawFunction } from '../../../renderers/renderers/ChartTypes.js';
import { renderPriceLine, dotRadius } from './renderHelpers';

/**
 * TICK-UPDATE FAST PATH (WebGL + Canvas2D)
 * Returns true if the fast path was used.
 */
export function handleTickUpdate(
    mCtx, ctx, fs, engine, bars, vis,
    changeMask, chartType, webgl,
    p2y, pr, cBW, mainBH, mainHeight, bSp, thm,
    start, timeTransform,
    yMin, yMax,
) {
    const isTickOnly = (changeMask & CHANGED.TICK) !== 0
        && (changeMask & ~(CHANGED.TICK | CHANGED.ANIMATION | CHANGED.MOUSE)) === 0
        && chartType === 'candlestick'
        && !fs.showHeatmap
        && vis.length > 2;

    if (!isTickOnly) return false;

    // ─── WebGL tick fast path ──────────────────────────────────
    if (webgl?.available) {
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
            return true;
        }
    }

    // ─── Canvas2D tick fast path ───────────────────────────────
    const lastIdx = vis.length - 1;
    const penultIdx = Math.max(0, lastIdx - 1);
    const x1 = Math.round(timeTransform.indexToPixel(start + penultIdx) * pr) - Math.round(bSp * pr);
    const x2 = cBW;
    const clearW = x2 - Math.max(0, x1);

    mCtx.save();
    mCtx.beginPath();
    mCtx.rect(0, 0, cBW, mainBH);
    mCtx.clip();
    mCtx.clearRect(Math.max(0, x1), 0, clearW, mainBH);

    // Clear thin strip around old/new price line Y
    const lastBar = bars[bars.length - 1];
    if (lastBar) {
        const plY = Math.round(p2y(lastBar.close) * pr);
        const plClear = Math.round(dotRadius(pr) * 3);
        mCtx.clearRect(0, plY - plClear, cBW, plClear * 2);
        if (engine._prevPriceLineY != null && engine._prevPriceLineY !== plY) {
            mCtx.clearRect(0, engine._prevPriceLineY - plClear, cBW, plClear * 2);
        }
        engine._prevPriceLineY = plY;
    }

    // Re-draw the last 2 candles (use cached drawFn)
    if (!engine._cachedDrawFn || engine._cachedChartType !== chartType) {
        engine._cachedDrawFn = getChartDrawFunction(chartType);
        engine._cachedChartType = chartType;
    }
    const drawFn = engine._cachedDrawFn;
    const partialBars = vis.slice(penultIdx);
    const drawParams = {
        startIdx: start + penultIdx, barSpacing: bSp, priceToY: p2y,
        pixelRatio: pr, bitmapHeight: mainBH, mainH: mainHeight,
        chartWidth: cBW, timeTransform, yMin, yMax,
    };
    drawFn(mCtx, partialBars, drawParams, thm);

    renderPriceLine(mCtx, bars, p2y, pr, cBW, mainBH, thm);
    mCtx.restore();
    return true;
}
