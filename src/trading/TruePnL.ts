// ═══════════════════════════════════════════════════════════════════
// charEdge — TruePnL Fee Decomposition (Task 5.6.6)
//
// Breaks down trade P&L into its real components:
// gross move, commissions, funding rates, and slippage.
// Shows traders what fees actually cost them.
//
// Usage:
//   import { computeTruePnL } from './TruePnL.js';
//   const breakdown = computeTruePnL(trade);
// ═══════════════════════════════════════════════════════════════════

// ─── Types ───────────────────────────────────────────────────────

export interface TruePnLBreakdown {
  /** Raw price movement × quantity */
  grossPnL: number;
  /** Commission/fees paid */
  commissions: number;
  /** Funding rate cost (crypto/futures) */
  fundingRate: number;
  /** #13: Borrow cost for short positions */
  borrowCost: number;
  /** Slippage: difference between intended and actual entry/exit */
  slippage: number;
  /** Net P&L after all costs: grossPnL - commissions - fundingRate - borrowCost - slippage */
  netPnL: number;
  /** Percentage of gross P&L eaten by fees: (totalCosts / |grossPnL|) × 100 */
  feeImpactPct: number;
  /** Number of the total costs contributing */
  totalCosts: number;
}

export interface TruePnLSummary {
  /** Aggregate breakdown across all trades */
  total: TruePnLBreakdown;
  /** Per-trade breakdowns */
  perTrade: TruePnLBreakdown[];
  /** Average fee impact percentage */
  avgFeeImpactPct: number;
  /** Total commissions across all trades */
  totalCommissions: number;
  /** Total funding costs */
  totalFunding: number;
  /** #13: Total borrow costs for short positions */
  totalBorrowCost: number;
  /** Total slippage costs */
  totalSlippage: number;
  /** Number of trades where fees > 50% of gross (problematic) */
  highFeeTradeCount: number;
}

// ─── Trade Shape ─────────────────────────────────────────────────

interface TradeInput {
  entry?: number;
  exit?: number;
  qty?: number;
  fees?: number;
  side?: string;
  pnl?: number;
  /** Funding rate cost (optional, user-entered) */
  fundingRate?: number;
  /** #13: Borrow rate cost for short positions (optional, user-entered) */
  borrowRate?: number;
  /** Intended entry price (for slippage calc) */
  intendedEntry?: number;
  /** Intended exit price (for slippage calc) */
  intendedExit?: number;
}

// ─── Single Trade ────────────────────────────────────────────────

/**
 * Compute the true P&L breakdown for a single trade.
 * Every cost component is subtracted to show the real net result.
 */
export function computeTruePnL(trade: TradeInput): TruePnLBreakdown {
  // Warn when critical price data is missing — $0 defaults silently produce wrong P&L
  const entry = trade.entry ?? 0;
  const exit = trade.exit ?? 0;
  const qty = trade.qty ?? 1;
  const isLong = trade.side !== 'short';
  // Gross P&L from price movement
  const grossPnL = isLong ? (exit - entry) * qty : (entry - exit) * qty;

  // Commission/fees
  const commissions = Math.abs(trade.fees ?? 0);

  // Funding rate (crypto perpetuals, futures)
  const fundingRate = Math.abs(trade.fundingRate ?? 0);

  // #13: Borrow cost for short positions
  const borrowCost = Math.abs(trade.borrowRate ?? 0);

  // Slippage: difference between intended and actual prices
  let slippage = 0;
  if (trade.intendedEntry != null && entry > 0) {
    slippage += Math.abs(entry - trade.intendedEntry) * qty;
  }
  if (trade.intendedExit != null && exit > 0) {
    slippage += Math.abs(exit - trade.intendedExit) * qty;
  }

  const totalCosts = commissions + fundingRate + borrowCost + slippage;
  const netPnL = grossPnL - totalCosts;
  // Fee impact: if grossPnL is ~0 but costs > 0, fees consumed all profit → 100%
  const feeImpactPct = Math.abs(grossPnL) > 0 ? (totalCosts / Math.abs(grossPnL)) * 100 : totalCosts > 0 ? 100 : 0;

  return {
    grossPnL: round2(grossPnL),
    commissions: round2(commissions),
    fundingRate: round2(fundingRate),
    borrowCost: round2(borrowCost),
    slippage: round2(slippage),
    netPnL: round2(netPnL),
    feeImpactPct: round2(feeImpactPct),
    totalCosts: round2(totalCosts),
  };
}

// ─── Batch ───────────────────────────────────────────────────────

/**
 * Compute true P&L breakdown for a batch of trades.
 * Returns individual breakdowns + aggregated summary.
 */
export function computeBatchTruePnL(trades: TradeInput[]): TruePnLSummary {
  const perTrade = trades.map(computeTruePnL);

  let totalGross = 0;
  let totalCommissions = 0;
  let totalFunding = 0;
  let totalBorrowCost = 0;
  let totalSlippage = 0;
  let totalNet = 0;
  let totalCosts = 0;
  let highFeeCount = 0;
  let feeImpactSum = 0;

  for (const b of perTrade) {
    totalGross += b.grossPnL;
    totalCommissions += b.commissions;
    totalFunding += b.fundingRate;
    totalBorrowCost += b.borrowCost;
    totalSlippage += b.slippage;
    totalNet += b.netPnL;
    totalCosts += b.totalCosts;
    feeImpactSum += b.feeImpactPct;
    if (b.feeImpactPct > 50) highFeeCount++;
  }

  const total: TruePnLBreakdown = {
    grossPnL: round2(totalGross),
    commissions: round2(totalCommissions),
    fundingRate: round2(totalFunding),
    borrowCost: round2(totalBorrowCost),
    slippage: round2(totalSlippage),
    netPnL: round2(totalNet),
    totalCosts: round2(totalCosts),
    feeImpactPct: Math.abs(totalGross) > 0 ? round2((totalCosts / Math.abs(totalGross)) * 100) : 0,
  };

  return {
    total,
    perTrade,
    avgFeeImpactPct: perTrade.length > 0 ? round2(feeImpactSum / perTrade.length) : 0,
    totalCommissions: round2(totalCommissions),
    totalFunding: round2(totalFunding),
    totalBorrowCost: round2(totalBorrowCost),
    totalSlippage: round2(totalSlippage),
    highFeeTradeCount: highFeeCount,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
