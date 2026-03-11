// ═══════════════════════════════════════════════════════════════════
// charEdge — PaneDragReorder Unit Tests
// Sprint 19 #128
// ═══════════════════════════════════════════════════════════════════

// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaneDragReorder } from '../../charting_library/core/PaneDragReorder';

// ─── PaneManager Mock ────────────────────────────────────────────

function mockPaneManager(): unknown {
    const root = document.createElement('div');
    root.className = 'ce-pane-root';

    // Create mock splitters
    for (let i = 0; i < 3; i++) {
        const splitter = document.createElement('div');
        splitter.className = 'ce-splitter';
        splitter.dataset.paneIdx = String(i);
        root.appendChild(splitter);
    }

    return {
        root,
        indicatorPanes: [
            { id: 'pane_0', container: document.createElement('div'), state: { indicators: [{ name: 'RSI' }], isDragging: false } },
            { id: 'pane_1', container: document.createElement('div'), state: { indicators: [{ name: 'MACD' }], isDragging: false } },
            { id: 'pane_2', container: document.createElement('div'), state: { indicators: [{ name: 'Volume' }], isDragging: false } },
        ],
        reorderPanes: vi.fn(),
    };
}

// ─── Tests ──────────────────────────────────────────────────────

describe('PaneDragReorder', () => {
    let pm: ReturnType<typeof mockPaneManager>;
    let drag: PaneDragReorder;

    beforeEach(() => {
        pm = mockPaneManager();
        drag = new PaneDragReorder(pm);
    });

    it('attaches and detaches without errors', () => {
        expect(() => drag.attach()).not.toThrow();
        expect(() => drag.detach()).not.toThrow();
    });

    it('attaches twice cleanly (detaches old first)', () => {
        drag.attach();
        drag.attach(); // Should not throw
        drag.detach();
    });

    it('does not crash when detaching without attach', () => {
        expect(() => drag.detach()).not.toThrow();
    });

    it('mousedown on splitter does not immediately enter drag mode', () => {
        drag.attach();

        const splitter = pm.root.querySelector('.ce-splitter')!;
        const event = new MouseEvent('mousedown', { clientY: 100, button: 0, bubbles: true });
        splitter.dispatchEvent(event);

        // No ghost should be created yet (200ms hold required)
        const ghost = document.querySelector('.ce-drag-ghost');
        expect(ghost).toBeNull();

        drag.detach();
    });

    it('mouseup cancels hold timer before drag starts', () => {
        drag.attach();

        const splitter = pm.root.querySelector('.ce-splitter')!;
        splitter.dispatchEvent(new MouseEvent('mousedown', { clientY: 100, button: 0, bubbles: true }));

        // Quick mouseup before hold threshold
        window.dispatchEvent(new MouseEvent('mouseup', { clientY: 100 }));

        // reorderPanes should NOT have been called
        expect(pm.reorderPanes).not.toHaveBeenCalled();

        drag.detach();
    });

    it('moving mouse > 5px cancels hold timer', () => {
        drag.attach();

        const splitter = pm.root.querySelector('.ce-splitter')!;
        splitter.dispatchEvent(new MouseEvent('mousedown', { clientY: 100, button: 0, bubbles: true }));

        // Move more than 5px
        window.dispatchEvent(new MouseEvent('mousemove', { clientY: 110 }));

        // Wait past hold threshold — should NOT enter drag mode
        return new Promise<void>((resolve) => {
            setTimeout(() => {
                const ghost = document.querySelector('.ce-drag-ghost');
                expect(ghost).toBeNull();
                drag.detach();
                resolve();
            }, 250);
        });
    });
});
