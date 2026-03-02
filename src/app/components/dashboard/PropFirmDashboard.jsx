// ═══════════════════════════════════════════════════════════════════
// charEdge — Prop Firm Risk Dashboard Widget
//
// Compact dashboard showing real-time drawdown tracking, daily P&L
// vs limits, challenge progress, and risk alerts. Designed to sit
// on the Command Center / Journal page.
// ═══════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { C, F, M } from '../../../constants.js';
import { useJournalStore } from '../../../state/useJournalStore.js';
import { usePropFirmStore, computeEvaluation } from '../../../state/usePropFirmStore.js';
import { Card } from '../../components/ui/UIKit.jsx';

export default function PropFirmDashboard() {
  const trades = useJournalStore((s) => s.trades);
  const activeProfile = usePropFirmStore((s) => s.activeProfile);
  const profiles = usePropFirmStore((s) => s.profiles);

  const profile = profiles.find((p) => p.id === activeProfile);

  const evaluation = useMemo(() => {
    if (!profile || !trades.length) return null;
    return computeEvaluation(trades, profile);
  }, [trades, profile]);

  // No active prop firm profile
  if (!profile) {
    return (
      <Card style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: `linear-gradient(135deg, ${C.p}20, ${C.p}10)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
          }}>🏦</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.t1, fontFamily: F }}>Prop Firm Tracker</div>
            <div style={{ fontSize: 11, color: C.t3, fontFamily: F }}>No active evaluation</div>
          </div>
        </div>
        <div style={{ fontSize: 12, color: C.t3, fontFamily: F, lineHeight: 1.5 }}>
          Go to <strong style={{ color: C.t2 }}>Settings → Trading Setup</strong> to select a prop firm profile and start tracking your evaluation.
        </div>
      </Card>
    );
  }

  if (!evaluation) return null;

  const {
    netPnl, peakEquity, currentDrawdown, maxDrawdownHit,
    dailyPnl, dailyDrawdownBreached, targetReached,
    status, failReason, profitTarget, maxDrawdown,
    dailyLossLimit, calendarDays, tradingDays,
  } = evaluation;

  const progressPct = profitTarget > 0 ? Math.min(100, Math.max(0, (netPnl / profitTarget) * 100)) : 0;
  const drawdownPct = maxDrawdown > 0 ? Math.min(100, (currentDrawdown / maxDrawdown) * 100) : 0;
  const dailyPct = dailyLossLimit > 0 ? Math.min(100, (Math.abs(Math.min(0, dailyPnl)) / dailyLossLimit) * 100) : 0;

  const statusColors = {
    active: C.b,
    passed: C.g,
    failed: C.r,
  };
  const statusLabels = {
    active: '● Active',
    passed: '✓ Passed',
    failed: '✗ Failed',
  };

  return (
    <Card style={{ padding: 0, marginBottom: 16, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '14px 20px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: `1px solid ${C.bd}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: `linear-gradient(135deg, ${C.p}20, ${C.p}10)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
          }}>🏦</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: F }}>{profile.name}</div>
            <div style={{ fontSize: 10, color: C.t3, fontFamily: M }}>
              Day {calendarDays}{profile.evaluationDays > 0 ? ` / ${profile.evaluationDays}` : ''} · {tradingDays} trading days
            </div>
          </div>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 700, fontFamily: M,
          color: statusColors[status] || C.t3,
          padding: '3px 10px', borderRadius: 12,
          background: (statusColors[status] || C.t3) + '15',
        }}>
          {statusLabels[status] || status}
        </span>
      </div>

      {/* Metrics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
        {/* Profit Progress */}
        <div style={{ padding: '14px 20px', borderRight: `1px solid ${C.bd}`, borderBottom: `1px solid ${C.bd}` }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            Profit Target
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, fontFamily: M, color: netPnl >= 0 ? C.g : C.r, marginBottom: 8 }}>
            ${netPnl.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            <span style={{ fontSize: 11, fontWeight: 500, color: C.t3 }}> / ${profitTarget.toLocaleString()}</span>
          </div>
          <ProgressBar value={progressPct} color={C.g} />
        </div>

        {/* Max Drawdown */}
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.bd}` }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            Max Drawdown
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, fontFamily: M, color: drawdownPct > 70 ? C.r : drawdownPct > 40 ? C.y : C.t1, marginBottom: 8 }}>
            ${currentDrawdown.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            <span style={{ fontSize: 11, fontWeight: 500, color: C.t3 }}> / ${maxDrawdown.toLocaleString()}</span>
          </div>
          <ProgressBar value={drawdownPct} color={drawdownPct > 70 ? C.r : drawdownPct > 40 ? C.y : C.g} inverted />
        </div>

        {/* Daily P&L */}
        <div style={{ padding: '14px 20px', borderRight: `1px solid ${C.bd}` }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            Daily P&L
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, fontFamily: M, color: dailyPnl >= 0 ? C.g : C.r }}>
            {dailyPnl >= 0 ? '+' : ''}${dailyPnl.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
          </div>
          {dailyLossLimit > 0 && (
            <div style={{ fontSize: 10, color: dailyDrawdownBreached ? C.r : C.t3, fontFamily: M, marginTop: 4 }}>
              {dailyDrawdownBreached ? '⚠️ Daily limit breached!' : `Limit: -$${dailyLossLimit.toLocaleString()}`}
            </div>
          )}
        </div>

        {/* Peak Equity */}
        <div style={{ padding: '14px 20px' }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            Peak Equity
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, fontFamily: M, color: C.t1 }}>
            ${peakEquity.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: 10, color: C.t3, fontFamily: M, marginTop: 4 }}>
            Account: ${(profile.accountSize || 0).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Fail reason or risk alert */}
      {failReason && (
        <div style={{
          padding: '10px 20px',
          background: C.r + '10',
          borderTop: `1px solid ${C.r}30`,
          fontSize: 11, fontWeight: 600, fontFamily: M, color: C.r,
        }}>
          ✗ {failReason}
        </div>
      )}

      {maxDrawdownHit && !failReason && (
        <div style={{
          padding: '10px 20px',
          background: C.y + '10',
          borderTop: `1px solid ${C.y}30`,
          fontSize: 11, fontWeight: 600, fontFamily: M, color: C.y,
        }}>
          ⚠️ Approaching max drawdown limit — trade carefully
        </div>
      )}

      {targetReached && status === 'active' && (
        <div style={{
          padding: '10px 20px',
          background: C.g + '10',
          borderTop: `1px solid ${C.g}30`,
          fontSize: 11, fontWeight: 600, fontFamily: M, color: C.g,
        }}>
          🎯 Profit target reached! Review your evaluation status.
        </div>
      )}
    </Card>
  );
}

// ─── Progress Bar Helper ────────────────────────────────────────

function ProgressBar({ value, color, inverted = false }) {
  return (
    <div style={{
      width: '100%', height: 4, borderRadius: 2,
      background: C.bd + '50', overflow: 'hidden',
    }}>
      <div style={{
        width: `${value}%`, height: '100%', borderRadius: 2,
        background: color,
        transition: 'width 0.5s ease',
      }} />
    </div>
  );
}
