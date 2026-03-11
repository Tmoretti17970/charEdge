// ═══════════════════════════════════════════════════════════════════
// charEdge — AI Trade Coach
//
// Rule-based trade grading engine. Analyzes completed trades for
// entry quality, risk management, exit timing, and behavioral
// patterns. Returns A–F letter grades with actionable feedback.
//
// Future: Hook into Gemini/LLM for more nuanced analysis.
// ═══════════════════════════════════════════════════════════════════

import { Calc } from '../model/Calc.js';
import { AI_DISCLAIMER } from './AIChartAnalysis.js';

// ─── Grade Constants ─────────────────────────────────────────────

const _GRADES = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F'];
const GRADE_COLORS = {
  'A+': '#00E676', 'A': '#26A69A', 'A-': '#26A69A',
  'B+': '#66BB6A', 'B': '#66BB6A', 'B-': '#9CCC65',
  'C+': '#FFCA28', 'C': '#FFA726', 'C-': '#FF9800',
  'D+': '#FF7043', 'D': '#EF5350', 'D-': '#EF5350',
  'F': '#D32F2F',
};

function scoreToGrade(score) {
  // score: 0-100 → grade
  if (score >= 97) return 'A+';
  if (score >= 93) return 'A';
  if (score >= 90) return 'A-';
  if (score >= 87) return 'B+';
  if (score >= 83) return 'B';
  if (score >= 80) return 'B-';
  if (score >= 77) return 'C+';
  if (score >= 73) return 'C';
  if (score >= 70) return 'C-';
  if (score >= 67) return 'D+';
  if (score >= 63) return 'D';
  if (score >= 60) return 'D-';
  return 'F';
}

// ─── Main Grading Engine ─────────────────────────────────────────

/**
 * Grade a completed trade.
 *
 * @param {Object} trade - Trade object with:
 *   - side: 'long' | 'short'
 *   - entryPrice: number
 *   - exitPrice: number
 *   - stopLoss: number (optional)
 *   - takeProfit: number (optional)
 *   - entryTime: timestamp
 *   - exitTime: timestamp
 *   - pnl: number
 *   - volume: number (optional — position size)
 *   - accountSize: number (optional)
 * @param {Object[]} bars - Historical OHLCV data around the trade period
 * @param {Object} [options] - Grading options
 * @returns {TradeGrade}
 */
export function gradeTrade(trade, bars, _options = {}) {
  if (!trade || !bars?.length) {
    return createDefaultGrade('Insufficient data for grading');
  }

  // Find entry bar index
  const entryIdx = findBarIndex(bars, trade.entryTime);
  const exitIdx = findBarIndex(bars, trade.exitTime);

  if (entryIdx < 0) {
    return createDefaultGrade('Could not locate entry bar');
  }

  // Compute indicators for context
  const closes = bars.map(b => b.close);
  const lookback = Math.min(entryIdx, 50);

  const context = {
    sma20: lookback >= 20 ? Calc.sma(closes, 20) : null,
    sma50: lookback >= 50 ? Calc.sma(closes, 50) : null,
    rsi: lookback >= 15 ? Calc.rsi(closes, 14) : null,
    atr: lookback >= 15 ? Calc.atr(bars, 14) : null,
    bars,
    entryIdx,
    exitIdx: exitIdx >= 0 ? exitIdx : bars.length - 1,
  };

  // ─── Sub-grades ─────────────────────────────────────────────────
  const entry = gradeEntry(trade, context);
  const risk = gradeRiskManagement(trade, context);
  const exit = gradeExit(trade, context);
  const timing = gradeTiming(trade, context);

  // Weighted composite
  const weights = { entry: 0.30, risk: 0.30, exit: 0.25, timing: 0.15 };
  const overallScore = Math.round(
    entry.score * weights.entry +
    risk.score * weights.risk +
    exit.score * weights.exit +
    timing.score * weights.timing
  );

  const overallGrade = scoreToGrade(overallScore);

  // Build action items
  const actionItems = [
    ...entry.feedback.filter(f => f.type === 'improve'),
    ...risk.feedback.filter(f => f.type === 'improve'),
    ...exit.feedback.filter(f => f.type === 'improve'),
    ...timing.feedback.filter(f => f.type === 'improve'),
  ].slice(0, 3); // Max 3 items

  return {
    overallGrade,
    overallScore,
    overallColor: GRADE_COLORS[overallGrade],
    isWin: trade.pnl > 0,
    pnl: trade.pnl,
    categories: {
      entry: { grade: scoreToGrade(entry.score), score: entry.score, color: GRADE_COLORS[scoreToGrade(entry.score)], feedback: entry.feedback },
      risk: { grade: scoreToGrade(risk.score), score: risk.score, color: GRADE_COLORS[scoreToGrade(risk.score)], feedback: risk.feedback },
      exit: { grade: scoreToGrade(exit.score), score: exit.score, color: GRADE_COLORS[scoreToGrade(exit.score)], feedback: exit.feedback },
      timing: { grade: scoreToGrade(timing.score), score: timing.score, color: GRADE_COLORS[scoreToGrade(timing.score)], feedback: timing.feedback },
    },
    actionItems,
    timestamp: Date.now(),
    disclaimer: AI_DISCLAIMER,
  };
}

