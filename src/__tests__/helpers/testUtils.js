// ═══════════════════════════════════════════════════════════════════
// charEdge — Test Utilities
//
// Shared helpers for component render tests:
//   - resetAllStores()  — reset Zustand stores to initial state
//   - createMockTrade() — generate trade fixture data
//   - createMockAnalytics() — generate analytics result fixture
// ═══════════════════════════════════════════════════════════════════

import { vi } from 'vitest';

// ─── Store Reset ────────────────────────────────────────────────
// Zustand stores cache their initial state on first `create()`.
// We snapshot each store's state at import time, then restore it
// in beforeEach. This avoids test cross-contamination.

const storeRegistry = [];

/**
 * Register a Zustand store for automatic reset.
 * Call once per store at module scope.
 *
 * @param {object} store - Zustand store (with getState/setState)
 */
export function registerStore(store) {
    const initial = { ...store.getState() };
    // Strip functions — we only want to reset data
    const dataKeys = Object.keys(initial).filter(
        (k) => typeof initial[k] !== 'function',
    );
    const snapshot = {};
    for (const k of dataKeys) {
        snapshot[k] = initial[k];
    }
    storeRegistry.push({ store, snapshot });
}

/**
 * Reset all registered stores to their initial state.
 * Call in beforeEach().
 */
export function resetAllStores() {
    for (const { store, snapshot } of storeRegistry) {
        store.setState({ ...snapshot }, true);
    }
}

// ─── Auto-register common stores ────────────────────────────────
// Lazy-loaded to avoid circular deps. Import this module and call
// initStores() once before your test suite.

let storesInitialized = false;

export async function initStores() {
    if (storesInitialized) return;
    storesInitialized = true;

    const { useJournalStore } = await import('../../state/useJournalStore.js');
    const { useUserStore } = await import('../../state/useUserStore.ts');
    const { useUIStore } = await import('../../state/useUIStore.ts');
    const { useAnalyticsStore } = await import('../../state/useAnalyticsStore.js');

    registerStore(useJournalStore);
    registerStore(useUserStore);
    registerStore(useUIStore);
    registerStore(useAnalyticsStore);
}

// ─── Mock Trade Factory ─────────────────────────────────────────

let _tradeId = 0;

/**
 * Create a mock trade object with sensible defaults.
 * Every call produces a unique ID.
 *
 * @param {object} [overrides] - Fields to override
 * @returns {object} Trade object
 */
export function createMockTrade(overrides = {}) {
    _tradeId++;
    const id = `test-trade-${_tradeId}`;
    const entry = 100 + Math.random() * 50;
    const exit = entry + (Math.random() - 0.4) * 20;
    const side = exit > entry ? 'long' : 'short';
    const pnl = side === 'long' ? exit - entry : entry - exit;

    return {
        id,
        symbol: 'BTC',
        side,
        entry: +entry.toFixed(2),
        exit: +exit.toFixed(2),
        qty: 1,
        pnl: +pnl.toFixed(2),
        fees: 0.5,
        date: new Date(Date.now() - _tradeId * 86400000).toISOString(),
        playbook: 'Breakout',
        emotion: 'calm',
        rating: 3,
        ruleBreak: false,
        notes: '',
        assetClass: 'crypto',
        ...overrides,
    };
}

/**
 * Create N mock trades.
 * @param {number} n
 * @param {object} [overrides] - Applied to every trade
 * @returns {object[]}
 */
export function createMockTrades(n, overrides = {}) {
    return Array.from({ length: n }, () => createMockTrade(overrides));
}

// ─── Mock Analytics Result ──────────────────────────────────────

/**
 * Create a mock analytics result matching computeFast() shape.
 *
 * @param {object} [overrides]
 * @returns {object}
 */
export function createMockAnalytics(overrides = {}) {
    return {
        totalTrades: 10,
        totalPnl: 250.5,
        winRate: 0.6,
        avgWin: 75.2,
        avgLoss: -42.3,
        profitFactor: 1.78,
        bestTrade: 180.0,
        worstTrade: -95.0,
        avgHoldTime: 3600000,
        maxConsecutiveWins: 4,
        maxConsecutiveLosses: 2,
        expectancy: 25.05,
        sharpeRatio: 1.2,
        maxDrawdown: -120.0,
        totalFees: 5.0,
        rMultipleAvg: 1.5,
        byDay: {},
        bySession: {},
        byPlaybook: {},
        bySymbol: {},
        equityCurve: [],
        ...overrides,
    };
}

// ─── Reset trade ID counter (for deterministic tests) ───────────
export function resetTradeIdCounter() {
    _tradeId = 0;
}
