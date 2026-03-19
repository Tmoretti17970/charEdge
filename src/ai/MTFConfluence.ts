// ═══════════════════════════════════════════════════════════════════
// charEdge — Multi-Timeframe Confluence Detector (Sprint 82)
//
// Analyzes trend/momentum agreement across multiple timeframes.
// Returns a confluence score (0–100) and per-TF breakdown.
//
// Usage:
//   import { mtfConfluence } from './MTFConfluence';
//   const result = mtfConfluence.analyze({ '5': bars5m, '60': bars1h, '1D': barsDaily });
// ═══════════════════════════════════════════════════════════════════

// ─── Types ───────────────────────────────────────────────────────

export interface Bar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TFSignal {
  timeframe: string;
  trend: 'bullish' | 'bearish' | 'neutral';
  momentum: 'strong' | 'moderate' | 'weak';
  emaSlope: number;
  rsiValue: number;
  vwapPosition: 'above' | 'below' | 'at';
  score: number; // -100 to 100
}

export interface ConfluenceResult {
  score: number;          // 0–100 (100 = perfect agreement)
  direction: 'bullish' | 'bearish' | 'neutral';
  signals: TFSignal[];
  summary: string;
}

// ─── Detector ───────────────────────────────────────────────────

class MTFConfluence {
  /**
   * Analyze confluence across timeframes.
   * @param barsByTF Map of timeframe → bars array
   */
  analyze(barsByTF: Record<string, Bar[]>): ConfluenceResult {
    const signals: TFSignal[] = [];

    for (const [tf, bars] of Object.entries(barsByTF)) {
      if (!bars || bars.length < 20) continue;
      signals.push(this._analyzeTimeframe(tf, bars));
    }

    if (signals.length === 0) {
      return { score: 0, direction: 'neutral', signals: [], summary: 'Insufficient data' };
    }

    // Calculate confluence score
    const avgScore = signals.reduce((s, sig) => s + sig.score, 0) / signals.length;
    const allSameDirection = signals.every(s => s.trend === signals[0].trend);
    const majorityDirection = this._getMajority(signals.map(s => s.trend));

    // Confluence = how much the TFs agree
    let confluence: number;
    if (allSameDirection && signals[0].trend !== 'neutral') {
      confluence = Math.min(100, Math.abs(avgScore) + 20);
    } else if (majorityDirection !== 'neutral') {
      const agreeing = signals.filter(s => s.trend === majorityDirection).length;
      confluence = Math.round((agreeing / signals.length) * 70);
    } else {
      confluence = Math.max(0, 30 - Math.abs(avgScore));
    }

    const summary = this._buildSummary(signals, confluence, majorityDirection);

    return {
      score: Math.round(confluence),
      direction: majorityDirection,
      signals,
      summary,
    };
  }

  // ─── Per-Timeframe Analysis ──────────────────────────────────

  private _analyzeTimeframe(tf: string, bars: Bar[]): TFSignal {
    const closes = bars.map(b => b.close);
    const n = closes.length;

    // EMA 20 slope
    const ema20 = this._ema(closes, 20);
    const emaSlope = n >= 3 ? (ema20[n - 1] - ema20[n - 3]) / ema20[n - 3] * 100 : 0;

    // RSI 14
    const rsi = this._rsi(closes, 14);

    // VWAP position (simplified: price vs average)
    const vwap = closes.reduce((s, c) => s + c, 0) / n;
    const lastClose = closes[n - 1];
    const vwapPosition: 'above' | 'below' | 'at' =
      lastClose > vwap * 1.001 ? 'above' : lastClose < vwap * 0.999 ? 'below' : 'at';

    // Determine trend
    const trend: 'bullish' | 'bearish' | 'neutral' =
      emaSlope > 0.1 && rsi > 45 ? 'bullish' :
      emaSlope < -0.1 && rsi < 55 ? 'bearish' : 'neutral';

    const momentum: 'strong' | 'moderate' | 'weak' =
      Math.abs(emaSlope) > 0.5 ? 'strong' :
      Math.abs(emaSlope) > 0.15 ? 'moderate' : 'weak';

    // Composite score: -100 to 100
    const rsiScore = ((rsi - 50) / 50) * 30;
    const emaScore = Math.max(-30, Math.min(30, emaSlope * 10));
    const vwapScore = vwapPosition === 'above' ? 15 : vwapPosition === 'below' ? -15 : 0;
    const score = Math.round(rsiScore + emaScore + vwapScore);

    return {
      timeframe: tf,
      trend,
      momentum,
      emaSlope: Math.round(emaSlope * 100) / 100,
      rsiValue: Math.round(rsi * 10) / 10,
      vwapPosition,
      score: Math.max(-100, Math.min(100, score)),
    };
  }

  // ─── Indicators ──────────────────────────────────────────────

  private _ema(data: number[], period: number): number[] {
    const result: number[] = [];
    const k = 2 / (period + 1);

    result[0] = data[0];
    for (let i = 1; i < data.length; i++) {
      result[i] = data[i] * k + result[i - 1] * (1 - k);
    }
    return result;
  }

