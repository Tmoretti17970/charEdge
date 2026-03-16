// ═══════════════════════════════════════════════════════════════════
// charEdge — ML Pipeline Orchestrator (Sprint 39)
//
// Central coordinator for all browser ML models. Manages:
//   • Lazy model loading from manifest
//   • Inference batching & caching
//   • Graceful fallback to heuristic engines when ONNX unavailable
//   • Memory management (auto-unload on inactivity)
//
// Usage:
//   import { mlPipeline } from './MLPipeline.js';
//   const regime = await mlPipeline.classifyRegime(featureVector);
//   const patterns = await mlPipeline.detectPatterns(candles);
//   const quality = await mlPipeline.predictSetupQuality(featureHistory);
//   const anomalyScore = await mlPipeline.scoreAnomaly(featureVector);
// ═══════════════════════════════════════════════════════════════════

import { getONNXService } from '../../api/services/onnx.js';

// ─── Constants ──────────────────────────────────────────────────

const MANIFEST_URL = '/models/manifest.json';
const MODEL_BASE_URL = '/models/';
const CACHE_TTL_MS = 30_000; // Cache predictions for 30s
const INACTIVITY_TIMEOUT_MS = 5 * 60_000; // Unload after 5min idle
const MAX_RETRIES = 2;

// ─── Regime Labels (must match manifest order) ──────────────────

export const REGIME_LABELS = [
  'Strong Uptrend',
  'Mild Uptrend',
  'Consolidation',
  'Mild Downtrend',
  'Strong Downtrend',
  'Breakout',
  'Potential Reversal',
  'High Volatility',
];

export const REGIME_CONFIG = {
  'Strong Uptrend': { emoji: '🟢', bias: 'bullish', color: '#31d158' },
  'Mild Uptrend': { emoji: '🟡', bias: 'lean bullish', color: '#a8d84e' },
  Consolidation: { emoji: '🔵', bias: 'neutral', color: '#5ac8fa' },
  'Mild Downtrend': { emoji: '🟠', bias: 'lean bearish', color: '#f0b64e' },
  'Strong Downtrend': { emoji: '🔴', bias: 'bearish', color: '#ff453a' },
  Breakout: { emoji: '⚡', bias: 'follow momentum', color: '#bf5af2' },
  'Potential Reversal': { emoji: '🔄', bias: 'caution', color: '#ff9f0a' },
  'High Volatility': { emoji: '🌊', bias: 'reduce size', color: '#ff6482' },
};

// ─── Pattern Labels ─────────────────────────────────────────────

export const PATTERN_LABELS = [
  'Doji',
  'Hammer',
  'Shooting Star',
  'Engulfing Bull',
  'Engulfing Bear',
  'Inside Bar',
  'Double Top',
  'Double Bottom',
  'Triangle',
  'Flag',
  'Head & Shoulders',
  'Cup & Handle',
];

// ─── Pipeline Class ─────────────────────────────────────────────

class _MLPipeline {
  constructor() {
    /** @type {Object|null} */
    this._manifest = null;
    /** @type {Map<string, { result: any, timestamp: number }>} */
    this._cache = new Map();
    /** @type {Map<string, number>} Last access time per model */
    this._lastAccess = new Map();
    /** @type {number|null} */
    this._inactivityTimer = null;
    /** @type {boolean} */
    this._available = null; // null = not yet checked
  }

  // ─── Public API ─────────────────────────────────────────────

  /**
   * Classify market regime from 36-feature vector.
   * @param {Float32Array} featureVector - 36-element feature vector from FeatureExtractor
   * @returns {Promise<{ label: string, confidence: number, probabilities: number[], config: Object }>}
   */
  async classifyRegime(featureVector) {
    const cacheKey = `regime:${this._hashVector(featureVector)}`;
    const cached = this._getCache(cacheKey);
    if (cached) return cached;

    try {
      const probs = await this._runModel('regime-classifier', featureVector, [1, 36]);
      const probArray = Array.from(probs);
      const maxIdx = probArray.indexOf(Math.max(...probArray));
      const label = REGIME_LABELS[maxIdx];

      const result = {
        label,
        confidence: probArray[maxIdx],
        probabilities: probArray,
        config: REGIME_CONFIG[label] || REGIME_CONFIG['Consolidation'],
        source: 'ml',
      };

      this._setCache(cacheKey, result);
      return result;
    } catch {
      // Fallback: return null so callers use heuristic
      return null;
    }
  }

