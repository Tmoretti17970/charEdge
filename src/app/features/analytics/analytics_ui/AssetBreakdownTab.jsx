// ═══════════════════════════════════════════════════════════════════
// charEdge — Asset Breakdown Tab (P1-C #16)
// Win rate, P&L, and avg P&L broken down by trading symbol.
// ═══════════════════════════════════════════════════════════════════

import React, { useMemo } from 'react';
import { Card, AutoGrid } from '../../../components/ui/UIKit.jsx';
import { SectionLabel } from './AnalyticsPrimitives.jsx';
import { C, M } from '@/constants.js';
import { groupTradesBy } from '@/trading/groupTradesBy';

function AssetBreakdownTab({ trades, computing }) {
  const groups = useMemo(() => groupTradesBy(trades || [], (t) => t.symbol, { sort: 'pnl', dir: 'desc' }), [trades]);

  if (!groups.length) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: C.t3 }}>
        {computing ? 'Computing asset breakdown...' : 'No trade data available.'}
      </div>
    );
  }

  const maxPnl = Math.max(...groups.map((g) => Math.abs(g.pnl)), 1);

  return (
    <div>
      <Card style={{ padding: 16, marginBottom: 16 }}>
        <SectionLabel text="Win Rate by Asset" />
        <div style={{ overflowX: 'auto' }}>
          <table
            id="asset-breakdown-table"
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontFamily: M,
              fontSize: 12,
            }}
          >
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.t3}33`, color: C.t3, textAlign: 'left' }}>
                <th style={{ padding: '8px 12px' }}>Symbol</th>
                <th style={{ padding: '8px 12px', textAlign: 'right' }}>Trades</th>
                <th style={{ padding: '8px 12px', textAlign: 'right' }}>Win %</th>
                <th style={{ padding: '8px 12px', textAlign: 'right' }}>P&L</th>
                <th style={{ padding: '8px 12px', textAlign: 'right' }}>Avg P&L</th>
                <th style={{ padding: '8px 12px', textAlign: 'right' }}>PF</th>
                <th style={{ padding: '8px 12px', width: 120 }}>Bar</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => {
                const winColor = g.winRate > 50 ? C.g : g.winRate === 50 ? C.y : C.r;
                const pnlColor = g.pnl >= 0 ? C.g : C.r;
                const barWidth = (Math.abs(g.pnl) / maxPnl) * 100;
                return (
                  <tr
                    key={g.key}
                    style={{
                      borderBottom: `1px solid ${C.t3}15`,
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = `${C.t3}0a`)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '8px 12px', fontWeight: 600, color: C.t1 }}>{g.key}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: C.t2 }}>{g.count}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: winColor, fontWeight: 600 }}>
                      {g.winRate.toFixed(1)}%
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: pnlColor, fontWeight: 600 }}>
                      ${g.pnl.toFixed(2)}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: pnlColor }}>${g.avgPnl.toFixed(2)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: C.t2 }}>
                      {g.profitFactor === Infinity ? '∞' : g.profitFactor.toFixed(2)}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <div
                        style={{
                          height: 6,
                          borderRadius: 3,
                          background: pnlColor + '33',
                          width: '100%',
                          position: 'relative',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            borderRadius: 3,
                            background: pnlColor,
                            width: `${barWidth}%`,
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Summary Cards */}
      <AutoGrid minWidth={150} gap={8}>
        {groups.slice(0, 4).map((g) => (
          <Card key={g.key} style={{ padding: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: C.t3, marginBottom: 4 }}>{g.key}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: g.pnl >= 0 ? C.g : C.r }}>{g.winRate.toFixed(0)}%</div>
            <div style={{ fontSize: 10, color: C.t3 }}>{g.count} trades</div>
          </Card>
        ))}
      </AutoGrid>
    </div>
  );
}

export default React.memo(AssetBreakdownTab);