// ─── Entry Grade ─────────────────────────────────────────────────

function gradeEntry(trade, ctx) {
  let score = 70; // Start neutral
  const feedback = [];

  // Check: Was entry with the trend?
  if (ctx.sma20 && ctx.sma50) {
    const sma20 = ctx.sma20[ctx.entryIdx];
    const sma50 = ctx.sma50[ctx.entryIdx];
    if (sma20 && sma50) {
      const trendUp = sma20 > sma50;
      const withTrend = (trade.side === 'long' && trendUp) || (trade.side === 'short' && !trendUp);
      if (withTrend) {
        score += 15;
        feedback.push({ type: 'good', text: 'Entry aligned with the trend (SMA 20 > 50)' });
      } else {
        score -= 10;
        feedback.push({ type: 'improve', text: 'Entry was against the prevailing trend — consider waiting for trend alignment' });
      }
    }
  }

  // Check: Was RSI at an extreme (confirming entry)?
  if (ctx.rsi) {
    const rsiVal = ctx.rsi[ctx.entryIdx];
    if (rsiVal != null) {
      if (trade.side === 'long' && rsiVal < 35) {
        score += 10;
        feedback.push({ type: 'good', text: `RSI was oversold (${rsiVal.toFixed(0)}) at entry — good contrarian timing` });
      } else if (trade.side === 'short' && rsiVal > 65) {
        score += 10;
        feedback.push({ type: 'good', text: `RSI was overbought (${rsiVal.toFixed(0)}) at entry — good contrarian timing` });
      } else if (trade.side === 'long' && rsiVal > 75) {
        score -= 10;
        feedback.push({ type: 'improve', text: `RSI was overbought (${rsiVal.toFixed(0)}) when you went long — high risk of reversal` });
      } else if (trade.side === 'short' && rsiVal < 25) {
        score -= 10;
        feedback.push({ type: 'improve', text: `RSI was oversold (${rsiVal.toFixed(0)}) when you went short — high risk of bounce` });
      }
    }
  }

  // Check: Entry near support/resistance (bar high/low context)
  if (ctx.entryIdx >= 20) {
    const recentBars = ctx.bars.slice(ctx.entryIdx - 20, ctx.entryIdx);
    const recentHigh = Math.max(...recentBars.map(b => b.high));
    const recentLow = Math.min(...recentBars.map(b => b.low));
    const range = recentHigh - recentLow;

    if (range > 0) {
      const entryPosition = (trade.entryPrice - recentLow) / range;
      if (trade.side === 'long' && entryPosition < 0.3) {
        score += 10;
        feedback.push({ type: 'good', text: 'Entered long near the bottom of the recent range — good support entry' });
      } else if (trade.side === 'short' && entryPosition > 0.7) {
        score += 10;
        feedback.push({ type: 'good', text: 'Entered short near the top of the recent range — good resistance entry' });
      } else if (trade.side === 'long' && entryPosition > 0.8) {
        score -= 8;
        feedback.push({ type: 'improve', text: 'Entered long at the top of the range — consider entering at pullbacks instead' });
      }
    }
  }

  return { score: clamp(score, 0, 100), feedback };
}

