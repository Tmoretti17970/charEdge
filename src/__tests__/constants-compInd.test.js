// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — Constants & compInd Tests
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import {
  C,
  F,
  M,
  TFS,
  CRYPTO_IDS,
  isCrypto,
  IND_CAT,
  ICATS,
  CHART_TYPES,
  EMOJIS,
  DEFAULT_SETTINGS,
  OV_COLORS,
} from '../constants.js';
import { compInd } from '../charting_library/studies/compInd.js';

// ═══ Constants ══════════════════════════════════════════════════
describe('Constants', () => {
  it('C has required color keys', () => {
    const required = ['bg', 'bg2', 'sf', 'bd', 't1', 't2', 't3', 'b', 'g', 'r', 'y', 'bullish', 'bearish'];
    required.forEach((k) => {
      expect(typeof C[k]).toBe('string');
      expect(C[k].startsWith('#')).toBe(true);
    });
  });

  it('F and M are font strings', () => {
    expect(F).toContain('Inter');
    expect(M).toContain('Mono');
  });

  it('TFS has 8 timeframes with required fields', () => {
    expect(TFS.length).toBe(8);
    TFS.forEach((tf) => {
      expect(tf).toHaveProperty('id');
      expect(tf).toHaveProperty('label');
      expect(tf).toHaveProperty('cgDays');
      expect(tf).toHaveProperty('yhInt');
      expect(tf).toHaveProperty('fb');
      expect(typeof tf.fb).toBe('number');
    });
  });

  it('CRYPTO_IDS maps common tickers', () => {
    expect(CRYPTO_IDS.BTC).toBe('bitcoin');
    expect(CRYPTO_IDS.ETH).toBe('ethereum');
    expect(CRYPTO_IDS.SOL).toBe('solana');
  });

  it('isCrypto identifies crypto symbols', () => {
    expect(isCrypto('BTC')).toBe(true);
    expect(isCrypto('btc')).toBe(true);
    expect(isCrypto('AAPL')).toBe(false);
    expect(isCrypto('')).toBe(false);
    expect(isCrypto(null)).toBe(false);
  });

  it('IND_CAT has 22 indicators', () => {
    expect(IND_CAT.length).toBe(22);
    const ids = IND_CAT.map((i) => i.id);
    expect(ids).toContain('sma');
    expect(ids).toContain('rsi');
    expect(ids).toContain('macd');
    expect(ids).toContain('atr');
    // H2.4 additions
    expect(ids).toContain('obv');
    expect(ids).toContain('ichimoku');
    expect(ids).toContain('keltner');
    expect(ids).toContain('donchian');
  });

  it('IND_CAT entries have required fields', () => {
    IND_CAT.forEach((ind) => {
      expect(ind).toHaveProperty('id');
      expect(ind).toHaveProperty('name');
      expect(ind).toHaveProperty('cat');
      expect(ind).toHaveProperty('pane');
      expect(Array.isArray(ind.params)).toBe(true);
    });
  });

  it('ICATS has filter categories', () => {
    expect(ICATS.length).toBe(5);
    expect(ICATS[0].id).toBe('all');
    expect(ICATS.map(c => c.id)).toContain('volume');
  });

  it('CHART_TYPES has 10 types', () => {
    expect(CHART_TYPES.length).toBe(10);
    const ids = CHART_TYPES.map((ct) => ct.id);
    expect(ids).toContain('candles');
    expect(ids).toContain('line');
    expect(ids).toContain('ohlc');
  });

  it('EMOJIS has entries with e and l', () => {
    expect(EMOJIS.length).toBeGreaterThan(0);
    EMOJIS.forEach((em) => {
      expect(typeof em.e).toBe('string');
      expect(typeof em.l).toBe('string');
    });
  });

  it('DEFAULT_SETTINGS has required keys', () => {
    expect(DEFAULT_SETTINGS).toHaveProperty('dailyLossLimit');
    expect(DEFAULT_SETTINGS).toHaveProperty('defaultSymbol');
    expect(DEFAULT_SETTINGS).toHaveProperty('defaultTf');
    expect(DEFAULT_SETTINGS.dailyLossLimit).toBe(0);
  });

  it('OV_COLORS has at least 6 colors', () => {
    expect(OV_COLORS.length).toBeGreaterThanOrEqual(6);
    OV_COLORS.forEach((c) => expect(typeof c).toBe('string'));
  });
});

