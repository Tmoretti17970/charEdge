// eslint-disable-next-line import/order
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';

// ─── OffscreenCanvas Polyfill for Node.js ───────────────────────

beforeAll(() => {
  if (typeof globalThis.OffscreenCanvas === 'undefined') {
    globalThis.OffscreenCanvas = class OffscreenCanvas {
      constructor(w, h) {
        this.width = w;
        this.height = h;
      }
      getContext() {
        return {
          save: vi.fn(),
          restore: vi.fn(),
          clearRect: vi.fn(),
          drawImage: vi.fn(),
          fillRect: vi.fn(),
          createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
          measureText: vi.fn((text) => ({
            width: text.length * 8,
            actualBoundingBoxAscent: 10,
            actualBoundingBoxDescent: 3,
          })),
          globalAlpha: 1,
          globalCompositeOperation: 'source-over',
          fillStyle: '',
          imageSmoothingEnabled: true,
          font: '',
          textBaseline: 'alphabetic',
          textRendering: 'auto',
        };
      }
    };
  }
});

// ─── Imports ────────────────────────────────────────────────────
import { SpringAnimator, SpringAnimator2D } from '../../charting_library/animation/SpringAnimator.js';
import { Bloom } from '../../charting_library/effects/Bloom.js';
import { MotionBlur } from '../../charting_library/effects/MotionBlur.js';
import { subPixelSnap, subPixelSnapPoint, drawSubPixelLine, drawSubPixelRect } from '../../charting_library/effects/SubPixelAA.js';
import { TemporalAccumulator, halton, getJitterOffset } from '../../charting_library/effects/TemporalAA.js';
import { FontEngine } from '../../charting_library/typography/FontEngine.js';

// ─── Canvas/Context Mock ────────────────────────────────────────

function createMockCtx(w = 800, h = 600) {
  const canvas = {
    width: w,
    height: h,
    getContext: vi.fn(() => ctx),
  };
  const ctx = {
    canvas,
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    createRadialGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    measureText: vi.fn((text) => ({
      width: text.length * 8,
      actualBoundingBoxAscent: 10,
      actualBoundingBoxDescent: 3,
    })),
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    font: '',
    textBaseline: 'alphabetic',
    textRendering: 'auto',
    imageSmoothingEnabled: true,
  };
  return { ctx, canvas };
}

function createMockCanvas(w = 800, h = 600) {
  const { ctx, canvas } = createMockCtx(w, h);
  return canvas;
}

// ═══════════════════════════════════════════════════════════════════
// SubPixelAA Tests
// ═══════════════════════════════════════════════════════════════════

