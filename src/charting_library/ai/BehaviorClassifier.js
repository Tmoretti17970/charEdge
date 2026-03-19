// ═══════════════════════════════════════════════════════════════════
// charEdge — Behavior Classifier (Sprint 44)
//
// ML-powered session behavior classification:
//   Tilt | Revenge | FOMO | Fatigue | Normal
//
// Uses ONNX model when available, falls back to PsychologyEngine
// heuristics. Input: 12-dimensional session metrics vector.
//
// Usage:
//   import { behaviorClassifier } from './BehaviorClassifier.js';
//   const result = await behaviorClassifier.classify(trades, candles);
//   // { label, confidence, probabilities, source, alert }
// ═══════════════════════════════════════════════════════════════════

import { getONNXService } from '../../api/services/onnx.js';
import { psychologyEngine } from './PsychologyEngine.js';

// ─── Constants ──────────────────────────────────────────────────

const MODEL_ID = 'behavior-classifier';
const MANIFEST_URL = '/models/manifest.json';
const MODEL_BASE_URL = '/models/';
const CACHE_TTL_MS = 60_000; // 1 minute (session state changes slowly)

export const BEHAVIOR_LABELS = ['Tilt', 'Revenge', 'FOMO', 'Fatigue', 'Normal'];

export const BEHAVIOR_CONFIG = {
  Tilt: {
    icon: '🔴', severity: 'high',
    title: 'Tilt Detected',
    message: 'Rapid trades after losses with increasing size — step away and reset.',
  },
  Revenge: {
    icon: '⚡', severity: 'high',
    title: 'Revenge Trading',
    message: 'Pattern suggests chasing back losses — scale down or pause.',
  },
  FOMO: {
    icon: '🏃', severity: 'mid',
    title: 'FOMO Behavior',
    message: 'Entries after large moves suggest fear of missing out — wait for pullbacks.',
  },
  Fatigue: {
    icon: '😴', severity: 'mid',
    title: 'Fatigue Warning',
    message: 'Late-session trading with declining accuracy — decision quality drops.',
  },
  Normal: {
    icon: '✅', severity: 'low',
    title: 'Clean Session',
    message: 'No behavioral issues detected — trading with discipline.',
  },
};

// Feature extraction constants
const FEATURE_COUNT = 12;

// ─── Behavior Classifier ────────────────────────────────────────

class _BehaviorClassifier {
  constructor() {
    /** @type {Object|null} */
    this._manifest = null;
    /** @type {{ result: any, timestamp: number }|null} */
    this._cached = null;
    /** @type {boolean|null} */
    this._mlAvailable = null;
  }

  // ─── Public API ─────────────────────────────────────────────

  /**
   * Classify current session behavior.
   *
   * @param {Array} trades - Recent session trades ({ entryTime, exitTime, pnl, size, side, ... })
   * @param {Array} [candles] - Optional candle data for FOMO spike detection
   * @returns {Promise<{ label: string, confidence: number, probabilities: number[], source: string, alert: Object|null }>}
   */
  async classify(trades, candles = []) {
    if (!trades || trades.length < 2) {
      return this._makeResult('Normal', 1.0, new Array(5).fill(0.2), 'insufficient-data');
    }

    // Check cache
    if (this._cached && Date.now() - this._cached.timestamp < CACHE_TTL_MS) {
      return this._cached.result;
    }

    // Extract session metrics
    const features = this.extractSessionFeatures(trades, candles);

    // Try ML first
    const mlResult = await this._runML(features);
    if (mlResult) {
      this._cached = { result: mlResult, timestamp: Date.now() };
      return mlResult;
    }

    // Fallback: use PsychologyEngine heuristics
    const heuristicResult = this._runHeuristic(trades, candles);
    this._cached = { result: heuristicResult, timestamp: Date.now() };
    return heuristicResult;
  }

