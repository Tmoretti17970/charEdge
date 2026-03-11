// ═══════════════════════════════════════════════════════════════════
// DataStage — GPU Pan Fast Path
// When only the scroll position changed and WebGL has previous frame
// data, shift candles via a single u_panOffset uniform update.
// ═══════════════════════════════════════════════════════════════════

import { CHANGED } from '../../FrameState.js';
import { renderPriceLine } from './renderHelpers';

/**
 * GPU PAN FAST PATH
 * Returns true if the fast path was used.
 */
export function handleGPUPan(
    mCtx, ctx, fs, engine,
    changeMask, chartType, webgl, prevFs,
    bars, p2y, pr, cBW, mainBH, bSp, thm,
    yMin, yMax,
) {
    if (!webgl?.available || !prevFs) return false;

    const isGpuPanCandidate =
        (changeMask & CHANGED.VIEWPORT) !== 0
        && (changeMask & ~(CHANGED.VIEWPORT | CHANGED.MOUSE | CHANGED.TICK)) === 0
        && chartType === 'candlestick'
        && !fs.showHeatmap
        && fs.visibleBars === prevFs.visibleBars
        && fs.bitmapWidth === prevFs.bitmapWidth
        && fs.bitmapHeight === prevFs.bitmapHeight
        && fs.barCount === prevFs.barCount
        && fs.startIdx === prevFs.startIdx
        && fs.endIdx === prevFs.endIdx;

    if (!isGpuPanCandidate) return false;

    const scrollDelta = fs.scrollOffset - prevFs.scrollOffset;
    const panOffsetPx = scrollDelta * bSp * fs.pixelRatio;

    if (Math.abs(scrollDelta) >= fs.visibleBars * 0.8 || !webgl._lastCandleInstanceCount) {
        return false;
    }

    const cmdBuf = ctx.commandBuffer;
    const capturedYMin = yMin;
    const capturedYMax = yMax;
    const capturedPanOffset = panOffsetPx;
    if (cmdBuf) {
        cmdBuf.push({
            program: webgl.getProgram('candle'),
            blendMode: 0, texture: null, zOrder: 1,
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
    return true;
}
