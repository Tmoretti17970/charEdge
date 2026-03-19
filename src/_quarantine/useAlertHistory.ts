// ═══════════════════════════════════════════════════════════════════
// charEdge — Alert History Store (Phase C2)
//
// Persists triggered alerts with outcome tracking:
// records trigger price, then tracks price at 5m/15m/1h after.
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Types ──────────────────────────────────────────────────────

export interface AlertHistoryEntry {
    id: string;
    alertId: string;
    symbol: string;
    condition: string;
    targetPrice: number;
    triggerPrice: number;
    triggeredAt: string;
    note: string;
    // Outcome tracking
    priceAt5m: number | null;
    priceAt15m: number | null;
    priceAt1h: number | null;
    outcome5m: number | null;   // % change from trigger
    outcome15m: number | null;
    outcome1h: number | null;
}

interface AlertHistoryState {
    entries: AlertHistoryEntry[];
}

interface AlertHistoryActions {
    pushEntry: (alert: { id: string; symbol: string; condition: string; price: number; note?: string }, triggerPrice: number) => string;
    updateOutcome: (entryId: string, timeframe: '5m' | '15m' | '1h', price: number) => void;
    clear: () => void;
    getBySymbol: (symbol: string) => AlertHistoryEntry[];
}

const MAX_ENTRIES = 200;

// ─── Store ──────────────────────────────────────────────────────

const useAlertHistory = create<AlertHistoryState & AlertHistoryActions>()(
    persist(
        (set, get) => ({
            entries: [],

            pushEntry: (alert, triggerPrice) => {
                const entry: AlertHistoryEntry = {
                    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
                    alertId: alert.id,
                    symbol: alert.symbol,
                    condition: alert.condition,
                    targetPrice: alert.price,
                    triggerPrice,
                    triggeredAt: new Date().toISOString(),
                    note: alert.note || '',
                    priceAt5m: null,
                    priceAt15m: null,
                    priceAt1h: null,
                    outcome5m: null,
                    outcome15m: null,
                    outcome1h: null,
                };
                set((s) => ({
                    entries: [entry, ...s.entries].slice(0, MAX_ENTRIES),
                }));
                return entry.id;
            },

            updateOutcome: (entryId, timeframe, price) => {
                set((s) => ({
                    entries: s.entries.map((e) => {
                        if (e.id !== entryId) return e;
                        const pctChange = e.triggerPrice > 0
                            ? ((price - e.triggerPrice) / e.triggerPrice) * 100
                            : null;
                        switch (timeframe) {
                            case '5m':
                                return { ...e, priceAt5m: price, outcome5m: pctChange };
                            case '15m':
                                return { ...e, priceAt15m: price, outcome15m: pctChange };
                            case '1h':
                                return { ...e, priceAt1h: price, outcome1h: pctChange };
                            default:
                                return e;
                        }
                    }),
                }));
            },

            clear: () => set({ entries: [] }),

            getBySymbol: (symbol) =>
                get().entries.filter((e) => e.symbol.toUpperCase() === symbol.toUpperCase()),
        }),
        { name: 'charEdge-alert-history' },
    ),
);

export { useAlertHistory };
export default useAlertHistory;