  /**
   * Detect patterns from 50-bar OHLCV sequence.
   * @param {Array} candles - OHLCV array (at least 50 bars)
   * @returns {Promise<Array<{ label: string, confidence: number, index: number }>>}
   */
  async detectPatterns(candles) {
    if (!candles || candles.length < 50) return [];

    const cacheKey = `patterns:${candles.length}:${candles[candles.length - 1]?.time}`;
    const cached = this._getCache(cacheKey);
    if (cached) return cached;

    try {
      // Build input: [1, 50, 6] — (batch, bars, OHLCV+volume)
      const window = candles.slice(-50);
      const input = new Float32Array(50 * 6);
      for (let i = 0; i < 50; i++) {
        const c = window[i];
        const basePrice = window[0].close || 1;
        input[i * 6 + 0] = c.open / basePrice;
        input[i * 6 + 1] = c.high / basePrice;
        input[i * 6 + 2] = c.low / basePrice;
        input[i * 6 + 3] = c.close / basePrice;
        input[i * 6 + 4] = c.volume / (window.reduce((s, w) => s + w.volume, 0) / 50 || 1);
        input[i * 6 + 5] = (c.close - c.open) / (c.high - c.low || 1); // body ratio
      }

      const probs = await this._runModel('pattern-detector', input, [1, 50, 6]);
      const probArray = Array.from(probs);

      // Return patterns with confidence > 0.3
      const result = probArray
        .map((conf, idx) => ({ label: PATTERN_LABELS[idx], confidence: conf, index: candles.length - 1 }))
        .filter((p) => p.confidence > 0.3)
        .sort((a, b) => b.confidence - a.confidence);

      this._setCache(cacheKey, result);
      return result;
    } catch {
      return [];
    }
  }

  /**
   * Predict setup quality (win probability) from 20-bar feature history.
   * @param {Float32Array[]} featureHistory - Array of 20 feature vectors (each 36 elements)
   * @returns {Promise<{ winProbability: number, grade: string } | null>}
   */
  async predictSetupQuality(featureHistory) {
    if (!featureHistory || featureHistory.length < 20) return null;

    const cacheKey = `quality:${featureHistory.length}:${Date.now() >> 15}`;
    const cached = this._getCache(cacheKey);
    if (cached) return cached;

    try {
      // Build input: [1, 20, 36]
      const input = new Float32Array(20 * 36);
      const recent = featureHistory.slice(-20);
      for (let i = 0; i < 20; i++) {
        input.set(recent[i], i * 36);
      }

      const output = await this._runModel('setup-quality', input, [1, 20, 36]);
      const winProb = Math.max(0, Math.min(1, output[0]));

      const grade =
        winProb >= 0.8
          ? 'A+'
          : winProb >= 0.7
            ? 'A'
            : winProb >= 0.6
              ? 'B+'
              : winProb >= 0.5
                ? 'B'
                : winProb >= 0.4
                  ? 'C'
                  : 'D';

      const result = { winProbability: winProb, grade, source: 'ml' };
      this._setCache(cacheKey, result);
      return result;
    } catch {
      return null;
    }
  }

  /**
   * Score anomaly via autoencoder reconstruction error.
   * @param {Float32Array} featureVector - 36-element feature vector
   * @returns {Promise<{ score: number, isAnomaly: boolean, severity: string } | null>}
   */
  async scoreAnomaly(featureVector) {
    const cacheKey = `anomaly:${this._hashVector(featureVector)}`;
    const cached = this._getCache(cacheKey);
    if (cached) return cached;

    try {
      const reconstruction = await this._runModel('anomaly-autoencoder', featureVector, [1, 36]);

      // Reconstruction error = MSE between input and output
      let mse = 0;
      for (let i = 0; i < 36; i++) {
        mse += (featureVector[i] - reconstruction[i]) ** 2;
      }
      mse /= 36;

      const score = Math.min(mse * 100, 100); // Scale to 0-100
      const isAnomaly = score > 15;
      const severity = score > 40 ? 'high' : score > 15 ? 'medium' : 'low';

      const result = { score: Math.round(score * 100) / 100, isAnomaly, severity, source: 'ml' };
      this._setCache(cacheKey, result);
      return result;
    } catch {
      return null;
    }
  }

