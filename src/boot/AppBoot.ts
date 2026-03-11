// ═══════════════════════════════════════════════════════════════════
// charEdge — Progressive Boot (AppBoot)
//
// Orchestrates the application startup sequence:
//   1. Show skeleton UI immediately (inline, no JS required)
//   2. Stream-hydrate critical data from IndexedDB
//   3. Begin fetching real-time data once skeleton is visible
//   4. Replace skeleton with live chart on data arrival
//
// Usage:
//   import { AppBoot } from './AppBoot';
//   const boot = new AppBoot();
//   boot.start(onReady);
// ═══════════════════════════════════════════════════════════════════

import { openUnifiedDB } from '../data/UnifiedDB.js';
import { tradeWAL } from '../data/TradeWAL';
import { logger } from '@/observability/logger';

/** Boot phase tracking for performance metrics. */
interface BootPhase {
    name: string;
    startTime: number;
    endTime?: number;
}

/** Data loaded from IDB during hydration. */
export interface HydratedData {
    settings: Record<string, unknown> | null;
    trades: unknown[];
    drawings: unknown[];
    lastSymbol: string | null;
    lastTimeframe: string | null;
}

export class AppBoot {
    private _phases: BootPhase[] = [];
    private _startTime = 0;

    /**
     * Start the progressive boot sequence.
     * Returns hydrated data from IDB that the app can use to render
     * the initial state without waiting for network requests.
     */
    async start(): Promise<HydratedData> {
        this._startTime = performance.now();

        // Phase 1: Show skeleton (already rendered by HTML/CSS — no JS needed)
        this._beginPhase('skeleton');
        this._endPhase('skeleton'); // Instant — skeleton is in the HTML

        // Phase 2: Stream-hydrate IDB data
        this._beginPhase('idb-hydrate');
        const hydrated = await this._hydrateFromIDB();
        this._endPhase('idb-hydrate');

        // Phase 3: Initialize trade WAL
        this._beginPhase('wal-init');
        try {
            await tradeWAL.init();
        } catch (err) {
            logger.boot.warn('[AppBoot] WAL init failed (non-fatal):', err);
        }
        this._endPhase('wal-init');

        // Log boot metrics
        const totalMs = performance.now() - this._startTime;
        logger.boot.info(`[AppBoot] Ready in ${totalMs.toFixed(1)}ms`, {
            phases: this._phases.map(p => ({
                name: p.name,
                ms: ((p.endTime || 0) - p.startTime).toFixed(1),
            })),
        });

        return hydrated;
    }

    /**
     * Inject or update the skeleton UI in the DOM.
     * This is called before React renders for an instant visual.
     */
    static injectSkeleton(container: HTMLElement): void {
        // Only inject if not already present
        if (container.querySelector('.boot-skeleton')) return;

        const skeleton = document.createElement('div');
        skeleton.className = 'boot-skeleton';
        skeleton.setAttribute('aria-label', 'Loading charEdge...');
        skeleton.innerHTML = `
      <div class="boot-skeleton__header">
        <div class="boot-skeleton__bar" style="width:120px;height:24px"></div>
        <div class="boot-skeleton__bar" style="width:200px;height:16px;margin-left:auto"></div>
      </div>
      <div class="boot-skeleton__chart">
        <div class="boot-skeleton__candles">
          ${Array.from({ length: 40 }, (_, i) => {
            const h = 30 + Math.random() * 60;
            return `<div class="boot-skeleton__candle" style="height:${h}%;left:${i * 2.5}%"></div>`;
        }).join('')}
        </div>
      </div>
      <div class="boot-skeleton__footer">
        <div class="boot-skeleton__bar" style="width:80px;height:14px"></div>
        <div class="boot-skeleton__bar" style="width:160px;height:14px"></div>
      </div>
    `;
        container.prepend(skeleton);
    }

    /**
     * Remove the skeleton UI once the real chart is ready.
     */
    static removeSkeleton(container: HTMLElement): void {
        const skeleton = container.querySelector('.boot-skeleton');
        if (skeleton) {
            skeleton.classList.add('boot-skeleton--fade-out');
            setTimeout(() => skeleton.remove(), 300);
        }
    }

    // ─── Private helpers ──────────────────────────────────────────

    private async _hydrateFromIDB(): Promise<HydratedData> {
        const result: HydratedData = {
            settings: null,
            trades: [],
            drawings: [],
            lastSymbol: null,
            lastTimeframe: null,
        };

        try {
            const db = await openUnifiedDB();

            // Load settings (symbol, timeframe, theme, etc.)
            try {
                const settingsTx = db.transaction('settings', 'readonly');
                const settingsStore = settingsTx.objectStore('settings');

                const [symbolRec, tfRec] = await Promise.all([
                    this._idbGet(settingsStore, 'lastSymbol'),
                    this._idbGet(settingsStore, 'lastTimeframe'),
                ]);

                result.lastSymbol = symbolRec?.value ?? null;
                result.lastTimeframe = tfRec?.value ?? null;
            } catch {
                // Settings unavailable — use defaults
            }

            // Load recent trades (last 50 for journal sidebar)
            try {
                const tradesTx = db.transaction('trades', 'readonly');
                const tradesStore = tradesTx.objectStore('trades');
                const allTrades = await this._idbGetAll(tradesStore);
                // Sort by date descending, take last 50
                result.trades = allTrades
                    .sort((a: unknown, b: unknown) => (b.date || 0) - (a.date || 0))
                    .slice(0, 50);
            } catch {
                // Trades unavailable
            }

            // Load drawings for last symbol
            if (result.lastSymbol) {
                try {
                    const drawingsTx = db.transaction('drawings', 'readonly');
                    const drawingsStore = drawingsTx.objectStore('drawings');
                    const drawingRec = await this._idbGet(drawingsStore, `${result.lastSymbol}_${result.lastTimeframe || '1h'}`);
                    result.drawings = drawingRec?.value || [];
                } catch {
                    // Drawings unavailable
                }
            }
        } catch (err) {
            logger.boot.warn('[AppBoot] IDB hydration failed (non-fatal):', err);
        }

        return result;
    }

    private _idbGet(store: IDBObjectStore, key: string): Promise<unknown> {
        return new Promise((resolve) => {
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
        });
    }

    private _idbGetAll(store: IDBObjectStore): Promise<unknown[]> {
        return new Promise((resolve) => {
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
        });
    }

    private _beginPhase(name: string): void {
        this._phases.push({ name, startTime: performance.now() });
    }

    private _endPhase(name: string): void {
        const phase = this._phases.find(p => p.name === name && !p.endTime);
        if (phase) phase.endTime = performance.now();
    }
}
