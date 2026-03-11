// ═══════════════════════════════════════════════════════════════════
// charEdge — Signal Marks (Phase 3)
// Detect and render threshold-cross signal marks on the chart
// ═══════════════════════════════════════════════════════════════════

import type { Bar } from './helpers.ts';

// ─── Types ───────────────────────────────────────────────────────

export interface SignalMark {
    idx: number;
    type: string;
    bias: 'bullish' | 'bearish';
    label: string;
    price: number;  // Y-coordinate value
}

// ─── Detection ───────────────────────────────────────────────────

/**
 * Scan indicator outputs for threshold crosses and generate signal marks.
 */
export function detectSignalMarks(
    indicators: Record<string, unknown>,
    bars: Bar[],
): SignalMark[] {
    const marks: SignalMark[] = [];
    const n = bars.length;
    if (n < 2) return marks;

    // RSI 70/30 crosses
    const rsiVals = indicators.rsi?.rsi || indicators.rsi?.values;
    if (rsiVals && rsiVals.length >= n) {
        for (let i = 1; i < n; i++) {
            const prev = rsiVals[i - 1];
            const curr = rsiVals[i];
            if (isNaN(prev) || isNaN(curr)) continue;

            // RSI crossing DOWN through 70 → bearish
            if (prev >= 70 && curr < 70) {
                marks.push({ idx: i, type: 'rsi_cross_70', bias: 'bearish', label: 'RSI ↓70', price: bars[i]!.high });
            }
            // RSI crossing UP through 30 → bullish
            if (prev <= 30 && curr > 30) {
                marks.push({ idx: i, type: 'rsi_cross_30', bias: 'bullish', label: 'RSI ↑30', price: bars[i]!.low });
            }
        }
    }

    // MACD signal line crosses
    const macdLine = indicators.macd?.macd;
    const signalLine = indicators.macd?.signal;
    if (macdLine && signalLine && macdLine.length >= n) {
        for (let i = 1; i < n; i++) {
            const prevM = macdLine[i - 1];
            const currM = macdLine[i];
            const prevS = signalLine[i - 1];
            const currS = signalLine[i];
            if (isNaN(prevM) || isNaN(currM) || isNaN(prevS) || isNaN(currS)) continue;

            // MACD crossing above signal → bullish
            if (prevM <= prevS && currM > currS) {
                marks.push({ idx: i, type: 'macd_bull_cross', bias: 'bullish', label: 'MACD ↑', price: bars[i]!.low });
            }
            // MACD crossing below signal → bearish
            if (prevM >= prevS && currM < currS) {
                marks.push({ idx: i, type: 'macd_bear_cross', bias: 'bearish', label: 'MACD ↓', price: bars[i]!.high });
            }
        }
    }

    // Stochastic %K/%D crosses
    const stochK = indicators.stochastic?.k || indicators.stochRsi?.k;
    const stochD = indicators.stochastic?.d || indicators.stochRsi?.d;
    if (stochK && stochD && stochK.length >= n) {
        for (let i = 1; i < n; i++) {
            const prevK = stochK[i - 1];
            const currK = stochK[i];
            const prevD = stochD[i - 1];
            const currD = stochD[i];
            if (isNaN(prevK) || isNaN(currK) || isNaN(prevD) || isNaN(currD)) continue;

            if (prevK <= prevD && currK > currD && currK < 30) {
                marks.push({ idx: i, type: 'stoch_bull_cross', bias: 'bullish', label: 'Stoch ↑', price: bars[i]!.low });
            }
            if (prevK >= prevD && currK < currD && currK > 70) {
                marks.push({ idx: i, type: 'stoch_bear_cross', bias: 'bearish', label: 'Stoch ↓', price: bars[i]!.high });
            }
        }
    }

    return marks;
}

// ─── Rendering ───────────────────────────────────────────────────

/**
 * Render signal marks on the chart overlay as diamonds with labels.
 */
export function renderSignalMarks(
    ctx: CanvasRenderingContext2D,
    marks: SignalMark[],
    params: {
        startIdx: number;
        endIdx: number;
        barSpacing: number;
        priceToY: (p: number) => number;
        pixelRatio: number;
        bars: Bar[];
    },
): void {
    const { startIdx, endIdx, barSpacing, priceToY, pixelRatio: pr } = params;
    const size = Math.max(4, Math.min(8, barSpacing * 0.4)) * pr;

    for (const mark of marks) {
        if (mark.idx < startIdx || mark.idx > endIdx) continue;

        const x = Math.round((mark.idx - startIdx + 0.5) * barSpacing * pr);
        const yBase = Math.round(priceToY(mark.price) * pr);
        const isBull = mark.bias === 'bullish';
        const y = isBull ? yBase + size * 2 : yBase - size * 2;

        // Diamond shape
        ctx.beginPath();
        ctx.moveTo(x, y - size);
        ctx.lineTo(x + size, y);
        ctx.lineTo(x, y + size);
        ctx.lineTo(x - size, y);
        ctx.closePath();

        ctx.fillStyle = isBull ? 'rgba(38, 166, 154, 0.85)' : 'rgba(239, 83, 80, 0.85)';
        ctx.fill();

        // Border
        ctx.strokeStyle = isBull ? '#26A69A' : '#EF5350';
        ctx.lineWidth = pr;
        ctx.stroke();

        // Label (only if enough spacing)
        if (barSpacing > 6) {
            const fontSize = Math.round(8 * pr);
            ctx.font = `bold ${fontSize}px Arial`;
            ctx.fillStyle = isBull ? '#26A69A' : '#EF5350';
            ctx.textAlign = 'center';
            ctx.textBaseline = isBull ? 'top' : 'bottom';
            ctx.fillText(mark.label, x, isBull ? y + size + 2 * pr : y - size - 2 * pr);
        }
    }
}
