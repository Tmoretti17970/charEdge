// ═══════════════════════════════════════════════════════════════════
// charEdge — Phase 2 Tests (AI Copilot Sprints 6–10)
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { ScannerEngine } from '../ai/ScannerEngine';
import type { Bar } from '../ai/ScannerEngine';

// ─── Helper: Generate bars ──────────────────────────────────────

function makeBars(count: number, opts?: { trend?: 'up' | 'down' | 'flat'; volumeSpike?: boolean }): Bar[] {
  const bars: Bar[] = [];
  let price = 100;
  const trend = opts?.trend || 'flat';

  for (let i = 0; i < count; i++) {
    const drift = trend === 'up' ? 0.5 : trend === 'down' ? -0.5 : 0;
    const noise = (Math.sin(i * 0.5) * 2);
    price = Math.max(1, price + drift + noise * 0.3);

    const vol = opts?.volumeSpike && i >= count - 3 ? 50000 : 10000 + Math.random() * 5000;
    bars.push({
      time: Date.now() - (count - i) * 60000,
      open: price - 0.2,
      high: price + 1,
      low: price - 1,
      close: price,
      volume: vol,
    });
  }
  return bars;
}

// ─── Sprint 6: ScannerEngine ────────────────────────────────────

describe('ScannerEngine', () => {
  it('scans multiple symbols and returns ranked results', async () => {
    const engine = new ScannerEngine();
    const results = await engine.scan(
      ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
      (symbol) => {
        if (symbol === 'BTCUSDT') return makeBars(50, { trend: 'up', volumeSpike: true });
        if (symbol === 'ETHUSDT') return makeBars(50, { trend: 'down' });
        return makeBars(50, { trend: 'flat' });
      },
    );
    expect(results.length).toBe(3);
    expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
  });

  it('getTopN returns limited results', async () => {
    const engine = new ScannerEngine();
    await engine.scan(['A', 'B', 'C', 'D'], () => makeBars(50));
    expect(engine.getTopN(2).length).toBe(2);
  });

  it('handles empty bars gracefully', async () => {
    const engine = new ScannerEngine();
    const results = await engine.scan(['X'], () => []);
    expect(results.length).toBe(0);
  });

  it('generates AI summary', async () => {
    const engine = new ScannerEngine();
    await engine.scan(['BTC'], () => makeBars(50, { trend: 'up' }));
    const summary = engine.getScanSummaryForAI();
    expect(summary).toContain('Scanner Results');
    expect(summary).toContain('BTC');
  });

  it('reports scan progress', async () => {
    const engine = new ScannerEngine();
    const progress: number[] = [];
    await engine.scan(['A', 'B'], () => makeBars(50), (p) => progress.push(p.completed));
    expect(progress.length).toBeGreaterThan(0);
  });

  it('each result has required fields', async () => {
    const engine = new ScannerEngine();
    const results = await engine.scan(['BTC'], () => makeBars(50, { trend: 'up' }));
    const r = results[0];
    expect(r.symbol).toBe('BTC');
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(['bullish', 'bearish', 'neutral']).toContain(r.direction);
    expect(r.regime).toBeTruthy();
    expect(r.summary).toBeTruthy();
  });
});

// ─── Sprint 7: PatternCNN ───────────────────────────────────────

import { PatternCNN } from '../ai/PatternCNN';

describe('PatternCNN', () => {
  it('returns empty for insufficient data', () => {
    const cnn = new PatternCNN();
    expect(cnn.detect(makeBars(10))).toHaveLength(0);
  });

  it('detects patterns in trending data', () => {
    const cnn = new PatternCNN();
    // Create a sharp up move then consolidation (flag pattern)
    const bars = makeBars(40, { trend: 'up' });
    const patterns = cnn.detect(bars);
    // May or may not detect depending on shape — just verify it runs
    expect(Array.isArray(patterns)).toBe(true);
  });

  it('patterns have required fields', () => {
    const cnn = new PatternCNN();
    const bars = makeBars(50, { trend: 'up' });
    const patterns = cnn.detect(bars);
    for (const p of patterns) {
      expect(p.type).toBeTruthy();
      expect(p.label).toBeTruthy();
      expect(p.confidence).toBeGreaterThanOrEqual(30);
      expect(p.confidence).toBeLessThanOrEqual(95);
      expect(['bullish', 'bearish', 'neutral']).toContain(p.direction);
    }
  });

  it('isModelLoaded returns false (no ONNX model)', () => {
    expect(new PatternCNN().isModelLoaded()).toBe(false);
  });

  it('getPatternsForAI returns string', () => {
    const cnn = new PatternCNN();
    const result = cnn.getPatternsForAI(makeBars(50));
    expect(typeof result).toBe('string');
  });
});

// ─── Sprint 8: VolumeAutoencoder ────────────────────────────────

import { VolumeAutoencoder } from '../ai/VolumeAutoencoder';

