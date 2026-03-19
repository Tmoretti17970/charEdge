// ═══════════════════════════════════════════════════════════════════
// charEdge — Chart Context Analyzer (Sprint 21)
//
// Pure-heuristic chart analysis module for L1 responses.
// Reads price, indicators, and regime to produce structured
// analysis with trend bias, signals, confluence, and a markdown
// summary. No LLM needed — instant responses.
//
// Usage:
//   import { chartContextAnalyzer } from './ChartContextAnalyzer';
//   const analysis = chartContextAnalyzer.analyze(ctx);
// ═══════════════════════════════════════════════════════════════════

import type { ChartContext } from './PromptAssembler';

// ─── Types ──────────────────────────────────────────────────────

export type Bias = 'bullish' | 'bearish' | 'neutral';
export type SignalStrength = 'strong' | 'moderate' | 'weak';

export interface AnalysisSignal {
  label: string;
  bias: Bias;
  strength: SignalStrength;
  detail: string;
}

export interface KeyLevel {
  price: number;
  label: string;          // e.g. "200 EMA support", "RSI oversold zone"
}

export interface ChartAnalysis {
  symbol: string;
  timeframe: string;
  bias: Bias;
  confidence: number;           // 0-1
  signals: AnalysisSignal[];    // up to 6
  keyLevels: KeyLevel[];
  confluenceScore: number;      // 0-10
  riskNote: string | null;
  summary: string;              // Markdown summary
}

// ─── Extended Context (optional fields from chart state) ────────

export interface ExtendedChartContext extends ChartContext {
  ema20?: number;
  ema50?: number;
  ema200?: number;
  macdLine?: number;
  macdSignal?: number;
  macdHistogram?: number;
  atr?: number;
  volumeRatio?: number;     // current / 20-period avg (>1 = above avg)
  dayHigh?: number;
  dayLow?: number;
  prevClose?: number;
}

// ─── Analyzer ───────────────────────────────────────────────────

