// ═══════════════════════════════════════════════════════════════════
// charEdge — Prop Firm Connector (Phase 7 Sprint 7.10)
//
// Base connector + rules engine for prop trading firm challenges.
// Tracks drawdown limits, profit targets, daily loss limits,
// and challenge phase progression.
// ═══════════════════════════════════════════════════════════════════

import { BrokerConnector } from '../BrokerConnector.js';
import { registerConnector } from '../ConnectorRegistry.js';

// ─── Prop Firm Rules ────────────────────────────────────────────

export const PROP_FIRM_RULES = {
  ftmo: {
    name: 'FTMO',
    logo: '🔷',
    phases: [
      { name: 'Challenge', profitTarget: 0.1, maxDailyLoss: 0.05, maxTotalLoss: 0.1, minDays: 4, maxDays: 30 },
      { name: 'Verification', profitTarget: 0.05, maxDailyLoss: 0.05, maxTotalLoss: 0.1, minDays: 4, maxDays: 60 },
    ],
    accountSizes: [10000, 25000, 50000, 100000, 200000],
    profitSplit: 0.8,
  },
  topstep: {
    name: 'Topstep',
    logo: '🟤',
    phases: [
      {
        name: 'Trading Combine',
        profitTarget: 0.06,
        maxDailyLoss: 0.02,
        maxTotalLoss: 0.04,
        minDays: 5,
        maxDays: null,
      },
    ],
    accountSizes: [50000, 100000, 150000],
    profitSplit: 0.9,
  },
  mffu: {
    name: 'MyFundedFX',
    logo: '🟩',
    phases: [
      { name: 'Phase 1', profitTarget: 0.08, maxDailyLoss: 0.05, maxTotalLoss: 0.12, minDays: 0, maxDays: null },
      { name: 'Phase 2', profitTarget: 0.05, maxDailyLoss: 0.05, maxTotalLoss: 0.12, minDays: 0, maxDays: null },
    ],
    accountSizes: [5000, 10000, 25000, 50000, 100000, 200000],
    profitSplit: 0.8,
  },
  apex: {
    name: 'Apex Trader',
    logo: '🔺',
    phases: [
      { name: 'Evaluation', profitTarget: 0.06, maxDailyLoss: null, maxTotalLoss: 0.025, minDays: 7, maxDays: null },
    ],
    accountSizes: [25000, 50000, 100000, 250000],
    profitSplit: 1.0,
  },
  the5ers: {
    name: 'The5ers',
    logo: '5️⃣',
    phases: [
      { name: 'Hyper Growth', profitTarget: 0.06, maxDailyLoss: 0.03, maxTotalLoss: 0.06, minDays: 0, maxDays: null },
    ],
    accountSizes: [6000, 20000, 60000, 100000],
    profitSplit: 0.8,
  },
};

// ─── Rule Evaluation ────────────────────────────────────────────

/**
 * Evaluate trades against prop firm rules.
 *
 * @param {Object[]} trades - Array of trade objects with date, pnl fields
 * @param {Object} phase - Phase rules from PROP_FIRM_RULES
 * @param {number} accountSize - Selected account size
 * @returns {{ passed: boolean, progress: Object, violations: string[] }}
 */
export function evaluatePhase(trades, phase, accountSize) {
  const violations = [];
  const dailyPnl = {};
  let totalPnl = 0;
  let peakBalance = accountSize;
  let maxDrawdown = 0;
  let tradingDays = 0;

  // Group by date
  for (const trade of trades) {
    const day = (trade.date || '').split('T')[0];
    if (!day) continue;
    dailyPnl[day] = (dailyPnl[day] || 0) + (parseFloat(trade.pnl) || 0);
    totalPnl += parseFloat(trade.pnl) || 0;
  }

  tradingDays = Object.keys(dailyPnl).length;

  // Check daily loss limits
  for (const [day, pnl] of Object.entries(dailyPnl)) {
    if (phase.maxDailyLoss && pnl < -(accountSize * phase.maxDailyLoss)) {
      violations.push(
        `Daily loss limit breached on ${day}: ${pnl.toFixed(2)} (max: -${(accountSize * phase.maxDailyLoss).toFixed(2)})`,
      );
    }

    // Track drawdown
    const runningBalance = accountSize + pnl;
    if (runningBalance > peakBalance) peakBalance = runningBalance;
    const dd = (peakBalance - runningBalance) / accountSize;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  // Check total loss
  if (phase.maxTotalLoss && totalPnl < -(accountSize * phase.maxTotalLoss)) {
    violations.push(
      `Total loss limit breached: ${totalPnl.toFixed(2)} (max: -${(accountSize * phase.maxTotalLoss).toFixed(2)})`,
    );
  }

  // Check profit target
  const profitTarget = accountSize * phase.profitTarget;
  const profitProgress = Math.max(0, Math.min(1, totalPnl / profitTarget));
  const targetReached = totalPnl >= profitTarget;

  // Check min trading days
  const minDaysMet = !phase.minDays || tradingDays >= phase.minDays;

  return {
    passed: targetReached && minDaysMet && violations.length === 0,
    progress: {
      totalPnl,
      profitTarget,
      profitProgress,
      targetReached,
      tradingDays,
      minDays: phase.minDays || 0,
      minDaysMet,
      maxDrawdown,
      maxAllowedDrawdown: phase.maxTotalLoss || 0,
      drawdownUsed: phase.maxTotalLoss ? maxDrawdown / phase.maxTotalLoss : 0,
      dailyLossUsed: phase.maxDailyLoss || 0,
    },
    violations,
  };
}

// ─── Prop Firm Connector ────────────────────────────────────────

class PropFirmConnector extends BrokerConnector {
  constructor() {
    super({
      id: 'propfirm',
      name: 'Prop Firm Tracker',
      logo: '🏆',
      requiredFields: [],
      syncIntervalMs: 0, // Manual tracking only
    });
  }

  async testConnection() {
    // Prop firm tracker doesn't need API credentials
    return { ok: true };
  }

  async fetchTrades() {
    // Trades are imported via other methods (CSV, API, manual entry)
    // This connector provides the rules engine only
    return [];
  }

  getSetupGuide() {
    return {
      steps: [
        'Select your prop firm and challenge type',
        'Enter your account size',
        'Import your trades via CSV or manual entry',
        'charEdge will track your progress against firm rules',
      ],
      tips: [
        'Set up daily reminders to log trades for accurate tracking',
        'Use the dashboard to monitor drawdown in real-time',
      ],
    };
  }
}

registerConnector('propfirm', PropFirmConnector);
export { PropFirmConnector };
export default PropFirmConnector;
