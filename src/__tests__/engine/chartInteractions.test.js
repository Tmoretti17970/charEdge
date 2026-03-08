// ═══════════════════════════════════════════════════════════════════
// Tier 5.2 — Chart Interaction Tests (InputManager)
//
// Tests the 595-line InputManager class that handles all mouse, wheel,
// and touch interactions for the charting library. Uses mocked engine
// and canvas to exercise the full state machine.
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ─── Polyfill ResizeObserver for Node/vitest ─────────────────────
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    constructor(cb) { this._cb = cb; }
    observe() { }
    unobserve() { }
    disconnect() { }
  };
}

// ─── Mock Engine + Canvas Factory ───────────────────────────────

function createMockCanvas() {
  const listeners = {};
  return {
    style: { cursor: '' },
    clientWidth: 800,
    clientHeight: 600,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    addEventListener: vi.fn((type, fn) => { listeners[type] = fn; }),
    removeEventListener: vi.fn((type, fn) => { delete listeners[type]; }),
    _listeners: listeners,
  };
}

function createMockEngine(canvas) {
  return {
    topCanvas: canvas,
    bars: Array.from({ length: 200 }, (_, i) => ({
      time: Date.now() - (200 - i) * 60000,
      open: 100 + Math.random() * 10,
      high: 105 + Math.random() * 10,
      low: 95 + Math.random() * 10,
      close: 100 + Math.random() * 10,
      volume: Math.random() * 1000,
    })),
    state: {
      mouseX: null,
      mouseY: null,
      hoverIdx: null,
      dragging: false,
      scrollOffset: 50,
      visibleBars: 80,
      autoScale: true,
      priceScale: 1,
      priceScroll: 0,
      mainDirty: false,
      topDirty: false,
      lastRender: {
        bSp: 10,        // bar spacing
        start: 50,       // first visible bar index
        cW: 800,         // chart width
        mainH: 500,      // main chart height
        yMin: 90,
        yMax: 110,
        txH: 30,         // time axis height
        pr: 1,           // pixel ratio
      },
      _scrollToNowBtn: null,
      _autoFitBtn: null,
      scaleMode: 'linear',
    },
    layers: {
      markDirty: vi.fn(),
    },
    callbacks: {},
    drawingEngine: null,
    props: {},
    _scheduleDraw: vi.fn(),
  };
}

// ─── Stub globals for Node environment ──────────────────────────

const _origRAF = globalThis.requestAnimationFrame;
const _origCAF = globalThis.cancelAnimationFrame;
const _origPerf = globalThis.performance;

beforeEach(() => {
  // Stub requestAnimationFrame to execute synchronously for testing
  let rafId = 0;
  globalThis.requestAnimationFrame = vi.fn((cb) => {
    rafId++;
    // Don't auto-execute — tests can call the callback manually if needed
    return rafId;
  });
  globalThis.cancelAnimationFrame = vi.fn();
  if (!globalThis.performance?.now) {
    globalThis.performance = { now: () => Date.now() };
  }
  // Stub window.addEventListener/removeEventListener/dispatchEvent
  if (typeof globalThis.window === 'undefined') {
    globalThis.window = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
  } else {
    vi.spyOn(window, 'addEventListener').mockImplementation(() => { });
    vi.spyOn(window, 'removeEventListener').mockImplementation(() => { });
    if (!window.dispatchEvent || typeof window.dispatchEvent !== 'function') {
      window.dispatchEvent = vi.fn();
    } else {
      vi.spyOn(window, 'dispatchEvent').mockImplementation(() => { });
    }
  }
});

afterEach(() => {
  globalThis.requestAnimationFrame = _origRAF;
  globalThis.cancelAnimationFrame = _origCAF;
  if (_origPerf) globalThis.performance = _origPerf;
});


// ═══════════════════════════════════════════════════════════════════
// Describe Blocks
// ═══════════════════════════════════════════════════════════════════

