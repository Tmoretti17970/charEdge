// ═══════════════════════════════════════════════════════════════════
// Sprint 12 — Indicator Legend Bar (Source Verification)
//
// Validates that all Sprint 12 wiring is in place:
//   1. UIStage: drawLegendBar renders OHLCV + indicator values
//   2. InputManager: _hitTestLegend, click-to-highlight, eye toggle
//   3. ChartEngine: _highlightedIndicator, hiddenIndicators, _legendHitRegions
//   4. IndicatorStage: hidden skip, highlight/dim with globalAlpha
//   5. ChartEngineWidget: toggle-indicator event wiring
// ═══════════════════════════════════════════════════════════════════

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect } from 'vitest';

const ROOT = resolve(__dirname, '..', '..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf-8');

// ─── 1. UIStage ──────────────────────────────────────────────────
describe('Sprint 12 · UIStage — Legend Bar Rendering', () => {
  const src = read('charting_library/core/stages/UIStage.ts');

  it('has drawLegendBar function', () => {
    expect(src).toContain('function drawLegendBar');
  });

  it('calls drawLegendBar in executeUIStage', () => {
    expect(src).toContain('drawLegendBar(tCtx');
  });

  it('renders symbol label', () => {
    expect(src).toContain('symLabel');
    expect(src).toContain("fs.symbol");
  });

  it('renders OHLCV values', () => {
    expect(src).toContain("label: 'O'");
    expect(src).toContain("label: 'H'");
    expect(src).toContain("label: 'L'");
    expect(src).toContain("label: 'C'");
    expect(src).toContain("'Vol'");
  });

  it('colors values based on bull/bear', () => {
    expect(src).toContain('bullColor');
    expect(src).toContain('bearColor');
    expect(src).toContain('valColor');
  });

  it('has formatVolume helper for compact volume display', () => {
    expect(src).toContain('function formatVolume');
    expect(src).toMatch(/1e6|1e9|1e3/);
  });

  it('renders indicator color dot + name + values', () => {
    expect(src).toContain('indicator');
    expect(src).toContain('ind.label');
    expect(src).toContain('ind.label');
    expect(src).toContain('ind.label');
  });

  it('supports highlight/dim for indicators', () => {
    expect(src).toContain('eye');
    expect(src).toContain('indicator');
    expect(src).toContain('_legendHitRegions');
  });

  it('renders eye icon for toggle visibility', () => {
    expect(src).toContain('indicator');
    expect(src).toContain('dot');
    expect(src).toContain('eye');
  });

  it('stores hit regions for InputManager', () => {
    expect(src).toContain('_legendHitRegions');
    expect(src).toContain('indicator');
    expect(src).toContain('hitRegion');
  });

  it('shows values at crosshair or latest bar', () => {
    expect(src).toContain('fs.hoverIdx');
    expect(src).toContain('bars.length - 1');
  });
});

// ─── 2. InputManager ─────────────────────────────────────────────
describe('Sprint 12 · InputManager — Legend Interaction', () => {
  const src = read('charting_library/core/InputManager.ts');

  it('has _hitTestLegend method', () => {
    expect(src).toContain('_hitTestLegend');
  });

  it('checks _legendHitRegions for click detection', () => {
    expect(src).toContain('_legendHitRegions');
    expect(src).toContain('r.type');
    expect(src).toContain('r.idx');
  });

  it('handles indicator click to toggle highlight', () => {
    expect(src).toContain("legendHit.type === 'indicator'");
    expect(src).toContain('_highlightedIndicator');
  });

  it('handles eye click to toggle visibility', () => {
    expect(src).toContain("legendHit.type === 'eye'");
    expect(src).toContain('hiddenIndicators');
  });

  it('dispatches toggle-indicator event', () => {
    expect(src).toContain("charEdge:toggle-indicator");
  });

  it('sets pointer cursor on legend hover', () => {
    expect(src).toContain("this.tc.style.cursor = 'pointer'");
  });
});

// ─── 3. ChartEngine ──────────────────────────────────────────────
describe('Sprint 12 · ChartEngine — Legend State', () => {
  const src = read('charting_library/core/ChartEngine.ts');

  it('has _highlightedIndicator state', () => {
    expect(src).toContain('_highlightedIndicator: -1');
  });

  it('has hiddenIndicators as a Set', () => {
    expect(src).toContain('hiddenIndicators: new Set()');
  });

  it('has _legendHitRegions array', () => {
    expect(src).toContain('_legendHitRegions: []');
  });
});

// ─── 4. IndicatorStage ───────────────────────────────────────────
describe('Sprint 12 · IndicatorStage — Highlight & Hidden', () => {
  const src = read('charting_library/core/stages/IndicatorStage.ts');

  it('reads _highlightedIndicator from engine state', () => {
    expect(src).toContain('_highlightedIndicator');
    expect(src).toContain('highlightIdx');
  });

  it('reads hiddenIndicators from engine state', () => {
    expect(src).toContain('hiddenIndicators');
    expect(src).toContain('hiddenSet');
  });

  it('skips hidden indicators', () => {
    expect(src).toContain('hiddenSet.has(oi)');
    expect(src).toContain('skip hidden');
  });

  it('dims non-highlighted indicators with globalAlpha', () => {
    expect(src).toContain('isDimmed');
    expect(src).toContain('globalAlpha');
    expect(src).toContain('globalAlpha = 1');
  });
});

// ─── 5. ChartEngineWidget ────────────────────────────────────────
describe('Sprint 12 · ChartEngineWidget — Event Wiring', () => {
  const src = read('app/components/chart/core/ChartEngineWidget.jsx');

  it('listens for toggle-indicator event', () => {
    expect(src).toContain("charEdge:toggle-indicator");
    expect(src).toContain('onToggleIndicator');
  });

  it('toggles hiddenIndicators in engine state', () => {
    expect(src).toContain('hiddenIndicators.has(idx)');
    expect(src).toContain('hiddenIndicators.delete(idx)');
    expect(src).toContain('hiddenIndicators.add(idx)');
  });

  it('cleans up toggle-indicator listener on unmount', () => {
    const cleanupMatches = src.match(/removeEventListener.*toggle-indicator/g);
    expect(cleanupMatches).toBeTruthy();
    expect(cleanupMatches.length).toBeGreaterThanOrEqual(1);
  });
});
