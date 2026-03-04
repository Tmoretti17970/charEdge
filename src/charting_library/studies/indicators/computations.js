// ═══════════════════════════════════════════════════════════════════
// charEdge — Indicator Computations — Barrel Re-export
//
// BACKWARD COMPATIBILITY: This file re-exports all indicators from
// their individual typed modules. Existing code that imports from
// this file will continue to work unchanged.
//
// New code should import directly from the sub-modules:
//   import { sma, ema } from './movingAverages.ts';
//   import { rsi } from './rsi.ts';
// ═══════════════════════════════════════════════════════════════════

// ─── Helpers ──────────────────────────────────────────────────
export { closes, highs, lows, volumes } from './helpers.ts';

// ─── Moving Averages ──────────────────────────────────────────
export { sma, ema, nextEma, wma, dema, tema, hma, vwma } from './movingAverages.ts';

// ─── Bollinger Bands ──────────────────────────────────────────
export { bollingerBands } from './bollingerBands.ts';

// ─── VWAP ─────────────────────────────────────────────────────
export { vwap, vwapBands, sessionVWAP } from './vwap.ts';

// ─── RSI ──────────────────────────────────────────────────────
export { rsi, volumeWeightedRSI } from './rsi.ts';

// ─── MACD ─────────────────────────────────────────────────────
export { macd } from './macd.ts';

// ─── Stochastic ───────────────────────────────────────────────
export { stochastic } from './stochastic.ts';

// ─── ATR ──────────────────────────────────────────────────────
export { trueRange, atr } from './atr.ts';

// ─── ADX ──────────────────────────────────────────────────────
export { adx } from './adx.ts';

// ─── Volume Indicators ───────────────────────────────────────
export { obv, mfi, cmf, adLine, calculateVRVP } from './volume.ts';

// ─── Ichimoku ─────────────────────────────────────────────────
export { ichimoku } from './ichimoku.ts';

// ─── Channels ─────────────────────────────────────────────────
export { donchianChannel, keltnerChannel, linearRegressionChannel } from './channels.ts';

// ─── Trend ────────────────────────────────────────────────────
export { supertrend, parabolicSAR, vortex } from './trend.ts';

// ─── Oscillators ──────────────────────────────────────────────
export {
  cci, williamsR, roc, aroon, ppo, dpo, trix, kst, coppock,
  momentum, tsi, chandeMomentumOscillator, awesomeOscillator,
  acceleratorOscillator, chaikinOscillator, massIndex,
} from './oscillators.ts';

// ─── Volatility & Sentiment ──────────────────────────────────
export {
  stdDev, historicalVolatility, squeezeMomentum,
  chaikinVolatility, ultimateOscillator, klinger, fearGreedIndex,
} from './volatility.ts';
