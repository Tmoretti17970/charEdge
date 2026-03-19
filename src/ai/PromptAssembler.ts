// ═══════════════════════════════════════════════════════════════════
// charEdge — Prompt Assembler (AI Copilot Sprint 12)
//
// Token-budgeted prompt pipeline that assembles system prompts
// from: TraderDNA + chart context + journal RAG + conversation
// memory + mode-specific templates.
//
// Usage:
//   import { promptAssembler } from './PromptAssembler';
//   const messages = promptAssembler.assemble('analysis', chartCtx, query);
// ═══════════════════════════════════════════════════════════════════

import { traderDNA } from './TraderDNA';
import { countTokens, trimToTokenBudget, tokenBudgetReport, type TokenReport } from './TokenCounter';
import { adaptiveCoach } from './AdaptiveCoach';

// ─── Types ──────────────────────────────────────────────────────

export type PromptMode = 'quick' | 'analysis' | 'coaching' | 'journal';

export interface ChartContext {
  symbol: string;
  timeframe: string;
  price: number;
  regime?: string;
  rsi?: number;
  emaSpread?: number;
  ema20?: number;
  ema50?: number;
  ema200?: number;
  volume?: string;        // 'high' | 'normal' | 'low'
  volumeRatio?: number;   // Sprint 21: current / 20-period avg
  openPosition?: { side: string; pnl: number } | null;
}

export interface AssembledPrompt {
  messages: Array<{ role: 'system' | 'user'; content: string }>;
  tokenEstimate: number;
  sections: string[];     // Which sections were included
}

// ─── Token Budget ───────────────────────────────────────────────

interface TokenBudget {
  total: number;
  system: number;
  traderDNA: number;
  chart: number;
  rag: number;
  conversation: number;
  userQuery: number;
}

// ─── Mode Templates ─────────────────────────────────────────────

const MODE_TEMPLATES: Record<PromptMode, string> = {
  quick: `You are a trading assistant. Give a 1-2 sentence answer. Be extremely concise.`,

  analysis: `You are a professional trading analyst for charEdge. Provide detailed, actionable analysis grounded in the chart data provided. Reference specific price levels, indicators, and timeframes. Be direct and precise — traders value brevity over verbosity.`,

  coaching: `You are a trading coach and mentor. Your tone is direct and supportive — like a coach who genuinely cares about the trader's growth. Reference the trader's specific patterns, strengths, and weaknesses. Suggest concrete improvements based on their history. Never be generic.`,

  journal: `You are a trade journal analyst. Help the trader understand their past performance by analyzing journal entries. Compare current setups to historical trades. Identify patterns and areas for improvement. Use specific data from their trading history.`,
};

// ─── Assembler ──────────────────────────────────────────────────

export class PromptAssembler {
  private _lastTokenReport: TokenReport | null = null;

  /**
   * Get the token report from the last assembly.
   * Useful for dev-mode token usage display.
   */
  getLastTokenReport(): TokenReport | null {
    return this._lastTokenReport;
  }

  /**
   * Assemble a complete prompt with token budgeting.
   */
  assemble(
    mode: PromptMode,
    chartContext?: ChartContext | null,
    userQuery?: string,
    ragContext?: string,
    conversationHistory?: Array<{ role: string; content: string }>,
    contextWindow = 4096,
  ): AssembledPrompt {
    const budget = this._allocateBudget(contextWindow, mode);
    const sections: string[] = [];
    const systemParts: string[] = [];

    // 1. Base mode template
    systemParts.push(MODE_TEMPLATES[mode]);
    sections.push('mode_template');

    // 2. Trader DNA
    const dna = this._getTraderDNA(budget.traderDNA);
    if (dna) {
      systemParts.push(dna);
      sections.push('trader_dna');
    }

    // 3. Chart context
    if (chartContext) {
      const chartStr = this._formatChartContext(chartContext, budget.chart);
      systemParts.push(chartStr);
      sections.push('chart_context');
    }

    // 4. Coaching preferences (for coaching mode)
    if (mode === 'coaching') {
      const coachingPrefs = adaptiveCoach.getCoachingSummaryForAI();
      if (coachingPrefs) {
        systemParts.push(coachingPrefs);
        sections.push('coaching_prefs');
      }
    }

    // 5. RAG context (for journal mode or when provided)
    if (ragContext) {
      const trimmed = this._trimToTokens(ragContext, budget.rag);
      systemParts.push(`--- Relevant Past Trades ---\n${trimmed}`);
      sections.push('rag_context');
    }

    // Build messages array
    const messages: AssembledPrompt['messages'] = [
      { role: 'system', content: systemParts.join('\n\n') },
    ];

    // Add conversation history
    if (conversationHistory && conversationHistory.length > 0) {
      const historyBudget = budget.conversation;
      let tokensUsed = 0;
      const recentHistory = [...conversationHistory].reverse();
      const included: Array<{ role: 'system' | 'user'; content: string }> = [];

      for (const msg of recentHistory) {
        const msgTokens = this._estimateTokens(msg.content);
        if (tokensUsed + msgTokens > historyBudget) break;
        included.unshift({ role: msg.role as 'system' | 'user', content: msg.content });
        tokensUsed += msgTokens;
      }
      messages.push(...included);
      if (included.length > 0) sections.push('conversation_history');
    }

    // Add user query
    if (userQuery) {
      messages.push({ role: 'user', content: userQuery });
      sections.push('user_query');
    }

    const tokenEstimate = messages.reduce((s, m) => s + countTokens(m.content), 0);

    // Sprint 29: Store token report for dev-mode display
    this._lastTokenReport = tokenBudgetReport(messages, contextWindow);

    return { messages, tokenEstimate, sections };
  }

