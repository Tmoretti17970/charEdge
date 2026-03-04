// ═══════════════════════════════════════════════════════════════════
// charEdge — Shared Test Factories
//
// Reusable mock data generators and stubs for test files.
// Import these instead of duplicating inline helpers.
// ═══════════════════════════════════════════════════════════════════

import { vi } from 'vitest';

/**
 * Generate an array of OHLCV bar objects.
 *
 * @param {number} count - Number of bars to generate
 * @param {object} [opts]
 * @param {number} [opts.startMs]   - Epoch ms for the first bar (default: count minutes ago)
 * @param {number} [opts.interval]  - Ms between bars (default: 60 000 = 1 minute)
 * @param {number} [opts.basePrice] - Starting price (default: 100)
 * @param {number} [opts.trend]     - Price drift per bar (default: 0)
 * @param {boolean} [opts.iso]      - If true, `time` is an ISO string; otherwise epoch ms
 * @returns {Array<{time: number|string, open: number, high: number, low: number, close: number, volume: number}>}
 */
export function createMockBars(count, opts = {}) {
  const {
    startMs = Date.now() - count * 60000,
    interval = 60000,
    basePrice = 100,
    trend = 0,
    iso = false,
  } = opts;

  return Array.from({ length: count }, (_, i) => {
    const t = startMs + i * interval;
    const base = basePrice + i * trend;
    const open  = base + Math.random() * 5;
    const close = base + Math.random() * 5;
    const high  = Math.max(open, close) + Math.random() * 5;
    const low   = Math.min(open, close) - Math.random() * 5;
    return {
      time: iso ? new Date(t).toISOString() : t,
      open:   +open.toFixed(2),
      high:   +high.toFixed(2),
      low:    +low.toFixed(2),
      close:  +close.toFixed(2),
      volume: Math.round(500 + Math.random() * 1000),
    };
  });
}

/**
 * Create a minimal mock canvas element with event tracking.
 *
 * @param {object} [overrides] - Properties to merge onto the canvas
 * @returns {object} Mock canvas with addEventListener/removeEventListener spies
 */
export function createMockCanvas(overrides = {}) {
  const listeners = {};
  return {
    style: { cursor: '' },
    clientWidth: 800,
    clientHeight: 600,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    addEventListener: vi.fn((type, fn) => { listeners[type] = fn; }),
    removeEventListener: vi.fn((type) => { delete listeners[type]; }),
    _listeners: listeners,
    ...overrides,
  };
}

/**
 * Create a minimal ChartEngine stub.
 *
 * @param {object} [canvas] - Mock canvas (created via createMockCanvas if omitted)
 * @param {object} [overrides] - Properties to merge onto the engine
 * @returns {object} Mock engine with state, layers, callbacks, etc.
 */
export function createMockEngine(canvas, overrides = {}) {
  const c = canvas || createMockCanvas();
  return {
    topCanvas: c,
    bars: createMockBars(200),
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
        bSp: 10,
        start: 50,
        cW: 800,
        mainH: 500,
        yMin: 90,
        yMax: 110,
        txH: 30,
        pr: 1,
      },
      _scrollToNowBtn: null,
      _autoFitBtn: null,
      scaleMode: 'linear',
    },
    layers: { markDirty: vi.fn() },
    callbacks: {},
    drawingEngine: null,
    props: {},
    _scheduleDraw: vi.fn(),
    ...overrides,
  };
}

/**
 * Create a minimal Zustand-style store for testing.
 *
 * @param {object} [initial] - Initial state
 * @returns {{ getState: Function, setState: Function, subscribe: Function }}
 */
export function createMockStore(initial = {}) {
  let state = { ...initial };
  const listeners = new Set();

  const getState = () => state;
  const setState = (partial) => {
    const next = typeof partial === 'function' ? partial(state) : partial;
    state = { ...state, ...next };
    listeners.forEach((fn) => fn(state));
  };
  const subscribe = (fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  };

  return { getState, setState, subscribe };
}
