// ═══════════════════════════════════════════════════════════════════
// charEdge — PaneState
//
// First-class abstraction for each rendering pane in the chart.
// Every pane (main chart + indicator panes) gets its own PaneState
// with independent Y-axis scaling, scroll, height, and dirty tracking.
//
// This is the data model foundation for the full hybrid DOM pane
// architecture. Phase 1 introduces PaneState as a data structure;
// Phase 2 will wire each PaneState to its own DOM container + LayerManager.
//
// Design Principles:
//   1. Each pane owns its vertical transform (yMin, yMax, priceScale, priceScroll)
//   2. Horizontal navigation (scrollOffset, visibleBars) is shared via TimeSync
//   3. PaneState is plain data — no DOM refs, no contexts
//   4. The main chart is a PaneState too (type === 'main')
// ═══════════════════════════════════════════════════════════════════

import type { IndicatorConfig } from '../../types/chart.js';

// ─── Types ───────────────────────────────────────────────────────

export type PaneType = 'main' | 'indicator';

export interface PaneStateInit {
    id: string;
    type: PaneType;
    indicators?: IndicatorConfig[];
    heightFraction?: number;
    collapsed?: boolean;
}

// ─── PaneState Class ─────────────────────────────────────────────

/**
 * Immutable-ish state object for a single chart pane.
 *
 * The main chart pane and each indicator pane are both PaneState instances.
 * This gives us a uniform API for layout, Y-scale, collapse, and rendering.
 *
 * @example
 * ```ts
 * const mainPane = new PaneState({ id: 'main', type: 'main' });
 * const rsiPane = new PaneState({ id: 'pane_0', type: 'indicator', indicators: [rsiConfig] });
 *
 * rsiPane.autoFit(startIdx, endIdx);
 * console.log(rsiPane.yMin, rsiPane.yMax);
 * ```
 */
export class PaneState {
    /** Unique pane identifier: 'main' | 'pane_0' | 'pane_1' ... */
    readonly id: string;

    /** Pane type — main chart or indicator sub-pane */
    readonly type: PaneType;

    // ─── Y-Axis Transform (independent per pane) ────────────────
    /** Bottom of visible price range */
    yMin: number = 0;
    /** Top of visible price range */
    yMax: number = 100;
    /** Whether this pane auto-scales Y to fit data */
    autoScale: boolean = true;
    /** Manual Y-zoom factor (1 = default, >1 = zoomed out) */
    priceScale: number = 1;
    /** Manual Y-scroll offset (0 = centered) */
    priceScroll: number = 0;

    // ─── Layout ─────────────────────────────────────────────────
    /** Computed CSS pixel height for this pane */
    height: number = 0;
    /** Fraction of total chart height (0.15 = 15%) */
    heightFraction: number;
    /** Whether pane is collapsed (shows header only) */
    collapsed: boolean;

    /** Height of the pane header bar in CSS pixels */
    static readonly HEADER_HEIGHT = 18;
    /** Minimum pane height fraction to prevent squishing */
    static readonly MIN_FRACTION = 0.08;
    /** Maximum pane height fraction to prevent dominating */
    static readonly MAX_FRACTION = 0.50;
    /** Default height fraction for new indicator panes */
    static readonly DEFAULT_FRACTION = 0.15;

    // ─── Indicators ─────────────────────────────────────────────
    /** Indicators assigned to this pane */
    indicators: IndicatorConfig[];

    // ─── Dirty Tracking ─────────────────────────────────────────
    /** Whether this pane needs rerender */
    dirty: boolean = true;
    /** Sprint 19 #128: Whether this pane is being dragged */
    isDragging: boolean = false;

    constructor(init: PaneStateInit) {
        this.id = init.id;
        this.type = init.type;
        this.indicators = (init.indicators || []) as IndicatorConfig[];
        this.heightFraction = init.heightFraction ?? PaneState.DEFAULT_FRACTION;
        this.collapsed = init.collapsed ?? false;
    }

    // ─── Y-Axis Auto-Fit ───────────────────────────────────────

    /**
     * Auto-fit the Y-axis range to the data visible in the current viewport.
     *
     * For the main pane, this uses bar high/low values.
     * For indicator panes, this scans all indicator output arrays.
     *
     * @param startIdx - First visible bar index
     * @param endIdx - Last visible bar index
     * @param bars - Full bar array (used for main pane)
     * @param padding - Fraction of range to add as padding (default 0.05 = 5%)
     */
    autoFit(
        startIdx: number,
        endIdx: number,
        bars?: { high: number; low: number }[],
        padding: number = 0.05,
    ): void {
        if (!this.autoScale) return;

        let lo = Infinity;
        let hi = -Infinity;

        if (this.type === 'main' && bars) {
            // Main pane: scan bar high/low
            const safeStart = Math.max(0, startIdx);
            const safeEnd = Math.min(bars.length - 1, endIdx);
            for (let i = safeStart; i <= safeEnd; i++) {
                if (bars[i].low < lo) lo = bars[i].low;
                if (bars[i].high > hi) hi = bars[i].high;
            }
        } else if (this.type === 'indicator') {
            // Indicator pane: scan all indicator output arrays
            for (const ind of this.indicators) {
                const computed = (ind as unknown).computed;
                if (!computed) continue;
                const outputs = (ind as unknown).outputs;
                if (!outputs) continue;

                for (const output of outputs) {
                    const vals = computed[output.key];
                    if (!vals) continue;
                    const safeStart = Math.max(0, startIdx);
                    const safeEnd = Math.min(vals.length - 1, endIdx);
                    for (let j = safeStart; j <= safeEnd; j++) {
                        const v = vals[j];
                        if (v != null && isFinite(v)) {
                            if (v < lo) lo = v;
                            if (v > hi) hi = v;
                        }
                    }
                }
            }
        }

        // Fallback for empty data
        if (lo === Infinity) { lo = 0; hi = 100; }
        const rng = hi - lo || 1;

        this.yMin = lo - rng * padding;
        this.yMax = hi + rng * padding;
    }

