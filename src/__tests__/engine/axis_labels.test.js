// ═══════════════════════════════════════════════════════════════════
// Sprint 14 — Price/Time Labels on Axes (Source Verification)
//
// Validates that all Sprint 14 enhancements are in place:
//   1. UIStage: colored price pill, rounded corners, bid/ask labels
//   2. AxesStage: crosshair price marker in Y-axis gutter
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf-8');

// ─── 1. UIStage — Crosshair Label Enhancements ──────────────────
describe('Sprint 14 · UIStage — Colored Price/Time Labels', () => {
  const src = read('charting_library/core/stages/UIStage.ts');

  it('uses bull/bear color for price pill', () => {
    expect(src).toContain('pillColor');
    expect(src).toContain('priceBull');
    expect(src).toContain('bullCandle');
    expect(src).toContain('bearCandle');
  });

  it('uses roundRect for price label', () => {
    expect(src).toContain('roundRect(plX');
  });

  it('uses bold font for price label', () => {
    expect(src).toContain('`bold ${axFs}px Arial`');
  });

  it('uses white text on colored pill', () => {
    // After the pill fill, text should be white
    expect(src).toContain("tCtx.fillStyle = '#FFFFFF'");
  });

  it('uses roundRect for time label', () => {
    expect(src).toContain('roundRect(Math.round(tlX)');
  });

  it('has bid/ask spread labels', () => {
    expect(src).toContain('orderFlowData');
    expect(src).toContain('bestBid');
    expect(src).toContain('bestAsk');
  });

  it('draws B label for bid', () => {
    expect(src).toContain("fillText('B'");
  });

  it('draws A label for ask', () => {
    expect(src).toContain("fillText('A'");
  });

  it('positions bid/ask as smaller pills', () => {
    expect(src).toContain('bidY');
    expect(src).toContain('askY');
    expect(src).toContain('baH');
    expect(src).toContain('baW');
  });
});

// ─── 2. AxesStage — Crosshair Y-Axis Marker ─────────────────────
describe('Sprint 14 · AxesStage — Crosshair Price Marker', () => {
  const src = read('charting_library/core/stages/AxesStage.ts');

  it('checks S.mouseY for crosshair marker', () => {
    expect(src).toContain('S.mouseY != null');
    expect(src).toContain('S.mouseX != null');
  });

  it('computes cursor price from mouseY', () => {
    expect(src).toContain('cursorPrice');
    expect(src).toContain('mainHeight - S.mouseY');
  });

  it('uses bull/bear color for marker', () => {
    expect(src).toContain('isBull');
    expect(src).toContain('cmColor');
  });

  it('uses roundRect for crosshair marker pill', () => {
    expect(src).toContain('roundRect(cmPillX, cursorY');
  });

  it('draws dashed horizontal line at crosshair Y', () => {
    expect(src).toContain('setLineDash');
    expect(src).toContain('cursorY + 0.5');
  });

  it('formats price text for crosshair marker', () => {
    expect(src).toContain('cmText');
    expect(src).toContain('formatPrice(cursorPrice)');
  });

  it('supports percent mode in crosshair marker', () => {
    expect(src).toContain("scaleMode === 'percent'");
    expect(src).toContain('percentBase');
  });
});
