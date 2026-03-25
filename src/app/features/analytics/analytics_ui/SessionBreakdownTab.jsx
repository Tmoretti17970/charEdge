// ═══════════════════════════════════════════════════════════════════
// charEdge — Session Breakdown Tab (P1-C #17)
// Win rate and P&L broken down by trading session
// (Asia, London, New York, Overlap).
// ═══════════════════════════════════════════════════════════════════

import React, { useMemo } from 'react';
import { Card, AutoGrid } from '../../../components/ui/UIKit.jsx';
import { SectionLabel } from './AnalyticsPrimitives.jsx';
import { C, M } from '@/constants.js';
import { groupTradesBy } from '@/trading/groupTradesBy';

/**
 * Map a UTC hour to a trading session name.
 */
function hourToSession(utcHour) {
  // Sessions overlap intentionally (e.g. London/NY overlap 13–16)
  if (utcHour >= 0 && utcHour < 8) return 'Asia';
  if (utcHour >= 8 && utcHour < 13) return 'London';
  if (utcHour >= 13 && utcHour < 16) return 'NY/LDN Overlap';
  if (utcHour >= 16 && utcHour < 21) return 'New York';
  return 'After Hours';
}

const SESSION_COLORS = {
  Asia: 'rgba(255,183,77,1)',
  London: 'rgba(100,181,246,1)',
  'NY/LDN Overlap': 'rgba(171,71,188,1)',
  'New York': 'rgba(129,199,132,1)',
  'After Hours': 'rgba(158,158,158,1)',
};

const SESSION_ORDER = ['Asia', 'London', 'NY/LDN Overlap', 'New York', 'After Hours'];

function SessionBreakdownTab({ trades, computing }) {
  const groups = useMemo(() => {
    if (!trades?.length) return [];
    const raw = groupTradesBy(
      trades,
      (t) => {
        if (!t.date) return 'Unknown';
        const h = new Date(t.date).getUTCHours();
        return hourToSession(h);
      },
      { sort: 'key', dir: 'asc' },
    );
    // Sort by session order
    return SESSION_ORDER.map(
      (name) =>
        raw.find((g) => g.key === name) || {
          key: name,
          pnl: 0,
          count: 0,
          wins: 0,
          losses: 0,
          winRate: 0,
          avgPnl: 0,
          profitFactor: 0,
          bestTrade: 0,
          worstTrade: 0,
        },
    );
  }, [trades]);

  if (!groups.some((g) => g.count > 0)) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: C.t3 }}>
        {computing ? 'Computing session data...' : 'No trade data available.'}
      </div>
    );
  }

  const totalTrades = groups.reduce((s, g) => s + g.count, 0) || 1;

  return (
    <div>
      {/* Session Timeline Bar */}
      <Card style={{ padding: 16, marginBottom: 16 }}>
        <SectionLabel text="Session Distribution" />
        <div
          style={{
            display: 'flex',
            height: 32,
            borderRadius: 8,
            overflow: 'hidden',
            marginBottom: 12,
          }}
        >
          {groups
            .filter((g) => g.count > 0)
            .map((g) => (
              <div
                key={g.key}
                title={`${g.key}: ${g.count} trades (${((g.count / totalTrades) * 100).toFixed(0)}%)`}
                style={{
                  flex: g.count / totalTrades,
                  background: SESSION_COLORS[g.key] || C.t3,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  fontWeight: 600,
                  color: '#fff',
                  minWidth: g.count / totalTrades > 0.08 ? 'auto' : 0,
                  overflow: 'hidden',
                  transition: 'flex 0.3s ease',
                }}
              >
                {g.count / totalTrades > 0.1 ? g.key : ''}
              </div>
            ))}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {groups
            .filter((g) => g.count > 0)
            .map((g) => (
              <div key={g.key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: C.t3 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: SESSION_COLORS[g.key] }} />
                {g.key} ({g.count})
              </div>
            ))}
        </div>
      </Card>

      {/* Session Stat Cards */}
      <AutoGrid minWidth={170} gap={8} style={{ marginBottom: 16 }}>
        {groups
          .filter((g) => g.count > 0)
          .map((g) => (
            <Card key={g.key} style={{ padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: SESSION_COLORS[g.key] }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: C.t1 }}>{g.key}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11, fontFamily: M }}>
                <div>
                  <div style={{ color: C.t3, fontSize: 9 }}>Win Rate</div>
                  <div style={{ color: g.winRate > 50 ? C.g : C.r, fontWeight: 700 }}>{g.winRate.toFixed(1)}%</div>
                </div>
                <div>
                  <div style={{ color: C.t3, fontSize: 9 }}>P&L</div>
                  <div style={{ color: g.pnl >= 0 ? C.g : C.r, fontWeight: 700 }}>${g.pnl.toFixed(2)}</div>
                </div>
                <div>
                  <div style={{ color: C.t3, fontSize: 9 }}>Best</div>
                  <div style={{ color: C.g }}>${g.bestTrade.toFixed(2)}</div>
                </div>
                <div>
                  <div style={{ color: C.t3, fontSize: 9 }}>Worst</div>
                  <div style={{ color: C.r }}>${g.worstTrade.toFixed(2)}</div>
                </div>
              </div>
            </Card>
          ))}
      </AutoGrid>
    </div>
  );
}

export default React.memo(SessionBreakdownTab);
