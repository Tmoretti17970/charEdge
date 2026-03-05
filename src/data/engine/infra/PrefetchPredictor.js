// ═══════════════════════════════════════════════════════════════════
// charEdge — Prefetch Predictor (ML-lite)
//
// Deep Dive Item #12: Smart prefetching using lightweight heuristics.
//
// Three prediction strategies:
//   1. Time-of-day awareness — which symbols the user views at this hour
//   2. Co-occurrence matrix  — when A is viewed, B is often next
//   3. Session sequences     — bigram chain prediction (A → B → C)
//
// Model persists in a single localStorage key (~2-5 KB).
// No heavy ML libraries — just frequency tables and bigrams.
//
// Usage:
//   import { prefetchPredictor } from './PrefetchPredictor.js';
//   prefetchPredictor.recordView('BTCUSDT');
//   const predictions = prefetchPredictor.predict('BTCUSDT', 3);
// ═══════════════════════════════════════════════════════════════════

const STORAGE_KEY = 'charEdge-prefetch-model';
const MAX_SYMBOLS = 50;        // Cap model to top 50 symbols
const CO_OCCUR_WINDOW = 60000; // 60s — views within this window count as co-occurring
const DECAY_FACTOR = 0.95;     // Slowly decay old counts to favor recent behavior

// ─── Model Structure ───────────────────────────────────────────

/**
 * The prediction model stored in localStorage:
 * {
 *   hourly: { [hour: string]: { [symbol: string]: number } },
 *   coOccur: { [symbolA: string]: { [symbolB: string]: number } },
 *   bigrams: { [fromSymbol: string]: { [toSymbol: string]: number } },
 *   lastSymbol: string | null,
 *   lastViewTime: number,
 *   version: 1
 * }
 */

// ─── PrefetchPredictor Class ───────────────────────────────────

class _PrefetchPredictor {
  constructor() {
    /** @type {Object} */
    this._model = null;
    this._loaded = false;
  }

  // ─── Lazy Model Loading ─────────────────────────────────────

