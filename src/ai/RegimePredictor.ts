// ═══════════════════════════════════════════════════════════════════
// charEdge — Regime Predictor (Sprint 88)
//
// LSTM-based market regime prediction. Classifies price sequences
// into states: trending-up, trending-down, ranging, volatile.
// Uses TF.js with pre-built weights or on-device fine-tuning.
//
// Usage:
//   import { regimePredictor } from './RegimePredictor';
//   const result = await regimePredictor.predict(bars);
// ═══════════════════════════════════════════════════════════════════

// ─── Types ───────────────────────────────────────────────────────

export interface RegimePrediction {
  regime: 'trending-up' | 'trending-down' | 'ranging' | 'volatile';
  confidence: number; // 0–100
  probabilities: {
    trendingUp: number;
    trendingDown: number;
    ranging: number;
    volatile: number;
  };
  lookback: number;
}

interface Bar {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ─── Constants ──────────────────────────────────────────────────

const LOOKBACK = 20;
const REGIMES = ['trending-up', 'trending-down', 'ranging', 'volatile'] as const;

// ─── Predictor ──────────────────────────────────────────────────

class RegimePredictor {
  private _model: unknown = null;
  private _tf: unknown = null;

  /**
   * Predict the current market regime from recent bars.
   */
  async predict(bars: Bar[]): Promise<RegimePrediction> {
    if (bars.length < LOOKBACK) {
      return this._heuristicPredict(bars);
    }

    // Try TF.js model first
    try {
      return await this._modelPredict(bars);
    } catch {
      // Fallback to heuristic
      return this._heuristicPredict(bars);
    }
  }

  /**
   * Heuristic-based regime detection (no model needed).
   */
  private _heuristicPredict(bars: Bar[]): RegimePrediction {
    const slice = bars.slice(-LOOKBACK);
    if (slice.length < 5) {
      return {
        regime: 'ranging',
        confidence: 0,
        probabilities: { trendingUp: 0.25, trendingDown: 0.25, ranging: 0.25, volatile: 0.25 },
        lookback: slice.length,
      };
    }

    const closes = slice.map((b) => b.close);
    const n = closes.length;

    // Trend: linear regression slope
    const slope = this._linRegSlope(closes);
    const avgPrice = closes.reduce((s, c) => s + c, 0) / n;
    const normalizedSlope = (slope / avgPrice) * 100; // percent per bar

    // Volatility: ATR-like measure
    const ranges = slice.map((b) => ((b.high - b.low) / ((b.high + b.low) / 2)) * 100);
    const avgRange = ranges.reduce((s, r) => s + r, 0) / ranges.length;

    // Classify
    const probs = { trendingUp: 0, trendingDown: 0, ranging: 0, volatile: 0 };

    if (avgRange > 3) {
      probs.volatile = 0.5;
      if (normalizedSlope > 0.3) {
        probs.trendingUp = 0.3;
        probs.trendingDown = 0.1;
        probs.ranging = 0.1;
      } else if (normalizedSlope < -0.3) {
        probs.trendingDown = 0.3;
        probs.trendingUp = 0.1;
        probs.ranging = 0.1;
      } else {
        probs.ranging = 0.2;
        probs.trendingUp = 0.15;
        probs.trendingDown = 0.15;
      }
    } else if (normalizedSlope > 0.2) {
      probs.trendingUp = 0.6;
      probs.trendingDown = 0.05;
      probs.ranging = 0.2;
      probs.volatile = 0.15;
    } else if (normalizedSlope < -0.2) {
      probs.trendingDown = 0.6;
      probs.trendingUp = 0.05;
      probs.ranging = 0.2;
      probs.volatile = 0.15;
    } else {
      probs.ranging = 0.55;
      probs.trendingUp = 0.15;
      probs.trendingDown = 0.15;
      probs.volatile = 0.15;
    }

    const entries = Object.entries(probs) as [string, number][];
    const topRegime = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
    const regimeMap: Record<string, (typeof REGIMES)[number]> = {
      trendingUp: 'trending-up',
      trendingDown: 'trending-down',
      ranging: 'ranging',
      volatile: 'volatile',
    };

    return {
      regime: regimeMap[topRegime[0]] || 'ranging',
      confidence: Math.round(topRegime[1] * 100),
      probabilities: probs,
      lookback: slice.length,
    };
  }

  /**
   * TF.js LSTM prediction (if model loaded).
   */
  private async _modelPredict(bars: Bar[]): Promise<RegimePrediction> {
    const tf = await this._loadTF();
    const model = await this._getModel(tf);
    if (!model) return this._heuristicPredict(bars);

    const sequence = this._prepareSequence(bars);
    const tensor = tf.tensor3d([sequence]); // [1, LOOKBACK, 5]

    const output = (model as { predict: (t: unknown) => { dataSync: () => Float32Array } }).predict(tensor);
    const probs = output.dataSync();
    tensor.dispose();

    const probObj = {
      trendingUp: probs[0] || 0.25,
      trendingDown: probs[1] || 0.25,
      ranging: probs[2] || 0.25,
      volatile: probs[3] || 0.25,
    };

    const maxIdx = probs.indexOf(Math.max(...probs));

    return {
      regime: REGIMES[maxIdx] || 'ranging',
      confidence: Math.round((probs[maxIdx] || 0) * 100),
      probabilities: probObj,
      lookback: LOOKBACK,
    };
  }

  // ─── Data Prep ───────────────────────────────────────────────

  private _prepareSequence(bars: Bar[]): number[][] {
    const slice = bars.slice(-LOOKBACK);
    const first = slice[0];
    const baseP = (first.open + first.close) / 2 || 1;
    const baseV = first.volume || 1;

    return slice.map((b) => [
      (b.open - baseP) / baseP,
      (b.high - baseP) / baseP,
      (b.low - baseP) / baseP,
      (b.close - baseP) / baseP,
      b.volume / baseV - 1,
    ]);
  }

  private _linRegSlope(values: number[]): number {
    const n = values.length;
    let sumX = 0,
      sumY = 0,
      sumXY = 0,
      sumX2 = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumX2 += i * i;
    }
    const denom = n * sumX2 - sumX * sumX;
    return denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
  }

  // ─── Model Loading ──────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TensorFlow.js module type is dynamic and untyped
  private async _loadTF(): Promise<any> {
    if (this._tf) return this._tf;
    this._tf = await import('@tensorflow/tfjs');
    return this._tf;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TensorFlow.js module type is dynamic and untyped
  private async _getModel(tf: any): Promise<unknown | null> {
    if (this._model) return this._model;
    try {
      this._model = await tf.loadLayersModel('indexeddb://charEdge-regime-lstm');
      return this._model;
    } catch {
      return null;
    }
  }
}

// ─── Singleton ──────────────────────────────────────────────────

export const regimePredictor = new RegimePredictor();
export default regimePredictor;
