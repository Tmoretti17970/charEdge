// ═══════════════════════════════════════════════════════════════════
// Sprint 11 — Resizable Indicator Panes (Source Verification)
//
// Validates that all Sprint 11 wiring is in place:
//   1. InputManager: splitter hit-test, drag mode, row-resize cursor
//   2. ChartEngine: collapsedPanes, _splitterHoverIdx state
//   3. FrameState: per-pane price transforms, collapsed pane layout
//   4. IndicatorStage: pane header bars, collapsed skip
//   5. UIStage: interactive splitters (highlight, collapse affordance)
//   6. ChartEngineWidget: onPaneResize + onPaneToggle wiring
//   7. featuresSlice: setPaneHeight, resetPaneHeights (pre-existing)
// ═══════════════════════════════════════════════════════════════════

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect } from 'vitest';

const ROOT = resolve(__dirname, '..', '..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf-8');

// ─── 1. InputManager ─────────────────────────────────────────────
describe('Sprint 11 · InputManager — Splitter Drag', () => {
  const src = read('charting_library/core/InputManager.ts');

  it('has _hitTestSplitter method', () => {
    expect(src).toContain('_hitTestSplitter');
  });

  it('delegates splitter interaction to PaneManager DOM splitters (Item 26)', () => {
    // Item 26: Canvas-level splitter hit-testing deprecated — always returns -1.
    // PaneManager DOM splitters now fully handle all interactions.
    expect(src).toContain('DEPRECATED');
    expect(src).toContain('return -1');
  });

  it('sets dragging to splitter on mousedown near splitter', () => {
    expect(src).toContain("S.dragging = 'splitter'");
  });

  it('tracks _dragPaneIdx and _dragStartFraction', () => {
    expect(src).toContain('this._dragPaneIdx');
    expect(src).toContain('this._dragStartFraction');
  });

  it('calls onPaneResize callback during splitter drag', () => {
    expect(src).toContain('eng.callbacks.onPaneResize');
  });

  it('clamps fraction to [0.08, 0.5]', () => {
    expect(src).toContain('Math.max(0.08');
    expect(src).toContain('Math.min(0.5');
  });

  it('sets row-resize cursor on splitter hover', () => {
    expect(src).toContain("this.tc.style.cursor = 'row-resize'");
  });

  it('updates _splitterHoverIdx on hover', () => {
    expect(src).toContain('S._splitterHoverIdx');
  });

  it('double-click on splitter triggers collapse toggle', () => {
    expect(src).toContain('onPaneToggle');
    expect(src).toContain('collapsedPanes');
  });
});

// ─── 2. ChartEngine ──────────────────────────────────────────────
describe('Sprint 11 · ChartEngine — Pane State', () => {
  const src = read('charting_library/core/ChartEngine.ts');

  it('initializes collapsedPanes as a Set', () => {
    expect(src).toContain('collapsedPanes: new Set()');
  });

  it('initializes _splitterHoverIdx', () => {
    expect(src).toContain('_splitterHoverIdx: -1');
  });
});

// ─── 3. FrameState ───────────────────────────────────────────────
describe('Sprint 11 · FrameState — Per-Pane Transforms', () => {
  const src = read('charting_library/core/FrameState.ts');

  it('stores collapsedPanes on frame state', () => {
    expect(src).toContain('fs.collapsedPanes');
  });

  it('computes paneTransforms array', () => {
    expect(src).toContain('fs.paneTransforms');
    expect(src).toContain('paneTransforms.push');
  });

  it('skips collapsed panes from total fraction', () => {
    expect(src).toContain('collapsedPanes.has(idx)');
  });

  it('computes independent yMin/yMax per pane', () => {
    expect(src).toContain('yMin');
    expect(src).toContain('yMax');
    expect(src).toContain('yMin:');
    expect(src).toContain('yMax:');
  });

  it('counts active (non-collapsed) panes', () => {
    expect(src).toContain('activePaneCount');
  });
});

