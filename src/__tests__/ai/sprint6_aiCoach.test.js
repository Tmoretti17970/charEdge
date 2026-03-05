// ═══════════════════════════════════════════════════════════════════
// charEdge — Sprint 6 AI Coach Tests
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';

// ─── 6.1.1: LLMService ─────────────────────────────────────────

describe('6.1.1 — LLMService', () => {
    let llmService, OpenAIProvider, LocalProvider;

    it('imports and exports singleton', async () => {
        const mod = await import('../../charting_library/ai/LLMService.ts');
        llmService = mod.llmService;
        OpenAIProvider = mod.OpenAIProvider;
        LocalProvider = mod.LocalProvider;
        expect(llmService).toBeDefined();
        expect(OpenAIProvider).toBeDefined();
        expect(LocalProvider).toBeDefined();
    });

    it('has local provider registered by default', async () => {
        const mod = await import('../../charting_library/ai/LLMService.ts');
        expect(mod.llmService.getProviders()).toContain('local');
    });

    it('local provider always returns text', async () => {
        const mod = await import('../../charting_library/ai/LLMService.ts');
        const local = new mod.LocalProvider();
        const text = await local.complete('Test prompt');
        expect(typeof text).toBe('string');
        expect(text.length).toBeGreaterThan(0);
    });

    it('complete() returns LLMResponse with provider name', async () => {
        const mod = await import('../../charting_library/ai/LLMService.ts');
        const response = await mod.llmService.complete('Hello world');
        expect(response).toHaveProperty('text');
        expect(response).toHaveProperty('provider');
        expect(typeof response.text).toBe('string');
    });

    it('hasExternalProvider() returns false by default', async () => {
        const mod = await import('../../charting_library/ai/LLMService.ts');
        // Fresh service with only local provider
        expect(mod.llmService.hasExternalProvider()).toBe(false);
    });

    it('caches responses for repeated prompts', async () => {
        const mod = await import('../../charting_library/ai/LLMService.ts');
        const r1 = await mod.llmService.complete('Cache test prompt xyz');
        const r2 = await mod.llmService.complete('Cache test prompt xyz');
        expect(r2.cached).toBe(true);
        expect(r2.text).toBe(r1.text);
    });
});

// ─── 6.1.4: FeatureExtractor ────────────────────────────────────

describe('6.1.4 — FeatureExtractor', () => {
    let featureExtractor;

    const mockCandles = Array.from({ length: 30 }, (_, i) => ({
        time: Date.now() - (30 - i) * 60000,
        open: 100 + Math.sin(i) * 2,
        high: 102 + Math.sin(i) * 2,
        low: 98 + Math.sin(i) * 2,
        close: 101 + Math.cos(i) * 2,
        volume: 1000 + Math.random() * 500,
    }));

    it('imports FeatureExtractor', async () => {
        const mod = await import('../../charting_library/ai/FeatureExtractor.ts');
        featureExtractor = mod.featureExtractor;
        expect(featureExtractor).toBeDefined();
    });

    it('extracts complete feature set from candles', async () => {
        const mod = await import('../../charting_library/ai/FeatureExtractor.ts');
        const features = mod.featureExtractor.extract(mockCandles);

        expect(features).toHaveProperty('volatility');
        expect(features).toHaveProperty('momentum');
        expect(features).toHaveProperty('volume');
        expect(features).toHaveProperty('price');
        expect(features).toHaveProperty('vector');
        expect(features).toHaveProperty('timestamp');
    });

    it('vector is Float32Array with 18 features', async () => {
        const mod = await import('../../charting_library/ai/FeatureExtractor.ts');
        const features = mod.featureExtractor.extract(mockCandles);
        expect(features.vector).toBeInstanceOf(Float32Array);
        expect(features.vector.length).toBe(18);
    });

    it('all vector values are finite numbers', async () => {
        const mod = await import('../../charting_library/ai/FeatureExtractor.ts');
        const features = mod.featureExtractor.extract(mockCandles);
        for (let i = 0; i < features.vector.length; i++) {
            expect(Number.isFinite(features.vector[i])).toBe(true);
        }
    });

    it('volatility features are non-negative', async () => {
        const mod = await import('../../charting_library/ai/FeatureExtractor.ts');
        const features = mod.featureExtractor.extract(mockCandles);
        expect(features.volatility.atrRatio).toBeGreaterThanOrEqual(0);
        expect(features.volatility.bollingerWidth).toBeGreaterThanOrEqual(0);
        expect(features.volatility.highLowRange).toBeGreaterThanOrEqual(0);
    });

    it('buy pressure is between 0 and 1', async () => {
        const mod = await import('../../charting_library/ai/FeatureExtractor.ts');
        const features = mod.featureExtractor.extract(mockCandles);
        expect(features.volume.buyPressure).toBeGreaterThanOrEqual(0);
        expect(features.volume.buyPressure).toBeLessThanOrEqual(1);
    });

    it('extractMomentum returns momentum subset', async () => {
        const mod = await import('../../charting_library/ai/FeatureExtractor.ts');
        const momentum = mod.featureExtractor.extractMomentum(mockCandles);
        expect(momentum).toHaveProperty('rsi');
        expect(momentum).toHaveProperty('macdHistogram');
        expect(momentum).toHaveProperty('trendStrength');
    });

    it('handles indicator values when provided', async () => {
        const mod = await import('../../charting_library/ai/FeatureExtractor.ts');
        const features = mod.featureExtractor.extract(mockCandles, {
            rsi: 65,
            atr: 1.5,
            ema: 101,
            obv: 5000,
        });
        expect(features.momentum.rsi).toBe(65);
        expect(features.volatility.atrRatio).toBeGreaterThan(0);
    });
});

