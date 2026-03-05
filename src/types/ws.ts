// ═══════════════════════════════════════════════════════════════════
// charEdge — WebSocket Message Types
//
// Phase 2 Task 2.1.4: Type ALL WebSocket message shapes.
// Every message flowing through WS connections must conform to these.
// ═══════════════════════════════════════════════════════════════════

import type { Bar } from './data.js';

// ─── Common ──────────────────────────────────────────────────────

export type WSConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error';

export interface WSMessage<T extends string = string, P = unknown> {
    type: T;
    payload: P;
    timestamp: number;
}

// ─── Binance-style Messages ──────────────────────────────────────

/** Real-time trade (aggTrade stream) */
export interface WSTrade {
    symbol: string;
    price: number;
    quantity: number;
    time: number;
    isBuyerMaker: boolean;
    tradeId: number;
}

/** Real-time kline/candle update */
export interface WSKline {
    symbol: string;
    interval: string;
    bar: Bar;
    isClosed: boolean;
}

/** Order book depth update */
export interface WSDepthUpdate {
    symbol: string;
    bids: Array<[number, number]>; // [price, quantity]
    asks: Array<[number, number]>;
    lastUpdateId: number;
}

/** Ticker/mini-ticker */
export interface WSTicker {
    symbol: string;
    price: number;
    priceChange: number;
    priceChangePercent: number;
    high: number;
    low: number;
    volume: number;
    quoteVolume: number;
}

// ─── Internal Messages ───────────────────────────────────────────

/** Subscription request (client → worker) */
export interface WSSubscribe {
    action: 'subscribe' | 'unsubscribe';
    channel: string;
    symbol: string;
    params?: Record<string, string>;
}

/** Connection status (worker → client) */
export interface WSStatus {
    state: WSConnectionState;
    reconnectAttempt?: number;
    latencyMs?: number;
    error?: string;
}

/** Data quality report from CircuitBreaker */
export interface WSDataQuality {
    state: 'healthy' | 'degraded' | 'broken';
    consecutiveFailures: number;
    lastValidTimestamp: number;
    errorRate: number;
}

// ─── Discriminated Union ─────────────────────────────────────────

export type WSInboundMessage =
    | WSMessage<'trade', WSTrade>
    | WSMessage<'kline', WSKline>
    | WSMessage<'depth', WSDepthUpdate>
    | WSMessage<'ticker', WSTicker>
    | WSMessage<'status', WSStatus>
    | WSMessage<'dataQuality', WSDataQuality>;

export type WSOutboundMessage =
    | WSMessage<'subscribe', WSSubscribe>
    | WSMessage<'unsubscribe', WSSubscribe>
    | WSMessage<'ping', null>;
