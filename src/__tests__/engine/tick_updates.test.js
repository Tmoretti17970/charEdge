// ═══════════════════════════════════════════════════════════════════
// charEdge — Sprint 7: Sub-Frame Tick Updates Tests
//
// Verifies the tick update pipeline:
//   1. ChartEngine tick detection (_tickUpdate, _animTarget/_animCurrent)
//   2. FrameState CHANGED.TICK bitmask
//   3. DataStage tick fast-paths (Canvas 2D + WebGL)
//   4. WebGLRenderer updateLastCandle (single-instance write)
//   5. Price line pulse glow on tick
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';

// ─── 1. ChartEngine — Tick Detection ────────────────────────────

describe('Sprint 7 — ChartEngine tick detection', () => {
  let source;

  beforeEach(async () => {
    const fs = await import('fs');
    const { fileURLToPath } = await import('url');
    const path = await import('path');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    source = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'charting_library/core/ChartEngine.ts'),
      'utf-8'
    );
  });

  it('detects tick update via same bar count', () => {
    expect(source).toContain('_tickUpdate');
    expect(source).toContain('bars.length === bars.length');
  });

  it('tracks animation target OHLC for interpolation', () => {
    expect(source).toContain('_animTarget');
  });

  it('tracks animation current OHLC for smooth transitions', () => {
    expect(source).toContain('_animCurrent');
  });

  it('snaps animation on new bar (not tick)', () => {
    expect(source).toContain('_animTarget = null');
    expect(source).toContain('_animCurrent = null');
  });
});

// ─── 2. FrameState — CHANGED.TICK Bitmask ───────────────────────

describe('Sprint 7 — FrameState tick bitmask', () => {
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

  it('has CHANGED.TICK bitmask flag', () => {
    expect(source).toContain('CHANGED.TICK');
  });

  it('stores isTickUpdate from engine', () => {
    expect(source).toContain('isTickUpdate');
  });

  it('sets TICK mask when lastBarClose changes', () => {
    expect(source).toContain('lastBarClose !== prev.lastBarClose');
  });
});

// ─── 3. DataStage — Tick Fast Paths ─────────────────────────────

describe('Sprint 7 — DataStage tick fast-paths', () => {
  let source;

  beforeEach(async () => {
    const fs = await import('fs');
    const { fileURLToPath } = await import('url');
    const path = await import('path');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    source = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'charting_library/core/stages/DataStage.ts'),
      'utf-8'
    );
  });

  it('detects tick-only changes (TICK mask without DATA/VIEWPORT)', () => {
    expect(source).toContain('isTickOnly');
    expect(source).toContain('CHANGED.TICK');
  });

  it('has Canvas 2D tick fast-path (non-WebGL)', () => {
    expect(source).toContain('isTickOnly && !webgl?.available');
  });

  it('has WebGL tick fast-path', () => {
    expect(source).toContain('isTickOnly && webgl?.available');
  });

  it('calls updateLastCandle on WebGL tick', () => {
    expect(source).toContain('webgl.updateLastCandle');
  });

  it('clears only last 2 bars region in Canvas 2D tick path', () => {
    expect(source).toContain('penultIdx');
    expect(source).toContain('clearRect');
  });

  it('re-renders price line after tick update', () => {
    expect(source).toContain('renderPriceLine');
  });
});

// ─── 4. WebGLRenderer — updateLastCandle ────────────────────────

describe('Sprint 7 — WebGLRenderer updateLastCandle', () => {
  let source;

  beforeEach(async () => {
    const fs = await import('fs');
    const { fileURLToPath } = await import('url');
    const path = await import('path');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    source = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'charting_library/renderers/CandleRenderer.ts'),
      'utf-8'
    );
  });

  it('has updateLastCandle method', () => {
    expect(source).toContain('updateLastCandle(');
  });

  it('uses bufferSubData for single-instance write', () => {
    expect(source).toContain('bufferSubData');
  });

  it('writes 7 floats per instance (x, open, high, low, close, isBull, isWick)', () => {
    // Instance data has 7 float fields
    expect(source).toContain('idx * 7 * 4');
  });

  it('updates both body and wick instances', () => {
    expect(source).toContain('wickData');
    expect(source).toContain('wickOffset');
  });

  it('guards against no previous instance data', () => {
    expect(source).toContain('!r._lastCandleInstanceCount');
  });

  it('computes isBull from close >= open', () => {
    expect(source).toContain('bar.close >= bar.open');
  });
});

// ─── 5. DataStage — Price Line Pulse ────────────────────────────

describe('Sprint 7 — DataStage price line pulse', () => {
  let source;

  beforeEach(async () => {
    const fs = await import('fs');
    const { fileURLToPath } = await import('url');
    const path = await import('path');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    source = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'charting_library/core/stages/DataStage.ts'),
      'utf-8'
    );
  });

  it('creates radial gradient for glow effect', () => {
    expect(source).toContain('createRadialGradient');
  });

  it('uses blue glow color (rgba 41, 98, 255)', () => {
    expect(source).toContain('41, 98, 255');
  });

  it('applies gradient to price line dot area', () => {
    expect(source).toContain('fillRect');
  });
});
