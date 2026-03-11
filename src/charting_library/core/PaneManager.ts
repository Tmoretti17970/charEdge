// ═══════════════════════════════════════════════════════════════════
// charEdge — PaneManager
//
// Central coordinator for the hybrid DOM pane architecture.
// Each pane (main chart + indicator sub-panes) gets its own:
//   • DOM container (<div>)
//   • LayerManager (canvas stack)
//   • Independent Y-axis state (via PaneState)
//
// The PaneManager handles:
//   1. DOM container lifecycle (create, destroy, reorder)
//   2. CSS flexbox layout with splitter drag
//   3. Cross-pane crosshair synchronization
//   4. Snapshot compositing for export
//   5. Pane collapse/expand with animation
//
// Architecture:
//   ChartEngine → PaneManager → PaneInstance[]
//     PaneInstance = { state: PaneState, layers: LayerManager, container: HTMLDivElement }
// ═══════════════════════════════════════════════════════════════════

import { PaneState } from './PaneState.js';
import { LayerManager, LAYERS } from './LayerManager.js';
import { PaneDragReorder } from './PaneDragReorder.ts';
import type { IndicatorConfig } from '../../types/chart.js';

// ─── Types ───────────────────────────────────────────────────────

/** Represents a single pane instance with its DOM and rendering resources. */
export interface PaneInstance {
    /** Unique pane identifier (matches PaneState.id) */
    id: string;
    /** Pane state (Y-axis, layout, indicators) */
    state: PaneState;
    /** Canvas layer manager for this pane */
    layers: LayerManager;
    /** DOM container element */
    container: HTMLDivElement;
    /** Splitter element above this pane (null for main pane) */
    splitter: HTMLDivElement | null;
    /** AbortController for splitter event listeners (Item 25: leak fix) */
    _splitterAC?: AbortController;
}

/** Events emitted by PaneManager */
export type PaneEvent =
    | { type: 'pane-added'; paneId: string }
    | { type: 'pane-removed'; paneId: string }
    | { type: 'pane-resized'; paneId: string; fraction: number }
    | { type: 'pane-collapsed'; paneId: string; collapsed: boolean }
    | { type: 'pane-reordered'; fromIdx: number; toIdx: number }
    | { type: 'layout-changed' };

type PaneEventListener = (event: PaneEvent) => void;

// ─── Constants ───────────────────────────────────────────────────

/** Minimum pane height in CSS pixels */
const MIN_PANE_PX = 60;
/** Splitter height in CSS pixels */
const SPLITTER_HEIGHT = 6;
/** Animation duration for collapse/expand (ms) */
const COLLAPSE_DURATION = 300;
/** Spring-physics cubic bezier for Apple-style animations */
const SPRING_BEZIER = 'cubic-bezier(0.32, 0.72, 0, 1)';

// ─── PaneManager Class ──────────────────────────────────────────

export class PaneManager {
    /** Root container element (replaces the old single-LayerManager container) */
    readonly root: HTMLDivElement;
    /** The original engine container (parent of root) */
    private _engineContainer: HTMLElement;
    /** Flex container holding all pane divs */
    private _flexContainer: HTMLDivElement;

    /** Main chart pane (always exists) */
    mainPane!: PaneInstance;
    /** Indicator panes in display order */
    private _indicatorPanes: PaneInstance[] = [];

    /** Event listeners */
    private _listeners: Set<PaneEventListener> = new Set();

    /** Splitter drag state */
    private _dragState: {
        active: boolean;
        paneIdx: number;
        startY: number;
        startFraction: number;
        overlay: HTMLDivElement | null;
    } = { active: false, paneIdx: -1, startY: 0, startFraction: 0.15, overlay: null };

    /** Bound event handlers for cleanup */
    private _boundOnMouseMove: (e: MouseEvent) => void;
    private _boundOnMouseUp: (e: MouseEvent) => void;

    /** Sprint 19 #128: Drag-and-drop pane reorder controller. */
    private _dragReorder: PaneDragReorder;

    /** Callback to wake the engine's render loop on container resize. */
    private _onResizeCallback: (() => void) | undefined;