// ─── Risk Management Grade ───────────────────────────────────────

function gradeRiskManagement(trade, ctx) {
  let score = 70;
  const feedback = [];

  // Check: Did they have a stop loss?
  if (trade.stopLoss) {
    score += 15;
    feedback.push({ type: 'good', text: 'Stop loss was set — good risk discipline' });

    // Check stop distance vs ATR
    if (ctx.atr) {
      const atrVal = ctx.atr[ctx.entryIdx];
      if (atrVal) {
        const stopDist = Math.abs(trade.entryPrice - trade.stopLoss);
        const atrMultiple = stopDist / atrVal;

        if (atrMultiple >= 1 && atrMultiple <= 2) {
          score += 10;
          feedback.push({ type: 'good', text: `Stop at ${atrMultiple.toFixed(1)}x ATR — well-placed` });
        } else if (atrMultiple < 0.5) {
          score -= 5;
          feedback.push({ type: 'improve', text: `Stop was too tight (${atrMultiple.toFixed(1)}x ATR) — prone to being stopped out by noise` });
        } else if (atrMultiple > 3) {
          score -= 8;
          feedback.push({ type: 'improve', text: `Stop was very wide (${atrMultiple.toFixed(1)}x ATR) — excessive risk per trade` });
        }
      }
    }
  } else {
    score -= 20;
    feedback.push({ type: 'improve', text: 'No stop loss was set — always define your risk before entering a trade' });
  }

  // Check: Risk-Reward Ratio
  if (trade.stopLoss && trade.takeProfit) {
    const risk = Math.abs(trade.entryPrice - trade.stopLoss);
    const reward = Math.abs(trade.takeProfit - trade.entryPrice);
    const rr = risk > 0 ? reward / risk : 0;

    if (rr >= 2) {
      score += 10;
      feedback.push({ type: 'good', text: `R:R ratio was ${rr.toFixed(1)}:1 — excellent risk/reward` });
    } else if (rr >= 1.5) {
      score += 5;
      feedback.push({ type: 'good', text: `R:R ratio was ${rr.toFixed(1)}:1 — acceptable` });
    } else if (rr < 1) {
      score -= 10;
      feedback.push({ type: 'improve', text: `R:R ratio was ${rr.toFixed(1)}:1 — risking more than potential reward` });
    }
  } else if (trade.stopLoss && !trade.takeProfit) {
    feedback.push({ type: 'improve', text: 'Consider setting a take-profit target to lock in gains' });
  }

  // Check: Position size vs account
  if (trade.accountSize && trade.volume) {
    const positionValue = trade.entryPrice * (trade.volume || 1);
    const riskPercent = trade.stopLoss
      ? (Math.abs(trade.entryPrice - trade.stopLoss) * (trade.volume || 1) / trade.accountSize) * 100
      : (positionValue / trade.accountSize) * 100;

    if (riskPercent <= 2) {
      score += 5;
      feedback.push({ type: 'good', text: `Risk per trade was ${riskPercent.toFixed(1)}% of account — disciplined sizing` });
    } else if (riskPercent > 5) {
      score -= 10;
      feedback.push({ type: 'improve', text: `Risk per trade was ${riskPercent.toFixed(1)}% of account — consider risking ≤2% per trade` });
    }
  }

  return { score: clamp(score, 0, 100), feedback };
}

// ─── Exit Grade ──────────────────────────────────────────────────

