// Sprint 21 — Color & Theme System (Source Verification)
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect } from 'vitest';
const ROOT = resolve(__dirname, '..', '..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf-8');

describe('Sprint 21 · ThemeManager — Color & Theme System', () => {
  const src = read('charting_library/core/ThemeManager.js');

  it('exports Bloomberg theme preset', () => {
    expect(src).toContain('BLOOMBERG_THEME');
    expect(src).toContain("name: 'bloomberg'");
  });

  it('exports TradingView Pro theme preset', () => {
    expect(src).toContain('TRADINGVIEW_PRO_THEME');
    expect(src).toContain("name: 'tradingview-pro'");
  });

  it('has setOverride for per-key color overrides', () => {
    expect(src).toContain('setOverride(key, value)');
    expect(src).toContain('userOverrides');
  });

  it('persists overrides in localStorage', () => {
    expect(src).toContain('tf_theme_overrides');
  });

  it('has clearOverrides method', () => {
    expect(src).toContain('clearOverrides()');
  });

  it('has getGradientBackground for gradient background option', () => {
    expect(src).toContain('getGradientBackground');
    expect(src).toContain('adjustBrightness');
  });

  it('has exportThemeJSON for theme export', () => {
    expect(src).toContain('exportThemeJSON()');
    expect(src).toContain('JSON.stringify');
  });

  it('has importThemeJSON for theme import', () => {
    expect(src).toContain('importThemeJSON(json)');
    expect(src).toContain('JSON.parse(json)');
  });

  it('has availableThemes getter', () => {
    expect(src).toContain('availableThemes');
    expect(src).toContain('Object.keys(THEMES)');
  });

  it('merges overrides into theme getter', () => {
    expect(src).toContain('{ ...currentTheme, ...userOverrides }');
  });
});
