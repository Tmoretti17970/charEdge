// ═══════════════════════════════════════════════════════════════════
// charEdge — Test Data Factories
//
// Reusable factory functions that produce realistic test objects
// with sensible defaults. Override any field as needed.
//
// Usage:
//   import { createTrade, createCandle, createUser } from './factories.ts';
//   const trade = createTrade({ symbol: 'ETHUSDT', pnl: -500 });
// ═══════════════════════════════════════════════════════════════════

let _seq = 0;
function seq(): number { return ++_seq; }

// ─── Trade Factory ──────────────────────────────────────────────

export interface TradeInput {
    symbol?: string;
    side?: 'long' | 'short';
    entryPrice?: number;
    exitPrice?: number | null;
    entryDate?: string;
    exitDate?: string | null;
    size?: number;
    pnl?: number | null;
    notes?: string;
    tags?: string[];
    setup?: string;
    fees?: number;
    strategy?: string;
    emotion?: string;
}

export function createTrade(overrides: TradeInput = {}) {
    const n = seq();
    const entryPrice = overrides.entryPrice ?? 42000 + n;
    const exitPrice = overrides.exitPrice !== undefined ? overrides.exitPrice : entryPrice + 100;
    const pnl = overrides.pnl !== undefined ? overrides.pnl : (exitPrice ? exitPrice - entryPrice : null);

    return {
        symbol: overrides.symbol ?? 'BTCUSDT',
        side: overrides.side ?? 'long',
        entryPrice,
        exitPrice,
        entryDate: overrides.entryDate ?? `2024-01-${String(15 + (n % 15)).padStart(2, '0')}T09:00:00Z`,
        exitDate: overrides.exitDate !== undefined ? overrides.exitDate : `2024-01-${String(15 + (n % 15)).padStart(2, '0')}T15:00:00Z`,
        size: overrides.size ?? 1,
        pnl,
        notes: overrides.notes ?? `Trade #${n} notes`,
        tags: overrides.tags ?? ['test'],
        setup: overrides.setup ?? 'breakout',
        fees: overrides.fees ?? 0,
        strategy: overrides.strategy ?? 'momentum',
        emotion: overrides.emotion ?? 'neutral',
    };
}

// ─── Candle Factory ─────────────────────────────────────────────

export interface CandleInput {
    time?: number;
    open?: number;
    high?: number;
    low?: number;
    close?: number;
    volume?: number;
}

export function createCandle(overrides: CandleInput = {}) {
    const n = seq();
    const base = 42000 + n * 10;

    return {
        time: overrides.time ?? 1704067200 + n * 60, // 2024-01-01 + n minutes
        open: overrides.open ?? base,
        high: overrides.high ?? base + 50,
        low: overrides.low ?? base - 30,
        close: overrides.close ?? base + 20,
        volume: overrides.volume ?? 100 + n * 10,
    };
}

/**
 * Generate a series of candles for testing chart rendering.
 */
export function createCandleSeries(count: number, startTime?: number): ReturnType<typeof createCandle>[] {
    const candles = [];
    for (let i = 0; i < count; i++) {
        candles.push(createCandle({
            time: (startTime ?? 1704067200) + i * 60,
        }));
    }
    return candles;
}

// ─── User Factory ───────────────────────────────────────────────

export interface UserInput {
    id?: string;
    email?: string;
    role?: 'free' | 'trader' | 'pro' | 'admin';
    displayName?: string;
    password?: string;
}

export function createUser(overrides: UserInput = {}) {
    const n = seq();
    return {
        id: overrides.id ?? `user_${n}`,
        email: overrides.email ?? `test${n}@charEdge.dev`,
        role: overrides.role ?? 'free',
        displayName: overrides.displayName ?? `Test User ${n}`,
        password: overrides.password ?? `SecureP@ss${n}!`,
    };
}

// ─── Settings Factory ───────────────────────────────────────────

export function createSettings(overrides: Record<string, unknown> = {}) {
    return {
        theme: 'dark',
        chartType: 'candles',
        defaultTimeframe: '1h',
        ...overrides,
    };
}

// ─── Webhook Factory ────────────────────────────────────────────

export function createWebhook(overrides: Record<string, unknown> = {}) {
    const n = seq();
    return {
        url: `https://hooks.example.com/webhook-${n}`,
        events: ['trade.created', 'trade.updated'],
        active: true,
        ...overrides,
    };
}

// ─── Reset (for test isolation) ─────────────────────────────────

export function resetFactories(): void {
    _seq = 0;
}
