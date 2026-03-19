// ═══════════════════════════════════════════════════════════════════
// charEdge — Portfolio Dashboard (Phase 8 Sprint 8.12)
//
// Multi-account portfolio overview with equity curve, asset
// allocation, broker breakdown, and performance metrics.
// ═══════════════════════════════════════════════════════════════════

import React, { useMemo } from 'react';
import { C, F, M, GLASS } from '../../../constants.js';
import { alpha } from '@/shared/colorUtils';
import { Card } from '../ui/UIKit.jsx';
import { useJournalStore } from '../../../state/useJournalStore.js';
import { useConnectorStore } from '../../../state/useConnectorStore.js';
import { aggregatePortfolio } from '../../../data/PortfolioAggregator.js';

// ─── Stat Card ──────────────────────────────────────────────────

function StatCard({ label, value, color, subtext }) {
  return (
    <div style={{
      flex: '1 1 120px',
      padding: '12px 14px',
      borderRadius: 10,
      background: GLASS.subtle,
      border: `1px solid ${alpha(C.bd, 0.15)}`,
    }}>
      <div style={{ fontSize: 9, fontWeight: 600, color: C.t3, fontFamily: F, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, color: color || C.t1, fontFamily: M, marginTop: 4 }}>
        {value}
      </div>
      {subtext && (
        <div style={{ fontSize: 9, color: C.t3, fontFamily: M, marginTop: 2 }}>{subtext}</div>
      )}
    </div>
  );
}

// ─── Mini Bar Chart ─────────────────────────────────────────────

function AllocationBars({ data, title }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) return null;

  const colors = [C.b, C.g, C.r, '#a78bfa', '#f59e0b', '#ec4899', '#14b8a6', '#6366f1'];

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.t1, fontFamily: F, marginBottom: 8 }}>
        {title}
      </div>

      {/* Stacked bar */}
      <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
        {data.map((d, i) => (
          <div
            key={d.label || d.source || i}
            style={{
              width: `${(d.count / total) * 100}%`,
              background: colors[i % colors.length],
              transition: 'width 0.3s ease',
            }}
          />
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {data.map((d, i) => (
          <div key={d.label || d.source || i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: C.t3, fontFamily: M }}>
            <div style={{ width: 6, height: 6, borderRadius: 2, background: colors[i % colors.length] }} />
            <span>{d.label || d.source}: {d.count} ({((d.count / total) * 100).toFixed(0)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Dashboard ─────────────────────────────────────────────

function PortfolioDashboard() {
  const trades = useJournalStore((s) => s.trades);
  const connections = useConnectorStore((s) => s.connections);

  const portfolio = useMemo(() => {
    return aggregatePortfolio(trades, {}, connections);
  }, [trades, connections]);

  const pnlColor = portfolio.totalPnl >= 0 ? C.g : C.r;

  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 16, fontWeight: 800, color: C.t1, fontFamily: F, margin: '0 0 16px' }}>
        💼 Portfolio Overview
      </h2>

      {/* Hero Stats */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        <StatCard
          label="Total P&L"
          value={`${portfolio.totalPnl >= 0 ? '+' : ''}$${portfolio.totalPnl.toFixed(2)}`}
          color={pnlColor}
          subtext={`${portfolio.tradeCount} total trades`}
        />
        <StatCard
          label="Win Rate"
          value={`${(portfolio.winRate * 100).toFixed(1)}%`}
          color={portfolio.winRate >= 0.5 ? C.g : C.r}
          subtext={`PF: ${portfolio.profitFactor.toFixed(2)}`}
        />
        <StatCard
          label="Sharpe Ratio"
          value={portfolio.sharpe.toFixed(2)}
          color={portfolio.sharpe > 1 ? C.g : portfolio.sharpe > 0 ? C.t2 : C.r}
          subtext="Annualized"
        />
        <StatCard
          label="Max Drawdown"
          value={`${(portfolio.maxDrawdown * 100).toFixed(1)}%`}
          color={portfolio.maxDrawdown > 0.2 ? C.r : portfolio.maxDrawdown > 0.1 ? '#f59e0b' : C.g}
          subtext="From peak"
        />
      </div>

      {/* Allocations */}
      <Card style={{ padding: 16, background: GLASS.subtle, marginBottom: 16 }}>
        {portfolio.brokerAllocation.length > 0 && (
          <AllocationBars data={portfolio.brokerAllocation} title="By Source" />
        )}

        {Object.keys(portfolio.assetAllocation).length > 0 && (
          <AllocationBars
            data={Object.entries(portfolio.assetAllocation).map(([cls, data]) => ({
              label: cls.charAt(0).toUpperCase() + cls.slice(1),
              count: data.count,
              pnl: data.pnl,
            }))}
            title="By Asset Class"
          />
        )}
      </Card>

      {/* Equity Curve (text-based sparkline) */}
      {portfolio.equityCurve.length > 2 && (
        <Card style={{ padding: 16, background: GLASS.subtle }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.t1, fontFamily: F, marginBottom: 8 }}>
            Equity Curve
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', height: 60, gap: 1 }}>
            {portfolio.equityCurve.slice(-60).map((point, i) => {
              const max = Math.max(...portfolio.equityCurve.map((p) => Math.abs(p.equity)));
              const height = max > 0 ? (Math.abs(point.equity) / max) * 50 : 5;
              return (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: Math.max(2, height),
                    borderRadius: 1,
                    background: point.equity >= 0 ? alpha(C.g, 0.6) : alpha(C.r, 0.6),
                    transition: 'height 0.3s ease',
                  }}
                  title={`${point.date}: $${point.equity.toFixed(2)}`}
                />
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: C.t3, fontFamily: M, marginTop: 4 }}>
            <span>{portfolio.equityCurve[Math.max(0, portfolio.equityCurve.length - 60)]?.date}</span>
            <span>{portfolio.equityCurve[portfolio.equityCurve.length - 1]?.date}</span>
          </div>
        </Card>
      )}

      {/* Connected accounts badge */}
      <div style={{ marginTop: 12, fontSize: 10, color: C.t3, fontFamily: M, textAlign: 'center' }}>
        {portfolio.connectedAccounts > 0
          ? `${portfolio.connectedAccounts} connected account${portfolio.connectedAccounts > 1 ? 's' : ''} · Last updated ${new Date(portfolio.lastUpdated).toLocaleTimeString()}`
          : 'Connect a broker to see aggregated portfolio data'}
      </div>
    </div>
  );
}

export default React.memo(PortfolioDashboard);
