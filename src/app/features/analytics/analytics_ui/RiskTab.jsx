// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — Analytics Risk Tab
// Risk metrics, R-multiple distribution, drawdown curve, warnings
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { Card, StatCard, AutoGrid } from '../../../components/ui/UIKit.jsx';
import RDistributionChart from '../../../components/widgets/RDistributionChart.jsx';
import RiskSimulator from '../../../components/widgets/RiskSimulator.jsx';
import { SectionLabel, DrawdownChart } from './AnalyticsPrimitives.jsx';
import StreakAnalysis from './StreakAnalysis.jsx';
import { C, M } from '@/constants.js';

function RiskTab({ result, trades, computing }) {
  if (!result || typeof result.maxDd === 'undefined') {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: C.t3 }}>
        {computing ? 'Computing risk profile...' : 'No risk data available.'}
      </div>
    );
  }

  return (
    <div>
      {/* Risk Metrics */}
      <AutoGrid minWidth={150} gap={8} style={{ marginBottom: 16 }}>
        <StatCard
          label="Max Drawdown"
          value={`${result.maxDd.toFixed(1)}%`}
          color={result.maxDd < 10 ? C.g : result.maxDd < 25 ? C.y : C.r}
        />
        <StatCard
          label="Calmar Ratio"
          value={result.calmar === Infinity ? '∞' : (result.calmar || 0).toFixed(2)}
          color={(result.calmar || 0) >= 1 ? C.g : (result.calmar || 0) >= 0.5 ? C.y : C.r}
        />
        <StatCard
          label="Recovery Factor"
          value={result.recoveryFactor === Infinity ? '∞' : (result.recoveryFactor || 0).toFixed(2)}
          color={(result.recoveryFactor || 0) >= 2 ? C.g : (result.recoveryFactor || 0) >= 1 ? C.y : C.r}
        />
        <StatCard
          label="Sortino"
          value={(result.sortino || 0).toFixed(2)}
          color={(result.sortino || 0) >= 1 ? C.g : (result.sortino || 0) >= 0 ? C.y : C.r}
        />
        <StatCard label="Kelly Criterion" value={`${(result.kelly * 100).toFixed(1)}%`} color={C.b} />
        <StatCard
          label="Risk of Ruin"
          value={`${result.ror.toFixed(1)}%`}
          color={result.ror < 5 ? C.g : result.ror < 30 ? C.y : C.r}
        />
        <StatCard
          label="Win/Loss Ratio"
          value={result.rr === Infinity ? '∞' : result.rr.toFixed(2)}
          color={result.rr >= 1.5 ? C.g : result.rr >= 1 ? C.y : C.r}
        />
        <StatCard
          label="Avg Hold Time"
          value={
            result.avgHoldTime > 0
              ? result.avgHoldTime >= 60
                ? `${Math.floor(result.avgHoldTime / 60)}h ${Math.round(result.avgHoldTime % 60)}m`
                : `${Math.round(result.avgHoldTime)}m`
              : '—'
          }
          color={C.t2}
        />
        <StatCard
          label="Hold Time (Winners)"
          value={
            result.avgHoldTimeWinners > 0
              ? result.avgHoldTimeWinners >= 60
                ? `${Math.floor(result.avgHoldTimeWinners / 60)}h ${Math.round(result.avgHoldTimeWinners % 60)}m`
                : `${Math.round(result.avgHoldTimeWinners)}m`
              : '—'
          }
          color={C.g}
        />
        <StatCard
          label="Hold Time (Losers)"
          value={
            result.avgHoldTimeLosers > 0
              ? result.avgHoldTimeLosers >= 60
                ? `${Math.floor(result.avgHoldTimeLosers / 60)}h ${Math.round(result.avgHoldTimeLosers % 60)}m`
                : `${Math.round(result.avgHoldTimeLosers)}m`
              : '—'
          }
          color={result.avgHoldTimeLosers > result.avgHoldTimeWinners * 2 ? C.r : C.y}
        />
        <StatCard label="Best Streak" value={`${result.best} wins`} color={C.g} />
        <StatCard label="Worst Streak" value={`${result.worst} losses`} color={C.r} />
        <StatCard
          label="Consec 3+ Loss"
          value={`${result.consLoss3.toFixed(1)}%`}
          color={result.consLoss3 > 3 ? C.r : C.t2}
        />
        <StatCard
          label="Consec 5+ Loss"
          value={`${result.consLoss5.toFixed(1)}%`}
          color={result.consLoss5 > 0.5 ? C.r : C.g}
        />
      </AutoGrid>

      {/* Sprint 3: Streak Analysis */}
      <StreakAnalysis result={result} trades={trades} />

      {/* Interactive Risk Simulator */}
      <RiskSimulator trades={trades} />

      {/* R-Multiple Distribution */}
      <Card style={{ padding: 16, marginBottom: 16 }}>
        <SectionLabel text="R-Multiple Distribution" />
        <RDistributionChart trades={trades} height={220} />
      </Card>

      {/* Drawdown Curve */}
      <Card style={{ padding: 16, marginBottom: 16 }}>
        <SectionLabel text="Drawdown Curve" />
        <DrawdownChart eq={result.eq} height={200} />
      </Card>

      {/* Warnings */}
      {result.warnings?.length > 0 && (
        <Card style={{ padding: 16 }}>
          <SectionLabel text="Metric Warnings" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {result.warnings.map((w, i) => (
              <div
                key={i}
                style={{
                  padding: '8px 12px',
                  background: C.y + '0c',
                  borderLeft: `3px solid ${C.y}`,
                  borderRadius: '0 6px 6px 0',
                  fontSize: 11,
                  color: C.y,
                  fontFamily: M,
                }}
              >
                ⚠ {w.message}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
export default React.memo(RiskTab);