  /**
   * Convenience method: returns the flat messages array ready for AIRouter.
   * Wraps assemble() and returns just the messages.
   */
  assembleForChat(
    userQuery: string,
    opts: {
      mode?: PromptMode;
      chartContext?: ChartContext | null;
      ragContext?: string | undefined;
      conversationHistory?: Array<{ role: string; content: string }>;
      contextWindow?: number;
    } = {},
  ): Array<{ role: 'system' | 'user'; content: string }> {
    const {
      mode = 'analysis',
      chartContext = null,
      ragContext,
      conversationHistory,
      contextWindow = 4096,
    } = opts;

    const result = this.assemble(
      mode,
      chartContext,
      userQuery,
      ragContext,
      conversationHistory,
      contextWindow,
    );

    return result.messages;
  }

  /**
   * Check if Trader DNA is available (≥ 3 trades in history).
   */
  hasDNA(): boolean {
    try {
      return !!traderDNA.getDNAForPrompt();
    } catch {
      return false;
    }
  }

  /**
   * Format chart context into a compact string.
   */
  injectChartContext(ctx: ChartContext): string {
    return this._formatChartContext(ctx, 300);
  }

  /**
   * Get token budget for a model's context window.
   */
  getTokenBudget(contextWindow: number, mode: PromptMode): TokenBudget {
    return this._allocateBudget(contextWindow, mode);
  }

  // ── Budget Allocation ───────────────────────────────────────

  private _allocateBudget(contextWindow: number, mode: PromptMode): TokenBudget {
    // Reserve 25% for model response
    const available = Math.floor(contextWindow * 0.75);

    const allocations: Record<PromptMode, Omit<TokenBudget, 'total'>> = {
      quick: {
        system: 100, traderDNA: 100, chart: 150,
        rag: 0, conversation: 100, userQuery: available - 450,
      },
      analysis: {
        system: 150, traderDNA: 200, chart: 300,
        rag: 200, conversation: 200, userQuery: available - 1050,
      },
      coaching: {
        system: 150, traderDNA: 250, chart: 200,
        rag: 300, conversation: 200, userQuery: available - 1100,
      },
      journal: {
        system: 100, traderDNA: 150, chart: 100,
        rag: 500, conversation: 150, userQuery: available - 1000,
      },
    };

    const alloc = allocations[mode];
    // Clamp userQuery to minimum 200 tokens — prevents negative budget
    // on small context windows (e.g., SmolLM2 2048)
    alloc.userQuery = Math.max(200, alloc.userQuery);
    return { total: available, ...alloc };
  }

  // ── Helpers ─────────────────────────────────────────────────

  private _getTraderDNA(maxTokens: number): string {
    try {
      const dna = traderDNA.getDNAForPrompt();
      return dna ? this._trimToTokens(dna, maxTokens) : '';
    } catch {
      return '';
    }
  }

  private _formatChartContext(ctx: ChartContext, _maxTokens: number): string {
    const parts = [`--- Current Chart: ${ctx.symbol} ${ctx.timeframe} ---`];
    parts.push(`Price: $${ctx.price.toLocaleString()}`);
    if (ctx.regime) parts.push(`Regime: ${ctx.regime}`);
    if (ctx.rsi !== undefined) parts.push(`RSI: ${ctx.rsi.toFixed(1)}`);
    if (ctx.emaSpread !== undefined) parts.push(`EMA Spread: ${ctx.emaSpread.toFixed(2)}%`);
    if (ctx.volume) parts.push(`Volume: ${ctx.volume}`);
    if (ctx.openPosition) {
      parts.push(`Open Position: ${ctx.openPosition.side}, P&L: $${ctx.openPosition.pnl.toFixed(2)}`);
    }
    return parts.join('\n');
  }

  private _estimateTokens(text: string): number {
    return countTokens(text);
  }

  private _trimToTokens(text: string, maxTokens: number): string {
    return trimToTokenBudget(text, maxTokens);
  }
}

// ─── Singleton ──────────────────────────────────────────────────

export const promptAssembler = new PromptAssembler();
export default promptAssembler;
