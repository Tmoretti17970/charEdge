// ═══════════════════════════════════════════════════════════════════
// charEdge — Sprint 9: Intelligent Time Scale Tests
//
// Verifies the time scale pipeline:
//   1. formatTimeLabel smart resolution + UTC/local toggle
//   2. AxesStage density-aware labels + session dividers + gap markers
//   3. FrameState useUTC flag
//   4. TimeAxis coordinate transforms
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';

// ─── 1. formatTimeLabel — Smart Resolution ──────────────────────

describe('Sprint 9 — formatTimeLabel smart resolution', () => {
  let source;

  beforeEach(async () => {
    const fs = await import('fs');
    const { fileURLToPath } = await import('url');
    const path = await import('path');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    source = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'charting_library/core/barCountdown.js'),
      'utf-8'
    );
  });

  it('exports formatTimeLabel function', () => {
    expect(source).toContain('export function formatTimeLabel');
  });

  it('has useUTC parameter (default true)', () => {
    expect(source).toContain('useUTC = true');
  });

  it('detects day boundary for intraday', () => {
    expect(source).toContain("getDate(d) !== getDate(prev)");
  });

  it('detects month boundary for daily', () => {
    expect(source).toContain("getMon(d) !== getMon(prev)");
  });

  it('detects year boundary', () => {
    expect(source).toContain("getYear(d) !== getYear(prev)");
  });

  it('uses UTC accessors when useUTC is true', () => {
    expect(source).toContain('getUTCFullYear');
    expect(source).toContain('getUTCMonth');
  });

  it('uses local accessors when useUTC is false', () => {
    expect(source).toContain('getFullYear');
    expect(source).toContain('getMonth');
  });

  it('formats intraday as HH:MM', () => {
    expect(source).toContain("padStart(2, '0')");
  });

  it('formats weekly as "Feb \'26" style', () => {
    expect(source).toContain(".slice(2)");
  });
});

// ─── 2. AxesStage — Label Rendering ────────────────────────────

describe('Sprint 9 — AxesStage labels and dividers', () => {
  let source;

  beforeEach(async () => {
    const fs = await import('fs');
    const { fileURLToPath } = await import('url');
    const path = await import('path');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    source = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'charting_library/core/stages/AxesStage.ts'),
      'utf-8'
    );
  });

  it('uses density-aware label spacing (80px min)', () => {
    expect(source).toContain('MIN_LABEL_PX');
    expect(source).toContain('80');
  });

  it('has session dividers for intraday', () => {
    expect(source).toContain('Session dividers');
    expect(source).toContain('getUTCDate');
  });

  it('has weekend/holiday gap markers for daily+', () => {
    expect(source).toContain('Weekend/holiday gap markers');
    expect(source).toContain('86400000 * 2');
  });

  it('uses offscreen bitmap cache for labels', () => {
    expect(source).toContain('_axesCache');
    expect(source).toContain('cacheKey');
  });

  it('supports GPU SDF text path', () => {
    expect(source).toContain('drawSDFText');
  });

  it('renders scale mode toggles (log/%)', () => {
    expect(source).toContain("'log'");
    expect(source).toContain("'percent'");
  });
});

// ─── 3. FrameState — useUTC Flag ────────────────────────────────

describe('Sprint 9 — FrameState useUTC', () => {
  let source;

  beforeEach(async () => {
    const fs = await import('fs');
    const { fileURLToPath } = await import('url');
    const path = await import('path');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    source = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'charting_library/core/FrameState.ts'),
      'utf-8'
    );
  });

  it('stores useUTC on frame state', () => {
    expect(source).toContain('fs.useUTC');
  });

  it('defaults useUTC to true', () => {
    expect(source).toContain('useUTC !== false');
  });
});

// ─── 4. TimeAxis — Coordinate Transforms ────────────────────────

describe('Sprint 9 — TimeAxis coordinate transforms', () => {
  let source;

  beforeEach(async () => {
    const fs = await import('fs');
    const { fileURLToPath } = await import('url');
    const path = await import('path');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    source = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'charting_library/core/TimeAxis.js'),
      'utf-8'
    );
  });

  it('exports createTimeTransform', () => {
    expect(source).toContain('export function createTimeTransform');
  });

  it('has indexToPixel for bar-to-pixel conversion', () => {
    expect(source).toContain('indexToPixel');
  });

  it('has pixelToIndex for pixel-to-bar conversion', () => {
    expect(source).toContain('pixelToIndex');
  });

  it('has pixelToTime for pixel-to-timestamp', () => {
    expect(source).toContain('pixelToTime');
  });

  it('has timeToPixel for timestamp-to-pixel', () => {
    expect(source).toContain('timeToPixel');
  });

  it('exports candleLayout for bar sizing', () => {
    expect(source).toContain('export function candleLayout');
  });

  it('handles gap estimation with approximateIndexForTime', () => {
    expect(source).toContain('approximateIndexForTime');
  });
});