    constructor(engineContainer: HTMLElement, options?: { onResize?: () => void }) {
        this._engineContainer = engineContainer;
        this._onResizeCallback = options?.onResize;

        // Create root flex container
        this.root = document.createElement('div');
        this.root.className = 'ce-pane-root';
        this.root.style.cssText = 'position:relative;width:100%;height:100%;';

        this._flexContainer = document.createElement('div');
        this._flexContainer.className = 'ce-pane-container';
        this._flexContainer.style.cssText =
            'display:flex;flex-direction:column;width:100%;height:100%;overflow:hidden;';
        this.root.appendChild(this._flexContainer);

        // Append root to engine container FIRST so child elements
        // can read dimensions from the DOM when LayerManager initializes
        engineContainer.appendChild(this.root);

        // Create the main pane (now has valid parent dimensions)
        this._createMainPane();

        // Bind drag handlers
        this._boundOnMouseMove = this._onSplitterDragMove.bind(this);
        this._boundOnMouseUp = this._onSplitterDragEnd.bind(this);

        // Sprint 19 #128: Enable drag-and-drop pane reorder
        this._dragReorder = new PaneDragReorder(this);
        this._dragReorder.attach();
    }

    // ─── Pane Accessors ────────────────────────────────────────────

    /** Get all panes in display order [main, pane_0, pane_1, ...] */
    get allPanes(): PaneInstance[] {
        return [this.mainPane, ...this._indicatorPanes];
    }

    /** Get indicator panes only (excludes main) */
    get indicatorPanes(): PaneInstance[] {
        return this._indicatorPanes;
    }

    /** Get pane count (including main) */
    get paneCount(): number {
        return 1 + this._indicatorPanes.length;
    }

    /** Get a pane by ID */
    getPane(id: string): PaneInstance | undefined {
        if (id === 'main') return this.mainPane;
        return this._indicatorPanes.find(p => p.id === id);
    }

    // ─── Pane Lifecycle ────────────────────────────────────────────

    /**
     * Sync indicator panes to match the current indicator list.
     * Adds new panes for new pane-mode indicators, removes panes for
     * removed indicators. Preserves existing panes that haven't changed.
     */
    syncIndicators(
        indicators: IndicatorConfig[],
        paneHeights?: Record<number, number>,
        collapsedPanes?: Set<number>,
    ): void {
        const paneInds = indicators.filter((i: unknown) => i.mode === 'pane');
        const overlayInds = indicators.filter((i: unknown) => i.mode === 'overlay');

        // Update main pane overlays
        this.mainPane.state.indicators = overlayInds;

        // Determine current vs desired pane count
        const currentCount = this._indicatorPanes.length;
        const desiredCount = paneInds.length;

        // Remove excess panes
        while (this._indicatorPanes.length > desiredCount) {
            this._removeLastPane();
        }

        // Add new panes
        while (this._indicatorPanes.length < desiredCount) {
            const idx = this._indicatorPanes.length;
            this._addIndicatorPane(
                paneInds[idx]!,
                idx,
                paneHeights?.[idx],
                collapsedPanes?.has(idx),
            );
        }

        // Update existing pane indicators
        for (let i = 0; i < this._indicatorPanes.length; i++) {
            const pane = this._indicatorPanes[i]!;
            pane.state.indicators = [paneInds[i]!];
            pane.state.dirty = true;
        }

        if (currentCount !== desiredCount) {
            this._relayout();
            this._emit({ type: 'layout-changed' });
        }
    }

    /**
     * Update layout heights for all panes given the total available height.
     * Main pane fills remaining space after indicator panes.
     */
    relayout(): void {
        this._relayout();
    }

    // ─── Splitter Resize ───────────────────────────────────────────

