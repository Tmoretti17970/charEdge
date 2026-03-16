// @vitest-environment node
// ═══════════════════════════════════════════════════════════════════
// charEdge — PsychologyEngine v2 Tests
//
// Comprehensive tests for:
//   • FOMO detection (entries after price spikes)
//   • Tilt detection (rapid trades after losses)
//   • Averaging-down detection
//   • Overtrading detection
//   • Fatigue detection (late-night trading)
//   • Session energy curve generation
//   • Full behavioral analysis
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { psychologyEngine } from '../../charting_library/ai/PsychologyEngine.js';

// ─── Helpers ────────────────────────────────────────────────────

const NOW = Date.now();
const MIN = 60 * 1000;
const HOUR = 60 * MIN;

/** Create a trade object */
function makeTrade({
  entryTime = NOW,
  exitTime = NOW + 5 * MIN,
  entryPrice = 100,
  exitPrice = 101,
  pnl = 1,
  side = 'buy',
  size = 1,
  symbol = 'BTC',
} = {}) {
  return { entryTime, exitTime, entryPrice, exitPrice, pnl, side, size, symbol, pair: symbol };
}

/** Create a candle with a specific spike */
function makeCandle({ time = NOW, open = 100, close = 100, high, low, volume = 1000 } = {}) {
  return {
    time,
    open,
    close,
    high: high ?? Math.max(open, close) + 0.5,
    low: low ?? Math.min(open, close) - 0.5,
    volume,
  };
}

// ═══════════════════════════════════════════════════════════════════
// FOMO Detection
// ═══════════════════════════════════════════════════════════════════

