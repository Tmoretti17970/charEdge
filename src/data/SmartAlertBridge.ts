// ═══════════════════════════════════════════════════════════════════
// charEdge — Smart Alert Bridge (Phase F2)
//
// Client-side singleton that taps the Binance WebSocket kline stream
// and feeds closed bars into the smart alert detectors:
//   - VolumeSpikeDetector  → 'volume' events
//   - CandlePatternDetector → 'pattern' events
//   - MultiTimeframeEvaluator → MTF condition checks
//
// Also feeds bar close prices into checkAlerts() for live price alerts
// and pushes detected events to useSmartAlertFeed for the UI.
// ═══════════════════════════════════════════════════════════════════

import { wsService, WebSocketService } from './WebSocketService';
import { VolumeSpikeDetector } from '../../server/services/VolumeSpikeDetector';
import { CandlePatternDetector } from '../../server/services/CandlePatternDetector';
import { MultiTimeframeEvaluator } from '../../server/services/MultiTimeframeEvaluator';
import { checkAlerts } from '../state/useAlertStore';
import { useSmartAlertFeed } from '../state/useSmartAlertFeed';

import type { Bar } from '../../server/services/VolumeSpikeDetector';
import type { PatternMatch } from '../../server/services/CandlePatternDetector';

// ─── Per-symbol bar buffer for pattern detection ────────────────

const MAX_PATTERN_BARS = 50;

// ─── Bridge Class ───────────────────────────────────────────────

class SmartAlertBridge {
    private volumeDetector: VolumeSpikeDetector;
    private patternDetector: CandlePatternDetector;
    private mtfEvaluator: MultiTimeframeEvaluator;

    private subscriptions: Map<string, number> = new Map(); // symbol → subId
    private barBuffers: Map<string, Bar[]> = new Map();     // symbol → last N bars
    private running = false;

    constructor() {
        this.volumeDetector = new VolumeSpikeDetector(20, 2.0);
        this.patternDetector = new CandlePatternDetector();
        this.mtfEvaluator = new MultiTimeframeEvaluator();

        // Wire volume spike events → SmartAlertFeed
        this.volumeDetector.on('volume:spike', (spike: { symbol: string; ratio: number; avgVolume: number; currentVolume: number }) => {
            useSmartAlertFeed.getState().pushEvent({
                type: 'volume',
                symbol: spike.symbol,
                priority: spike.ratio >= 3 ? 'critical' : 'important',
                message: `Volume ${spike.ratio}x average — ${spike.currentVolume.toLocaleString()} vs avg ${spike.avgVolume.toLocaleString()}`,
                outcome: null,
            });
        });

        // Wire MTF triggers → SmartAlertFeed
        this.mtfEvaluator.on('mtf:triggered', (evt: { alertId: string; symbol: string }) => {
            useSmartAlertFeed.getState().pushEvent({
                type: 'price',
                symbol: evt.symbol,
                priority: 'important',
                message: `Multi-timeframe condition triggered (${evt.alertId})`,
                outcome: null,
            });
        });
    }

    /**
     * Start tracking a symbol via WebSocket kline stream.
     */
    addSymbol(symbol: string): void {
        const sym = symbol.toUpperCase();
        if (!WebSocketService.isSupported(sym)) return;
        if (this.subscriptions.has(sym)) return;

        const subId = wsService.subscribeKlineOnly(sym, '1m', {
            onCandle: (candle: { time: number; open: number; high: number; low: number; close: number; volume: number; isClosed: boolean }) => {
                this.handleCandle(sym, candle);
            },
        });

        this.subscriptions.set(sym, subId);
        if (!this.barBuffers.has(sym)) {
            this.barBuffers.set(sym, []);
        }
    }

    /**
     * Stop tracking a symbol.
     */
    removeSymbol(symbol: string): void {
        const sym = symbol.toUpperCase();
        const subId = this.subscriptions.get(sym);
        if (subId != null) {
            wsService.unsubscribe(subId);
            this.subscriptions.delete(sym);
        }
    }

    /**
     * Handle an incoming kline candle.
     */
    private handleCandle(
        symbol: string,
        candle: { time: number; open: number; high: number; low: number; close: number; volume: number; isClosed: boolean },
    ): void {
        // Always feed close price for alerts (even intra-bar)
        checkAlerts({ [symbol]: candle.close });

        // Only process closed bars for smart alert detection
        if (!candle.isClosed) return;

        const bar: Bar = {
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            volume: candle.volume,
            time: candle.time,
        };

        // 1. Volume spike detection
        this.volumeDetector.pushBar(symbol, bar);

        // 2. Candlestick pattern detection
        let buffer = this.barBuffers.get(symbol);
        if (!buffer) {
            buffer = [];
            this.barBuffers.set(symbol, buffer);
        }
        buffer.push(bar);
        if (buffer.length > MAX_PATTERN_BARS) buffer.shift();

        const patterns: PatternMatch[] = this.patternDetector.detectLatest(buffer);
        for (const match of patterns) {
            useSmartAlertFeed.getState().pushEvent({
                type: 'pattern',
                symbol,
                priority: match.confidence >= 0.8 ? 'critical' : match.confidence >= 0.6 ? 'important' : 'fyi',
                message: match.description,
                outcome: null,
            });
        }

        // 3. Multi-timeframe evaluation (pushes 1m bars, aggregation happens internally)
        this.mtfEvaluator.pushBar(symbol, bar);
    }

    /**
     * Start the bridge — begins tracking symbols.
     */
    start(symbols: string[] = []): void {
        if (this.running) return;
        this.running = true;
        useSmartAlertFeed.getState().setLive(true);

        for (const sym of symbols) {
            this.addSymbol(sym);
        }
    }

    /**
     * Stop the bridge — unsubscribes all symbols.
     */
    stop(): void {
        this.running = false;
        useSmartAlertFeed.getState().setLive(false);

        for (const [sym, subId] of this.subscriptions) {
            wsService.unsubscribe(subId);
        }
        this.subscriptions.clear();
    }

    /**
     * Get the VolumeSpikeDetector instance (for external queries).
     */
    getVolumeDetector(): VolumeSpikeDetector {
        return this.volumeDetector;
    }

    /**
     * Get the MultiTimeframeEvaluator instance (for registering MTF alerts).
     */
    getMtfEvaluator(): MultiTimeframeEvaluator {
        return this.mtfEvaluator;
    }

    /**
     * Get the current price for a symbol from the WS service.
     */
    getPrice(symbol: string): number | null {
        // Access wsService's internal price cache
        const price = (wsService as any)._lastKnownPrice?.get(symbol.toUpperCase());
        return price ?? null;
    }

    /**
     * Check if the bridge is running.
     */
    get isRunning(): boolean {
        return this.running;
    }

    /**
     * Get list of tracked symbols.
     */
    get trackedSymbols(): string[] {
        return Array.from(this.subscriptions.keys());
    }
}

// Singleton export
export const smartAlertBridge = new SmartAlertBridge();
export default smartAlertBridge;