    /**
     * Set the height fraction for a specific indicator pane.
     * Sprint 11 B8: Redistributes remaining budget proportionally among siblings.
     * @param paneIdx - Index into indicator panes array (0-based)
     * @param fraction - New height fraction (clamped to MIN..MAX)
     */
    resizePane(paneIdx: number, fraction: number): void {
        if (paneIdx < 0 || paneIdx >= this._indicatorPanes.length) return;
        const pane = this._indicatorPanes[paneIdx]!;
        const oldFraction = pane.state.heightFraction;
        pane.state.setHeightFraction(fraction);
        const newFraction = pane.state.heightFraction;

        // B8: Proportional redistribution — siblings share the delta
        const delta = newFraction - oldFraction;
        if (Math.abs(delta) > 0.001 && this._indicatorPanes.length > 1) {
            const siblings = this._indicatorPanes.filter((_, i) => i !== paneIdx && !_.state.collapsed);
            const siblingTotal = siblings.reduce((sum, s) => sum + s.state.heightFraction, 0);
            if (siblingTotal > 0) {
                for (const s of siblings) {
                    const ratio = s.state.heightFraction / siblingTotal;
                    s.state.setHeightFraction(s.state.heightFraction - delta * ratio);
                }
            }
        }

        this._relayout();
        this._emit({ type: 'pane-resized', paneId: pane.id, fraction: pane.state.heightFraction });
    }

    // ─── Collapse/Expand ──────────────────────────────────────────

    /**
     * Toggle collapse state for an indicator pane.
     * @param paneIdx - Index into indicator panes array (0-based)
     */
    toggleCollapse(paneIdx: number): void {
        if (paneIdx < 0 || paneIdx >= this._indicatorPanes.length) return;
        const pane = this._indicatorPanes[paneIdx]!;
        pane.state.toggleCollapse();

        // Animate the collapse/expand via CSS transition
        const container = pane.container;
        container.style.transition = `flex-basis ${COLLAPSE_DURATION}ms ${SPRING_BEZIER}`;
        requestAnimationFrame(() => {
            this._relayout();
            // Clean up transition after animation completes
            setTimeout(() => {
                container.style.transition = '';
            }, COLLAPSE_DURATION + 50);
        });

        this._emit({ type: 'pane-collapsed', paneId: pane.id, collapsed: pane.state.collapsed });
    }

    // ─── Pane Reorder ─────────────────────────────────────────────

    /**
     * Move an indicator pane from one position to another.
     * @param fromIdx - Source position (0-based indicator pane index)
     * @param toIdx - Destination position (0-based indicator pane index)
     */
    reorderPanes(fromIdx: number, toIdx: number): void {
        if (fromIdx === toIdx) return;
        if (fromIdx < 0 || fromIdx >= this._indicatorPanes.length) return;
        if (toIdx < 0 || toIdx >= this._indicatorPanes.length) return;

        const [moved] = this._indicatorPanes.splice(fromIdx, 1);
        this._indicatorPanes.splice(toIdx, 0, moved!);

        // Reorder DOM nodes: remove all indicator panes + splitters, re-add in order
        this._rebuildDOM();
        this._relayout();
        this._emit({ type: 'pane-reordered', fromIdx, toIdx });
    }

    // ─── Snapshot / Export ─────────────────────────────────────────

    /**
     * Composite all pane canvases into a single canvas for export/screenshot.
     * Panes are stacked vertically in display order.
     */
    getSnapshotCanvas(): HTMLCanvasElement {
        const panes = this.allPanes;
        const mainBW = this.mainPane.layers.bitmapWidth || 1;

        // Calculate total bitmap height
        let totalBH = 0;
        for (const pane of panes) {
            totalBH += pane.layers.bitmapHeight || 0;
        }

        const merged = document.createElement('canvas');
        merged.width = mainBW;
        merged.height = totalBH || 1;
        const ctx = merged.getContext('2d');
        if (!ctx) return merged;

        let y = 0;
        for (const pane of panes) {
            const snap = pane.layers.getSnapshotCanvas();
            ctx.drawImage(snap, 0, y);
            y += pane.layers.bitmapHeight || 0;
        }

        return merged;
    }

    // ─── Events ────────────────────────────────────────────────────

    /** Subscribe to pane events. Returns unsubscribe function. */
    on(listener: PaneEventListener): () => void {
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    private _emit(event: PaneEvent): void {
        for (const cb of this._listeners) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            try { cb(event); } catch (_) { /* noop */ }
        }
    }

