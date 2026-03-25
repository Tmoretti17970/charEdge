// ═══════════════════════════════════════════════════════════════════
// charEdge — Journal RAG Pipeline (AI Copilot Sprint 3)
//
// Retrieval-Augmented Generation over the user's trade journal.
// Vectorizes trades/notes, stores in VectorStore, and enables
// semantic search for contextual AI responses.
//
// "What did I do last time BTC was consolidating?"
// → Embeds query → searches VectorStore → returns relevant trades
// → injects as context into LLM prompt
//
// Usage:
//   import { journalRAG } from './JournalRAG';
//   await journalRAG.indexAllTrades(trades);
//   const context = await journalRAG.query('How do I handle breakouts?');
// ═══════════════════════════════════════════════════════════════════

import { vectorStore } from './VectorStore';
import { bm25Search } from './BM25Search';

// ─── Types ──────────────────────────────────────────────────────

export interface RAGResult {
  context: string; // Formatted context string for LLM
  sources: RAGSource[]; // The matching trades/entries
  queryTime: number; // ms
}

export interface RAGSource {
  id: string;
  text: string;
  similarity: number;
  metadata: Record<string, unknown>;
}

export interface IndexStats {
  totalIndexed: number;
  lastIndexedAt: number;
  pendingCount: number;
}

interface TradeLike {
  id?: string;
  symbol?: string;
  side?: string;
  pnl?: number;
  entryDate?: string;
  exitDate?: string;
  date?: string;
  entryTime?: string | number;
  entryPrice?: number;
  exitPrice?: number;
  setup?: string;
  setupType?: string;
  strategy?: string;
  emotion?: string;
  notes?: string;
  qty?: number;
  quantity?: number;
  holdMinutes?: number;
  holdDuration?: number;
  tags?: string[];
  [key: string]: unknown;
}

// ─── Constants ──────────────────────────────────────────────────

const BATCH_DELAY_MS = 30; // Delay between batch embeddings to avoid blocking

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ─── RAG Class ──────────────────────────────────────────────────

export class JournalRAG {
  private _lastIndexedAt = 0;
  private _indexing = false;
  private _embedFn: ((text: string) => Promise<number[]>) | null = null;
  private _searchMode: 'semantic' | 'keyword' | 'none' = 'none';

  /**
   * Set the embedding function (injected to avoid circular deps).
   * Should be called once at boot with LocalEmbeddingModel or EmbeddingService.
   */
  setEmbedFunction(fn: (text: string) => Promise<number[]>): void {
    this._embedFn = fn;
  }

  /**
   * Index all trades from the journal. Runs in background, batched.
   * Skips trades already indexed.
   */
  async indexAllTrades(trades: TradeLike[]): Promise<number> {
    if (this._indexing) return 0;
    this._indexing = true;

    let indexed = 0;

    try {
      const embed = await this._getEmbedFn();
      const closedTrades = trades.filter((t) => typeof t.pnl === 'number' && !isNaN(t.pnl) && t.id);

      for (const trade of closedTrades) {
        const id = `trade-${trade.id}`;

        // Skip already indexed
        if (await vectorStore.isIndexed(id)) continue;

        const text = tradeToText(trade);
        if (text.length < 10) continue;

        try {
          const meta = {
            tradeId: trade.id,
            symbol: trade.symbol,
            pnl: trade.pnl,
            side: trade.side,
            setup: trade.setup || trade.setupType || trade.strategy,
            emotion: trade.emotion,
          };

          // Always index in BM25 (instant, no model needed)
          bm25Search.index(id, text, meta);

          // Also index in vector store if embeddings available
          const vector = await embed(text);
          if (vector.length > 0) {
            await vectorStore.upsert(id, vector, text, meta);
          }
          indexed++;
        } catch {
          // Skip this trade, continue with others
        }

        // Small delay to avoid blocking
        if (indexed % 5 === 0) {
          await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
        }
      }

      this._lastIndexedAt = Date.now();
    } finally {
      this._indexing = false;
    }

    return indexed;
  }

