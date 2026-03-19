// ═══════════════════════════════════════════════════════════════════
// charEdge — Alert Outcome Tracker (Phase E4)
//
// Client-side hook that auto-backfills alert history outcome data.
// Scans entries missing outcomes and fills them at 5m/15m/1h marks
// using the latest price from checkAlerts' price map.
//
// Mount once at the App or ChartsPage level:
//   useAlertOutcomeTracker(priceGetter);
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useRef } from 'react';
import { useAlertStore } from '../state/useAlertStore';

const INTERVALS = [
    { key: '5m' as const, ms: 5 * 60_000 },
    { key: '15m' as const, ms: 15 * 60_000 },
    { key: '1h' as const, ms: 60 * 60_000 },
] as const;

const POLL_INTERVAL = 30_000; // Check every 30 seconds

/**
 * Auto-backfills outcome data for alert history entries.
 *
 * @param getPrice - Function that returns the current price for a symbol.
 *                   Falls back to noop if not provided.
 */
export function useAlertOutcomeTracker(getPrice?: (symbol: string) => number | null): void {
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        const tick = () => {
            const { historyEntries: entries, updateHistoryOutcome: updateOutcome } = useAlertStore.getState();
            const now = Date.now();

            for (const entry of entries) {
                const triggeredMs = new Date(entry.triggeredAt).getTime();
                const elapsed = now - triggeredMs;

                for (const interval of INTERVALS) {
                    // Skip if already filled
                    const priceKey = `priceAt${interval.key.replace('m', 'm').replace('h', 'h')}` as
                        'priceAt5m' | 'priceAt15m' | 'priceAt1h';
                    if (entry[priceKey] != null) continue;

                    // Only fill once the interval has passed
                    if (elapsed >= interval.ms) {
                        const price = getPrice ? getPrice(entry.symbol) : null;
                        if (price != null && price > 0) {
                            updateOutcome(entry.id, interval.key, price);
                        }
                    }
                }
            }
        };

        // Run immediately on mount
        tick();

        // Then poll
        intervalRef.current = setInterval(tick, POLL_INTERVAL);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [getPrice]);
}

export default useAlertOutcomeTracker;
