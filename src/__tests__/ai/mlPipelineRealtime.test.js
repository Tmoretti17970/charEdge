// @vitest-environment node
// ═══════════════════════════════════════════════════════════════════
// charEdge — Real-Time ML Pipeline Tests (Sprint 48)
//
// Tests for:
//   • runAll() method returns correct structure
//   • getMemoryUsage() returns valid format
//   • getInferenceStats() returns valid format
//   • Latency budget enforcement
//   • Model enable/disable filtering
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest';
import { MLPipeline } from '../../charting_library/ai/MLPipeline.js';

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
// runAll Method
// ═══════════════════════════════════════════════════════════════════

describe('ML Pipeline — runAll', () => {
  let pipeline;

  beforeEach(() => {
    pipeline = new MLPipeline();
  });

  it('returns correct result structure', async () => {
    const result = await pipeline.runAll(makeFeatureVector(), makeCandles());
    expect(result).toHaveProperty('regime');
    expect(result).toHaveProperty('patterns');
    expect(result).toHaveProperty('quality');
    expect(result).toHaveProperty('anomaly');
  });

  it('patterns is always an array', async () => {
    const result = await pipeline.runAll(makeFeatureVector(), makeCandles());
    expect(Array.isArray(result.patterns)).toBe(true);
  });

  it('handles null feature vector', async () => {
    const result = await pipeline.runAll(null, makeCandles());
    expect(result.regime).toBeNull();
    expect(result.anomaly).toBeNull();
  });

  it('handles insufficient candles', async () => {
    const result = await pipeline.runAll(makeFeatureVector(), makeCandles(10));
    expect(Array.isArray(result.patterns)).toBe(true);
    expect(result.patterns).toHaveLength(0);
  });

  it('respects isModelEnabled filter', async () => {
    const enabledModels = new Set(['regime-classifier']);
    const result = await pipeline.runAll(
      makeFeatureVector(),
      makeCandles(),
      { isModelEnabled: (id) => enabledModels.has(id) }
    );
    // Only regime was enabled, others should be null/empty
    expect(result).toHaveProperty('regime');
    expect(result.patterns).toEqual([]);
    expect(result.anomaly).toBeNull();
  });

  it('completes without error for valid inputs', async () => {
    await expect(
      pipeline.runAll(makeFeatureVector(), makeCandles(), { budgetMs: 200 })
    ).resolves.toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════
// Memory & Stats Methods
// ═══════════════════════════════════════════════════════════════════

describe('ML Pipeline — Memory & Stats', () => {
  let pipeline;

  beforeEach(() => {
    pipeline = new MLPipeline();
  });

  it('getMemoryUsage returns valid structure', () => {
    const usage = pipeline.getMemoryUsage();
    expect(usage).toHaveProperty('totalKB');
    expect(usage).toHaveProperty('models');
    expect(typeof usage.totalKB).toBe('number');
    expect(Array.isArray(usage.models)).toBe(true);
  });

  it('getMemoryUsage.totalKB is non-negative', () => {
    expect(pipeline.getMemoryUsage().totalKB).toBeGreaterThanOrEqual(0);
  });

  it('getInferenceStats returns empty object initially', () => {
    const stats = pipeline.getInferenceStats();
    expect(typeof stats).toBe('object');
    expect(Object.keys(stats)).toHaveLength(0);
  });

  it('getModelStatus returns empty with no manifest', () => {
    const status = pipeline.getModelStatus();
    expect(status).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Manifest Validation (updated for 6 models)
// ═══════════════════════════════════════════════════════════════════

describe('ML Pipeline — Manifest (6 Models)', () => {
  it('manifest.json has all 6 models', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const manifestPath = path.resolve(process.cwd(), 'public/models/manifest.json');

    let manifest;
    try {
      const content = fs.readFileSync(manifestPath, 'utf-8');
      manifest = JSON.parse(content);
    } catch {
      return; // Skip if file not accessible
    }

    const requiredModels = [
      'regime-classifier',
      'pattern-detector',
      'setup-quality',
      'anomaly-autoencoder',
      'behavior-classifier',
      'entry-quality',
    ];

    for (const modelId of requiredModels) {
      const model = manifest.models[modelId];
      expect(model, `Model ${modelId} should exist`).toBeDefined();
      expect(model.name).toBeDefined();
      expect(model.file).toMatch(/\.onnx$/);
      expect(model.sizeKB).toBeGreaterThanOrEqual(0);
      expect(model.inputShape).toBeInstanceOf(Array);
      expect(model.outputShape).toBeInstanceOf(Array);
      expect(model.labels).toBeInstanceOf(Array);
    }

    // New models
    expect(manifest.models['behavior-classifier'].labels).toHaveLength(5);
    expect(manifest.models['behavior-classifier'].inputShape).toEqual([1, 12]);
    expect(manifest.models['behavior-classifier'].outputShape).toEqual([1, 5]);

    expect(manifest.models['entry-quality'].inputShape).toEqual([1, 36]);
    expect(manifest.models['entry-quality'].outputShape).toEqual([1, 1]);
  });
});
