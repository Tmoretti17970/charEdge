// ═══════════════════════════════════════════════════════════════════
// charEdge — Signal Decay (Phase 3)
// Time-based signal aging with opacity decay
// ═══════════════════════════════════════════════════════════════════

import type { SignalMark } from './signalMarks.ts';

export interface DecayedSignal extends SignalMark {
    opacity: number;   // 0-1, faded by age
    age: number;       // bars since signal
}

/**
 * Apply exponential decay to signals based on their age.
 * Older signals fade toward transparency.
 *
 * @param signals    - Array of signal marks
 * @param currentIdx - Current bar index (latest)
 * @param halfLife   - Bars until signal reaches 50% opacity (default 20)
 * @param minOpacity - Minimum opacity before signal is killed (default 0.05)
 * @returns Signals with opacity applied; signals below minOpacity are removed
 */
export function applySignalDecay(
    signals: SignalMark[],
    currentIdx: number,
    halfLife: number = 20,
    minOpacity: number = 0.05,
): DecayedSignal[] {
    const lambda = Math.LN2 / halfLife; // Decay constant

    return signals
        .map(signal => {
            const age = currentIdx - signal.idx;
            if (age < 0) return null;
            const opacity = Math.exp(-lambda * age);
            if (opacity < minOpacity) return null; // Kill fully faded signals

            return { ...signal, opacity, age } as DecayedSignal;
        })
        .filter((s): s is DecayedSignal => s !== null);
}

/**
 * Get the display opacity for a signal based on decay.
 * Useful for renderers to set ctx.globalAlpha.
 */
export function getSignalOpacity(
    signalAge: number,
    halfLife: number = 20,
): number {
    if (signalAge < 0) return 1;
    return Math.exp(-Math.LN2 / halfLife * signalAge);
}
