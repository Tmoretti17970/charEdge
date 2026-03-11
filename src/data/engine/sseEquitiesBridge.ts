// ═══════════════════════════════════════════════════════════════════
// charEdge — SSE Equities Bridge (Phase 6)
// Server-Sent Events client for equities data streaming
//
// Architecture:
//   Server (Express/Fastify) aggregates Finnhub + Alpaca feeds
//   Client receives columnar bar payloads via EventSource
//   Falls back to REST polling if SSE connection drops
// ═══════════════════════════════════════════════════════════════════

import { decodeColumnar, getColumnarBarCount } from './columnarTransport.ts';
import { logger } from '@/observability/logger.ts';

type TickCallback = (data: {
    symbol: string;
    price: number;
    volume: number;
    timestamp: number;
}) => void;

type CandleCallback = (data: {
    symbol: string;
    bars: ReturnType<typeof decodeColumnar>;
}) => void;

type StatusCallback = (status: 'connected' | 'reconnecting' | 'disconnected') => void;

interface SSEConfig {
    url: string;
    reconnectMs?: number;
    maxReconnectMs?: number;
    heartbeatTimeoutMs?: number;
}

const DEFAULT_CONFIG: Required<SSEConfig> = {
    url: '/api/stream/equities',
    reconnectMs: 1000,
    maxReconnectMs: 30000,
    heartbeatTimeoutMs: 45000,
};

/**
 * SSE Equities Bridge — EventSource-based streaming client.
 *
 * Receives two event types from the server:
 *   - `tick`: real-time price updates (JSON)
 *   - `candle`: aggregated bar data (base64-encoded columnar binary)
 *
 * Includes automatic reconnection with exponential backoff.
 */
export class SSEEquitiesBridge {
    private _config: Required<SSEConfig>;
    private _source: EventSource | null = null;
    private _symbols = new Set<string>();
    private _tickListeners = new Set<TickCallback>();
    private _candleListeners = new Set<CandleCallback>();
    private _statusListeners = new Set<StatusCallback>();
    private _reconnectAttempts = 0;
    private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private _heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
    private _connected = false;

    constructor(config: Partial<SSEConfig> = {}) {
        this._config = { ...DEFAULT_CONFIG, ...config };
    }

    /** Subscribe to real-time ticks. */
    onTick(cb: TickCallback): () => void {
        this._tickListeners.add(cb);
        return () => this._tickListeners.delete(cb);
    }

    /** Subscribe to candle (bar) updates. */
    onCandle(cb: CandleCallback): () => void {
        this._candleListeners.add(cb);
        return () => this._candleListeners.delete(cb);
    }

    /** Subscribe to connection status changes. */
    onStatus(cb: StatusCallback): () => void {
        this._statusListeners.add(cb);
        return () => this._statusListeners.delete(cb);
    }

    /** Connect to the SSE stream for the given symbols. */
    connect(symbols: string[]): void {
        symbols.forEach(s => this._symbols.add(s));

        if (this._source) {
            // Already connected — send subscribe message via REST
            this._sendSubscribe(symbols);
            return;
        }

        this._createEventSource();
    }

    /** Remove symbols and optionally disconnect. */
    unsubscribe(symbols: string[]): void {
        symbols.forEach(s => this._symbols.delete(s));
        if (this._symbols.size === 0) {
            this.disconnect();
        }
    }

    /** Disconnect and clean up. */
    disconnect(): void {
        if (this._source) {
            this._source.close();
            this._source = null;
        }
        this._clearTimers();
        this._connected = false;
        this._reconnectAttempts = 0;
        this._emitStatus('disconnected');
    }

    /** Check if currently connected. */
    get isConnected(): boolean {
        return this._connected;
    }

    /** Get currently subscribed symbols. */
    get symbols(): string[] {
        return Array.from(this._symbols);
    }

    // ─── Internals ─────────────────────────────────────────────

    private _createEventSource(): void {
        const params = new URLSearchParams();
        this._symbols.forEach(s => params.append('symbols', s));

        const url = `${this._config.url}?${params.toString()}`;

        try {
            this._source = new EventSource(url);

            this._source.onopen = () => {
                this._connected = true;
                this._reconnectAttempts = 0;
                this._resetHeartbeat();
                this._emitStatus('connected');
                logger.info('[SSE Bridge] Connected', { symbols: this.symbols });
            };

            // Real-time tick events
            this._source.addEventListener('tick', (evt: MessageEvent) => {
                this._resetHeartbeat();
                try {
                    const data = JSON.parse(evt.data);
                    this._tickListeners.forEach(cb => cb(data));
                } catch (err) {
                    logger.warn('[SSE Bridge] Failed to parse tick', { error: err });
                }
            });

            // Candle (bar) events — base64-encoded columnar binary
            this._source.addEventListener('candle', (evt: MessageEvent) => {
                this._resetHeartbeat();
                try {
                    const payload = JSON.parse(evt.data);
                    const binary = Uint8Array.from(atob(payload.data), c => c.charCodeAt(0));
                    const bars = decodeColumnar(binary.buffer);
                    const barCount = getColumnarBarCount(binary.buffer);

                    this._candleListeners.forEach(cb => cb({
                        symbol: payload.symbol,
                        bars,
                    }));

                    logger.debug('[SSE Bridge] Candle received', {
                        symbol: payload.symbol,
                        bars: barCount,
                    });
                } catch (err) {
                    logger.warn('[SSE Bridge] Failed to parse candle', { error: err });
                }
            });

            // Heartbeat events (keep-alive)
            this._source.addEventListener('heartbeat', () => {
                this._resetHeartbeat();
            });

            this._source.onerror = () => {
                this._connected = false;
                this._source?.close();
                this._source = null;
                this._emitStatus('reconnecting');
                this._scheduleReconnect();
            };
        } catch (err) {
            logger.error('[SSE Bridge] Failed to create EventSource', { error: err });
            this._scheduleReconnect();
        }
    }

    private _scheduleReconnect(): void {
        const delay = Math.min(
            this._config.reconnectMs * Math.pow(2, this._reconnectAttempts),
            this._config.maxReconnectMs,
        );

        this._reconnectAttempts++;
        logger.info('[SSE Bridge] Reconnecting', { attempt: this._reconnectAttempts, delay });

        this._reconnectTimer = setTimeout(() => {
            this._createEventSource();
        }, delay);
    }

    private _resetHeartbeat(): void {
        if (this._heartbeatTimer) clearTimeout(this._heartbeatTimer);
        this._heartbeatTimer = setTimeout(() => {
            logger.warn('[SSE Bridge] Heartbeat timeout — reconnecting');
            this._source?.close();
            this._source = null;
            this._connected = false;
            this._emitStatus('reconnecting');
            this._scheduleReconnect();
        }, this._config.heartbeatTimeoutMs);
    }

    private _clearTimers(): void {
        if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
        if (this._heartbeatTimer) clearTimeout(this._heartbeatTimer);
        this._reconnectTimer = null;
        this._heartbeatTimer = null;
    }

    private _emitStatus(status: 'connected' | 'reconnecting' | 'disconnected'): void {
        this._statusListeners.forEach(cb => cb(status));
    }

    private async _sendSubscribe(symbols: string[]): Promise<void> {
        try {
            await fetch(`${this._config.url}/subscribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbols }),
            });
        } catch (err) {
            logger.warn('[SSE Bridge] Subscribe request failed', { error: err });
        }
    }
}

/** Singleton SSE bridge instance. */
export const sseBridge = new SSEEquitiesBridge();
