// ═══════════════════════════════════════════════════════════════════
// Sprint 16 — Crosshair Modes & Snap (Source Verification)
//
// Validates Sprint 16 enhancements:
//   1. UIStage.ts — crosshairMode, snap logic, line styles
//   2. ChartSettingsPanel.jsx — crosshair mode/style/color/opacity
// ═══════════════════════════════════════════════════════════════════

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect } from 'vitest';

const ROOT = resolve(__dirname, '..', '..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf-8');

// ─── 1. UIStage.ts — Crosshair Modes ────────────────────────────
describe('Sprint 16 · UIStage — Crosshair mode support', () => {
  const src = read('charting_library/core/stages/UIStage.ts');

  it('reads crosshairMode from engine or state', () => {
    expect(src).toContain('crosshairMode');
    expect(src).toContain('getCrosshairMode');
  });

  it('supports off mode', () => {
    expect(src).toContain("crosshairMode !== 'off'");
  });

  it('supports snapBar mode — locks X to bar center', () => {
    expect(src).toContain("crosshairMode === 'snapBar'");
    expect(src).toContain('indexToPixel(S.hoverIdx)');
  });

  it('supports snapClose mode — locks Y to close price', () => {
    expect(src).toContain("crosshairMode === 'snapClose'");
    expect(src).toContain('R.p2y(hBar.close)');
  });

  it('preserves free mode with soft magnetic snap', () => {
    expect(src).toContain("crosshairMode === 'free'");
    expect(src).toContain('dist < 8 * pr');
  });
});

describe('Sprint 16 · UIStage — Crosshair line style', () => {
  const src = read('charting_library/core/stages/UIStage.ts');

  it('reads crosshairLineStyle', () => {
    expect(src).toContain('crosshairLineStyle');
    expect(src).toContain('getCrosshairStyle');
  });

  it('supports dotted style', () => {
    expect(src).toContain("crosshairLineStyle === 'dotted'");
  });

  it('supports solid style', () => {
    expect(src).toContain("crosshairLineStyle === 'solid'");
  });

  it('supports dashed style (default)', () => {
    expect(src).toContain("// dashed (default)");
  });

  it('supports crosshair opacity', () => {
    expect(src).toContain('crosshairOpacity');
    expect(src).toContain('globalAlpha');
  });
});

// ─── 2. ChartSettingsPanel.jsx — Crosshair Controls ──────────────
describe('Sprint 16 · ChartSettingsPanel — Crosshair settings', () => {
  const src = read('app/components/chart/panels/ChartSettingsPanel.jsx');

  it('has Crosshair Mode radio group', () => {
    expect(src).toContain("Crosshair Mode");
    expect(src).toContain("'free'");
    expect(src).toContain("'snapBar'");
    expect(src).toContain("'snapClose'");
    expect(src).toContain("'off'");
  });

  it('has Line Style radio group', () => {
    expect(src).toContain("Line Style");
    expect(src).toContain("'dashed'");
    expect(src).toContain("'dotted'");
    expect(src).toContain("'solid'");
  });

  it('has Crosshair Color swatch', () => {
    expect(src).toContain('Crosshair Color');
    expect(src).toContain('crosshairColor');
  });

  it('has Crosshair Opacity slider', () => {
    expect(src).toContain('Crosshair Opacity');
    expect(src).toContain('crosshairOpacity');
  });
});
