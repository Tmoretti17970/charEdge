// ═══════════════════════════════════════════════════════════════════
// charEdge — Live Risk Dashboard (Sprint 8)
//
// Compact risk metrics panel showing real-time risk exposure:
//   - Daily P&L vs daily loss limit (progress bar)
//   - Open risk (from active trade plans)
//   - Risk per trade budget remaining
//   - Consecutive loss warnings
//   - Drawdown from peak
// ═══════════════════════════════════════════════════════════════════

import { useUserStore } from '../../../state/useUserStore.js';
import React, { useMemo } from 'react';
import { C, M, F } from '../../../constants.js';
import { useJournalStore } from '../../../state/useJournalStore.js';
import { useBreakpoints } from '../../../utils/useMediaQuery.js';
import { fmtD } from '../../../utils.js';

// ─── Component ───────────────────────────────────────────────────

export default function RiskDashboard() {
  const trades = useJournalStore((s) => s.trades);
  const dailyLossLimit = useUserStore((s) => s.dailyLossLimit) || 0;
  const accountSize = useUserStore((s) => s.accountSize) || 0;
  const { isMobile } = useBreakpoints();

  const risk = useMemo(() => {
    if (!trades.length) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayTrades = trades.filter((t) => t.date && new Date(t.date) >= today);
    const todayPnl = todayTrades.reduce((s, t) => s + (t.pnl || 0), 0);

    // Daily limit usage
    const limitUsed = dailyLossLimit > 0
      ? Math.min(100, Math.round(Math.abs(Math.min(0, todayPnl)) / dailyLossLimit * 100))
      : 0;
    const limitRemaining = dailyLossLimit > 0
      ? Math.max(0, dailyLossLimit + Math.min(0, todayPnl))
      : null;

    // Consecutive losses
    const sorted = [...todayTrades].sort((a, b) => new Date(b.date) - new Date(a.date));
    let consecLosses = 0;
    for (const t of sorted) {
      if ((t.pnl || 0) < 0) consecLosses++;
      else break;
    }

    // Rule breaks today
    const ruleBreaksToday = todayTrades.filter((t) => t.ruleBreak).length;

    // Drawdown from peak (all-time)
    let peak = 0, maxDD = 0, equity = 0;
    const allSorted = [...trades].sort((a, b) => new Date(a.date) - new Date(b.date));
    for (const t of allSorted) {
      equity += t.pnl || 0;
      if (equity > peak) peak = equity;
      const dd = peak - equity;
      if (dd > maxDD) maxDD = dd;
    }
    const ddPercent = accountSize > 0 ? ((maxDD / accountSize) * 100).toFixed(1) : null;

    // Risk score (0–100, higher = more danger)
    let riskScore = 0;
    if (limitUsed > 75) riskScore += 30;
    else if (limitUsed > 50) riskScore += 15;
    if (consecLosses >= 3) riskScore += 30;
    else if (consecLosses >= 2) riskScore += 15;
    if (ruleBreaksToday >= 2) riskScore += 20;
    else if (ruleBreaksToday >= 1) riskScore += 10;
    if (todayPnl < 0) riskScore += 10;

    return {
      todayPnl,
      todayCount: todayTrades.length,
      limitUsed,
      limitRemaining,
      consecLosses,
      ruleBreaksToday,
      maxDD,
      ddPercent,
      riskScore: Math.min(100, riskScore),
      equity,
    };
  }, [trades, dailyLossLimit, accountSize]);

  // Don't render if no data or no risk settings
  if (!risk || (dailyLossLimit <= 0 && accountSize <= 0)) return null;

  const scoreColor = risk.riskScore >= 60 ? C.r : risk.riskScore >= 30 ? C.y : C.g;
  const scoreLabel = risk.riskScore >= 60 ? 'HIGH RISK' : risk.riskScore >= 30 ? 'MODERATE' : 'LOW RISK';

  return (
    <div
      className="tf-risk-dashboard"
      style={{
        padding: isMobile ? '12px 14px' : '14px 18px',
        borderRadius: 10,
        background: C.sf,
        border: `1px solid ${scoreColor}20`,
        marginBottom: 14,
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 9, fontWeight: 700, fontFamily: M, color: C.t3, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Risk Monitor
          </span>

          {/* Risk score pill */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 7px',
            borderRadius: 100,
            background: scoreColor + '15',
            border: `1px solid ${scoreColor}25`,
          }}>
            <div style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: scoreColor,
            }} />
            <span style={{ fontSize: 8, fontWeight: 800, fontFamily: M, color: scoreColor, letterSpacing: '0.05em' }}>
              {scoreLabel}
            </span>
          </div>
        </div>

        {risk.todayCount > 0 && (
          <span style={{ fontSize: 13, fontWeight: 800, fontFamily: M, color: risk.todayPnl >= 0 ? C.g : C.r }}>
            {fmtD(risk.todayPnl)}
          </span>
        )}
      </div>

      {/* Metrics grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
        gap: 8,
      }}>
        {/* Daily limit usage */}
        {dailyLossLimit > 0 && (
          <RiskMetric
            label="Daily Limit"
            value={risk.limitRemaining !== null ? fmtD(risk.limitRemaining) : '—'}
            sublabel={`${risk.limitUsed}% used`}
            color={risk.limitUsed >= 75 ? C.r : risk.limitUsed >= 50 ? C.y : C.g}
            progress={risk.limitUsed}
          />
        )}

        {/* Consecutive losses */}
        <RiskMetric
          label="Consec. Losses"
          value={risk.consecLosses.toString()}
          sublabel={risk.consecLosses >= 3 ? 'Take a break' : risk.consecLosses >= 2 ? 'Caution' : 'Clear'}
          color={risk.consecLosses >= 3 ? C.r : risk.consecLosses >= 2 ? C.y : C.g}
        />

        {/* Rule breaks */}
        <RiskMetric
          label="Rule Breaks"
          value={risk.ruleBreaksToday.toString()}
          sublabel="Today"
          color={risk.ruleBreaksToday >= 2 ? C.r : risk.ruleBreaksToday >= 1 ? C.y : C.g}
        />

        {/* Max Drawdown */}
        {accountSize > 0 && (
          <RiskMetric
            label="Max Drawdown"
            value={`${risk.ddPercent}%`}
            sublabel={fmtD(risk.maxDD * -1)}
            color={parseFloat(risk.ddPercent) >= 10 ? C.r : parseFloat(risk.ddPercent) >= 5 ? C.y : C.g}
          />
        )}
      </div>
    </div>
  );
}

// ─── Sub-Components ──────────────────────────────────────────────

function RiskMetric({ label, value, sublabel, color, progress }) {
  return (
    <div style={{
      padding: '8px 10px',
      borderRadius: 6,
      background: C.bg2 + '60',
    }}>
      <div style={{ fontSize: 8, fontWeight: 700, fontFamily: M, color: C.t3, letterSpacing: '0.04em', marginBottom: 4, textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, fontFamily: M, color, lineHeight: 1 }}>
        {value}
      </div>
      {progress !== undefined && (
        <div style={{
          width: '100%',
          height: 3,
          background: C.bg,
          borderRadius: 2,
          overflow: 'hidden',
          marginTop: 4,
          marginBottom: 2,
        }}>
          <div style={{
            width: `${Math.min(100, progress)}%`,
            height: '100%',
            background: color,
            borderRadius: 2,
            transition: 'width 0.3s',
          }} />
        </div>
      )}
      <div style={{ fontSize: 9, fontFamily: M, color: C.t3, marginTop: progress !== undefined ? 0 : 4 }}>
        {sublabel}
      </div>
    </div>
  );
}
