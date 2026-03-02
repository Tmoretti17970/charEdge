// ═══════════════════════════════════════════════════════════════════
// charEdge — Walk-Forward & Monte Carlo Results Panel
// Displays results from walk-forward analysis and Monte Carlo
// simulation in a compact, informative panel.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useMemo, useCallback } from 'react';
import { walkForwardAnalysis, monteCarloSimulation } from '../../../../charting_library/core/WalkForwardMonteCarlo.js';
import { useBacktestStore } from '../../../../state/useBacktestStore.js';

export default function WalkForwardPanel({ bars, onClose }) {
  const [tab, setTab] = useState('walkforward');
  const [running, setRunning] = useState(false);
  const [wfResult, setWfResult] = useState(null);
  const [mcResult, setMcResult] = useState(null);
  const [numFolds, setNumFolds] = useState(5);
  const [mcSims, setMcSims] = useState(1000);

  const lastBacktest = useBacktestStore((s) => s.results?.[0]);

  const runWF = useCallback(() => {
    if (!bars?.length || !lastBacktest?.strategy) return;
    setRunning(true);
    setTimeout(() => {
      const result = walkForwardAnalysis(bars, lastBacktest.strategy, lastBacktest.config, { numFolds });
      setWfResult(result);
      setRunning(false);
    }, 50);
  }, [bars, lastBacktest, numFolds]);

  const runMC = useCallback(() => {
    if (!lastBacktest) return;
    setRunning(true);
    setTimeout(() => {
      const result = monteCarloSimulation(lastBacktest, { simulations: mcSims });
      setMcResult(result);
      setRunning(false);
    }, 50);
  }, [lastBacktest, mcSims]);

  return (
    <div className="tf-wf-panel tf-fade-scale">
      <div className="tf-wf-header">
        <div className="tf-wf-header__title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 3v18h18"/><path d="M7 16l4-8 4 4 4-8"/>
          </svg>
          Advanced Analysis
        </div>
        <button className="tf-wf-header__close" onClick={onClose}>✕</button>
      </div>

      {/* Tabs */}
      <div className="tf-wf-tabs">
        <button className={`tf-wf-tab ${tab === 'walkforward' ? 'tf-wf-tab--active' : ''}`} onClick={() => setTab('walkforward')}>
          Walk-Forward
        </button>
        <button className={`tf-wf-tab ${tab === 'montecarlo' ? 'tf-wf-tab--active' : ''}`} onClick={() => setTab('montecarlo')}>
          Monte Carlo
        </button>
      </div>

      {!lastBacktest && (
        <div className="tf-wf-empty">Run a backtest first to enable advanced analysis</div>
      )}

      {/* Walk-Forward */}
      {tab === 'walkforward' && lastBacktest && (
        <div className="tf-wf-content">
          <div className="tf-wf-config">
            <div className="tf-wf-config-field">
              <label>Folds</label>
              <input type="number" value={numFolds} onChange={e => setNumFolds(parseInt(e.target.value) || 5)} min="3" max="10" />
            </div>
            <button className="tf-wf-run-btn" onClick={runWF} disabled={running || !bars?.length}>
              {running ? '⏳ Running...' : '▶ Run Walk-Forward'}
            </button>
          </div>

          {wfResult?.success && (
            <div className="tf-wf-results">
              <div className="tf-wf-score-row">
                <div className={`tf-wf-score ${wfResult.aggregate.consistencyScore >= 60 ? 'tf-wf-score--good' : 'tf-wf-score--bad'}`}>
                  <div className="tf-wf-score__value">{wfResult.aggregate.consistencyScore}%</div>
                  <div className="tf-wf-score__label">Consistency</div>
                </div>
                <div className={`tf-wf-score ${!wfResult.aggregate.isOverfit ? 'tf-wf-score--good' : 'tf-wf-score--bad'}`}>
                  <div className="tf-wf-score__value">{wfResult.aggregate.efficiencyRatio}x</div>
                  <div className="tf-wf-score__label">Efficiency</div>
                </div>
                <div className="tf-wf-score">
                  <div className="tf-wf-score__value">{wfResult.aggregate.profitableFolds}/{wfResult.aggregate.totalFolds}</div>
                  <div className="tf-wf-score__label">Profitable</div>
                </div>
              </div>

              {wfResult.aggregate.isOverfit && (
                <div className="tf-wf-warning">⚠️ Strategy may be overfit (efficiency ratio &lt; 0.3)</div>
              )}

              <div className="tf-wf-fold-table">
                <div className="tf-wf-fold-header">
                  <span>Fold</span><span>IS P&L</span><span>OOS P&L</span><span>OOS WR</span>
                </div>
                {wfResult.folds.map(f => (
                  <div key={f.fold} className="tf-wf-fold-row">
                    <span>{f.fold}</span>
                    <span style={{ color: (f.inSample.netPnL || 0) >= 0 ? '#26A69A' : '#EF5350' }}>
                      ${(f.inSample.netPnL || 0).toFixed(0)}
                    </span>
                    <span style={{ color: (f.outOfSample.netPnL || 0) >= 0 ? '#26A69A' : '#EF5350' }}>
                      ${(f.outOfSample.netPnL || 0).toFixed(0)}
                    </span>
                    <span>{(f.outOfSample.winRate || 0).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Monte Carlo */}
      {tab === 'montecarlo' && lastBacktest && (
        <div className="tf-wf-content">
          <div className="tf-wf-config">
            <div className="tf-wf-config-field">
              <label>Simulations</label>
              <input type="number" value={mcSims} onChange={e => setMcSims(parseInt(e.target.value) || 1000)} min="100" max="10000" step="100" />
            </div>
            <button className="tf-wf-run-btn" onClick={runMC} disabled={running}>
              {running ? '⏳ Running...' : '▶ Run Monte Carlo'}
            </button>
          </div>

          {mcResult?.success && (
            <div className="tf-wf-results">
              {/* Equity stats */}
              <div className="tf-wf-mc-section">
                <div className="tf-wf-mc-title">📊 Final Equity ({mcResult.confidenceLevel}% CI)</div>
                <div className="tf-wf-mc-grid">
                  <McStat label="Mean" value={`$${mcResult.equity.mean}`} />
                  <McStat label="Median" value={`$${mcResult.equity.median}`} />
                  <McStat label="Best" value={`$${mcResult.equity.best}`} color="#26A69A" />
                  <McStat label="Worst" value={`$${mcResult.equity.worst}`} color="#EF5350" />
                  <McStat label="CI Low" value={`$${mcResult.equity.ci[0]}`} />
                  <McStat label="CI High" value={`$${mcResult.equity.ci[1]}`} />
                </div>
                <div className="tf-wf-mc-prob">
                  Probability of Profit: <strong style={{ color: mcResult.equity.probabilityOfProfit >= 50 ? '#26A69A' : '#EF5350' }}>
                    {mcResult.equity.probabilityOfProfit}%
                  </strong>
                </div>
              </div>

              {/* Drawdown */}
              <div className="tf-wf-mc-section">
                <div className="tf-wf-mc-title">📉 Max Drawdown</div>
                <div className="tf-wf-mc-grid">
                  <McStat label="Mean" value={`${mcResult.drawdown.mean}%`} />
                  <McStat label="Worst" value={`${mcResult.drawdown.worst}%`} color="#EF5350" />
                </div>
              </div>

              {/* Distribution bars */}
              {mcResult.distribution?.equityBins && (
                <div className="tf-wf-mc-section">
                  <div className="tf-wf-mc-title">📊 Equity Distribution</div>
                  <div className="tf-wf-mc-histogram">
                    {mcResult.distribution.equityBins.map((bin, i) => (
                      <div key={i} className="tf-wf-mc-bar-container">
                        <div
                          className="tf-wf-mc-bar"
                          style={{
                            height: `${bin.normalized * 100}%`,
                            background: bin.min >= (lastBacktest?.config?.initialCapital || 10000) ? '#26A69A' : '#EF5350',
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function McStat({ label, value, color }) {
  return (
    <div className="tf-wf-mc-stat">
      <span className="tf-wf-mc-stat__label">{label}</span>
      <span className="tf-wf-mc-stat__value" style={color ? { color } : {}}>{value}</span>
    </div>
  );
}