function gradeExit(trade, ctx) {
  let score = 70;
  const feedback = [];

  if (ctx.exitIdx <= ctx.entryIdx) {
    return { score, feedback: [{ type: 'improve', text: 'Unable to analyze exit timing' }] };
  }

  // Did they let winners run?
  if (trade.pnl > 0) {
    // Check: Was there more profit left on the table?
    const barsAfterExit = ctx.bars.slice(ctx.exitIdx, Math.min(ctx.exitIdx + 10, ctx.bars.length));
    if (barsAfterExit.length > 1) {
      const maxAfter = Math.max(...barsAfterExit.map(b => b.high));
      const minAfter = Math.min(...barsAfterExit.map(b => b.low));

      if (trade.side === 'long') {
        const moreUpside = ((maxAfter - trade.exitPrice) / trade.exitPrice) * 100;
        if (moreUpside > 2) {
          score -= 5;
          feedback.push({ type: 'improve', text: `Price moved ${moreUpside.toFixed(1)}% higher after exit — consider trailing your stop instead of exiting early` });
        } else {
          score += 10;
          feedback.push({ type: 'good', text: 'Good exit — captured most of the move' });
        }
        // A4.2: Short-side exit analysis — check remaining downside after cover
      } else if (trade.side === 'short') {
        const moreDownside = ((trade.exitPrice - minAfter) / trade.exitPrice) * 100;
        if (moreDownside > 2) {
          score -= 5;
          feedback.push({ type: 'improve', text: `Price dropped ${moreDownside.toFixed(1)}% more after cover — consider trailing your stop` });
        } else {
          score += 10;
          feedback.push({ type: 'good', text: 'Good cover — captured most of the downside' });
        }
      }
    }
  }

  // Did they cut losers quickly?
  if (trade.pnl < 0) {
    const holdingBars = ctx.exitIdx - ctx.entryIdx;
    const lossPct = Math.abs(trade.pnl / (trade.entryPrice * (trade.volume || 1))) * 100;

    if (lossPct < 2 && holdingBars < 10) {
      score += 10;
      feedback.push({ type: 'good', text: 'Quick exit on a losing trade — smart risk management' });
    } else if (lossPct > 5) {
      score -= 10;
      feedback.push({ type: 'improve', text: `Loss of ${lossPct.toFixed(1)}% — consider cutting losses earlier with a tighter stop` });
    } else if (holdingBars > 20) {
      score -= 5;
      feedback.push({ type: 'improve', text: `Held a losing trade for ${holdingBars} bars — consider time-based stops for stagnant trades` });
    }
  }

  return { score: clamp(score, 0, 100), feedback };
}

// ─── Timing Grade ────────────────────────────────────────────────

function gradeTiming(trade, ctx) {
  let score = 75;
  const feedback = [];

  // Check: Trade duration — was it reasonable for the timeframe?
  const holdingBars = ctx.exitIdx - ctx.entryIdx;

  if (holdingBars <= 1) {
    score -= 5;
    feedback.push({ type: 'improve', text: 'Very short hold time \u2014 ensure you\'re not overtrading or panic-exiting' });
  } else if (holdingBars >= 5 && holdingBars <= 30) {
    score += 5;
    feedback.push({ type: 'good', text: 'Reasonable holding period for the timeframe' });
  }

  // Check: Entry at session open/close (volatile periods)
  if (trade.entryTime) {
    const d = new Date(trade.entryTime);
    const hour = d.getUTCHours();
    // Morning session (high liquidity)
    if ((hour >= 13 && hour <= 15) || (hour >= 9 && hour <= 10)) {
      score += 5;
      feedback.push({ type: 'good', text: 'Entry during a high-liquidity session window' });
    }
  }

  return { score: clamp(score, 0, 100), feedback };
}

// ─── Behavioral Patterns ─────────────────────────────────────────

/**
 * Analyze a series of trade grades for behavioral patterns.
 * @param {TradeGrade[]} grades - Array of previous trade grades
 * @returns {Object[]} Array of detected patterns
 */
