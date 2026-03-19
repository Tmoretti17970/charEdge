// ═══════════════════════════════════════════════════════════════════
// charEdge — AI Session Review (Sprint 71)
//
// End-of-day AI coaching digest. Aggregates the day's trades,
// journal entries, and coaching interactions, then sends to
// Gemini (1M context) for deep analysis.
//
// Usage:
//   import { aiSessionReview } from './AISessionReview';
//   const review = await aiSessionReview.generate();
// ═══════════════════════════════════════════════════════════════════

// ─── Types ───────────────────────────────────────────────────────

export interface SessionReview {
  overview: string;
  strengths: string;
  mistakes: string;
  patterns: string;
  actionItems: string;
  raw: string;
  tier: string;
  timestamp: number;
}

// ─── Service ────────────────────────────────────────────────────

class AISessionReviewService {
  /**
   * Generate a full session review from today's data.
   */
  async generate(): Promise<SessionReview> {
    // Gather today's data
    const trades = await this._getTodaysTrades();
    const journalEntries = await this._getTodaysJournal();

    // Build context prompt
    const tradeSummary = trades.length > 0
      ? trades.map((t: Record<string, unknown>, i: number) =>
          `${i + 1}. ${t.symbol || '?'} ${t.side || '?'} | Entry: $${t.entryPrice} → Exit: $${t.exitPrice || '?'} | P&L: $${typeof t.pnl === 'number' ? t.pnl.toFixed(2) : '?'} | ${t.emotion || 'no emotion noted'}`
        ).join('\n')
      : 'No trades today.';

    const journalSummary = journalEntries.length > 0
      ? journalEntries.map((j: Record<string, unknown>, i: number) =>
          `${i + 1}. ${(j.notes as string || j.text as string || '').slice(0, 100)}`
        ).join('\n')
      : 'No journal entries today.';

    const totalPnl = trades.reduce((sum: number, t: Record<string, unknown>) =>
      sum + (typeof t.pnl === 'number' ? t.pnl : 0), 0);
    const winCount = trades.filter((t: Record<string, unknown>) =>
      typeof t.pnl === 'number' && t.pnl > 0).length;

    const prompt = `Generate an end-of-day trading session review.

Session Stats:
- Trades: ${trades.length}
- Win Rate: ${trades.length > 0 ? Math.round((winCount / trades.length) * 100) : 0}%
- Total P&L: $${totalPnl.toFixed(2)}
- Journal Entries: ${journalEntries.length}

Trade Log:
${tradeSummary}

Journal Notes:
${journalSummary}

Provide a structured review with these sections:

**OVERVIEW**: 2-sentence summary of the session
**STRENGTHS**: What went well (be specific, cite trades)
**MISTAKES**: What needs improvement (be direct but constructive)
**PATTERNS**: Recurring behaviors or setups observed
**ACTION ITEMS**: 2-3 specific things to work on tomorrow

Keep total length under 300 words. Be direct and actionable.`;

    try {
      const { aiRouter } = await import('./AIRouter');
      const result = await aiRouter.route({
        type: 'complex',  // Use L4 (Gemini) for long context
        messages: [
          { role: 'system', content: 'You are an expert trading performance coach. Provide structured, actionable session reviews. Use markdown headers.' },
          { role: 'user', content: prompt },
        ],
        maxTokens: 500,
        temperature: 0.4,
      });

      return {
        overview: this._extractSection(result.content, 'OVERVIEW'),
        strengths: this._extractSection(result.content, 'STRENGTHS'),
        mistakes: this._extractSection(result.content, 'MISTAKES'),
        patterns: this._extractSection(result.content, 'PATTERNS'),
        actionItems: this._extractSection(result.content, 'ACTION ITEMS'),
        raw: result.content,
        tier: result.tier,
        timestamp: Date.now(),
      };
    } catch {
      return {
        overview: `${trades.length} trades today, ${winCount}W/${trades.length - winCount}L, P&L: $${totalPnl.toFixed(2)}`,
        strengths: 'Unable to generate AI review. Check your API keys in Settings.',
        mistakes: '',
        patterns: '',
        actionItems: '',
        raw: '',
        tier: 'L1',
        timestamp: Date.now(),
      };
    }
  }

  // ─── Data Gathering ──────────────────────────────────────────

  private async _getTodaysTrades(): Promise<Record<string, unknown>[]> {
    try {
      const { useJournalStore } = await import('../state/useJournalStore');
      const trades = useJournalStore.getState().trades || [];
      const today = new Date().toISOString().split('T')[0];
      return trades.filter((t: Record<string, unknown>) => {
        const dateStr = String(t.date || t.exitTime || t.entryTime || '');
        return dateStr.startsWith(today);
      });
    } catch {
      return [];
    }
  }

  private async _getTodaysJournal(): Promise<Record<string, unknown>[]> {
    try {
      const { useJournalStore } = await import('../state/useJournalStore');
      const entries = useJournalStore.getState().entries || [];
      const today = new Date().toISOString().split('T')[0];
      return entries.filter((e: Record<string, unknown>) => {
        const dateStr = String(e.date || e.timestamp || '');
        return dateStr.startsWith(today);
      });
    } catch {
      return [];
    }
  }

  // ─── Section Extraction ──────────────────────────────────────

  private _extractSection(text: string, header: string): string {
    const regex = new RegExp(`\\*\\*${header}\\*\\*[:\\s]*([\\s\\S]*?)(?=\\*\\*[A-Z]|$)`, 'i');
    const match = text.match(regex);
    return match ? match[1].trim() : '';
  }
}

// ─── Singleton ──────────────────────────────────────────────────

export const aiSessionReview = new AISessionReviewService();
export default aiSessionReview;
