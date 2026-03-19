// ═══════════════════════════════════════════════════════════════════
// charEdge — JournalRAG + VectorStore Tests (AI Copilot Sprint 3)
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock VectorStore with in-memory implementation before imports
vi.mock('../ai/VectorStore', async (importOriginal) => {
  const orig = await importOriginal() as Record<string, unknown>;

  // In-memory store
  const entries = new Map<string, { id: string; vector: number[]; text: string; metadata: Record<string, unknown> }>();
  const cos = orig.cosineSimilarity as (a: number[], b: number[]) => number;

  return {
    ...orig,
    vectorStore: {
      upsert: async (id: string, vector: number[], text: string, metadata: Record<string, unknown> = {}) => {
        entries.set(id, { id, vector, text, metadata });
      },
      search: async (queryVector: number[], topK = 5, minSimilarity = 0.3) => {
        return [...entries.values()]
          .map(entry => ({ entry, similarity: cos(queryVector, entry.vector) }))
          .filter(r => r.similarity >= minSimilarity)
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, topK);
      },
      isIndexed: async (id: string) => entries.has(id),
      count: async () => entries.size,
      clear: async () => entries.clear(),
      remove: async (id: string) => entries.delete(id),
    },
  };
});

import { cosineSimilarity } from '../ai/VectorStore';
import { JournalRAG, tradeToText } from '../ai/JournalRAG';

// ─── VectorStore Math Tests ─────────────────────────────────────

describe('VectorStore - cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    const v = [1, 2, 3, 4, 5];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0, 4);
  });

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0.0, 4);
  });

  it('handles empty vectors', () => {
    expect(cosineSimilarity([], [])).toBe(0);
    expect(cosineSimilarity([1], [])).toBe(0);
  });

  it('returns high value for similar vectors', () => {
    const sim = cosineSimilarity([1, 2, 3], [1.1, 2.1, 3.1]);
    expect(sim).toBeGreaterThan(0.99);
  });

  it('returns low value for dissimilar vectors', () => {
    const sim = cosineSimilarity([1, 0, 0], [0, 0, 1]);
    expect(sim).toBeCloseTo(0.0, 2);
  });
});

// ─── tradeToText Tests ──────────────────────────────────────────

describe('tradeToText', () => {
  it('converts a winning trade to natural language', () => {
    const text = tradeToText({
      symbol: 'BTCUSDT',
      side: 'long',
      pnl: 150.50,
      entryDate: '2024-01-15T10:30:00Z',
      setup: 'breakout',
      emotion: 'confident',
      notes: 'Clean level break with high volume',
    });

    expect(text).toContain('Long BTCUSDT');
    expect(text).toContain('breakout');
    expect(text).toContain('won +$150.50');
    expect(text).toContain('confident');
    expect(text).toContain('Clean level break');
  });

  it('converts a losing trade', () => {
    const text = tradeToText({
      symbol: 'ETHUSDT',
      side: 'short',
      pnl: -75.00,
      emotion: 'frustrated',
    });

    expect(text).toContain('Short ETHUSDT');
    expect(text).toContain('lost -$75.00');
    expect(text).toContain('frustrated');
  });

  it('handles breakeven trades', () => {
    const text = tradeToText({
      symbol: 'SOLUSDT',
      side: 'long',
      pnl: 0,
    });
    expect(text).toContain('breakeven');
  });

  it('includes hold time when available', () => {
    const text = tradeToText({
      symbol: 'BTCUSDT',
      side: 'long',
      pnl: 100,
      holdMinutes: 45,
    });
    expect(text).toContain('held 45min');
  });

  it('includes tags', () => {
    const text = tradeToText({
      symbol: 'BTCUSDT',
      side: 'long',
      pnl: 200,
      tags: ['momentum', 'scalp'],
    });
    expect(text).toContain('tags: momentum, scalp');
  });

  it('handles missing fields gracefully', () => {
    const text = tradeToText({ pnl: 50 });
    expect(text).toContain('Trade UNKNOWN');
    expect(text).toContain('won +$50.00');
  });
});

// ─── JournalRAG Tests ───────────────────────────────────────────

describe('JournalRAG', () => {
  let rag: JournalRAG;

  const mockEmbed = async (text: string): Promise<number[]> => {
    const vec = new Array(8).fill(0);
    for (let i = 0; i < text.length; i++) {
      vec[i % 8] += text.charCodeAt(i) / 1000;
    }
    const norm = Math.sqrt(vec.reduce((s: number, v: number) => s + v * v, 0));
    return norm > 0 ? vec.map((v: number) => v / norm) : vec;
  };

  beforeEach(async () => {
    const { vectorStore } = await import('../ai/VectorStore');
    await vectorStore.clear();
    rag = new JournalRAG();
    rag.setEmbedFunction(mockEmbed);
  });

  it('indexes trades and reports count', async () => {
    const trades = [
      { id: 'a1', symbol: 'BTCUSDT', side: 'long', pnl: 100, setup: 'breakout' },
      { id: 'a2', symbol: 'ETHUSDT', side: 'short', pnl: -50, setup: 'reversal' },
      { id: 'a3', symbol: 'SOLUSDT', side: 'long', pnl: 200, setup: 'breakout' },
    ];
    const count = await rag.indexAllTrades(trades);
    expect(count).toBe(3);
    const stats = await rag.getIndexStats();
    expect(stats.totalIndexed).toBe(3);
    expect(stats.lastIndexedAt).toBeGreaterThan(0);
  });

  it('skips trades without pnl', async () => {
    const count = await rag.indexAllTrades([
      { id: 'b1', symbol: 'A', side: 'long', pnl: 100 },
      { id: 'b2', symbol: 'B', side: 'long' },
    ] as any);
    expect(count).toBe(1);
  });

  it('query returns results with context', async () => {
    await rag.indexAllTrades([
      { id: 'c1', symbol: 'BTCUSDT', side: 'long', pnl: 300, setup: 'breakout', notes: 'BTC breakout trade with volume' },
      { id: 'c2', symbol: 'ETHUSDT', side: 'short', pnl: -50, setup: 'fade', notes: 'ETH fade at resistance failed' },
    ]);
    const result = await rag.query('BTC breakout', 5);
    expect(result.sources.length).toBeGreaterThan(0);
    expect(result.context.length).toBeGreaterThan(0);
    expect(result.queryTime).toBeGreaterThanOrEqual(0);
  });

  it('handles empty journal gracefully', async () => {
    const result = await rag.query('anything');
    expect(result.sources).toHaveLength(0);
    expect(result.context).toBe('');
  });

  it('indexEntry indexes a single trade', async () => {
    const ok = await rag.indexEntry({ id: 'e1', symbol: 'BTCUSDT', side: 'long', pnl: 500, setup: 'momentum' });
    expect(ok).toBe(true);
    const stats = await rag.getIndexStats();
    expect(stats.totalIndexed).toBe(1);
  });

  it('does not duplicate on re-index', async () => {
    const trades = [{ id: 'f1', symbol: 'BTCUSDT', side: 'long', pnl: 100 }];
    const count1 = await rag.indexAllTrades(trades);
    expect(count1).toBe(1);
    const count2 = await rag.indexAllTrades(trades);
    expect(count2).toBe(0);
    const stats = await rag.getIndexStats();
    expect(stats.totalIndexed).toBe(1);
  });
});
