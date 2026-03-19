// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — Analytics Strategies Tab
// Strategy performance cards, P&L heatmap, detailed table, playbook mgr
// ═══════════════════════════════════════════════════════════════════

import React, { useMemo } from 'react';
import { C, M } from '@/constants.js';
import { fmtD } from '../../../../utils.js';
import { Card, AutoGrid } from '../../../components/ui/UIKit.jsx';
import BreakdownBarChart from '../../../components/widgets/BreakdownBarChart.jsx';
import PlaybookManager from '../../playbook/PlaybookManager.jsx';
import { SectionLabel, MiniStat, headerRow, dataRow } from './AnalyticsPrimitives.jsx';
import s from './StrategiesTab.module.css';

function StrategiesTab({ result, computing }) {
  if (!result || !result.bySt) {
    return <div style={{ padding: 40, textAlign: 'center', color: C.t3 }}>{computing ? 'Computing playbooks...' : 'No playbook data available.'}</div>;
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const strategies = useMemo(
    () =>
      Object.entries(result.bySt || {})
        .map(([name, d]) => ({ name, ...d, wr: d.count > 0 ? (d.wins / d.count) * 100 : 0 }))
        .sort((a, b) => b.pnl - a.pnl),
    [result.bySt],
  );

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const tags = useMemo(
    () =>
      result.byTag
        ? Object.values(result.byTag).sort((a, b) => b.pnl - a.pnl)
        : [],
    [result.byTag]
  );

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

  return (
    <div>
      {/* Playbook Stat Cards */}
      {strategies.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <SectionLabel text="Playbook Performance Cards" />
          <AutoGrid minWidth={220} gap={10}>
            {strategies.map((s) => {
              const avgPnl = s.count > 0 ? s.pnl / s.count : 0;
              return (
                <Card
                  key={s.name}
                  style={{
                    padding: 14,
                    borderLeft: `3px solid ${s.pnl >= 0 ? C.g : C.r}`,
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 800, color: C.t1, marginBottom: 8 }}>{s.name}</div>
                  <div className={s.s0}>
                    <MiniStat label="P&L" value={fmtD(s.pnl)} color={s.pnl >= 0 ? C.g : C.r} />
                    <MiniStat label="Win Rate" value={`${s.wr.toFixed(0)}%`} color={s.wr >= 50 ? C.g : C.r} />
                    <MiniStat label="Trades" value={s.count} />
                    <MiniStat label="Avg P&L" value={fmtD(avgPnl)} color={avgPnl >= 0 ? C.g : C.r} />
                  </div>
                </Card>
              );
            })}
          </AutoGrid>
        </div>
      )}

      {/* Chart */}
      <Card className={s.s1}>
        <SectionLabel text="P&L by Strategy" />
        <BreakdownBarChart data={result.bySt} height={Math.max(150, strategies.length * 40)} />
      </Card>

      {/* Playbook × Day Correlation Matrix */}
      {result.corrMatrix && Object.keys(result.corrMatrix).length > 1 && (
        <Card className={s.s2}>
          <SectionLabel text="Playbook × Day Heatmap" />
          <div style={{ fontSize: 11, color: C.t3, marginBottom: 10, lineHeight: 1.5 }}>
            Which playbooks win/lose on which days? Green = profitable, Red = losing.
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'separate', borderSpacing: '2px', width: '100%', fontSize: 11, fontFamily: M }}>
              <thead>
                <tr>
                  <th style={{ padding: '6px 10px', textAlign: 'left', color: C.t3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 9 }}>Strategy</th>
                  {dayNames.map((d) => (
                    <th
                      key={d}
                      style={{ padding: '6px 8px', textAlign: 'center', color: C.t3, fontWeight: 700, minWidth: 52, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 9 }}
                    >
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(result.corrMatrix).map(([pb, days]) => (
                  <tr key={pb} style={{ borderTop: `1px solid ${C.bd}40` }}>
                    <td style={{ padding: '6px 10px', fontWeight: 700, color: C.t1 }}>{pb}</td>
                    {dayNames.map((d) => {
                      const cell = days[d] || { pnl: 0, count: 0 };
                      if (cell.count === 0) {
                        return (
                          <td key={d} style={{ padding: '6px 8px', textAlign: 'center', color: C.t3 }}>
                            —
                          </td>
                        );
                      }
                      const intensity = Math.min(
                        1,
                        Math.abs(cell.pnl) / (Math.max(1, ...Object.values(days).map((c) => Math.abs(c.pnl))) || 1),
                      );
                      const bg =
                        cell.pnl >= 0
                          ? `rgba(34, 197, 94, ${0.08 + intensity * 0.25})`
                          : `rgba(239, 68, 68, ${0.08 + intensity * 0.25})`;
                      return (
                        <td
                          key={d}
                          style={{
                            padding: '6px 8px',
                            textAlign: 'center',
                            background: bg,
                            color: cell.pnl >= 0 ? C.g : C.r,
                            fontWeight: 600,
                            borderRadius: 4,
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {fmtD(cell.pnl)}
                          <div style={{ fontSize: 8, color: C.t3, fontWeight: 400 }}>{cell.count}t</div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Detailed Table */}
      <Card className={s.s3}>
        <div style={{ ...headerRow, gridTemplateColumns: '1fr 80px 60px 60px 80px 70px' }}>
          <div>Strategy</div>
          <div style={{ textAlign: 'right' }}>P&L</div>
          <div style={{ textAlign: 'right' }}>Trades</div>
          <div style={{ textAlign: 'right' }}>Win %</div>
          <div style={{ textAlign: 'right' }}>Avg P&L</div>
          <div style={{ textAlign: 'right' }}>PF</div>
        </div>
        {strategies.map((s) => (
          <div key={s.name} style={{ ...dataRow, gridTemplateColumns: '1fr 80px 60px 60px 80px 70px' }}>
            <div style={{ fontWeight: 700, color: C.t1 }}>{s.name}</div>
            <div style={{ textAlign: 'right', fontFamily: M, fontWeight: 700, color: s.pnl >= 0 ? C.g : C.r, fontVariantNumeric: 'tabular-nums' }}>
              {fmtD(s.pnl)}
            </div>
            <div style={{ textAlign: 'right', fontFamily: M, fontVariantNumeric: 'tabular-nums' }}>{s.count}</div>
            <div style={{ textAlign: 'right', fontFamily: M, color: s.wr >= 50 ? C.g : C.r, fontVariantNumeric: 'tabular-nums' }}>{s.wr.toFixed(0)}%</div>
            <div
              style={{
                textAlign: 'right',
                fontFamily: M,
                color: s.count > 0 ? (s.pnl / s.count >= 0 ? C.g : C.r) : C.t3,
              }}
            >
              {s.count > 0 ? fmtD(s.pnl / s.count) : '—'}
            </div>
            <div style={{ textAlign: 'right', fontFamily: M }}>
              {s.count > 0 && s.wins > 0
                ? ((s.pnl > 0 ? s.pnl : 0) / (s.pnl < 0 ? Math.abs(s.pnl) : 1)).toFixed(2)
                : '—'}
            </div>
          </div>
        ))}
      </Card>

      {/* J3.2 Multi-Variable Tag Correlation */}
      {tags.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <SectionLabel text="Custom Tag Correlation" />
          <Card className={s.s4}>
            <div style={{ ...headerRow, gridTemplateColumns: '1fr 80px 60px 60px 80px 70px' }}>
              <div>Tag</div>
              <div style={{ textAlign: 'right' }}>P&L</div>
              <div style={{ textAlign: 'right' }}>Count</div>
              <div style={{ textAlign: 'right' }}>Win %</div>
              <div style={{ textAlign: 'right' }}>Avg P&L</div>
              <div style={{ textAlign: 'right' }}>Avg R</div>
            </div>
            {tags.map((t) => {
              const avgPnl = t.count > 0 ? t.pnl / t.count : 0;
              return (
                <div key={t.name} style={{ ...dataRow, gridTemplateColumns: '1fr 80px 60px 60px 80px 70px' }}>
                  <div style={{ fontWeight: 700, color: C.t1 }}>#{t.name}</div>
                  <div style={{ textAlign: 'right', fontFamily: M, fontWeight: 700, color: t.pnl >= 0 ? C.g : C.r }}>
                    {fmtD(t.pnl)}
                  </div>
                  <div style={{ textAlign: 'right', fontFamily: M }}>{t.count}</div>
                  <div style={{ textAlign: 'right', fontFamily: M, color: t.winRate >= 50 ? C.g : C.r }}>
                    {t.winRate.toFixed(0)}%
                  </div>
                  <div style={{ textAlign: 'right', fontFamily: M, color: avgPnl >= 0 ? C.g : C.r }}>
                    {t.count > 0 ? fmtD(avgPnl) : '—'}
                  </div>
                  <div style={{ textAlign: 'right', fontFamily: M, color: t.avgR >= 0 ? C.g : C.r }}>
                    {t.avgR !== 0 ? `${t.avgR.toFixed(2)}R` : '—'}
                  </div>
                </div>
              );
            })}
          </Card>
        </div>
      )}

      {/* Playbook Management */}
      <div style={{ marginTop: 16 }}>
        <PlaybookManager />
      </div>
    </div>
  );
}
export default React.memo(StrategiesTab);