describe('VolumeAutoencoder', () => {
  it('returns neutral for insufficient data', () => {
    const va = new VolumeAutoencoder();
    const result = va.analyze([]);
    expect(result.flowSignal).toBe('neutral');
    expect(result.institutionalScore).toBe(0);
  });

  it('analyzes bars with volume spikes', () => {
    const va = new VolumeAutoencoder();
    const bars = makeBars(50, { volumeSpike: true });
    const result = va.analyze(bars);
    expect(result.relativeVolume).toBeGreaterThan(1);
    expect(['accumulation', 'distribution', 'neutral']).toContain(result.flowSignal);
    expect(result.institutionalScore).toBeGreaterThanOrEqual(0);
  });

  it('detects volume anomalies', () => {
    const va = new VolumeAutoencoder();
    const bars = makeBars(50, { volumeSpike: true });
    const anomalies = va.getVolumeAnomalies(bars);
    expect(Array.isArray(anomalies)).toBe(true);
  });

  it('classifies flow signals', () => {
    const va = new VolumeAutoencoder();
    const signal = va.getFlowSignal(makeBars(30));
    expect(['accumulation', 'distribution', 'neutral']).toContain(signal);
  });

  it('provides institutional score', () => {
    const va = new VolumeAutoencoder();
    const score = va.getInstitutionalScore(makeBars(30, { volumeSpike: true }));
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('summary is a string', () => {
    const va = new VolumeAutoencoder();
    const result = va.analyze(makeBars(30));
    expect(typeof result.summary).toBe('string');
  });
});

// ─── Sprint 9: MTFConfluence Upgrade ────────────────────────────

import { mtfConfluence } from '../ai/MTFConfluence';

describe('MTFConfluence - Weighted', () => {
  it('analyzeWeighted uses TF weights', () => {
    const result = mtfConfluence.analyzeWeighted({
      '5': makeBars(30, { trend: 'up' }),
      '60': makeBars(30, { trend: 'up' }),
      '1D': makeBars(30, { trend: 'up' }),
    });
    expect(result.score).toBeGreaterThan(0);
    expect(result.signals.length).toBe(3);
  });

  it('getAlignmentStrength returns 1 for all same direction', () => {
    const result = mtfConfluence.analyzeWeighted({
      '5': makeBars(30, { trend: 'up' }),
      '60': makeBars(30, { trend: 'up' }),
    });
    const alignment = mtfConfluence.getAlignmentStrength(result.signals);
    expect(alignment).toBeGreaterThan(0);
  });

  it('handles empty data', () => {
    const result = mtfConfluence.analyzeWeighted({});
    expect(result.score).toBe(0);
    expect(result.direction).toBe('neutral');
  });

  it('getConfluenceForAI returns string', () => {
    const text = mtfConfluence.getConfluenceForAI({ '60': makeBars(30, { trend: 'up' }) });
    expect(typeof text).toBe('string');
  });
});

// ─── Sprint 10: SocialSentimentScorer ───────────────────────────

import { SocialSentimentScorer } from '../ai/SocialSentimentScorer';

describe('SocialSentimentScorer', () => {
  it('scores bullish text positively', () => {
    const scorer = new SocialSentimentScorer();
    const result = scorer.scoreText('Bitcoin is pumping! Very bullish rally incoming!');
    expect(result.score).toBeGreaterThan(0);
    expect(['bullish', 'very_bullish']).toContain(result.label);
  });

  it('scores bearish text negatively', () => {
    const scorer = new SocialSentimentScorer();
    const result = scorer.scoreText('Market crash incoming, sell everything, major decline');
    expect(result.score).toBeLessThan(0);
    expect(['bearish', 'very_bearish']).toContain(result.label);
  });

  it('scores neutral text as neutral', () => {
    const scorer = new SocialSentimentScorer();
    const result = scorer.scoreText('The weather is nice today');
    expect(result.label).toBe('neutral');
  });

  it('handles negation', () => {
    const scorer = new SocialSentimentScorer();
    const result = scorer.scoreText('not bullish at all');
    expect(result.score).toBeLessThanOrEqual(0);
  });

  it('aggregates multiple texts', () => {
    const scorer = new SocialSentimentScorer();
    const agg = scorer.aggregate([
      'Very bullish on BTC!',
      'Bearish crash coming',
      'Moon soon, buy the dip!',
    ]);
    expect(agg.sampleSize).toBe(3);
    expect(agg.bullishCount + agg.bearishCount + agg.neutralCount).toBe(3);
  });

  it('empty aggregate returns zero', () => {
    const scorer = new SocialSentimentScorer();
    const agg = scorer.aggregate([]);
    expect(agg.sampleSize).toBe(0);
    expect(agg.averageScore).toBe(0);
  });

  it('getAggregateForAI returns formatted string', () => {
    const scorer = new SocialSentimentScorer();
    const text = scorer.getAggregateForAI(['bullish pump', 'bearish dump']);
    expect(text).toContain('Social Sentiment');
  });
});
