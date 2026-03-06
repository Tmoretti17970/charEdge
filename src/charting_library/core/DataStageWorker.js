// ═══════════════════════════════════════════════════════════════════
// charEdge — DataStageWorker
//
// Dedicated Web Worker for off-thread bar transforms and coordinate
// pre-computation. Moves CPU-bound work from DataStage.ts off the
// main thread using zero-copy Transferable ArrayBuffers.
//
// Task 2.3.15: DataStage → Web Worker
//
// Message Types (Main → Worker):
//   'transformBars'  — Run bar transforms (Renko/Range/HeikinAshi)
//   'precompute'     — Pre-compute grid ticks and volume max
//   'dispose'        — Clean up
//
// Message Types (Worker → Main):
//   'transformResult' — Transformed bar data
//   'precomputeResult' — Pre-computed values
// ═══════════════════════════════════════════════════════════════════

// ─── Inline bar transforms (worker can't import from main bundle) ──

function autoATR(bars, period = 14) {
    if (!bars || bars.length < period + 1) return 1;
    let atr = 0;
    for (let i = 1; i <= period && i < bars.length; i++) {
        atr += Math.max(
            bars[i].high - bars[i].low,
            Math.abs(bars[i].high - bars[i - 1].close),
            Math.abs(bars[i].low - bars[i - 1].close)
        );
    }
    return atr / period || 1;
}

function toRenkoBricks(bars, brickSize) {
    if (!bars || bars.length === 0) return { bricks: [], brickSize: 0 };
    brickSize = brickSize || autoATR(bars) / 2;
    if (brickSize <= 0) brickSize = 1;

    const bricks = [];
    let basePrice = bars[0].close;
    let lastDir = 0;

    for (const bar of bars) {
        const diff = bar.close - basePrice;
        const absDiff = Math.abs(diff);
        const numBricks = Math.floor(absDiff / brickSize);
        if (numBricks >= 1) {
            const dir = diff > 0 ? 1 : -1;
            for (let n = 0; n < numBricks; n++) {
                const bOpen = basePrice + dir * n * brickSize;
                const bClose = bOpen + dir * brickSize;
                bricks.push({
                    time: bar.time,
                    open: Math.min(bOpen, bClose),
                    high: Math.max(bOpen, bClose),
                    low: Math.min(bOpen, bClose),
                    close: Math.max(bOpen, bClose),
                    volume: bar.volume || 0,
                    _renkoDir: dir,
                });
            }
            basePrice += dir * numBricks * brickSize;
            lastDir = dir;
        }
    }

    return { bricks, brickSize };
}

function toRangeBars(bars, rangeSize) {
    if (!bars || bars.length === 0) return { rangeBars: [], rangeSize: 0 };
    rangeSize = rangeSize || autoATR(bars);
    if (rangeSize <= 0) rangeSize = 1;

    const rangeBars = [];
    let current = {
        time: bars[0].time,
        open: bars[0].open,
        high: bars[0].high,
        low: bars[0].low,
        close: bars[0].close,
        volume: bars[0].volume || 0,
    };

    for (let i = 1; i < bars.length; i++) {
        const bar = bars[i];
        const testHigh = Math.max(current.high, bar.high);
        const testLow = Math.min(current.low, bar.low);

        if (testHigh - testLow >= rangeSize) {
            // Try to break into parts
            let price = current.open;
            const dir = bar.close >= current.open ? 1 : -1;
            let completed = false;

            // Complete current bar
            if (dir > 0) {
                current.high = Math.min(testHigh, current.low + rangeSize);
                current.close = current.high;
            } else {
                current.low = Math.max(testLow, current.high - rangeSize);
                current.close = current.low;
            }
            rangeBars.push({ ...current });

            // Start new bar
            current = {
                time: bar.time,
                open: current.close,
                high: Math.max(current.close, bar.high),
                low: Math.min(current.close, bar.low),
                close: bar.close,
                volume: bar.volume || 0,
            };
        } else {
            current.high = testHigh;
            current.low = testLow;
            current.close = bar.close;
            current.volume += bar.volume || 0;
            current.time = bar.time;
        }
    }
    rangeBars.push(current);

    return { rangeBars, rangeSize };
}

function toHeikinAshi(bars) {
    if (!bars || bars.length === 0) return [];
    const result = new Array(bars.length);

    const first = bars[0];
    const haClose0 = (first.open + first.high + first.low + first.close) / 4;
    const haOpen0 = (first.open + first.close) / 2;
    result[0] = {
        time: first.time,
        open: haOpen0,
        high: Math.max(first.high, haOpen0, haClose0),
        low: Math.min(first.low, haOpen0, haClose0),
        close: haClose0,
        volume: first.volume || 0,
    };

    for (let i = 1; i < bars.length; i++) {
        const bar = bars[i];
        const prev = result[i - 1];
        const haClose = (bar.open + bar.high + bar.low + bar.close) / 4;
        const haOpen = (prev.open + prev.close) / 2;
        result[i] = {
            time: bar.time,
            open: haOpen,
            high: Math.max(bar.high, haOpen, haClose),
            low: Math.min(bar.low, haOpen, haClose),
            close: haClose,
            volume: bar.volume || 0,
        };
    }

    return result;
}

