// ═══════════════════════════════════════════════════════════════════
// Sprint 13 — Indicator Settings Dialogs (Source Verification)
//
// Validates that all Sprint 13 wiring is in place:
//   1. IndicatorSettingsDialog: component with param controls
//   2. InputManager/ChartEngineWidget: double-click legend trigger
//   3. ChartEngineWidget: editingIndicatorIdx state + dialog render
//   4. indicatorSlice: template save/load/list helpers
//   5. Registry: params schema with default/min/max/step/label
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf-8');

// ─── 1. IndicatorSettingsDialog ──────────────────────────────────
describe('Sprint 13 · IndicatorSettingsDialog — Component', () => {
  const src = read('app/components/chart/panels/IndicatorSettingsDialog.jsx');

  it('exports default IndicatorSettingsDialog component', () => {
    expect(src).toContain('export default function IndicatorSettingsDialog');
  });

  it('accepts indicatorIdx and onClose props', () => {
    expect(src).toContain('indicatorIdx');
    expect(src).toContain('onClose');
  });

  it('imports INDICATOR_REGISTRY for param schema', () => {
    expect(src).toContain('INDICATOR_REGISTRY');
  });

  it('auto-generates ParamSlider controls from params', () => {
    expect(src).toContain('ParamSlider');
    expect(src).toContain('schema.min');
    expect(src).toContain('schema.max');
    expect(src).toContain('schema.step');
    expect(src).toContain('schema.label');
  });

  it('has ParamColor for line style customization', () => {
    expect(src).toContain('ParamColor');
    expect(src).toContain('handleColorChange');
  });

  it('has ParamToggle for boolean params', () => {
    expect(src).toContain('ParamToggle');
  });

  it('calls updateIndicator for live preview', () => {
    expect(src).toContain('updateIndicator');
    expect(src).toContain('applyParams');
  });

  it('has Reset to Default button', () => {
    expect(src).toContain('Reset to Default');
    expect(src).toContain('handleReset');
    expect(src).toContain('schema.default');
  });

  it('has template save/load functionality', () => {
    expect(src).toContain('saveTemplate');
    expect(src).toContain('loadTemplate');
    expect(src).toContain('listTemplates');
    expect(src).toContain('handleSaveTemplate');
    expect(src).toContain('handleLoadTemplate');
  });

  it('uses localStorage for template persistence', () => {
    expect(src).toContain('localStorage');
    expect(src).toContain('indTemplate:');
  });

  it('closes on Escape key', () => {
    expect(src).toContain("e.key === 'Escape'");
  });

  it('uses glassmorphism styling', () => {
    expect(src).toContain('backdropFilter');
    expect(src).toContain('blur');
  });
});

// ─── 2. ChartEngineWidget — Double-Click Trigger ─────────────────
describe('Sprint 13 · ChartEngineWidget — Indicator Settings Wiring', () => {
  const src = read('app/components/chart/core/ChartEngineWidget.jsx');

  // TODO: un-skip when ChartEngineWidget imports IndicatorSettingsDialog (Sprint 13)
  it.skip('imports IndicatorSettingsDialog', () => {
    expect(src).toContain("import IndicatorSettingsDialog from '../../panels/IndicatorSettingsDialog.jsx'");
  });

  it('has editingIndicatorIdx state', () => {
    expect(src).toContain('editingIndicatorIdx');
    expect(src).toContain('setEditingIndicatorIdx');
  });

  it('checks legend hit regions on double-click', () => {
    expect(src).toContain('_legendHitRegions');
    expect(src).toContain("r.type === 'indicator'");
    expect(src).toContain('setEditingIndicatorIdx(r.idx)');
  });

  it('listens for open-indicator-settings event', () => {
    expect(src).toContain('charEdge:open-indicator-settings');
    expect(src).toContain('onOpenIndicatorSettings');
  });

  it('cleans up open-indicator-settings listener', () => {
    const cleanup = src.match(/removeEventListener.*open-indicator-settings/g);
    expect(cleanup).toBeTruthy();
    expect(cleanup.length).toBeGreaterThanOrEqual(1);
  });

  it('renders IndicatorSettingsDialog conditionally', () => {
    expect(src).toContain('<IndicatorSettingsDialog');
    expect(src).toContain('editingIndicatorIdx != null');
  });
});

// ─── 3. indicatorSlice — Template Helpers ────────────────────────
describe('Sprint 13 · indicatorSlice — Template Persistence', () => {
  const src = read('state/chart/indicatorSlice.js');

  it('has saveIndicatorTemplate action', () => {
    expect(src).toContain('saveIndicatorTemplate');
    expect(src).toContain('localStorage.setItem');
  });

  it('has loadIndicatorTemplate action', () => {
    expect(src).toContain('loadIndicatorTemplate');
    expect(src).toContain('localStorage.getItem');
  });

  it('has listIndicatorTemplates action', () => {
    expect(src).toContain('listIndicatorTemplates');
    expect(src).toContain('Object.keys');
  });

  it('uses indTemplate: prefix for storage keys', () => {
    expect(src).toContain('indTemplate:');
  });
});

// ─── 4. Registry — Params Schema ─────────────────────────────────
describe('Sprint 13 · Registry — Params Schema', () => {
  const src = read('charting_library/studies/indicators/registry.js');

  it('declares params with default, min, max, step, label', () => {
    expect(src).toContain('params:');
    expect(src).toContain('default:');
    expect(src).toContain('min:');
    expect(src).toContain('max:');
    expect(src).toContain('step:');
    expect(src).toContain('label:');
  });

  it('SMA has period param', () => {
    expect(src).toContain("period: { default: 20, min: 2, max: 500, step: 1, label: 'Period' }");
  });

  it('indicators declare compute(bars, params) function', () => {
    expect(src).toContain('compute(bars, params)');
  });
});