// ─── 6.1.5: AnomalyDetector ────────────────────────────────────

describe('6.1.5 — AnomalyDetector', () => {
    let anomalyDetector;

    // Normal candles with one spike
    const normalCandles = Array.from({ length: 40 }, (_, i) => ({
        time: Date.now() - (40 - i) * 60000,
        open: 100,
        high: 101,
        low: 99,
        close: 100 + (Math.random() - 0.5) * 0.5,
        volume: 1000,
    }));

    // Add a price spike
    const spikedCandles = [...normalCandles];
    spikedCandles[35] = { ...spikedCandles[35], close: 120, high: 121 };

    // Add a volume spike
    const volumeSpikedCandles = [...normalCandles];
    volumeSpikedCandles[35] = { ...volumeSpikedCandles[35], volume: 10000 };

    it('imports AnomalyDetector', async () => {
        const mod = await import('../../charting_library/ai/AnomalyDetector.ts');
        anomalyDetector = mod.anomalyDetector;
        expect(anomalyDetector).toBeDefined();
    });

    it('returns empty array for insufficient data', async () => {
        const mod = await import('../../charting_library/ai/AnomalyDetector.ts');
        const result = mod.anomalyDetector.detect([]);
        expect(result).toEqual([]);
    });

    it('detects price spikes', async () => {
        const mod = await import('../../charting_library/ai/AnomalyDetector.ts');
        const anomalies = mod.anomalyDetector.detect(spikedCandles);
        const priceSpikes = anomalies.filter(a => a.type === 'price_spike');
        expect(priceSpikes.length).toBeGreaterThan(0);
    });

    it('detects volume spikes', async () => {
        const mod = await import('../../charting_library/ai/AnomalyDetector.ts');
        const anomalies = mod.anomalyDetector.detect(volumeSpikedCandles);
        const volumeSpikes = anomalies.filter(a => a.type === 'volume_spike');
        expect(volumeSpikes.length).toBeGreaterThan(0);
    });

    it('anomalies have required fields', async () => {
        const mod = await import('../../charting_library/ai/AnomalyDetector.ts');
        const anomalies = mod.anomalyDetector.detect(spikedCandles);
        for (const a of anomalies) {
            expect(a).toHaveProperty('index');
            expect(a).toHaveProperty('type');
            expect(a).toHaveProperty('zScore');
            expect(a).toHaveProperty('severity');
            expect(a).toHaveProperty('description');
            expect(['low', 'medium', 'high']).toContain(a.severity);
        }
    });

    it('zScore utility works correctly', async () => {
        const mod = await import('../../charting_library/ai/AnomalyDetector.ts');
        const z = mod.anomalyDetector.zScore(10, [2, 3, 2, 3, 2, 3]);
        expect(z).toBeGreaterThan(2);
    });

    it('detectRecent filters to recent candles only', async () => {
        const mod = await import('../../charting_library/ai/AnomalyDetector.ts');
        const all = mod.anomalyDetector.detect(spikedCandles);
        const recent = mod.anomalyDetector.detectRecent(spikedCandles, 10);
        expect(recent.length).toBeLessThanOrEqual(all.length);
    });

    it('sorts anomalies by severity then z-score', async () => {
        const mod = await import('../../charting_library/ai/AnomalyDetector.ts');
        const anomalies = mod.anomalyDetector.detect(spikedCandles);
        if (anomalies.length > 1) {
            const severityOrder = { high: 0, medium: 1, low: 2 };
            for (let i = 1; i < anomalies.length; i++) {
                const prev = severityOrder[anomalies[i - 1].severity];
                const curr = severityOrder[anomalies[i].severity];
                expect(curr).toBeGreaterThanOrEqual(prev);
            }
        }
    });
});

// ─── 6.1.2 + 6.1.3: LLM Integration ───────────────────────────

describe('6.1.2 — JournalSummarizer LLM Integration', () => {
    it('exports summarizeWeekWithLLM', async () => {
        const mod = await import('../../charting_library/ai/JournalSummarizer.js');
        expect(mod.summarizeWeekWithLLM).toBeDefined();
        expect(typeof mod.summarizeWeekWithLLM).toBe('function');
    });

    it('still exports original summarizeWeek', async () => {
        const mod = await import('../../charting_library/ai/JournalSummarizer.js');
        expect(mod.summarizeWeek).toBeDefined();
    });

    it('summarizeWeekWithLLM falls back gracefully with no trades', async () => {
        const mod = await import('../../charting_library/ai/JournalSummarizer.js');
        const result = await mod.summarizeWeekWithLLM([], []);
        expect(result.tradeCount).toBe(0);
    });
});

describe('6.1.3 — PreTradeAnalyzer LLM Integration', () => {
    it('exports explainPattern', async () => {
        const mod = await import('../../charting_library/ai/PreTradeAnalyzer.js');
        expect(mod.explainPattern).toBeDefined();
        expect(typeof mod.explainPattern).toBe('function');
    });

    it('still exports original analyzePreTrade', async () => {
        const mod = await import('../../charting_library/ai/PreTradeAnalyzer.js');
        expect(mod.analyzePreTrade).toBeDefined();
    });

    it('explainPattern returns string (falls back to template)', async () => {
        const mod = await import('../../charting_library/ai/PreTradeAnalyzer.js');
        const result = await mod.explainPattern(
            { symbol: 'AAPL', side: 'long' },
            { winRate: 60, avgPnl: 50, sampleSize: 10 },
            'high',
        );
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
    });
});