// ─── Nice Scale (grid tick computation) ──────────────────────────

function niceNum(value, round) {
    const exp = Math.floor(Math.log10(value));
    const frac = value / Math.pow(10, exp);
    let nice;
    if (round) {
        if (frac < 1.5) nice = 1;
        else if (frac < 3) nice = 2;
        else if (frac < 7) nice = 5;
        else nice = 10;
    } else {
        if (frac <= 1) nice = 1;
        else if (frac <= 2) nice = 2;
        else if (frac <= 5) nice = 5;
        else nice = 10;
    }
    return nice * Math.pow(10, exp);
}

function niceScale(min, max, maxTicks = 8) {
    if (max <= min) return { min, max, step: 1, ticks: [min] };
    const range = niceNum(max - min, false);
    const step = niceNum(range / (maxTicks - 1), true);
    const niceMin = Math.floor(min / step) * step;
    const niceMax = Math.ceil(max / step) * step;
    const ticks = [];
    for (let t = niceMin; t <= niceMax + step * 0.5; t += step) {
        ticks.push(+t.toFixed(10));
    }
    return { min: niceMin, max: niceMax, step, ticks };
}

// ─── Message Handler ─────────────────────────────────────────────

self.onmessage = function (e) {
    const { type, payload, id } = e.data;

    switch (type) {
        case 'transformBars':
            handleTransformBars(payload, id);
            break;
        case 'precompute':
            handlePrecompute(payload, id);
            break;
        case 'dispose':
            break;
    }
};

function handleTransformBars(payload, id) {
    const { bars, chartType, visibleBars, startIdx, endIdx,
        renkoBrickSize, rangeBarSize } = payload;

    let renderBars;
    let renderStart = startIdx;
    let transformMeta = null;

    if (chartType === 'renko') {
        const { bricks, brickSize } = toRenkoBricks(bars, renkoBrickSize);
        const rEnd = bricks.length;
        const rStart = Math.max(0, rEnd - visibleBars);
        renderBars = bricks.slice(rStart, rEnd);
        renderStart = rStart;
        transformMeta = { type: 'renko', totalBricks: bricks.length, brickSize };
    } else if (chartType === 'range') {
        const { rangeBars, rangeSize } = toRangeBars(bars, rangeBarSize);
        const rEnd = rangeBars.length;
        const rStart = Math.max(0, rEnd - visibleBars);
        renderBars = rangeBars.slice(rStart, rEnd);
        renderStart = rStart;
        transformMeta = { type: 'range', totalRangeBars: rangeBars.length, rangeSize };
    } else if (chartType === 'heikinashi') {
        const haBars = toHeikinAshi(bars);
        renderBars = haBars.slice(startIdx, Math.min(haBars.length, endIdx + 2));
        transformMeta = { type: 'heikinashi' };
    } else {
        // No transform needed — return bars as-is
        renderBars = bars.slice(startIdx, Math.min(bars.length, endIdx + 2));
        transformMeta = { type: 'none' };
    }

    // Pack bar data into typed arrays for zero-copy transfer
    const len = renderBars.length;
    const time = new Float64Array(len);
    const open = new Float64Array(len);
    const high = new Float64Array(len);
    const low = new Float64Array(len);
    const close = new Float64Array(len);
    const volume = new Float64Array(len);

    for (let i = 0; i < len; i++) {
        const b = renderBars[i];
        time[i] = b.time;
        open[i] = b.open;
        high[i] = b.high;
        low[i] = b.low;
        close[i] = b.close;
        volume[i] = b.volume || 0;
    }

    const result = {
        time: time.buffer,
        open: open.buffer,
        high: high.buffer,
        low: low.buffer,
        close: close.buffer,
        volume: volume.buffer,
        length: len,
        renderStart,
        transformMeta,
    };

    self.postMessage(
        { type: 'transformResult', payload: result, id },
        [time.buffer, open.buffer, high.buffer, low.buffer, close.buffer, volume.buffer]
    );
}

function handlePrecompute(payload, id) {
    const { yMin, yMax, mainHeight, bars, showVolume, startIdx, endIdx } = payload;

    // Compute grid ticks
    const maxTicks = Math.floor(mainHeight / 50);
    const gridResult = niceScale(yMin, yMax, maxTicks);

    // Compute max volume for visible range
    let maxVol = 0;
    if (showVolume && bars) {
        const end = Math.min(bars.length, endIdx + 2);
        for (let i = startIdx; i < end; i++) {
            const v = bars[i]?.volume || 0;
            if (v > maxVol) maxVol = v;
        }
    }

    self.postMessage({
        type: 'precomputeResult',
        payload: {
            gridTicks: gridResult.ticks,
            niceStep: gridResult,
            maxVolume: maxVol,
        },
        id,
    });
}
