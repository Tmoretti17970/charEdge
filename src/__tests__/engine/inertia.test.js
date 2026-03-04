// ═══════════════════════════════════════════════════════════════════
// charEdge — Sprint 4: Buttery Inertia & Overscroll Tests
//
// Verifies the inertia and pan UX pipeline:
//   1. Friction constant (0.96 — TradingView-class momentum)
//   2. Zoom lerp (0.25 — snappy zoom)
//   3. 3-sample velocity ring buffer
//   4. Rubber-band overscroll (max 40 bars, spring 0.85)
//   5. CSS will-change GPU hint during pan
//   6. ChartAnimations spring easing
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';

// ─── 1. InputManager — Inertia Constants ────────────────────────

describe('Sprint 4 — InputManager inertia constants', () => {
  let source;

  beforeEach(async () => {
    const fs = await import('fs');
    const { fileURLToPath } = await import('url');
    const path = await import('path');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    source = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'charting_library/core/InputManager.ts'),
      'utf-8'
    );
  });

  it('FRICTION is 0.96 (TradingView-class momentum)', () => {
    expect(source).toContain('FRICTION = 0.96');
  });

  it('MIN_VELOCITY is 0.3 (stop threshold)', () => {
    expect(source).toContain('MIN_VELOCITY = 0.3');
  });

  it('ZOOM_LERP is 0.25 (snappy zoom easing)', () => {
    expect(source).toContain('ZOOM_LERP = 0.25');
  });

  it('ZOOM_SNAP is 0.5 (snap when close enough)', () => {
    expect(source).toContain('ZOOM_SNAP = 0.5');
  });
});

// ─── 2. InputManager — Velocity Sampling ────────────────────────

describe('Sprint 4 — InputManager velocity sampling', () => {
  let source;

  beforeEach(async () => {
    const fs = await import('fs');
    const { fileURLToPath } = await import('url');
    const path = await import('path');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    source = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'charting_library/core/InputManager.ts'),
      'utf-8'
    );
  });

  it('uses 3-sample velocity ring buffer', () => {
    // TS class field: _velocitySamples: [number, number, number] = [0, 0, 0]
    expect(source).toContain('_velocitySamples');
    expect(source).toContain('[0, 0, 0]');
  });

  it('tracks velocity index for ring buffer rotation', () => {
    expect(source).toContain('_velocityIdx');
  });

  it('averages 3 samples for smooth flick detection', () => {
    expect(source).toContain('_velocitySamples[0] + this._velocitySamples[1] + this._velocitySamples[2]');
  });

  it('only samples when dt < 100ms (filters stale moves)', () => {
    expect(source).toContain('dt < 100');
  });
});

// ─── 3. InputManager — Rubber-Band Overscroll ───────────────────

describe('Sprint 4 — InputManager rubber-band overscroll', () => {
  let source;

  beforeEach(async () => {
    const fs = await import('fs');
    const { fileURLToPath } = await import('url');
    const path = await import('path');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    source = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'charting_library/core/InputManager.ts'),
      'utf-8'
    );
  });

  it('OVERSCROLL_MAX is 40 bars', () => {
    expect(source).toContain('OVERSCROLL_MAX = 40');
  });

  it('OVERSCROLL_SPRING is 0.85 (spring-back per frame)', () => {
    expect(source).toContain('OVERSCROLL_SPRING = 0.85');
  });

  it('applies spring-back when scrollOffset < 0', () => {
    expect(source).toContain('S.scrollOffset *= OVERSCROLL_SPRING');
  });

  it('applies spring-back when scrollOffset > maxScroll', () => {
    expect(source).toContain('maxScroll + over * OVERSCROLL_SPRING');
  });

  it('clamps overscroll to OVERSCROLL_MAX', () => {
    expect(source).toContain('-OVERSCROLL_MAX');
    expect(source).toContain('maxScroll + OVERSCROLL_MAX');
  });

  it('snaps back to edge when within 0.5 bars', () => {
    expect(source).toContain('Math.abs(S.scrollOffset) < 0.5');
  });
});

// ─── 4. InputManager — CSS will-change GPU Hint ─────────────────

describe('Sprint 4 — InputManager CSS will-change', () => {
  let source;

  beforeEach(async () => {
    const fs = await import('fs');
    const { fileURLToPath } = await import('url');
    const path = await import('path');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    source = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'charting_library/core/InputManager.ts'),
      'utf-8'
    );
  });

  it('has _setWillChange method', () => {
    expect(source).toContain('_setWillChange()');
  });

  it('has _clearWillChange method', () => {
    expect(source).toContain('_clearWillChange()');
  });

  it('sets will-change: transform on pan start', () => {
    expect(source).toContain("willChange = 'transform'");
  });

  it('clears will-change on inertia stop', () => {
    // _clearWillChange is called when inertia finishes
    const inertiaSection = source.split('_startInertia')[1]?.split('_stopInertia')[0] || '';
    expect(inertiaSection).toContain('_clearWillChange');
  });

  it('clears will-change in destroy()', () => {
    const destroySection = source.split('destroy()')[1]?.split('}')[0] || '';
    expect(destroySection).toContain('_clearWillChange');
  });
});

// ─── 5. ChartAnimations — Easing Functions ──────────────────────

describe('Sprint 4 — ChartAnimations easing functions', () => {
  let source;

  beforeEach(async () => {
    const fs = await import('fs');
    const { fileURLToPath } = await import('url');
    const path = await import('path');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    source = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'charting_library/core/ChartAnimations.js'),
      'utf-8'
    );
  });

  it('has spring easing function', () => {
    expect(source).toContain('spring:');
  });

  it('has easeOutExpo easing', () => {
    expect(source).toContain('easeOutExpo');
  });

  it('has easeOutBack easing for overshoot', () => {
    expect(source).toContain('easeOutBack');
  });

  it('has easeOutBounce easing', () => {
    expect(source).toContain('easeOutBounce');
  });

  it('exports EASINGS object', () => {
    expect(source).toContain('export { EASINGS }');
  });

  it('has animateViewport for smooth pan/zoom transitions', () => {
    expect(source).toContain('animateViewport');
  });
});
