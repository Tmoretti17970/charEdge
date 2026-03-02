// ═══════════════════════════════════════════════════════════════════
// charEdge — Risk Guard Overlay
//
// Real-time risk enforcement overlay. Reads the active prop firm
// profile from usePropFirmStore, evaluates open-position P&L
// against daily loss / max drawdown limits, and shows a colour-
// coded pill (safe / warning / danger / locked).
//
// Renders as a floating overlay in the top-right of the chart area.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { usePropFirmStore } from '../../../../state/usePropFirmStore.js';
import { useJournalStore } from '../../../../state/useJournalStore.js';

export default function RiskGuardOverlay() {
  const activeProfile = usePropFirmStore((s) => s.activeProfile);
  const profiles = usePropFirmStore((s) => s.profiles);
  const trades = useJournalStore((s) => s.trades);
  const [expanded, setExpanded] = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!expanded) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setExpanded(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [expanded]);

  const profile = useMemo(() => {
    if (!activeProfile) return null;
    return profiles.find((p) => p.id === activeProfile) || null;
  }, [activeProfile, profiles]);

  const status = useMemo(() => {
    if (!profile) return null;

    const today = new Date().toDateString();
    const todayTrades = trades.filter((t) => {
      const d = new Date(t.exitTime || t.entryTime);
      return d.toDateString() === today;
    });

    const dailyPnl = todayTrades.reduce((s, t) => s + (t.pnl || 0), 0);
    const totalPnl = trades.reduce((s, t) => s + (t.pnl || 0), 0);

    const accountSize = profile.initialBalance || 100000;
    const maxDailyLoss = profile.maxDailyLoss || accountSize * 0.05;
    const maxTotalDrawdown = profile.maxDrawdown || accountSize * 0.10;

    const dailyLossUsed = Math.max(0, -dailyPnl);
    const totalDrawdownUsed = Math.max(0, -totalPnl);

    const dailyPct = (dailyLossUsed / maxDailyLoss) * 100;
    const totalPct = (totalDrawdownUsed / maxTotalDrawdown) * 100;

    let level = 'safe';
    if (dailyPct >= 100 || totalPct >= 100) level = 'locked';
    else if (dailyPct >= 80 || totalPct >= 80) level = 'danger';
    else if (dailyPct >= 50 || totalPct >= 50) level = 'warning';

    return {
      level,
      dailyPnl,
      totalPnl,
      dailyLossUsed,
      maxDailyLoss,
      totalDrawdownUsed,
      maxTotalDrawdown,
      dailyPct: Math.min(dailyPct, 100),
      totalPct: Math.min(totalPct, 100),
      firmName: profile.name || 'Custom',
      tradeCount: todayTrades.length,
    };
  }, [profile, trades]);

  if (!status) return null;

  const pillLabels = {
    safe: '● Risk OK',
    warning: '● Caution',
    danger: '● High Risk',
    locked: '● LOCKED',
  };

  return (
    <div className="tf-risk-guard" ref={ref}>
      <button
        className={`tf-risk-pill tf-risk-pill--${status.level}`}
        onClick={() => setExpanded(!expanded)}
        title={`${status.firmName} Risk Guard`}
      >
        <span className="tf-risk-pill__dot" />
        {pillLabels[status.level]}
      </button>

      {expanded && (
        <div className="tf-risk-expanded">
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--tf-t2)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {status.firmName} Risk Guard
          </div>

          {/* Daily Loss Gauge */}
          <div className="tf-risk-gauge">
            <div className="tf-risk-gauge__header">
              <span className="tf-risk-gauge__label">Daily Loss</span>
              <span className="tf-risk-gauge__value" style={{ color: status.dailyPct >= 80 ? '#EF5350' : status.dailyPct >= 50 ? '#FFA726' : '#26A69A' }}>
                ${status.dailyLossUsed.toFixed(0)} / ${status.maxDailyLoss.toFixed(0)}
              </span>
            </div>
            <div className="tf-risk-gauge__track">
              <div
                className="tf-risk-gauge__fill"
                style={{
                  width: `${status.dailyPct}%`,
                  background: status.dailyPct >= 80 ? '#EF5350' : status.dailyPct >= 50 ? '#FFA726' : '#26A69A',
                }}
              />
            </div>
          </div>

          {/* Total Drawdown Gauge */}
          <div className="tf-risk-gauge">
            <div className="tf-risk-gauge__header">
              <span className="tf-risk-gauge__label">Max Drawdown</span>
              <span className="tf-risk-gauge__value" style={{ color: status.totalPct >= 80 ? '#EF5350' : status.totalPct >= 50 ? '#FFA726' : '#26A69A' }}>
                ${status.totalDrawdownUsed.toFixed(0)} / ${status.maxTotalDrawdown.toFixed(0)}
              </span>
            </div>
            <div className="tf-risk-gauge__track">
              <div
                className="tf-risk-gauge__fill"
                style={{
                  width: `${status.totalPct}%`,
                  background: status.totalPct >= 80 ? '#EF5350' : status.totalPct >= 50 ? '#FFA726' : '#26A69A',
                }}
              />
            </div>
          </div>

          {/* Summary */}
          <div style={{ fontSize: 11, color: 'var(--tf-t3)', marginTop: 8 }}>
            Today: {status.tradeCount} trades · P&L: <span style={{ color: status.dailyPnl >= 0 ? '#26A69A' : '#EF5350', fontWeight: 600 }}>
              {status.dailyPnl >= 0 ? '+' : ''}${status.dailyPnl.toFixed(2)}
            </span>
          </div>

          {status.level === 'locked' && (
            <div style={{ fontSize: 11, color: '#D32F2F', fontWeight: 600, marginTop: 6, padding: '6px 8px', background: 'rgba(211, 47, 47, 0.08)', borderRadius: 8 }}>
              ⚠ Risk limit reached. Trading is blocked until the next session.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
