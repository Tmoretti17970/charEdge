// ═══════════════════════════════════════════════════════════════════
// charEdge — Portfolio Risk Analyzer (Sprint 23)
//
// Calculates real-time risk metrics from open positions.
// Powers L1 responses for risk-related copilot queries.
//
// Usage:
//   import { portfolioRiskAnalyzer } from './PortfolioRiskAnalyzer';
//   const analysis = portfolioRiskAnalyzer.analyze(trades, portfolioValue);
// ═══════════════════════════════════════════════════════════════════

// ─── Types ──────────────────────────────────────────────────────

export interface PositionRisk {
  symbol: string;
  side: string;
  size: number;
  unrealizedPnl: number;
  pctOfPortfolio: number;
  riskAmount: number;        // estimated $ at risk (distance to stop or 2% default)
}

export interface RiskAnalysis {
  totalExposure: number;
  totalUnrealizedPnl: number;
  positionCount: number;
  positions: PositionRisk[];
  largestPosition: { symbol: string; pct: number } | null;
  riskPerTrade: number;
  concentrationWarning: string | null;
  diversificationScore: number;    // 0-10
  summary: string;
}

interface Trade {
  pnl?: number;
  side?: string;
  symbol?: string;
  quantity?: number;
  size?: number;
  amount?: number;
  entryPrice?: number;
  currentPrice?: number;
  stopLoss?: number;
  exitDate?: string | number | Date | null;
  status?: string;
  isOpen?: boolean;
}

// ─── Analyzer ───────────────────────────────────────────────────

class PortfolioRiskAnalyzer {
  /**
   * Analyze risk from an array of trades, filtering to open positions.
   * @param trades All trades (open + closed)
   * @param portfolioValue Total portfolio value (for % calculations)
   */
  analyze(trades: Trade[], portfolioValue = 10000): RiskAnalysis {
    const openPositions = this._getOpenPositions(trades);

    if (openPositions.length === 0) {
      return {
        totalExposure: 0,
        totalUnrealizedPnl: 0,
        positionCount: 0,
        positions: [],
        largestPosition: null,
        riskPerTrade: 0,
        concentrationWarning: null,
        diversificationScore: 10,
        summary: '📊 **Risk Dashboard**\n\nNo open positions. Your portfolio is fully in cash — 0% exposure.\n\nUse the copilot to analyze setups before entering your next trade.',
      };
    }

    // ── Calculate per-position risk ──────────────────────────
    const positions: PositionRisk[] = openPositions.map(t => {
      const positionSize = this._getPositionValue(t);
      const pctOfPortfolio = portfolioValue > 0 ? (positionSize / portfolioValue) * 100 : 0;
      const unrealizedPnl = typeof t.pnl === 'number' ? t.pnl : 0;
      const riskAmount = this._estimateRisk(t, positionSize);

      return {
        symbol: (t.symbol || 'Unknown').toUpperCase(),
        side: (t.side || 'long').toLowerCase(),
        size: positionSize,
        unrealizedPnl,
        pctOfPortfolio,
        riskAmount,
      };
    });

    // ── Aggregate metrics ────────────────────────────────────
    const totalExposure = positions.reduce((s, p) => s + p.size, 0);
    const totalUnrealizedPnl = positions.reduce((s, p) => s + p.unrealizedPnl, 0);
    const totalRisk = positions.reduce((s, p) => s + p.riskAmount, 0);
    const riskPerTrade = positions.length > 0 ? totalRisk / positions.length : 0;

    // ── Largest position ─────────────────────────────────────
    const sorted = [...positions].sort((a, b) => b.pctOfPortfolio - a.pctOfPortfolio);
    const largest = sorted[0] || null;
    const largestPosition = largest 
      ? { symbol: largest.symbol, pct: largest.pctOfPortfolio }
      : null;

    // ── Concentration check ──────────────────────────────────
    let concentrationWarning: string | null = null;
    if (largest && largest.pctOfPortfolio > 30) {
      concentrationWarning = `⚠️ ${largest.symbol} represents ${largest.pctOfPortfolio.toFixed(0)}% of your portfolio — consider reducing for better diversification`;
    }

    // ── Diversification score ────────────────────────────────
    const uniqueSymbols = new Set(positions.map(p => p.symbol)).size;
    const exposurePct = portfolioValue > 0 ? (totalExposure / portfolioValue) * 100 : 0;
    let diversificationScore = Math.min(10, uniqueSymbols * 2);
    if (largest && largest.pctOfPortfolio > 50) diversificationScore = Math.max(0, diversificationScore - 4);
    else if (largest && largest.pctOfPortfolio > 30) diversificationScore = Math.max(0, diversificationScore - 2);
    if (exposurePct > 80) diversificationScore = Math.max(0, diversificationScore - 2);

    // ── Summary ──────────────────────────────────────────────
    const summary = this._buildSummary(
      positions, totalExposure, totalUnrealizedPnl, totalRisk,
      portfolioValue, concentrationWarning, diversificationScore,
    );

    return {
      totalExposure,
      totalUnrealizedPnl,
      positionCount: positions.length,
      positions,
      largestPosition,
      riskPerTrade,
      concentrationWarning,
      diversificationScore,
      summary,
    };
  }