    // ─── Layout Helpers ─────────────────────────────────────────

    /**
     * Compute the CSS pixel height for this pane given the total available height.
     *
     * @param availHeight - Total available height in CSS pixels
     * @returns The computed height (also stored in `this.height`)
     */
    computeHeight(availHeight: number): number {
        if (this.collapsed) {
            this.height = PaneState.HEADER_HEIGHT;
        } else {
            this.height = Math.max(60, Math.floor(availHeight * this.heightFraction));
        }
        return this.height;
    }

    /**
     * Toggle collapsed state. When collapsed, pane shows header only.
     */
    toggleCollapse(): void {
        this.collapsed = !this.collapsed;
        this.dirty = true;
    }

    /**
     * Set the height fraction within valid bounds.
     *
     * @param fraction - New height fraction (clamped to MIN_FRACTION..MAX_FRACTION)
     */
    setHeightFraction(fraction: number): void {
        this.heightFraction = Math.max(
            PaneState.MIN_FRACTION,
            Math.min(PaneState.MAX_FRACTION, fraction),
        );
        this.dirty = true;
    }

    /**
     * Reset Y-axis to auto-scale mode with default zoom/scroll.
     */
    resetScale(): void {
        this.autoScale = true;
        this.priceScale = 1;
        this.priceScroll = 0;
        this.dirty = true;
    }

    /**
     * Apply manual Y-axis scaling (disable auto-scale).
     *
     * @param scale - Zoom factor
     * @param scroll - Scroll offset
     */
    manualScale(scale: number, scroll: number): void {
        this.autoScale = false;
        this.priceScale = Math.max(0.1, Math.min(10, scale));
        this.priceScroll = scroll;
        this.dirty = true;
    }

    // ─── Serialization ──────────────────────────────────────────

    /**
     * Export pane state for persistence (workspace save/restore).
     */
    toJSON(): Record<string, unknown> {
        return {
            id: this.id,
            type: this.type,
            heightFraction: this.heightFraction,
            collapsed: this.collapsed,
            autoScale: this.autoScale,
            priceScale: this.priceScale,
            priceScroll: this.priceScroll,
        };
    }
}

// ─── Layout Utilities ─────────────────────────────────────────

/**
 * Build a PaneState array from indicator configs.
 * Creates one main pane + one pane per `mode === 'pane'` indicator.
 *
 * @param indicators - All indicator configs
 * @param paneHeights - Optional persisted height fractions
 * @param collapsedPanes - Optional set of collapsed pane indices
 * @returns Array of PaneState objects [main, pane_0, pane_1, ...]
 */
export function buildPaneLayout(
    indicators: IndicatorConfig[],
    paneHeights?: Record<number, number>,
    collapsedPanes?: Set<number>,
): PaneState[] {
    const panes: PaneState[] = [];

    // Main chart pane (always first)
    const mainPane = new PaneState({ id: 'main', type: 'main' });
    mainPane.indicators = indicators.filter(
        (i: unknown) => i.mode === 'overlay',
    );
    panes.push(mainPane);

    // Indicator panes
    const paneInds = indicators.filter((i: unknown) => i.mode === 'pane');
    for (let i = 0; i < paneInds.length; i++) {
        const pane = new PaneState({
            id: `pane_${i}`,
            type: 'indicator',
            indicators: [paneInds[i]],
            heightFraction: paneHeights?.[i] ?? PaneState.DEFAULT_FRACTION,
            collapsed: collapsedPanes?.has(i) ?? false,
        });
        panes.push(pane);
    }

    return panes;
}

/**
 * Compute layout heights for all panes given total available height.
 * The main pane fills remaining space after indicator panes are sized.
 *
 * @param panes - Array of PaneState objects
 * @param availHeight - Total available height in CSS pixels
 * @returns The main pane height (for backward compat)
 */
export function layoutPanes(panes: PaneState[], availHeight: number): number {
    // First pass: compute indicator pane heights
    let totalPaneHeight = 0;
    for (let i = 1; i < panes.length; i++) {
        const pane = panes[i];
        pane.computeHeight(availHeight);
        totalPaneHeight += pane.height;
    }

    // Cap total pane height at 60% of available
    const maxPaneHeight = Math.floor(availHeight * 0.6);
    if (totalPaneHeight > maxPaneHeight) {
        const scale = maxPaneHeight / totalPaneHeight;
        totalPaneHeight = 0;
        for (let i = 1; i < panes.length; i++) {
            const pane = panes[i];
            if (!pane.collapsed) {
                pane.height = Math.max(60, Math.floor(pane.height * scale));
            }
            totalPaneHeight += pane.height;
        }
    }

    // Main pane fills remaining space
    const mainHeight = Math.max(100, availHeight - totalPaneHeight);
    panes[0].height = mainHeight;

    return mainHeight;
}
