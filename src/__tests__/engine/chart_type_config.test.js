// ═══════════════════════════════════════════════════════════════════
// Sprint 15 — Chart Type Configuration (Source Verification)
//
// Validates Sprint 15 enhancements:
//   1. ChartTypes.js — configParams schema, caching, getChartTypeDefaults
//   2. uiSlice.js — chartTypeConfig state, persistence
//   3. ChartSettingsPanel.jsx — Chart Type tab
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf-8');

// ─── 1. ChartTypes.js — configParams & Caching ──────────────────
describe('Sprint 15 · ChartTypes — configParams schema', () => {
  const src = read('charting_library/renderers/renderers/ChartTypes.js');

  it('has configParams on Renko chart type', () => {
    expect(src).toContain("renko:");
    expect(src).toContain("boxSizeMode:");
    expect(src).toContain("brickStyle:");
  });

  it('has configParams on Point & Figure chart type', () => {
    expect(src).toContain("pointfigure:");
    expect(src).toContain("reversalCount:");
  });

  it('has configParams on Heikin-Ashi chart type', () => {
    expect(src).toContain("heikinashi:");
    expect(src).toContain("smoothing:");
  });

  it('has configParams on Baseline chart type', () => {
    expect(src).toContain("baseline:");
    expect(src).toContain("baselinePrice:");
    expect(src).toContain("topFillColor:");
    expect(src).toContain("bottomFillColor:");
  });

  it('exports getChartTypeDefaults function', () => {
    expect(src).toContain('export function getChartTypeDefaults(typeId)');
  });

  it('has computation cache for P&F columns', () => {
    expect(src).toContain('_pnfCache');
    expect(src).toContain('_cacheKey');
    expect(src).toContain('_buildPnfColumns');
  });

  it('reads chartTypeConfig from params in draw functions', () => {
    expect(src).toContain('params.chartTypeConfig');
  });
});

// ─── 2. ChartTypes.js — Config-Aware Draw Functions ──────────────
describe('Sprint 15 · ChartTypes — Draw function config support', () => {
  const src = read('charting_library/renderers/renderers/ChartTypes.js');

  it('Renko supports hollow brick style', () => {
    expect(src).toContain("cfg.brickStyle === 'hollow'");
    expect(src).toContain('strokeRect');
  });

  it('P&F supports configurable reversal count', () => {
    expect(src).toContain('cfg.reversalCount');
  });

  it('P&F supports fixed box size mode', () => {
    expect(src).toContain("cfg.boxSizeMode === 'fixed'");
    expect(src).toContain('cfg.fixedBoxSize');
  });

  it('P&F supports filled style', () => {
    expect(src).toContain("cfg.style === 'filled'");
  });

  it('Heikin-Ashi supports multi-pass smoothing', () => {
    expect(src).toContain('cfg.smoothing');
    expect(src).toContain('smoothing passes');
  });

  it('Baseline supports custom base price', () => {
    expect(src).toContain("cfg.baselinePrice === 'custom'");
    expect(src).toContain('cfg.customBasePrice');
  });

  it('Baseline supports custom fill colors', () => {
    expect(src).toContain('cfg.topFillColor');
    expect(src).toContain('cfg.bottomFillColor');
  });
});

// ─── 3. uiSlice.js — chartTypeConfig state ───────────────────────
describe('Sprint 15 · uiSlice — Chart Type Config State', () => {
  const src = read('state/chart/uiSlice.js');

  it('has chartTypeConfig state', () => {
    expect(src).toContain('chartTypeConfig:');
  });

  it('has setChartTypeConfig action', () => {
    expect(src).toContain('setChartTypeConfig:');
  });

  it('has resetChartTypeConfig action', () => {
    expect(src).toContain('resetChartTypeConfig:');
  });

  it('persists to localStorage', () => {
    expect(src).toContain('charEdge-chart-type-config');
  });
});

// ─── 4. ChartSettingsPanel.jsx — Chart Type Tab ──────────────────
describe('Sprint 15 · ChartSettingsPanel — Chart Type Tab', () => {
  const src = read('app/components/chart/panels/ChartSettingsPanel.jsx');

  it('imports CHART_TYPES and getChartTypeDefaults', () => {
    expect(src).toContain('CHART_TYPES');
    expect(src).toContain('getChartTypeDefaults');
  });

  it('has chartType tab in TABS array', () => {
    expect(src).toContain("{ id: 'chartType'");
  });

  it('renders chartType tab content', () => {
    expect(src).toContain("tab === 'chartType'");
  });

  it('reads configParams from active chart type', () => {
    expect(src).toContain('typeEntry?.configParams');
  });

  it('renders controls from configParams schema', () => {
    expect(src).toContain("p.type === 'range'");
    expect(src).toContain("p.type === 'select'");
    expect(src).toContain("p.type === 'color'");
    expect(src).toContain("p.type === 'number'");
  });

  it('has Reset to Defaults for chart type config', () => {
    expect(src).toContain('resetChartTypeConfig');
  });
});