  /**
   * Extract 12-dimensional session metrics vector from trades.
   * @param {Array} trades
   * @param {Array} candles
   * @returns {Float32Array}
   */
  extractSessionFeatures(trades, candles = []) {
    const vec = new Float32Array(FEATURE_COUNT);
    const n = trades.length;
    if (n === 0) return vec;

    const sorted = [...trades].sort(
      (a, b) => (a.entryTime || a.time || 0) - (b.entryTime || b.time || 0)
    );

    // 1. Trade frequency (trades per hour)
    const sessionDuration = this._sessionDurationHours(sorted);
    vec[0] = sessionDuration > 0 ? Math.min(n / sessionDuration, 20) / 20 : 0;

    // 2. Loss streak (consecutive recent losses)
    vec[1] = Math.min(this._currentLossStreak(sorted), 10) / 10;

    // 3. Win rate (session)
    const wins = sorted.filter(t => (t.pnl || 0) > 0).length;
    vec[2] = n > 0 ? wins / n : 0.5;

    // 4. Average time between trades (normalized)
    vec[3] = this._avgTimeBetweenTrades(sorted);

    // 5. Size escalation (last trade size / avg size)
    vec[4] = this._sizeEscalation(sorted);

    // 6. P&L trajectory (slope of cumulative P&L)
    vec[5] = this._pnlSlope(sorted);

    // 7. Recent loss ratio (last 5 trades)
    const recent5 = sorted.slice(-5);
    const recentLosses = recent5.filter(t => (t.pnl || 0) < 0).length;
    vec[6] = recent5.length > 0 ? recentLosses / recent5.length : 0;

    // 8. Time of day (normalized: 0 = 6am, 1 = midnight)
    const lastTime = sorted[sorted.length - 1].entryTime || sorted[sorted.length - 1].time || Date.now();
    const hour = new Date(lastTime).getHours();
    vec[7] = Math.max(0, (hour - 6) / 18); // 6am=0, midnight=1

    // 9. FOMO proximity (entered after price spike?)
    vec[8] = this._fomoProximity(sorted, candles);

    // 10. Reversal count (trades reversed within 5 min)
    vec[9] = Math.min(this._reversalCount(sorted), 5) / 5;

    // 11. Session P&L drawdown (max drawdown as % of peak)
    vec[10] = this._sessionDrawdown(sorted);

    // 12. Emotional escalation (increasing trade sizes after losses)
    vec[11] = this._emotionalEscalation(sorted);

    return vec;
  }

  /**
   * Invalidate cached result (e.g., after a new trade).
   */
  clearCache() {
    this._cached = null;
  }

  // ─── ML Inference ─────────────────────────────────────────────

  /** @private */
  async _runML(features) {
    try {
      if (this._mlAvailable === false) return null;

      const onnx = getONNXService();
      await onnx._ensureRuntime();

      // Load manifest if needed
      if (!this._manifest) {
        const resp = await fetch(MANIFEST_URL);
        this._manifest = await resp.json();
      }

      const modelInfo = this._manifest?.models?.[MODEL_ID];
      if (!modelInfo) {
        this._mlAvailable = false;
        return null;
      }

      // Load model if needed
      if (!onnx.loadedModels.includes(MODEL_ID)) {
        await onnx.loadModel(MODEL_ID, MODEL_BASE_URL + modelInfo.file);
      }

      // Run inference
      const tensor = await onnx.createTensor(features, [1, FEATURE_COUNT]);
      const inputName = modelInfo._inputName || 'input';
      const results = await onnx.run(MODEL_ID, { [inputName]: tensor });
      const outputKey = Object.keys(results)[0];
      const probs = Array.from(results[outputKey].data);

      // Softmax to ensure proper probabilities
      const maxVal = Math.max(...probs);
      const exps = probs.map(p => Math.exp(p - maxVal));
      const sumExps = exps.reduce((s, e) => s + e, 0);
      const softmaxProbs = exps.map(e => e / sumExps);

      const maxIdx = softmaxProbs.indexOf(Math.max(...softmaxProbs));
      const label = BEHAVIOR_LABELS[maxIdx];

      this._mlAvailable = true;
      return this._makeResult(label, softmaxProbs[maxIdx], softmaxProbs, 'ml');
    } catch {
      this._mlAvailable = false;
      return null;
    }
  }

  // ─── Heuristic Fallback ───────────────────────────────────────

  /** @private */
  _runHeuristic(trades, candles) {
    const analysis = psychologyEngine.analyze(trades, candles);
    const alerts = analysis.alerts;

    if (alerts.length === 0) {
      return this._makeResult('Normal', 0.9, [0.02, 0.02, 0.02, 0.04, 0.9], 'heuristic');
    }

    // Map PsychologyEngine alert types to our labels
    const typeMap = {
      tilt: 'Tilt',
      fomo: 'FOMO',
      overtrading: 'Tilt',      // Overtrading is a tilt symptom
      averaging_down: 'Revenge', // Averaging down = revenge behavior
      fatigue: 'Fatigue',
    };

    // Count severity-weighted alerts per type
    const scores = { Tilt: 0, Revenge: 0, FOMO: 0, Fatigue: 0, Normal: 0 };
    const severityWeight = { high: 3, mid: 2, low: 1 };

    for (const alert of alerts) {
      const mapped = typeMap[alert.type] || 'Tilt';
      scores[mapped] += severityWeight[alert.severity] || 1;
    }

    // Normalize to probabilities
    const total = Object.values(scores).reduce((s, v) => s + v, 0) || 1;
    const probs = BEHAVIOR_LABELS.map(l => scores[l] / total);

    // If no clear signal, boost Normal
    if (Math.max(...probs) < 0.3) {
      probs[4] = 0.5; // Normal
      const otherTotal = probs.slice(0, 4).reduce((s, v) => s + v, 0) || 1;
      for (let i = 0; i < 4; i++) probs[i] = (probs[i] / otherTotal) * 0.5;
    }

    const maxIdx = probs.indexOf(Math.max(...probs));
    return this._makeResult(BEHAVIOR_LABELS[maxIdx], probs[maxIdx], probs, 'heuristic');
  }

  // ─── Result Builder ───────────────────────────────────────────

