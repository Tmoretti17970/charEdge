import { useState, useMemo } from 'react';
import { C, M } from '../../../constants.js';
import { SectionLabel } from '../../features/analytics/analytics_ui/AnalyticsPrimitives.jsx';
import { Card } from '../ui/UIKit.jsx';

export default function RiskSimulator({ trades, defaultAccountSize = 10000 }) {
  const [multiplier, setMultiplier] = useState(1.0);
  const [runs] = useState(2000); // UI fixed for speed
  const seqLen = 100;
  const ruinDdThreshold = 0.3; // 30% drawdown

  // Extract non-zero PnLs
  const pnls = useMemo(() => trades.map((t) => t.pnl || 0).filter((p) => p !== 0), [trades]);

  // Run simulation whenever multiplier changes
  const simResult = useMemo(() => {
    if (pnls.length < 5) return { ror: 0, samplePath: [] };

    let ruinCount = 0;
    let samplePath = []; // store one representative path
    const n = pnls.length;

    for (let run = 0; run < runs; run++) {
      let equity = defaultAccountSize;
      let eqPeak = defaultAccountSize;
      let ruined = false;
      const currentPath = [defaultAccountSize];

      for (let j = 0; j < seqLen; j++) {
        // Multiply historical P&L by the slider value
        const pnl = pnls[Math.floor(Math.random() * n)] * multiplier;
        equity += pnl;
        currentPath.push(equity);

        if (equity > eqPeak) eqPeak = equity;
        if (equity <= 0 || (eqPeak > 0 && (eqPeak - equity) / eqPeak >= ruinDdThreshold)) {
          ruined = true;
          break; // Ruined!
        }
      }

      if (ruined) ruinCount++;

      // Save the 50th run as a visual sample
      if (run === 50) samplePath = currentPath;
    }

    const ror = (ruinCount / runs) * 100;
    return { ror, samplePath };
  }, [pnls, multiplier, runs, defaultAccountSize]);

  if (pnls.length < 5) return null;

  const color = simResult.ror < 5 ? C.g : simResult.ror < 25 ? C.y : C.r;

  return (
    <Card style={{ padding: 16, marginBottom: 16, background: `linear-gradient(to right, ${C.bg2}, ${C.b + '05'})` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 18 }}>🎲</span>
        <SectionLabel text="Interactive Risk Simulator (Monte Carlo)" />
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'stretch' }}>
        {/* Controls */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 12, color: C.t2, lineHeight: 1.5 }}>
            Adjust your risk per trade to see how escalating position sizes dynamically impacts your hypothetical <strong style={{color: C.t1}}>Risk of Ruin (30% Drawdown limit)</strong> over the next 100 trades.
          </div>

          <div style={{ marginTop: 'auto', background: C.sf, padding: 16, borderRadius: 8, border: `1px solid ${C.bd}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: C.t2, fontWeight: 600 }}>Risk Multiplier</span>
              <span style={{ fontSize: 13, color: multiplier > 1 ? C.y : C.t1, fontWeight: 800, fontFamily: M }}>{multiplier.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="3.0"
              step="0.1"
              value={multiplier}
              onChange={(e) => setMultiplier(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: C.b }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: C.t3 }}>
              <span>0.5x (Half Risk)</span>
              <span>1.0x (Current)</span>
              <span>3.0x (Triple Risk)</span>
            </div>
          </div>
        </div>

        {/* Results */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: color + '15', borderRadius: 8, border: `1px solid ${color}30`, padding: 16 }}>
          <div style={{ fontSize: 11, color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Simulated Risk of Ruin</div>
          <div style={{ fontSize: 42, color, fontWeight: 800, fontFamily: M, margin: '4px 0' }}>{simResult.ror.toFixed(1)}%</div>
          <div style={{ fontSize: 11, color: C.t2, textAlign: 'center' }}>
            Probability of hitting a 30% drawdown before recovering, based on {runs.toLocaleString()} simulated paths.
          </div>
        </div>
      </div>
    </Card>
  );
}
