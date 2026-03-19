// ═══════════════════════════════════════════════════════════════════
// charEdge — AI Watchlist Curator (Sprint 85)
//
// Recommends symbols to add to the user's watchlist based on
// trading history, market conditions, and sector analysis.
//
// Usage:
//   import { watchlistCurator } from './WatchlistCurator';
//   const suggestions = await watchlistCurator.suggest(trades, currentWatchlist);
// ═══════════════════════════════════════════════════════════════════

// ─── Types ───────────────────────────────────────────────────────

export interface WatchlistSuggestion {
  symbol: string;
  reason: string;
  confidence: number;    // 0–100
  source: 'history' | 'trending' | 'sector' | 'ai';
}

// ─── Curator ────────────────────────────────────────────────────

class WatchlistCurator {
  /**
   * Generate watchlist suggestions.
   */
  async suggest(
    trades: Record<string, unknown>[],
    currentWatchlist: string[] = [],
    maxSuggestions = 5,
  ): Promise<WatchlistSuggestion[]> {
    const suggestions: WatchlistSuggestion[] = [];
    const alreadyWatching = new Set(currentWatchlist.map(s => s.toUpperCase()));

    // Strategy 1: Best-performing symbols from history
    const historySuggestions = this._fromHistory(trades, alreadyWatching);
    suggestions.push(...historySuggestions);

    // Strategy 2: Trending symbols (Reddit)
    const trendingSuggestions = await this._fromTrending(alreadyWatching);
    suggestions.push(...trendingSuggestions);

    // Strategy 3: AI-powered reasoning (if we have enough context)
    if (trades.length >= 10) {
      const aiSuggestions = await this._fromAI(trades, currentWatchlist);
      suggestions.push(...aiSuggestions);
    }

    // Deduplicate and sort by confidence
    const seen = new Set<string>();
    const unique = suggestions.filter(s => {
      const key = s.symbol.toUpperCase();
      if (seen.has(key) || alreadyWatching.has(key)) return false;
      seen.add(key);
      return true;
    });

    return unique
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, maxSuggestions);
  }

  // ─── Strategies ──────────────────────────────────────────────

  private _fromHistory(
    trades: Record<string, unknown>[],
    exclude: Set<string>,
  ): WatchlistSuggestion[] {
    const symbolStats = new Map<string, { wins: number; total: number; totalPnl: number }>();

    for (const t of trades) {
      const sym = typeof t.symbol === 'string' ? t.symbol.toUpperCase() : '';
      if (!sym || exclude.has(sym)) continue;

      const stats = symbolStats.get(sym) || { wins: 0, total: 0, totalPnl: 0 };
      stats.total++;
      if (typeof t.pnl === 'number') {
        stats.totalPnl += t.pnl;
        if (t.pnl > 0) stats.wins++;
      }
      symbolStats.set(sym, stats);
    }

    const results: WatchlistSuggestion[] = [];
    for (const [symbol, stats] of symbolStats) {
      if (stats.total < 3) continue;
      const winRate = stats.wins / stats.total;
      if (winRate >= 0.5 && stats.totalPnl > 0) {
        results.push({
          symbol,
          reason: `${Math.round(winRate * 100)}% win rate across ${stats.total} trades ($${stats.totalPnl.toFixed(0)} total P&L)`,
          confidence: Math.min(90, Math.round(winRate * 60 + Math.min(30, stats.total * 2))),
          source: 'history',
        });
      }
    }

    return results.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
  }

  private async _fromTrending(exclude: Set<string>): Promise<WatchlistSuggestion[]> {
    try {
      const { sentimentAdapter } = await import('../data/adapters/SentimentAdapter.js');
      const trending = await sentimentAdapter.fetchRedditTrending('all-stocks', 1);
      if (!trending?.length) return [];

      return trending
        .filter((t: Record<string, unknown>) => {
          const sym = typeof t.symbol === 'string' ? t.symbol : '';
          return sym && !exclude.has(sym.toUpperCase());
        })
        .slice(0, 3)
        .map((t: Record<string, unknown>) => ({
          symbol: String(t.symbol).toUpperCase(),
          reason: `Trending on Reddit — ${t.mentions} mentions (rank #${t.rank})`,
          confidence: Math.min(70, 30 + (typeof t.mentions === 'number' ? Math.min(40, t.mentions / 5) : 0)),
          source: 'trending' as const,
        }));
    } catch {
      return [];
    }
  }

  private async _fromAI(
    trades: Record<string, unknown>[],
    watchlist: string[],
  ): Promise<WatchlistSuggestion[]> {
    // Summarize trading history
    const symbols = [...new Set(trades.map(t => typeof t.symbol === 'string' ? t.symbol : '').filter(Boolean))];
    const topSymbols = symbols.slice(0, 10).join(', ');

    const prompt = `Based on a trader who frequently trades ${topSymbols} and currently watches ${watchlist.join(', ') || 'nothing'}, suggest 2-3 correlated or complementary symbols they should add to their watchlist.

For each, provide: symbol and a 1-sentence reason.
Format: SYMBOL: reason
Only suggest real, popular trading symbols.`;

    try {
      const { aiRouter } = await import('./AIRouter');
      const result = await aiRouter.route({
        type: 'classify',
        messages: [
          { role: 'system', content: 'You are a watchlist advisor. Suggest correlated or complementary symbols. Be specific.' },
          { role: 'user', content: prompt },
        ],
        maxTokens: 150,
        temperature: 0.4,
      });

      // Parse "SYMBOL: reason" format
      const lines = result.content.split('\n').filter(l => l.includes(':'));
      return lines.slice(0, 3).map(line => {
        const [sym, ...rest] = line.split(':');
        const cleanSym = sym.replace(/[^A-Z]/gi, '').toUpperCase();
        return {
          symbol: cleanSym,
          reason: rest.join(':').trim() || 'AI-suggested based on your trading pattern',
          confidence: 60,
          source: 'ai' as const,
        };
      }).filter(s => s.symbol.length >= 2 && s.symbol.length <= 6);
    } catch {
      return [];
    }
  }
}

// ─── Singleton ──────────────────────────────────────────────────

export const watchlistCurator = new WatchlistCurator();
export default watchlistCurator;
