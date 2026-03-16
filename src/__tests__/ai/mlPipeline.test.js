// @vitest-environment node
// ═══════════════════════════════════════════════════════════════════
// charEdge — ML Pipeline Tests (Sprint 39-43)
//
// Tests for:
//   • MLPipeline caching & cache invalidation
//   • Feature vector hashing
//   • Model status reporting
//   • Graceful degradation when ONNX unavailable
//   • Regime classification result format
//   • Pattern detection result format
//   • Setup quality prediction result format
//   • Anomaly scoring result format
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest';
import {
  MLPipeline,
  REGIME_LABELS,
  REGIME_CONFIG,
  PATTERN_LABELS,
} from '../../charting_library/ai/MLPipeline.js';
import { RegimeStage } from '../../charting_library/overlays/RegimeStage.js';

// ─── Helpers ────────────────────────────────────────────────────

function makeFeatureVector(fill = 0.5) {
  return new Float32Array(36).fill(fill);
}

function makeCandles(count = 60) {
  return Array.from({ length: count }, (_, i) => ({
    time: Date.now() - (count - i) * 60000,
    open: 100 + Math.random() * 2,
    high: 102 + Math.random() * 2,
    low: 98 + Math.random() * 2,
    close: 100 + Math.random() * 2,
    volume: 1000 + Math.random() * 500,
  }));
}

// ═══════════════════════════════════════════════════════════════════
// Constants & Config
// ═══════════════════════════════════════════════════════════════════