describe('5.2 — InputManager Construction & Teardown', () => {
  it('imports and constructs without error', async () => {
    const { InputManager } = await import('../../charting_library/core/InputManager.ts');
    const canvas = createMockCanvas();
    const engine = createMockEngine(canvas);
    const im = new InputManager(engine);

    expect(im.engine).toBe(engine);
    expect(im.tc).toBe(canvas);
    im.destroy();
  });

  it('registers all required event listeners', async () => {
    const { InputManager } = await import('../../charting_library/core/InputManager.ts');
    const canvas = createMockCanvas();
    const engine = createMockEngine(canvas);
    const im = new InputManager(engine);

    const registeredEvents = canvas.addEventListener.mock.calls.map(c => c[0]);
    expect(registeredEvents).toContain('mousemove');
    expect(registeredEvents).toContain('mouseleave');
    expect(registeredEvents).toContain('mousedown');
    expect(registeredEvents).toContain('mouseup');
    expect(registeredEvents).toContain('dblclick');
    expect(registeredEvents).toContain('wheel');
    expect(registeredEvents).toContain('touchstart');
    expect(registeredEvents).toContain('touchmove');
    expect(registeredEvents).toContain('touchend');
    expect(registeredEvents).toContain('auxclick');

    im.destroy();
  });

  it('sets cursor to crosshair on construction', async () => {
    const { InputManager } = await import('../../charting_library/core/InputManager.ts');
    const canvas = createMockCanvas();
    const engine = createMockEngine(canvas);
    const im = new InputManager(engine);

    expect(canvas.style.cursor).toBe('crosshair');
    im.destroy();
  });

  it('removes all event listeners on destroy', async () => {
    const { InputManager } = await import('../../charting_library/core/InputManager.ts');
    const canvas = createMockCanvas();
    const engine = createMockEngine(canvas);
    const im = new InputManager(engine);
    im.destroy();

    const removedEvents = canvas.removeEventListener.mock.calls.map(c => c[0]);
    expect(removedEvents).toContain('mousemove');
    expect(removedEvents).toContain('mousedown');
    expect(removedEvents).toContain('wheel');
    expect(removedEvents).toContain('touchstart');
    expect(removedEvents).toContain('touchmove');
    expect(removedEvents).toContain('touchend');
  });
});

