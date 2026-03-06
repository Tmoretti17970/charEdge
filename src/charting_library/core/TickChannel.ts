// ═══════════════════════════════════════════════════════════════════
// charEdge — TickChannel
//
// Zero-overhead message bus connecting DatafeedService directly to
// ChartEngine instances, bypassing React re-renders entirely.
//
// Tasks 8.1.1 + 8.1.2: Direct channel + rAF message batching.
//
// Usage:
//   import { tickChannel } from './TickChannel.js';
//   const unsub = tickChannel.subscribe('BTCUSDT_1h', engine);
//   // DatafeedService calls:
//   tickChannel.pushTick('BTCUSDT_1h', bars, latestBar);
//   // On unmount:
//   unsub();
// ═══════════════════════════════════════════════════════════════════

import type { Bar } from '../../types/chart.js';

// ─── Type Definitions ────────────────────────────────────────────

/** Minimal engine interface — only what TickChannel calls. */
interface TickReceiver {
    setData(bars: Bar[]): void;
}

/** Pending tick data waiting for the next animation frame. */
interface PendingTick {
    bars: Bar[];
    latestBar: Bar;
}

// ─── TickChannel Class ───────────────────────────────────────────

class _TickChannel {
    /** Engines subscribed per symbol_tf key. */
    private _subscribers: Map<string, Set<TickReceiver>> = new Map();

    /** Pending tick data per key, waiting for rAF flush. */
    private _pending: Map<string, PendingTick> = new Map();

    /** rAF handle, null when no flush is scheduled. */
    private _rafId: number | null = null;

    /** Priority levels per key: 1 = active chart, 0 = background/watchlist (8.1.4). */
    private _priority: Map<string, number> = new Map();

    // ─── Public API ─────────────────────────────────────────────

    /**
     * Subscribe a chart engine to receive ticks for a symbol/tf key.
     * @param key - Subscription key, e.g. 'BTCUSDT_1h'
     * @param engine - Engine with setData() method
     * @returns Unsubscribe function
     */
    subscribe(key: string, engine: TickReceiver): () => void {
        let set = this._subscribers.get(key);
        if (!set) {
            set = new Set();
            this._subscribers.set(key, set);
        }
        set.add(engine);

        return () => {
            const s = this._subscribers.get(key);
            if (s) {
                s.delete(engine);
                if (s.size === 0) this._subscribers.delete(key);
            }
        };
    }

    /**
     * Push a tick update. Coalesces multiple calls per frame via rAF.
     * Only the LATEST bars array for each key is kept — earlier ticks
     * in the same frame are dropped (they're visually irrelevant).
     *
     * @param key - Subscription key, e.g. 'BTCUSDT_1h'
     * @param bars - Full updated bars array
     * @param latestBar - The most recent bar (for consumers that need it)
     */
    pushTick(key: string, bars: Bar[], latestBar: Bar): void {
        // Task 2.3.34: Mark tick arrival for latency measurement
        performance.mark('tick-in');
        this._pending.set(key, { bars, latestBar });
        if (this._rafId === null) {
            this._rafId = requestAnimationFrame(() => this._flush());
        }
    }

    /**
     * Push historical data. Delivered IMMEDIATELY (no batching) because
     * the initial data load should not be delayed by a frame.
     *
     * @param key - Subscription key
     * @param bars - Full historical bars array
     */
    pushHistorical(key: string, bars: Bar[]): void {
        const engines = this._subscribers.get(key);
        if (!engines) return;
        for (const engine of engines) {
            engine.setData(bars);
        }
    }

    /**
     * Check if any engines are subscribed to a key.
     */
    hasSubscribers(key: string): boolean {
        const s = this._subscribers.get(key);
        return !!s && s.size > 0;
    }

    /**
     * Set priority level for a key (8.1.4).
     * @param key - Subscription key
     * @param level - 1 = active (processed first), 0 = background
     */
    setPriority(key: string, level: number): void {
        this._priority.set(key, level);
    }

    /**
     * Dispose all subscriptions and cancel pending flush.
     */
    dispose(): void {
        if (this._rafId !== null) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
        this._pending.clear();
        this._subscribers.clear();
        this._priority.clear();
    }

    // ─── Private Methods ────────────────────────────────────────

    /**
     * Flush all pending ticks to subscribed engines.
     * Called once per animation frame after the first pushTick().
     * 8.1.4: Processes high-priority keys first (active chart > watchlist).
     */
    private _flush(): void {
        this._rafId = null;

        // Sort keys by priority: 1 (active) before 0 (background)
        const keys = [...this._pending.keys()].sort((a, b) => {
            const pa = this._priority.get(a) ?? 0;
            const pb = this._priority.get(b) ?? 0;
            return pb - pa; // Higher priority first
        });

        for (const key of keys) {
            const pending = this._pending.get(key);
            if (!pending) continue;
            const engines = this._subscribers.get(key);
            if (!engines) continue;
            for (const engine of engines) {
                engine.setData(pending.bars);
            }
        }

        this._pending.clear();

        // Task 2.3.34: Measure tick-to-render latency
        try {
            performance.measure('tick-to-render', 'tick-in');
            performance.clearMarks('tick-in');
            performance.clearMeasures('tick-to-render');
        } catch { /* no matching mark — ignore */ }
    }
}

// ─── Singleton Export ────────────────────────────────────────────

export const tickChannel = new _TickChannel();
export type { TickReceiver };