  // ── Helpers ────────────────────────────────────────────────

  private _getOpenPositions(trades: Trade[]): Trade[] {
    return trades.filter(t => {
      if (t.isOpen === true) return true;
      if (t.status === 'open') return true;
      if (!t.exitDate && t.entryPrice) return true;
      return false;
    });
  }

  private _getPositionValue(t: Trade): number {
    const qty = t.quantity ?? t.size ?? t.amount ?? 1;
    const price = t.currentPrice ?? t.entryPrice ?? 0;
    return Math.abs(qty * price);
  }

  private _estimateRisk(t: Trade, positionValue: number): number {
    // If stop loss is set, use distance to stop
    if (t.stopLoss && t.entryPrice && t.entryPrice > 0) {
      const riskPct = Math.abs(t.entryPrice - t.stopLoss) / t.entryPrice;
      return positionValue * riskPct;
    }
    // Default: assume 2% risk per trade
    return positionValue * 0.02;
  }

  private _buildSummary(
    positions: PositionRisk[],
    totalExposure: number,
    totalUPnl: number,
    totalRisk: number,
    portfolioValue: number,
    concentrationWarning: string | null,
    divScore: number,
  ): string {
    const parts: string[] = [];
    const exposurePct = portfolioValue > 0 ? (totalExposure / portfolioValue) * 100 : 0;
    const riskPct = portfolioValue > 0 ? (totalRisk / portfolioValue) * 100 : 0;

    const riskEmoji = riskPct > 10 ? '🔴' : riskPct > 5 ? '🟡' : '🟢';

    parts.push(`**${riskEmoji} Risk Dashboard** (${positions.length} open position${positions.length !== 1 ? 's' : ''})\n`);

    // Core metrics
    parts.push(`**Total exposure:** $${totalExposure.toLocaleString(undefined, { maximumFractionDigits: 0 })} (${exposurePct.toFixed(1)}% of portfolio)`);
    parts.push(`**Total at risk:** $${totalRisk.toLocaleString(undefined, { maximumFractionDigits: 0 })} (${riskPct.toFixed(1)}% of portfolio)`);

    const pnlEmoji = totalUPnl >= 0 ? '📈' : '📉';
    const pnlSign = totalUPnl >= 0 ? '+' : '';
    parts.push(`**Unrealized P&L:** ${pnlEmoji} ${pnlSign}$${totalUPnl.toFixed(2)}`);

    // Position breakdown
    if (positions.length > 0 && positions.length <= 6) {
      parts.push('');
      parts.push('**Positions:**');
      for (const p of positions) {
        const sideIcon = p.side === 'short' ? '🔻' : '🔹';
        const pnlStr = p.unrealizedPnl >= 0
          ? `+$${p.unrealizedPnl.toFixed(2)}`
          : `-$${Math.abs(p.unrealizedPnl).toFixed(2)}`;
        parts.push(`${sideIcon} **${p.symbol}** — ${p.pctOfPortfolio.toFixed(1)}% of portfolio · ${pnlStr}`);
      }
    } else if (positions.length > 6) {
      parts.push('');
      const top3 = positions.sort((a, b) => b.size - a.size).slice(0, 3);
      parts.push('**Top 3 by size:**');
      for (const p of top3) {
        parts.push(`• **${p.symbol}** — ${p.pctOfPortfolio.toFixed(1)}% of portfolio`);
      }
      parts.push(`*...and ${positions.length - 3} more*`);
    }

    // Warnings
    if (concentrationWarning) {
      parts.push('');
      parts.push(concentrationWarning);
    }

    if (riskPct > 10) {
      parts.push('');
      parts.push('⚠️ Total risk exceeds 10% of portfolio — consider tightening stops or reducing position sizes');
    }

    // Diversification
    parts.push('');
    const divLabel = divScore >= 8 ? 'Good' : divScore >= 5 ? 'Fair' : 'Poor';
    parts.push(`**Diversification:** ${divLabel} (${divScore}/10)`);

    return parts.join('\n');
  }
}

// ─── Singleton ──────────────────────────────────────────────────

export const portfolioRiskAnalyzer = new PortfolioRiskAnalyzer();
export default portfolioRiskAnalyzer;