export function detectPatterns(grades) {
  if (!grades || grades.length < 5) return [];

  const patterns = [];

  // Pattern: Consistently bad entries
  const entryScores = grades.map(g => g.categories.entry.score);
  const avgEntry = entryScores.reduce((s, v) => s + v, 0) / entryScores.length;
  if (avgEntry < 65) {
    patterns.push({
      type: 'weakness',
      category: 'entry',
      title: 'Entry Timing Needs Work',
      description: `Your average entry grade is ${scoreToGrade(avgEntry)} — focus on waiting for trend confirmation before entering.`,
      severity: avgEntry < 55 ? 'high' : 'medium',
    });
  }

  // Pattern: No stops
  const riskScores = grades.map(g => g.categories.risk.score);
  const avgRisk = riskScores.reduce((s, v) => s + v, 0) / riskScores.length;
  if (avgRisk < 65) {
    patterns.push({
      type: 'weakness',
      category: 'risk',
      title: 'Risk Management Alert',
      description: 'You frequently trade without proper stop losses. This is the #1 reason traders lose money.',
      severity: 'high',
    });
  }

  // Pattern: Improving trend
  if (grades.length >= 10) {
    const recentAvg = grades.slice(0, 5).reduce((s, g) => s + g.overallScore, 0) / 5;
    const olderAvg = grades.slice(5, 10).reduce((s, g) => s + g.overallScore, 0) / 5;
    if (recentAvg > olderAvg + 5) {
      patterns.push({
        type: 'improvement',
        category: 'overall',
        title: 'You\'re Improving! 📈',
        description: `Your recent trades average ${scoreToGrade(recentAvg)} vs ${scoreToGrade(olderAvg)} previously.`,
        severity: 'positive',
      });
    } else if (recentAvg < olderAvg - 5) {
      patterns.push({
        type: 'decline',
        category: 'overall',
        title: 'Performance Declining ⚠️',
        description: `Your recent grades dropped from ${scoreToGrade(olderAvg)} to ${scoreToGrade(recentAvg)}. Take a break and review your rules.`,
        severity: 'high',
      });
    }
  }

  // Pattern: Winning streak or losing streak
  let streak = 0;
  const isWinStreak = grades[0]?.isWin;
  for (const g of grades) {
    if (g.isWin === isWinStreak) streak++;
    else break;
  }
  if (streak >= 5 && isWinStreak) {
    patterns.push({
      type: 'streak',
      category: 'wins',
      title: `${streak}-Trade Win Streak! 🔥`,
      description: 'You\'re in the zone. Stay disciplined and don\'t increase risk during streaks.',
      severity: 'positive',
    });
  } else if (streak >= 3 && !isWinStreak) {
    patterns.push({
      type: 'streak',
      category: 'losses',
      title: `${streak}-Trade Losing Streak`,
      description: 'Consider stepping away from the screen. Losing streaks often lead to revenge trading.',
      severity: 'high',
    });
  }

  return patterns;
}

// ─── Helpers ─────────────────────────────────────────────────────

function findBarIndex(bars, time) {
  if (!time || !bars.length) return -1;
  const t = typeof time === 'number' ? time : new Date(time).getTime();
  let closest = 0;
  let minDiff = Infinity;
  for (let i = 0; i < bars.length; i++) {
    const barTime = typeof bars[i].time === 'number' ? bars[i].time : new Date(bars[i].time).getTime();
    const diff = Math.abs(barTime - t);
    if (diff < minDiff) {
      minDiff = diff;
      closest = i;
    }
  }
  return closest;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function createDefaultGrade(reason) {
  const defaultCat = { grade: 'C', score: 73, color: GRADE_COLORS['C'], feedback: [{ type: 'improve', text: reason }] };
  return {
    overallGrade: 'C',
    overallScore: 73,
    overallColor: GRADE_COLORS['C'],
    isWin: false,
    pnl: 0,
    categories: { entry: defaultCat, risk: defaultCat, exit: defaultCat, timing: defaultCat },
    actionItems: [{ type: 'improve', text: reason }],
    timestamp: Date.now(),
    disclaimer: AI_DISCLAIMER,
  };
}

export { GRADE_COLORS, scoreToGrade };
