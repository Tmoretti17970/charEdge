// ═══════════════════════════════════════════════════════════════════
// charEdge — Data Window Manager (Task 2.3.9)
//
// Viewport-aware data windowing for 500K+ bar datasets.
// Only loads OPFS blocks overlapping the visible time range,
// with 2-block lookahead for smooth scrolling.
//
// Uses TimeSeriesStore's B-tree index for O(log n) range queries.
// ═══════════════════════════════════════════════════════════════════

// @ts-expect-error — .ts imports resolved by Vite
import { logger } from '@/observability/logger.ts';

// ─── Types ──────────────────────────────────────────────────────

interface Bar {
    t: number;
    o: number;
    h: number;
    l: number;
    c: number;
    v: number;
}

interface DataWindowOptions {
    /** Lookahead blocks on each edge (default: 2) */
    lookahead?: number;
    /** Minimum bars before triggering re-fetch (default: 100) */
    minBarsThreshold?: number;
    /** Callback when viewport data changes */
    onDataChange?: (bars: Bar[]) => void;
}

interface Viewport {
    startT: number;
    endT: number;
}

// ─── DataWindow ─────────────────────────────────────────────────

class DataWindow {
    private _bars: Bar[] = [];
    private _viewport: Viewport = { startT: 0, endT: 0 };
    private _loadedRange: Viewport = { startT: 0, endT: 0 };
    private _lookahead: number;
    private _minBarsThreshold: number;
    private _onDataChange?: (bars: Bar[]) => void;
    private _loading = false;
    private _totalBarsAvailable = 0;

    // Block loader function — injected by consumer (TimeSeriesStore.queryRange)
    private _blockLoader: ((startT: number, endT: number) => Promise<Bar[]>) | null = null;

    // Task 2.10.3.2: OPFS loader — checked before network requests
    private _opfsLoader: ((startT: number, endT: number) => Promise<Bar[]>) | null = null;

    constructor(options: DataWindowOptions = {}) {
        this._lookahead = options.lookahead ?? 3; // Task 2.10.3.2: increased from 2 to 3
        this._minBarsThreshold = options.minBarsThreshold ?? 100;
        this._onDataChange = options.onDataChange;
    }

    // ─── Public API ─────────────────────────────────────────────────

    /** Set the block loader function (from TimeSeriesStore) */
    setBlockLoader(loader: (startT: number, endT: number) => Promise<Bar[]>): void {
        this._blockLoader = loader;
    }

    /** Task 2.10.3.2: Set the OPFS loader — checked before network requests. */
    setOpfsLoader(loader: (startT: number, endT: number) => Promise<Bar[]>): void {
        this._opfsLoader = loader;
    }

    /** Set total bars available for the series (for progress tracking) */
    setTotalBars(total: number): void {
        this._totalBarsAvailable = total;
    }

    /** Update the visible viewport range. Triggers block loading if needed. */
    async updateViewport(startT: number, endT: number): Promise<void> {
        this._viewport = { startT, endT };

        // Check if we need to load more data
        if (this._needsRefetch(startT, endT)) {
            await this._fetchBlocks(startT, endT);
        }
    }

    /** Get the currently loaded bars (full window including lookahead). */
    getBars(): Bar[] {
        return this._bars;
    }

    /** Get only bars within the visible viewport. */
    getVisibleBars(): Bar[] {
        const { startT, endT } = this._viewport;
        return this._bars.filter(b => b.t >= startT && b.t <= endT);
    }

    /** Whether data is currently being fetched. */
    get isLoading(): boolean {
        return this._loading;
    }

    /** Whether windowing is active (large dataset). */
    get isWindowed(): boolean {
        return this._totalBarsAvailable > 10_000;
    }

    /** Total bars in the full dataset. */
    get totalBars(): number {
        return this._totalBarsAvailable;
    }

    /** Loaded bars in the current window. */
    get loadedBars(): number {
        return this._bars.length;
    }

    /** Set bars directly (for small datasets that don't need windowing). */
    setAllBars(bars: Bar[]): void {
        this._bars = bars;
        this._totalBarsAvailable = bars.length;
        if (bars.length > 0) {
            this._loadedRange = {
                startT: bars[0].t,
                endT: bars[bars.length - 1].t,
            };
        }
    }

    /** Clear all data. */
    clear(): void {
        this._bars = [];
        this._viewport = { startT: 0, endT: 0 };
        this._loadedRange = { startT: 0, endT: 0 };
        this._loading = false;
    }

    // ─── Private ────────────────────────────────────────────────────

    private _needsRefetch(startT: number, endT: number): boolean {
        // No data loaded yet
        if (this._bars.length === 0) return true;

        // Viewport extends beyond loaded range (with lookahead buffer)
        const viewportDuration = endT - startT;
        const buffer = viewportDuration * this._lookahead;

        const bufferedStart = startT - buffer;
        const bufferedEnd = endT + buffer;

        return bufferedStart < this._loadedRange.startT || bufferedEnd > this._loadedRange.endT;
    }

    private async _fetchBlocks(startT: number, endT: number): Promise<void> {
        if (!this._blockLoader || this._loading) return;

        this._loading = true;

        try {
            // Expand range to include lookahead
            const viewportDuration = endT - startT;
            const buffer = viewportDuration * this._lookahead;
            const fetchStart = startT - buffer;
            const fetchEnd = endT + buffer;

            // Task 2.10.3.2: Try OPFS first — instant render, no loading spinner
            let bars: Bar[] = [];
            if (this._opfsLoader) {
                try {
                    bars = await this._opfsLoader(fetchStart, fetchEnd);
                    if (bars.length > 0) {
                        logger.data.info(
                            `[DataWindow] OPFS hit: ${bars.length} bars for range [${new Date(fetchStart).toISOString()} → ${new Date(fetchEnd).toISOString()}]`
                        );
                    }
                } catch {
                    // OPFS failed — fall through to network
                    bars = [];
                }
            }

            // Fall back to network block loader if OPFS didn't have enough data
            if (bars.length === 0) {
                logger.data.info(
                    `[DataWindow] Fetching blocks for range [${new Date(fetchStart).toISOString()} → ${new Date(fetchEnd).toISOString()}]`
                );
                bars = await this._blockLoader(fetchStart, fetchEnd);
            }

            this._bars = bars;
            if (bars.length > 0) {
                this._loadedRange = {
                    startT: bars[0]!.t,
                    endT: bars[bars.length - 1]!.t,
                };
            }

            if (this._onDataChange) {
                this._onDataChange(bars);
            }
        } catch (e) {
            logger.data.warn('[DataWindow] Block fetch failed', e);
        } finally {
            this._loading = false;
        }
    }
}

export { DataWindow };
export type { DataWindowOptions, Viewport, Bar as DataWindowBar };
export default DataWindow;
