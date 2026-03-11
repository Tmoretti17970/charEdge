// ═══════════════════════════════════════════════════════════════════
// charEdge — WebSocket Constants & Helpers
//
// Sprint 9 #69: Extracted from WebSocketService.ts.
// Standalone mapping functions and protocol constants used by the
// WebSocket multiplexer.
// ═══════════════════════════════════════════════════════════════════

import { isCrypto } from '../../constants.js';

// ─── Connection Status Enum ────────────────────────────────────

export const WS_STATUS = {
    DISCONNECTED: 'disconnected',
    CONNECTING: 'connecting',
    CONNECTED: 'connected',
    RECONNECTING: 'reconnecting',
} as const;

export type WsStatusValue = typeof WS_STATUS[keyof typeof WS_STATUS];

// ─── Timeframe Mapping ─────────────────────────────────────────

/** Maps charEdge timeframe labels to Binance kline interval codes. */
export const TF_MAP: Record<string, string> = {
    '1m': '1m', '3m': '3m', '5m': '5m', '15m': '15m', '30m': '30m',
    '1h': '1h', '2h': '2h', '4h': '4h', '6h': '6h', '8h': '8h',
    '12h': '12h', '1D': '1d', '1d': '1d', '3D': '3d',
    '1W': '1w', '1w': '1w', '1M': '1M',
};

// ─── Heartbeat Config ──────────────────────────────────────────

export const HEARTBEAT_INTERVAL_MS = 30_000;  // Send ping every 30s
export const PONG_TIMEOUT_MS = 5_000;         // Close if no pong within 5s

// ─── Security: Allowed Hosts ───────────────────────────────────

/** P2 1.4: Allowed WebSocket hostnames — reject connections to unknown hosts */
export const ALLOWED_WS_HOSTS = new Set([
    'stream.binance.com',
    'stream.binance.us',
    'data-stream.binance.vision',
    'ws.kraken.com',
    'ws.finnhub.io',
]);

// ─── Symbol Helpers ────────────────────────────────────────────

/** Convert a user-provided symbol to USDT pair format. */
export function toUsdtPair(s: string): string {
    const upperSymbol = (s || '').toUpperCase();
    if (upperSymbol.endsWith('USDT')) return upperSymbol;
    return upperSymbol + 'USDT';
}

/**
 * Build the Binance stream key for a symbol+timeframe pair.
 * @example streamKey('BTC', '1h') → 'btcusdt@kline_1h'
 */
export function streamKey(symbol: string, tf: string): string {
    const sym = toUsdtPair(symbol).toLowerCase();
    const interval = TF_MAP[tf] || '1h';
    return `${sym}@kline_${interval}`;
}

/**
 * Build the Binance trade stream key for a symbol.
 * @example tradeStreamKey('BTC') → 'btcusdt@trade'
 */
export function tradeStreamKey(symbol: string): string {
    return `${toUsdtPair(symbol).toLowerCase()}@trade`;
}

/**
 * Check whether a symbol supports WebSocket streaming.
 * Currently only crypto symbols are supported.
 */
export function isStreamingSupported(symbol: string): boolean {
    return isCrypto(symbol);
}
