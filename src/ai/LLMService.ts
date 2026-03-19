// ═══════════════════════════════════════════════════════════════════
// charEdge — LLM Service (Task 4.2.1)
//
// Provider-agnostic LLM integration for trade analysis and
// natural-language insights. Supports OpenAI, Anthropic, and
// local/self-hosted models via a unified interface.
//
// Features:
//   - Trade analysis: "Why did this trade lose?"
//   - Pattern recognition: "What setup type was this?"
//   - Journal AI: Summarize trading session, suggest improvements
//   - Market context: Generate natural-language market summaries
//
// Usage:
//   import { llmService } from './LLMService';
//   const analysis = await llmService.analyzeTradeSnapshot(snapshot);
// ═══════════════════════════════════════════════════════════════════

import { logger } from '@/observability/logger.js';
import type { TradeSnapshot } from './TradeSnapshot';
import type { LeakReport } from './LeakDetector';
import { userProfileStore } from './UserProfileStore';
import { conversationMemory } from './ConversationMemory';

// ─── Types ──────────────────────────────────────────────────────

export type LLMProvider = 'openai' | 'anthropic' | 'local' | 'webllm' | 'none';

export interface LLMConfig {
    provider: LLMProvider;
    apiKey?: string;
    model?: string;
    baseUrl?: string;      // For local/custom endpoints
    maxTokens?: number;
    temperature?: number;
}

export interface LLMResponse {
    content: string;
    model: string;
    tokensUsed: number;
    latencyMs: number;
}

