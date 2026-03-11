// ═══════════════════════════════════════════════════════════════════
// charEdge — PaneDragReorder: Interactive Drag-and-Drop (#128)
//
// Sprint 19 #128: Drag-and-drop pane reorder with spring animation.
// Hooks into PaneManager's splitter elements — long-press (200ms)
// on a splitter enters drag mode with a ghost element, drop zone
// indicators, and spring-ease release animation.
//
// Key behaviors:
//   - 200ms hold threshold (prevents accidental drags on resize)
//   - Ghost element follows cursor with 0.7 opacity
//   - Blue drop indicators between panes
//   - Spring cubic-bezier on release into final position
//   - Calls PaneManager.reorderPanes() on successful drop
// ═══════════════════════════════════════════════════════════════════

import type { PaneManager, PaneInstance } from './PaneManager.ts';

// ─── Constants ───────────────────────────────────────────────────

/** Hold duration (ms) before entering drag mode. */
const HOLD_THRESHOLD_MS = 200;
/** Ghost element opacity during drag. */
const GHOST_OPACITY = 0.7;
/** Spring bezier for release animation. */
const SPRING_BEZIER = 'cubic-bezier(0.32, 0.72, 0, 1)';
/** Release animation duration (ms). */
const SPRING_DURATION_MS = 350;
/** Drop indicator height. */
const DROP_LINE_HEIGHT = 3;
/** Drop indicator color. */
const DROP_LINE_COLOR = '#2962FF';

// ─── PaneDragReorder ─────────────────────────────────────────────

export class PaneDragReorder {
    private _pm: PaneManager;
    private _ac: AbortController | null = null;

    // Drag state
    private _holdTimer: ReturnType<typeof setTimeout> | null = null;
    private _dragging = false;
    private _sourceIdx = -1;
    private _targetIdx = -1;
    private _startY = 0;

    // DOM elements
    private _ghost: HTMLDivElement | null = null;
    private _overlay: HTMLDivElement | null = null;
    private _dropLines: HTMLDivElement[] = [];

    constructor(paneManager: PaneManager) {
        this._pm = paneManager;
    }

    // ─── Lifecycle ───────────────────────────────────────────────

    /** Attach drag listeners to all pane splitters. */
    attach(): void {
        this.detach(); // Clean previous
        this._ac = new AbortController();
        const signal = this._ac.signal;

        // Listen on the flex container for bubbled mousedown on splitters
        this._pm.root.addEventListener('mousedown', (e: MouseEvent) => {
            const splitter = (e.target as HTMLElement).closest?.('.ce-splitter') as HTMLElement | null;
            if (!splitter) return;
            const paneIdx = parseInt(splitter.dataset.paneIdx ?? '-1', 10);
            if (paneIdx < 0) return;

            // Start hold timer — enters drag mode after threshold
            this._startY = e.clientY;
            this._sourceIdx = paneIdx;
            this._holdTimer = setTimeout(() => {
                this._enterDragMode(paneIdx, e.clientY);
            }, HOLD_THRESHOLD_MS);
        }, { signal });

        // Global mouse move / up
        window.addEventListener('mousemove', this._onMouseMove, { signal });
        window.addEventListener('mouseup', this._onMouseUp, { signal });
    }

    /** Remove all drag listeners. */
    detach(): void {
        this._ac?.abort();
        this._ac = null;
        this._cleanupDrag();
    }

    // ─── Drag Mode ───────────────────────────────────────────────

    private _enterDragMode(paneIdx: number, startY: number): void {
        this._dragging = true;
        this._sourceIdx = paneIdx;
        this._startY = startY;
        this._targetIdx = paneIdx;

        const pane = this._pm.indicatorPanes[paneIdx];
        if (!pane) return;

        // Mark source pane as dragging (for visual dimming)
        (pane.state as unknown).isDragging = true;
        pane.container.style.opacity = '0.4';
        pane.container.style.transition = `opacity 200ms ${SPRING_BEZIER}`;

        // Create ghost element
        this._createGhost(pane, startY);

        // Create overlay to capture all mouse events
        this._overlay = document.createElement('div');
        this._overlay.style.cssText = 'position:fixed;inset:0;z-index:999998;cursor:grabbing;';
        document.body.appendChild(this._overlay);

        // Create drop indicators between each pane
        this._createDropIndicators();
    }

    // ─── Mouse Handlers ──────────────────────────────────────────

    private _onMouseMove = (e: MouseEvent): void => {
        if (!this._dragging) {
            // If moved too far before hold, cancel
            if (this._holdTimer && Math.abs(e.clientY - this._startY) > 5) {
                clearTimeout(this._holdTimer);
                this._holdTimer = null;
            }
            return;
        }

        // Move ghost
        if (this._ghost) {
            this._ghost.style.top = `${e.clientY - 20}px`;
        }

        // Determine which drop zone is closest
        this._updateDropTarget(e.clientY);
    };

    private _onMouseUp = (_e: MouseEvent): void => {
        // Cancel hold timer if still pending
        if (this._holdTimer) {
            clearTimeout(this._holdTimer);
            this._holdTimer = null;
        }

        if (!this._dragging) return;

        // Perform reorder if target changed
        if (this._targetIdx !== -1 && this._targetIdx !== this._sourceIdx) {
            this._pm.reorderPanes(this._sourceIdx, this._targetIdx);
        }

        // Animate spring release
        this._animateRelease();
    };

