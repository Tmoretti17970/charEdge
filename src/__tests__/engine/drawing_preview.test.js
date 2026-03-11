// ═══════════════════════════════════════════════════════════════════
// Sprint 17 — Drawing Ghost Preview (Source Verification)
//
// Validates Sprint 17 enhancements:
//   1. DrawingStage.ts — ghost preview rendering during CREATING state
//   2. DrawingEngine.js — Escape cancel, Backspace undo, activeDrawing getter
// ═══════════════════════════════════════════════════════════════════

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect } from 'vitest';

const ROOT = resolve(__dirname, '..', '..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf-8');

// ─── 1. DrawingStage.ts — Ghost Preview ──────────────────────────
describe('Sprint 17 · DrawingStage — Ghost Preview Rendering', () => {
  const src = read('charting_library/core/stages/DrawingStage.ts');

  it('calls _drawGhostPreview during CREATING state', () => {
    expect(src).toContain('_drawGhostPreview');
    // DrawingStage passes drawingEngine to the ghost preview function
    expect(src).toContain('drawingEngine');
  });

  it('renders ghost with translucent alpha', () => {
    expect(src).toContain('ghostAlpha');
    expect(src).toContain('globalAlpha');
  });

  it('uses dotted ghost line style', () => {
    expect(src).toContain('ghostDash');
    expect(src).toContain('setLineDash');
  });

  it('handles line tools (rubber-band)', () => {
    expect(src).toContain("case 'trendline':");
    expect(src).toContain("case 'arrow':");
    expect(src).toContain("case 'ray':");
    expect(src).toContain("case 'extendedline':");
  });

  it('handles rectangle tools (box + dimensions overlay)', () => {
    expect(src).toContain("case 'rect':");
    expect(src).toContain('strokeRect');
    expect(src).toContain('Dimensions overlay');
  });

  it('handles Fibonacci (level previews)', () => {
    expect(src).toContain("case 'fib':");
    expect(src).toContain("case 'fibext':");
    expect(src).toContain('fibLevels');
  });

  it('handles channels (parallel line preview)', () => {
    expect(src).toContain("case 'channel':");
    expect(src).toContain("case 'parallelchannel':");
  });

  it('handles multi-point tools', () => {
    expect(src).toContain("case 'triangle':");
    expect(src).toContain("case 'polyline':");
    expect(src).toContain("case 'elliott':");
    expect(src).toContain("case 'pitchfork':");
  });

  it('handles ellipse ghost', () => {
    expect(src).toContain("case 'ellipse':");
    expect(src).toContain('ctx.ellipse');
  });

  it('draws ghost anchor dots at confirmed points', () => {
    expect(src).toContain('Ghost anchor dots');
    expect(src).toContain('ctx.arc(bp.x');
  });
});

// ─── 2. DrawingEngine.js — Keyboard Handlers ────────────────────
describe('Sprint 17 · DrawingEngine — Keyboard & Ghost Support', () => {
  const src = read('charting_library/tools/tools/DrawingEngine.js');

  it('has onKeyDown handler', () => {
    expect(src).toContain('onKeyDown(key)');
  });

  it('cancels drawing on Escape', () => {
    expect(src).toContain("key === 'Escape'");
    expect(src).toContain('activeDrawing');
  });

  it('undo last point on Backspace', () => {
    expect(src).toContain("key === 'Backspace'");
    expect(src).toContain('_confirmedPoints--');
  });

  it('cancels if all points undone on Backspace', () => {
    expect(src).toContain('_confirmedPoints === 0');
  });

  it('exposes activeDrawing getter for ghost preview', () => {
    expect(src).toContain('get activeDrawing()');
  });
});
