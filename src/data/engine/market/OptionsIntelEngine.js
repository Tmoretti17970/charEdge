// ═══════════════════════════════════════════════════════════════════
// charEdge v14 — Options Intelligence Engine
//
// Computes derived options analytics from available data sources:
//   - Max Pain calculation (from options OI by strike)
//   - Gamma Exposure (GEX) estimation
//   - P/C ratio signal interpretation
//   - VIX regime classification
//
// This engine is source-agnostic — it accepts raw options data from
// any adapter (CBOE, Alpha Vantage, or future options feed).
//
// Usage:
//   import { optionsIntelEngine } from './OptionsIntelEngine.js';
//   const maxPain = optionsIntelEngine.computeMaxPain(chain);
//   const regime = optionsIntelEngine.classifyVIXRegime(vixValue);
// ═══════════════════════════════════════════════════════════════════

class _OptionsIntelEngine {
  constructor() {
    this._cache = new Map();
  }

  // ─── Max Pain ──────────────────────────────────────────────

  /**
   * Compute the Max Pain strike price.
   * Max Pain = strike price where total pain (value lost) for all option holders is maximized.
   * This is the price where market makers profit the most at expiration.
   *
   * @param {Array<{ strike, callOI, putOI }>} chain - Options chain with OI per strike
   * @returns {{ maxPainStrike, totalPainAtStrike, painByStrike }}
   */
  computeMaxPain(chain) {
    if (!chain?.length) return null;

    const strikes = chain.map(c => c.strike).sort((a, b) => a - b);
    let minPain = Infinity;
    let maxPainStrike = strikes[0];
    const painByStrike = [];

    for (const testStrike of strikes) {
      let totalPain = 0;

      for (const option of chain) {
        // Call pain: max(0, strike_price - test_price) * call_OI
        const callIntrinsic = Math.max(0, option.strike - testStrike);
        totalPain += callIntrinsic * (option.callOI || 0);

        // Put pain: max(0, test_price - strike_price) * put_OI
        const putIntrinsic = Math.max(0, testStrike - option.strike);
        totalPain += putIntrinsic * (option.putOI || 0);
      }

      painByStrike.push({ strike: testStrike, pain: totalPain });

      if (totalPain < minPain) {
        minPain = totalPain;
        maxPainStrike = testStrike;
      }
    }

    return {
      maxPainStrike,
      totalPainAtStrike: minPain,
      painByStrike,
    };
  }

  // ─── Gamma Exposure (GEX) ──────────────────────────────────

  /**
   * Estimate Gamma Exposure by strike.
   * GEX = Σ (gamma × OI × 100 × spot_price²) / 1e9
   *
   * Positive GEX → dealers are long gamma → price tends to pin.
   * Negative GEX → dealers are short gamma → price tends to move violently.
   *
   * @param {Array<{ strike, callGamma, putGamma, callOI, putOI }>} chain
   * @param {number} spotPrice - Current underlying price
   * @returns {{ netGEX, gexByStrike, flipPoint, regime }}
   */
  computeGEX(chain, spotPrice) {
    if (!chain?.length || !spotPrice) return null;

    const gexByStrike = [];
    let totalGEX = 0;
    let flipPoint = null;
    let lastSign = 0;

    const sorted = [...chain].sort((a, b) => a.strike - b.strike);

    for (const opt of sorted) {
      // Call GEX: positive (dealers delta-hedge by buying at lower, selling at higher)
      const callGEX = (opt.callGamma || 0) * (opt.callOI || 0) * 100 * spotPrice * spotPrice / 1e9;
      // Put GEX: negative (dealers delta-hedge in opposite direction)
      const putGEX = -(opt.putGamma || 0) * (opt.putOI || 0) * 100 * spotPrice * spotPrice / 1e9;
      const netStrikeGEX = callGEX + putGEX;

      totalGEX += netStrikeGEX;
      gexByStrike.push({ strike: opt.strike, callGEX, putGEX, net: netStrikeGEX });

      // Detect flip point (where GEX changes sign)
      const sign = netStrikeGEX > 0 ? 1 : netStrikeGEX < 0 ? -1 : 0;
      if (lastSign !== 0 && sign !== 0 && sign !== lastSign) {
        flipPoint = opt.strike;
      }
      if (sign !== 0) lastSign = sign;
    }

    return {
      netGEX: Math.round(totalGEX * 100) / 100,
      gexByStrike,
      flipPoint,
      regime: totalGEX > 0 ? 'positive' : totalGEX < 0 ? 'negative' : 'neutral',
    };
  }

