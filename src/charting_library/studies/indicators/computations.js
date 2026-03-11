// ═══════════════════════════════════════════════════════════════════
// charEdge — Indicator Computations — Barrel Re-export
//
// BACKWARD COMPATIBILITY: This file re-exports all indicators from
// their individual typed modules. Existing code that imports from
// this file will continue to work unchanged.
//
// New code should import directly from the sub-modules:
//   import { sma, ema } from './movingAverages';
//   import { rsi } from './rsi';
// ═══════════════════════════════════════════════════════════════════

// ─── Helpers ──────────────────────────────────────────────────
export { closes, highs, lows, volumes } from './helpers';

// ─── Moving Averages ──────────────────────────────────────────
export { sma, ema, nextEma, wma, dema, tema, hma, vwma } from './movingAverages';

// ─── Bollinger Bands ──────────────────────────────────────────
export { bollingerBands } from './bollingerBands';

// ─── VWAP ─────────────────────────────────────────────────────
export { vwap, vwapBands, sessionVWAP } from './vwap';

// ─── RSI ──────────────────────────────────────────────────────
export { rsi, volumeWeightedRSI } from './rsi';

// ─── MACD ─────────────────────────────────────────────────────
export { macd } from './macd';

// ─── Stochastic ───────────────────────────────────────────────
export { stochastic } from './stochastic';

// ─── ATR ──────────────────────────────────────────────────────
export { trueRange, atr } from './atr';

// ─── ADX ──────────────────────────────────────────────────────
export { adx } from './adx';

// ─── Volume Indicators ───────────────────────────────────────
export { obv, mfi, cmf, adLine, calculateVRVP } from './volume';

// ─── Ichimoku ─────────────────────────────────────────────────
export { ichimoku } from './ichimoku';

// ─── Channels ─────────────────────────────────────────────────
export { donchianChannel, keltnerChannel, linearRegressionChannel } from './channels';

// ─── Trend ────────────────────────────────────────────────────
export { supertrend, parabolicSAR, vortex } from './trend';

// ─── Oscillators ──────────────────────────────────────────────
export {
  cci, williamsR, roc, aroon, ppo, dpo, trix, kst, coppock,
  momentum, tsi, chandeMomentumOscillator, awesomeOscillator,
  acceleratorOscillator, chaikinOscillator, massIndex,
} from './oscillators';

// ─── Volatility & Sentiment ──────────────────────────────────
export {
  stdDev, historicalVolatility, squeezeMomentum,
  chaikinVolatility, ultimateOscillator, klinger, fearGreedIndex,
} from './volatility';

// ─── Sprint 1: Quick-Win Indicators ─────────────────────────
export { stochRsi } from './stochRsi';
export { pivotPoints } from './pivotPoints';
export { elderRay } from './elderRay';
export { adxr } from './adxr';

// ─── Phase 2: Adaptive Indicators ───────────────────────────
export { kama, vidya, frama } from './adaptiveMAs';
export { adaptiveRsi } from './adaptiveOscillators';

// ─── Phase 2: Divergence Foundation ─────────────────────────
export { zigzag } from './zigzag';
export { detectDivergences } from './DivergenceEngine';

// ─── Phase 2: Advanced Modules ──────────────────────────────
export { dynamicATR } from './dynamicATR';
export { regimeSwitcher } from './regimeSwitcher';
export { sigmaBands } from './sigmaBands';
export { rvolFilter } from './rvolFilter';

// ─── Phase 3: Signal Modules ────────────────────────────────
export { detectSignalMarks } from './signalMarks';
export { renderSignalHeatmap } from './SignalHeatmapRenderer';
export { confluenceFilter } from './confluenceFilter';
export { detectWickRejections } from './wickRejection';
export { applySignalDecay } from './signalDecay';
export { detectFVGs } from './fvgDetector';
export { filterFailures } from './failureHedge';

// ─── Phase 4: Tier 2 + MTF ─────────────────────────────────
export { mcginleyDynamic, connorsRsi, schaffTrendCycle, ehlersFisher, rvi } from './tier2Indicators';
export { stepInterpolate, renderStepLine } from './stepInterpolation';
export { getCachedAggregation, clearMtfCache } from './mtfCache';

// ─── Phase 5: Architecture + New Indicators ────────────────
export { heikinAshi } from './heikinAshi';
export { marketProfile } from './marketProfile';
export { mama } from './mama';

// ─── Phase 6: Exotic Indicators ────────────────────────────
export { hurstExponent } from './hurstExponent';
export { renkoBrickCount } from './renkoBrickCount';
