// ═══════════════════════════════════════════════════════════════════
// charEdge — WebLLM Provider (Sprint 57, upgraded Sprint 11)
//
// In-browser LLM inference via MLC WebLLM + WebGPU.
// Runs model in a Web Worker — zero main thread blocking.
//
// Models:
//   SmolLM2  — 135M, ~80MB, 60+ tok/s (fast, classification)
//   Phi-3.5  — 3.8B, ~2.2GB, 15-25 tok/s (reasoning)
//   Qwen2.5  — 1.5B, ~1.1GB, 25-40 tok/s (best balance)
//
// Usage:
//   import { webLLMProvider } from './WebLLMProvider';
//   await webLLMProvider.loadModel('SmolLM2-135M-Instruct-q4f16_1-MLC');
//   const reply = await webLLMProvider.chat([{ role: 'user', content: 'hi' }]);
// ═══════════════════════════════════════════════════════════════════

import { logger } from '@/observability/logger.js';
import type { MLCEngineInterface } from '@mlc-ai/web-llm';

// ─── Types ──────────────────────────────────────────────────────

export interface WebLLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface WebLLMStatus {
  loaded: boolean;
  loading: boolean;
  modelId: string | null;
  progress: number;        // 0–100
  progressText: string;
  error: string | null;
  tokensPerSecond: number;
}

export type ProgressCallback = (status: WebLLMStatus) => void;

// ─── Model Catalog ──────────────────────────────────────────────

export const MODEL_CATALOG = {
  small: {
    id: 'SmolLM2-135M-Instruct-q4f16_1-MLC',
    label: 'SmolLM2 135M',
    size: '~80 MB',
    sizeBytes: 80_000_000,
    speed: '60+ tok/s',
    contextWindow: 2048,
    description: 'Fast, lightweight — ideal for classification and short responses',
  },
  medium: {
    id: 'Phi-3.5-mini-instruct-q4f16_1-MLC',
    label: 'Phi 3.5 Mini',
    size: '~2.2 GB',
    sizeBytes: 2_200_000_000,
    speed: '15-25 tok/s',
    contextWindow: 4096,
    description: 'Full reasoning — longer analysis, coaching, narratives',
  },
  large: {
    id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
    label: 'Qwen 2.5 1.5B',
    size: '~1.1 GB',
    sizeBytes: 1_100_000_000,
    speed: '25-40 tok/s',
    contextWindow: 4096,
    description: 'Best balance — strong conversational ability at moderate size',
  },
} as const;

export type ModelTier = keyof typeof MODEL_CATALOG;

// ─── Provider Class ─────────────────────────────────────────────

class WebLLMProvider {
  private _engine: MLCEngineInterface | null = null;
  private _status: WebLLMStatus = {
    loaded: false,
    loading: false,
    modelId: null,
    progress: 0,
    progressText: '',
    error: null,
    tokensPerSecond: 0,
  };
  private _listeners: Set<ProgressCallback> = new Set();

  get status(): WebLLMStatus {
    return { ...this._status };
  }

  get isLoaded(): boolean {
    return this._status.loaded;
  }

  get isLoading(): boolean {
    return this._status.loading;
  }

  /**
   * Subscribe to status changes.
   */
  onStatusChange(cb: ProgressCallback): () => void {
    this._listeners.add(cb);
    return () => this._listeners.delete(cb);
  }

  private _notify(): void {
    const snap = this.status;
    for (const cb of this._listeners) {
      try { cb(snap); } catch { /* ignore */ }
    }
  }

