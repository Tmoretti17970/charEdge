// ═══════════════════════════════════════════════════════════════════
// charEdge — LLM Service (6.1.1)
//
// Provider-agnostic LLM interface. Supports OpenAI, Anthropic, and
// local template-based fallback. Used by JournalSummarizer and
// PreTradeAnalyzer for AI-powered narrative generation.
//
// Usage:
//   import { llmService } from './LLMService.ts';
//   llmService.registerProvider(new OpenAIProvider('/api/ai/complete'));
//   const response = await llmService.complete('Summarize these trades...');
// ═══════════════════════════════════════════════════════════════════

// ─── Types ──────────────────────────────────────────────────────

export interface LLMCompletionOptions {
    provider?: string;          // Override default provider
    maxTokens?: number;         // Max response tokens (default: 512)
    temperature?: number;       // Creativity 0-2 (default: 0.7)
    systemPrompt?: string;      // System-level instruction
    format?: 'text' | 'json';  // Response format hint
}

export interface LLMProvider {
    name: string;
    isConfigured(): boolean;
    complete(prompt: string, opts?: LLMCompletionOptions): Promise<string>;
}

export interface LLMResponse {
    text: string;
    provider: string;
    tokens?: number;
    cached?: boolean;
}

// ─── Built-in Providers ─────────────────────────────────────────

/**
 * OpenAI-compatible provider via proxy endpoint.
 * Works with any OpenAI-compatible API (OpenAI, Azure, Ollama, etc.)
 */
export class OpenAIProvider implements LLMProvider {
    name = 'openai';
    private _endpoint: string;
    private _model: string;

    constructor(endpoint = '/api/ai/complete', model = 'gpt-4o-mini') {
        this._endpoint = endpoint;
        this._model = model;
    }

    isConfigured(): boolean {
        return !!this._endpoint;
    }

    async complete(prompt: string, opts?: LLMCompletionOptions): Promise<string> {
        const messages: Array<{ role: string; content: string }> = [];

        if (opts?.systemPrompt) {
            messages.push({ role: 'system', content: opts.systemPrompt });
        }
        messages.push({ role: 'user', content: prompt });

        const body = {
            model: this._model,
            messages,
            max_tokens: opts?.maxTokens ?? 512,
            temperature: opts?.temperature ?? 0.7,
        };

        if (opts?.format === 'json') {
            (body as any).response_format = { type: 'json_object' };
        }

        const res = await fetch(this._endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            throw new Error(`LLM request failed: ${res.status}`);
        }

        const data = await res.json();
        return data.choices?.[0]?.message?.content || data.text || '';
    }
}

/**
 * Local template-based "provider" — no external API needed.
 * Used as fallback when no LLM is configured.
 */
export class LocalProvider implements LLMProvider {
    name = 'local';

    isConfigured(): boolean {
        return true; // Always available
    }

    async complete(prompt: string, _opts?: LLMCompletionOptions): Promise<string> {
        // Simple extractive summary — pull key sentences from the prompt
        const lines = prompt.split('\n').filter(l => l.trim().length > 0);
        const summary = lines
            .filter(l => l.includes(':') || l.includes('$') || l.includes('%'))
            .slice(0, 5)
            .join(' ');
        return summary || 'Analysis complete. Review your trading data for detailed insights.';
    }
}

// ─── LLM Service ────────────────────────────────────────────────

class _LLMService {
    private _providers: Map<string, LLMProvider> = new Map();
    private _defaultProvider: string = 'local';
    private _cache: Map<string, { text: string; ts: number }> = new Map();
    private _cacheTTL = 5 * 60 * 1000; // 5 min

    constructor() {
        // Always register local fallback
        this.registerProvider(new LocalProvider());
    }

    /**
     * Register an LLM provider.
     */
    registerProvider(provider: LLMProvider): void {
        this._providers.set(provider.name, provider);
    }

    /**
     * Set the default provider by name.
     */
    setDefault(providerName: string): void {
        if (this._providers.has(providerName)) {
            this._defaultProvider = providerName;
        }
    }

    /**
     * Get the active provider (first configured non-local, or local fallback).
     */
    getActiveProvider(): LLMProvider {
        // Try configured external providers first
        for (const [name, provider] of this._providers) {
            if (name !== 'local' && provider.isConfigured()) {
                return provider;
            }
        }
        // Fallback to local
        return this._providers.get('local')!;
    }

    /**
     * Complete a prompt using the best available provider.
     */
    async complete(prompt: string, opts?: LLMCompletionOptions): Promise<LLMResponse> {
        // Check cache
        const cacheKey = this._cacheKey(prompt, opts);
        const cached = this._cache.get(cacheKey);
        if (cached && Date.now() - cached.ts < this._cacheTTL) {
            return { text: cached.text, provider: 'cache', cached: true };
        }

        // Select provider
        const providerName = opts?.provider || this._defaultProvider;
        let provider = this._providers.get(providerName);

        // Fallback chain: requested → active → local
        if (!provider?.isConfigured()) {
            provider = this.getActiveProvider();
        }

        try {
            const text = await provider.complete(prompt, opts);

            // Cache result
            this._cache.set(cacheKey, { text, ts: Date.now() });

            return { text, provider: provider.name };
        } catch (err) {
            // If external provider fails, fall back to local
            if (provider.name !== 'local') {
                const local = this._providers.get('local')!;
                const text = await local.complete(prompt, opts);
                return { text, provider: 'local' };
            }
            throw err;
        }
    }

    /**
     * Check if an external (non-local) LLM provider is available.
     */
    hasExternalProvider(): boolean {
        for (const [name, provider] of this._providers) {
            if (name !== 'local' && provider.isConfigured()) return true;
        }
        return false;
    }

    /**
     * Get registered provider names.
     */
    getProviders(): string[] {
        return [...this._providers.keys()];
    }

    /** @private */
    private _cacheKey(prompt: string, opts?: LLMCompletionOptions): string {
        return `${opts?.provider || this._defaultProvider}:${prompt.slice(0, 100)}`;
    }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const llmService = new _LLMService();
export default llmService;
