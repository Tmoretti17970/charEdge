// ═══════════════════════════════════════════════════════════════════
// charEdge — Social Sentiment Scorer (AI Copilot Sprint 10)
//
// Lightweight keyword-based NLP sentiment scorer for text snippets.
// Aggregates scores from multiple text sources into a single signal.
//
// Usage:
//   import { socialSentimentScorer } from './SocialSentimentScorer';
//   const score = socialSentimentScorer.scoreText('Bitcoin pumping hard!');
//   const aggregate = socialSentimentScorer.aggregate(texts);
// ═══════════════════════════════════════════════════════════════════

// ─── Types ──────────────────────────────────────────────────────

export interface SentimentScore {
  score: number;         // -1 to 1 (negative bearish, positive bullish)
  magnitude: number;     // 0-1 (how strongly expressed)
  label: 'very_bearish' | 'bearish' | 'neutral' | 'bullish' | 'very_bullish';
}

export interface AggregatedSentiment {
  averageScore: number;
  averageMagnitude: number;
  label: string;
  sampleSize: number;
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
}

// ─── Lexicons ───────────────────────────────────────────────────

const BULLISH_WORDS = new Set([
  'bullish', 'moon', 'pump', 'rally', 'breakout', 'surge', 'soar', 'rip',
  'buy', 'long', 'hodl', 'accumulate', 'recovery', 'uptrend', 'green',
  'oversold', 'bottom', 'dip', 'opportunity', 'higher', 'strong', 'support',
  'bounce', 'reversal', 'launch', 'rocket', 'gains', 'profit', 'winning',
  'explosive', 'momentum', 'parabolic', 'undervalued', 'upgrade', 'adoption',
]);

const BEARISH_WORDS = new Set([
  'bearish', 'crash', 'dump', 'sell', 'short', 'tank', 'plunge', 'drop',
  'decline', 'downtrend', 'red', 'overbought', 'top', 'bubble', 'weak',
  'resistance', 'breakdown', 'fear', 'panic', 'capitulation', 'rekt',
  'loss', 'losing', 'overvalued', 'scam', 'rug', 'fraud', 'collapse',
  'correction', 'death', 'cross', 'bleed', 'pain', 'downgrade', 'ban',
]);

const INTENSIFIERS = new Set([
  'very', 'extremely', 'super', 'insanely', 'massive', 'huge', 'major',
  'absolutely', 'incredibly', 'definitely', 'strongly',
]);

const NEGATORS = new Set([
  'not', 'no', 'never', "don't", "won't", "isn't", "aren't", "wasn't",
  "doesn't", "can't", "couldn't", "shouldn't",
]);

// ─── Scorer ─────────────────────────────────────────────────────

export class SocialSentimentScorer {
  /**
   * Score a single text snippet.
   */
  scoreText(text: string): SentimentScore {
    if (!text || text.trim().length === 0) {
      return { score: 0, magnitude: 0, label: 'neutral' };
    }

    const words = text.toLowerCase().replace(/[^a-z\s']/g, '').split(/\s+/);
    let rawScore = 0;
    let wordCount = 0;
    let intensity = 1;
    // Phase 3 Task #36: 3-word negation window (was 1-word)
    let negationCountdown = 0; // counts down from 3 when a negator is found

    for (let i = 0; i < words.length; i++) {
      const word = words[i];

      // Track negation — extends 3 words ahead
      if (NEGATORS.has(word)) {
        negationCountdown = 3;
        continue;
      }

      // Track intensity
      if (INTENSIFIERS.has(word)) {
        intensity = 1.5;
        continue;
      }

      const isNegated = negationCountdown > 0;

      // Score
      if (BULLISH_WORDS.has(word)) {
        rawScore += (isNegated ? -1 : 1) * intensity;
        wordCount++;
      } else if (BEARISH_WORDS.has(word)) {
        rawScore += (isNegated ? 1 : -1) * intensity;
        wordCount++;
      }

      // Decrement negation window and reset intensity after use
      if (negationCountdown > 0) negationCountdown--;
      intensity = 1;
    }

    // Normalize to -1..1
    const maxPossible = Math.max(1, wordCount);
    const normalizedScore = Math.max(-1, Math.min(1, rawScore / maxPossible));
    const magnitude = Math.min(1, wordCount / Math.max(1, words.length) * 3);

    return {
      score: Math.round(normalizedScore * 100) / 100,
      magnitude: Math.round(magnitude * 100) / 100,
      label: this._scoreToLabel(normalizedScore),
    };
  }

  /**
   * Aggregate sentiment from multiple text snippets.
   */
  aggregate(texts: string[]): AggregatedSentiment {
    if (texts.length === 0) {
      return {
        averageScore: 0,
        averageMagnitude: 0,
        label: 'Neutral',
        sampleSize: 0,
        bullishCount: 0,
        bearishCount: 0,
        neutralCount: 0,
      };
    }

    const scores = texts.map(t => this.scoreText(t));
    const totalScore = scores.reduce((s, sc) => s + sc.score, 0);
    const totalMag = scores.reduce((s, sc) => s + sc.magnitude, 0);

    const bullishCount = scores.filter(s => s.score > 0.15).length;
    const bearishCount = scores.filter(s => s.score < -0.15).length;
    const neutralCount = scores.length - bullishCount - bearishCount;

    const avgScore = totalScore / scores.length;

    return {
      averageScore: Math.round(avgScore * 100) / 100,
      averageMagnitude: Math.round((totalMag / scores.length) * 100) / 100,
      label: this._aggLabel(avgScore),
      sampleSize: scores.length,
      bullishCount,
      bearishCount,
      neutralCount,
    };
  }

  /**
   * Get aggregated sentiment for AI context.
   */
  getAggregateForAI(texts: string[]): string {
    const agg = this.aggregate(texts);
    if (agg.sampleSize === 0) return '';
    return `Social Sentiment: ${agg.label} (${agg.averageScore.toFixed(2)}) — ${agg.bullishCount} bullish, ${agg.bearishCount} bearish, ${agg.neutralCount} neutral from ${agg.sampleSize} sources`;
  }

  // ── Helpers ─────────────────────────────────────────────────

  private _scoreToLabel(score: number): SentimentScore['label'] {
    if (score <= -0.5) return 'very_bearish';
    if (score <= -0.15) return 'bearish';
    if (score >= 0.5) return 'very_bullish';
    if (score >= 0.15) return 'bullish';
    return 'neutral';
  }

  private _aggLabel(score: number): string {
    if (score <= -0.4) return 'Very Bearish';
    if (score <= -0.15) return 'Bearish';
    if (score >= 0.4) return 'Very Bullish';
    if (score >= 0.15) return 'Bullish';
    return 'Neutral';
  }
}

// ─── Singleton ──────────────────────────────────────────────────

export const socialSentimentScorer = new SocialSentimentScorer();
export default socialSentimentScorer;