    // ─── Cleanup ───────────────────────────────────────────────────

    /** Dispose all panes, remove DOM, clean up event listeners. */
    destroy(): void {
        // Sprint 19 #128: Detach drag reorder
        this._dragReorder.detach();
        // Dispose indicator panes
        for (const pane of this._indicatorPanes) {
            pane.layers.dispose();
        }
        this._indicatorPanes = [];

        // Dispose main pane
        if (this.mainPane) {
            this.mainPane.layers.dispose();
        }

        // Remove drag handlers
        window.removeEventListener('mousemove', this._boundOnMouseMove);
        window.removeEventListener('mouseup', this._boundOnMouseUp);
        this._removeDragOverlay();

        // Remove DOM
        if (this.root.parentElement) {
            this.root.parentElement.removeChild(this.root);
        }

        this._listeners.clear();
    }

    // ─── Internal: Pane Creation ───────────────────────────────────

    private _createMainPane(): void {
        const container = document.createElement('div');
        container.className = 'ce-main-pane';
        container.style.cssText = 'flex:1 1 auto;position:relative;overflow:hidden;min-height:100px;';

        const layers = new LayerManager(container, { layerSet: 'main', onResize: this._onResizeCallback });

        const state = new PaneState({ id: 'main', type: 'main' });

        this.mainPane = {
            id: 'main',
            state,
            layers,
            container,
            splitter: null,
        };

        this._flexContainer.appendChild(container);
    }

    private _addIndicatorPane(
        indicator: IndicatorConfig,
        idx: number,
        heightFraction?: number,
        collapsed?: boolean,
    ): void {
        const paneId = `pane_${idx}`;

        // Create splitter
        const { splitter, ac: splitterAC } = this._createSplitter(idx);
        this._flexContainer.appendChild(splitter);

        // Create pane container
        const container = document.createElement('div');
        container.className = 'ce-pane';
        container.dataset.paneId = paneId;
        container.style.cssText =
            `flex:0 0 ${MIN_PANE_PX}px;position:relative;overflow:hidden;min-height:0;`;

        // Create LayerManager with indicator layer set (3 canvases: GRID, INDICATORS, UI)
        const layers = new LayerManager(container, { layerSet: 'indicator', onResize: this._onResizeCallback });

        const state = new PaneState({
            id: paneId,
            type: 'indicator',
            indicators: [indicator],
            heightFraction: heightFraction ?? PaneState.DEFAULT_FRACTION,
            collapsed: collapsed ?? false,
        });

        const pane: PaneInstance = {
            id: paneId,
            state,
            layers,
            container,
            splitter,
            _splitterAC: splitterAC,
        };

        this._indicatorPanes.push(pane);
        this._flexContainer.appendChild(container);

        this._emit({ type: 'pane-added', paneId });
    }

    private _removeLastPane(): void {
        const pane = this._indicatorPanes.pop();
        if (!pane) return;

        // Item 25: Abort all splitter event listeners before removing DOM
        pane._splitterAC?.abort();
        pane.layers.dispose();
        if (pane.splitter?.parentElement) pane.splitter.parentElement.removeChild(pane.splitter);
        if (pane.container.parentElement) pane.container.parentElement.removeChild(pane.container);

        this._emit({ type: 'pane-removed', paneId: pane.id });
    }

    // ─── Internal: Splitter Creation ───────────────────────────────

