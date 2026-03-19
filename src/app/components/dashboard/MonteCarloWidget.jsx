// ═══════════════════════════════════════════════════════════════════
// charEdge — Monte Carlo Risk Widget (Phase 2 Task #28)
//
// Dashboard card surfacing MonteCarloEngine outputs: equity curve
// confidence intervals (P5–P95), ruin probability, profit probability,
// and max drawdown distribution.  Shows sample-size warning when < 20 trades.
//
// Sprint 5 Task 5.1.4: MonteCarloEngine is lazy-loaded on mount.
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from 'react';
import { C, M } from '../../../constants.js';
import { useJournalStore } from '../../../state/useJournalStore';
import { useBreakpoints } from '@/hooks/useMediaQuery';

// ─── Tiny inline sparkline for the percentile ribbon ─────────────

function EquityRibbon({ percentiles, width = 260, height = 60 }) {
  if (!percentiles || !percentiles.p50 || percentiles.p50.length < 2) return null;

  const len = percentiles.p50.length;
  const allVals = [...percentiles.p5, ...percentiles.p95];
  const min = Math.min(...allVals);
  const max = Math.max(...allVals);
  const range = max - min || 1;

  const x = (i) => (i / (len - 1)) * width;
  const y = (v) => height - ((v - min) / range) * height;

  const pathFor = (arr) => arr.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');

  // Build the ribbon (P5–P95 fill, P25–P75 fill, P50 line)
  const ribbonOuter = pathFor(percentiles.p5) + ' ' + [...percentiles.p95].reverse().map((v, i) => `L${x(len - 1 - i).toFixed(1)},${y(v).toFixed(1)}`).join(' ') + ' Z';
  const ribbonInner = pathFor(percentiles.p25) + ' ' + [...percentiles.p75].reverse().map((v, i) => `L${x(len - 1 - i).toFixed(1)},${y(v).toFixed(1)}`).join(' ') + ' Z';

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      <path d={ribbonOuter} fill={C.info + '18'} stroke="none" />
      <path d={ribbonInner} fill={C.info + '30'} stroke="none" />
      <path d={pathFor(percentiles.p50)} fill="none" stroke={C.info} strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  );
}

// ─── Stat Box ─────────────────────────────────────────────────────

function Stat({ label, value, color, tip }) {
  return (
    <div title={tip} style={{ flex: 1, textAlign: 'center', cursor: tip ? 'help' : 'default' }}>
      <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: C.t3, fontFamily: M, marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 15, fontWeight: 800, fontFamily: M, color: color || C.t1, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
    </div>
  );
}

// ─── Main Widget ──────────────────────────────────────────────────

export default function MonteCarloWidget() {
  const trades = useJournalStore((s) => s.trades);
  const { isMobile } = useBreakpoints();
  const [simPaths] = useState(1000);

  // Sprint 5 Task 5.1.4: Lazy-load MonteCarloEngine on mount
  const [engine, setEngine] = useState(null);
  useEffect(() => {
    let cancelled = false;
    import('../../../ai/MonteCarloEngine').then(m => {
      if (!cancelled) setEngine(m.monteCarloEngine);
    });
    return () => { cancelled = true; };
  }, []);

  const result = useMemo(() => {
    if (!engine || !trades || trades.length < 5) return null;
    const returns = trades.map((t) => t.pnl || 0).filter((v) => v !== 0);
    if (returns.length < 5) return null;
    return engine.simulate(returns, { paths: simPaths, horizon: Math.min(returns.length * 2, 200) });
  }, [engine, trades, simPaths]);

  const lowSample = trades && trades.length < 20;
  const noData = !result;

  return (
    <div className="tf-container" style={{
      padding: isMobile ? '12px 14px' : '14px 18px',
      borderRadius: 10,
      background: C.sf,
      border: `1px solid ${C.bd}`,
      marginBottom: 14,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 14, lineHeight: 1 }}>🎲</span>
        <span style={{
          fontSize: 9, fontWeight: 700, fontFamily: M,
          color: C.t3, letterSpacing: '0.05em', textTransform: 'uppercase',
        }}>
          Monte Carlo Forecast
        </span>
        <span style={{
          fontSize: 8, fontFamily: M, color: C.t3,
          marginLeft: 'auto', opacity: 0.7,
        }}>
          {result ? `${result.paths.toLocaleString()} paths · ${result.horizon} trades` : ''}
        </span>
      </div>

      {/* Low sample warning */}
      {lowSample && (
        <div style={{
          padding: '6px 10px', borderRadius: 6,
          background: C.y + '08', border: `1px solid ${C.y}15`,
          marginBottom: 10, fontSize: 10, fontFamily: M, color: C.y,
        }}>
          ⚠️ Based on {trades?.length || 0} trades — add {20 - (trades?.length || 0)} more for reliable forecasts
        </div>
      )}

      {noData ? (
        <div style={{ fontSize: 11, fontFamily: M, color: C.t3, textAlign: 'center', padding: '16px 0' }}>
          Add at least 5 trades to enable Monte Carlo analysis
        </div>
      ) : (
        <>
          {/* Equity ribbon sparkline */}
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
            <EquityRibbon
              percentiles={result.percentiles}
              width={isMobile ? 240 : 280}
              height={56}
            />
          </div>

          {/* Key stats */}
          <div style={{
            display: 'flex', gap: 4,
            padding: '8px 0', borderTop: `1px solid ${C.bd}30`,
          }}>
            <Stat
              label="Profit Prob"
              value={`${result.profitProbability}%`}
              color={result.profitProbability >= 60 ? C.g : result.profitProbability >= 40 ? C.y : C.r}
              tip="Probability of being profitable after the simulated horizon"
            />
            <Stat
              label="Ruin Risk"
              value={`${result.ruinProbability}%`}
              color={result.ruinProbability <= 5 ? C.g : result.ruinProbability <= 20 ? C.y : C.r}
              tip="Probability of a 50%+ drawdown during the horizon"
            />
            <Stat
              label="Median DD"
              value={`${result.maxDrawdowns.median.toFixed(1)}%`}
              color={result.maxDrawdowns.median < 15 ? C.g : result.maxDrawdowns.median < 30 ? C.y : C.r}
              tip="Median maximum drawdown across all simulation paths"
            />
          </div>

          {/* Final balance percentiles */}
          <div style={{
            display: 'flex', gap: 4, padding: '6px 0',
            borderTop: `1px solid ${C.bd}15`,
          }}>
            <Stat label="P5" value={`$${Math.round(result.finalBalances.p5).toLocaleString()}`} />
            <Stat label="P25" value={`$${Math.round(result.finalBalances.p25).toLocaleString()}`} />
            <Stat label="Median" value={`$${Math.round(result.finalBalances.p50).toLocaleString()}`} color={C.b} />
            <Stat label="P75" value={`$${Math.round(result.finalBalances.p75).toLocaleString()}`} />
            <Stat label="P95" value={`$${Math.round(result.finalBalances.p95).toLocaleString()}`} />
          </div>
        </>
      )}
    </div>
  );
}