  /** @private */
  _makeResult(label, confidence, probabilities, source) {
    const config = BEHAVIOR_CONFIG[label] || BEHAVIOR_CONFIG.Normal;
    const alert = label !== 'Normal' ? {
      type: label.toLowerCase(),
      severity: config.severity,
      icon: config.icon,
      title: config.title,
      message: `${config.message} (${Math.round(confidence * 100)}% confidence, ${source})`,
      timestamp: Date.now(),
    } : null;

    return { label, confidence, probabilities, source, alert };
  }

  // ─── Session Feature Helpers ──────────────────────────────────

  /** @private */
  _sessionDurationHours(sorted) {
    if (sorted.length < 2) return 0;
    const first = sorted[0].entryTime || sorted[0].time || 0;
    const last = sorted[sorted.length - 1].entryTime || sorted[sorted.length - 1].time || 0;
    return Math.max(0, (last - first) / (1000 * 60 * 60));
  }

  /** @private */
  _currentLossStreak(sorted) {
    let streak = 0;
    for (let i = sorted.length - 1; i >= 0; i--) {
      if ((sorted[i].pnl || 0) < 0) streak++;
      else break;
    }
    return streak;
  }

  /** @private */
  _avgTimeBetweenTrades(sorted) {
    if (sorted.length < 2) return 0.5;
    let totalGap = 0;
    let gaps = 0;
    for (let i = 1; i < sorted.length; i++) {
      const t1 = sorted[i - 1].exitTime || sorted[i - 1].entryTime || sorted[i - 1].time || 0;
      const t2 = sorted[i].entryTime || sorted[i].time || 0;
      if (t2 > t1) { totalGap += t2 - t1; gaps++; }
    }
    if (gaps === 0) return 0.5;
    const avgGapMinutes = totalGap / gaps / 60000;
    // Normalize: 0 = <1min (very rapid), 1 = >30min (relaxed)
    return Math.min(avgGapMinutes / 30, 1);
  }

  /** @private */
  _sizeEscalation(sorted) {
    const sizes = sorted.filter(t => t.size > 0).map(t => t.size);
    if (sizes.length < 2) return 0.5;
    const avg = sizes.reduce((s, v) => s + v, 0) / sizes.length;
    const lastSize = sizes[sizes.length - 1];
    // Normalize: 0.5 = normal, 1 = 3x escalation
    return Math.min(avg > 0 ? (lastSize / avg) / 3 : 0.5, 1);
  }

  /** @private */
  _pnlSlope(sorted) {
    if (sorted.length < 3) return 0.5;
    let cumPnl = 0;
    const points = sorted.map((t, i) => { cumPnl += t.pnl || 0; return { x: i, y: cumPnl }; });
    // Simple slope (last - first) / n, normalized
    const slope = (points[points.length - 1].y - points[0].y) / sorted.length;
    // Normalize: 0 = big loss, 0.5 = flat, 1 = big win
    return Math.max(0, Math.min(1, 0.5 + slope / 200));
  }

  /** @private */
  _fomoProximity(sorted, candles) {
    if (!candles || candles.length < 5) return 0;
    let fomoCount = 0;
    for (const trade of sorted) {
      const entryTime = trade.entryTime || trade.time;
      if (!entryTime) continue;
      const nearCandle = candles.find(c => Math.abs(entryTime - c.time) < 5 * 60 * 1000);
      if (nearCandle) {
        const move = Math.abs(nearCandle.close - nearCandle.open) / (nearCandle.open || 1);
        if (move > 0.02) fomoCount++;
      }
    }
    return Math.min(fomoCount / sorted.length, 1);
  }

  /** @private */
  _reversalCount(sorted) {
    let count = 0;
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      const prevSide = prev.side || 'buy';
      const currSide = curr.side || 'buy';
      const timeDiff = (curr.entryTime || curr.time || 0) - (prev.exitTime || prev.entryTime || prev.time || 0);
      if (prevSide !== currSide && timeDiff < 5 * 60 * 1000) count++;
    }
    return count;
  }

  /** @private */
  _sessionDrawdown(sorted) {
    let cumPnl = 0;
    let peak = 0;
    let maxDD = 0;
    for (const trade of sorted) {
      cumPnl += trade.pnl || 0;
      if (cumPnl > peak) peak = cumPnl;
      const dd = peak > 0 ? (peak - cumPnl) / peak : 0;
      if (dd > maxDD) maxDD = dd;
    }
    return Math.min(maxDD, 1);
  }

  /** @private */
  _emotionalEscalation(sorted) {
    // Check if size increases after losses
    let escalationScore = 0;
    let count = 0;
    for (let i = 1; i < sorted.length; i++) {
      if ((sorted[i - 1].pnl || 0) < 0 && sorted[i].size && sorted[i - 1].size) {
        count++;
        if (sorted[i].size > sorted[i - 1].size * 1.1) escalationScore++;
      }
    }
    return count > 0 ? escalationScore / count : 0;
  }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const behaviorClassifier = new _BehaviorClassifier();
export { _BehaviorClassifier as BehaviorClassifier };
export default behaviorClassifier;
