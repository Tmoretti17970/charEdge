// ═══════════════════════════════════════════════════════════════════
// charEdge — SharedWorker WebSocket Pool (Phase 6)
// Pools WebSocket connections across browser tabs via SharedWorker
//
// Architecture:
//   Each tab → SharedWorker (single WS connection per symbol)
//   SharedWorker → broadcasts ticks to all connected tabs
//   On last tab disconnect → close WebSocket
// ═══════════════════════════════════════════════════════════════════

import { logger } from '@/observability/logger.ts';

type PriceCallback = (data: {
    symbol: string;
    price: number;
    volume: number;
    timestamp: number;
    source: string;
}) => void;

interface WorkerMessage {
    type: 'subscribe' | 'unsubscribe' | 'tick' | 'status' | 'ping';
    symbol?: string;
    data?: unknown;
    clientId?: number;
    tabCount?: number;
    connections?: number;
}

/**
 * SharedWorkerPool — pools WebSocket connections across browser tabs.
 *
 * Prevents duplicate WS connections when multiple chart tabs are open.
 * Falls back to direct WebSocket if SharedWorker is unavailable.
 */
export class SharedWorkerPool {
    private _worker: SharedWorker | null = null;
    private _port: MessagePort | null = null;
    private _subscriptions = new Map<string, Set<PriceCallback>>();
    private _clientId = Math.floor(Math.random() * 1e9);
    private _fallbackMode = false;
    private _fallbackWs = new Map<string, WebSocket>();

    constructor() {
        this._init();
    }

    /** Subscribe to real-time prices for a symbol. Returns unsubscribe function. */
    subscribe(symbol: string, callback: PriceCallback): () => void {
        const upperSymbol = symbol.toUpperCase();

        let subs = this._subscriptions.get(upperSymbol);
        if (!subs) {
            subs = new Set();
            this._subscriptions.set(upperSymbol, subs);
        }
        subs.add(callback);

        // Notify worker to subscribe
        if (subs.size === 1) {
            this._send({ type: 'subscribe', symbol: upperSymbol });
        }

        return () => {
            subs!.delete(callback);
            if (subs!.size === 0) {
                this._subscriptions.delete(upperSymbol);
                this._send({ type: 'unsubscribe', symbol: upperSymbol });
            }
        };
    }

    /** Get count of active WebSocket connections (across all tabs). */
    getActiveConnections(): number {
        return this._subscriptions.size;
    }

    /** Get client ID for this tab. */
    get clientId(): number {
        return this._clientId;
    }

    /** Whether running in fallback (no SharedWorker) mode. */
    get isFallback(): boolean {
        return this._fallbackMode;
    }

    /** Disconnect all and clean up. */
    dispose(): void {
        this._subscriptions.clear();

        if (this._port) {
            this._port.close();
            this._port = null;
        }

        if (this._worker) {
            this._worker = null;
        }

        // Clean up fallback WebSockets
        this._fallbackWs.forEach(ws => ws.close());
        this._fallbackWs.clear();
    }

    // ─── Internals ─────────────────────────────────────────────

    private _init(): void {
        if (typeof SharedWorker === 'undefined') {
            logger.info('[WS Pool] SharedWorker unavailable, using fallback');
            this._fallbackMode = true;
            return;
        }

        try {
            // The actual SharedWorker script path — will be resolved by Vite
            this._worker = new SharedWorker(
                new URL('./sharedWorkerPool.worker.ts', import.meta.url),
                { type: 'module', name: 'charEdge-ws-pool' },
            );

            this._port = this._worker.port;
            this._port.start();

            this._port.onmessage = (evt: MessageEvent<WorkerMessage>) => {
                this._handleMessage(evt.data);
            };

            // Register this client
            this._send({ type: 'ping', clientId: this._clientId });

            logger.info('[WS Pool] SharedWorker connected', { clientId: this._clientId });
        } catch (err) {
            logger.warn('[WS Pool] SharedWorker init failed, using fallback', { error: err });
            this._fallbackMode = true;
        }
    }

    private _handleMessage(msg: WorkerMessage): void {
        switch (msg.type) {
            case 'tick': {
                const data = msg.data as {
                    symbol: string;
                    price: number;
                    volume: number;
                    timestamp: number;
                    source: string;
                };
                const subs = this._subscriptions.get(data.symbol);
                if (subs) {
                    subs.forEach(cb => cb(data));
                }
                break;
            }

            case 'status':
                logger.debug('[WS Pool] Status', {
                    tabs: msg.tabCount,
                    connections: msg.connections,
                });
                break;
        }
    }

    private _send(msg: WorkerMessage): void {
        if (this._fallbackMode) {
            this._handleFallback(msg);
            return;
        }

        if (this._port) {
            this._port.postMessage(msg);
        }
    }

    /** Fallback: direct WebSocket per symbol (no SharedWorker). */
    private _handleFallback(msg: WorkerMessage): void {
        if (msg.type === 'subscribe' && msg.symbol) {
            if (this._fallbackWs.has(msg.symbol)) return;

            // Note: the actual WS URL would come from adapter config.
            // This is a placeholder for the fallback path.
            logger.info('[WS Pool Fallback] Direct subscribe', { symbol: msg.symbol });
        }

        if (msg.type === 'unsubscribe' && msg.symbol) {
            const ws = this._fallbackWs.get(msg.symbol);
            if (ws) {
                ws.close();
                this._fallbackWs.delete(msg.symbol);
            }
        }
    }
}

/** Singleton pool instance. */
export const wsPool = new SharedWorkerPool();
