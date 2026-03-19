// ═══════════════════════════════════════════════════════════════════
// charEdge — Sentiment Feed (AI Copilot Sprint 10)
//
// Aggregates sentiment from free public sources:
//   - Alternative.me Fear & Greed Index
//   - CoinGecko trending / market data
//   - Configurable RSS feeds
//
// No API keys required. Results cached to avoid rate limits.
//
// Usage:
//   import { sentimentFeed } from './SentimentFeed';
//   const sentiment = await sentimentFeed.fetchSentiment('BTC');
// ═══════════════════════════════════════════════════════════════════

// ─── Types ──────────────────────────────────────────────────────

export interface SentimentBadge {
  score: number;            // 0-100 (0=extreme fear, 100=extreme greed)
  label: string;            // 'Extreme Fear', 'Fear', 'Neutral', 'Greed', 'Extreme Greed'
  emoji: string;
  source: string;
}

export interface TrendingCoin {
  id: string;
  name: string;
  symbol: string;
  marketCapRank: number;
  score: number;
}

export interface SentimentResult {
  fearGreed: SentimentBadge | null;
  trending: TrendingCoin[];
  overallSentiment: 'extreme_fear' | 'fear' | 'neutral' | 'greed' | 'extreme_greed';
  fetchedAt: number;
  summary: string;
}

// ─── Cache ──────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
  ttl: number;
}

// ─── Feed ───────────────────────────────────────────────────────

export class SentimentFeed {
  private _cache = new Map<string, CacheEntry<unknown>>();
  private _defaultTTL = 10 * 60 * 1000; // 10 minutes

  /**
   * Fetch aggregated sentiment.
   */
  async fetchSentiment(_symbol?: string): Promise<SentimentResult> {
    const fearGreed = await this.getFearGreedIndex();
    const trending = await this.getTrending();

    const overallSentiment = fearGreed
      ? this._classifySentiment(fearGreed.score)
      : 'neutral';

    const summary = this._buildSummary(fearGreed, trending, overallSentiment);

    return {
      fearGreed,
      trending,
      overallSentiment,
      fetchedAt: Date.now(),
      summary,
    };
  }

  /**
   * Get Fear & Greed Index.
   */
  async getFearGreedIndex(): Promise<SentimentBadge | null> {
    const cached = this._getCache<SentimentBadge>('fearGreed');
    if (cached) return cached;

    try {
      const res = await fetch('https://api.alternative.me/fng/?limit=1');
      if (!res.ok) return null;

      const data = await res.json();
      const entry = data?.data?.[0];
      if (!entry) return null;

      const score = parseInt(entry.value, 10);
      const badge: SentimentBadge = {
        score,
        label: entry.value_classification || this._scoreToLabel(score),
        emoji: this._scoreToEmoji(score),
        source: 'Alternative.me',
      };

      this._setCache('fearGreed', badge, this._defaultTTL);
      return badge;
    } catch {
      return null;
    }
  }

  /**
   * Get trending coins from CoinGecko.
   */
  async getTrending(): Promise<TrendingCoin[]> {
    const cached = this._getCache<TrendingCoin[]>('trending');
    if (cached) return cached;

    try {
      const res = await fetch('https://api.coingecko.com/api/v3/search/trending');
      if (!res.ok) return [];

      const data = await res.json();
      const coins: TrendingCoin[] = (data?.coins || []).slice(0, 7).map((c: any) => ({
        id: c.item?.id || '',
        name: c.item?.name || '',
        symbol: c.item?.symbol || '',
        marketCapRank: c.item?.market_cap_rank || 0,
        score: c.item?.score || 0,
      }));

      this._setCache('trending', coins, this._defaultTTL);
      return coins;
    } catch {
      return [];
    }
  }

  /**
   * Get a compact sentiment badge for UI display.
   */
  async getSentimentBadge(): Promise<SentimentBadge | null> {
    return this.getFearGreedIndex();
  }

  /**
   * Get formatted sentiment for AI context.
   */
  async getSentimentForAI(): Promise<string> {
    const result = await this.fetchSentiment();
    if (!result.fearGreed && result.trending.length === 0) return '';
    return `--- Market Sentiment ---\n${result.summary}`;
  }

  // ── Classification ──────────────────────────────────────────

  private _classifySentiment(score: number): SentimentResult['overallSentiment'] {
    if (score <= 20) return 'extreme_fear';
    if (score <= 40) return 'fear';
    if (score <= 60) return 'neutral';
    if (score <= 80) return 'greed';
    return 'extreme_greed';
  }

  private _scoreToLabel(score: number): string {
    if (score <= 20) return 'Extreme Fear';
    if (score <= 40) return 'Fear';
    if (score <= 60) return 'Neutral';
    if (score <= 80) return 'Greed';
    return 'Extreme Greed';
  }

  private _scoreToEmoji(score: number): string {
    if (score <= 20) return '😱';
    if (score <= 40) return '😰';
    if (score <= 60) return '😐';
    if (score <= 80) return '😄';
    return '🤑';
  }

  // ── Summary ─────────────────────────────────────────────────

  private _buildSummary(
    fearGreed: SentimentBadge | null,
    trending: TrendingCoin[],
    overall: string,
  ): string {
    const parts: string[] = [];

    if (fearGreed) {
      parts.push(`Fear & Greed: ${fearGreed.score}/100 (${fearGreed.label} ${fearGreed.emoji})`);
    }

    if (trending.length > 0) {
      const names = trending.slice(0, 3).map(c => c.symbol.toUpperCase());
      parts.push(`Trending: ${names.join(', ')}`);
    }

    parts.push(`Overall: ${overall.replace(/_/g, ' ')}`);

    return parts.join(' | ');
  }

  // ── Cache Helpers ───────────────────────────────────────────

  private _getCache<T>(key: string): T | null {
    const entry = this._cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() - entry.fetchedAt > entry.ttl) {
      this._cache.delete(key);
      return null;
    }
    return entry.data;
  }

  private _setCache<T>(key: string, data: T, ttl: number): void {
    this._cache.set(key, { data, fetchedAt: Date.now(), ttl });
  }
}

// ─── Singleton ──────────────────────────────────────────────────

export const sentimentFeed = new SentimentFeed();
export default sentimentFeed;
