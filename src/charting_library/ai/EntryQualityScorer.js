// ═══════════════════════════════════════════════════════════════════
// charEdge — Entry Quality Scorer (Sprint 45)
//
// ML-learned entry quality grading displayed alongside the
// heuristic scoreSetup() grade in ChartInsightsPanel.
//
// Uses ONNX model when available, falls back to FeatureExtractor
// heuristic scoring from LocalInsightEngine.
//
// Usage:
//   import { entryQualityScorer } from './EntryQualityScorer.js';
//   const result = await entryQualityScorer.score(featureVector);
//   // { score: 0.73, grade: 'B+', stars: 4, source: 'ml' }
// ═══════════════════════════════════════════════════════════════════

import { getONNXService } from '../../api/services/onnx.js';

// ─── Constants ──────────────────────────────────────────────────

const MODEL_ID = 'entry-quality';
const MANIFEST_URL = '/models/manifest.json';
const MODEL_BASE_URL = '/models/';
const CACHE_TTL_MS = 15_000; // 15s cache
const FEATURE_COUNT = 36;

// ─── Grade Mapping ──────────────────────────────────────────────

export const GRADE_THRESHOLDS = [
  { min: 0.90, letter: 'A+', stars: 5, desc: 'Exceptional — textbook setup' },
  { min: 0.80, letter: 'A',  stars: 5, desc: 'Excellent — high conviction' },
  { min: 0.70, letter: 'B+', stars: 4, desc: 'Good — solid edge' },
  { min: 0.60, letter: 'B',  stars: 4, desc: 'Above average — proceed with discipline' },
  { min: 0.50, letter: 'C+', stars: 3, desc: 'Average — needs additional confluence' },
  { min: 0.40, letter: 'C',  stars: 3, desc: 'Below average — tight stops required' },
  { min: 0.30, letter: 'D',  stars: 2, desc: 'Weak — high risk, low conviction' },
  { min: 0.00, letter: 'F',  stars: 1, desc: 'No edge — sit on hands' },
];

// ─── Entry Quality Scorer ───────────────────────────────────────

class _EntryQualityScorer {
  constructor() {
    this._manifest = null;
    this._cached = null;
    this._cachedHash = null;
    this._mlAvailable = null;
  }

  // ─── Public API ─────────────────────────────────────────────

  /**
   * Score entry quality from a 36-feature vector.
   *
   * @param {Float32Array} featureVector - From FeatureExtractor.extract().vector
   * @returns {Promise<{ score: number, grade: string, stars: number, desc: string, source: string }>}
   */
  async score(featureVector) {
    if (!featureVector || featureVector.length < FEATURE_COUNT) {
      return this._makeResult(0.5, 'heuristic');
    }

    // Check cache
    const hash = this._hashVector(featureVector);
    if (this._cached && this._cachedHash === hash && Date.now() - this._cached.timestamp < CACHE_TTL_MS) {
      return this._cached.result;
    }

    // Try ML first
    const mlScore = await this._runML(featureVector);
    if (mlScore !== null) {
      const result = this._makeResult(mlScore, 'ml');
      this._cached = { result, timestamp: Date.now() };
      this._cachedHash = hash;
      return result;
    }

    // Fallback: heuristic scoring from feature vector
    const heuristicScore = this._heuristicScore(featureVector);
    const result = this._makeResult(heuristicScore, 'heuristic');
    this._cached = { result, timestamp: Date.now() };
    this._cachedHash = hash;
    return result;
  }

  /**
   * Clear cached result.
   */
  clearCache() {
    this._cached = null;
    this._cachedHash = null;
  }

  // ─── ML Inference ─────────────────────────────────────────────

  async _runML(featureVector) {
    try {
      if (this._mlAvailable === false) return null;

      const onnx = getONNXService();
      await onnx._ensureRuntime();

      if (!this._manifest) {
        const resp = await fetch(MANIFEST_URL);
        this._manifest = await resp.json();
      }

      const modelInfo = this._manifest?.models?.[MODEL_ID];
      if (!modelInfo) {
        this._mlAvailable = false;
        return null;
      }

      if (!onnx.loadedModels.includes(MODEL_ID)) {
        await onnx.loadModel(MODEL_ID, MODEL_BASE_URL + modelInfo.file);
      }

      const tensor = await onnx.createTensor(featureVector, [1, FEATURE_COUNT]);
      const inputName = modelInfo._inputName || 'input';
      const results = await onnx.run(MODEL_ID, { [inputName]: tensor });
      const outputKey = Object.keys(results)[0];
      const rawScore = results[outputKey].data[0];

      // Sigmoid to [0, 1]
      const score = 1 / (1 + Math.exp(-rawScore));
      this._mlAvailable = true;
      return score;
    } catch {
      this._mlAvailable = false;
      return null;
    }
  }

  // ─── Heuristic Fallback ───────────────────────────────────────

  /**
   * Score using feature vector directly (mirrors LocalInsightEngine.scoreSetup logic).
   * Feature vector layout: [volatility(6), momentum(12), volume(7), price(11)]
   */
  _heuristicScore(vec) {
    let score = 50;

    // Momentum features (indices 6-17)
    const rsi = vec[6] * 100;               // RSI normalized to 0-100
    const trendStrength = vec[11] * 50;      // Trend strength
    const macdCross = vec[9];                // MACD crossover
    const stochK = vec[13] * 100;            // Stochastic %K

    // Volume features (indices 18-24)
    const volumeRatio = vec[18] * 5;         // Volume ratio
    const buyPressure = vec[21];             // Buy pressure 0-1

    // Volatility features (indices 0-5)
    const bollingerWidth = vec[1];           // Bollinger width
    const atrRatio = vec[0];                 // ATR ratio

    // Price features (indices 25-35)
    const bodyRatio = vec[30];               // Body ratio 0-1

    // Momentum alignment
    if (trendStrength > 15) score += 10;
    if (trendStrength > 25) score += 5;
    if (macdCross !== 0) score += 5;
    if (rsi > 30 && rsi < 70) score += 5;

    // Stochastic confirmation
    if (stochK > 20 && stochK < 80) score += 3;

    // Volume confirmation
    if (volumeRatio > 1.2) score += 8;
    if (buyPressure > 0.6) score += 3;
    if (volumeRatio < 0.5) score -= 10;

    // Volatility context
    if (bollingerWidth > 0.01 && bollingerWidth < 0.06) score += 5;
    if (atrRatio < 0.005) score -= 5;
    if (atrRatio > 0.04) score -= 5;

    // Price action
    if (bodyRatio > 0.6) score += 5;

    return Math.max(0, Math.min(100, score)) / 100;
  }

  // ─── Result Builder ───────────────────────────────────────────

  _makeResult(score, source) {
    const clamped = Math.max(0, Math.min(1, score));
    const grade = GRADE_THRESHOLDS.find(g => clamped >= g.min) || GRADE_THRESHOLDS[GRADE_THRESHOLDS.length - 1];
    return {
      score: Math.round(clamped * 100) / 100,
      grade: grade.letter,
      stars: grade.stars,
      desc: grade.desc,
      source,
    };
  }

  _hashVector(vec) {
    if (!vec || vec.length === 0) return '0';
    const samples = [0, 5, 10, 15, 20, 25, 30, 35].map(i => vec[i] ?? 0);
    return samples.map(v => (v * 1000) | 0).join(',');
  }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const entryQualityScorer = new _EntryQualityScorer();
export { _EntryQualityScorer as EntryQualityScorer };
export default entryQualityScorer;
