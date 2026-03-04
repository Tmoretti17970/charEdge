// Sprint 19 — Animation System Overhaul (Source Verification)
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
const ROOT = resolve(__dirname, '..', '..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf-8');

describe('Sprint 19 · ChartAnimations — Animation System', () => {
  const src = read('charting_library/core/ChartAnimations.js');

  it('exports animateCandleEntrance', () => {
    expect(src).toContain('export function animateCandleEntrance');
  });

  it('candle entrance uses easeOutCubic with 300ms default', () => {
    expect(src).toContain('durationMs = 300');
    expect(src).toContain('easeOutCubic');
  });

  it('exports animateChartTypeTransition (crossfade)', () => {
    expect(src).toContain('export function animateChartTypeTransition');
    expect(src).toContain('drawImage(oldFrame');
    expect(src).toContain('drawNewFrame');
  });

  it('exports animateSpringZoom (replaces linear lerp)', () => {
    expect(src).toContain('export function animateSpringZoom');
    expect(src).toContain('stiffness');
    expect(src).toContain('damping');
    expect(src).toContain('springForce');
  });

  it('exports drawPriceLineGlow', () => {
    expect(src).toContain('export function drawPriceLineGlow');
    expect(src).toContain('createLinearGradient');
  });

  it('exports createShimmerEffect', () => {
    expect(src).toContain('export function createShimmerEffect');
    expect(src).toContain('sweepX');
  });
});
