// ═══════════════════════════════════════════════════════════════════
// charEdge — CrossChartTransfer: Inter-Engine Pane Transfer (#129)
//
// Sprint 20 #129: Enables dragging indicator panes between
// ChartEngine instances. Uses a static registry of all active
// engines and serializes PaneState + IndicatorConfig for transfer.
//
// IMPORTANT: Indicator computed data does NOT transfer — the target
// chart's IndicatorWorker must recalculate from its own bar data.
// Only the config (indicatorId, params, visual settings) transfers.
//
// Usage:
//   CrossChartTransfer.register('chart-1', engine1);
//   CrossChartTransfer.transfer('chart-1', 0, 'chart-2', 1);
// ═══════════════════════════════════════════════════════════════════

import type { IndicatorConfig } from '../../types/chart.js';

// ─── Types ───────────────────────────────────────────────────────

/** Serialized pane data for cross-chart transfer. */
export interface TransferPayload {
    /** Serialized PaneState (heights, scale, collapse state). */
    paneState: Record<string, unknown>;
    /** Indicator configs (stripped of computed data). */
    indicators: IndicatorConfig[];
    /** Source engine ID. */
    sourceEngineId: string;
    /** Source pane index. */
    sourcePaneIdx: number;
}

/** Events emitted during cross-chart transfer. */
export type TransferEvent =
    | { type: 'transfer-start'; sourceEngine: string; paneIdx: number }
    | { type: 'transfer-complete'; sourceEngine: string; targetEngine: string }
    | { type: 'transfer-cancel' };

type TransferListener = (event: TransferEvent) => void;

// ─── Engine Interface ────────────────────────────────────────────

/**
 * Minimal engine interface for cross-chart transfer.
 * Actual ChartEngine implements these via exportPane/importPane.
 */
export interface TransferableEngine {
    /** Export a pane's config + state for transfer. */
    exportPane(paneIdx: number): TransferPayload | null;
    /** Import a pane from a transfer payload. */
    importPane(payload: TransferPayload, targetIdx?: number): boolean;
    /** Get the root DOM element (for hit testing during drag). */
    getContainer(): HTMLElement;
}

// ─── CrossChartTransfer ──────────────────────────────────────────

/**
 * Static registry and coordinator for cross-chart pane transfers.
 *
 * All active ChartEngine instances register here. During a cross-chart
 * drag, the system detects when the cursor leaves one chart and enters
 * another, then performs the indicator transfer.
 */
export class CrossChartTransfer {
    /** Registry of all active chart engines. */
    private static _engines = new Map<string, TransferableEngine>();
    /** Event listeners. */
    private static _listeners = new Set<TransferListener>();
    /** Active transfer state. */
    private static _activeTransfer: TransferPayload | null = null;

    // ─── Registration ────────────────────────────────────────────

    /** Register a chart engine instance. */
    static register(id: string, engine: TransferableEngine): void {
        CrossChartTransfer._engines.set(id, engine);
    }

    /** Unregister a chart engine instance (on destroy). */
    static unregister(id: string): void {
        CrossChartTransfer._engines.delete(id);
    }

    /** Get all registered engine IDs. */
    static getEngineIds(): string[] {
        return [...CrossChartTransfer._engines.keys()];
    }

    /** Get a registered engine by ID. */
    static getEngine(id: string): TransferableEngine | undefined {
        return CrossChartTransfer._engines.get(id);
    }

    /** Check if cross-chart transfer is available (>1 engine). */
    static get available(): boolean {
        return CrossChartTransfer._engines.size > 1;
    }

    // ─── Transfer ────────────────────────────────────────────────

    /**
     * Transfer an indicator pane from one engine to another.
     *
     * 1. Export pane config from source
     * 2. Remove pane from source
     * 3. Import pane config into target
     * 4. Target engine recalculates indicator data
     *
     * @param sourceEngineId - Source engine ID
     * @param sourcePaneIdx  - Pane index in source engine
     * @param targetEngineId - Target engine ID
     * @param targetPaneIdx  - Insert position in target (optional, appends if omitted)
     * @returns true if transfer succeeded
     */
    static transfer(
        sourceEngineId: string,
        sourcePaneIdx: number,
        targetEngineId: string,
        targetPaneIdx?: number,
    ): boolean {
        if (sourceEngineId === targetEngineId) return false;

        const source = CrossChartTransfer._engines.get(sourceEngineId);
        const target = CrossChartTransfer._engines.get(targetEngineId);
        if (!source || !target) return false;

        CrossChartTransfer._emit({
            type: 'transfer-start',
            sourceEngine: sourceEngineId,
            paneIdx: sourcePaneIdx,
        });

        // Export from source
        const payload = source.exportPane(sourcePaneIdx);
        if (!payload) {
            CrossChartTransfer._emit({ type: 'transfer-cancel' });
            return false;
        }

        // Import into target
        const success = target.importPane(payload, targetPaneIdx);

        if (success) {
            CrossChartTransfer._emit({
                type: 'transfer-complete',
                sourceEngine: sourceEngineId,
                targetEngine: targetEngineId,
            });
        } else {
            CrossChartTransfer._emit({ type: 'transfer-cancel' });
        }

        return success;
    }

    // ─── Drag Detection ──────────────────────────────────────────

    /**
     * Detect which engine the cursor is over.
     * Used by PaneDragReorder to detect cross-chart targets.
     *
     * @param clientX - Mouse clientX
     * @param clientY - Mouse clientY
     * @returns Engine ID or null if not over any registered engine
     */
    static hitTestEngines(clientX: number, clientY: number): string | null {
        for (const [id, engine] of CrossChartTransfer._engines) {
            const container = engine.getContainer();
            const rect = container.getBoundingClientRect();
            if (
                clientX >= rect.left && clientX <= rect.right &&
                clientY >= rect.top && clientY <= rect.bottom
            ) {
                return id;
            }
        }
        return null;
    }

    /**
     * Begin a cross-chart drag (called by PaneDragReorder when
     * cursor exits the source chart's bounding rect).
     */
    static beginDrag(sourceEngineId: string, paneIdx: number): void {
        const source = CrossChartTransfer._engines.get(sourceEngineId);
        if (!source) return;

        CrossChartTransfer._activeTransfer = source.exportPane(paneIdx);
    }

    /** Get the active transfer payload (during drag). */
    static get activeTransfer(): TransferPayload | null {
        return CrossChartTransfer._activeTransfer;
    }

    /** End cross-chart drag mode. */
    static endDrag(): void {
        CrossChartTransfer._activeTransfer = null;
    }

    // ─── Events ──────────────────────────────────────────────────

    /** Subscribe to transfer events. Returns unsubscribe function. */
    static on(listener: TransferListener): () => void {
        CrossChartTransfer._listeners.add(listener);
        return () => CrossChartTransfer._listeners.delete(listener);
    }

    private static _emit(event: TransferEvent): void {
        for (const cb of CrossChartTransfer._listeners) {
            try { cb(event); } catch { /* noop */ }
        }
    }

    // ─── Cleanup ─────────────────────────────────────────────────

    /** Clear all registrations (for testing). */
    static reset(): void {
        CrossChartTransfer._engines.clear();
        CrossChartTransfer._listeners.clear();
        CrossChartTransfer._activeTransfer = null;
    }
}