describe('5.2 — Mouse Interactions', () => {
  let InputManager, canvas, engine, im;

  beforeEach(async () => {
    const mod = await import('../../charting_library/core/InputManager.ts');
    InputManager = mod.InputManager;
    canvas = createMockCanvas();
    engine = createMockEngine(canvas);
    im = new InputManager(engine);
  });

  afterEach(() => {
    im.destroy();
  });

  it('getPos converts clientX/Y to local coordinates', () => {
    const pos = im.getPos({ clientX: 100, clientY: 200 });
    expect(pos.x).toBe(100);
    expect(pos.y).toBe(200);
  });

  it('onMouseMove updates mouseX, mouseY, hoverIdx', () => {
    im.onMouseMove({ clientX: 150, clientY: 300, preventDefault: () => { } });
    const S = engine.state;
    expect(S.mouseX).toBe(150);
    expect(S.mouseY).toBe(300);
    expect(S.hoverIdx).toBeTypeOf('number');
    expect(S.topDirty).toBe(true);
  });

  it('onMouseLeave clears crosshair state', () => {
    // First set some state
    engine.state.mouseX = 100;
    engine.state.mouseY = 200;
    engine.state.hoverIdx = 5;

    im.onMouseLeave();

    expect(engine.state.mouseX).toBeNull();
    expect(engine.state.mouseY).toBeNull();
    expect(engine.state.hoverIdx).toBeNull();
    expect(engine.state.dragging).toBe(false);
    expect(canvas.style.cursor).toBe('crosshair');
  });

  it('onMouseDown with button 0 starts chart drag', () => {
    const e = {
      button: 0,
      clientX: 400,
      clientY: 300,
      ctrlKey: false,
      metaKey: false,
      preventDefault: vi.fn(),
    };
    im.onMouseDown(e);

    expect(engine.state.dragging).toBe('chart');
    expect(engine.state.dragStartX).toBe(400);
    expect(canvas.style.cursor).toBe('grabbing');
  });

  it('onMouseDown with button 1 (middle-click) starts chart pan', () => {
    const e = {
      button: 1,
      clientX: 400,
      clientY: 300,
      ctrlKey: false,
      metaKey: false,
      preventDefault: vi.fn(),
    };
    im.onMouseDown(e);

    // Middle click should be prevented (auto-scroll suppression)
    expect(e.preventDefault).toHaveBeenCalled();
    expect(engine.state.dragging).toBe('chart');
  });

  it('onMouseDown with button 2 (right-click) is ignored', () => {
    const e = {
      button: 2,
      clientX: 400,
      clientY: 300,
      preventDefault: vi.fn(),
    };
    im.onMouseDown(e);
    expect(engine.state.dragging).toBe(false);
  });

  it('onMouseDown in time axis area starts time drag', () => {
    // Position click in time axis area (bottom of chart)
    const e = {
      button: 0,
      clientX: 400,
      clientY: 590, // Near bottom, within time axis
      ctrlKey: false,
      metaKey: false,
      preventDefault: vi.fn(),
    };
    im.onMouseDown(e);

    expect(engine.state.dragging).toBe('time');
    expect(canvas.style.cursor).toBe('grab');
  });

  it('onMouseDown in price axis area starts price drag', () => {
    // Position click in price axis (right side, above time axis)
    const e = {
      button: 0,
      clientX: 820, // Beyond chart width (800)
      clientY: 300,
      ctrlKey: false,
      metaKey: false,
      preventDefault: vi.fn(),
    };
    im.onMouseDown(e);

    expect(engine.state.dragging).toBe('price');
    expect(canvas.style.cursor).toBe('ns-resize');
  });

  it('onMouseUp ends dragging and resets cursor', () => {
    // Start a drag first
    engine.state.dragging = 'chart';
    engine.state.dragStartX = 400;

    im.onMouseUp({ clientX: 400, clientY: 300 });

    expect(engine.state.dragging).toBe(false);
    expect(canvas.style.cursor).toBe('crosshair');
  });

  it('onDoubleClick resets zoom and auto-scale', () => {
    engine.state.autoScale = false;
    engine.state.priceScale = 2.5;
    engine.state.priceScroll = 10;

    im.onDoubleClick({ clientX: 400, clientY: 300 });

    expect(engine.state.autoScale).toBe(true);
    expect(engine.state.priceScale).toBe(1);
    expect(engine.state.priceScroll).toBe(0);
    expect(engine.state.mainDirty).toBe(true);
  });

  it('onBarClick callback fires on click without drag', () => {
    const onBarClick = vi.fn();
    engine.callbacks.onBarClick = onBarClick;
    engine.state.hoverIdx = 100;

    // Simulate full click: mouseDown then mouseUp at nearly same position
    im.onMouseDown({
      button: 0,
      clientX: 400,
      clientY: 300,
      ctrlKey: false,
      metaKey: false,
      preventDefault: vi.fn(),
    });

    // mouseUp within 3px triggers bar click callback
    im.onMouseUp({ clientX: 401, clientY: 300 });

    expect(onBarClick).toHaveBeenCalledTimes(1);
  });
});