    private _createSplitter(paneIdx: number): { splitter: HTMLDivElement; ac: AbortController } {
        const ac = new AbortController();
        const signal = ac.signal;
        const splitter = document.createElement('div');
        splitter.className = 'ce-splitter';
        splitter.dataset.paneIdx = String(paneIdx);
        splitter.style.cssText = [
            `flex:0 0 ${SPLITTER_HEIGHT}px`,
            'cursor:row-resize',
            'position:relative',
            'z-index:10',
            'display:flex',
            'align-items:center',
            'justify-content:center',
            'user-select:none',
            '-webkit-user-select:none',
        ].join(';') + ';';

        // Grip indicator (3 dots)
        const grip = document.createElement('div');
        grip.className = 'ce-splitter-grip';
        grip.style.cssText = [
            'display:flex',
            'gap:4px',
            'pointer-events:none',
        ].join(';') + ';';

        for (let d = 0; d < 3; d++) {
            const dot = document.createElement('div');
            dot.style.cssText = 'width:3px;height:3px;border-radius:50%;background:rgba(120,123,134,0.6);';
            grip.appendChild(dot);
        }
        splitter.appendChild(grip);

        // Item 25: All listeners use AbortController signal for atomic cleanup
        splitter.addEventListener('mouseenter', () => {
            splitter.style.background = 'rgba(41,98,255,0.15)';
            const dots = grip.querySelectorAll('div');
            dots.forEach((d: unknown) => { d.style.background = '#2962FF'; });
        }, { signal });
        splitter.addEventListener('mouseleave', () => {
            if (!this._dragState.active) {
                splitter.style.background = '';
                const dots = grip.querySelectorAll('div');
                dots.forEach((d: unknown) => { d.style.background = 'rgba(120,123,134,0.6)'; });
            }
        }, { signal });

        // Drag start
        splitter.addEventListener('mousedown', (e: MouseEvent) => {
            if (e.button !== 0) return;
            e.preventDefault();
            this._onSplitterDragStart(paneIdx, e.clientY);
        }, { signal });

        // Double-click to collapse/expand
        splitter.addEventListener('dblclick', () => {
            this.toggleCollapse(paneIdx);
        }, { signal });

        return { splitter, ac };
    }

    // ─── Internal: Splitter Drag ───────────────────────────────────

    private _onSplitterDragStart(paneIdx: number, startY: number): void {
        if (paneIdx < 0 || paneIdx >= this._indicatorPanes.length) return;
        const pane = this._indicatorPanes[paneIdx]!;

        this._dragState = {
            active: true,
            paneIdx,
            startY,
            startFraction: pane.state.heightFraction,
            overlay: null,
        };

        // Create full-viewport overlay to prevent cursor loss
        this._createDragOverlay();

        window.addEventListener('mousemove', this._boundOnMouseMove);
        window.addEventListener('mouseup', this._boundOnMouseUp);
    }

    private _onSplitterDragMove(e: MouseEvent): void {
        if (!this._dragState.active) return;
        const { paneIdx, startY, startFraction } = this._dragState;

        // Calculate available height from the flex container
        const availH = this._flexContainer.clientHeight;
        if (availH <= 0) return;

        // Delta: dragging UP = larger pane, dragging DOWN = smaller pane
        const dy = startY - e.clientY;
        const deltaFraction = dy / availH;
        const newFraction = startFraction + deltaFraction;

        this.resizePane(paneIdx, newFraction);
    }

    private _onSplitterDragEnd(): void {
        this._dragState.active = false;
        this._removeDragOverlay();
        window.removeEventListener('mousemove', this._boundOnMouseMove);
        window.removeEventListener('mouseup', this._boundOnMouseUp);

        // Reset splitter styles
        for (const pane of this._indicatorPanes) {
            if (pane.splitter) {
                pane.splitter.style.background = '';
                const grip = pane.splitter.querySelector('.ce-splitter-grip');
                if (grip) {
                    const dots = grip.querySelectorAll('div');
                    dots.forEach((d: unknown) => { d.style.background = 'rgba(120,123,134,0.6)'; });
                }
            }
        }
    }

    private _createDragOverlay(): void {
        this._removeDragOverlay();
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:999999;cursor:ns-resize;pointer-events:all;';
        document.body.appendChild(overlay);
        this._dragState.overlay = overlay;
    }

    private _removeDragOverlay(): void {
        if (this._dragState.overlay) {
            this._dragState.overlay.remove();
            this._dragState.overlay = null;
        }
    }

    // ─── Internal: Layout ──────────────────────────────────────────