  /**
   * Load a model. Idempotent — skips if already loaded.
   */
  async loadModel(modelId?: string): Promise<void> {
    // Phase 2 Task #25: Default to Qwen 2.5 (better conversational quality)
    const targetModel = modelId || MODEL_CATALOG.large.id;

    if (this._status.loaded && this._status.modelId === targetModel) return;
    if (this._status.loading) return;

    // Task #9: Guard against missing WebGPU
    if (typeof navigator !== 'undefined' && !('gpu' in navigator)) {
      this._status = {
        ...this._status,
        loaded: false,
        loading: false,
        error: 'WebGPU is not available in this browser. Try Chrome 113+ or Edge 113+.',
        progressText: 'WebGPU not available',
      };
      this._notify();
      return;
    }

    // Phase 2 Task #26: Network-awareness check
    const networkWarning = this._checkNetwork(targetModel);
    if (networkWarning) {
      logger.boot.warn(`[WebLLM] ${networkWarning}`);
    }

    // Phase 2 Task #27: Memory estimation check
    const memoryWarning = this._checkMemory(targetModel);
    if (memoryWarning) {
      logger.boot.warn(`[WebLLM] ${memoryWarning}`);
    }

    this._status = {
      ...this._status,
      loading: true,
      error: null,
      progress: 0,
      progressText: 'Initializing WebLLM...',
      modelId: targetModel,
    };
    this._notify();

    try {
      const { CreateMLCEngine } = await import('@mlc-ai/web-llm');

      this._engine = await CreateMLCEngine(targetModel, {
        initProgressCallback: (report: { progress: number; text: string }) => {
          this._status.progress = Math.round(report.progress * 100);
          this._status.progressText = report.text;
          this._notify();
        },
      });

      this._status = {
        ...this._status,
        loaded: true,
        loading: false,
        progress: 100,
        progressText: 'Ready',
      };
      this._notify();

      // Phase 2 Task #24: Warm up the model with a silent 1-token inference
      await this._warmup();

      logger.boot.info(`[WebLLM] Model loaded: ${targetModel}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this._status = {
        ...this._status,
        loaded: false,
        loading: false,
        error: msg,
        progressText: `Error: ${msg}`,
      };
      this._notify();
      logger.boot.error('[WebLLM] Load failed', err);
    }
  }

  /**
   * Chat completion (non-streaming).
   */
  async chat(messages: WebLLMMessage[], maxTokens = 512, temperature = 0.3): Promise<{
    content: string;
    tokensUsed: number;
    tokensPerSecond: number;
  }> {
    if (!this._engine || !this._status.loaded) {
      throw new Error('WebLLM model not loaded. Call loadModel() first.');
    }

    const start = performance.now();
    const reply = await this._engine.chat.completions.create({
      messages,
      max_tokens: maxTokens,
      temperature,
    });

    const content = reply.choices?.[0]?.message?.content || '';
    const tokensUsed = reply.usage?.total_tokens || 0;
    const elapsed = (performance.now() - start) / 1000;
    const tps = elapsed > 0 ? Math.round(tokensUsed / elapsed) : 0;

    this._status.tokensPerSecond = tps;
    this._notify();

    return { content, tokensUsed, tokensPerSecond: tps };
  }

  /**
   * Streaming chat completion (async generator).
   */
  async *streamChat(messages: WebLLMMessage[], maxTokens = 512, temperature = 0.3): AsyncGenerator<string> {
    if (!this._engine || !this._status.loaded) {
      throw new Error('WebLLM model not loaded. Call loadModel() first.');
    }

    const stream = await this._engine.chat.completions.create({
      messages,
      max_tokens: maxTokens,
      temperature,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) yield delta;
    }
  }

  /**
   * Unload model and free GPU memory.
   */
  async unload(): Promise<void> {
    if (this._engine) {
      try {
        await this._engine.unload();
      } catch { /* best-effort */ }
      this._engine = null;
    }
    this._status = {
      loaded: false,
      loading: false,
      modelId: null,
      progress: 0,
      progressText: '',
      error: null,
      tokensPerSecond: 0,
    };
    this._notify();
  }

  // ── Sprint 11: Model Management ─────────────────────────────

  /**
   * Get all available models with their current status.
   */
  getAvailableModels(): Array<{
    tier: string; id: string; label: string; size: string;
    speed: string; description: string; loaded: boolean;
    contextWindow: number;
  }> {
    return Object.entries(MODEL_CATALOG).map(([tier, info]) => ({
      tier,
      id: info.id,
      label: info.label,
      size: info.size,
      speed: info.speed,
      description: info.description,
      contextWindow: info.contextWindow,
      loaded: this._status.loaded && this._status.modelId === info.id,
    }));
  }

  /**
   * Get the context window size for the currently loaded model.
   */
  getContextWindow(): number {
    if (!this._status.modelId) return 2048;
    for (const info of Object.values(MODEL_CATALOG)) {
      if (info.id === this._status.modelId) return info.contextWindow;
    }
    return 2048;
  }

  /**
   * Switch to a different model tier.
   */
  async switchModel(tier: ModelTier): Promise<void> {
    const model = MODEL_CATALOG[tier];
    if (!model) return;
    if (this._status.modelId === model.id && this._status.loaded) return;
    await this.unload();
    await this.loadModel(model.id);
  }

  // ── Sprint 30: Model Preloading ─────────────────────────────

  private static PREF_KEY = 'charEdge-preferred-model';

  /**
   * Save preferred model for auto-preloading on next app start.
   */
  setPreferredModel(modelId: string): void {
    try {
      localStorage.setItem(WebLLMProvider.PREF_KEY, modelId);
    } catch { /* storage unavailable */ }
  }

  /**
   * Get the user's preferred model ID (null = not set / not opted in).
   */
  getPreferredModel(): string | null {
    try {
      return localStorage.getItem(WebLLMProvider.PREF_KEY);
    } catch {
      return null;
    }
  }

  /**
   * Clear the preferred model (opt out of preloading).
   */
  clearPreferredModel(): void {
    try {
      localStorage.removeItem(WebLLMProvider.PREF_KEY);
    } catch { /* ignore */ }
  }

  /**
   * Preload the preferred model if the user has opted in.
   * Non-blocking — runs in background, never throws.
   */
  async preloadIfOptedIn(): Promise<void> {
    const preferred = this.getPreferredModel();
    if (!preferred) return;
    if (this._status.loaded && this._status.modelId === preferred) return;
    if (this._status.loading) return;

    try {
      logger.ai('Preloading preferred model:', preferred);
      await this.loadModel(preferred);
    } catch {
      // Non-critical — user can still load manually
    }
  }

  // ── Phase 2 Task #24: Model Warmup ─────────────────────────

  /**
   * Run a silent 1-token inference to warm up the WebGPU pipeline.
   * The first real query will be ~2x faster after this.
   */
  private async _warmup(): Promise<void> {
    if (!this._engine || !this._status.loaded) return;
    try {
      await this._engine.chat.completions.create({
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 1,
        temperature: 0,
      });
    } catch {
      // Non-critical — warmup failure doesn't block usage
    }
  }

  // ── Phase 2 Task #26: Network Awareness ────────────────────

  /**
   * Check network conditions before downloading a model.
   * Returns a warning string if conditions are poor, null otherwise.
   */
  private _checkNetwork(modelId: string): string | null {
    if (typeof navigator === 'undefined') return null;
    const conn = (navigator as any).connection;
    if (!conn) return null;

    const effectiveType = conn.effectiveType; // '4g', '3g', '2g', 'slow-2g'
    const modelSize = this._getModelSize(modelId);

    if (['2g', 'slow-2g'].includes(effectiveType) && modelSize > 100_000_000) {
      return `Slow network detected (${effectiveType}). Downloading ${(modelSize / 1e9).toFixed(1)}GB model may take a long time.`;
    }
    if (effectiveType === '3g' && modelSize > 500_000_000) {
      return `3G network detected. The ${(modelSize / 1e9).toFixed(1)}GB model download may be slow.`;
    }
    return null;
  }

  // ── Phase 2 Task #27: Memory Estimation ────────────────────

  /**
   * Check device memory before downloading a large model.
   * Returns a warning string if memory is insufficient, null otherwise.
   */
  private _checkMemory(modelId: string): string | null {
    if (typeof navigator === 'undefined') return null;
    const deviceMemory = (navigator as any).deviceMemory; // GB (Chrome only)
    if (!deviceMemory) return null;

    const modelSize = this._getModelSize(modelId);

    if (deviceMemory < 4 && modelSize > 500_000_000) {
      return `Low device memory (${deviceMemory}GB). A ${(modelSize / 1e9).toFixed(1)}GB model may cause performance issues. Consider the smaller SmolLM2 model.`;
    }
    if (deviceMemory < 8 && modelSize > 2_000_000_000) {
      return `Device has ${deviceMemory}GB RAM. The ${(modelSize / 1e9).toFixed(1)}GB model may be slow. Qwen 2.5 (1.1GB) is recommended.`;
    }
    return null;
  }

  /**
   * Get download warnings for a model (exposed for UI display).
   */
  getDownloadWarnings(modelId: string): string[] {
    const warnings: string[] = [];
    const nw = this._checkNetwork(modelId);
    if (nw) warnings.push(nw);
    const mem = this._checkMemory(modelId);
    if (mem) warnings.push(mem);
    return warnings;
  }

  private _getModelSize(modelId: string): number {
    for (const info of Object.values(MODEL_CATALOG)) {
      if (info.id === modelId) return info.sizeBytes;
    }
    return 0;
  }
}

// ─── Singleton ──────────────────────────────────────────────────

export const webLLMProvider = new WebLLMProvider();
export default webLLMProvider;
