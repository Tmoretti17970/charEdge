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

import { logger } from '../utils/logger.js';
import type { TradeSnapshot } from './TradeSnapshot';
import type { LeakReport } from './LeakDetector';

// ─── Types ──────────────────────────────────────────────────────

export type LLMProvider = 'openai' | 'anthropic' | 'local' | 'none';

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
     */
    autoDetect(): void {
        const env = typeof import.meta !== 'undefined' ? import.meta.env : {};

        if (env?.VITE_OPENAI_API_KEY) {
            this.configure({
                provider: 'openai',
                apiKey: env.VITE_OPENAI_API_KEY,
                model: env.VITE_OPENAI_MODEL || 'gpt-4o-mini',
            });
        } else if (env?.VITE_ANTHROPIC_API_KEY) {
            this.configure({
                provider: 'anthropic',
                apiKey: env.VITE_ANTHROPIC_API_KEY,
                model: env.VITE_ANTHROPIC_MODEL || 'claude-3-haiku-20240307',
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
        return this._initialized;
    }

    // ─── High-Level Analysis Methods ────────────────────────────

    /**
     * Analyze a trade snapshot and return natural-language insights.
     */
    async analyzeTradeSnapshot(snapshot: TradeSnapshot): Promise<LLMResponse> {
        const prompt = this._buildTradePrompt(snapshot);
        return this._chat([
            { role: 'system', content: SYSTEM_PROMPT },
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
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: prompt },
        ]);
    }

    /**
     * Generate coaching response for detected behavioral leaks.
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

        return this._chat([
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: prompt },
        ]);
    }

    // ─── Core Chat Method ───────────────────────────────────────

    private async _chat(messages: Message[]): Promise<LLMResponse> {
        if (!this._initialized) {
            return {
                content: 'LLM not configured. Set VITE_OPENAI_API_KEY or VITE_ANTHROPIC_API_KEY in .env.local',
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
                default:
                    throw new Error(`Unknown provider: ${this._config.provider}`);
            }
        } catch (err: any) {
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
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this._config.apiKey}`,
            },
            body: JSON.stringify({
                model: this._config.model || 'gpt-4o-mini',
                messages,
                max_tokens: this._config.maxTokens,
                temperature: this._config.temperature,
            }),
        });

        if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
        const data = await res.json();

        return {
            content: data.choices[0]?.message?.content || '',
            model: data.model,
            tokensUsed: data.usage?.total_tokens || 0,
            latencyMs: performance.now() - start,
        };
    }

    private async _chatAnthropic(messages: Message[], start: number): Promise<LLMResponse> {
        const systemMsg = messages.find(m => m.role === 'system')?.content || '';
        const userMessages = messages.filter(m => m.role !== 'system');

        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this._config.apiKey || '',
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: this._config.model || 'claude-3-haiku-20240307',
                system: systemMsg,
                messages: userMessages,
                max_tokens: this._config.maxTokens,
                temperature: this._config.temperature,
            }),
        });

        if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
        const data = await res.json();

        return {
            content: data.content?.[0]?.text || '',
            model: data.model,
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