    /**
     * Recalculate and apply CSS flex-basis for all panes.
     * Main pane is flex: 1 1 auto (fills remaining space).
     * Indicator panes are flex: 0 0 Npx.
     */
    private _relayout(): void {
        const availH = this._flexContainer.clientHeight;
        if (availH <= 0) return;

        // Calculate total indicator pane height
        let totalIndicatorH = 0;
        const splitterTotal = this._indicatorPanes.length * SPLITTER_HEIGHT;

        for (const pane of this._indicatorPanes) {
            if (pane.state.collapsed) {
                totalIndicatorH += PaneState.HEADER_HEIGHT;
            } else {
                const pH = Math.max(MIN_PANE_PX, Math.floor(availH * pane.state.heightFraction));
                totalIndicatorH += pH;
            }
        }

        // Cap indicator panes at 60% of available height
        const maxIndicatorH = Math.floor(availH * 0.6);
        const scale = totalIndicatorH > maxIndicatorH ? maxIndicatorH / totalIndicatorH : 1;

        // Apply heights
        for (const pane of this._indicatorPanes) {
            let pH: number;
            if (pane.state.collapsed) {
                pH = PaneState.HEADER_HEIGHT;
            } else {
                pH = Math.max(MIN_PANE_PX, Math.floor(availH * pane.state.heightFraction * scale));
            }
            pane.state.height = pH;
            pane.container.style.flexBasis = `${pH}px`;
            pane.container.style.flex = `0 0 ${pH}px`;
            // Sprint 11 B9: Smooth spring transition on resize
            pane.container.style.transition = `flex-basis 200ms ${SPRING_BEZIER}`;
        }

        // Main pane fills remaining space (flex: 1 1 auto handles this)
        const mainH = Math.max(100, availH - totalIndicatorH * scale - splitterTotal);
        this.mainPane.state.height = mainH;

        // Mark all panes dirty so they re-render
        this.mainPane.state.dirty = true;
        for (const pane of this._indicatorPanes) {
            pane.state.dirty = true;
        }
    }

    // ─── Internal: DOM Rebuild ────────────────────────────────────

    /** Rebuild the flex container DOM to match pane order */
    private _rebuildDOM(): void {
        // Remove all children except main pane
        while (this._flexContainer.children.length > 1) {
            this._flexContainer.removeChild(this._flexContainer.lastChild!);
        }

        // Re-add in order
        for (let i = 0; i < this._indicatorPanes.length; i++) {
            const pane = this._indicatorPanes[i]!;
            // Sprint 11 B10: Update ID in-place — do NOT recreate PaneState.
            // Preserves computed state (height, dirty flags, cached render data).
            const newId = `pane_${i}`;
            pane.id = newId;
            (pane.state as unknown).id = newId;
            // Update splitter index
            if (pane!.splitter) {
                pane!.splitter.dataset.paneIdx = String(i);
            } else {
                const { splitter, ac } = this._createSplitter(i);
                pane!.splitter = splitter;
                pane!._splitterAC = ac;
            }
            this._flexContainer.appendChild(pane!.splitter!);
            this._flexContainer.appendChild(pane!.container);
        }
    }

    // ─── Cross-Pane Crosshair ─────────────────────────────────────

    /**
     * Get render contexts for a specific indicator pane.
     * Used by the render pipeline to render per-pane stages.
     */
    getPaneContexts(paneIdx: number): {
        gridCtx: CanvasRenderingContext2D;
        indicatorCtx: CanvasRenderingContext2D;
        uiCtx: CanvasRenderingContext2D;
        layers: LayerManager;
    } | null {
        if (paneIdx < 0 || paneIdx >= this._indicatorPanes.length) return null;
        const pane = this._indicatorPanes[paneIdx]!;
        const gridCtx = pane.layers.getCtx(LAYERS.GRID);
        const indicatorCtx = pane.layers.getCtx(LAYERS.INDICATORS);
        const uiCtx = pane.layers.getCtx(LAYERS.UI);
        if (!gridCtx || !indicatorCtx || !uiCtx) return null;
        return { gridCtx, indicatorCtx, uiCtx, layers: pane.layers };
    }
}
