// ═══════════════════════════════════════════════════════════════════
// charEdge — Vector Store (AI Copilot Sprint 3)
//
// Generic IndexedDB-backed vector database for semantic search.
// Stores text embeddings and performs cosine similarity search.
// Used by JournalRAG (Sprint 3) and TradeSimilarityEngine (Sprint 27).
//
// Usage:
//   import { vectorStore } from './VectorStore';
//   await vectorStore.upsert('trade-123', vector, 'Long BTC breakout', { pnl: 100 });
//   const results = await vectorStore.search(queryVector, 5);
// ═══════════════════════════════════════════════════════════════════

// ─── Types ──────────────────────────────────────────────────────

export interface VectorEntry {
  id: string;
  vector: number[];
  text: string;
  metadata: Record<string, unknown>;
  indexedAt: number;
}

export interface VectorSearchResult {
  entry: VectorEntry;
  similarity: number;
}

// ─── Constants ──────────────────────────────────────────────────

const DB_NAME = 'charEdge-vectorstore';
const DB_VERSION = 1;
const STORE_NAME = 'vectors';
const DEFAULT_MIN_SIMILARITY = 0.3;

// ─── Store Class ────────────────────────────────────────────────

export class VectorStore {
  private _dbPromise: Promise<IDBDatabase> | null = null;

  /**
   * Store or update a vector entry.
   */
  async upsert(
    id: string,
    vector: number[],
    text: string,
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    const entry: VectorEntry = {
      id,
      vector,
      text,
      metadata,
      indexedAt: Date.now(),
    };

    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Cosine similarity search across all stored vectors.
   */
  async search(
    queryVector: number[],
    topK = 5,
    minSimilarity = DEFAULT_MIN_SIMILARITY,
  ): Promise<VectorSearchResult[]> {
    if (queryVector.length === 0) return [];

    const entries = await this._getAll();

    return entries
      .map(entry => ({
        entry,
        similarity: cosineSimilarity(queryVector, entry.vector),
      }))
      .filter(r => r.similarity >= minSimilarity)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  /**
   * Check if an entry exists.
   */
  async isIndexed(id: string): Promise<boolean> {
    try {
      const db = await this._getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(id);
        req.onsuccess = () => resolve(!!req.result);
        req.onerror = () => resolve(false);
      });
    } catch {
      return false;
    }
  }

  /**
   * Remove a vector entry.
   */
  async remove(id: string): Promise<void> {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Get total number of indexed entries.
   */
  async count(): Promise<number> {
    try {
      const db = await this._getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).count();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(0);
      });
    } catch {
      return 0;
    }
  }

  /**
   * Clear all entries.
   */
  async clear(): Promise<void> {
    try {
      const db = await this._getDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
    } catch {
      // Non-critical
    }
  }

  // ── IndexedDB ───────────────────────────────────────────────

  private _getDB(): Promise<IDBDatabase> {
    if (this._dbPromise) return this._dbPromise;

    this._dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    return this._dbPromise;
  }

  private async _getAll(): Promise<VectorEntry[]> {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }
}

// ─── Math ──────────────────────────────────────────────────────

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += (a[i] ?? 0) * (b[i] ?? 0);
    magA += (a[i] ?? 0) ** 2;
    magB += (b[i] ?? 0) ** 2;
  }

  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

// ─── Singleton ──────────────────────────────────────────────────

export const vectorStore = new VectorStore();
export default vectorStore;