    // ─── Ghost Element ───────────────────────────────────────────

    private _createGhost(pane: PaneInstance, startY: number): void {
        this._ghost = document.createElement('div');
        this._ghost.className = 'ce-drag-ghost';
        this._ghost.style.cssText = [
            'position:fixed',
            `top:${startY - 20}px`,
            'left:20%',
            'width:60%',
            'height:40px',
            `opacity:${GHOST_OPACITY}`,
            'z-index:999999',
            'pointer-events:none',
            'border-radius:8px',
            'background:rgba(41,98,255,0.15)',
            'border:2px solid #2962FF',
            'backdrop-filter:blur(8px)',
            'display:flex',
            'align-items:center',
            'justify-content:center',
            'font-size:12px',
            'color:#2962FF',
            'font-weight:600',
            'box-shadow:0 8px 24px rgba(0,0,0,0.15)',
            `transition:top 50ms ${SPRING_BEZIER}`,
        ].join(';') + ';';

        // Label
        const indicator = pane.state.indicators[0];
        const label = indicator ? ((indicator as unknown).name || (indicator as unknown).indicatorId || `Pane ${this._sourceIdx}`) : `Pane ${this._sourceIdx}`;
        this._ghost.textContent = `↕ ${label}`;

        document.body.appendChild(this._ghost);
    }

    // ─── Drop Indicators ─────────────────────────────────────────

    private _createDropIndicators(): void {
        const panes = this._pm.indicatorPanes;
        this._dropLines = [];

        for (let i = 0; i <= panes.length; i++) {
            const line = document.createElement('div');
            line.className = 'ce-drop-indicator';
            line.style.cssText = [
                'position:absolute',
                'left:5%',
                'width:90%',
                `height:${DROP_LINE_HEIGHT}px`,
                `background:${DROP_LINE_COLOR}`,
                'border-radius:2px',
                'z-index:999997',
                'opacity:0',
                `transition:opacity 150ms ${SPRING_BEZIER}`,
                'pointer-events:none',
            ].join(';') + ';';

            // Position relative to pane containers
            let topPx: number;
            if (i === 0) {
                // Before first pane
                const firstContainer = panes[0]?.container;
                topPx = firstContainer ? firstContainer.getBoundingClientRect().top : 0;
            } else {
                // After pane[i-1]
                const prevContainer = panes[i - 1]?.container;
                const rect = prevContainer?.getBoundingClientRect();
                topPx = rect ? rect.bottom : 0;
            }
            line.style.top = `${topPx}px`;
            line.style.position = 'fixed';
            line.dataset.dropIdx = String(i);

            document.body.appendChild(line);
            this._dropLines.push(line);
        }
    }

    private _updateDropTarget(mouseY: number): void {
        let closestIdx = -1;
        let closestDist = Infinity;

        for (let i = 0; i < this._dropLines.length; i++) {
            const line = this._dropLines[i]!;
            const lineY = parseFloat(line.style.top);
            const dist = Math.abs(mouseY - lineY);

            if (dist < closestDist) {
                closestDist = dist;
                closestIdx = i;
            }

            // Reset opacity
            line.style.opacity = '0';
        }

        if (closestIdx >= 0 && closestDist < 60) {
            this._dropLines[closestIdx]!.style.opacity = '1';
            // Convert drop position to pane index
            this._targetIdx = closestIdx > this._sourceIdx
                ? closestIdx - 1
                : closestIdx;
        }
    }

    // ─── Animation ───────────────────────────────────────────────

    private _animateRelease(): void {
        // Restore source pane opacity with spring
        const pane = this._pm.indicatorPanes[this._targetIdx >= 0 ? this._targetIdx : this._sourceIdx];
        if (pane) {
            pane.container.style.transition = `opacity ${SPRING_DURATION_MS}ms ${SPRING_BEZIER}`;
            pane.container.style.opacity = '1';
            (pane.state as unknown).isDragging = false;
            setTimeout(() => {
                pane.container.style.transition = '';
            }, SPRING_DURATION_MS + 50);
        }

        // Also restore any previously dimmed source pane
        const sourcePaneStill = this._pm.indicatorPanes[this._sourceIdx];
        if (sourcePaneStill && sourcePaneStill !== pane) {
            sourcePaneStill.container.style.opacity = '1';
            (sourcePaneStill.state as unknown).isDragging = false;
        }

        this._cleanupDrag();
    }

    // ─── Cleanup ─────────────────────────────────────────────────

    private _cleanupDrag(): void {
        this._dragging = false;
        this._sourceIdx = -1;
        this._targetIdx = -1;

        if (this._holdTimer) {
            clearTimeout(this._holdTimer);
            this._holdTimer = null;
        }

        if (this._ghost) {
            this._ghost.remove();
            this._ghost = null;
        }

        if (this._overlay) {
            this._overlay.remove();
            this._overlay = null;
        }

        for (const line of this._dropLines) {
            line.remove();
        }
        this._dropLines = [];
    }
}