  // ─── P/C Ratio Analysis ────────────────────────────────────

  /**
   * Interpret Put/Call ratio signal.
   * @param {number} pcRatio - Current P/C ratio
   * @param {Array<{ pcRatio }>} history - Recent P/C history
   * @returns {{ sentiment, signal, description, zscore }}
   */
  analyzePCRatio(pcRatio, history = []) {
    if (pcRatio == null) return null;

    // Calculate z-score relative to history
    let zscore = 0;
    if (history.length >= 5) {
      const values = history.map(h => h.pcRatio).filter(v => v != null);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const stddev = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length) || 1;
      zscore = (pcRatio - mean) / stddev;
    }

    let sentiment, signal, description;

    if (pcRatio > 1.2) {
      sentiment = 'extreme_fear';
      signal = 'contrarian_bullish';
      description = 'Extreme put buying — market is very fearful. Contrarian bullish signal.';
    } else if (pcRatio > 1.0) {
      sentiment = 'bearish';
      signal = 'bullish_lean';
      description = 'Elevated put activity — moderate fear. Often seen near bottoms.';
    } else if (pcRatio > 0.7) {
      sentiment = 'neutral';
      signal = 'neutral';
      description = 'Normal P/C ratio range — no strong directional signal.';
    } else if (pcRatio > 0.5) {
      sentiment = 'bullish';
      signal = 'bearish_lean';
      description = 'Heavy call buying — complacency. Watch for potential pullback.';
    } else {
      sentiment = 'extreme_greed';
      signal = 'contrarian_bearish';
      description = 'Extreme call buying — market is complacent. Contrarian bearish warning.';
    }

    return {
      sentiment,
      signal,
      description,
      zscore: Math.round(zscore * 100) / 100,
      pcRatio,
    };
  }

  // ─── VIX Regime ────────────────────────────────────────────

  /**
   * Classify VIX regime and term structure shape.
   * @param {number} vixValue - Current VIX
   * @param {Array<{ month, price }>} [termStructure] - VIX term structure
   * @returns {{ regime, level, termShape, description }}
   */
  classifyVIXRegime(vixValue, termStructure = []) {
    if (vixValue == null) return null;

    let regime, level, description;

    if (vixValue < 12) {
      regime = 'extreme_low';
      level = 'complacent';
      description = 'VIX extremely low — market is complacent. Calm before the storm?';
    } else if (vixValue < 16) {
      regime = 'low';
      level = 'calm';
      description = 'VIX in low range — stable market conditions. Good for selling premium.';
    } else if (vixValue < 20) {
      regime = 'normal';
      level = 'normal';
      description = 'VIX in normal range — typical market volatility.';
    } else if (vixValue < 30) {
      regime = 'elevated';
      level = 'fearful';
      description = 'VIX elevated — market is uncertain. Hedging activity increasing.';
    } else if (vixValue < 40) {
      regime = 'high';
      level = 'panic';
      description = 'VIX high — significant fear in the market. Potential capitulation.';
    } else {
      regime = 'extreme_high';
      level = 'crisis';
      description = 'VIX extreme — crisis-level fear. Historically marks major bottoms.';
    }

    // Determine term structure shape
    let termShape = 'unknown';
    if (termStructure.length >= 2) {
      const sorted = [...termStructure].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      const firstPrice = sorted[0]?.price;
      const lastPrice = sorted[sorted.length - 1]?.price;

      if (firstPrice && lastPrice) {
        if (lastPrice > firstPrice * 1.05) {
          termShape = 'contango';  // Normal — longer-term VIX higher
        } else if (firstPrice > lastPrice * 1.05) {
          termShape = 'backwardation';  // Inverted — near-term fear > long-term
        } else {
          termShape = 'flat';
        }
      }
    }

    return { regime, level, termShape, description, vix: vixValue };
  }

  /**
   * Clear internal caches.
   */
  clearCache() {
    this._cache.clear();
  }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const optionsIntelEngine = new _OptionsIntelEngine();
export default optionsIntelEngine;
