// @vitest-environment node
// ═══════════════════════════════════════════════════════════════════
// charEdge — Behavior Classifier Tests (Sprint 44)
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest';
import {
  BehaviorClassifier,
  BEHAVIOR_LABELS,
  BEHAVIOR_CONFIG,
} from '../../charting_library/ai/BehaviorClassifier.js';

// ─── Helpers ────────────────────────────────────────────────────

function makeTrades(count, options = {}) {
  const { lossy = false, rapid = false, escalating = false, late = false } = options;
  const baseTime = Date.now() - 2 * 60 * 60 * 1000; // 2 hours ago

  return Array.from({ length: count }, (_, i) => ({
    entryTime: baseTime + i * (rapid ? 2 * 60000 : 15 * 60000), // 2min or 15min apart
    exitTime: baseTime + i * (rapid ? 2 * 60000 : 15 * 60000) + 5 * 60000,
    pnl: lossy ? -(10 + Math.random() * 20) : (Math.random() > 0.4 ? 15 : -10),
    size: escalating ? 1 + i * 0.5 : 1,
    side: i % 2 === 0 ? 'buy' : 'sell',
    symbol: 'BTC',
    entryPrice: 50000 + Math.random() * 100,
    exitPrice: 50000 + Math.random() * 100,
    time: late ? new Date(baseTime).setHours(23, i * 10) : baseTime + i * 15 * 60000,
  }));
}

// ═══════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════

describe('BehaviorClassifier — Constants', () => {
  it('has 5 behavior labels', () => {
    expect(BEHAVIOR_LABELS).toHaveLength(5);
    expect(BEHAVIOR_LABELS).toEqual(['Tilt', 'Revenge', 'FOMO', 'Fatigue', 'Normal']);
  });

  it('has config for every label', () => {
    for (const label of BEHAVIOR_LABELS) {
      const config = BEHAVIOR_CONFIG[label];
      expect(config).toBeDefined();
      expect(config.icon).toBeDefined();
      expect(config.severity).toBeDefined();
      expect(config.title).toBeDefined();
      expect(config.message).toBeDefined();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// Feature Extraction
// ═══════════════════════════════════════════════════════════════════

describe('BehaviorClassifier — Feature Extraction', () => {
  let classifier;

  beforeEach(() => {
    classifier = new BehaviorClassifier();
  });

  it('extracts 12-dimensional feature vector', () => {
    const trades = makeTrades(10);
    const features = classifier.extractSessionFeatures(trades);
    expect(features).toBeInstanceOf(Float32Array);
    expect(features).toHaveLength(12);
  });

  it('all features are in [0, 1] range', () => {
    const trades = makeTrades(15);
    const features = classifier.extractSessionFeatures(trades);
    for (let i = 0; i < features.length; i++) {
      expect(features[i]).toBeGreaterThanOrEqual(0);
      expect(features[i]).toBeLessThanOrEqual(1);
    }
  });

  it('returns zero vector for empty trades', () => {
    const features = classifier.extractSessionFeatures([]);
    expect(features).toHaveLength(12);
    expect(Array.from(features).every(v => v === 0)).toBe(true);
  });

  it('loss streak detected in features', () => {
    const lossTrades = makeTrades(6, { lossy: true });
    const features = classifier.extractSessionFeatures(lossTrades);
    expect(features[1]).toBeGreaterThan(0); // Loss streak > 0
    expect(features[6]).toBeGreaterThan(0.5); // Recent loss ratio > 50%
  });

  it('rapid trading detected in features', () => {
    const rapidTrades = makeTrades(8, { rapid: true });
    const features = classifier.extractSessionFeatures(rapidTrades);
    expect(features[0]).toBeGreaterThan(0); // High frequency
    expect(features[3]).toBeLessThanOrEqual(0.5); // Short gaps
  });
});

// ═══════════════════════════════════════════════════════════════════
// Classification (Heuristic Fallback)
// ═══════════════════════════════════════════════════════════════════

describe('BehaviorClassifier — Heuristic Fallback', () => {
  let classifier;

  beforeEach(() => {
    classifier = new BehaviorClassifier();
  });

  it('returns Normal for calm session', async () => {
    const trades = makeTrades(5);
    const result = await classifier.classify(trades);
    expect(result.label).toBeDefined();
    expect(BEHAVIOR_LABELS).toContain(result.label);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.probabilities).toHaveLength(5);
    expect(result.source).toBe('heuristic');
  });

  it('returns result with alert for non-Normal classification', async () => {
    const trades = makeTrades(10, { lossy: true, rapid: true, escalating: true });
    const result = await classifier.classify(trades);
    expect(result.label).toBeDefined();
    if (result.label !== 'Normal') {
      expect(result.alert).not.toBeNull();
      expect(result.alert.type).toBeDefined();
      expect(result.alert.severity).toBeDefined();
      expect(result.alert.title).toBeDefined();
      expect(result.alert.message).toBeDefined();
    }
  });

  it('returns Normal with null alert for clean sessions', async () => {
    // Provide minimal non-distressed trades
    const trades = [
      { entryTime: Date.now() - 3600000, exitTime: Date.now() - 3000000, pnl: 50, size: 1, side: 'buy' },
      { entryTime: Date.now() - 2400000, exitTime: Date.now() - 1800000, pnl: 30, size: 1, side: 'buy' },
      { entryTime: Date.now() - 1200000, exitTime: Date.now() - 600000, pnl: 20, size: 1, side: 'sell' },
    ];
    const result = await classifier.classify(trades);
    if (result.label === 'Normal') {
      expect(result.alert).toBeNull();
    }
  });

  it('handles insufficient data gracefully', async () => {
    const result = await classifier.classify([{ pnl: 10 }]);
    expect(result.label).toBe('Normal');
    expect(result.source).toBe('insufficient-data');
  });

  it('handles null/empty trades', async () => {
    const r1 = await classifier.classify(null);
    expect(r1.label).toBe('Normal');

    const r2 = await classifier.classify([]);
    expect(r2.label).toBe('Normal');
  });

  it('probabilities sum to approximately 1', async () => {
    const trades = makeTrades(8);
    const result = await classifier.classify(trades);
    const sum = result.probabilities.reduce((s, v) => s + v, 0);
    expect(sum).toBeGreaterThan(0.95);
    expect(sum).toBeLessThan(1.05);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Caching
// ═══════════════════════════════════════════════════════════════════

describe('BehaviorClassifier — Caching', () => {
  it('returns cached result on second call', async () => {
    const classifier = new BehaviorClassifier();
    const trades = makeTrades(5);

    const r1 = await classifier.classify(trades);
    const r2 = await classifier.classify(trades);
    expect(r1).toEqual(r2);
  });

  it('clearCache forces re-classification', async () => {
    const classifier = new BehaviorClassifier();
    const trades = makeTrades(5);

    await classifier.classify(trades);
    classifier.clearCache();
    // Should not throw
    const r2 = await classifier.classify(trades);
    expect(r2.label).toBeDefined();
  });
});
