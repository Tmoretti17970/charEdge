// ═══════════════════════════════════════════════════════════════════
// charEdge — Embedding Service (Sprint 80)
//
// Generate text embeddings via Gemini text-embedding-004 and store
// in IndexedDB for semantic journal search.
//
// Usage:
//   import { embeddingService } from './EmbeddingService';
//   const vec = await embeddingService.embed("trade was a revenge trade");
//   const similar = await embeddingService.search("emotional trading", entries);
// ═══════════════════════════════════════════════════════════════════

import { getApiKey } from '../data/providers/ApiKeyStore.js';
import { apiMeter } from '../data/ApiMetering.js';

// ─── Types ───────────────────────────────────────────────────────

export interface EmbeddedEntry {
  id: string;
  text: string;
  vector: number[];
  metadata: Record<string, unknown>;
}

export interface SearchResult {
  entry: EmbeddedEntry;
  similarity: number;
}

// ─── Constants ──────────────────────────────────────────────────

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const MODEL = 'text-embedding-004';
const DB_NAME = 'charEdge-embeddings';
const STORE_NAME = 'vectors';

// ─── Service ────────────────────────────────────────────────────

class EmbeddingService {
  private _dbPromise: Promise<IDBDatabase> | null = null;

  /**
   * Generate an embedding vector for text.
   */
  async embed(text: string): Promise<number[]> {
    const apiKey = getApiKey('gemini');
    if (!apiKey) throw new Error('Gemini API key not configured');

    apiMeter.record('gemini');

    const res = await fetch(
      `${BASE_URL}/models/${MODEL}:embedContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: `models/${MODEL}`,
          content: { parts: [{ text }] },
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new Error(`Embedding ${res.status}: ${err.slice(0, 200)}`);
    }

    const data = await res.json();
    return data.embedding?.values || [];
  }

  /**
   * Sprint 3: Embed with local model fallback.
   * Tries LocalEmbeddingModel (ONNX, free) first, then Gemini API.
   */
  async embedWithFallback(text: string): Promise<number[]> {
    // Try local ONNX model first
    try {
      const { localEmbeddingModel } = await import('./LocalEmbeddingModel');
      if (await localEmbeddingModel.isAvailable()) {
        const result = await localEmbeddingModel.embed(text);
        if (result.vector.length > 0) return result.vector;
      }
    } catch { /* not available */ }

    // Fallback to Gemini API
    return this.embed(text);
  }

  /**
   * Index a journal entry — embeds and stores in IndexedDB.
   */
  async index(id: string, text: string, metadata: Record<string, unknown> = {}): Promise<void> {
    if (!text || text.length < 10) return;

    const vector = await this.embed(text);
    const entry: EmbeddedEntry = { id, text, vector, metadata };

    const db = await this._getDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(entry);
  }

  /**
   * Semantic search across indexed entries.
   */
  async search(query: string, topK = 5): Promise<SearchResult[]> {
    const queryVec = await this.embed(query);
    const entries = await this._getAllEntries();

    const scored = entries
      .map(entry => ({
        entry,
        similarity: this._cosineSim(queryVec, entry.vector),
      }))
      .filter(r => r.similarity > 0.3)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);

    return scored;
  }

  /**
   * Check if an entry is already indexed.
   */
  async isIndexed(id: string): Promise<boolean> {
    const db = await this._getDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const entry = await new Promise<EmbeddedEntry | undefined>(resolve => {
      const req = tx.objectStore(STORE_NAME).get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(undefined);
    });
    return !!entry;
  }

  // ─── Math ────────────────────────────────────────────────────

  private _cosineSim(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;

    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }

    const denom = Math.sqrt(magA) * Math.sqrt(magB);
    return denom === 0 ? 0 : dot / denom;
  }

  // ─── IndexedDB ───────────────────────────────────────────────

  private _getDB(): Promise<IDBDatabase> {
    if (this._dbPromise) return this._dbPromise;

    this._dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);

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

  private async _getAllEntries(): Promise<EmbeddedEntry[]> {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }
}

// ─── Singleton ──────────────────────────────────────────────────

export const embeddingService = new EmbeddingService();
export default embeddingService;
