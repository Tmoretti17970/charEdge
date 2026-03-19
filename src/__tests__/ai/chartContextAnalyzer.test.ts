// ═══════════════════════════════════════════════════════════════════
// charEdge — ChartContextAnalyzer Tests (Sprint 21)
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { chartContextAnalyzer } from '../../ai/ChartContextAnalyzer';
import type { ExtendedChartContext } from '../../ai/ChartContextAnalyzer';

// ─── Helper ─────────────────────────────────────────────────────

function makeCtx(overrides: Partial<ExtendedChartContext> = {}): ExtendedChartContext {
  return {
    symbol: 'BTC',
    timeframe: '4H',
    price: 65000,
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────

describe('ChartContextAnalyzer', () => {
  describe('Bias detection', () => {
    it('returns bullish bias when price is well above 200 EMA with aligned stack', () => {
      const ctx = makeCtx({ price: 65000, ema20: 64000, ema50: 62000, ema200: 58000 });
      const result = chartContextAnalyzer.analyze(ctx);
      expect(result.bias).toBe('bullish');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('returns bearish bias when price is well below 200 EMA with aligned stack', () => {
      const ctx = makeCtx({ price: 50000, ema20: 52000, ema50: 55000, ema200: 60000 });
      const result = chartContextAnalyzer.analyze(ctx);
      expect(result.bias).toBe('bearish');
    });

    it('returns neutral when no strong directional signals', () => {
      const ctx = makeCtx({ price: 65000, rsi: 50 });
      const result = chartContextAnalyzer.analyze(ctx);
      expect(result.bias).toBe('neutral');
    });

    it('handles minimal context (symbol + price only)', () => {
      const ctx = makeCtx();
      const result = chartContextAnalyzer.analyze(ctx);
      expect(result.symbol).toBe('BTC');
      expect(result.timeframe).toBe('4H');
      expect(result.bias).toBeDefined();
      expect(result.summary).toContain('BTC');
    });
  });

  describe('RSI signals', () => {
    it('flags overbought when RSI > 70', () => {
      const ctx = makeCtx({ rsi: 75 });
      const result = chartContextAnalyzer.analyze(ctx);
      const rsiSignal = result.signals.find(s => s.label.includes('Overbought'));
      expect(rsiSignal).toBeDefined();
      expect(rsiSignal!.bias).toBe('bearish');
    });

    it('flags extreme overbought when RSI > 80', () => {
      const ctx = makeCtx({ rsi: 85 });
      const result = chartContextAnalyzer.analyze(ctx);
      const rsiSignal = result.signals.find(s => s.label.includes('Extremely Overbought'));
      expect(rsiSignal).toBeDefined();
      expect(rsiSignal!.strength).toBe('strong');
      expect(result.riskNote).toContain('overbought');
    });

    it('flags oversold when RSI < 30', () => {
      const ctx = makeCtx({ rsi: 25 });
      const result = chartContextAnalyzer.analyze(ctx);
      const rsiSignal = result.signals.find(s => s.label.includes('Oversold'));
      expect(rsiSignal).toBeDefined();
      expect(rsiSignal!.bias).toBe('bullish');
    });

    it('flags neutral when RSI is mid-range', () => {
      const ctx = makeCtx({ rsi: 50 });
      const result = chartContextAnalyzer.analyze(ctx);
      const rsiSignal = result.signals.find(s => s.label.includes('Neutral'));
      expect(rsiSignal).toBeDefined();
    });
  });

  describe('Confluence scoring', () => {
    it('scores higher with multiple aligned bullish signals', () => {
      const bullish = makeCtx({
        price: 65000, ema20: 64000, ema50: 62000, ema200: 58000,
        rsi: 25, regime: 'trending',
      });
      const neutral = makeCtx({ price: 65000, rsi: 50 });

      const bullishResult = chartContextAnalyzer.analyze(bullish);
      const neutralResult = chartContextAnalyzer.analyze(neutral);

      expect(bullishResult.confluenceScore).toBeGreaterThan(neutralResult.confluenceScore);
    });

    it('confluence is 0-10 range', () => {
      const ctx = makeCtx({ price: 65000, ema200: 58000, rsi: 25, regime: 'trending' });
      const result = chartContextAnalyzer.analyze(ctx);
      expect(result.confluenceScore).toBeGreaterThanOrEqual(0);
      expect(result.confluenceScore).toBeLessThanOrEqual(10);
    });
  });

  describe('Summary generation', () => {
    it('includes symbol and timeframe in summary', () => {
      const result = chartContextAnalyzer.analyze(makeCtx());
      expect(result.summary).toContain('BTC');
      expect(result.summary).toContain('4H');
    });

    it('includes bias label in summary', () => {
      const result = chartContextAnalyzer.analyze(makeCtx({ price: 65000, ema200: 58000 }));
      expect(result.summary).toMatch(/Bullish|Bearish|Neutral/);
    });

    it('includes key levels when EMAs present', () => {
      const ctx = makeCtx({ price: 65000, ema200: 58000 });
      const result = chartContextAnalyzer.analyze(ctx);
      expect(result.keyLevels.length).toBeGreaterThan(0);
      expect(result.summary).toContain('Key levels');
    });

    it('includes risk note in summary when present', () => {
      const ctx = makeCtx({ rsi: 85 });
      const result = chartContextAnalyzer.analyze(ctx);
      expect(result.riskNote).toBeTruthy();
      expect(result.summary).toContain('⚠️');
    });
  });

  describe('Volume analysis', () => {
    it('detects volume climax', () => {
      const ctx = makeCtx({ volumeRatio: 3.0 });
      const result = chartContextAnalyzer.analyze(ctx);
      const volSignal = result.signals.find(s => s.label.includes('Climax'));
      expect(volSignal).toBeDefined();
    });

    it('detects low volume', () => {
      const ctx = makeCtx({ volumeRatio: 0.3 });
      const result = chartContextAnalyzer.analyze(ctx);
      const volSignal = result.signals.find(s => s.label.includes('Low Volume'));
      expect(volSignal).toBeDefined();
    });
  });

  describe('quickBias', () => {
    it('returns a bias string', () => {
      const bias = chartContextAnalyzer.quickBias(makeCtx());
      expect(['bullish', 'bearish', 'neutral']).toContain(bias);
    });
  });
});