describe('5.2 — Wheel / Trackpad Interactions', () => {
  let InputManager, canvas, engine, im;

  beforeEach(async () => {
    const mod = await import('../../charting_library/core/InputManager.ts');
    InputManager = mod.InputManager;
    canvas = createMockCanvas();
    engine = createMockEngine(canvas);
    im = new InputManager(engine);
  });

  afterEach(() => {
    im.destroy();
  });

  it('discrete mouse wheel zooms chart', () => {
    const initialBars = engine.state.visibleBars;

    im.onWheel({
      preventDefault: vi.fn(),
      deltaY: 100,        // Scroll down = zoom out
      deltaX: 0,
      deltaMode: 1,       // Line mode = discrete wheel
      ctrlKey: false,
      clientX: 400,
      clientY: 300,
    });

    // Should set a zoom target (larger = zoom out)
    expect(im._targetVisibleBars).toBeGreaterThan(initialBars);
  });

  it('trackpad pinch (ctrlKey + deltaMode=0) zooms with reduced sensitivity', () => {
    const initialBars = engine.state.visibleBars;

    im.onWheel({
      preventDefault: vi.fn(),
      deltaY: 2,
      deltaX: 0,
      deltaMode: 0,       // Pixel mode = trackpad
      ctrlKey: true,       // Browser sets ctrlKey for trackpad pinch
      clientX: 400,
      clientY: 300,
    });

    // Should zoom with 0.08 factor (reduced from 0.15)
    expect(im._targetVisibleBars).not.toBeNull();
    const diff = im._targetVisibleBars - initialBars;
    // Pinch sensitivity: 80 * 0.08 = 6.4, so target should differ by ~6 bars
    expect(Math.abs(diff)).toBeLessThanOrEqual(10);
  });

  it('trackpad scroll (no ctrlKey, pixel mode, small deltaY) pans horizontally', () => {
    const initialOffset = engine.state.scrollOffset;

    im.onWheel({
      preventDefault: vi.fn(),
      deltaY: 30,          // Small delta = trackpad scroll, not discrete wheel
      deltaX: 0,
      deltaMode: 0,
      ctrlKey: false,
      clientX: 400,
      clientY: 300,
    });

    // Should pan, not zoom — scrollOffset should change
    expect(engine.state.scrollOffset).not.toBe(initialOffset);
    // Should NOT set a zoom target
    expect(im._targetVisibleBars).toBeNull();
  });

  it('zoom anchors to cursor position', () => {
    im.onWheel({
      preventDefault: vi.fn(),
      deltaY: -100,
      deltaX: 0,
      deltaMode: 1,
      ctrlKey: false,
      clientX: 200,  // Left quarter of chart
      clientY: 300,
    });

    // Anchor fraction should be 200/800 = 0.25
    expect(im._zoomAnchorFrac).toBeCloseTo(0.25, 1);
  });
});

describe('5.2 — Touch Gesture Interactions', () => {
  let InputManager, canvas, engine, im;

  beforeEach(async () => {
    const mod = await import('../../charting_library/core/InputManager.ts');
    InputManager = mod.InputManager;
    canvas = createMockCanvas();
    engine = createMockEngine(canvas);
    im = new InputManager(engine);
  });

  afterEach(() => {
    im.destroy();
  });

  it('single touch starts pan mode', () => {
    im.onTouchStart({
      preventDefault: vi.fn(),
      touches: [{ clientX: 400, clientY: 300 }],
    });

    expect(im._touchMode).toBe('pan');
  });

  it('two touches starts pinch-zoom mode', () => {
    im.onTouchStart({
      preventDefault: vi.fn(),
      touches: [
        { clientX: 300, clientY: 300 },
        { clientX: 500, clientY: 300 },
      ],
    });

    expect(im._touchMode).toBe('pinch');
    expect(im._pinchStartDist).toBeGreaterThan(0);
  });

  it('touch pan moves scrollOffset', () => {
    const initialOffset = engine.state.scrollOffset;

    // Start pan
    im.onTouchStart({
      preventDefault: vi.fn(),
      touches: [{ clientX: 400, clientY: 300 }],
    });

    // Move finger right (pan chart left / increase offset)
    im.onTouchMove({
      preventDefault: vi.fn(),
      touches: [{ clientX: 500, clientY: 300 }],
    });

    expect(engine.state.scrollOffset).not.toBe(initialOffset);
    expect(engine.state.mainDirty).toBe(true);
  });

  it('pinch zoom changes visibleBars', () => {
    const initialBars = engine.state.visibleBars;

    // Start pinch
    im.onTouchStart({
      preventDefault: vi.fn(),
      touches: [
        { clientX: 300, clientY: 300 },
        { clientX: 500, clientY: 300 },
      ],
    });

    // Spread fingers apart (zoom in = fewer visible bars)
    im.onTouchMove({
      preventDefault: vi.fn(),
      touches: [
        { clientX: 200, clientY: 300 },
        { clientX: 600, clientY: 300 },
      ],
    });

    expect(engine.state.visibleBars).not.toBe(initialBars);
  });

  it('touch end with velocity triggers inertia', () => {
    // Start pan
    im.onTouchStart({
      preventDefault: vi.fn(),
      touches: [{ clientX: 400, clientY: 300 }],
    });

    // Set up some velocity
    im._velocityX = 5;
    im._touchMode = 'pan';

    im.onTouchEnd({ preventDefault: vi.fn() });

    // B1.6: inertia now sets a boolean flag instead of calling requestAnimationFrame
    expect(im._inertiaActive).toBe(true);
  });

  it('_getTouchCenter calculates center of two touches', () => {
    const center = im._getTouchCenter([
      { clientX: 200, clientY: 200 },
      { clientX: 400, clientY: 400 },
    ]);
    expect(center.x).toBe(300);
    expect(center.y).toBe(300);
  });

  it('_getTouchDistance calculates distance between two touches', () => {
    const dist = im._getTouchDistance([
      { clientX: 0, clientY: 0 },
      { clientX: 300, clientY: 400 },
    ]);
    expect(dist).toBeCloseTo(500, 0); // 3-4-5 triangle × 100
  });
});