describe('PsychologyEngine — FOMO Detection', () => {
  it('detects FOMO when entering after a large spike', () => {
    const spikeTime = NOW - 2 * MIN;
    const candles = [
      ...Array.from({ length: 10 }, (_, i) => makeCandle({ time: NOW - (15 - i) * MIN, open: 100, close: 100.2 })),
      // 3% spike candle
      makeCandle({ time: spikeTime, open: 100, close: 103.5, high: 104, low: 99.5 }),
    ];
    // Trade entered 1 min after the spike
    const trades = [makeTrade({ entryTime: spikeTime + 1 * MIN })];

    const alerts = psychologyEngine.detectFOMO(trades, candles);
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0].type).toBe('fomo');
    expect(alerts[0].title).toContain('FOMO');
  });

  it('does not flag normal entries without spikes', () => {
    const candles = Array.from({ length: 12 }, (_, i) =>
      makeCandle({ time: NOW - (15 - i) * MIN, open: 100, close: 100.1 }),
    );
    const trades = [makeTrade({ entryTime: NOW })];

    const alerts = psychologyEngine.detectFOMO(trades, candles);
    expect(alerts.length).toBe(0);
  });

  it('returns empty for no candles', () => {
    const trades = [makeTrade()];
    const alerts = psychologyEngine.detectFOMO(trades, []);
    expect(alerts.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Tilt Detection
// ═══════════════════════════════════════════════════════════════════

describe('PsychologyEngine — Tilt Detection', () => {
  it('detects tilt: rapid trades after consecutive losses', () => {
    const trades = [
      makeTrade({ entryTime: NOW - 12 * MIN, pnl: -50 }),
      makeTrade({ entryTime: NOW - 9 * MIN, pnl: -30 }),
      makeTrade({ entryTime: NOW - 6 * MIN, pnl: -20 }),
      makeTrade({ entryTime: NOW - 3 * MIN, pnl: -10 }),
    ];

    const alerts = psychologyEngine.detectTilt(trades);
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0].type).toBe('tilt');
  });

  it('flags high severity when size is increasing', () => {
    const trades = [
      makeTrade({ entryTime: NOW - 12 * MIN, pnl: -50, size: 1 }),
      makeTrade({ entryTime: NOW - 9 * MIN, pnl: -30, size: 1 }),
      makeTrade({ entryTime: NOW - 6 * MIN, pnl: -20, size: 1.5 }),
      makeTrade({ entryTime: NOW - 3 * MIN, pnl: -10, size: 2 }),
    ];

    const alerts = psychologyEngine.detectTilt(trades);
    const highSeverity = alerts.find((a) => a.severity === 'high');
    expect(highSeverity).toBeDefined();
  });

  it('does not flag tilt for spread-out trades', () => {
    const trades = [
      makeTrade({ entryTime: NOW - 60 * MIN, pnl: -50 }),
      makeTrade({ entryTime: NOW - 30 * MIN, pnl: -30 }),
      makeTrade({ entryTime: NOW, pnl: -10 }),
    ];

    const alerts = psychologyEngine.detectTilt(trades);
    expect(alerts.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Averaging-Down Detection
// ═══════════════════════════════════════════════════════════════════

describe('PsychologyEngine — Averaging Down', () => {
  it('detects adding to a losing long position', () => {
    const trades = [
      makeTrade({ entryTime: NOW - 30 * MIN, entryPrice: 100, side: 'buy', symbol: 'ETH' }),
      makeTrade({ entryTime: NOW - 10 * MIN, entryPrice: 95, side: 'buy', symbol: 'ETH' }), // 5% below avg
    ];

    const alerts = psychologyEngine.detectAveragingDown(trades);
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0].type).toBe('averaging_down');
  });

  it('does not flag different symbols', () => {
    const trades = [
      makeTrade({ entryTime: NOW - 30 * MIN, entryPrice: 100, side: 'buy', symbol: 'BTC' }),
      makeTrade({ entryTime: NOW - 10 * MIN, entryPrice: 95, side: 'buy', symbol: 'ETH' }),
    ];

    const alerts = psychologyEngine.detectAveragingDown(trades);
    expect(alerts.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Overtrading Detection
// ═══════════════════════════════════════════════════════════════════

describe('PsychologyEngine — Overtrading', () => {
  it('detects 8+ trades within 1 hour', () => {
    const trades = Array.from({ length: 10 }, (_, i) => makeTrade({ entryTime: NOW - (50 - i * 5) * MIN }));

    const alerts = psychologyEngine.detectOvertrading(trades);
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0].type).toBe('overtrading');
  });

  it('does not flag normal trading pace', () => {
    const trades = Array.from({ length: 4 }, (_, i) => makeTrade({ entryTime: NOW - i * 30 * MIN }));

    const alerts = psychologyEngine.detectOvertrading(trades);
    expect(alerts.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Fatigue Detection
// ═══════════════════════════════════════════════════════════════════

describe('PsychologyEngine — Fatigue', () => {
  it('detects late-night trading (10PM-4AM)', () => {
    // Create trades at 11PM
    const elevenPM = new Date();
    elevenPM.setHours(23, 0, 0, 0);
    const trades = Array.from({ length: 4 }, (_, i) => makeTrade({ entryTime: elevenPM.getTime() + i * 15 * MIN }));

    const alerts = psychologyEngine.detectFatigue(trades);
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0].type).toBe('fatigue');
    expect(alerts[0].icon).toBe('😴');
  });

  it('does not flag daytime trading', () => {
    const noon = new Date();
    noon.setHours(12, 0, 0, 0);
    const trades = Array.from({ length: 5 }, (_, i) => makeTrade({ entryTime: noon.getTime() + i * 15 * MIN }));

    const alerts = psychologyEngine.detectFatigue(trades);
    expect(alerts.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Session Energy Curve
// ═══════════════════════════════════════════════════════════════════

describe('PsychologyEngine — Session Curve', () => {
  it('returns 24-hour curve', () => {
    const trades = [
      makeTrade({ entryTime: new Date().setHours(9, 0), pnl: 50 }),
      makeTrade({ entryTime: new Date().setHours(10, 0), pnl: 30 }),
      makeTrade({ entryTime: new Date().setHours(14, 0), pnl: -20 }),
    ];

    const curve = psychologyEngine.buildSessionCurve(trades);
    expect(curve).toHaveLength(24);
    curve.forEach((point) => {
      expect(point).toHaveProperty('hour');
      expect(point).toHaveProperty('quality');
      expect(point).toHaveProperty('count');
      expect(point.hour).toBeGreaterThanOrEqual(0);
      expect(point.hour).toBeLessThanOrEqual(23);
    });
  });

  it('calculates quality based on win rate', () => {
    const nineAM = new Date();
    nineAM.setHours(9, 0, 0, 0);
    const trades = [
      makeTrade({ entryTime: nineAM.getTime(), pnl: 100 }),
      makeTrade({ entryTime: nineAM.getTime() + 5 * MIN, pnl: 50 }),
      makeTrade({ entryTime: nineAM.getTime() + 10 * MIN, pnl: 30 }),
    ];

    const curve = psychologyEngine.buildSessionCurve(trades);
    const ninePoint = curve.find((p) => p.hour === 9);
    expect(ninePoint.count).toBe(3);
    expect(ninePoint.quality).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Full Behavioral Analysis
// ═══════════════════════════════════════════════════════════════════

describe('PsychologyEngine — Full Analysis', () => {
  it('returns complete analysis structure', () => {
    const trades = [
      makeTrade({ entryTime: NOW - 30 * MIN, pnl: 50 }),
      makeTrade({ entryTime: NOW - 15 * MIN, pnl: -20 }),
    ];

    const result = psychologyEngine.analyze(trades);
    expect(result).toHaveProperty('alerts');
    expect(result).toHaveProperty('sessionCurve');
    expect(result).toHaveProperty('riskLevel');
    expect(result).toHaveProperty('summary');
    expect(Array.isArray(result.alerts)).toBe(true);
    expect(Array.isArray(result.sessionCurve)).toBe(true);
    expect(typeof result.summary).toBe('string');
  });

  it('returns clean session for no trades', () => {
    const result = psychologyEngine.analyze([]);
    expect(result.alerts).toHaveLength(0);
    expect(result.riskLevel).toBe('low');
    expect(result.summary).toContain('No trades');
  });

  it('escalates risk level with multiple alerts', () => {
    // Create conditions that trigger multiple high-severity alerts
    const trades = [
      makeTrade({ entryTime: NOW - 12 * MIN, pnl: -100, size: 1 }),
      makeTrade({ entryTime: NOW - 9 * MIN, pnl: -80, size: 1.5 }),
      makeTrade({ entryTime: NOW - 6 * MIN, pnl: -60, size: 2 }),
      makeTrade({ entryTime: NOW - 3 * MIN, pnl: -40, size: 3 }),
    ];

    const result = psychologyEngine.analyze(trades);
    expect(['mid', 'high']).toContain(result.riskLevel);
  });

  it('sorts alerts by severity (high first)', () => {
    const elevenPM = new Date();
    elevenPM.setHours(23, 0, 0, 0);
    const trades = [
      makeTrade({ entryTime: elevenPM.getTime() - 12 * MIN, pnl: -100, size: 1 }),
      makeTrade({ entryTime: elevenPM.getTime() - 9 * MIN, pnl: -80, size: 1.5 }),
      makeTrade({ entryTime: elevenPM.getTime() - 6 * MIN, pnl: -60, size: 2 }),
      makeTrade({ entryTime: elevenPM.getTime(), pnl: -40, size: 3 }),
      makeTrade({ entryTime: elevenPM.getTime() + 5 * MIN, pnl: -20 }),
      makeTrade({ entryTime: elevenPM.getTime() + 10 * MIN, pnl: -10 }),
    ];

    const result = psychologyEngine.analyze(trades);
    if (result.alerts.length >= 2) {
      const severityOrder = { high: 0, mid: 1, low: 2 };
      for (let i = 1; i < result.alerts.length; i++) {
        expect(severityOrder[result.alerts[i].severity]).toBeGreaterThanOrEqual(
          severityOrder[result.alerts[i - 1].severity],
        );
      }
    }
  });
});