  /**
   * Index a single trade (called when a trade is added/updated).
   */
  async indexEntry(trade: TradeLike): Promise<boolean> {
    if (!trade.id || typeof trade.pnl !== 'number') return false;

    const embed = await this._getEmbedFn();
    const text = tradeToText(trade);
    if (text.length < 10) return false;

    try {
      const vector = await embed(text);
      if (vector.length === 0) return false;

      await vectorStore.upsert(`trade-${trade.id}`, vector, text, {
        tradeId: trade.id,
        symbol: trade.symbol,
        pnl: trade.pnl,
        side: trade.side,
        setup: trade.setup || trade.setupType || trade.strategy,
        emotion: trade.emotion,
      });

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Semantic search across the journal.
   * Returns formatted context string + source references.
   */
  async query(question: string, topK = 5): Promise<RAGResult> {
    const start = performance.now();

    // Try semantic search first
    try {
      const embed = await this._getEmbedFn();
      const queryVector = await embed(question);

      if (queryVector.length > 0) {
        const results = await vectorStore.search(queryVector, topK, 0.35);

        if (results.length > 0) {
          this._searchMode = 'semantic';
          const sources: RAGSource[] = results.map((r) => ({
            id: r.entry.id,
            text: r.entry.text,
            similarity: Math.round(r.similarity * 100) / 100,
            metadata: r.entry.metadata,
          }));
          return {
            context: this._formatContext(sources),
            sources,
            queryTime: Math.round(performance.now() - start),
          };
        }
      }
    } catch {
      /* fall through to BM25 */
    }

    // BM25 keyword fallback
    try {
      const bm25Results = bm25Search.search(question, topK);
      if (bm25Results.length > 0) {
        this._searchMode = 'keyword';
        const sources: RAGSource[] = bm25Results.map((r) => ({
          id: r.id,
          text: r.text,
          similarity: Math.min(r.score / 5, 1), // Normalize BM25 scores to 0-1 range
          metadata: r.metadata,
        }));
        return {
          context: this._formatContext(sources),
          sources,
          queryTime: Math.round(performance.now() - start),
        };
      }
    } catch {
      /* non-critical */
    }

    this._searchMode = 'none';
    return { context: '', sources: [], queryTime: performance.now() - start };
  }

  /**
   * Ready-to-inject context string for LLM system prompt.
   */
  async getContextForPrompt(question: string, topK = 3): Promise<string> {
    const result = await this.query(question, topK);
    if (!result.context) return '';

    return `--- Relevant Past Trades ---\n${result.context}`;
  }

  /**
   * Get indexing statistics.
   */
  async getIndexStats(): Promise<IndexStats> {
    const totalIndexed = await vectorStore.count();
    return {
      totalIndexed,
      lastIndexedAt: this._lastIndexedAt,
      pendingCount: 0, // Could compare against journal store count
    };
  }

  /** Is currently indexing? */
  get isIndexing(): boolean {
    return this._indexing;
  }

  /**
   * Get current search mode for UI indicator (Task #19).
   * 'semantic' = ONNX/Gemini embeddings, 'keyword' = BM25 fallback, 'none' = no search yet.
   */
  get searchMode(): 'semantic' | 'keyword' | 'none' {
    return this._searchMode;
  }

  // ── Formatting ──────────────────────────────────────────────

  private _formatContext(sources: RAGSource[]): string {
    if (sources.length === 0) return '';

    return sources
      .map((s, i) => {
        const sim = (s.similarity * 100).toFixed(0);
        return `${i + 1}. [${sim}% match] ${s.text}`;
      })
      .join('\n\n');
  }

  // ── Embedding ───────────────────────────────────────────────

  private async _getEmbedFn(): Promise<(text: string) => Promise<number[]>> {
    if (this._embedFn) return this._embedFn;

    // Auto-discover: try LocalEmbeddingModel first, fallback to EmbeddingService
    try {
      const { localEmbeddingModel } = await import('./LocalEmbeddingModel');
      if (await localEmbeddingModel.isAvailable()) {
        this._embedFn = async (text: string) => {
          const result = await localEmbeddingModel.embed(text);
          return result.vector;
        };
        return this._embedFn;
      }
    } catch {
      /* not available */
    }

    // Fallback to Gemini API
    try {
      const { embeddingService } = await import('./EmbeddingService');
      this._embedFn = (text: string) => embeddingService.embed(text);
      return this._embedFn;
    } catch {
      /* not available */
    }

    // Last resort: return zero vector (RAG won't work but won't crash)
    this._embedFn = async () => [];
    return this._embedFn;
  }
}

// ─── Trade → Text Converter ─────────────────────────────────────

export function tradeToText(trade: TradeLike): string {
  const parts: string[] = [];

  // Side + Symbol
  const side =
    String(trade.side || '')
      .charAt(0)
      .toUpperCase() +
    String(trade.side || '')
      .slice(1)
      .toLowerCase();
  const symbol = String(trade.symbol || 'Unknown').toUpperCase();
  parts.push(`${side || 'Trade'} ${symbol}`);

  // Setup type
  const setup = trade.setup || trade.setupType || trade.strategy;
  if (setup) parts.push(String(setup).toLowerCase());

  // Timing
  const d = getDate(trade);
  if (d) {
    const dayName = DAY_NAMES[d.getDay()] || '';
    const hour = d.getHours();
    const min = String(d.getMinutes()).padStart(2, '0');
    const ampm = hour >= 12 ? 'pm' : 'am';
    const h12 = hour % 12 || 12;
    parts.push(`on ${dayName} ${h12}:${min}${ampm}`);
  }

  // Hold time
  const holdMins = getHoldMinutes(trade);
  if (holdMins > 0) {
    if (holdMins < 60) {
      parts.push(`held ${Math.round(holdMins)}min`);
    } else if (holdMins < 1440) {
      parts.push(`held ${(holdMins / 60).toFixed(1)}h`);
    } else {
      parts.push(`held ${Math.round(holdMins / 1440)}d`);
    }
  }

  // Outcome
  const pnl = trade.pnl as number;
  if (pnl > 0) {
    parts.push(`won +$${pnl.toFixed(2)}`);
  } else if (pnl < 0) {
    parts.push(`lost -$${Math.abs(pnl).toFixed(2)}`);
  } else {
    parts.push('breakeven');
  }

  // Emotion
  if (trade.emotion) {
    parts.push(`emotion: ${String(trade.emotion).toLowerCase()}`);
  }

  // Notes
  if (trade.notes && String(trade.notes).length > 5) {
    const notes = String(trade.notes).slice(0, 150).trim();
    parts.push(`notes: ${notes}`);
  }

  // Tags
  if (trade.tags && Array.isArray(trade.tags) && trade.tags.length > 0) {
    parts.push(`tags: ${trade.tags.join(', ')}`);
  }

  return parts.join('. ') + '.';
}

// ─── Helpers ──────────────────────────────────────────────────────

function getDate(t: TradeLike): Date | null {
  const raw = t.entryDate || t.date || t.entryTime;
  if (!raw) return null;
  const d = new Date(raw as string | number);
  return isNaN(d.getTime()) ? null : d;
}

function getHoldMinutes(t: TradeLike): number {
  if (typeof t.holdMinutes === 'number' && t.holdMinutes > 0) return t.holdMinutes;
  if (typeof t.holdDuration === 'number' && t.holdDuration > 0) return t.holdDuration / 60000;

  const entry = t.entryDate || t.date || t.entryTime;
  const exit = t.exitDate;
  if (entry && exit) {
    const entryMs = new Date(entry as string | number).getTime();
    const exitMs = new Date(exit as string).getTime();
    if (!isNaN(entryMs) && !isNaN(exitMs) && exitMs > entryMs) {
      return (exitMs - entryMs) / 60000;
    }
  }

  return 0;
}

// ─── Singleton ──────────────────────────────────────────────────

export const journalRAG = new JournalRAG();
export default journalRAG;