// ═══ compInd ════════════════════════════════════════════════════
const mkBars = (n = 30) =>
  Array.from({ length: n }, (_, i) => ({
    time: `2025-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`,
    open: 100 + Math.sin(i * 0.3) * 10,
    high: 100 + Math.sin(i * 0.3) * 10 + 5,
    low: 100 + Math.sin(i * 0.3) * 10 - 5,
    close: 100 + Math.cos(i * 0.3) * 10,
    volume: 1000 + i * 100,
  }));

describe('compInd', () => {
  const bars = mkBars(50);

  it('computes SMA', () => {
    const r = compInd('sma', bars, { period: 10 });
    expect(Array.isArray(r)).toBe(true);
    expect(r.length).toBe(bars.length);
    expect(isNaN(r[0])).toBe(true); // Not enough data yet
    expect(isNaN(r[9])).toBe(false); // Has enough data
  });

  it('computes EMA', () => {
    const r = compInd('ema', bars, { period: 10 });
    expect(Array.isArray(r)).toBe(true);
    expect(r.length).toBe(bars.length);
  });

  it('computes WMA', () => {
    const r = compInd('wma', bars, { period: 10 });
    expect(Array.isArray(r)).toBe(true);
    expect(r.length).toBe(bars.length);
  });

  it('computes Bollinger Bands', () => {
    const r = compInd('bollinger', bars, { period: 20, stdDev: 2 });
    // bollingerBands returns { middle: number[], upper: number[], lower: number[] }
    expect(r).toHaveProperty('middle');
    expect(r).toHaveProperty('upper');
    expect(r).toHaveProperty('lower');
    expect(r.middle.length).toBe(bars.length);
    // Find a valid (non-NaN) index
    const idx = r.middle.findIndex((v) => !isNaN(v));
    if (idx >= 0) {
      expect(r.upper[idx]).toBeGreaterThanOrEqual(r.middle[idx]);
      expect(r.lower[idx]).toBeLessThanOrEqual(r.middle[idx]);
    }
  });

  it('computes VWAP', () => {
    const r = compInd('vwap', bars, {});
    expect(Array.isArray(r)).toBe(true);
    expect(r.length).toBe(bars.length);
  });

  it('computes RSI', () => {
    const r = compInd('rsi', bars, { period: 14 });
    expect(Array.isArray(r)).toBe(true);
    expect(r.length).toBe(bars.length);
    const vals = r.filter((v) => !isNaN(v));
    vals.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    });
  });

  it('computes MACD', () => {
    const r = compInd('macd', bars, { fast: 12, slow: 26, signal: 9 });
    // macd returns { macd: number[], signal: number[], histogram: number[] }
    expect(r).toHaveProperty('macd');
    expect(r).toHaveProperty('signal');
    expect(r).toHaveProperty('histogram');
    expect(r.macd.length).toBe(bars.length);
    expect(r.signal.length).toBe(bars.length);
    expect(r.histogram.length).toBe(bars.length);
  });

  it('computes Stochastic', () => {
    const r = compInd('stochastic', bars, { kPeriod: 14, dPeriod: 3 });
    // stochastic returns { k: number[], d: number[] }
    expect(r).toHaveProperty('k');
    expect(r).toHaveProperty('d');
    expect(r.k.length).toBe(bars.length);
    expect(r.d.length).toBe(bars.length);
  });

  it('computes ATR', () => {
    const r = compInd('atr', bars, { period: 14 });
    expect(Array.isArray(r)).toBe(true);
    expect(r.length).toBe(bars.length);
    const vals = r.filter((v) => !isNaN(v));
    vals.forEach((v) => expect(v).toBeGreaterThanOrEqual(0));
  });

  it('unknown type returns NaN array', () => {
    const r = compInd('unknown_indicator', bars, {});
    expect(Array.isArray(r)).toBe(true);
    expect(r.every((v) => isNaN(v))).toBe(true);
  });

  it('uses default params when none provided', () => {
    const r = compInd('sma', bars);
    expect(Array.isArray(r)).toBe(true);
    expect(r.length).toBe(bars.length);
    expect(isNaN(r[18])).toBe(true); // period=20, not enough data
    expect(isNaN(r[19])).toBe(false); // has 20 values
  });
});

