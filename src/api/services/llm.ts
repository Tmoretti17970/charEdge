// ═══════════════════════════════════════════════════════════════════
// charEdge — Multi-Provider LLM Service
//
// Phase 7 Task 7.2.3: Abstraction layer for multiple LLM providers
// (OpenAI, Claude, Ollama). Unified interface for chart analysis.
//
// Usage:
//   const llm = new LLMService({ provider: 'openai', apiKey: '...' });
//   const summary = await llm.complete('Analyze this BTC/USDT chart...');
// ═══════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} LLMConfig
 * @property {'openai'|'claude'|'ollama'} provider
 * @property {string} [apiKey]
 * @property {string} [model]
 * @property {string} [baseUrl]
 * @property {number} [maxTokens]
 * @property {number} [temperature]
 */

/** @type {Record<string, { url: string, model: string }>} */
const PROVIDER_DEFAULTS = {
    openai: { url: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini' },
    claude: { url: 'https://api.anthropic.com/v1/messages', model: 'claude-3-5-sonnet-20241022' },
    ollama: { url: 'http://localhost:11434/api/chat', model: 'llama3.2' },
};

export class LLMService {
    /**
     * @param {LLMConfig} config
     */
    constructor(config = {}) {
        this.provider = config.provider || 'openai';
        this.apiKey = config.apiKey || process.env[`${this.provider.toUpperCase()}_API_KEY`] || '';
        this.model = config.model || PROVIDER_DEFAULTS[this.provider]?.model || 'gpt-4o-mini';
        this.baseUrl = config.baseUrl || PROVIDER_DEFAULTS[this.provider]?.url || '';
        this.maxTokens = config.maxTokens || 1024;
        this.temperature = config.temperature ?? 0.3;
    }

    /**
     * Send a completion request to the configured provider.
     * @param {string} prompt - User prompt
     * @param {Object} [options] - Override options
     * @returns {Promise<string>} Response text
     */
    async complete(prompt, options = {}) {
        const model = options.model || this.model;
        const maxTokens = options.maxTokens || this.maxTokens;
        const temperature = options.temperature ?? this.temperature;

        switch (this.provider) {
            case 'openai':
                return this._openai(prompt, { model, maxTokens, temperature });
            case 'claude':
                return this._claude(prompt, { model, maxTokens, temperature });
            case 'ollama':
                return this._ollama(prompt, { model });
            default:
                throw new Error(`[LLM] Unknown provider: ${this.provider}`);
        }
    }

    /**
     * Structured chart analysis prompt.
     * @param {Object} chartData - { symbol, timeframe, bars, indicators }
     * @returns {Promise<string>}
     */
    async analyzeChart(chartData) {
        const { symbol, timeframe, bars = [], indicators = [] } = chartData;
        const recentBars = bars.slice(-20);

        const prompt = `You are a professional trading analyst. Analyze this ${symbol} ${timeframe} chart data and provide a concise summary.

Recent OHLCV (last ${recentBars.length} bars):
${recentBars.map(b => `${new Date(b.time).toLocaleDateString()}: O=${b.open} H=${b.high} L=${b.low} C=${b.close} V=${b.volume}`).join('\n')}

${indicators.length ? `Active indicators: ${indicators.join(', ')}` : ''}

Provide:
1. Trend direction and strength
2. Key support/resistance levels
3. Notable patterns
4. Risk assessment (1-5 scale)

Keep it concise (3-5 sentences max). Do NOT give financial advice.`;

        return this.complete(prompt);
    }

    // ─── Provider Implementations ─────────────────────────────────

    async _openai(prompt, { model, maxTokens, temperature }) {
        const res = await fetch(this.baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                model,
                messages: [
                    { role: 'system', content: 'You are a concise trading chart analyst. Never give financial advice.' },
                    { role: 'user', content: prompt },
                ],
                max_tokens: maxTokens,
                temperature,
            }),
        });

        if (!res.ok) throw new Error(`[LLM/OpenAI] ${res.status}: ${await res.text()}`);
        const data = await res.json();
        return data.choices?.[0]?.message?.content || '';
    }

    async _claude(prompt, { model, maxTokens, temperature }) {
        const res = await fetch(this.baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model,
                max_tokens: maxTokens,
                temperature,
                system: 'You are a concise trading chart analyst. Never give financial advice.',
                messages: [{ role: 'user', content: prompt }],
            }),
        });

        if (!res.ok) throw new Error(`[LLM/Claude] ${res.status}: ${await res.text()}`);
        const data = await res.json();
        return data.content?.[0]?.text || '';
    }

    async _ollama(prompt, { model }) {
        const res = await fetch(this.baseUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                messages: [
                    { role: 'system', content: 'You are a concise trading chart analyst. Never give financial advice.' },
                    { role: 'user', content: prompt },
                ],
                stream: false,
            }),
        });

        if (!res.ok) throw new Error(`[LLM/Ollama] ${res.status}: ${await res.text()}`);
        const data = await res.json();
        return data.message?.content || '';
    }
}

// ─── Factory ────────────────────────────────────────────────────

/**
 * Create an LLM service from environment variables.
 */
export function createLLMFromEnv() {
    const provider = process.env.LLM_PROVIDER || 'openai';
    return new LLMService({ provider });
}

export default LLMService;