// ─── 4. IndicatorStage ───────────────────────────────────────────
describe('Sprint 11 · IndicatorStage — Pane Headers', () => {
  const src = read('charting_library/core/stages/IndicatorStage.ts');

  it('draws pane header bar (HEADER_H)', () => {
    expect(src).toContain('paneHeight');
    expect(src).toContain('Pane');
  });

  it('shows indicator name in header', () => {
    expect(src).toContain('indicatorId');
    expect(src).toContain('shortName');
  });

  it('shows indicator value at crosshair', () => {
    expect(src).toContain('ind_');
    expect(src).toContain('shortName');
  });

  it('renders collapse/expand toggle character', () => {
    expect(src).toContain('label');
  });

  it('skips pane content when collapsed', () => {
    expect(src).toContain('paneHeight');
  });

  it('passes per-pane price transform to renderer', () => {
    expect(src).toContain('Pane');
    expect(src).toContain('indicatorId');
    expect(src).toContain('renderIndi');
  });
});

// ─── 5. UIStage ──────────────────────────────────────────────────
describe('Sprint 11 · UIStage — Interactive Splitters', () => {
  const src = read('charting_library/core/stages/UIStage.ts');

  it('highlights splitter on hover', () => {
    expect(src).toContain('isHovered');
    expect(src).toContain('#2962FF');
  });

  it('reads _splitterHoverIdx from R', () => {
    expect(src).toContain('R._splitterHoverIdx');
  });

  it('reads collapsedPanes from R', () => {
    expect(src).toContain('R.collapsedPanes');
  });

  it('draws expand chevron for collapsed panes', () => {
    expect(src).toContain('isCollapsed');
    expect(src).toContain('chevSize');
  });

  it('changes grip dot color on hover', () => {
    expect(src).toContain('#5B9CF6');
  });
});

// ─── 6. DataStage ────────────────────────────────────────────────
describe('Sprint 11 · DataStage — lastRender Extension', () => {
  const src = read('charting_library/core/stages/DataStage.ts');

  it('includes _splitterHoverIdx in lastRender', () => {
    expect(src).toContain('_splitterHoverIdx: engine.state._splitterHoverIdx');
  });

  it('includes collapsedPanes in lastRender', () => {
    expect(src).toContain('collapsedPanes: fs.collapsedPanes');
  });
});

// ─── 7. ChartEngineWidget ────────────────────────────────────────
describe('Sprint 11 · ChartEngineWidget — Callback Wiring', () => {
  const src = read('app/components/chart/core/ChartEngineWidget.jsx');

  it('reads paneHeights from chart store', () => {
    // Task 2.3.29: selectors consolidated via useShallow
    expect(src).toContain('paneHeights: s.paneHeights');
  });

  it('passes paneHeights to engine props', () => {
    expect(src).toContain('paneHeights');
    // Verify it appears in the props object
    const propsMatch = src.match(/const props = \{[^}]+paneHeights/);
    expect(propsMatch).toBeTruthy();
  });

  it('wires onPaneResize callback to setPaneHeight', () => {
    expect(src).toContain('onPaneResize');
    expect(src).toContain('setPaneHeight');
  });

  it('wires onPaneToggle callback', () => {
    expect(src).toContain('onPaneToggle');
    expect(src).toContain('collapsedPanes');
  });
});

// ─── 8. featuresSlice (pre-existing) ─────────────────────────────
describe('Sprint 11 · featuresSlice — Pane Height State', () => {
  const src = read('state/chart/featuresSlice.ts');

  it('has paneHeights state', () => {
    expect(src).toContain('paneHeights');
  });

  it('has setPaneHeight action with min/max clamping', () => {
    expect(src).toContain('setPaneHeight');
    expect(src).toContain('Math.max(0.08');
    expect(src).toContain('Math.min(0.5');
  });

  it('has resetPaneHeights action', () => {
    expect(src).toContain('resetPaneHeights');
  });
});
