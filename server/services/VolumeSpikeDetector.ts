// ═══════════════════════════════════════════════════════════════════
// charEdge — Volume Spike Detector (Phase D1)
//
// Server-side service that maintains a rolling 20-bar volume average
// per symbol and detects volume spikes (>= threshold × average).
// ═══════════════════════════════════════════════════════════════════

import { MiniEmitter } from './MiniEmitter';

// ─── Types ──────────────────────────────────────────────────────

export interface Bar {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    time: number;
}

export interface SpikeResult {
    isSpike: boolean;
    ratio: number;         // e.g. 3.2x
    avgVolume: number;
    currentVolume: number;
    symbol: string;
}

interface SymbolBuffer {
    volumes: number[];
    avgVolume: number;
}

// ─── Config ─────────────────────────────────────────────────────

const DEFAULT_LOOKBACK = 20;
const DEFAULT_THRESHOLD = 2.0; // 2x average

// ─── Service ────────────────────────────────────────────────────

export class VolumeSpikeDetector extends MiniEmitter {
    private buffers: Map<string, SymbolBuffer> = new Map();
    private lookback: number;
    private threshold: number;

    constructor(lookback = DEFAULT_LOOKBACK, threshold = DEFAULT_THRESHOLD) {
        super();
        this.lookback = lookback;
        this.threshold = threshold;
    }

    /**
     * Push a new bar for a symbol. Automatically checks for spikes.
     */
    pushBar(symbol: string, bar: Bar): SpikeResult {
        const sym = symbol.toUpperCase();
        let buffer = this.buffers.get(sym);

        if (!buffer) {
            buffer = { volumes: [], avgVolume: 0 };
            this.buffers.set(sym, buffer);
        }

        buffer.volumes.push(bar.volume);

        // Keep only the lookback window
        if (buffer.volumes.length > this.lookback + 1) {
            buffer.volumes.shift();
        }

        // Compute rolling average (excluding the current bar)
        const historicalVolumes = buffer.volumes.slice(0, -1);
        buffer.avgVolume = historicalVolumes.length > 0
            ? historicalVolumes.reduce((s, v) => s + v, 0) / historicalVolumes.length
            : 0;

        return this.checkSpike(sym, bar.volume);
    }

    /**
     * Check if a volume value constitutes a spike for a given symbol.
     */
    checkSpike(symbol: string, currentVolume: number, threshold?: number): SpikeResult {
        const sym = symbol.toUpperCase();
        const buffer = this.buffers.get(sym);
        const avg = buffer?.avgVolume || 0;
        const t = threshold || this.threshold;

        const ratio = avg > 0 ? currentVolume / avg : 0;
        const isSpike = avg > 0 && ratio >= t;

        const result: SpikeResult = {
            isSpike,
            ratio: Math.round(ratio * 10) / 10,
            avgVolume: Math.round(avg),
            currentVolume,
            symbol: sym,
        };

        if (isSpike) {
            this.emit('volume:spike', result);
        }

        return result;
    }

    /**
     * Get the current average volume for a symbol.
     */
    getAverage(symbol: string): number {
        return this.buffers.get(symbol.toUpperCase())?.avgVolume || 0;
    }

    /**
     * Get all symbols being tracked.
     */
    getTrackedSymbols(): string[] {
        return Array.from(this.buffers.keys());
    }

    /**
     * Clear all buffers.
     */
    reset(): void {
        this.buffers.clear();
    }
}

export default VolumeSpikeDetector;
