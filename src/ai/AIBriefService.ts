// ═══════════════════════════════════════════════════════════════════
// charEdge — AI Morning Brief Service (Sprint 76)
//
// Pre-market AI briefing: overnight moves, key levels, watchlist
// movers, fear & greed, and focus suggestions. Generated via
// AIRouter → Gemini.
//
// Usage:
//   import { aiBriefService } from './AIBriefService';
//   const brief = await aiBriefService.generate(watchlist);
// ═══════════════════════════════════════════════════════════════════

// ─── Types ───────────────────────────────────────────────────────

export interface MorningBrief {
  marketOverview: string;
  watchlistMoves: WatchlistMove[];
  focusTrades: string;
  riskNotes: string;
  raw: string;
  tier: string;
  generatedAt: number;
}

export interface WatchlistMove {
  symbol: string;
  change: number;
  note: string;
}

// ─── Cache ──────────────────────────────────────────────────────

const CACHE_KEY = 'charEdge-morning-brief';

// ─── Service ────────────────────────────────────────────────────

class AIBriefService {
  /**
   * Generate (or return cached) morning brief.
   */
  async generate(watchlist: string[] = []): Promise<MorningBrief> {
    // Return cached brief if generated today
    const cached = this._getCached();
    if (cached) return cached;

    // Gather market data
    const fearGreed = await this._getFearGreed();
    const watchlistData = await this._getWatchlistData(watchlist);

    // Build prompt
    const prompt = `Generate a concise pre-market trading briefing.

Market Context:
- Fear & Greed Index: ${fearGreed ? `${fearGreed.value} (${fearGreed.classification})` : 'unavailable'}

Watchlist: ${watchlist.length > 0 ? watchlist.join(', ') : 'No watchlist configured'}

${watchlistData.length > 0 ? `Watchlist Price Changes:\n${watchlistData.map(w => `- ${w.symbol}: ${w.change > 0 ? '+' : ''}${w.change.toFixed(2)}%`).join('\n')}` : ''}

Provide:
**MARKET OVERVIEW**: 2-sentence market condition summary
**FOCUS TRADES**: 2-3 symbols worth watching today and why
**RISK NOTES**: Key risks or events to be aware of

Keep under 200 words total. Be specific and actionable.`;

    try {
      const { aiRouter } = await import('./AIRouter');
      const result = await aiRouter.route({
        type: 'narrate',
        messages: [
          { role: 'system', content: 'You are a trading desk analyst providing a concise morning briefing. Be direct and data-driven.' },
          { role: 'user', content: prompt },
        ],
        maxTokens: 350,
        temperature: 0.3,
      });

      const brief: MorningBrief = {
        marketOverview: this._extract(result.content, 'MARKET OVERVIEW'),
        watchlistMoves: watchlistData,
        focusTrades: this._extract(result.content, 'FOCUS TRADES'),
        riskNotes: this._extract(result.content, 'RISK NOTES'),
        raw: result.content,
        tier: result.tier,
        generatedAt: Date.now(),
      };

      this._cache(brief);
      return brief;
    } catch {
      return {
        marketOverview: 'AI brief unavailable. Check API keys in Settings.',
        watchlistMoves: watchlistData,
        focusTrades: '',
        riskNotes: '',
        raw: '',
        tier: 'L1',
        generatedAt: Date.now(),
      };
    }
  }

  // ─── Data Gathering ──────────────────────────────────────────

  private async _getFearGreed() {
    try {
      const { sentimentAdapter } = await import('../data/adapters/SentimentAdapter.js');
      const fg = await sentimentAdapter.fetchFearGreed();
      return fg?.current || null;
    } catch { return null; }
  }

  private async _getWatchlistData(symbols: string[]): Promise<WatchlistMove[]> {
    const results: WatchlistMove[] = [];
    try {
      const { fetchFundamentals } = await import('../data/FundamentalService.js');
      for (const sym of symbols.slice(0, 10)) {
        try {
          const data = await fetchFundamentals(sym);
          if (data?.priceChange24h != null) {
            results.push({
              symbol: sym,
              change: data.priceChange24h,
              note: data.priceChange24h > 3 ? '📈 Strong move' :
                    data.priceChange24h < -3 ? '📉 Selling pressure' : '',
            });
          }
        } catch { /* skip */ }
      }
    } catch { /* */ }
    return results;
  }

  // ─── Caching ─────────────────────────────────────────────────

  private _getCached(): MorningBrief | null {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const brief = JSON.parse(raw) as MorningBrief;
      const today = new Date().toISOString().split('T')[0];
      const briefDay = new Date(brief.generatedAt).toISOString().split('T')[0];
      return briefDay === today ? brief : null;
    } catch { return null; }
  }

  private _cache(brief: MorningBrief): void {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(brief));
    } catch { /* */ }
  }

  private _extract(text: string, header: string): string {
    const regex = new RegExp(`\\*\\*${header}\\*\\*[:\\s]*([\\s\\S]*?)(?=\\*\\*[A-Z]|$)`, 'i');
    const match = text.match(regex);
    return match ? match[1].trim() : '';
  }
}

// ─── Singleton ──────────────────────────────────────────────────

export const aiBriefService = new AIBriefService();
export default aiBriefService;