interface Message {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

interface StreamMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

// ─── Constants ──────────────────────────────────────────────────

const DEFAULT_CONFIG: LLMConfig = {
    provider: 'none',
    maxTokens: 1024,
    temperature: 0.3,
};

const SYSTEM_PROMPT = `You are a professional trading coach and analyst for charEdge, a GPU-accelerated charting platform. You provide concise, actionable insights about trade execution, market patterns, and behavioral psychology.

Guidelines:
- Be direct and specific — traders value precision.
- Reference specific price levels, indicators, and time frames.
- Identify behavioral patterns (tilt, FOMO, revenge trading) without being preachy.
- Suggest concrete improvements, not generic advice.
- Use trading terminology appropriately.
- Keep responses under 200 words unless explicitly asked for detail.`;

/**
 * Builds a personalized system prompt by appending the trader's profile.
 * This makes every AI response aware of the user's style, strengths, and weaknesses.
 */
function _getPersonalizedSystemPrompt(): string {
    let prompt = SYSTEM_PROMPT;

    // Sprint 5: Try TraderDNA first (richer profile), fall back to UserProfileStore
    try {
        // Sync import — TraderDNA reads from UserProfileStore which uses localStorage
        const { traderDNA } = require('./TraderDNA') as { traderDNA: { getDNAForPrompt(): string } };
        const dnaPrompt = traderDNA.getDNAForPrompt();
        if (dnaPrompt) {
            prompt += `\n\n${dnaPrompt}`;
        } else {
            // Fallback to basic profile
            const profileSummary = userProfileStore.getSummaryForAI();
            if (profileSummary) {
                prompt += `\n\n--- Trader Profile ---\n${profileSummary}`;
            }
        }
    } catch {
        // TraderDNA not available — use basic profile
        const profileSummary = userProfileStore.getSummaryForAI();
        if (profileSummary) {
            prompt += `\n\n--- Trader Profile ---\n${profileSummary}`;
        }
    }

    // Sprint 4: Add coaching preferences context
    try {
        const { adaptiveCoach } = require('./AdaptiveCoach') as { adaptiveCoach: { getCoachingSummaryForAI(): string } };
        const coachingSummary = adaptiveCoach.getCoachingSummaryForAI();
        if (coachingSummary) {
            prompt += `\n\n--- Coaching Preferences ---\n${coachingSummary}`;
        }
    } catch { /* not available */ }

    // Sprint 2: Add conversation memory context (sync — uses cached data)
    const recentContext = conversationMemory.getRecentContext(3);
    if (recentContext.length > 0) {
        const contextStr = recentContext
            .map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content.slice(0, 100)}`)
            .join('\n');
        prompt += `\n\n--- Recent Conversation ---\n${contextStr}`;
    }
    return prompt;
}

// ─── LLMService Class ───────────────────────────────────────────

class LLMService {
    private _config: LLMConfig;
    private _initialized: boolean = false;

    constructor() {
        this._config = { ...DEFAULT_CONFIG };
    }

    /**
     * Configure the LLM provider.
     */
    configure(config: Partial<LLMConfig>): void {
        this._config = { ...this._config, ...config };
        this._initialized = this._config.provider !== 'none';

        if (this._initialized) {
            logger.boot.info(`[LLM] Configured: ${this._config.provider} (${this._config.model || 'default'})`);
        }
    }

    /**
     * Auto-detect and configure from environment variables.
     * LLM API keys are now server-side only — client just enables the feature.
     */
    autoDetect(): void {
        const env = typeof import.meta !== 'undefined' ? import.meta.env : {};

        // Server-side proxy mode: client enables LLM, server holds the keys
        if (env?.VITE_LLM_PROVIDER === 'openai' || env?.VITE_LLM_ENABLED === 'true') {
            this.configure({
                provider: (env?.VITE_LLM_PROVIDER as LLMProvider) || 'openai',
                model: env.VITE_LLM_MODEL || 'gpt-4o-mini',
            });
        } else if (env?.VITE_LLM_PROVIDER === 'anthropic') {
            this.configure({
                provider: 'anthropic',
                model: env.VITE_LLM_MODEL || 'claude-3-haiku-20240307',
            });
        } else if (env?.VITE_LLM_BASE_URL) {
            this.configure({
                provider: 'local',
                baseUrl: env.VITE_LLM_BASE_URL,
                model: env.VITE_LLM_MODEL || 'default',
            });
        }
    }

    get isAvailable(): boolean {
        // WebLLM is available even without explicit config
        try {
            const { webLLMProvider } = require('./WebLLMProvider');
            if (webLLMProvider?.isLoaded) return true;
        } catch { /* not imported yet */ }
        return this._initialized;
    }

    /**
     * Public chat method for AIRouter (Sprint 58).
     */
    async chatDirect(messages: Message[]): Promise<LLMResponse> {
        return this._chat(messages);
    }

    /**
     * Streaming chat (Sprint 59). Yields tokens one-by-one.
     */
    async *streamChat(messages: Message[], maxTokens = 512, temperature = 0.3): AsyncGenerator<string, void, unknown> {
        // Prefer WebLLM for streaming
        try {
            const { webLLMProvider } = await import('./WebLLMProvider');
            if (webLLMProvider.isLoaded) {
                for await (const token of webLLMProvider.streamChat(messages, maxTokens, temperature)) {
                    yield token;
                }
                return;
            }
        } catch { /* webllm not available */ }

        // Fallback: non-streaming, yield full response
        const response = await this._chat(messages);
        yield response.content;
    }

    // ─── High-Level Analysis Methods ────────────────────────────

    /**
     * Analyze a trade snapshot and return natural-language insights.
     */
    async analyzeTradeSnapshot(snapshot: TradeSnapshot): Promise<LLMResponse> {
        const prompt = this._buildTradePrompt(snapshot);
        return this._chat([
            { role: 'system', content: _getPersonalizedSystemPrompt() },
            { role: 'user', content: prompt },
        ]);
    }

    /**
     * Summarize a trading session from multiple snapshots.
     */
    async summarizeSession(snapshots: TradeSnapshot[]): Promise<LLMResponse> {
        const wins = snapshots.filter(s => s.outcome === 'win').length;
        const losses = snapshots.filter(s => s.outcome === 'loss').length;
        const totalPnL = snapshots.reduce((sum, s) => sum + (s.pnl || 0), 0);

        const prompt = `Summarize this trading session:
- ${snapshots.length} trades: ${wins}W / ${losses}L
- Net P&L: $${totalPnL.toFixed(2)}
- Symbols: ${[...new Set(snapshots.map(s => s.symbol))].join(', ')}
- Timeframes: ${[...new Set(snapshots.map(s => s.timeframe))].join(', ')}
- Avg hold time: ${snapshots.filter(s => s.holdDuration).length > 0 ? (snapshots.reduce((s, t) => s + (t.holdDuration || 0), 0) / snapshots.filter(s => s.holdDuration).length / 60000).toFixed(1) + 'min' : 'N/A'}

Provide: 1) Overall assessment, 2) Best trade, 3) Worst trade, 4) Key improvement`;

        return this._chat([
            { role: 'system', content: _getPersonalizedSystemPrompt() },
            { role: 'user', content: prompt },
        ]);
    }

    /**
     * Sprint 3: Analyze with journal RAG context.
     * Searches past trades for relevant context before sending to LLM.
     */
    async analyzeWithJournalContext(question: string): Promise<LLMResponse> {
        let ragContext = '';
        try {
            const { journalRAG } = await import('./JournalRAG');
            ragContext = await journalRAG.getContextForPrompt(question);
        } catch { /* RAG not available */ }

        const systemPrompt = ragContext
            ? `${_getPersonalizedSystemPrompt()}\n\n${ragContext}`
            : _getPersonalizedSystemPrompt();

        return this._chat([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: question },
        ]);
    }

    /**
     * Generate coaching response for detected behavioral leaks.
     * Sprint 62: Routes through AIRouter for in-browser LLM coaching.
     */
    async coachOnLeaks(report: LeakReport): Promise<LLMResponse> {
        const leakSummary = report.leaks
            .map(l => `- [${l.severity}] ${l.type}: ${l.message}`)
            .join('\n');

        const prompt = `A trader's leak analysis shows:
