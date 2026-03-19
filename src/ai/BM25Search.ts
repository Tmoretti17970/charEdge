// ═══════════════════════════════════════════════════════════════════
// charEdge — BM25 Keyword Search (Phase 2 Task #18)
//
// Pure in-browser BM25 implementation for journal search fallback.
// Used when neither ONNX local embeddings nor Gemini API are
// available — produces meaningful relevance scores from keyword
// overlap instead of random hash-based vectors.
//
// BM25 parameters: k1=1.2, b=0.75 (standard IR defaults)
//
// Usage:
//   import { bm25Search } from './BM25Search';
//   bm25Search.index('trade-1', 'Long BTC breakout won +$500', { pnl: 500 });
//   const results = bm25Search.search('breakout trades', 5);
// ═══════════════════════════════════════════════════════════════════

// ─── Types ───────────────────────────────────────────────────────

export interface BM25Document {
  id: string;
  text: string;
  metadata: Record<string, unknown>;
  termFreqs: Map<string, number>;
  tokenCount: number;
}

export interface BM25Result {
  id: string;
  text: string;
  score: number;
  metadata: Record<string, unknown>;
}

// ─── Stop Words ──────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'it', 'in', 'on', 'at', 'to', 'of',
  'for', 'and', 'or', 'but', 'not', 'with', 'was', 'were', 'be',
  'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
  'will', 'would', 'could', 'should', 'may', 'might', 'can',
  'this', 'that', 'these', 'those', 'i', 'me', 'my', 'we', 'our',
  'you', 'your', 'he', 'she', 'his', 'her', 'they', 'them',
  'their', 'what', 'which', 'who', 'whom', 'when', 'where', 'how',
  'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
  'some', 'such', 'no', 'nor', 'only', 'own', 'same', 'so',
  'than', 'too', 'very', 'just', 'about', 'above', 'after',
  'before', 'between', 'from', 'up', 'out', 'off', 'over',
  'under', 'again', 'further', 'then', 'once',
]);

// ─── BM25 Class ─────────────────────────────────────────────────

class BM25Search {
  private _docs: Map<string, BM25Document> = new Map();
  private _docFreqs: Map<string, number> = new Map(); // term → # docs containing it
  private _avgDocLen = 0;

  // BM25 tuning parameters
  private readonly _k1 = 1.2;
  private readonly _b = 0.75;

  /**
   * Index a document (trade text).
   */
  index(id: string, text: string, metadata: Record<string, unknown> = {}): void {
    // Remove old version if re-indexing
    if (this._docs.has(id)) {
      this._removeDocFreqs(this._docs.get(id)!);
    }

    const tokens = tokenize(text);
    const termFreqs = new Map<string, number>();

    for (const token of tokens) {
      termFreqs.set(token, (termFreqs.get(token) || 0) + 1);
    }

    const doc: BM25Document = { id, text, metadata, termFreqs, tokenCount: tokens.length };
    this._docs.set(id, doc);

    // Update document frequencies
    for (const term of termFreqs.keys()) {
      this._docFreqs.set(term, (this._docFreqs.get(term) || 0) + 1);
    }

    this._updateAvgDocLen();
  }

  /**
   * Bulk index multiple documents.
   */
  indexAll(items: Array<{ id: string; text: string; metadata?: Record<string, unknown> }>): void {
    for (const item of items) {
      this.index(item.id, item.text, item.metadata || {});
    }
  }

  /**
   * Search for documents matching the query.
   */
  search(query: string, topK = 5): BM25Result[] {
    if (this._docs.size === 0) return [];

    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) return [];

    const N = this._docs.size;
    const scores: Array<{ id: string; score: number }> = [];

    for (const [id, doc] of this._docs) {
      let score = 0;

      for (const qt of queryTokens) {
        const tf = doc.termFreqs.get(qt) || 0;
        if (tf === 0) continue;

        const df = this._docFreqs.get(qt) || 0;

        // IDF: log((N - df + 0.5) / (df + 0.5) + 1)
        const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);

        // TF normalization: (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * docLen / avgDocLen))
        const tfNorm = (tf * (this._k1 + 1)) /
          (tf + this._k1 * (1 - this._b + this._b * doc.tokenCount / (this._avgDocLen || 1)));

        score += idf * tfNorm;
      }

      if (score > 0) {
        scores.push({ id, score });
      }
    }

    // Sort by score descending, take topK
    scores.sort((a, b) => b.score - a.score);

    return scores.slice(0, topK).map(s => {
      const doc = this._docs.get(s.id)!;
      return {
        id: s.id,
        text: doc.text,
        score: Math.round(s.score * 1000) / 1000,
        metadata: doc.metadata,
      };
    });
  }

  /**
   * Check if a document is indexed.
   */
  isIndexed(id: string): boolean {
    return this._docs.has(id);
  }

  /**
   * Remove a document.
   */
  remove(id: string): void {
    const doc = this._docs.get(id);
    if (!doc) return;
    this._removeDocFreqs(doc);
    this._docs.delete(id);
    this._updateAvgDocLen();
  }

  /**
   * Get total number of indexed documents.
   */
  get count(): number {
    return this._docs.size;
  }

  /**
   * Clear all indexed documents.
   */
  clear(): void {
    this._docs.clear();
    this._docFreqs.clear();
    this._avgDocLen = 0;
  }

  // ── Internal ────────────────────────────────────────────────

  private _removeDocFreqs(doc: BM25Document): void {
    for (const term of doc.termFreqs.keys()) {
      const count = this._docFreqs.get(term) || 0;
      if (count <= 1) {
        this._docFreqs.delete(term);
      } else {
        this._docFreqs.set(term, count - 1);
      }
    }
  }

  private _updateAvgDocLen(): void {
    if (this._docs.size === 0) {
      this._avgDocLen = 0;
      return;
    }
    let total = 0;
    for (const doc of this._docs.values()) {
      total += doc.tokenCount;
    }
    this._avgDocLen = total / this._docs.size;
  }
}

// ─── Tokenizer ──────────────────────────────────────────────────

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9$%+\-./\s]/g, ' ')  // Keep $ % + - . / for trading terms
    .split(/\s+/)
    .filter(w => w.length >= 2 && !STOP_WORDS.has(w));
}

// ─── Singleton ──────────────────────────────────────────────────

export const bm25Search = new BM25Search();
export default bm25Search;
