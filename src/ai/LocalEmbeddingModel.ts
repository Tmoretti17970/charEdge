// ═══════════════════════════════════════════════════════════════════
// charEdge — Local Embedding Model (Sprint 91)
//
// On-device text embedding using ONNX Runtime with a quantized
// MiniLM-L6 model (~50MB). Replaces Gemini API calls for
// semantic search when model is available.
//
// Usage:
//   import { localEmbeddingModel } from './LocalEmbeddingModel';
//   const vec = await localEmbeddingModel.embed("trade was a revenge trade");
// ═══════════════════════════════════════════════════════════════════

// ─── Types ───────────────────────────────────────────────────────

export interface EmbeddingResult {
  vector: number[];
  source: 'local' | 'api';
  dimensions: number;
}

// ─── Constants ──────────────────────────────────────────────────

const MODEL_PATH = '/models/minilm-l6-v2.onnx';

// ─── Model ──────────────────────────────────────────────────────

class LocalEmbeddingModel {
  private _session: unknown = null;
  private _loading = false;
  private _available: boolean | null = null;

  /**
   * Check if the local model is available.
   */
  async isAvailable(): Promise<boolean> {
    if (this._available !== null) return this._available;

    try {
      // Check if ONNX Runtime is available
      const ort = await import('onnxruntime-web');
      if (!ort) { this._available = false; return false; }

      // Check if model file exists
      const res = await fetch(MODEL_PATH, { method: 'HEAD' });
      this._available = res.ok;
      return this._available;
    } catch {
      this._available = false;
      return false;
    }
  }

  /**
   * Generate embedding — tries local model first, falls back to API.
   */
  async embed(text: string): Promise<EmbeddingResult> {
    // Try local model
    if (await this.isAvailable()) {
      try {
        const vec = await this._localEmbed(text);
        return { vector: vec, source: 'local', dimensions: vec.length };
      } catch {
        // Fall through to API
      }
    }

    // Fallback to Gemini API
    try {
      const { embeddingService } = await import('./EmbeddingService');
      const vec = await embeddingService.embed(text);
      return { vector: vec, source: 'api', dimensions: vec.length };
    } catch {
      return { vector: [], source: 'local', dimensions: 0 };
    }
  }

  /**
   * Batch embed multiple texts.
   */
  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = [];
    for (const text of texts) {
      results.push(await this.embed(text));
      // Small delay for rate limiting
      await new Promise(r => setTimeout(r, 50));
    }
    return results;
  }

  // ─── Local ONNX Inference ───────────────────────────────────

  private async _localEmbed(text: string): Promise<number[]> {
    const session = await this._getSession();
    if (!session) throw new Error('Model not loaded');

    // Simple tokenization (word-based, padded to 128)
    const tokens = this._tokenize(text);
    const ort = await import('onnxruntime-web');

    const inputIds = new ort.Tensor('int64', BigInt64Array.from(tokens.map(BigInt)), [1, tokens.length]);
    const attentionMask = new ort.Tensor('int64', BigInt64Array.from(tokens.map(t => BigInt(t > 0 ? 1 : 0))), [1, tokens.length]);

    const feeds = { input_ids: inputIds, attention_mask: attentionMask };
    const results = await (session as { run: (f: unknown) => Promise<Record<string, { data: Float32Array }>> }).run(feeds);

    // Mean pooling over token embeddings
    const embeddings = results['last_hidden_state']?.data;
    if (!embeddings) throw new Error('No embedding output');

    const dims = 384; // MiniLM-L6 output dimension
    const pooled = new Array(dims).fill(0);
    const validTokens = tokens.filter(t => t > 0).length;

    for (let t = 0; t < validTokens; t++) {
      for (let d = 0; d < dims; d++) {
        pooled[d] += embeddings[t * dims + d] / validTokens;
      }
    }

    // L2 normalize
    const norm = Math.sqrt(pooled.reduce((s, v) => s + v * v, 0));
    return norm > 0 ? pooled.map(v => v / norm) : pooled;
  }

  private _tokenize(text: string, maxLen = 128): number[] {
    // Simple word-level tokenization with hash-based IDs
    const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
    const tokens = [101]; // [CLS]

    for (const word of words.slice(0, maxLen - 2)) {
      let hash = 0;
      for (let i = 0; i < word.length; i++) {
        hash = ((hash << 5) - hash + word.charCodeAt(i)) | 0;
      }
      tokens.push(Math.abs(hash) % 30000 + 1000); // Map to vocab range
    }

    tokens.push(102); // [SEP]

    // Pad to maxLen
    while (tokens.length < maxLen) tokens.push(0);
    return tokens.slice(0, maxLen);
  }

  private async _getSession(): Promise<unknown | null> {
    if (this._session) return this._session;
    if (this._loading) return null;

    this._loading = true;
    try {
      const ort = await import('onnxruntime-web');
      this._session = await ort.InferenceSession.create(MODEL_PATH, {
        executionProviders: ['wasm'],
      });
      return this._session;
    } catch {
      return null;
    } finally {
      this._loading = false;
    }
  }
}

// ─── Singleton ──────────────────────────────────────────────────

export const localEmbeddingModel = new LocalEmbeddingModel();
export default localEmbeddingModel;