describe('5.2 — Scroll to Now & Inertia', () => {
  let InputManager, canvas, engine, im;

  beforeEach(async () => {
    const mod = await import('../../charting_library/core/InputManager.ts');
    InputManager = mod.InputManager;
    canvas = createMockCanvas();
    engine = createMockEngine(canvas);
    im = new InputManager(engine);
  });

  afterEach(() => {
    im.destroy();
  });

  it('scrollToNow starts animation toward offset 0', () => {
    engine.state.scrollOffset = 100;
    im.scrollToNow();

    // B1.6: scrollToNow now sets a boolean flag instead of calling requestAnimationFrame
    expect(im._scrollToNowActive).toBe(true);
  });

  it('scrollToNow stops any existing inertia', () => {
    im._velocityX = 10;
    im.scrollToNow();

    expect(im._velocityX).toBe(0);
  });

  it('_stopInertia resets velocity and clears active flag', () => {
    im._velocityX = 5;
    im._inertiaActive = true;

    im._stopInertia();

    expect(im._velocityX).toBe(0);
    expect(im._inertiaActive).toBe(false);
  });
});

describe('5.2 — Drawing Engine Integration', () => {
  let InputManager, canvas, engine, im;

  beforeEach(async () => {
    const mod = await import('../../charting_library/core/InputManager.ts');
    InputManager = mod.InputManager;
    canvas = createMockCanvas();
    engine = createMockEngine(canvas);
    im = new InputManager(engine);
  });

  afterEach(() => {
    im.destroy();
  });

  it('mouseDown consumed by drawing engine prevents chart drag', () => {
    engine.drawingEngine = {
      onMouseDown: vi.fn(() => true),
      onMouseMove: vi.fn(() => false),
      onMouseUp: vi.fn(() => false),
      cursorHint: null,
    };

    im.onMouseDown({
      button: 0,
      clientX: 400,
      clientY: 300,
      ctrlKey: false,
      metaKey: false,
      preventDefault: vi.fn(),
    });

    // Drawing engine consumed the click — no chart drag
    expect(engine.state.dragging).toBe(false);
  });

  it('cursor follows drawing engine hint when not dragging', () => {
    engine.drawingEngine = {
      onMouseMove: vi.fn(() => false),
      cursorHint: 'move',
    };

    im.onMouseMove({ clientX: 400, clientY: 300 });
    expect(canvas.style.cursor).toBe('move');
  });
});
