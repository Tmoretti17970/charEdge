// ═══════════════════════════════════════════════════════════════════
// charEdge — Quick Ask Engine (AI Copilot Sprint 17)
//
// Context-aware pre-built prompt injection. Returns available
// quick-ask buttons based on the user's current view.
//
// Usage:
//   import { quickAskEngine } from './QuickAskEngine';
//   const asks = quickAskEngine.getQuickAsks('chart');
// ═══════════════════════════════════════════════════════════════════

import type { PromptMode } from './PromptAssembler';

// ─── Types ──────────────────────────────────────────────────────

export type ViewContext = 'chart' | 'journal' | 'dashboard' | 'markets' | 'trade_detail';

export interface QuickAsk {
  id: string;
  label: string;
  emoji: string;
  prompt: string;              // Pre-built prompt text
  mode: PromptMode;            // Which mode to use
  requiresChartContext: boolean;
}

// ─── Quick Ask Definitions ──────────────────────────────────────

const QUICK_ASKS: Record<ViewContext, QuickAsk[]> = {
  chart: [
    { id: 'chart_see', label: 'What do you see?', emoji: '👁️', prompt: 'Analyze the current chart. What patterns, signals, and key levels stand out?', mode: 'analysis', requiresChartContext: true },
    { id: 'chart_trade', label: 'Should I trade this?', emoji: '🎯', prompt: 'Based on the current setup, should I take a trade here? Consider risk/reward, confluence, and my trading style.', mode: 'analysis', requiresChartContext: true },
    { id: 'chart_risk', label: 'Risk analysis', emoji: '⚠️', prompt: 'What are the key risks on this chart? Where are the danger zones and what could go wrong with a trade here?', mode: 'analysis', requiresChartContext: true },
    { id: 'chart_levels', label: 'Key levels', emoji: '📊', prompt: 'Identify the most important support and resistance levels on this chart.', mode: 'analysis', requiresChartContext: true },
  ],
  journal: [
    { id: 'journal_wrong', label: 'What went wrong?', emoji: '❌', prompt: 'Analyze this trade and explain what went wrong. What could I have done differently?', mode: 'coaching', requiresChartContext: false },
    { id: 'journal_similar', label: 'Similar trades?', emoji: '🔍', prompt: 'Find trades in my journal with a similar setup to this one. How did they turn out?', mode: 'journal', requiresChartContext: false },
    { id: 'journal_lesson', label: 'Key lesson', emoji: '💡', prompt: 'What is the single most important lesson from this trade?', mode: 'coaching', requiresChartContext: false },
  ],
  dashboard: [
    { id: 'dash_summary', label: 'Weekly summary', emoji: '📋', prompt: 'Give me a summary of my trading performance this week. Wins, losses, and key patterns.', mode: 'coaching', requiresChartContext: false },
    { id: 'dash_edge', label: "What's my edge?", emoji: '🎲', prompt: 'Based on my trading history, what is my strongest edge? Where do I consistently make money?', mode: 'coaching', requiresChartContext: false },
    { id: 'dash_improve', label: 'How to improve', emoji: '📈', prompt: 'What is the #1 thing I should focus on improving in my trading right now?', mode: 'coaching', requiresChartContext: false },
  ],
  markets: [
    { id: 'market_scan', label: 'Top opportunities', emoji: '🔍', prompt: 'What are the best trading opportunities in my watchlist right now?', mode: 'analysis', requiresChartContext: false },
    { id: 'market_sentiment', label: 'Market mood', emoji: '🌡️', prompt: 'What is the overall market sentiment right now? Fear or greed?', mode: 'analysis', requiresChartContext: false },
  ],
  trade_detail: [
    { id: 'trade_grade', label: 'Grade this trade', emoji: '🏆', prompt: 'Grade this trade on execution quality, risk management, and adherence to my trading plan.', mode: 'coaching', requiresChartContext: false },
    { id: 'trade_improve', label: 'Could I do better?', emoji: '🛠️', prompt: 'Looking at this trade, what specific improvements could I make to my process?', mode: 'coaching', requiresChartContext: false },
  ],
};

// ─── Engine ─────────────────────────────────────────────────────

export class QuickAskEngine {
  /**
   * Get available quick asks for a view context.
   */
  getQuickAsks(context: ViewContext): QuickAsk[] {
    return [...(QUICK_ASKS[context] || [])];
  }

  /**
   * Get all quick asks across all contexts.
   */
  getAllQuickAsks(): Record<ViewContext, QuickAsk[]> {
    const result: Record<string, QuickAsk[]> = {};
    for (const [ctx, asks] of Object.entries(QUICK_ASKS)) {
      result[ctx] = [...asks];
    }
    return result as Record<ViewContext, QuickAsk[]>;
  }

  /**
   * Get a specific quick ask by ID.
   */
  getQuickAskById(id: string): QuickAsk | null {
    for (const asks of Object.values(QUICK_ASKS)) {
      const found = asks.find(a => a.id === id);
      if (found) return { ...found };
    }
    return null;
  }

  /**
   * Get available view contexts.
   */
  getAvailableContexts(): ViewContext[] {
    return Object.keys(QUICK_ASKS) as ViewContext[];
  }
}

// ─── Singleton ──────────────────────────────────────────────────

export const quickAskEngine = new QuickAskEngine();
export default quickAskEngine;