class ChartContextAnalyzer {
  /**
   * Analyze chart context and produce a structured analysis.
   */
  analyze(ctx: ExtendedChartContext): ChartAnalysis {
    const signals: AnalysisSignal[] = [];
    const keyLevels: KeyLevel[] = [];
    let riskNote: string | null = null;

    // ── 1. Trend via EMAs ────────────────────────────────────
    if (ctx.price && ctx.ema200) {
      const pctAbove200 = ((ctx.price - ctx.ema200) / ctx.ema200) * 100;

      if (pctAbove200 > 2) {
        signals.push({
          label: 'Above 200 EMA',
          bias: 'bullish',
          strength: pctAbove200 > 10 ? 'strong' : 'moderate',
          detail: `Price is ${pctAbove200.toFixed(1)}% above the 200 EMA — long-term uptrend`,
        });
        keyLevels.push({ price: ctx.ema200, label: '200 EMA support' });
      } else if (pctAbove200 < -2) {
        signals.push({
          label: 'Below 200 EMA',
          bias: 'bearish',
          strength: pctAbove200 < -10 ? 'strong' : 'moderate',
          detail: `Price is ${Math.abs(pctAbove200).toFixed(1)}% below the 200 EMA — long-term downtrend`,
        });
        keyLevels.push({ price: ctx.ema200, label: '200 EMA resistance' });
      } else {
        signals.push({
          label: 'Near 200 EMA',
          bias: 'neutral',
          strength: 'weak',
          detail: 'Price is near the 200 EMA — trend is undecided at this level',
        });
        keyLevels.push({ price: ctx.ema200, label: '200 EMA pivot' });
      }
    }

    // ── EMA stack (20 > 50 > 200 = bullish alignment) ────────
    if (ctx.ema20 && ctx.ema50 && ctx.ema200) {
      if (ctx.ema20 > ctx.ema50 && ctx.ema50 > ctx.ema200) {
        signals.push({
          label: 'EMA Stack Bullish',
          bias: 'bullish',
          strength: 'strong',
          detail: '20 > 50 > 200 EMA — all moving averages aligned bullish',
        });
      } else if (ctx.ema20 < ctx.ema50 && ctx.ema50 < ctx.ema200) {
        signals.push({
          label: 'EMA Stack Bearish',
          bias: 'bearish',
          strength: 'strong',
          detail: '20 < 50 < 200 EMA — all moving averages aligned bearish',
        });
      }

      // Key levels from EMAs
      if (ctx.ema20) keyLevels.push({ price: ctx.ema20, label: '20 EMA' });
      if (ctx.ema50) keyLevels.push({ price: ctx.ema50, label: '50 EMA' });
    }

    // ── 2. RSI Analysis ──────────────────────────────────────
    if (ctx.rsi !== undefined) {
      if (ctx.rsi > 80) {
        signals.push({
          label: 'RSI Extremely Overbought',
          bias: 'bearish',
          strength: 'strong',
          detail: `RSI at ${ctx.rsi.toFixed(1)} — extreme overbought; high probability of pullback`,
        });
        riskNote = '⚠️ RSI extreme overbought (>80) — avoid new longs, watch for reversal signals';
      } else if (ctx.rsi > 70) {
        signals.push({
          label: 'RSI Overbought',
          bias: 'bearish',
          strength: 'moderate',
          detail: `RSI at ${ctx.rsi.toFixed(1)} — overbought zone; in strong trends RSI can stay here`,
        });
      } else if (ctx.rsi < 20) {
        signals.push({
          label: 'RSI Extremely Oversold',
          bias: 'bullish',
          strength: 'strong',
          detail: `RSI at ${ctx.rsi.toFixed(1)} — extreme oversold; high probability of bounce`,
        });
        riskNote = '⚠️ RSI extreme oversold (<20) — potential capitulation bounce incoming';
      } else if (ctx.rsi < 30) {
        signals.push({
          label: 'RSI Oversold',
          bias: 'bullish',
          strength: 'moderate',
          detail: `RSI at ${ctx.rsi.toFixed(1)} — oversold zone; watch for reversal candles`,
        });
      } else if (ctx.rsi >= 45 && ctx.rsi <= 55) {
        signals.push({
          label: 'RSI Neutral',
          bias: 'neutral',
          strength: 'weak',
          detail: `RSI at ${ctx.rsi.toFixed(1)} — mid-range, no momentum signal`,
        });
      }
    }

    // ── 3. MACD ──────────────────────────────────────────────
    if (ctx.macdLine !== undefined && ctx.macdSignal !== undefined) {
      const macdCross = ctx.macdLine - ctx.macdSignal;
      if (macdCross > 0) {
        signals.push({
          label: 'MACD Bullish',
          bias: 'bullish',
          strength: ctx.macdHistogram && ctx.macdHistogram > 0 ? 'moderate' : 'weak',
          detail: 'MACD line above signal line — bullish momentum',
        });
      } else if (macdCross < 0) {
        signals.push({
          label: 'MACD Bearish',
          bias: 'bearish',
          strength: ctx.macdHistogram && ctx.macdHistogram < 0 ? 'moderate' : 'weak',
          detail: 'MACD line below signal line — bearish momentum',
        });
      }
    }

    // ── 4. Volume Read ───────────────────────────────────────
    if (ctx.volumeRatio !== undefined) {
      if (ctx.volumeRatio > 2.5) {
        signals.push({
          label: 'Volume Climax',
          bias: 'neutral',
          strength: 'strong',
          detail: `Volume is ${ctx.volumeRatio.toFixed(1)}x average — potential climax/exhaustion`,
        });
        if (!riskNote) riskNote = '⚠️ Volume climax — possible exhaustion move, exercise caution';
      } else if (ctx.volumeRatio > 1.5) {
        signals.push({
          label: 'High Volume',
          bias: 'neutral',
          strength: 'moderate',
          detail: `Volume is ${ctx.volumeRatio.toFixed(1)}x average — confirms price action`,
        });
      } else if (ctx.volumeRatio < 0.5) {
        signals.push({
          label: 'Low Volume',
          bias: 'neutral',
          strength: 'weak',
          detail: `Volume is ${ctx.volumeRatio.toFixed(1)}x average — low conviction move`,
        });
      }
    } else if (ctx.volume) {
      // Fallback: use text label from PromptAssembler
      if (ctx.volume === 'high') {
        signals.push({ label: 'High Volume', bias: 'neutral', strength: 'moderate', detail: 'Volume above average' });
      } else if (ctx.volume === 'low') {
        signals.push({ label: 'Low Volume', bias: 'neutral', strength: 'weak', detail: 'Volume below average' });
      }
    }

    // ── 5. Regime Tag ────────────────────────────────────────
    if (ctx.regime) {
      const regime = ctx.regime.toLowerCase();
      if (regime === 'trending' || regime === 'uptrend') {
        signals.push({ label: 'Trending Regime', bias: 'bullish', strength: 'moderate', detail: 'Market is in a trending regime — favor momentum/breakout strategies' });
      } else if (regime === 'downtrend') {
        signals.push({ label: 'Downtrend Regime', bias: 'bearish', strength: 'moderate', detail: 'Market is in a downtrend regime — favor short-side or mean-reversion' });
      } else if (regime === 'ranging' || regime === 'choppy') {
        signals.push({ label: 'Ranging Regime', bias: 'neutral', strength: 'moderate', detail: 'Market is range-bound — favor mean-reversion strategies, avoid breakout chasing' });
      } else if (regime === 'volatile' || regime === 'high_volatility') {
        signals.push({ label: 'High Volatility', bias: 'neutral', strength: 'moderate', detail: 'Elevated volatility — reduce position size and widen stops' });
        if (!riskNote) riskNote = '⚠️ High volatility regime — consider reducing position size';
      }
    }

    // ── 6. Day range / previous close ────────────────────────
    if (ctx.prevClose && ctx.price) {
      const dayChange = ((ctx.price - ctx.prevClose) / ctx.prevClose) * 100;
      if (Math.abs(dayChange) > 5) {
        const direction = dayChange > 0 ? 'up' : 'down';
        signals.push({
          label: `Big Day Move (${direction})`,
          bias: dayChange > 0 ? 'bullish' : 'bearish',
          strength: Math.abs(dayChange) > 10 ? 'strong' : 'moderate',
          detail: `${direction === 'up' ? '📈' : '📉'} ${Math.abs(dayChange).toFixed(1)}% move from previous close`,
        });
      }
    }

    // ── Compute Bias + Confluence ─────────────────────────────
    const { bias, confidence, confluenceScore } = this._computeBias(signals);

    // ── Generate Summary ─────────────────────────────────────
    const summary = this._buildSummary(ctx, bias, confidence, signals, keyLevels, riskNote);

    return {
      symbol: ctx.symbol,
      timeframe: ctx.timeframe,
      bias,
      confidence,
      signals: signals.slice(0, 6),
      keyLevels,
      confluenceScore,
      riskNote,
      summary,
    };
  }