  private _rsi(data: number[], period: number): number {
    if (data.length < period + 1) return 50;

    let gains = 0, losses = 0;
    for (let i = data.length - period; i < data.length; i++) {
      const change = data[i] - data[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) return 100;

    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  }

  // ─── Helpers ─────────────────────────────────────────────────

  private _getMajority(trends: string[]): 'bullish' | 'bearish' | 'neutral' {
    const counts: Record<string, number> = {};
    for (const t of trends) counts[t] = (counts[t] || 0) + 1;

    let maxCount = 0, maxTrend = 'neutral';
    for (const [trend, count] of Object.entries(counts)) {
      if (count > maxCount) { maxCount = count; maxTrend = trend; }
    }
    return maxTrend as 'bullish' | 'bearish' | 'neutral';
  }

  private _buildSummary(signals: TFSignal[], confluence: number, direction: string): string {
    const tfs = signals.map(s => `${s.timeframe}(${s.trend})`).join(', ');
    const strength = confluence >= 70 ? 'Strong' : confluence >= 40 ? 'Moderate' : 'Weak';
    return `${strength} ${direction} confluence (${confluence}%) across ${signals.length} TFs: ${tfs}`;
  }

  // ─── Sprint 9: Weighted Analysis ────────────────────────────

  /** Default TF weights — higher timeframes weighted more */
  private static readonly TF_WEIGHTS: Record<string, number> = {
    '1': 0.5, '3': 0.6, '5': 0.7, '15': 0.8, '30': 0.9,
    '60': 1.0, '240': 1.2, '1D': 1.5, 'D': 1.5, '1W': 1.8, 'W': 1.8,
  };

  /**
   * Weighted confluence analysis — higher TFs carry more weight.
   */
  analyzeWeighted(
    barsByTF: Record<string, Bar[]>,
    customWeights?: Record<string, number>,
  ): ConfluenceResult {
    const weights = customWeights || MTFConfluence.TF_WEIGHTS;
    const signals: TFSignal[] = [];

    for (const [tf, bars] of Object.entries(barsByTF)) {
      if (!bars || bars.length < 20) continue;
      signals.push(this._analyzeTimeframe(tf, bars));
    }

    if (signals.length === 0) {
      return { score: 0, direction: 'neutral', signals: [], summary: 'Insufficient data' };
    }

    // Weighted average score
    let weightedSum = 0, totalWeight = 0;
    for (const sig of signals) {
      const w = weights[sig.timeframe] ?? 1.0;
      weightedSum += sig.score * w;
      totalWeight += w;
    }
    const weightedAvg = totalWeight > 0 ? weightedSum / totalWeight : 0;

    const majorityDirection = this._getWeightedMajority(signals, weights);
    const alignment = this.getAlignmentStrength(signals);

    // Weighted confluence score
    let confluence: number;
    if (alignment === 1.0 && signals[0].trend !== 'neutral') {
      confluence = Math.min(100, Math.abs(weightedAvg) + 30);
    } else if (alignment >= 0.6) {
      confluence = Math.round(alignment * 80);
    } else {
      confluence = Math.max(0, 25 - Math.abs(weightedAvg));
    }

    return {
      score: Math.round(confluence),
      direction: majorityDirection,
      signals,
      summary: this._buildSummary(signals, Math.round(confluence), majorityDirection),
    };
  }

  /**
   * How strongly TFs agree (0-1). 1 = perfect alignment.
   */
  getAlignmentStrength(signals?: TFSignal[]): number {
    const sigs = signals || [];
    if (sigs.length <= 1) return 1;

    const directions = sigs.map(s => s.trend);
    const majority = this._getMajority(directions);
    const agreeing = directions.filter(d => d === majority).length;

    return agreeing / directions.length;
  }

  /**
   * Formatted confluence for AI context.
   */
  getConfluenceForAI(barsByTF: Record<string, Bar[]>): string {
    const result = this.analyzeWeighted(barsByTF);
    if (result.score === 0) return '';
    return `--- MTF Confluence ---\n${result.summary}`;
  }

  private _getWeightedMajority(
    signals: TFSignal[],
    weights: Record<string, number>,
  ): 'bullish' | 'bearish' | 'neutral' {
    const counts: Record<string, number> = {};
    for (const sig of signals) {
      const w = weights[sig.timeframe] ?? 1.0;
      counts[sig.trend] = (counts[sig.trend] || 0) + w;
    }
    let maxW = 0, maxTrend = 'neutral';
    for (const [trend, w] of Object.entries(counts)) {
      if (w > maxW) { maxW = w; maxTrend = trend; }
    }
    return maxTrend as 'bullish' | 'bearish' | 'neutral';
  }
}

// ─── Singleton ──────────────────────────────────────────────────

export const mtfConfluence = new MTFConfluence();
export default mtfConfluence;
