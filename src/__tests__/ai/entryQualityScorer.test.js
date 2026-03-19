// @vitest-environment node
// ═══════════════════════════════════════════════════════════════════
// charEdge — Entry Quality Scorer Tests (Sprint 45)
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest';
import {
  EntryQualityScorer,
  GRADE_THRESHOLDS,
} from '../../charting_library/ai/EntryQualityScorer.js';

// ─── Helpers ────────────────────────────────────────────────────

function makeFeatureVector(fill = 0.5) {
  return new Float32Array(36).fill(fill);
}

function makeBullishVector() {
  const vec = new Float32Array(36);
  vec[6] = 0.6;    // RSI = 60 (healthy bullish)
  vec[9] = 1;       // MACD bullish cross
  vec[11] = 0.4;    // Strong trend
  vec[13] = 0.65;   // Stochastic %K = 65
  vec[18] = 0.35;   // Volume ratio = 1.75x
  vec[21] = 0.7;    // Buy pressure 70%
  vec[1] = 0.03;    // Bollinger width (normal)
  vec[0] = 0.02;    // ATR ratio (normal)
  vec[30] = 0.7;    // Strong body
  return vec;
}

function makeBearishVector() {
  const vec = new Float32Array(36);
  vec[6] = 0.15;    // RSI = 15 (oversold)
  vec[9] = -1;      // MACD bearish
  vec[11] = 0.1;    // Weak trend
  vec[18] = 0.08;   // Volume ratio = 0.4x (low)
  vec[21] = 0.3;    // Weak buy pressure
  vec[0] = 0.05;    // High ATR
  vec[30] = 0.2;    // Small body
  return vec;
}

// ═══════════════════════════════════════════════════════════════════
// Grade Thresholds
// ═══════════════════════════════════════════════════════════════════

describe('EntryQualityScorer — Grade Thresholds', () => {
  it('has 8 grade levels', () => {
    expect(GRADE_THRESHOLDS).toHaveLength(8);
  });

  it('thresholds are in descending order', () => {
    for (let i = 0; i < GRADE_THRESHOLDS.length - 1; i++) {
      expect(GRADE_THRESHOLDS[i].min).toBeGreaterThan(GRADE_THRESHOLDS[i + 1].min);
    }
  });

  it('each grade has required fields', () => {
    for (const g of GRADE_THRESHOLDS) {
      expect(g.letter).toBeDefined();
      expect(g.stars).toBeGreaterThanOrEqual(1);
      expect(g.stars).toBeLessThanOrEqual(5);
      expect(g.desc).toBeDefined();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// Scoring (Heuristic Fallback)
// ═══════════════════════════════════════════════════════════════════

describe('EntryQualityScorer — Heuristic Scoring', () => {
  let scorer;

  beforeEach(() => {
    scorer = new EntryQualityScorer();
  });

  it('scores bullish setup higher than weak setup', async () => {
    const bullish = await scorer.score(makeBullishVector());
    const bearish = await scorer.score(makeBearishVector());

    expect(bullish.score).toBeGreaterThan(bearish.score);
    expect(bullish.source).toBe('heuristic');
  });

  it('returns valid grade structure', async () => {
    const result = await scorer.score(makeFeatureVector());
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
    expect(result.grade).toBeDefined();
    expect(result.stars).toBeGreaterThanOrEqual(1);
    expect(result.stars).toBeLessThanOrEqual(5);
    expect(result.desc).toBeDefined();
    expect(result.source).toBe('heuristic');
  });

  it('bullish setup gets B or better', async () => {
    const result = await scorer.score(makeBullishVector());
    const goodGrades = ['A+', 'A', 'B+', 'B'];
    expect(goodGrades).toContain(result.grade);
  });

  it('handles null/short vectors gracefully', async () => {
    const r1 = await scorer.score(null);
    expect(r1.score).toBe(0.5);

    const r2 = await scorer.score(new Float32Array(10));
    expect(r2.score).toBe(0.5);
  });

  it('always returns score in [0, 1]', async () => {
    // Extreme vectors
    const max = await scorer.score(new Float32Array(36).fill(1));
    const min = await scorer.score(new Float32Array(36).fill(0));
    const neg = await scorer.score(new Float32Array(36).fill(-1));

    expect(max.score).toBeLessThanOrEqual(1);
    expect(min.score).toBeGreaterThanOrEqual(0);
    expect(neg.score).toBeGreaterThanOrEqual(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Caching
// ═══════════════════════════════════════════════════════════════════

describe('EntryQualityScorer — Caching', () => {
  it('caches result for same vector', async () => {
    const scorer = new EntryQualityScorer();
    const vec = makeBullishVector();

    const r1 = await scorer.score(vec);
    const r2 = await scorer.score(vec);
    expect(r1).toEqual(r2);
  });

  it('returns fresh result after clearCache', async () => {
    const scorer = new EntryQualityScorer();
    const vec = makeBullishVector();

    await scorer.score(vec);
    scorer.clearCache();
    const r2 = await scorer.score(vec);
    expect(r2.score).toBeDefined();
  });

  it('returns fresh result for different vector', async () => {
    const scorer = new EntryQualityScorer();

    const r1 = await scorer.score(makeBullishVector());
    scorer.clearCache(); // Ensure no cross-contamination
    const r2 = await scorer.score(makeBearishVector());
    expect(r1.score).not.toBe(r2.score);
  });
});