describe('SubPixelAA', () => {
  it('subPixelSnap rounds to nearest device pixel', () => {
    // DPR 2: each CSS pixel = 2 device pixels → snap to 0.5 increments
    expect(subPixelSnap(10.3, 2)).toBe(10.5);
    expect(subPixelSnap(10.7, 2)).toBe(10.5);
    expect(subPixelSnap(10.0, 2)).toBe(10.0);
  });

  it('subPixelSnap handles DPR 1 (integer snapping)', () => {
    expect(subPixelSnap(10.3, 1)).toBe(10);
    expect(subPixelSnap(10.7, 1)).toBe(11);
  });

  it('subPixelSnap handles zero/negative DPR gracefully', () => {
    expect(subPixelSnap(10.5, 0)).toBe(10.5);
    expect(subPixelSnap(10.5, -1)).toBe(10.5);
  });

  it('subPixelSnapPoint returns x and y', () => {
    const p = subPixelSnapPoint(10.3, 20.7, 2);
    expect(p.x).toBe(10.5);
    expect(p.y).toBe(20.5);
  });

  it('drawSubPixelLine renders without errors', () => {
    const { ctx } = createMockCtx();
    const points = [{ x: 0, y: 0 }, { x: 100, y: 50 }, { x: 200, y: 25 }];
    drawSubPixelLine(ctx, points, '#ff0000', 2, 2, 'high');
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });

  it('drawSubPixelLine handles low tier (simple line)', () => {
    const { ctx } = createMockCtx();
    const points = [{ x: 0, y: 0 }, { x: 100, y: 50 }];
    drawSubPixelLine(ctx, points, '#ff0000', 2, 1, 'low');
    expect(ctx.stroke).toHaveBeenCalledTimes(1);
  });

  it('drawSubPixelLine skips empty/short point arrays', () => {
    const { ctx } = createMockCtx();
    drawSubPixelLine(ctx, [], '#ff0000', 2, 2);
    drawSubPixelLine(ctx, [{ x: 0, y: 0 }], '#ff0000', 2, 2);
    expect(ctx.stroke).not.toHaveBeenCalled();
  });

  it('drawSubPixelRect renders a crisp rectangle', () => {
    const { ctx } = createMockCtx();
    drawSubPixelRect(ctx, { x: 10, y: 20, w: 50, h: 30 }, '#0000ff', 2);
    expect(ctx.fillRect).toHaveBeenCalledTimes(1);
  });

  it('drawSubPixelRect skips zero-size rects', () => {
    const { ctx } = createMockCtx();
    drawSubPixelRect(ctx, { x: 10, y: 20, w: 0, h: 30 }, '#0000ff', 2);
    drawSubPixelRect(ctx, null, '#0000ff', 2);
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════
// TemporalAA Tests
// ═══════════════════════════════════════════════════════════════════

describe('TemporalAA', () => {
  it('halton generates values in [0, 1)', () => {
    for (let i = 1; i <= 10; i++) {
      const v = halton(i, 2);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('getJitterOffset returns values in [-0.5, 0.5)', () => {
    for (let i = 0; i < 8; i++) {
      const j = getJitterOffset(i);
      expect(j.x).toBeGreaterThanOrEqual(-0.5);
      expect(j.x).toBeLessThan(0.5);
      expect(j.y).toBeGreaterThanOrEqual(-0.5);
      expect(j.y).toBeLessThan(0.5);
    }
  });

  it('accumulator starts empty and not converged', () => {
    const acc = new TemporalAccumulator({ tier: 'high' });
    expect(acc.frameCount).toBe(0);
    expect(acc.isConverged()).toBe(false);
    expect(acc.getAccumulated()).toBeNull();
  });

  it('accumulator converges after maxFrames', () => {
    const acc = new TemporalAccumulator({ maxFrames: 3 });
    const canvas = createMockCanvas(100, 100);

    for (let i = 0; i < 3; i++) {
      acc.addFrame(canvas);
    }
    expect(acc.isConverged()).toBe(true);
    expect(acc.frameCount).toBe(3);
  });

  it('reset clears accumulated frames', () => {
    const acc = new TemporalAccumulator({ maxFrames: 4 });
    const canvas = createMockCanvas(100, 100);

    acc.addFrame(canvas);
    acc.addFrame(canvas);
    expect(acc.frameCount).toBe(2);

    acc.reset();
    expect(acc.frameCount).toBe(0);
    expect(acc.isConverged()).toBe(false);
  });

  it('getJitter returns zero when converged', () => {
    const acc = new TemporalAccumulator({ maxFrames: 1, jitter: true });
    const canvas = createMockCanvas(100, 100);
    acc.addFrame(canvas);
    const j = acc.getJitter();
    expect(j.x).toBe(0);
    expect(j.y).toBe(0);
  });

  it('dispose releases resources', () => {
    const acc = new TemporalAccumulator();
    const canvas = createMockCanvas(100, 100);
    acc.addFrame(canvas);
    acc.dispose();
    expect(acc.getAccumulated()).toBeNull();
    expect(acc.frameCount).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// SpringAnimator Tests
// ═══════════════════════════════════════════════════════════════════

describe('SpringAnimator', () => {
  it('starts settled at initial value', () => {
    const s = new SpringAnimator({ initial: 5 });
    expect(s.value).toBe(5);
    expect(s.settled).toBe(true);
  });

  it('converges from 0 to 1 within reasonable time', () => {
    const s = new SpringAnimator({ preset: 'EASE', initial: 0 });
    s.setTarget(1);

    // Simulate 2 seconds at 60fps
    for (let i = 0; i < 120; i++) {
      s.tick(1 / 60);
    }
    expect(s.settled).toBe(true);
    expect(s.value).toBeCloseTo(1, 2);
  });

  it('SNAP preset settles faster than EASE', () => {
    const snap = new SpringAnimator({ preset: 'SNAP', initial: 0 });
    const ease = new SpringAnimator({ preset: 'EASE', initial: 0 });
    snap.setTarget(1);
    ease.setTarget(1);

    let snapFrames = 0;
    let easeFrames = 0;

    for (let i = 0; i < 300; i++) {
      const dt = 1 / 60;
      if (!snap.settled) { snap.tick(dt); snapFrames++; }
      if (!ease.settled) { ease.tick(dt); easeFrames++; }
    }

    expect(snapFrames).toBeLessThan(easeFrames);
  });

  it('setTarget mid-animation redirects smoothly', () => {
    const s = new SpringAnimator({ preset: 'EASE', initial: 0 });
    s.setTarget(100);

    // Simulate 30 frames
    for (let i = 0; i < 30; i++) s.tick(1 / 60);

    // Redirect to -50
    s.setTarget(-50);
    expect(s.settled).toBe(false);

    // Simulate to convergence
    for (let i = 0; i < 300; i++) s.tick(1 / 60);
    expect(s.value).toBeCloseTo(-50, 1);
    expect(s.settled).toBe(true);
  });

  it('setValue instantly jumps without animation', () => {
    const s = new SpringAnimator({ preset: 'EASE', initial: 0 });
    s.setValue(42);
    expect(s.value).toBe(42);
    expect(s.target).toBe(42);
    expect(s.settled).toBe(true);
    expect(s.velocity).toBe(0);
  });

  it('tick returns settled immediately when no target change', () => {
    const s = new SpringAnimator({ initial: 10 });
    const r = s.tick(1 / 60);
    expect(r.settled).toBe(true);
    expect(r.value).toBe(10);
    expect(r.velocity).toBe(0);
  });
});

describe('SpringAnimator2D', () => {
  it('settles at 2D target', () => {
    const s = new SpringAnimator2D({ preset: 'SNAP' });
    s.setTarget(100, 200);

    for (let i = 0; i < 300; i++) s.tick(1 / 60);

    expect(s.settled).toBe(true);
    expect(s.x.value).toBeCloseTo(100, 1);
    expect(s.y.value).toBeCloseTo(200, 1);
  });
});

// ═══════════════════════════════════════════════════════════════════
// FontEngine Tests
// ═══════════════════════════════════════════════════════════════════

describe('FontEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new FontEngine();
  });

  it('getFontStack returns a valid CSS font-family string', () => {
    const stack = engine.getFontStack();
    expect(stack).toContain('Inter');
    expect(stack).toContain('sans-serif');
    expect(stack.length).toBeGreaterThan(10);
  });

  it('getFontStack mono variant includes monospace', () => {
    const stack = engine.getFontStack('mono');
    expect(stack).toContain('monospace');
    expect(stack).not.toContain('Inter');
  });

  it('measure returns positive width for non-empty strings', () => {
    const m = engine.measure('Hello world', 14);
    expect(m.width).toBeGreaterThan(0);
    expect(m.ascent).toBeGreaterThan(0);
    expect(m.descent).toBeGreaterThanOrEqual(0);
  });

  it('measure returns zero width for empty string', () => {
    const m = engine.measure('', 14);
    expect(m.width).toBe(0);
  });

  it('getBaseline returns consistent values per font size', () => {
    const b1 = engine.getBaseline(14);
    const b2 = engine.getBaseline(14);
    expect(b1).toBe(b2);
    expect(b1).toBeGreaterThan(0);
  });

  it('getFont builds valid CSS font shorthand', () => {
    const f = engine.getFont(14, 'bold');
    expect(f).toContain('bold');
    expect(f).toContain('14px');
    expect(f).toContain('Inter');
  });

  it('clearCache empties the metrics cache', () => {
    engine.measure('test', 14);
    engine.clearCache();
    // Second call should still work (re-measured)
    const m = engine.measure('test', 14);
    expect(m.width).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// MotionBlur Tests
// ═══════════════════════════════════════════════════════════════════

describe('MotionBlur', () => {
  it('no-op when velocity below threshold', () => {
    const mb = new MotionBlur({ velocityThreshold: 5 });
    const source = createMockCanvas(100, 100);
    mb.capture(source);

    const { ctx } = createMockCtx();
    mb.apply(ctx, 2); // below threshold
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it('applies blend when velocity above threshold', () => {
    const mb = new MotionBlur({ velocityThreshold: 3 });
    const source = createMockCanvas(100, 100);
    mb.capture(source);

    const { ctx } = createMockCtx();
    mb.apply(ctx, 10); // above threshold
    expect(ctx.drawImage).toHaveBeenCalled();
  });

  it('setEnabled(false) disables effect entirely', () => {
    const mb = new MotionBlur();
    const source = createMockCanvas(100, 100);
    mb.capture(source);
    mb.setEnabled(false);

    const { ctx } = createMockCtx();
    mb.apply(ctx, 100);
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it('reset clears previous frame', () => {
    const mb = new MotionBlur();
    const source = createMockCanvas(100, 100);
    mb.capture(source);
    mb.reset();

    const { ctx } = createMockCtx();
    mb.apply(ctx, 100);
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it('dispose releases resources', () => {
    const mb = new MotionBlur();
    const source = createMockCanvas(100, 100);
    mb.capture(source);
    mb.dispose();
    expect(mb.enabled).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Bloom Tests
// ═══════════════════════════════════════════════════════════════════

describe('Bloom', () => {
  it('render produces output with glow regions', () => {
    const bloom = new Bloom({ intensity: 0.8 });
    const { ctx, canvas } = createMockCtx(400, 300);

    const regions = [
      { x: 200, y: 150, radius: 20, color: '#ffaa00', intensity: 1 },
    ];

    bloom.render(ctx, canvas, regions);
    expect(ctx.drawImage).toHaveBeenCalled();
  });

  it('setIntensity(0) disables the effect', () => {
    const bloom = new Bloom();
    bloom.setIntensity(0);
    expect(bloom.intensity).toBe(0);

    const { ctx, canvas } = createMockCtx();
    bloom.render(ctx, canvas, [{ x: 0, y: 0, radius: 10, color: '#fff' }]);
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it('handles empty glow regions array', () => {
    const bloom = new Bloom({ intensity: 1 });
    const { ctx, canvas } = createMockCtx();
    bloom.render(ctx, canvas, []);
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it('setIntensity clamps to 0-1', () => {
    const bloom = new Bloom();
    bloom.setIntensity(2);
    expect(bloom.intensity).toBe(1);
    bloom.setIntensity(-1);
    expect(bloom.intensity).toBe(0);
  });

  it('dispose releases resources', () => {
    const bloom = new Bloom();
    const { ctx, canvas } = createMockCtx();
    bloom.render(ctx, canvas, [{ x: 0, y: 0, radius: 10, color: '#fff' }]);
    bloom.dispose();
    // No error after dispose
    expect(() => bloom.render(ctx, canvas, [{ x: 0, y: 0, radius: 10, color: '#fff' }])).not.toThrow();
  });
});