Score: ${report.score}/100 (higher = more leaks)
Analyzed: ${report.analyzedTrades} trades

Detected leaks:
${leakSummary}

Provide empathetic but direct coaching. Prioritize the most impactful leak. Give one specific action item for this week.`;

        const messages: Message[] = [
            { role: 'system', content: _getPersonalizedSystemPrompt() },
            { role: 'user', content: prompt },
        ];

        // Sprint 62: Try AIRouter first (routes to WebLLM if loaded)
        try {
            const { aiRouter } = await import('./AIRouter');
            const result = await aiRouter.route({
                type: 'coach',
                messages,
                maxTokens: 300,
                temperature: 0.5,
            });
            return {
                content: result.content,
                model: result.model,
                tokensUsed: result.tokensUsed,
                latencyMs: result.latencyMs,
            };
        } catch {
            // Fallback to direct chat
            return this._chat(messages);
        }
    }

    // ─── Core Chat Method ───────────────────────────────────────

    private async _chat(messages: Message[]): Promise<LLMResponse> {
        if (!this._initialized) {
            return {
                content: 'LLM not configured. Set VITE_LLM_ENABLED=true in .env.local and configure server-side API keys.',
                model: 'none',
                tokensUsed: 0,
                latencyMs: 0,
            };
        }

        const start = performance.now();

        try {
            switch (this._config.provider) {
                case 'openai':
                    return await this._chatOpenAI(messages, start);
                case 'anthropic':
                    return await this._chatAnthropic(messages, start);
                case 'local':
                    return await this._chatLocal(messages, start);
                case 'webllm':
                    return await this._chatWebLLM(messages, start);
                default: {
                    // Try WebLLM first if loaded, even without explicit config
                    try {
                        const { webLLMProvider } = await import('./WebLLMProvider');
                        if (webLLMProvider.isLoaded) {
                            return await this._chatWebLLM(messages, start);
                        }
                    } catch { /* not available */ }
                    throw new Error(`Unknown provider: ${this._config.provider}`);
                }
            }
        } catch (err: unknown) {
            logger.network.error(`[LLM] ${this._config.provider} error`, err);
            return {
                content: `LLM error: ${err.message}`,
                model: this._config.model || 'unknown',
                tokensUsed: 0,
                latencyMs: performance.now() - start,
            };
        }
    }

    // ─── Provider Implementations ───────────────────────────────

    private async _chatOpenAI(messages: Message[], start: number): Promise<LLMResponse> {
        // Route through server proxy — API key stays server-side
        const res = await fetch('/api/proxy/llm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                provider: 'openai',
                messages,
                model: this._config.model || 'gpt-4o-mini',
                maxTokens: this._config.maxTokens,
                temperature: this._config.temperature,
            }),
        });

        if (!res.ok) throw new Error(`LLM proxy ${res.status}: ${await res.text()}`);
        const data = await res.json();

        if (data.ok === false) throw new Error(data.error || 'LLM proxy error');

        return {
            content: data.choices?.[0]?.message?.content || '',
            model: data.model || this._config.model || 'openai',
            tokensUsed: data.usage?.total_tokens || 0,
            latencyMs: performance.now() - start,
        };
    }

    private async _chatAnthropic(messages: Message[], start: number): Promise<LLMResponse> {
        // Route through server proxy — API key stays server-side
        const res = await fetch('/api/proxy/llm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                provider: 'anthropic',
                messages,
                model: this._config.model || 'claude-3-haiku-20240307',
                maxTokens: this._config.maxTokens,
                temperature: this._config.temperature,
            }),
        });

        if (!res.ok) throw new Error(`LLM proxy ${res.status}: ${await res.text()}`);
        const data = await res.json();

        if (data.ok === false) throw new Error(data.error || 'LLM proxy error');

        return {
            content: data.content?.[0]?.text || '',
            model: data.model || this._config.model || 'anthropic',
            tokensUsed: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
            latencyMs: performance.now() - start,
        };
    }

    private async _chatLocal(messages: Message[], start: number): Promise<LLMResponse> {
        const baseUrl = this._config.baseUrl || 'http://localhost:11434';
        const res = await fetch(`${baseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: this._config.model || 'default',
                messages,
                max_tokens: this._config.maxTokens,
                temperature: this._config.temperature,
            }),
        });

        if (!res.ok) throw new Error(`Local LLM ${res.status}: ${await res.text()}`);
        const data = await res.json();

        return {
            content: data.choices?.[0]?.message?.content || '',
            model: data.model || this._config.model || 'local',
            tokensUsed: data.usage?.total_tokens || 0,
            latencyMs: performance.now() - start,
        };
    }

    private async _chatWebLLM(messages: Message[], start: number): Promise<LLMResponse> {
        const { webLLMProvider } = await import('./WebLLMProvider');
        if (!webLLMProvider.isLoaded) {
            throw new Error('WebLLM model not loaded');
        }

        const result = await webLLMProvider.chat(
            messages,
            this._config.maxTokens || 512,
            this._config.temperature ?? 0.3,
        );

        return {
            content: result.content,
            model: webLLMProvider.status.modelId || 'webllm',
            tokensUsed: result.tokensUsed,
            latencyMs: performance.now() - start,
        };
    }

    // ─── Prompt Builders ────────────────────────────────────────

    private _buildTradePrompt(s: TradeSnapshot): string {
        const parts = [
            `Analyze this ${s.side} trade on ${s.symbol} (${s.timeframe}):`,
            `Entry: $${s.entryPrice}${s.exitPrice ? ` → Exit: $${s.exitPrice}` : ''}`,
        ];

        if (s.pnl !== undefined) {
            parts.push(`P&L: $${s.pnl.toFixed(2)} (${s.pnlPercent?.toFixed(2)}%)`);
            parts.push(`Outcome: ${s.outcome} | Grade: ${s.executionGrade || 'N/A'}`);
        }

        if (s.holdDuration) {
            parts.push(`Hold time: ${(s.holdDuration / 60000).toFixed(1)} minutes`);
        }

        if (s.indicators.length > 0) {
            parts.push(`Indicators: ${s.indicators.map(i => `${i.name}=${i.value}${i.signal ? ` (${i.signal})` : ''}`).join(', ')}`);
        }

        if (s.psychContext.emotion) {
            parts.push(`Emotion: ${s.psychContext.emotion} | Confidence: ${s.psychContext.confidence || 'N/A'}/10`);
        }

        if (s.psychContext.tilting) {
            parts.push(`⚠️ TILT DETECTED: ${s.psychContext.recentLosses} consecutive prior losses`);
        }

        parts.push('\nWhat went right/wrong? What could be improved?');
        return parts.join('\n');
    }
}

// ─── Singleton + Exports ──────────────────────────────────────────

export const llmService = new LLMService();
export default llmService;