  /**
   * Check if ML pipeline is available (ONNX Runtime loaded + models exist).
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    if (this._available !== null) return this._available;
    try {
      await this._loadManifest();
      const onnx = getONNXService();
      await onnx._ensureRuntime();
      this._available = true;
    } catch {
      this._available = false;
    }
    return this._available;
  }

  /**
   * Get status of all models.
   * @returns {{ name: string, loaded: boolean, sizeKB: number }[]}
   */
  getModelStatus() {
    const onnx = getONNXService();
    const loaded = new Set(onnx.loadedModels);
    const models = this._manifest?.models || {};

    return Object.entries(models).map(([id, m]) => ({
      id,
      name: m.name,
      loaded: loaded.has(id),
      sizeKB: m.sizeKB,
    }));
  }

  /**
   * Preload all models (call on app startup or when user enables ML).
   */
  async preloadAll() {
    const manifest = await this._loadManifest();
    const models = Object.keys(manifest.models || {});
    await Promise.allSettled(models.map((id) => this._ensureModel(id)));
  }

  // ─── Internal Methods ───────────────────────────────────────

  /** Load model manifest */
  async _loadManifest() {
    if (this._manifest) return this._manifest;
    const resp = await fetch(MANIFEST_URL);
    this._manifest = await resp.json();
    return this._manifest;
  }

  /** Ensure a specific model is loaded */
  async _ensureModel(modelId, retries = 0) {
    const onnx = getONNXService();
    if (onnx.loadedModels.includes(modelId)) {
      this._lastAccess.set(modelId, Date.now());
      return;
    }

    const manifest = await this._loadManifest();
    const modelInfo = manifest.models?.[modelId];
    if (!modelInfo) throw new Error(`[ML] Unknown model: ${modelId}`);

    const url = MODEL_BASE_URL + modelInfo.file;
    try {
      await onnx.loadModel(modelId, url);
      this._lastAccess.set(modelId, Date.now());
      this._scheduleInactivityCleanup();
    } catch (err) {
      if (retries < MAX_RETRIES) {
        // eslint-disable-next-line no-console
        console.warn(`[ML] Retrying ${modelId} (attempt ${retries + 1})`);
        await new Promise((r) => setTimeout(r, 1000 * (retries + 1)));
        return this._ensureModel(modelId, retries + 1);
      }
      throw err;
    }
  }

  /** Run inference on a model */
  async _runModel(modelId, inputData, inputShape) {
    await this._ensureModel(modelId);
    const onnx = getONNXService();

    const tensor = await onnx.createTensor(
      inputData instanceof Float32Array ? inputData : new Float32Array(inputData),
      inputShape,
    );

    const manifest = await this._loadManifest();
    const modelInfo = manifest.models[modelId];
    const inputName = modelInfo?._inputName || 'input';

    const results = await onnx.run(modelId, { [inputName]: tensor });
    const outputKey = Object.keys(results)[0];
    return results[outputKey].data;
  }

  /** Cache helpers */
  _getCache(key) {
    const entry = this._cache.get(key);
    if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) return entry.result;
    this._cache.delete(key);
    return null;
  }

  _setCache(key, result) {
    this._cache.set(key, { result, timestamp: Date.now() });
    // Prune old entries
    if (this._cache.size > 100) {
      const cutoff = Date.now() - CACHE_TTL_MS;
      for (const [k, v] of this._cache) {
        if (v.timestamp < cutoff) this._cache.delete(k);
      }
    }
  }

  /** Hash a feature vector for cache keys */
  _hashVector(vec) {
    if (!vec || vec.length === 0) return '0';
    // Fast hash: sample 8 elements
    const samples = [0, 4, 9, 14, 18, 23, 28, 35].map((i) => vec[i] ?? 0);
    return samples.map((v) => (v * 1000) | 0).join(',');
  }

  /** Auto-unload models after inactivity */
  _scheduleInactivityCleanup() {
    if (this._inactivityTimer) clearTimeout(this._inactivityTimer);
    this._inactivityTimer = setTimeout(() => {
      const now = Date.now();
      const onnx = getONNXService();
      for (const [modelId, lastAccess] of this._lastAccess) {
        if (now - lastAccess > INACTIVITY_TIMEOUT_MS) {
          onnx.unloadModel(modelId).catch(() => {});
          this._lastAccess.delete(modelId);
          // eslint-disable-next-line no-console
          console.info(`[ML] Unloaded ${modelId} due to inactivity`);
        }
      }
    }, INACTIVITY_TIMEOUT_MS);
  }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const mlPipeline = new _MLPipeline();
export { _MLPipeline as MLPipeline };
export default mlPipeline;
