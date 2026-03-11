// ═══════════════════════════════════════════════════════════════════
// charEdge — Confluence Filter (Phase 3)
// Multi-timeframe signal agreement filter
// ═══════════════════════════════════════════════════════════════════

import type { SignalMark } from './signalMarks.ts';

/**
 * Filter signals by requiring agreement with higher timeframe signals.
 *
 * @param signals       - Current TF signals
 * @param higherTfSignals - Higher TF signals for confirmation
 * @param agreement     - 'strict' requires same bias, 'relaxed' allows neutral
 * @returns Filtered signals that have higher-TF confirmation
 */
export function confluenceFilter(
    signals: SignalMark[],
    higherTfSignals: SignalMark[],
    agreement: 'strict' | 'relaxed' = 'relaxed',
): SignalMark[] {
    if (!higherTfSignals || higherTfSignals.length === 0) return signals;

    // Build a bias map from higher TF signals: idx → dominant bias
    const htfBias = new Map<number, 'bullish' | 'bearish'>();
    for (const s of higherTfSignals) {
        htfBias.set(s.idx, s.bias);
    }

    // Find the nearest HTF signal for each signal
    const htfIdxs = Array.from(htfBias.keys()).sort((a, b) => a - b);

    return signals.filter(signal => {
        // Find nearest HTF signal
        let nearest: number | null = null;
        let nearestDist = Infinity;
        for (const idx of htfIdxs) {
            const dist = Math.abs(signal.idx - idx);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearest = idx;
            }
        }

        if (nearest === null || nearestDist > 20) {
            // No nearby HTF signal — keep in relaxed mode, filter in strict
            return agreement === 'relaxed';
        }

        const htfSignalBias = htfBias.get(nearest)!;

        if (agreement === 'strict') {
            return signal.bias === htfSignalBias;
        }
        // Relaxed: allow if not opposing
        return signal.bias === htfSignalBias;
    });
}