  _loadModel() {
    if (this._loaded) return this._model;
    this._loaded = true;

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this._model = JSON.parse(raw);
        if (this._model.version !== 1) this._model = null;
      }
    } catch (_) { /* localStorage unavailable */ }

    if (!this._model) {
      this._model = {
        hourly: {},
        coOccur: {},
        bigrams: {},
        lastSymbol: null,
        lastViewTime: 0,
        version: 1,
      };
    }

    return this._model;
  }

  _saveModel() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._model));
    } catch (_) { /* storage full or unavailable */ }
  }

  // ─── Recording ──────────────────────────────────────────────

  /**
   * Record that a symbol was viewed. Updates all three models.
   * Call this whenever the user switches to a new symbol.
   *
   * @param {string} symbol
   */
  recordView(symbol) {
    if (!symbol) return;
    const sym = symbol.toUpperCase();
    const model = this._loadModel();
    const now = Date.now();
    const hour = new Date().getHours().toString();

    // 1. Time-of-day: increment hourly frequency
    if (!model.hourly[hour]) model.hourly[hour] = {};
    model.hourly[hour][sym] = (model.hourly[hour][sym] || 0) + 1;

    // 2. Co-occurrence: if previous view was within window, record pair
    if (model.lastSymbol && model.lastSymbol !== sym) {
      const elapsed = now - model.lastViewTime;
      if (elapsed < CO_OCCUR_WINDOW) {
        // Bidirectional co-occurrence
        if (!model.coOccur[model.lastSymbol]) model.coOccur[model.lastSymbol] = {};
        model.coOccur[model.lastSymbol][sym] = (model.coOccur[model.lastSymbol][sym] || 0) + 1;

        if (!model.coOccur[sym]) model.coOccur[sym] = {};
        model.coOccur[sym][model.lastSymbol] = (model.coOccur[sym][model.lastSymbol] || 0) + 1;
      }

      // 3. Bigram: record transition from lastSymbol → sym
      if (!model.bigrams[model.lastSymbol]) model.bigrams[model.lastSymbol] = {};
      model.bigrams[model.lastSymbol][sym] = (model.bigrams[model.lastSymbol][sym] || 0) + 1;
    }

    model.lastSymbol = sym;
    model.lastViewTime = now;

    // Prune model if it grows too large
    this._pruneIfNeeded();

    this._saveModel();
  }

  // ─── Prediction ─────────────────────────────────────────────

  /**
   * Predict the top-N symbols the user is most likely to view next.
   * Combines all three strategies with weighted scoring.
   *
   * @param {string} currentSymbol - Currently viewed symbol
   * @param {number} [count=3]     - Number of predictions to return
   * @returns {Array<{ symbol: string, score: number, reason: string }>}
   */
  predict(currentSymbol, count = 3) {
    const model = this._loadModel();
    const current = (currentSymbol || '').toUpperCase();
    const scores = new Map(); // symbol → { score, reasons }

    const addScore = (sym, points, reason) => {
      if (sym === current) return; // Don't predict the current symbol
      const existing = scores.get(sym) || { score: 0, reasons: [] };
      existing.score += points;
      existing.reasons.push(reason);
      scores.set(sym, existing);
    };

    // Strategy 1: Time-of-day (weight: 1.0)
    const hour = new Date().getHours().toString();
    const hourData = model.hourly[hour];
    if (hourData) {
      const sorted = Object.entries(hourData).sort((a, b) => b[1] - a[1]);
      const maxCount = sorted[0]?.[1] || 1;
      for (const [sym, cnt] of sorted.slice(0, 10)) {
        addScore(sym, (cnt / maxCount) * 1.0, 'time-of-day');
      }
    }

    // Strategy 2: Co-occurrence (weight: 1.5)
    const coData = model.coOccur[current];
    if (coData) {
      const sorted = Object.entries(coData).sort((a, b) => b[1] - a[1]);
      const maxCount = sorted[0]?.[1] || 1;
      for (const [sym, cnt] of sorted.slice(0, 10)) {
        addScore(sym, (cnt / maxCount) * 1.5, 'co-occurrence');
      }
    }

    // Strategy 3: Bigram sequence (weight: 2.0 — strongest signal)
    const bigramData = model.bigrams[current];
    if (bigramData) {
      const sorted = Object.entries(bigramData).sort((a, b) => b[1] - a[1]);
      const maxCount = sorted[0]?.[1] || 1;
      for (const [sym, cnt] of sorted.slice(0, 10)) {
        addScore(sym, (cnt / maxCount) * 2.0, 'sequence');
      }
    }

    // Sort by score descending and return top N
    return [...scores.entries()]
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, count)
      .map(([symbol, { score, reasons }]) => ({
        symbol,
        score: Math.round(score * 100) / 100,
        reason: reasons.join('+'),
      }));
  }

  // ─── Model Management ──────────────────────────────────────

  /**
   * Apply decay to all counters and prune low-frequency entries.
   * Keeps the model lean and recent.
   */
  decay() {
    const model = this._loadModel();

    // Decay hourly
    for (const hour of Object.keys(model.hourly)) {
      for (const sym of Object.keys(model.hourly[hour])) {
        model.hourly[hour][sym] = Math.round(model.hourly[hour][sym] * DECAY_FACTOR);
        if (model.hourly[hour][sym] <= 0) delete model.hourly[hour][sym];
      }
      if (Object.keys(model.hourly[hour]).length === 0) delete model.hourly[hour];
    }

    // Decay co-occurrence
    for (const a of Object.keys(model.coOccur)) {
      for (const b of Object.keys(model.coOccur[a])) {
        model.coOccur[a][b] = Math.round(model.coOccur[a][b] * DECAY_FACTOR);
        if (model.coOccur[a][b] <= 0) delete model.coOccur[a][b];
      }
      if (Object.keys(model.coOccur[a]).length === 0) delete model.coOccur[a];
    }

    // Decay bigrams
    for (const from of Object.keys(model.bigrams)) {
      for (const to of Object.keys(model.bigrams[from])) {
        model.bigrams[from][to] = Math.round(model.bigrams[from][to] * DECAY_FACTOR);
        if (model.bigrams[from][to] <= 0) delete model.bigrams[from][to];
      }
      if (Object.keys(model.bigrams[from]).length === 0) delete model.bigrams[from];
    }

    this._saveModel();
  }

  /**
   * Prune the model to keep it under MAX_SYMBOLS unique symbols.
   * Removes the least-frequent entries.
   * @private
   */
  _pruneIfNeeded() {
    const model = this._model;

    // Count total unique symbols across all models
    const allSymbols = new Set();
    for (const hourData of Object.values(model.hourly)) {
      for (const sym of Object.keys(hourData)) allSymbols.add(sym);
    }
    for (const sym of Object.keys(model.coOccur)) allSymbols.add(sym);
    for (const sym of Object.keys(model.bigrams)) allSymbols.add(sym);

    if (allSymbols.size <= MAX_SYMBOLS) return;

    // Compute total score per symbol
    const totalScores = {};
    for (const hourData of Object.values(model.hourly)) {
      for (const [sym, cnt] of Object.entries(hourData)) {
        totalScores[sym] = (totalScores[sym] || 0) + cnt;
      }
    }
    for (const [sym, targets] of Object.entries(model.coOccur)) {
      for (const cnt of Object.values(targets)) {
        totalScores[sym] = (totalScores[sym] || 0) + cnt;
      }
    }
    for (const [sym, targets] of Object.entries(model.bigrams)) {
      for (const cnt of Object.values(targets)) {
        totalScores[sym] = (totalScores[sym] || 0) + cnt;
      }
    }

    // Find symbols to prune (lowest scores)
    const sorted = Object.entries(totalScores).sort((a, b) => a[1] - b[1]);
    const toPrune = new Set(
      sorted.slice(0, allSymbols.size - MAX_SYMBOLS).map(([sym]) => sym)
    );

    // Remove pruned symbols from all models
    for (const hour of Object.keys(model.hourly)) {
      for (const sym of toPrune) delete model.hourly[hour][sym];
    }
    for (const sym of toPrune) {
      delete model.coOccur[sym];
      delete model.bigrams[sym];
    }
    for (const a of Object.keys(model.coOccur)) {
      for (const sym of toPrune) delete model.coOccur[a][sym];
    }
    for (const from of Object.keys(model.bigrams)) {
      for (const sym of toPrune) delete model.bigrams[from][sym];
    }
  }

  /**
   * Get the raw model for diagnostics.
   * @returns {Object}
   */
  getModel() {
    return { ...this._loadModel() };
  }

  /**
   * Clear the prediction model entirely.
   */
  clear() {
    this._model = {
      hourly: {},
      coOccur: {},
      bigrams: {},
      lastSymbol: null,
      lastViewTime: 0,
      version: 1,
    };
    this._saveModel();
  }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const prefetchPredictor = new _PrefetchPredictor();
export { _PrefetchPredictor };
export default prefetchPredictor;
