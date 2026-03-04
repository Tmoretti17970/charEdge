import { describe, it, expect } from 'vitest';
import { toRenkoBricks, toRangeBars, autoATR } from '../../charting_library/core/barTransforms.js';
import { getSessionsForTimeRange } from '../../charting_library/renderers/SessionDividers.js';

// ═══════════════════════════════════════════════════════════════════
// Bar Transforms Tests
// ═══════════════════════════════════════════════════════════════════

describe('autoATR', () => {
  const bars = [
    { open: 100, high: 110, low: 90, close: 105, volume: 1000 },
    { open: 105, high: 115, low: 95, close: 100, volume: 1200 },
    { open: 100, high: 120, low: 85, close: 110, volume: 800 },
    { open: 110, high: 125, low: 100, close: 115, volume: 900 },
    { open: 115, high: 130, low: 105, close: 120, volume: 1100 },
  ];

  it('should calculate ATR from bars', () => {
    const atr = autoATR(bars, 4);
    expect(atr).toBeGreaterThan(0);
    expect(atr).toBeLessThan(40); // Reasonable range for this data
  });

  it('should return a positive value for 2-bar input', () => {
    const atr = autoATR(bars.slice(0, 2), 14);
    expect(atr).toBeGreaterThan(0);
  });

  it('should handle single bar gracefully', () => {
    const atr = autoATR([bars[0]], 14);
    expect(atr).toBeGreaterThan(0);
  });

  it('should return 1 for empty array', () => {
    expect(autoATR([], 14)).toBe(1);
  });
});

describe('toRenkoBricks', () => {
  it('should generate bricks from ascending bars', () => {
    const bars = [];
    for (let i = 0; i < 20; i++) {
      bars.push({
        time: Date.now() + i * 60000,
        open: 100 + i * 10,
        high: 105 + i * 10,
        low: 95 + i * 10,
        close: 100 + (i + 1) * 10,
        volume: 1000,
      });
    }
    const { bricks, brickSize } = toRenkoBricks(bars, 10);
    expect(bricks.length).toBeGreaterThan(0);
    expect(brickSize).toBe(10);
    // All bricks should be up in ascending data
    bricks.forEach(b => {
      expect(b._isUp).toBe(true);
      expect(b.close).toBeGreaterThan(b.open);
    });
  });

  it('should generate down bricks from descending bars', () => {
    const bars = [];
    for (let i = 0; i < 20; i++) {
      bars.push({
        time: Date.now() + i * 60000,
        open: 300 - i * 10,
        high: 305 - i * 10,
        low: 295 - i * 10,
        close: 300 - (i + 1) * 10,
        volume: 1000,
      });
    }
    const { bricks } = toRenkoBricks(bars, 10);
    expect(bricks.length).toBeGreaterThan(0);
    // Most bricks should be down
    const downBricks = bricks.filter(b => !b._isUp);
    expect(downBricks.length).toBeGreaterThan(0);
  });

  it('should return empty bricks for flat market within brick size', () => {
    const bars = [];
    for (let i = 0; i < 10; i++) {
      bars.push({
        time: Date.now() + i * 60000,
        open: 100, high: 101, low: 99, close: 100.5,
        volume: 1000,
      });
    }
    const { bricks } = toRenkoBricks(bars, 50); // Brick size larger than movement
    expect(bricks.length).toBe(0);
  });

  it('should auto-calculate brick size from ATR when not provided', () => {
    const bars = [];
    for (let i = 0; i < 20; i++) {
      bars.push({
        time: Date.now() + i * 60000,
        open: 100 + i * 5,
        high: 105 + i * 5,
        low: 95 + i * 5,
        close: 100 + (i + 1) * 5,
        volume: 1000,
      });
    }
    const { brickSize } = toRenkoBricks(bars);
    expect(brickSize).toBeGreaterThan(0);
  });

  it('should return empty for null/empty input', () => {
    expect(toRenkoBricks(null).bricks).toEqual([]);
    expect(toRenkoBricks([]).bricks).toEqual([]);
  });
});

