// ═══════════════════════════════════════════════════════════════════
// charEdge — Replay Engine
//
// Core bar-by-bar replay system for historical chart playback.
// Hides future bars and feeds historical data one bar at a time.
//
// State Machine: IDLE → LOADING → PLAYING → PAUSED → STOPPED
//
// Usage:
//   const engine = new ReplayEngine(dataProvider);
//   await engine.startReplay({ symbol: 'BTCUSD', tf: '5', start, end });
//   engine.play();  // starts auto-advancing
//   engine.pause(); // freezes playback
//   engine.step();  // advance one bar manually
//
// Tasks: 3.4.1 (bar-by-bar replay), 3.4.2 (hide future bars),
//        3.4.4 (speed controls)
// ═══════════════════════════════════════════════════════════════════

import { EventEmitter } from '../../utils/EventEmitter.ts';

// ─── Types ──────────────────────────────────────────────────────

export type ReplayState = 'idle' | 'loading' | 'playing' | 'paused' | 'stopped';

export interface ReplayBar {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface ReplayConfig {
    symbol: string;
    timeframe: string;
    startDate: Date;
    endDate: Date;
}

export interface DataProvider {
    getHistoricalBars(symbol: string, timeframe: string, start: Date, end: Date): Promise<ReplayBar[]>;
}

export interface ReplayEvents {
    'state-change': { from: ReplayState; to: ReplayState };
    'bar-advance': { bar: ReplayBar; index: number; total: number; progress: number };
    'replay-complete': { totalBars: number; elapsedMs: number };
    'error': { message: string };
}

// ─── Speed Presets ──────────────────────────────────────────────

export const SPEED_PRESETS = [
    { label: '1x', value: 1, intervalMs: 1000 },
    { label: '2x', value: 2, intervalMs: 500 },
    { label: '5x', value: 5, intervalMs: 200 },
    { label: '10x', value: 10, intervalMs: 100 },
] as const;

export type SpeedMultiplier = typeof SPEED_PRESETS[number]['value'];

// ─── Engine ─────────────────────────────────────────────────────

export class ReplayEngine extends EventEmitter {
    private state: ReplayState = 'idle';
    private bars: ReplayBar[] = [];
    private visibleIndex = 0;
    private speed: SpeedMultiplier = 1;
    private intervalId: ReturnType<typeof setInterval> | null = null;
    private dataProvider: DataProvider;
    private config: ReplayConfig | null = null;
    private startTime = 0;

    constructor(dataProvider: DataProvider) {
        super();
        this.dataProvider = dataProvider;
    }

    // ─── Public API ─────────────────────────────────────────────

    async startReplay(config: ReplayConfig): Promise<void> {
        this.config = config;
        this.setState('loading');

        try {
            this.bars = await this.dataProvider.getHistoricalBars(
                config.symbol,
                config.timeframe,
                config.startDate,
                config.endDate,
            );

            if (this.bars.length === 0) {
                this.emit('error', { message: 'No bars found for the selected range' });
                this.setState('idle');
                return;
            }

            // Sort by time ascending
            this.bars.sort((a, b) => a.time - b.time);
            this.visibleIndex = 0;
            this.startTime = performance.now();
            this.setState('paused'); // Start paused so user can see first bar and press play
        } catch (err) {
            this.emit('error', { message: `Failed to load replay data: ${err}` });
            this.setState('idle');
        }
    }

    play(): void {
        if (this.state !== 'paused') return;
        this.setState('playing');
        this.startAutoAdvance();
    }

    pause(): void {
        if (this.state !== 'playing') return;
        this.stopAutoAdvance();
        this.setState('paused');
    }

    stop(): void {
        this.stopAutoAdvance();
        this.bars = [];
        this.visibleIndex = 0;
        this.config = null;
        this.setState('stopped');
        // Reset to idle after a tick so UI can read 'stopped'
        setTimeout(() => this.setState('idle'), 100);
    }

    step(): void {
        if (this.state !== 'paused' && this.state !== 'playing') return;
        if (this.state === 'playing') {
            this.pause();
        }
        this.advanceBar();
    }

    setSpeed(speed: SpeedMultiplier): void {
        this.speed = speed;
        // Restart interval if currently playing
        if (this.state === 'playing') {
            this.stopAutoAdvance();
            this.startAutoAdvance();
        }
    }

    // ─── Getters ──────────────────────────────────────────────────

    getState(): ReplayState { return this.state; }
    getSpeed(): SpeedMultiplier { return this.speed; }
    getVisibleIndex(): number { return this.visibleIndex; }
    getTotalBars(): number { return this.bars.length; }
    getConfig(): ReplayConfig | null { return this.config; }

    getProgress(): number {
        if (this.bars.length === 0) return 0;
        return this.visibleIndex / (this.bars.length - 1);
    }

    /** Returns bars visible up to the current replay index (hides future) */
    getVisibleBars(): ReplayBar[] {
        return this.bars.slice(0, this.visibleIndex + 1);
    }

    /** Returns the current (latest visible) bar */
    getCurrentBar(): ReplayBar | null {
        return this.bars[this.visibleIndex] || null;
    }

    isActive(): boolean {
        return this.state === 'playing' || this.state === 'paused' || this.state === 'loading';
    }

    // ─── Internals ────────────────────────────────────────────────

    private setState(newState: ReplayState): void {
        const from = this.state;
        this.state = newState;
        this.emit('state-change', { from, to: newState });
    }

    private advanceBar(): void {
        if (this.visibleIndex >= this.bars.length - 1) {
            // Replay complete
            this.stopAutoAdvance();
            const elapsed = performance.now() - this.startTime;
            this.emit('replay-complete', { totalBars: this.bars.length, elapsedMs: elapsed });
            this.setState('paused');
            return;
        }

        this.visibleIndex++;
        const bar = this.bars[this.visibleIndex];
        this.emit('bar-advance', {
            bar,
            index: this.visibleIndex,
            total: this.bars.length,
            progress: this.getProgress(),
        });
    }

    private startAutoAdvance(): void {
        this.stopAutoAdvance();
        const preset = SPEED_PRESETS.find((p) => p.value === this.speed) || SPEED_PRESETS[0];
        this.intervalId = setInterval(() => this.advanceBar(), preset.intervalMs);
    }

    private stopAutoAdvance(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    destroy(): void {
        this.stop();
        this.removeAllListeners();
    }
}