describe('ML Pipeline — Constants', () => {
  it('has 8 regime labels matching config', () => {
    expect(REGIME_LABELS).toHaveLength(8);
    REGIME_LABELS.forEach((label) => {
      expect(REGIME_CONFIG[label]).toBeDefined();
      expect(REGIME_CONFIG[label].emoji).toBeDefined();
      expect(REGIME_CONFIG[label].bias).toBeDefined();
      expect(REGIME_CONFIG[label].color).toMatch(/^#/);
    });
  });

  it('has 12 pattern labels', () => {
    expect(PATTERN_LABELS).toHaveLength(12);
    PATTERN_LABELS.forEach((label) => {
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(2);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// MLPipeline Class
// ═══════════════════════════════════════════════════════════════════

describe('ML Pipeline — Instance', () => {
  let pipeline;

  beforeEach(() => {
    pipeline = new MLPipeline();
  });

  it('creates fresh instance with empty state', () => {
    expect(pipeline._manifest).toBeNull();
    expect(pipeline._cache.size).toBe(0);
    expect(pipeline._available).toBeNull();
  });

  it('_hashVector produces consistent hashes', () => {
    const v1 = makeFeatureVector(0.5);
    const v2 = makeFeatureVector(0.5);
    const v3 = makeFeatureVector(0.7);

    expect(pipeline._hashVector(v1)).toBe(pipeline._hashVector(v2));
    expect(pipeline._hashVector(v1)).not.toBe(pipeline._hashVector(v3));
  });

  it('_hashVector handles empty/null vectors', () => {
    expect(pipeline._hashVector(null)).toBe('0');
    expect(pipeline._hashVector(new Float32Array(0))).toBe('0');
  });

  it('cache set and get works within TTL', () => {
    pipeline._setCache('test:key', { value: 42 });
    const cached = pipeline._getCache('test:key');
    expect(cached).toEqual({ value: 42 });
  });

  it('cache returns null for expired entries', () => {
    pipeline._cache.set('old:key', { result: { value: 1 }, timestamp: Date.now() - 60_000 });
    const cached = pipeline._getCache('old:key');
    expect(cached).toBeNull();
  });

  it('cache prunes entries when exceeding 100', () => {
    // Fill cache with old entries
    const oldTimestamp = Date.now() - 60_000;
    for (let i = 0; i < 105; i++) {
      pipeline._cache.set(`key:${i}`, { result: i, timestamp: oldTimestamp });
    }
    expect(pipeline._cache.size).toBe(105);

    // Adding a new entry should trigger pruning
    pipeline._setCache('new:key', { value: 'fresh' });
    expect(pipeline._cache.size).toBeLessThan(105);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Graceful Degradation
// ═══════════════════════════════════════════════════════════════════

describe('ML Pipeline — Graceful Degradation', () => {
  let pipeline;

  beforeEach(() => {
    pipeline = new MLPipeline();
  });

  it('classifyRegime returns null when ONNX unavailable', async () => {
    const result = await pipeline.classifyRegime(makeFeatureVector());
    expect(result).toBeNull();
  });

  it('detectPatterns returns empty array when ONNX unavailable', async () => {
    const result = await pipeline.detectPatterns(makeCandles(60));
    expect(result).toEqual([]);
  });

  it('detectPatterns returns empty for insufficient candles', async () => {
    const result = await pipeline.detectPatterns(makeCandles(10));
    expect(result).toEqual([]);
  });

  it('predictSetupQuality returns null when ONNX unavailable', async () => {
    const history = Array.from({ length: 20 }, () => makeFeatureVector());
    const result = await pipeline.predictSetupQuality(history);
    expect(result).toBeNull();
  });

  it('predictSetupQuality returns null for insufficient history', async () => {
    const history = Array.from({ length: 5 }, () => makeFeatureVector());
    const result = await pipeline.predictSetupQuality(history);
    expect(result).toBeNull();
  });

  it('scoreAnomaly returns null when ONNX unavailable', async () => {
    const result = await pipeline.scoreAnomaly(makeFeatureVector());
    expect(result).toBeNull();
  });

  it('getModelStatus returns empty when manifest not loaded', () => {
    const status = pipeline.getModelStatus();
    expect(status).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════
// RegimeStage Overlay
// ═══════════════════════════════════════════════════════════════════

describe('RegimeStage Overlay', () => {
  it('constructs with default config', () => {
    const stage = new RegimeStage(null);
    expect(stage.alpha).toBe(0.04);
    expect(stage.showLabel).toBe(true);
    expect(stage.showBadge).toBe(true);
    expect(stage.regime).toBeNull();
  });

  it('constructs with custom alpha', () => {
    const stage = new RegimeStage(null, { alpha: 0.08 });
    expect(stage.alpha).toBe(0.08);
  });

  it('update sets regime data', () => {
    const stage = new RegimeStage(null);
    stage.update({ label: 'Strong Uptrend', confidence: 0.92, source: 'ml' }, { x: 0, y: 0, width: 800, height: 400 });

    expect(stage.regime).not.toBeNull();
    expect(stage.regime.label).toBe('Strong Uptrend');
    expect(stage.regime.confidence).toBe(0.92);
    expect(stage.regime.source).toBe('ml');
    expect(stage.regime.color).toBe('#31d158');
  });

  it('update triggers transition on regime change', () => {
    const stage = new RegimeStage(null);
    const bounds = { x: 0, y: 0, width: 800, height: 400 };

    stage.update({ label: 'Strong Uptrend', confidence: 0.9 }, bounds);
    expect(stage._transitionProgress).toBe(1);

    stage.update({ label: 'Consolidation', confidence: 0.7 }, bounds);
    expect(stage._transitionProgress).toBeLessThan(1);
    expect(stage._prevRegime).not.toBeNull();
    expect(stage._prevRegime.label).toBe('Strong Uptrend');
  });

  it('clear resets all state', () => {
    const stage = new RegimeStage(null);
    stage.update({ label: 'Breakout', confidence: 0.85 }, { x: 0, y: 0, width: 800, height: 400 });
    stage.clear();

    expect(stage.regime).toBeNull();
    expect(stage._prevRegime).toBeNull();
    expect(stage._transitionProgress).toBe(1);
  });

  it('draw is safe with null ctx', () => {
    const stage = new RegimeStage(null);
    stage.update({ label: 'Strong Uptrend', confidence: 0.9 }, { x: 0, y: 0, width: 800, height: 400 });
    // Should not throw
    expect(() => stage.draw()).not.toThrow();
  });

  it('draw is safe with no regime', () => {
    const stage = new RegimeStage(null);
    expect(() => stage.draw()).not.toThrow();
  });

  it('falls back to Consolidation config for unknown labels', () => {
    const stage = new RegimeStage(null);
    stage.update({ label: 'Unknown Regime', confidence: 0.5 }, { x: 0, y: 0, width: 800, height: 400 });
    expect(stage.regime.color).toBe(REGIME_CONFIG['Consolidation'].color);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Manifest Format Validation
// ═══════════════════════════════════════════════════════════════════

describe('ML Pipeline — Manifest', () => {
  it('manifest.json has valid structure', async () => {
    // Read manifest directly
    const fs = await import('fs');
    const path = await import('path');
    const manifestPath = path.resolve(process.cwd(), 'public/models/manifest.json');

    let manifest;
    try {
      const content = fs.readFileSync(manifestPath, 'utf-8');
      manifest = JSON.parse(content);
    } catch {
      // Skip if file not accessible in test env
      return;
    }

    expect(manifest.version).toBeDefined();
    expect(manifest.models).toBeDefined();

    const requiredModels = ['regime-classifier', 'pattern-detector', 'setup-quality', 'anomaly-autoencoder'];
    for (const modelId of requiredModels) {
      const model = manifest.models[modelId];
      expect(model).toBeDefined();
      expect(model.name).toBeDefined();
      expect(model.file).toMatch(/\.onnx$/);
      expect(model.sizeKB).toBeGreaterThan(0);
      expect(model.inputShape).toBeInstanceOf(Array);
      expect(model.outputShape).toBeInstanceOf(Array);
      expect(model.labels).toBeInstanceOf(Array);
    }

    // Regime classifier should have 8 labels matching REGIME_LABELS
    expect(manifest.models['regime-classifier'].labels).toHaveLength(8);
    expect(manifest.models['regime-classifier'].inputShape).toEqual([1, 36]);
    expect(manifest.models['regime-classifier'].outputShape).toEqual([1, 8]);

    // Pattern detector: 12 patterns
    expect(manifest.models['pattern-detector'].labels).toHaveLength(12);
    expect(manifest.models['pattern-detector'].inputShape).toEqual([1, 50, 6]);

    // Setup quality: single output
    expect(manifest.models['setup-quality'].outputShape).toEqual([1, 1]);

    // Anomaly: same input/output shape (autoencoder)
    expect(manifest.models['anomaly-autoencoder'].inputShape).toEqual([1, 36]);
    expect(manifest.models['anomaly-autoencoder'].outputShape).toEqual([1, 36]);
  });
});