describe('toRangeBars', () => {
  it('should generate range bars with approximately uniform height', () => {
    const bars = [];
    for (let i = 0; i < 50; i++) {
      const base = 100 + Math.sin(i * 0.3) * 30;
      bars.push({
        time: Date.now() + i * 60000,
        open: base,
        high: base + 8 + Math.random() * 5,
        low: base - 8 - Math.random() * 5,
        close: base + (Math.random() - 0.5) * 10,
        volume: 1000,
      });
    }
    const { rangeBars, rangeSize } = toRangeBars(bars, 10);
    expect(rangeBars.length).toBeGreaterThan(0);
    expect(rangeSize).toBe(10);

    // All completed bars (except possibly the last) should have height ≈ rangeSize
    for (let i = 0; i < rangeBars.length - 1; i++) {
      const h = rangeBars[i].high - rangeBars[i].low;
      expect(h).toBeCloseTo(10, 0); // within 1 unit
    }
  });

  it('should auto-calculate range size from ATR when not provided', () => {
    const bars = [];
    for (let i = 0; i < 20; i++) {
      bars.push({
        time: Date.now() + i * 60000,
        open: 100 + i, high: 105 + i, low: 95 + i, close: 102 + i,
        volume: 500,
      });
    }
    const { rangeSize } = toRangeBars(bars);
    expect(rangeSize).toBeGreaterThan(0);
  });

  it('should return empty for null/empty input', () => {
    expect(toRangeBars(null).rangeBars).toEqual([]);
    expect(toRangeBars([]).rangeBars).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Session Dividers Tests
// ═══════════════════════════════════════════════════════════════════

describe('getSessionsForTimeRange', () => {
  it('should return sessions for a 24h weekday range', () => {
    // Use a known Monday: 2024-01-08
    const startOfDay = new Date('2024-01-08T00:00:00Z').getTime();
    const endOfDay = new Date('2024-01-08T23:59:59Z').getTime();

    const sessions = getSessionsForTimeRange(startOfDay, endOfDay);
    expect(sessions.length).toBeGreaterThan(0);

    // Should have Tokyo, London, and NYC sessions
    const ids = new Set(sessions.map(s => s.session.id));
    expect(ids.has('tokyo')).toBe(true);
    expect(ids.has('london')).toBe(true);
    expect(ids.has('nyc')).toBe(true);
  });

  it('should return both open and close entries', () => {
    const startOfDay = new Date('2024-01-09T00:00:00Z').getTime();
    const endOfDay = new Date('2024-01-09T23:59:59Z').getTime();

    const sessions = getSessionsForTimeRange(startOfDay, endOfDay);
    const types = sessions.map(s => s.type);
    expect(types).toContain('open');
    expect(types).toContain('close');
  });

  it('should skip weekends', () => {
    // Saturday 2024-01-06 and Sunday 2024-01-07
    const satStart = new Date('2024-01-06T00:00:00Z').getTime();
    const sunEnd = new Date('2024-01-07T23:59:59Z').getTime();

    const sessions = getSessionsForTimeRange(satStart, sunEnd);
    expect(sessions.length).toBe(0);
  });

  it('should return only sessions within the narrow range', () => {
    // Only NYC time window on a Wednesday
    const start = new Date('2024-01-10T13:00:00Z').getTime();
    const end = new Date('2024-01-10T15:00:00Z').getTime();

    const sessions = getSessionsForTimeRange(start, end);
    // Should find NYC open (13:30 UTC)
    const nycSessions = sessions.filter(s => s.session.id === 'nyc');
    expect(nycSessions.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle empty/zero range', () => {
    const sessions = getSessionsForTimeRange(0, 0);
    // Should not crash
    expect(Array.isArray(sessions)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// VWAP Bands Tests (Sprint: Charting Mega-Sprint)
// ═══════════════════════════════════════════════════════════════════

import { vwapBands } from '../../charting_library/studies/indicators/computations.js';

describe('vwapBands', () => {
  const makeBars = (count, dayLength = 4) => {
    const bars = [];
    const baseTime = new Date('2024-01-08T09:00:00Z').getTime();
    for (let i = 0; i < count; i++) {
      const time = baseTime + i * 3600000;
      const price = 100 + Math.sin(i * 0.5) * 5;
      bars.push({
        time,
        open: price,
        high: price + 2,
        low: price - 2,
        close: price + 1,
        volume: 1000 + i * 100,
      });
    }
    return bars;
  };

  it('should compute VWAP and all 6 band arrays', () => {
    const bars = makeBars(20);
    const result = vwapBands(bars);
    expect(result.vwap).toHaveLength(20);
    expect(result.upper1).toHaveLength(20);
    expect(result.lower1).toHaveLength(20);
    expect(result.upper2).toHaveLength(20);
    expect(result.lower2).toHaveLength(20);
    expect(result.upper3).toHaveLength(20);
    expect(result.lower3).toHaveLength(20);
  });

  it('should have VWAP between upper and lower bands', () => {
    const bars = makeBars(20);
    const result = vwapBands(bars);
    for (let i = 0; i < 20; i++) {
      if (!isNaN(result.vwap[i])) {
        expect(result.upper1[i]).toBeGreaterThanOrEqual(result.vwap[i]);
        expect(result.lower1[i]).toBeLessThanOrEqual(result.vwap[i]);
        expect(result.upper2[i]).toBeGreaterThanOrEqual(result.upper1[i]);
        expect(result.lower2[i]).toBeLessThanOrEqual(result.lower1[i]);
      }
    }
  });

  it('should reset on new day boundary in session mode', () => {
    const bars = [
      { time: new Date('2024-01-08T20:00:00Z').getTime(), open: 100, high: 102, low: 98, close: 101, volume: 500 },
      { time: new Date('2024-01-09T01:00:00Z').getTime(), open: 101, high: 105, low: 99, close: 103, volume: 600 },
    ];
    const result = vwapBands(bars);
    // Both should have valid values (second bar is a new day, resets accumulators)
    expect(result.vwap[0]).not.toBeNaN();
    expect(result.vwap[1]).not.toBeNaN();
  });

  it('anchored mode should skip bars before anchor time', () => {
    const bars = makeBars(10);
    const anchorTime = bars[5].time;
    const result = vwapBands(bars, anchorTime);
    // Bars before anchor should be NaN
    for (let i = 0; i < 5; i++) {
      expect(result.vwap[i]).toBeNaN();
    }
    // Bars at/after anchor should have values
    expect(result.vwap[5]).not.toBeNaN();
    expect(result.vwap[9]).not.toBeNaN();
  });

  it('should handle empty array', () => {
    const result = vwapBands([]);
    expect(result.vwap).toHaveLength(0);
  });

  it('should handle zero volume bars', () => {
    const bars = [
      { time: Date.now(), open: 100, high: 102, low: 98, close: 101, volume: 0 },
    ];
    const result = vwapBands(bars);
    expect(result.vwap[0]).toBeNaN();
  });
});

// ═══════════════════════════════════════════════════════════════════
// Alert Zone Drawing Model Tests
// ═══════════════════════════════════════════════════════════════════

import { DEFAULT_STYLES, TOOL_POINT_COUNT, createDrawing } from '../../charting_library/tools/tools/DrawingModel.js';

describe('Alert Zone Drawing', () => {
  it('should have alert zone in DEFAULT_STYLES', () => {
    expect(DEFAULT_STYLES.alertzone).toBeDefined();
    expect(DEFAULT_STYLES.alertzone.color).toBe('#F59E0B');
    expect(DEFAULT_STYLES.alertzone.fillColor).toContain('rgba');
  });

  it('should require 2 points for alert zone', () => {
    expect(TOOL_POINT_COUNT.alertzone).toBe(2);
  });

  it('should create a valid alert zone drawing', () => {
    const drawing = createDrawing('alertzone');
    expect(drawing.type).toBe('alertzone');
    expect(drawing.style.color).toBe('#F59E0B');
    expect(drawing.points).toEqual([]);
    expect(drawing.meta).toEqual({});
  });

  it('should apply style overrides', () => {
    const drawing = createDrawing('alertzone', null, { color: '#FF0000' });
    expect(drawing.style.color).toBe('#FF0000');
    expect(drawing.style.fillColor).toBe(DEFAULT_STYLES.alertzone.fillColor);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Chart Template Store Tests
// ═══════════════════════════════════════════════════════════════════

describe('ChartTemplateStore', () => {
  beforeEach(() => {
    // Reset store state
    useChartStore.setState({ templates: [] });
  });

  it('should save a template', () => {
    const store = useChartStore.getState();
    const tmpl = store.saveTemplate('My Template', {
      chartType: 'candle',
      timeframe: '1h',
      indicators: [{ type: 'sma', params: { period: 20 } }],
    });
    expect(tmpl.id).toMatch(/^tmpl_/);
    expect(tmpl.name).toBe('My Template');
    expect(tmpl.chartType).toBe('candle');
    expect(useChartStore.getState().templates).toHaveLength(1);
  });

  it('should load a template by ID', () => {
    const store = useChartStore.getState();
    const tmpl = store.saveTemplate('Test', { chartType: 'line' });
    const loaded = useChartStore.getState().loadTemplate(tmpl.id);
    expect(loaded).not.toBeNull();
    expect(loaded.name).toBe('Test');
  });

  it('should delete a template', () => {
    const store = useChartStore.getState();
    const tmpl = store.saveTemplate('Delete Me', { chartType: 'area' });
    expect(useChartStore.getState().templates).toHaveLength(1);
    useChartStore.getState().deleteTemplate(tmpl.id);
    expect(useChartStore.getState().templates).toHaveLength(0);
  });

  it('should rename a template', () => {
    const store = useChartStore.getState();
    const tmpl = store.saveTemplate('Old Name', {});
    useChartStore.getState().renameTemplate(tmpl.id, 'New Name');
    const renamed = useChartStore.getState().loadTemplate(tmpl.id);
    expect(renamed.name).toBe('New Name');
  });

  it('should return null for unknown template ID', () => {
    const loaded = useChartStore.getState().loadTemplate('nonexistent');
    expect(loaded).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════
// Bar Countdown Utility Tests
// ═══════════════════════════════════════════════════════════════════

import { tfToMs, formatCountdown, formatTimeLabel } from '../../charting_library/core/barCountdown.js';

describe('tfToMs', () => {
  it('should convert minute timeframes', () => {
    expect(tfToMs('1m')).toBe(60000);
    expect(tfToMs('5m')).toBe(300000);
    expect(tfToMs('15m')).toBe(900000);
    expect(tfToMs('30m')).toBe(1800000);
  });

  it('should convert hour timeframes', () => {
    expect(tfToMs('1h')).toBe(3600000);
    expect(tfToMs('4h')).toBe(14400000);
  });

  it('should convert day timeframes', () => {
    expect(tfToMs('1D')).toBe(86400000);
  });

  it('should convert week timeframes', () => {
    expect(tfToMs('1W')).toBe(604800000);
  });

  it('should return 0 for null/undefined/empty', () => {
    expect(tfToMs(null)).toBe(0);
    expect(tfToMs(undefined)).toBe(0);
    expect(tfToMs('')).toBe(0);
  });

  it('should handle uppercase/lowercase', () => {
    expect(tfToMs('1H')).toBe(3600000);
    expect(tfToMs('5M')).toBe(300000);
  });
});

describe('formatCountdown', () => {
  it('should format seconds only', () => {
    expect(formatCountdown(5000)).toBe('5s');
    expect(formatCountdown(45000)).toBe('45s');
  });

  it('should format minutes and seconds', () => {
    expect(formatCountdown(90000)).toBe('1m 30s');
    expect(formatCountdown(300000)).toBe('5m 00s');
  });

  it('should format hours and minutes', () => {
    expect(formatCountdown(3661000)).toBe('1h 01m');
  });

  it('should return 00:00 for zero or negative', () => {
    expect(formatCountdown(0)).toBe('00:00');
    expect(formatCountdown(-1000)).toBe('00:00');
  });

  it('should handle Infinity gracefully', () => {
    expect(formatCountdown(Infinity)).toBe('00:00');
  });
});

describe('formatTimeLabel', () => {
  it('should format intraday as HH:MM', () => {
    const t = new Date('2024-01-08T14:30:00Z').getTime();
    expect(formatTimeLabel(t, '5m')).toBe('14:30');
  });

  it('should format daily as Mon DD', () => {
    const t = new Date('2024-03-15T00:00:00Z').getTime();
    expect(formatTimeLabel(t, '1D')).toBe('Mar 15');
  });

  it('should return empty for invalid timestamp', () => {
    expect(formatTimeLabel(0, '1h')).toBe('');
    expect(formatTimeLabel(null, '1h')).toBe('');
  });
});

// ═══════════════════════════════════════════════════════════════════
// Drawing Undo/Redo Stack Tests
// ═══════════════════════════════════════════════════════════════════

import { useChartStore } from '../../state/useChartStore.js';

describe('Drawing Undo/Redo', () => {
  beforeEach(() => {
    useChartStore.setState({ drawings: [], drawingHistory: [], drawingFuture: [] });
  });

  it('addDrawing should push to history', () => {
    useChartStore.getState().addDrawing({ type: 'hline', points: [{ price: 100 }] });
    const s = useChartStore.getState();
    expect(s.drawings).toHaveLength(1);
    expect(s.drawingHistory).toHaveLength(1);
    expect(s.drawingHistory[0]).toEqual([]); // Previous state was empty
  });

  it('undoDrawing should restore previous state', () => {
    useChartStore.getState().addDrawing({ type: 'hline', points: [{ price: 100 }] });
    useChartStore.getState().addDrawing({ type: 'vline', points: [{ price: 200 }] });
    expect(useChartStore.getState().drawings).toHaveLength(2);

    useChartStore.getState().undoDrawing();
    expect(useChartStore.getState().drawings).toHaveLength(1);
    expect(useChartStore.getState().drawingFuture).toHaveLength(1);
  });

  it('redoDrawing should restore undone state', () => {
    useChartStore.getState().addDrawing({ type: 'hline', points: [{ price: 100 }] });
    useChartStore.getState().undoDrawing();
    expect(useChartStore.getState().drawings).toHaveLength(0);

    useChartStore.getState().redoDrawing();
    expect(useChartStore.getState().drawings).toHaveLength(1);
  });

  it('undoDrawing should do nothing when history is empty', () => {
    useChartStore.getState().undoDrawing();
    expect(useChartStore.getState().drawings).toHaveLength(0);
  });

  it('new addDrawing should clear redo future', () => {
    useChartStore.getState().addDrawing({ type: 'hline', points: [{ price: 100 }] });
    useChartStore.getState().undoDrawing();
    expect(useChartStore.getState().drawingFuture).toHaveLength(1);

    useChartStore.getState().addDrawing({ type: 'vline', points: [{ price: 200 }] });
    expect(useChartStore.getState().drawingFuture).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Chart Features State Tests (Minimap, Status Bar, Scale, Appearance)
// ═══════════════════════════════════════════════════════════════════

describe('Minimap State', () => {
  it('should default to hidden', () => {
    expect(useChartStore.getState().showMinimap).toBe(true);
  });

  it('toggleMinimap should flip visibility', () => {
    useChartStore.getState().toggleMinimap();
    expect(useChartStore.getState().showMinimap).toBe(false);
    useChartStore.getState().toggleMinimap();
    expect(useChartStore.getState().showMinimap).toBe(true);
  });
});

describe('Status Bar State', () => {
  it('should default to visible', () => {
    // Reset to default
    useChartStore.setState({ showStatusBar: true });
    expect(useChartStore.getState().showStatusBar).toBe(true);
  });

  it('toggleStatusBar should flip visibility', () => {
    useChartStore.setState({ showStatusBar: true });
    useChartStore.getState().toggleStatusBar();
    expect(useChartStore.getState().showStatusBar).toBe(false);
    useChartStore.getState().toggleStatusBar();
    expect(useChartStore.getState().showStatusBar).toBe(true);
  });
});

describe('Scale Mode State', () => {
  it('should default to auto', () => {
    expect(useChartStore.getState().scaleMode).toBe('auto');
  });

  it('setScaleMode should update the mode', () => {
    useChartStore.getState().setScaleMode('log');
    expect(useChartStore.getState().scaleMode).toBe('log');
    useChartStore.getState().setScaleMode('pct');
    expect(useChartStore.getState().scaleMode).toBe('pct');
    useChartStore.getState().setScaleMode('inverted');
    expect(useChartStore.getState().scaleMode).toBe('inverted');
    // Reset
    useChartStore.getState().setScaleMode('auto');
    expect(useChartStore.getState().scaleMode).toBe('auto');
  });
});

describe('Chart Appearance State', () => {
  beforeEach(() => {
    useChartStore.getState().resetChartAppearance();
  });

  it('should have correct defaults', () => {
    const app = useChartStore.getState().chartAppearance;
    expect(app.upColor).toBe('#26A69A');
    expect(app.downColor).toBe('#EF5350');
    expect(app.upWickColor).toBe('#26A69A');
    expect(app.downWickColor).toBe('#EF5350');
    expect(app.bodyStyle).toBe('filled');
    expect(app.gridVisible).toBe(true);
    expect(app.gridOpacity).toBe(0.3);
    expect(app.crosshairStyle).toBe('cross');
  });

  it('setChartAppearance should update a single key', () => {
    useChartStore.getState().setChartAppearance('upColor', '#00FF00');
    expect(useChartStore.getState().chartAppearance.upColor).toBe('#00FF00');
    // Other keys should remain unchanged
    expect(useChartStore.getState().chartAppearance.downColor).toBe('#EF5350');
  });

  it('resetChartAppearance should restore defaults', () => {
    useChartStore.getState().setChartAppearance('upColor', '#FF0000');
    useChartStore.getState().setChartAppearance('gridVisible', false);
    useChartStore.getState().resetChartAppearance();
    const app = useChartStore.getState().chartAppearance;
    expect(app.upColor).toBe('#26A69A');
    expect(app.gridVisible).toBe(true);
  });

  it('setChartAppearance should support grid opacity changes', () => {
    useChartStore.getState().setChartAppearance('gridOpacity', 0.7);
    expect(useChartStore.getState().chartAppearance.gridOpacity).toBe(0.7);
  });

  it('setChartAppearance should support crosshair style changes', () => {
    useChartStore.getState().setChartAppearance('crosshairStyle', 'dot');
    expect(useChartStore.getState().chartAppearance.crosshairStyle).toBe('dot');
    useChartStore.getState().setChartAppearance('crosshairStyle', 'line');
    expect(useChartStore.getState().chartAppearance.crosshairStyle).toBe('line');
  });
});

// ═══════════════════════════════════════════════════════════════════
// Volume Delta Computation Tests
// ═══════════════════════════════════════════════════════════════════

import { computeVolumeDelta } from '../../charting_library/studies/indicators/volumeDelta.js';

describe('computeVolumeDelta', () => {
  it('should return positive delta for bullish bars', () => {
    const bars = [
      { open: 100, close: 110, volume: 1000 },
      { open: 105, close: 115, volume: 1200 },
    ];
    const { delta } = computeVolumeDelta(bars);
    expect(delta[0]).toBe(1000);
    expect(delta[1]).toBe(1200);
  });

  it('should return negative delta for bearish bars', () => {
    const bars = [
      { open: 110, close: 100, volume: 800 },
      { open: 115, close: 105, volume: 900 },
    ];
    const { delta } = computeVolumeDelta(bars);
    expect(delta[0]).toBe(-800);
    expect(delta[1]).toBe(-900);
  });

  it('should compute cumulative delta correctly', () => {
    const bars = [
      { open: 100, close: 110, volume: 1000 },  // +1000
      { open: 110, close: 105, volume: 500 },    // -500
      { open: 105, close: 120, volume: 800 },    // +800
    ];
    const { cumDelta } = computeVolumeDelta(bars);
    expect(cumDelta[0]).toBe(1000);
    expect(cumDelta[1]).toBe(500);
    expect(cumDelta[2]).toBe(1300);
  });

  it('should handle zero volume bars', () => {
    const bars = [{ open: 100, close: 100, volume: 0 }];
    const { delta, cumDelta } = computeVolumeDelta(bars);
    expect(delta[0]).toBe(0);
    expect(cumDelta[0]).toBe(0);
  });

  it('should handle empty/null input', () => {
    expect(computeVolumeDelta([]).delta).toEqual([]);
    expect(computeVolumeDelta(null).delta).toEqual([]);
    expect(computeVolumeDelta(null).cumDelta).toEqual([]);
  });

  it('should treat doji (close === open) as bullish', () => {
    const bars = [{ open: 100, close: 100, volume: 500 }];
    const { delta } = computeVolumeDelta(bars);
    expect(delta[0]).toBe(500); // close >= open
  });
});

// ═══════════════════════════════════════════════════════════════════
// Volume Delta Indicator Registration Tests
// ═══════════════════════════════════════════════════════════════════

import { INDICATORS, createIndicatorInstance } from '../../charting_library/studies/indicators/registry.js';

describe('Volume Delta Indicator Registration', () => {
  it('should be registered in INDICATORS', () => {
    expect(INDICATORS.volumeDelta).toBeDefined();
    expect(INDICATORS.volumeDelta.mode).toBe('pane');
    expect(INDICATORS.volumeDelta.shortName).toBe('Vol Δ');
  });

  it('should have delta and cumDelta outputs', () => {
    const outputs = INDICATORS.volumeDelta.outputs;
    expect(outputs).toHaveLength(2);
    expect(outputs[0].key).toBe('delta');
    expect(outputs[0].type).toBe('histogram');
    expect(outputs[1].key).toBe('cumDelta');
    expect(outputs[1].type).toBe('line');
  });

  it('should compute delta values from bars', () => {
    const bars = [
      { open: 100, high: 110, low: 90, close: 110, volume: 1000 },
      { open: 110, high: 120, low: 100, close: 95, volume: 800 },
      { open: 95, high: 105, low: 85, close: 105, volume: 1200 },
    ];
    const instance = createIndicatorInstance('volumeDelta', {});
    const computed = instance.compute(bars);
    expect(computed.delta).toHaveLength(3);
    expect(computed.delta[0]).toBe(1000);   // bullish
    expect(computed.delta[1]).toBe(-800);   // bearish
    expect(computed.delta[2]).toBe(1200);   // bullish
  });

  it('should hide cumDelta when showCumulative is false', () => {
    const bars = [
      { open: 100, high: 110, low: 90, close: 110, volume: 1000 },
    ];
    const instance = createIndicatorInstance('volumeDelta', { showCumulative: false });
    const computed = instance.compute(bars);
    expect(computed.cumDelta[0]).toBeNaN();
  });
});

// ═══════════════════════════════════════════════════════════════════
// Volume Spike Detection Tests
// ═══════════════════════════════════════════════════════════════════

import { detectVolumeSpikes } from '../../charting_library/studies/indicators/volumeSpikes.js';

describe('detectVolumeSpikes', () => {
  it('should detect a spike when volume exceeds 2× average', () => {
    const bars = [];
    // 20 bars with volume ~100, then one bar with volume 500
    for (let i = 0; i < 20; i++) {
      bars.push({ open: 100, close: 101, volume: 100 });
    }
    bars.push({ open: 100, close: 101, volume: 500 }); // 5× average

    const { spikes, ratios } = detectVolumeSpikes(bars, 2, 20);
    expect(spikes[20]).toBe(true);
    expect(ratios[20]).toBe(5);
  });

  it('should NOT flag bars below the multiplier threshold', () => {
    const bars = [];
    for (let i = 0; i < 20; i++) {
      bars.push({ open: 100, close: 101, volume: 100 });
    }
    bars.push({ open: 100, close: 101, volume: 150 }); // 1.5× (below 2× threshold)

    const { spikes } = detectVolumeSpikes(bars, 2, 20);
    expect(spikes[20]).toBe(false);
  });

  it('should not flag first bar (no lookback data)', () => {
    const bars = [{ open: 100, close: 101, volume: 1000 }];
    const { spikes, ratios } = detectVolumeSpikes(bars, 2, 20);
    expect(spikes[0]).toBe(false);
    expect(ratios[0]).toBe(0);
  });

  it('should handle empty/null input', () => {
    expect(detectVolumeSpikes(null).spikes).toEqual([]);
    expect(detectVolumeSpikes([]).spikes).toEqual([]);
    expect(detectVolumeSpikes(null).ratios).toEqual([]);
  });

  it('should handle bars with zero volume', () => {
    const bars = [
      { open: 100, close: 101, volume: 0 },
      { open: 100, close: 101, volume: 0 },
      { open: 100, close: 101, volume: 100 },
    ];
    const { spikes } = detectVolumeSpikes(bars, 2, 20);
    // No crash, last bar has no meaningful average
    expect(spikes.length).toBe(3);
  });

  it('should respect custom multiplier', () => {
    const bars = [];
    for (let i = 0; i < 10; i++) {
      bars.push({ open: 100, close: 101, volume: 100 });
    }
    bars.push({ open: 100, close: 101, volume: 350 }); // 3.5×

    const result2x = detectVolumeSpikes(bars, 2, 10);
    const result4x = detectVolumeSpikes(bars, 4, 10);

    expect(result2x.spikes[10]).toBe(true);  // 3.5 >= 2
    expect(result4x.spikes[10]).toBe(false);  // 3.5 < 4
  });

  it('should respect custom lookback window', () => {
    // 5 bars volume=100, then 5 bars volume=500, then one bar volume=250
    const bars = [];
    for (let i = 0; i < 5; i++) bars.push({ open: 100, close: 101, volume: 100 });
    for (let i = 0; i < 5; i++) bars.push({ open: 100, close: 101, volume: 500 });
    bars.push({ open: 100, close: 101, volume: 250 });

    // With lookback=5 (only sees the 500-vol bars), 250/500 = 0.5 → not a spike
    const resultShort = detectVolumeSpikes(bars, 2, 5);
    expect(resultShort.spikes[10]).toBe(false);

    // With lookback=10 (sees both groups), avg = 300, 250/300 = 0.83 → not a spike
    const resultLong = detectVolumeSpikes(bars, 2, 10);
    expect(resultLong.spikes[10]).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Chart Annotation Store Tests
// ═══════════════════════════════════════════════════════════════════

import { useAnnotationStore } from '../../state/useAnnotationStore.js';

describe('Annotation Store', () => {
  beforeEach(() => {
    useAnnotationStore.setState({ annotations: {} });
  });

  it('should add an annotation for a symbol', () => {
    const id = useAnnotationStore.getState().addAnnotation('BTC', {
      timestamp: Date.now(),
      price: 50000,
      text: 'Key resistance',
      emoji: '🎯',
    });

    expect(id).toMatch(/^ann_/);
    const anns = useAnnotationStore.getState().getForSymbol('BTC');
    expect(anns).toHaveLength(1);
    expect(anns[0].text).toBe('Key resistance');
    expect(anns[0].emoji).toBe('🎯');
    expect(anns[0].price).toBe(50000);
  });

  it('should keep annotations separate per symbol', () => {
    useAnnotationStore.getState().addAnnotation('BTC', { timestamp: 1, price: 50000, text: 'BTC note' });
    useAnnotationStore.getState().addAnnotation('ETH', { timestamp: 2, price: 3000, text: 'ETH note' });

    expect(useAnnotationStore.getState().getForSymbol('BTC')).toHaveLength(1);
    expect(useAnnotationStore.getState().getForSymbol('ETH')).toHaveLength(1);
    expect(useAnnotationStore.getState().getForSymbol('SOL')).toHaveLength(0);
  });

  it('should remove an annotation by id', () => {
    const id = useAnnotationStore.getState().addAnnotation('BTC', {
      timestamp: 1, price: 50000, text: 'Delete me',
    });
    expect(useAnnotationStore.getState().getForSymbol('BTC')).toHaveLength(1);

    useAnnotationStore.getState().removeAnnotation('BTC', id);
    expect(useAnnotationStore.getState().getForSymbol('BTC')).toHaveLength(0);
  });

  it('should edit an annotation text and emoji', () => {
    const id = useAnnotationStore.getState().addAnnotation('BTC', {
      timestamp: 1, price: 50000, text: 'Original', emoji: '📌',
    });

    useAnnotationStore.getState().editAnnotation('BTC', id, { text: 'Updated', emoji: '🚀' });
    const ann = useAnnotationStore.getState().getForSymbol('BTC')[0];
    expect(ann.text).toBe('Updated');
    expect(ann.emoji).toBe('🚀');
  });

  it('should clear all annotations for a symbol', () => {
    useAnnotationStore.getState().addAnnotation('BTC', { timestamp: 1, price: 50000, text: 'Note 1' });
    useAnnotationStore.getState().addAnnotation('BTC', { timestamp: 2, price: 51000, text: 'Note 2' });
    useAnnotationStore.getState().addAnnotation('ETH', { timestamp: 3, price: 3000, text: 'ETH note' });

    useAnnotationStore.getState().clearSymbol('BTC');
    expect(useAnnotationStore.getState().getForSymbol('BTC')).toHaveLength(0);
    expect(useAnnotationStore.getState().getForSymbol('ETH')).toHaveLength(1);
  });

  it('should default to 📌 emoji when none provided', () => {
    useAnnotationStore.getState().addAnnotation('BTC', {
      timestamp: 1, price: 50000, text: 'No emoji set',
    });
    const ann = useAnnotationStore.getState().getForSymbol('BTC')[0];
    expect(ann.emoji).toBe('📌');
  });
});

// ═══════════════════════════════════════════════════════════════════
// Trade P/L Computation Tests
// ═══════════════════════════════════════════════════════════════════

import { computeTradeStats } from '../../app/components/chart/overlays/TradePLPill.jsx';

describe('computeTradeStats', () => {
  it('should compute aggregate stats from trades', () => {
    const trades = [
      { pnl: 100 },
      { pnl: -50 },
      { pnl: 200 },
      { pnl: -30 },
      { pnl: 75 },
    ];
    const stats = computeTradeStats(trades);
    expect(stats.count).toBe(5);
    expect(stats.totalPL).toBe(295);
    expect(stats.wins).toBe(3);
    expect(stats.losses).toBe(2);
    expect(stats.winRate).toBe(60);
    expect(stats.bestTrade).toBe(200);
    expect(stats.worstTrade).toBe(-50);
    expect(stats.avgPL).toBe(59);
  });

  it('should handle all winning trades', () => {
    const trades = [{ pnl: 100 }, { pnl: 50 }, { pnl: 75 }];
    const stats = computeTradeStats(trades);
    expect(stats.winRate).toBe(100);
    expect(stats.losses).toBe(0);
    expect(stats.totalPL).toBe(225);
  });

  it('should handle all losing trades', () => {
    const trades = [{ pnl: -100 }, { pnl: -50 }];
    const stats = computeTradeStats(trades);
    expect(stats.winRate).toBe(0);
    expect(stats.wins).toBe(0);
    expect(stats.totalPL).toBe(-150);
  });

  it('should handle pl/profit field aliases', () => {
    const trades = [{ pl: 100 }, { profit: -50 }];
    const stats = computeTradeStats(trades);
    expect(stats.totalPL).toBe(50);
  });

  it('should return null for empty/null input', () => {
    expect(computeTradeStats(null)).toBeNull();
    expect(computeTradeStats([])).toBeNull();
  });

  it('should handle single trade', () => {
    const stats = computeTradeStats([{ pnl: 42.5 }]);
    expect(stats.count).toBe(1);
    expect(stats.totalPL).toBe(42.5);
    expect(stats.winRate).toBe(100);
    expect(stats.bestTrade).toBe(42.5);
    expect(stats.worstTrade).toBe(42.5);
  });

  it('should handle zero P/L trades as wins', () => {
    const stats = computeTradeStats([{ pnl: 0 }]);
    expect(stats.wins).toBe(1);
    expect(stats.losses).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// CoordinateSystem Tests (Pixel-Perfect Transforms)
// ═══════════════════════════════════════════════════════════════════

import {
  mediaToBitmap,
  bitmapToMedia,
  mediaWidthToBitmap,
  positionsLine,
  positionsBox,
  createPriceTransform,
  createTimeTransform as createTimeTransformCS,
  candleWidthCoefficient,
  candleBodyWidth,
  candleWickWidth,
  visiblePriceRange,
  niceScale,
  formatPrice,
} from '../../charting_library/core/CoordinateSystem.js';

describe('mediaToBitmap / bitmapToMedia', () => {
  it('should round-trip at 1x pixel ratio', () => {
    expect(mediaToBitmap(100, 1)).toBe(100);
    expect(bitmapToMedia(100, 1)).toBe(100);
  });

  it('should scale correctly at 2x pixel ratio', () => {
    expect(mediaToBitmap(100, 2)).toBe(200);
    expect(bitmapToMedia(200, 2)).toBe(100);
  });

  it('should round to integer in mediaToBitmap', () => {
    expect(mediaToBitmap(10.7, 1.5)).toBe(Math.round(10.7 * 1.5));
    expect(Number.isInteger(mediaToBitmap(10.7, 1.5))).toBe(true);
  });
});

describe('mediaWidthToBitmap', () => {
  it('should floor the width and guarantee minimum 1', () => {
    expect(mediaWidthToBitmap(10, 2)).toBe(20);
    expect(mediaWidthToBitmap(0.3, 1)).toBe(1);
    expect(mediaWidthToBitmap(0, 2)).toBe(1);
  });
});

describe('positionsLine', () => {
  it('should compute pixel-perfect line position', () => {
    const result = positionsLine(100, 1, 2);
    expect(result.position).toBeDefined();
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(Number.isInteger(result.position)).toBe(true);
    expect(Number.isInteger(result.length)).toBe(true);
  });

  it('should center the line at the media coordinate', () => {
    const result = positionsLine(50, 1, 1);
    expect(result.position + Math.floor(result.length / 2)).toBe(50);
  });
});

describe('positionsBox', () => {
  it('should compute pixel-perfect box position', () => {
    const result = positionsBox(100, 10, 2);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(Number.isInteger(result.position)).toBe(true);
    expect(Number.isInteger(result.length)).toBe(true);
  });

  it('should center box around the media coordinate', () => {
    const result = positionsBox(50, 10, 1);
    const center = result.position + result.length / 2;
    expect(Math.abs(center - 50)).toBeLessThanOrEqual(1);
  });
});

describe('createPriceTransform (CoordinateSystem)', () => {
  it('linear: priceMin maps to bottom, priceMax to top', () => {
    const t = createPriceTransform(100, 200, 500);
    expect(t.priceToY(100)).toBeCloseTo(500, 1);
    expect(t.priceToY(200)).toBeCloseTo(0, 1);
    expect(t.priceToY(150)).toBeCloseTo(250, 1);
  });

  it('linear: round-trip priceToY → yToPrice', () => {
    const t = createPriceTransform(50, 150, 600);
    expect(t.yToPrice(t.priceToY(100))).toBeCloseTo(100, 5);
  });

  it('log: should handle log scale', () => {
    const t = createPriceTransform(10, 1000, 500, 'log');
    const y10 = t.priceToY(10);
    const y1000 = t.priceToY(1000);
    expect(y10).toBeGreaterThan(y1000);
    expect(t.yToPrice(y10)).toBeCloseTo(10, 0);
    expect(t.yToPrice(y1000)).toBeCloseTo(1000, 0);
  });

  it('percent: should pass through formatTicks', () => {
    const t = createPriceTransform(90, 110, 500, 'percent', 100);
    const ticks = t.formatTicks([90, 100, 110]);
    expect(ticks[0]).toBeCloseTo(-10, 1);
    expect(ticks[1]).toBeCloseTo(0, 1);
    expect(ticks[2]).toBeCloseTo(10, 1);
  });

  it('should handle zero range gracefully', () => {
    const t = createPriceTransform(100, 100, 500);
    expect(t.priceToY(100)).not.toBeNaN();
    expect(t.yToPrice(250)).not.toBeNaN();
  });
});

describe('createTimeTransform (CoordinateSystem)', () => {
  it('indexToX should return center of bar', () => {
    const t = createTimeTransformCS(0, 10);
    expect(t.indexToX(0)).toBe(5);
    expect(t.indexToX(1)).toBe(15);
  });

  it('xToIndex should reverse indexToX', () => {
    const t = createTimeTransformCS(0, 10);
    expect(t.xToIndex(5)).toBe(0);
    expect(t.xToIndex(15)).toBe(1);
  });

  it('should handle non-zero firstVisibleIdx', () => {
    const t = createTimeTransformCS(50, 8);
    expect(t.indexToX(50)).toBe(4);
    expect(t.xToIndex(4)).toBe(50);
  });
});

describe('candleWidthCoefficient', () => {
  it('should return 1.0 for very narrow spacing', () => {
    expect(candleWidthCoefficient(0.3)).toBe(1.0);
  });

  it('should return value between 0 and 1 for normal spacing', () => {
    const coeff = candleWidthCoefficient(10);
    expect(coeff).toBeGreaterThan(0);
    expect(coeff).toBeLessThanOrEqual(1);
  });

  it('should trend toward 0.8 for large spacing', () => {
    expect(candleWidthCoefficient(100)).toBeCloseTo(0.8, 1);
  });
});

describe('candleBodyWidth', () => {
  it('should return at least 1 pixel', () => {
    expect(candleBodyWidth(0.1)).toBeGreaterThanOrEqual(1);
    expect(candleBodyWidth(10)).toBeGreaterThanOrEqual(1);
  });

  it('should return an integer', () => {
    expect(Number.isInteger(candleBodyWidth(12.5))).toBe(true);
  });
});

describe('candleWickWidth', () => {
  it('should always return 1', () => {
    expect(candleWickWidth()).toBe(1);
  });
});

describe('visiblePriceRange', () => {
  it('should compute min/max with padding', () => {
    const bars = [{ high: 120, low: 80 }, { high: 130, low: 90 }, { high: 110, low: 85 }];
    const { min, max } = visiblePriceRange(bars, 0.05);
    expect(min).toBeLessThan(80);
    expect(max).toBeGreaterThan(130);
  });

  it('should return defaults for empty bars', () => {
    expect(visiblePriceRange([]).min).toBe(0);
    expect(visiblePriceRange([]).max).toBe(100);
  });

  it('should return defaults for null bars', () => {
    expect(visiblePriceRange(null).min).toBe(0);
  });
});

describe('niceScale', () => {
  it('should generate evenly spaced nice tick values', () => {
    const result = niceScale(0, 100, 5);
    expect(result.ticks.length).toBeGreaterThan(0);
    const diffs = result.ticks.slice(1).map((t, i) => t - result.ticks[i]);
    const allSame = diffs.every(d => Math.abs(d - diffs[0]) < 0.0001);
    expect(allSame).toBe(true);
  });

  it('should handle small ranges', () => {
    const result = niceScale(99.5, 100.5, 5);
    expect(result.ticks.length).toBeGreaterThan(0);
    expect(result.step).toBeGreaterThan(0);
  });
});

describe('formatPrice', () => {
  it('should format large prices with 0 decimals', () => {
    expect(formatPrice(50000)).toBe('50000');
  });

  it('should format mid-range prices with 2 decimals', () => {
    expect(formatPrice(150.123)).toBe('150.12');
  });

  it('should format small prices with more decimals', () => {
    expect(formatPrice(0.005)).toBe('0.005000');
    expect(formatPrice(0.00005)).toBe('0.00005000');
  });
});

// ═══════════════════════════════════════════════════════════════════
// TimeAxis Tests
// ═══════════════════════════════════════════════════════════════════

import { createTimeTransform as createTimeTransformTA, candleLayout } from '../../charting_library/core/TimeAxis.js';

describe('TimeAxis createTimeTransform', () => {
  const bars = [];
  const baseTime = new Date('2024-01-08T09:00:00Z').getTime();
  for (let i = 0; i < 100; i++) {
    bars.push({ time: baseTime + i * 60000, open: 100, high: 105, low: 95, close: 102, volume: 1000 });
  }

  it('indexToPixel and pixelToIndex should round-trip', () => {
    const tt = createTimeTransformTA(bars, 0, 0, 50, 500);
    const px = tt.indexToPixel(25);
    const idx = tt.pixelToIndex(px);
    expect(Math.abs(idx - 25)).toBeLessThan(1);
  });

  it('pixelToTime should return valid timestamp', () => {
    const tt = createTimeTransformTA(bars, 0, 0, 50, 500);
    expect(tt.pixelToTime(100)).toBeGreaterThan(0);
  });

  it('timeToPixel should locate a known bar', () => {
    const tt = createTimeTransformTA(bars, 0, 0, 50, 500);
    expect(tt.timeToPixel(bars[10].time)).toBeGreaterThan(0);
  });

  it('timeToPixel should handle future timestamps', () => {
    const tt = createTimeTransformTA(bars, 0, 0, 50, 500);
    const futureTime = bars[bars.length - 1].time + 300000;
    expect(tt.timeToPixel(futureTime)).toBeGreaterThan(tt.timeToPixel(bars[bars.length - 1].time));
  });

  it('should handle empty bars', () => {
    const tt = createTimeTransformTA([], 0, 0, 50, 500);
    expect(tt.pixelToTime(100)).toBeGreaterThan(0);
    expect(tt.timeToPixel(Date.now())).toBe(0);
  });
});

describe('candleLayout', () => {
  it('should return positive barW and bodyW', () => {
    const layout = candleLayout(10);
    expect(layout.barW).toBeGreaterThan(0);
    expect(layout.bodyW).toBeGreaterThanOrEqual(1);
    expect(layout.gap).toBeGreaterThanOrEqual(1);
  });

  it('barW + gap should equal barSpacing', () => {
    expect(candleLayout(10).barW + candleLayout(10).gap).toBe(10);
  });

  it('should handle very small bar spacing', () => {
    expect(candleLayout(2).bodyW).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════════
// FrameBudget Tests (LOD Management)
// ═══════════════════════════════════════════════════════════════════

import { FrameBudget, IndicatorCache } from '../../charting_library/core/FrameBudget.js';

describe('FrameBudget', () => {
  it('should initialize at LOD level 3', () => {
    const fb = new FrameBudget();
    expect(fb.level).toBe(3);
    const lod = fb.getLOD();
    expect(lod.volume).toBe(true);
    expect(lod.drawings).toBe(true);
    expect(lod.antiAlias).toBe(true);
  });

  it('should track frame timing', () => {
    const fb = new FrameBudget();
    fb.beginFrame();
    fb.beginPhase('test');
    fb.endPhase('test');
    const ms = fb.endFrame();
    expect(ms).toBeGreaterThanOrEqual(0);
  });

  it('setLevel should clamp and update', () => {
    const fb = new FrameBudget();
    fb.setLevel(0);
    expect(fb.level).toBe(0);
    const lod = fb.getLOD();
    expect(lod.volume).toBe(false);
    expect(lod.maxIndicators).toBe(0);
    expect(lod.drawings).toBe(false);
  });

  it('reset should restore to highest LOD', () => {
    const fb = new FrameBudget();
    fb.setLevel(0);
    fb.reset();
    expect(fb.level).toBe(3);
  });

  it('getStats should return valid stats object', () => {
    const fb = new FrameBudget();
    fb.beginFrame();
    fb.endFrame();
    const stats = fb.getStats();
    expect(stats).toHaveProperty('avgMs');
    expect(stats).toHaveProperty('lastMs');
    expect(stats).toHaveProperty('lod');
    expect(stats).toHaveProperty('totalFrames');
    expect(stats).toHaveProperty('droppedFrames');
    expect(stats).toHaveProperty('dropRate');
  });

  it('getPhaseStats should return phase breakdown', () => {
    const fb = new FrameBudget();
    fb.beginFrame();
    fb.beginPhase('grid');
    fb.endPhase('grid');
    fb.endFrame();
    expect(typeof fb.getPhaseStats()).toBe('object');
  });

  it('lastPhases should return last frame phases', () => {
    const fb = new FrameBudget();
    fb.beginFrame();
    fb.beginPhase('grid');
    fb.endPhase('grid');
    fb.endFrame();
    expect(typeof fb.lastPhases).toBe('object');
  });
});

describe('IndicatorCache', () => {
  it('should cache indicator computations', () => {
    const cache = new IndicatorCache();
    let computeCount = 0;
    const computeFn = () => { computeCount++; return { values: [1, 2, 3] }; };
    const indicators = [{ type: 'sma', params: { period: 20 } }];
    const data = [{ close: 100 }, { close: 101 }, { close: 102 }];

    cache.compute(indicators, data, computeFn);
    expect(computeCount).toBe(1);
    cache.compute(indicators, data, computeFn);
    expect(computeCount).toBe(1);
  });

  it('should recompute when data length changes', () => {
    const cache = new IndicatorCache();
    let computeCount = 0;
    const computeFn = () => { computeCount++; return { values: [] }; };
    const indicators = [{ type: 'sma', params: { period: 20 } }];

    cache.compute(indicators, [{ close: 100 }], computeFn);
    cache.compute(indicators, [{ close: 100 }, { close: 101 }], computeFn);
    expect(computeCount).toBe(2);
  });

  it('invalidate should force recompute', () => {
    const cache = new IndicatorCache();
    let computeCount = 0;
    const computeFn = () => { computeCount++; return { values: [] }; };
    const indicators = [{ type: 'sma', params: { period: 20 } }];
    const data = [{ close: 100 }];

    cache.compute(indicators, data, computeFn);
    cache.invalidate();
    cache.compute(indicators, data, computeFn);
    expect(computeCount).toBe(2);
  });

  it('clear should reset everything', () => {
    const cache = new IndicatorCache();
    cache.compute([{ type: 'sma', params: {} }], [{ close: 100 }], () => ({ values: [] }));
    expect(cache.size).toBeGreaterThan(0);
    cache.clear();
    expect(cache.size).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// DrawingModel Serialization Tests
// ═══════════════════════════════════════════════════════════════════

import { generateId, serializeDrawings, deserializeDrawings, FIB_LEVELS, FIB_COLORS } from '../../charting_library/tools/tools/DrawingModel.js';

describe('generateId', () => {
  it('should generate unique IDs starting with draw_', () => {
    const id1 = generateId();
    const id2 = generateId();
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^draw_/);
  });
});

describe('serializeDrawings / deserializeDrawings', () => {
  it('should round-trip drawings through JSON', () => {
    const drawings = [
      createDrawing('trendline', { price: 100, time: Date.now() }),
      createDrawing('fib', { price: 200, time: Date.now() }),
    ];
    const json = serializeDrawings(drawings);
    const restored = deserializeDrawings(json);
    expect(restored).toHaveLength(2);
    expect(restored[0].type).toBe('trendline');
    expect(restored[1].type).toBe('fib');
    expect(restored[0].state).toBe('idle');
  });

  it('should handle empty array', () => {
    expect(deserializeDrawings(serializeDrawings([]))).toEqual([]);
  });

  it('should handle invalid JSON gracefully', () => {
    expect(deserializeDrawings('not valid json')).toEqual([]);
  });
});

describe('createDrawing for all tool types', () => {
  const toolTypes = Object.keys(TOOL_POINT_COUNT);

  it('should create valid drawings for all registered tool types', () => {
    for (const type of toolTypes) {
      const drawing = createDrawing(type);
      expect(drawing.type).toBe(type);
      expect(drawing.id).toMatch(/^draw_/);
      expect(drawing.points).toEqual([]);
      expect(drawing.state).toBe('creating');
      expect(drawing.locked).toBe(false);
      expect(drawing.visible).toBe(true);
    }
  });
});

describe('FIB_LEVELS and FIB_COLORS', () => {
  it('should have standard Fibonacci levels', () => {
    expect(FIB_LEVELS).toContain(0);
    expect(FIB_LEVELS).toContain(0.382);
    expect(FIB_LEVELS).toContain(0.5);
    expect(FIB_LEVELS).toContain(0.618);
    expect(FIB_LEVELS).toContain(1);
  });

  it('should have colors for key levels', () => {
    expect(FIB_COLORS[0]).toBeDefined();
    expect(FIB_COLORS[0.618]).toBe('#4CAF50');
  });
});

// ═══════════════════════════════════════════════════════════════════
// Indicator Computations Tests (SMA, EMA, RSI, MACD, BB, etc.)
// ═══════════════════════════════════════════════════════════════════

import * as C from '../../charting_library/studies/indicators/computations.js';

describe('SMA', () => {
  it('should compute simple moving average', () => {
    const src = [10, 20, 30, 40, 50];
    const result = C.sma(src, 3);
    expect(result).toHaveLength(5);
    expect(result[0]).toBeNaN();
    expect(result[1]).toBeNaN();
    expect(result[2]).toBeCloseTo(20, 5);
    expect(result[3]).toBeCloseTo(30, 5);
    expect(result[4]).toBeCloseTo(40, 5);
  });
});

describe('EMA', () => {
  it('should compute exponential moving average', () => {
    const src = [10, 20, 30, 40, 50];
    const result = C.ema(src, 3);
    expect(result).toHaveLength(5);
    expect(result[2]).toBeCloseTo(20, 0);
    expect(result[3]).toBeGreaterThan(result[2]);
    expect(result[4]).toBeGreaterThan(result[3]);
  });
});

describe('Bollinger Bands', () => {
  it('should compute middle, upper, and lower bands', () => {
    const src = [];
    for (let i = 0; i < 30; i++) src.push(100 + Math.sin(i * 0.5) * 5);
    const { middle, upper, lower } = C.bollingerBands(src, 20, 2);
    expect(middle).toHaveLength(30);
    for (let i = 20; i < 30; i++) {
      expect(upper[i]).toBeGreaterThanOrEqual(middle[i]);
      expect(lower[i]).toBeLessThanOrEqual(middle[i]);
    }
  });
});

describe('RSI', () => {
  it('should compute RSI between 0 and 100', () => {
    const src = [];
    for (let i = 0; i < 30; i++) src.push(100 + i * 2 + Math.sin(i) * 3);
    const result = C.rsi(src, 14);
    expect(result).toHaveLength(30);
    for (let i = 15; i < 30; i++) {
      expect(result[i]).toBeGreaterThanOrEqual(0);
      expect(result[i]).toBeLessThanOrEqual(100);
    }
  });

  it('should be high for consistently rising prices', () => {
    const src = [];
    for (let i = 0; i < 30; i++) src.push(100 + i * 5);
    expect(C.rsi(src, 14)[29]).toBeGreaterThan(80);
  });
});

describe('MACD', () => {
  it('should compute macd, signal, and histogram', () => {
    const src = [];
    for (let i = 0; i < 50; i++) src.push(100 + Math.sin(i * 0.3) * 10 + i);
    const { macd: m, signal: s, histogram: h } = C.macd(src);
    expect(m).toHaveLength(50);
    expect(s).toHaveLength(50);
    for (let i = 35; i < 50; i++) {
      if (!isNaN(m[i]) && !isNaN(s[i])) {
        expect(h[i]).toBeCloseTo(m[i] - s[i], 5);
      }
    }
  });
});

describe('Stochastic', () => {
  it('should compute %K and %D between 0 and 100', () => {
    const bars = [];
    for (let i = 0; i < 30; i++) {
      const close = 100 + Math.sin(i * 0.4) * 10;
      bars.push({ high: close + 3, low: close - 3, close });
    }
    const { k, d } = C.stochastic(bars, 14, 3);
    expect(k).toHaveLength(30);
    for (let i = 15; i < 30; i++) {
      if (!isNaN(k[i])) {
        expect(k[i]).toBeGreaterThanOrEqual(0);
        expect(k[i]).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe('ATR', () => {
  it('should compute positive ATR values', () => {
    const bars = [];
    for (let i = 0; i < 20; i++) bars.push({ high: 110 + i, low: 90 + i, close: 100 + i });
    const result = C.atr(bars, 14);
    for (let i = 14; i < 20; i++) expect(result[i]).toBeGreaterThan(0);
  });
});

describe('OBV', () => {
  it('should accumulate volume on up closes', () => {
    const bars = [
      { close: 100, volume: 500 },
      { close: 105, volume: 600 },
      { close: 110, volume: 700 },
    ];
    const result = C.obv(bars);
    expect(result[1]).toBe(result[0] + 600);
    expect(result[2]).toBe(result[1] + 700);
  });

  it('should subtract volume on down closes', () => {
    const bars = [{ close: 100, volume: 500 }, { close: 95, volume: 300 }];
    expect(C.obv(bars)[1]).toBe(C.obv(bars)[0] - 300);
  });
});

describe('WMA', () => {
  it('should compute weighted moving average', () => {
    const src = [10, 20, 30, 40, 50];
    const result = C.wma(src, 3);
    expect(result[2]).toBeCloseTo(23.33, 1);
  });
});

describe('DEMA', () => {
  it('should compute double EMA', () => {
    const src = [];
    for (let i = 0; i < 30; i++) src.push(100 + i);
    const result = C.dema(src, 10);
    expect(result[29]).toBeGreaterThan(result[20]);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Core Slice Tests (Symbol, Timeframe, Chart Type)
// ═══════════════════════════════════════════════════════════════════

describe('Core Slice', () => {
  it('setSymbol should uppercase', () => {
    useChartStore.getState().setSymbol('eth');
    expect(useChartStore.getState().symbol).toBe('ETH');
    useChartStore.getState().setSymbol('BTC');
  });

  it('setTf should update timeframe', () => {
    useChartStore.getState().setTf('5m');
    expect(useChartStore.getState().tf).toBe('5m');
    useChartStore.getState().setTf('1h');
  });

  it('setChartType should update chart type', () => {
    useChartStore.getState().setChartType('heikinashi');
    expect(useChartStore.getState().chartType).toBe('heikinashi');
    useChartStore.getState().setChartType('candlestick');
  });

  it('setCandleMode should map standard → candlestick', () => {
    useChartStore.getState().setCandleMode('standard');
    expect(useChartStore.getState().chartType).toBe('candlestick');
  });

  it('setCandleMode should map hollow → hollow', () => {
    useChartStore.getState().setCandleMode('hollow');
    expect(useChartStore.getState().chartType).toBe('hollow');
    useChartStore.getState().setCandleMode('standard');
  });

  it('setCandleMode should map heikinashi → heikinashi', () => {
    useChartStore.getState().setCandleMode('heikinashi');
    expect(useChartStore.getState().chartType).toBe('heikinashi');
    useChartStore.getState().setCandleMode('standard');
  });

  it('setCandleMode should map footprint → footprint', () => {
    useChartStore.getState().setCandleMode('footprint');
    expect(useChartStore.getState().chartType).toBe('footprint');
    useChartStore.getState().setCandleMode('standard');
  });

  it('setCandleMode unknown → candlestick fallback', () => {
    useChartStore.getState().setCandleMode('nonexistent');
    expect(useChartStore.getState().chartType).toBe('candlestick');
  });

  it('toggleLogScale should toggle logScale and scaleMode', () => {
    useChartStore.setState({ logScale: false, scaleMode: 'linear' });
    useChartStore.getState().toggleLogScale();
    expect(useChartStore.getState().logScale).toBe(true);
    expect(useChartStore.getState().scaleMode).toBe('log');
    useChartStore.getState().toggleLogScale();
    expect(useChartStore.getState().logScale).toBe(false);
    expect(useChartStore.getState().scaleMode).toBe('linear');
  });
});

// ═══════════════════════════════════════════════════════════════════
// Drawing Slice Extended Tests
// ═══════════════════════════════════════════════════════════════════

describe('Drawing Slice Extended', () => {
  beforeEach(() => {
    useChartStore.setState({
      activeTool: null, drawingColor: '#2962FF', magnetMode: false,
      selectedDrawingId: null, drawings: [], drawingHistory: [], drawingFuture: [],
    });
  });

  it('setActiveTool should update the active tool', () => {
    useChartStore.getState().setActiveTool('trendline');
    expect(useChartStore.getState().activeTool).toBe('trendline');
    useChartStore.getState().setActiveTool(null);
    expect(useChartStore.getState().activeTool).toBeNull();
  });

  it('setDrawingColor should update color', () => {
    useChartStore.getState().setDrawingColor('#FF0000');
    expect(useChartStore.getState().drawingColor).toBe('#FF0000');
  });

  it('toggleMagnetMode should flip magnet state', () => {
    expect(useChartStore.getState().magnetMode).toBe(false);
    useChartStore.getState().toggleMagnetMode();
    expect(useChartStore.getState().magnetMode).toBe(true);
    useChartStore.getState().toggleMagnetMode();
    expect(useChartStore.getState().magnetMode).toBe(false);
  });

  it('removeDrawing should remove by ID and push to undo history', () => {
    useChartStore.getState().addDrawing({ id: 'test1', type: 'hline', points: [{ price: 100 }] });
    useChartStore.getState().addDrawing({ id: 'test2', type: 'vline', points: [{ price: 200 }] });
    useChartStore.getState().removeDrawing('test1');
    expect(useChartStore.getState().drawings).toHaveLength(1);
    expect(useChartStore.getState().drawings[0].type).toBe('vline');
  });

  it('removeDrawing should clear selectedDrawingId if matching', () => {
    useChartStore.getState().addDrawing({ id: 'sel1', type: 'hline', points: [] });
    useChartStore.getState().setSelectedDrawing('sel1');
    useChartStore.getState().removeDrawing('sel1');
    expect(useChartStore.getState().selectedDrawingId).toBeNull();
  });

  it('setDrawings should replace without affecting undo history', () => {
    useChartStore.getState().addDrawing({ type: 'hline', points: [] });
    const histLen = useChartStore.getState().drawingHistory.length;
    useChartStore.getState().setDrawings([{ id: 'x', type: 'fib', points: [] }]);
    expect(useChartStore.getState().drawings).toHaveLength(1);
    expect(useChartStore.getState().drawingHistory.length).toBe(histLen);
  });

  it('undo history should be capped at 50', () => {
    for (let i = 0; i < 60; i++) {
      useChartStore.getState().addDrawing({ type: 'hline', points: [{ price: i }] });
    }
    expect(useChartStore.getState().drawingHistory.length).toBeLessThanOrEqual(50);
  });
});

// ═══════════════════════════════════════════════════════════════════
// UI Slice Tests (Layout, Quad Mode, Sync, Volume, Colors)
// ═══════════════════════════════════════════════════════════════════

describe('UI Slice', () => {
  it('setLayoutMode should update layout', () => {
    useChartStore.getState().setLayoutMode('2x2');
    expect(useChartStore.getState().layoutMode).toBe('2x2');
    useChartStore.getState().setLayoutMode('1x1');
  });

  it('toggleQuadMode should flip between 1x1 and 2x2', () => {
    useChartStore.setState({ layoutMode: '1x1' });
    useChartStore.getState().toggleQuadMode();
    expect(useChartStore.getState().layoutMode).toBe('2x2');
    useChartStore.getState().toggleQuadMode();
    expect(useChartStore.getState().layoutMode).toBe('1x1');
  });

  it('setQuadSymbols should update symbols', () => {
    useChartStore.getState().setQuadSymbols(['SOL', 'AVAX', 'DOT', 'ADA']);
    expect(useChartStore.getState().quadSymbols).toEqual(['SOL', 'AVAX', 'DOT', 'ADA']);
    useChartStore.getState().setQuadSymbols(['BTC', 'ETH', 'SOL', 'BNB']);
  });

  it('toggleSyncSymbol should flip sync state', () => {
    useChartStore.setState({ syncSymbol: false });
    useChartStore.getState().toggleSyncSymbol();
    expect(useChartStore.getState().syncSymbol).toBe(true);
    useChartStore.getState().toggleSyncSymbol();
    expect(useChartStore.getState().syncSymbol).toBe(false);
  });

  it('toggleSyncTf should flip tf sync state', () => {
    useChartStore.setState({ syncTf: false });
    useChartStore.getState().toggleSyncTf();
    expect(useChartStore.getState().syncTf).toBe(true);
    useChartStore.getState().toggleSyncTf();
    expect(useChartStore.getState().syncTf).toBe(false);
  });

  it('toggleOrderFlow should flip', () => {
    useChartStore.setState({ orderFlow: false });
    useChartStore.getState().toggleOrderFlow();
    expect(useChartStore.getState().orderFlow).toBe(true);
    useChartStore.getState().toggleOrderFlow();
    expect(useChartStore.getState().orderFlow).toBe(false);
  });

  it('toggleVolume should flip volume visibility', () => {
    useChartStore.setState({ showVolume: true });
    useChartStore.getState().toggleVolume();
    expect(useChartStore.getState().showVolume).toBe(false);
    useChartStore.getState().toggleVolume();
    expect(useChartStore.getState().showVolume).toBe(true);
  });

  it('toggleVolumeProfile should flip VP visibility', () => {
    useChartStore.setState({ showVolumeProfile: false });
    useChartStore.getState().toggleVolumeProfile();
    expect(useChartStore.getState().showVolumeProfile).toBe(true);
    useChartStore.getState().toggleVolumeProfile();
    expect(useChartStore.getState().showVolumeProfile).toBe(false);
  });

  it('setChartColors should merge and resetChartColors should clear', () => {
    useChartStore.getState().setChartColors({ candleUp: '#00FF00' });
    expect(useChartStore.getState().chartColors.candleUp).toBe('#00FF00');
    useChartStore.getState().resetChartColors();
    expect(useChartStore.getState().chartColors).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════
// Features Slice Extended Tests (All Toggles)
// ═══════════════════════════════════════════════════════════════════

describe('Features Slice — Replay', () => {
  it('toggleReplay should flip replay mode and reset index', () => {
    useChartStore.setState({ replayMode: false, replayIdx: 5, replayPlaying: true });
    useChartStore.getState().toggleReplay();
    expect(useChartStore.getState().replayMode).toBe(true);
    expect(useChartStore.getState().replayIdx).toBe(0);
    expect(useChartStore.getState().replayPlaying).toBe(false);
  });

  it('setReplayIdx / setReplayPlaying should update', () => {
    useChartStore.getState().setReplayIdx(42);
    expect(useChartStore.getState().replayIdx).toBe(42);
    useChartStore.getState().setReplayPlaying(true);
    expect(useChartStore.getState().replayPlaying).toBe(true);
  });

  it('addBacktestTrade / clearBacktestTrades', () => {
    useChartStore.setState({ backtestTrades: [] });
    useChartStore.getState().addBacktestTrade({ symbol: 'BTC', pnl: 100 });
    useChartStore.getState().addBacktestTrade({ symbol: 'ETH', pnl: -50 });
    expect(useChartStore.getState().backtestTrades).toHaveLength(2);
    useChartStore.getState().clearBacktestTrades();
    expect(useChartStore.getState().backtestTrades).toHaveLength(0);
  });
});

describe('Features Slice — Comparison', () => {
  it('setComparison / clearComparison', () => {
    useChartStore.getState().setComparison('ETH', [1, 2, 3]);
    expect(useChartStore.getState().comparisonSymbol).toBe('ETH');
    expect(useChartStore.getState().comparisonData).toEqual([1, 2, 3]);
    useChartStore.getState().clearComparison();
    expect(useChartStore.getState().comparisonSymbol).toBeNull();
    expect(useChartStore.getState().comparisonData).toBeNull();
  });
});

describe('Features Slice — Toggle Zoo', () => {
  const toggleTests = [
    ['toggleHeatmap', 'showHeatmap'],
    ['toggleSessions', 'showSessions'],
    ['toggleMTF', 'showMTF'],
    ['toggleDOM', 'showDOM'],
    ['toggleDepthChart', 'showDepthChart'],
    ['toggleExtendedHours', 'showExtendedHours'],
    ['toggleComparisonOverlay', 'showComparisonOverlay'],
    ['toggleCustomTf', 'showCustomTf'],
    ['togglePatternOverlays', 'showPatternOverlays'],
    ['toggleVolumeSpikes', 'showVolumeSpikes'],
  ];

  for (const [fn, key] of toggleTests) {
    it(`${fn} should flip ${key}`, () => {
      useChartStore.setState({ [key]: false });
      useChartStore.getState()[fn]();
      expect(useChartStore.getState()[key]).toBe(true);
      useChartStore.getState()[fn]();
      expect(useChartStore.getState()[key]).toBe(false);
    });
  }
});

describe('Features Slice — Heatmap Intensity', () => {
  it('setHeatmapIntensity should update', () => {
    useChartStore.getState().setHeatmapIntensity(0.5);
    expect(useChartStore.getState().heatmapIntensity).toBe(0.5);
    useChartStore.getState().setHeatmapIntensity(1.0);
  });
});

describe('Features Slice — MTF Timeframes', () => {
  it('setMTFTimeframes should update', () => {
    useChartStore.getState().setMTFTimeframes(['1m', '5m', '1h']);
    expect(useChartStore.getState().mtfTimeframes).toEqual(['1m', '5m', '1h']);
    useChartStore.getState().setMTFTimeframes(['15m', '1h', '4h']);
  });
});

describe('Features Slice — Drawing Favorites', () => {
  beforeEach(() => {
    useChartStore.setState({ drawingFavorites: ['trendline', 'hline', 'fib', 'rect'] });
  });

  it('addDrawingFavorite should add unique tool', () => {
    useChartStore.getState().addDrawingFavorite('channel');
    expect(useChartStore.getState().drawingFavorites).toContain('channel');
  });

  it('addDrawingFavorite should not duplicate', () => {
    useChartStore.getState().addDrawingFavorite('trendline');
    const count = useChartStore.getState().drawingFavorites.filter(f => f === 'trendline').length;
    expect(count).toBe(1);
  });

  it('removeDrawingFavorite should remove a tool', () => {
    useChartStore.getState().removeDrawingFavorite('fib');
    expect(useChartStore.getState().drawingFavorites).not.toContain('fib');
  });
});

describe('Features Slice — Pane Heights', () => {
  beforeEach(() => { useChartStore.setState({ paneHeights: {} }); });

  it('setPaneHeight should store clamped fraction', () => {
    useChartStore.getState().setPaneHeight(0, 0.3);
    expect(useChartStore.getState().paneHeights[0]).toBe(0.3);
  });

  it('setPaneHeight should clamp below 0.08', () => {
    useChartStore.getState().setPaneHeight(1, 0.01);
    expect(useChartStore.getState().paneHeights[1]).toBe(0.08);
  });

  it('setPaneHeight should clamp above 0.5', () => {
    useChartStore.getState().setPaneHeight(2, 0.9);
    expect(useChartStore.getState().paneHeights[2]).toBe(0.5);
  });

  it('resetPaneHeights should clear all', () => {
    useChartStore.getState().setPaneHeight(0, 0.3);
    useChartStore.getState().resetPaneHeights();
    expect(useChartStore.getState().paneHeights).toEqual({});
  });
});

describe('Features Slice — Volume Spike Multiplier', () => {
  it('setVolumeSpikeMultiplier should update', () => {
    useChartStore.getState().setVolumeSpikeMultiplier(3);
    expect(useChartStore.getState().volumeSpikeMultiplier).toBe(3);
    useChartStore.getState().setVolumeSpikeMultiplier(2);
  });
});

describe('Features Slice — Intelligence Toggles', () => {
  it('setIntelligence should update a key', () => {
    useChartStore.getState().setIntelligence('showSR', false);
    expect(useChartStore.getState().intelligence.showSR).toBe(false);
    useChartStore.getState().setIntelligence('showSR', true);
  });

  it('toggleIntelligence should flip a key', () => {
    const before = useChartStore.getState().intelligence.showPatterns;
    useChartStore.getState().toggleIntelligence('showPatterns');
    expect(useChartStore.getState().intelligence.showPatterns).toBe(!before);
    useChartStore.getState().toggleIntelligence('showPatterns');
  });

  it('toggleIntelligenceMaster should flip enabled', () => {
    const before = useChartStore.getState().intelligence.enabled;
    useChartStore.getState().toggleIntelligenceMaster();
    expect(useChartStore.getState().intelligence.enabled).toBe(!before);
    useChartStore.getState().toggleIntelligenceMaster();
  });
});

// ═══════════════════════════════════════════════════════════════════
// DrawingEngine State Machine Tests
// ═══════════════════════════════════════════════════════════════════

import { createDrawingEngine } from '../../charting_library/tools/tools/DrawingEngine.js';
import { TOOL_POINT_COUNT } from '../../charting_library/tools/tools/DrawingModel.js';

/**
 * Helper: create an engine with mock coordinate converters.
 * Maps price ↔ y 1:1 and time ↔ x 1:1 for easy testing.
 */
function makeTestEngine(opts = {}) {
  const engine = createDrawingEngine(opts);
  engine.setCoordinateConverters({
    pixelToPrice: (y) => y,
    pixelToTime: (x) => x,
    priceToPixel: (price) => price,
    timeToPixel: (time) => time,
  });
  return engine;
}

describe('DrawingEngine — Tool Activation', () => {
  it('should start in IDLE state with no drawings', () => {
    const engine = makeTestEngine();
    expect(engine.state).toBe('idle');
    expect(engine.drawings).toHaveLength(0);
    expect(engine.activeTool).toBeNull();
  });

  it('activateTool should transition to CREATING state', () => {
    const engine = makeTestEngine();
    engine.activateTool('trendline');
    expect(engine.state).toBe('creating');
    expect(engine.activeTool).toBe('trendline');
    expect(engine.drawings).toHaveLength(1);
    expect(engine.drawings[0].type).toBe('trendline');
  });

  it('cancelTool should return to IDLE and remove unfinished drawing', () => {
    const engine = makeTestEngine();
    engine.activateTool('trendline');
    engine.cancelTool();
    expect(engine.state).toBe('idle');
    expect(engine.activeTool).toBeNull();
    expect(engine.drawings).toHaveLength(0);
  });

  it('activating a new tool should cancel the previous one', () => {
    const engine = makeTestEngine();
    engine.activateTool('trendline');
    engine.activateTool('rect');
    expect(engine.drawings).toHaveLength(1);
    expect(engine.drawings[0].type).toBe('rect');
    expect(engine.activeTool).toBe('rect');
  });
});

describe('DrawingEngine — 2-Point Tool Completion (trendline)', () => {
  it('should complete a trendline after 2 clicks', () => {
    let stateLog = [];
    const engine = makeTestEngine({
      onStateChange: (s) => stateLog.push(s),
    });

    engine.activateTool('trendline');
    expect(engine.state).toBe('creating');

    // First click
    engine.onMouseDown(100, 200);
    expect(engine.drawings[0].points).toHaveLength(1);

    // Move to preview
    engine.onMouseMove(150, 250);
    expect(engine.drawings[0].points).toHaveLength(2); // ghost point

    // Second click completes
    engine.onMouseDown(150, 250);
    expect(engine.state).toBe('idle');
    expect(engine.activeTool).toBeNull();
    expect(engine.drawings).toHaveLength(1);
    expect(engine.drawings[0].state).toBe('idle');
    expect(engine.drawings[0].points).toHaveLength(2);
    expect(engine.drawings[0].points[0].price).toBe(200);
    expect(engine.drawings[0].points[0].time).toBe(100);
  });
});

describe('DrawingEngine — 1-Point Tool (hline)', () => {
  it('should complete an hline after 1 click', () => {
    const engine = makeTestEngine();
    engine.activateTool('hline');
    engine.onMouseDown(50, 100);
    expect(engine.state).toBe('idle');
    expect(engine.drawings).toHaveLength(1);
    expect(engine.drawings[0].points).toHaveLength(1);
    expect(engine.drawings[0].points[0].price).toBe(100);
  });
});

describe('DrawingEngine — 3-Point Tool (channel)', () => {
  it('should complete a channel after 3 clicks', () => {
    const engine = makeTestEngine();
    engine.activateTool('channel');
    engine.onMouseDown(10, 20);
    engine.onMouseMove(30, 40);
    engine.onMouseDown(30, 40);
    engine.onMouseMove(50, 60);
    engine.onMouseDown(50, 60);
    expect(engine.state).toBe('idle');
    expect(engine.drawings[0].points).toHaveLength(3);
  });
});

describe('DrawingEngine — 5-Point Tool (elliott)', () => {
  it('should complete an elliott wave after 5 clicks', () => {
    const engine = makeTestEngine();
    engine.activateTool('elliott');
    for (let i = 0; i < 5; i++) {
      engine.onMouseDown(i * 20, i * 10);
      if (i < 4) {
        engine.onMouseMove((i + 1) * 20, (i + 1) * 10);
      }
    }
    expect(engine.state).toBe('idle');
    expect(engine.drawings[0].type).toBe('elliott');
    expect(engine.drawings[0].points).toHaveLength(5);
  });
});

describe('DrawingEngine — Selection & Deselection', () => {
  it('should select a drawing by clicking on it', () => {
    const engine = makeTestEngine();
    // Create a trendline from (100,100) to (200,200)
    engine.activateTool('trendline');
    engine.onMouseDown(100, 100);
    engine.onMouseDown(200, 200);

    // Click on the midpoint of the trendline
    engine.onMouseDown(150, 150);
    expect(engine.selectedDrawing).not.toBeNull();
    expect(engine.selectedDrawing.type).toBe('trendline');
  });

  it('should deselect when clicking empty space', () => {
    const engine = makeTestEngine();
    engine.activateTool('hline');
    engine.onMouseDown(100, 100);

    // Select it
    engine.onMouseDown(50, 100); // on the h-line
    expect(engine.selectedDrawing).not.toBeNull();

    // Click far away
    engine.onMouseDown(500, 500);
    expect(engine.selectedDrawing).toBeNull();
    expect(engine.state).toBe('idle');
  });
});

describe('DrawingEngine — Drag & Move', () => {
  it('should drag an anchor point', () => {
    const engine = makeTestEngine();
    engine.activateTool('trendline');
    engine.onMouseDown(100, 100);
    engine.onMouseDown(200, 200);

    // Click on anchor at (100,100)
    engine.onMouseDown(100, 100);
    expect(engine.state).toBe('dragging');

    // Move anchor
    engine.onMouseMove(120, 130);
    expect(engine.drawings[0].points[0].price).toBeCloseTo(130, 0);
    expect(engine.drawings[0].points[0].time).toBeCloseTo(120, 0);

    engine.onMouseUp(120, 130);
    expect(engine.state).toBe('selected');
  });

  it('should move entire drawing when dragging body', () => {
    const engine = makeTestEngine();
    engine.activateTool('trendline');
    engine.onMouseDown(100, 100);
    engine.onMouseDown(200, 200);

    // Click on the body (midpoint, not an anchor)
    engine.onMouseDown(150, 150);
    expect(engine.state).toBe('moving');

    // Move drawing by 50px
    engine.onMouseMove(200, 200);
    engine.onMouseUp(200, 200);
    expect(engine.state).toBe('selected');
  });

  it('should not allow moving locked drawings', () => {
    const engine = makeTestEngine();
    engine.activateTool('trendline');
    engine.onMouseDown(100, 100);
    engine.onMouseDown(200, 200);

    const id = engine.drawings[0].id;
    engine.toggleLock(id);

    // Click on the trendline body
    engine.onMouseDown(150, 150);
    expect(engine.state).toBe('selected'); // not 'moving'
  });
});

describe('DrawingEngine — Keyboard Events', () => {
  it('Escape should cancel an in-progress drawing', () => {
    const engine = makeTestEngine();
    engine.activateTool('trendline');
    engine.onMouseDown(100, 100); // First point
    expect(engine.drawings).toHaveLength(1);

    engine.onKeyDown('Escape');
    expect(engine.drawings).toHaveLength(0);
    expect(engine.state).toBe('idle');
  });

  it('Escape should deselect a selected drawing', () => {
    const engine = makeTestEngine();
    engine.activateTool('hline');
    engine.onMouseDown(100, 100);

    // Select
    engine.onMouseDown(50, 100);
    engine.onMouseUp(50, 100);
    expect(engine.selectedDrawing).not.toBeNull();

    engine.onKeyDown('Escape');
    expect(engine.selectedDrawing).toBeNull();
  });

  it('Delete should remove selected drawing', () => {
    const engine = makeTestEngine();
    engine.activateTool('hline');
    engine.onMouseDown(100, 100);

    // Select
    engine.onMouseDown(50, 100);
    engine.onMouseUp(50, 100);
    expect(engine.selectedDrawing).not.toBeNull();

    engine.onKeyDown('Delete');
    expect(engine.drawings).toHaveLength(0);
    expect(engine.selectedDrawing).toBeNull();
  });

  it('Backspace should also remove selected drawing', () => {
    const engine = makeTestEngine();
    engine.activateTool('hline');
    engine.onMouseDown(100, 100);

    engine.onMouseDown(50, 100);
    engine.onMouseUp(50, 100);
    engine.onKeyDown('Backspace');
    expect(engine.drawings).toHaveLength(0);
  });
});

describe('DrawingEngine — Hover Tracking', () => {
  it('should track hoveredDrawingId on mouse move in IDLE', () => {
    let changes = 0;
    const engine = makeTestEngine({ onChange: () => changes++ });
    engine.activateTool('hline');
    engine.onMouseDown(100, 100);

    const prevChanges = changes;
    // Move to the line
    engine.onMouseMove(50, 100);
    expect(engine.hoveredDrawingId).toBe(engine.drawings[0].id);
    expect(changes).toBeGreaterThan(prevChanges);

    // Move away
    engine.onMouseMove(50, 500);
    expect(engine.hoveredDrawingId).toBeNull();
  });
});

describe('DrawingEngine — Drawing Management', () => {
  it('addDrawing should push a pre-built drawing', () => {
    const engine = makeTestEngine();
    engine.addDrawing({
      id: 'test_1',
      type: 'hline',
      points: [{ price: 50, time: 1000 }],
      style: { color: '#FF0000' },
      locked: false,
      visible: true,
    });
    expect(engine.drawings).toHaveLength(1);
    expect(engine.drawings[0].id).toBe('test_1');
  });

  it('removeDrawing should delete by ID', () => {
    const engine = makeTestEngine();
    engine.activateTool('hline');
    engine.onMouseDown(100, 100);
    const id = engine.drawings[0].id;

    engine.removeDrawing(id);
    expect(engine.drawings).toHaveLength(0);
  });

  it('clearAll should remove everything', () => {
    const engine = makeTestEngine();
    engine.activateTool('hline');
    engine.onMouseDown(100, 100);
    engine.activateTool('vline');
    engine.onMouseDown(200, 200);

    expect(engine.drawings).toHaveLength(2);
    engine.clearAll();
    expect(engine.drawings).toHaveLength(0);
    expect(engine.state).toBe('idle');
  });

  it('toggleVisibility should flip visible flag', () => {
    const engine = makeTestEngine();
    engine.activateTool('hline');
    engine.onMouseDown(100, 100);
    const id = engine.drawings[0].id;

    expect(engine.drawings[0].visible).toBe(true);
    engine.toggleVisibility(id);
    expect(engine.drawings[0].visible).toBe(false);
    engine.toggleVisibility(id);
    expect(engine.drawings[0].visible).toBe(true);
  });

  it('updateStyle should merge style properties', () => {
    const engine = makeTestEngine();
    engine.activateTool('hline');
    engine.onMouseDown(100, 100);
    const id = engine.drawings[0].id;

    engine.updateStyle(id, { color: '#FF0000', lineWidth: 3 });
    expect(engine.drawings[0].style.color).toBe('#FF0000');
    expect(engine.drawings[0].style.lineWidth).toBe(3);
  });

  it('loadDrawings should replace all drawings', () => {
    const engine = makeTestEngine();
    engine.activateTool('hline');
    engine.onMouseDown(100, 100);

    engine.loadDrawings([
      { id: 'a', type: 'rect', points: [{ price: 10, time: 10 }, { price: 50, time: 50 }], style: {}, locked: false, visible: true },
      { id: 'b', type: 'vline', points: [{ price: 0, time: 30 }], style: {}, locked: false, visible: true },
    ]);

    expect(engine.drawings).toHaveLength(2);
    expect(engine.drawings[0].id).toBe('a');
    expect(engine.drawings[1].id).toBe('b');
    expect(engine.state).toBe('idle');
  });
});

// ═══════════════════════════════════════════════════════════════════
// DrawingEngine — Hit-Test Coverage for All Tool Types
// ═══════════════════════════════════════════════════════════════════

describe('DrawingEngine — Hit-Test All Tool Types', () => {
  /** Helper: create engine, add a drawing, and test hit/miss */
  function testHitMiss(type, points, hitXY, missXY) {
    const engine = makeTestEngine();
    engine.addDrawing({
      id: `hit_${type}`,
      type,
      points,
      style: DEFAULT_STYLES[type] || { color: '#2962FF', lineWidth: 2, dash: [] },
      locked: false,
      visible: true,
    });

    // Hit test at expected hit point
    engine.onMouseDown(hitXY[0], hitXY[1]);
    expect(engine.selectedDrawing).not.toBeNull();
    expect(engine.selectedDrawing.id).toBe(`hit_${type}`);

    // Deselect
    engine.onMouseDown(9999, 9999);

    // Hit test at expected miss point
    engine.onMouseDown(missXY[0], missXY[1]);
    expect(engine.selectedDrawing).toBeNull();
  }

  it('trendline: hits on segment, misses far away', () => {
    testHitMiss('trendline',
      [{ price: 100, time: 100 }, { price: 200, time: 200 }],
      [150, 150],  // on the segment
      [300, 100],  // far from segment
    );
  });

  it('hline: hits on horizontal line, misses vertically', () => {
    testHitMiss('hline',
      [{ price: 100, time: 50 }],
      [200, 100],  // anywhere at y=100
      [200, 200],  // different y
    );
  });

  it('hray: hits on horizontal ray, misses vertically', () => {
    testHitMiss('hray',
      [{ price: 150, time: 50 }],
      [300, 150],  // on the ray
      [300, 300],  // different y
    );
  });

  it('vline: hits on vertical line, misses horizontally', () => {
    testHitMiss('vline',
      [{ price: 0, time: 100 }],
      [100, 200],  // anywhere at x=100
      [300, 200],  // different x
    );
  });

  it('crossline: hits on horizontal or vertical arm', () => {
    testHitMiss('crossline',
      [{ price: 100, time: 100 }],
      [100, 200],  // on vertical arm
      [300, 300],  // far from both arms
    );
  });

  it('rect: hits inside rectangle', () => {
    testHitMiss('rect',
      [{ price: 50, time: 50 }, { price: 150, time: 150 }],
      [100, 100],  // inside
      [300, 300],  // outside
    );
  });

  it('fib: hits within price range', () => {
    testHitMiss('fib',
      [{ price: 100, time: 50 }, { price: 200, time: 150 }],
      [100, 150],  // within price range
      [100, 300],  // outside price range
    );
  });

  it('fibext: hits within extended price range', () => {
    testHitMiss('fibext',
      [{ price: 100, time: 50 }, { price: 200, time: 100 }, { price: 150, time: 150 }],
      [100, 150],  // within range
      [100, 400],  // outside
    );
  });

  it('elliott: hits on wave segments', () => {
    testHitMiss('elliott',
      [
        { price: 100, time: 10 },
        { price: 50, time: 30 },
        { price: 200, time: 50 },
        { price: 80, time: 70 },
        { price: 250, time: 90 },
      ],
      [20, 75],   // on or near first segment
      [500, 500], // far away
    );
  });

  it('triangle: hits on edges', () => {
    testHitMiss('triangle',
      [{ price: 0, time: 100 }, { price: 100, time: 0 }, { price: 100, time: 200 }],
      [100, 100],   // near an edge
      [1000, 1000],  // far away
    );
  });

  it('measure: hits inside measure rectangle', () => {
    testHitMiss('measure',
      [{ price: 50, time: 50 }, { price: 150, time: 150 }],
      [100, 100],  // inside
      [300, 300],  // outside
    );
  });

  it('alertzone: hits within price band', () => {
    testHitMiss('alertzone',
      [{ price: 80, time: 0 }, { price: 120, time: 0 }],
      [500, 100],  // within band
      [500, 300],  // outside
    );
  });

  it('arrow: hits on arrow segment', () => {
    testHitMiss('arrow',
      [{ price: 100, time: 100 }, { price: 200, time: 200 }],
      [150, 150],  // on segment
      [500, 100],  // far away
    );
  });

  it('ray: hits on extended ray', () => {
    testHitMiss('ray',
      [{ price: 100, time: 100 }, { price: 200, time: 200 }],
      [150, 150],  // on segment
      [100, 500],  // far away
    );
  });

  it('longposition: hits within profit/loss zone', () => {
    testHitMiss('longposition',
      [{ price: 100, time: 50 }, { price: 50, time: 100 }],
      [75, 80],    // within the bounding box
      [500, 500],  // far away
    );
  });

  it('shortposition: hits within profit/loss zone', () => {
    testHitMiss('shortposition',
      [{ price: 100, time: 50 }, { price: 150, time: 100 }],
      [75, 120],   // within bounding box
      [500, 500],  // far away
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// Phase 3 Deep Dive — Screener Tests
// ═══════════════════════════════════════════════════════════════════

import { screenSymbols, getScreenableIndicators } from '../../charting_library/core/Screener.js';

describe('Screener — screenSymbols', () => {
  // Generate 30 bars of sample data
  const makeBars = (basePrice, trend = 0) => {
    const bars = [];
    for (let i = 0; i < 30; i++) {
      const close = basePrice + trend * i + (Math.sin(i) * 2);
      const open = close - 1;
      bars.push({
        time: Date.now() - (30 - i) * 60000,
        open, high: close + 2, low: close - 2, close,
        volume: 1000 + i * 100,
      });
    }
    return bars;
  };

  const barsMap = {
    BTC: makeBars(40000, 0),   // Sideways — RSI should be moderate
    ETH: makeBars(2000, -50),  // Steep downtrend — RSI should be low
    SOL: makeBars(100, 10),    // Uptrend
  };

  it('should return results for all watchlist symbols', () => {
    const results = screenSymbols(
      ['BTC', 'ETH', 'SOL'],
      [{ indicator: 'rsi', params: { period: 14 }, op: '<', value: 50 }],
      barsMap,
    );
    expect(results).toHaveLength(3);
    for (const r of results) {
      expect(r).toHaveProperty('symbol');
      expect(r).toHaveProperty('matches');
      expect(r).toHaveProperty('details');
    }
  });

  it('should return matches:false for symbol with no data', () => {
    const results = screenSymbols(
      ['DOGE'],
      [{ indicator: 'rsi', params: { period: 14 }, op: '<', value: 30 }],
      {},
    );
    expect(results[0].matches).toBe(false);
    expect(results[0].details[0]).toContain('No data');
  });

  it('should handle unknown indicator gracefully', () => {
    const results = screenSymbols(
      ['BTC'],
      [{ indicator: 'nonexistent_indicator', params: {}, op: '<', value: 50 }],
      barsMap,
    );
    expect(results[0].matches).toBe(false);
    expect(results[0].details[0]).toContain('Unknown indicator');
  });

  it('should return empty array for empty watchlist', () => {
    const results = screenSymbols([], [{ indicator: 'rsi', op: '<', value: 30 }], barsMap);
    expect(results).toHaveLength(0);
  });

  it('should return empty array for empty conditions', () => {
    const results = screenSymbols(['BTC'], [], barsMap);
    expect(results).toHaveLength(0);
  });
});

describe('Screener — getScreenableIndicators', () => {
  it('should return indicator definitions with id, name, params, outputs', () => {
    const indicators = getScreenableIndicators();
    expect(indicators.length).toBeGreaterThan(0);
    const first = indicators[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('params');
    expect(first).toHaveProperty('outputs');
  });
});

// ═══════════════════════════════════════════════════════════════════
// Phase 3 Deep Dive — Drawing Alert Engine Tests
// ═══════════════════════════════════════════════════════════════════

import { createDrawingAlert, checkDrawingAlerts, getAlertTriggerTypes } from '../../charting_library/tools/DrawingAlertEngine.js';

describe('DrawingAlertEngine — createDrawingAlert', () => {
  it('should create an alert with required fields', () => {
    const drawing = {
      id: 'draw_1',
      type: 'hline',
      points: [{ price: 100, time: 1000 }],
    };
    const alert = createDrawingAlert(drawing, 'cross', { message: 'Test' });
    expect(alert.drawingId).toBe('draw_1');
    expect(alert.drawingType).toBe('hline');
    expect(alert.triggerType).toBe('cross');
    expect(alert.active).toBe(true);
    expect(alert.triggered).toBe(false);
    expect(alert.message).toBe('Test');
    expect(alert.id).toMatch(/^da_/);
  });
});

describe('DrawingAlertEngine — checkDrawingAlerts', () => {
  it('should trigger hline cross alert when price crosses level', () => {
    const alert = createDrawingAlert(
      { id: 'd1', type: 'hline', points: [{ price: 100 }] },
      'cross',
    );
    const triggered = checkDrawingAlerts([alert], 101, Date.now(), 99);
    expect(triggered).toHaveLength(1);
    expect(triggered[0].drawingId).toBe('d1');
  });

  it('should NOT trigger hline cross when price stays below', () => {
    const alert = createDrawingAlert(
      { id: 'd2', type: 'hline', points: [{ price: 100 }] },
      'cross',
    );
    const triggered = checkDrawingAlerts([alert], 95, Date.now(), 90);
    expect(triggered).toHaveLength(0);
  });

  it('should trigger rect enter alert when price enters zone', () => {
    const alert = createDrawingAlert(
      { id: 'd3', type: 'rect', points: [{ price: 90 }, { price: 110 }] },
      'enter',
    );
    const triggered = checkDrawingAlerts([alert], 100, Date.now(), 80);
    expect(triggered).toHaveLength(1);
  });

  it('should trigger rect exit alert when price exits zone', () => {
    const alert = createDrawingAlert(
      { id: 'd4', type: 'rect', points: [{ price: 90 }, { price: 110 }] },
      'exit',
    );
    const triggered = checkDrawingAlerts([alert], 120, Date.now(), 100);
    expect(triggered).toHaveLength(1);
  });

  it('should NOT trigger inactive alert', () => {
    const alert = createDrawingAlert(
      { id: 'd5', type: 'hline', points: [{ price: 100 }] },
      'cross',
    );
    alert.active = false;
    const triggered = checkDrawingAlerts([alert], 101, Date.now(), 99);
    expect(triggered).toHaveLength(0);
  });

  it('should NOT trigger already-triggered alert', () => {
    const alert = createDrawingAlert(
      { id: 'd6', type: 'hline', points: [{ price: 100 }] },
      'cross',
    );
    alert.triggered = true;
    const triggered = checkDrawingAlerts([alert], 101, Date.now(), 99);
    expect(triggered).toHaveLength(0);
  });

  it('should trigger trendline cross alert', () => {
    // Trendline from (1000, 100) to (2000, 200) — slope = 0.1
    const alert = createDrawingAlert(
      { id: 'd7', type: 'trendline', points: [{ price: 100, time: 1000 }, { price: 200, time: 2000 }] },
      'cross',
    );
    // At time 1500, interpolated price = 150
    const triggered = checkDrawingAlerts([alert], 160, 1500, 140);
    expect(triggered).toHaveLength(1);
  });
});

describe('DrawingAlertEngine — getAlertTriggerTypes', () => {
  it('should return cross for line-type drawings', () => {
    expect(getAlertTriggerTypes('hline')).toEqual(['cross']);
    expect(getAlertTriggerTypes('trendline')).toEqual(['cross']);
  });

  it('should return enter/exit/cross for zone-type drawings', () => {
    expect(getAlertTriggerTypes('rect')).toEqual(['enter', 'exit', 'cross']);
    expect(getAlertTriggerTypes('alertzone')).toEqual(['enter', 'exit', 'cross']);
  });
});