  /**
   * Quick bias check (for UI badges, etc.)
   */
  quickBias(ctx: ExtendedChartContext): Bias {
    return this.analyze(ctx).bias;
  }

  // ── Internal: Bias Computation ─────────────────────────────

  private _computeBias(signals: AnalysisSignal[]): { bias: Bias; confidence: number; confluenceScore: number } {
    const strengthWeight: Record<SignalStrength, number> = { strong: 3, moderate: 2, weak: 1 };
    let bullishScore = 0;
    let bearishScore = 0;
    let totalWeight = 0;

    for (const s of signals) {
      const w = strengthWeight[s.strength];
      totalWeight += w;
      if (s.bias === 'bullish') bullishScore += w;
      else if (s.bias === 'bearish') bearishScore += w;
    }

    if (totalWeight === 0) return { bias: 'neutral', confidence: 0, confluenceScore: 0 };

    const netScore = bullishScore - bearishScore;
    const maxPossible = totalWeight;
    const normalizedScore = netScore / maxPossible; // -1 to +1

    let bias: Bias;
    if (normalizedScore > 0.2) bias = 'bullish';
    else if (normalizedScore < -0.2) bias = 'bearish';
    else bias = 'neutral';

    // Confidence: how much do signals agree?
    const dominantScore = Math.max(bullishScore, bearishScore);
    const confidence = totalWeight > 0 ? Math.min(dominantScore / totalWeight, 1) : 0;

    // Confluence: count of aligned signals (non-neutral in dominant direction)
    const alignedCount = signals.filter(s => s.bias === bias && s.bias !== 'neutral').length;
    const confluenceScore = Math.min(alignedCount * 2, 10);

    return { bias, confidence, confluenceScore };
  }

  // ── Internal: Summary Builder ──────────────────────────────

  private _buildSummary(
    ctx: ExtendedChartContext,
    bias: Bias,
    confidence: number,
    signals: AnalysisSignal[],
    keyLevels: KeyLevel[],
    riskNote: string | null,
  ): string {
    const parts: string[] = [];
    const biasEmoji = bias === 'bullish' ? '🟢' : bias === 'bearish' ? '🔴' : '🟡';
    const confLabel = confidence > 0.7 ? 'High' : confidence > 0.4 ? 'Moderate' : 'Low';

    parts.push(`**${biasEmoji} ${ctx.symbol} ${ctx.timeframe} — ${bias.charAt(0).toUpperCase() + bias.slice(1)} Bias** (${confLabel} confidence)\n`);

    if (ctx.price) {
      parts.push(`Current price: **$${ctx.price.toLocaleString()}**`);
    }

    // Top signals (non-neutral, strongest first)
    const topSignals = signals
      .filter(s => s.bias !== 'neutral')
      .sort((a, b) => {
        const w: Record<SignalStrength, number> = { strong: 3, moderate: 2, weak: 1 };
        return w[b.strength] - w[a.strength];
      })
      .slice(0, 3);

    if (topSignals.length > 0) {
      parts.push('');
      parts.push('**Key signals:**');
      for (const s of topSignals) {
        const icon = s.bias === 'bullish' ? '↑' : '↓';
        parts.push(`• ${icon} ${s.detail}`);
      }
    }

    // Neutral / informational signals
    const infoSignals = signals.filter(s => s.bias === 'neutral' && s.strength !== 'weak');
    if (infoSignals.length > 0) {
      for (const s of infoSignals) {
        parts.push(`• ℹ️ ${s.detail}`);
      }
    }

    // Key levels
    if (keyLevels.length > 0) {
      parts.push('');
      parts.push('**Key levels:** ' + keyLevels.slice(0, 4).map(l => `${l.label} ($${l.price.toLocaleString()})`).join(' · '));
    }

    // Risk note
    if (riskNote) {
      parts.push('');
      parts.push(riskNote);
    }

    return parts.join('\n');
  }
}

// ─── Singleton ──────────────────────────────────────────────────

export const chartContextAnalyzer = new ChartContextAnalyzer();
export default chartContextAnalyzer;
