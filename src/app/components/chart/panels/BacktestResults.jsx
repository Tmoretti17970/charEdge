// ═══════════════════════════════════════════════════════════════════
// charEdge — Backtest Results Dashboard
// Comprehensive performance visualization for backtest results.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useBacktestStore } from '../../../../state/useBacktestStore.js';

// ─── Tab Definitions ─────────────────────────────────────────────
const TABS = [
  { id: 'overview', label: 'Overview', icon: '📊' },
  { id: 'trades', label: 'Trades', icon: '📋' },
  { id: 'equity', label: 'Equity Curve', icon: '📈' },
];

export default function BacktestResults({ onClose }) {
  const { currentResult: result } = useBacktestStore();
  const [activeTab, setActiveTab] = useState('overview');

  if (!result) return null;

  const { metrics: m, trades, equity } = result;

  return (
    <div className="tf-backtest-results">
      {/* Header */}
      <div className="tf-backtest-results__header">
        <div className="tf-backtest-results__title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 3v18h18" /><path d="M7 16l4-8 4 4 6-6" />
          </svg>
          {result.strategy} — Results
        </div>
        <button className="tf-backtest-results__close" onClick={onClose} title="Close">✕</button>
      </div>

      {/* Quick Stats Bar */}
      <div className="tf-backtest-quick-stats">
        <QuickStat label="Net P&L" value={`$${m.netPnL.toLocaleString()}`} color={m.netPnL >= 0 ? 'var(--tf-green)' : 'var(--tf-red)'} />
        <QuickStat label="Win Rate" value={`${m.winRate}%`} color={m.winRate >= 50 ? 'var(--tf-green)' : 'var(--tf-red)'} />
        <QuickStat label="Profit Factor" value={m.profitFactor === Infinity ? '∞' : m.profitFactor.toFixed(2)} color={m.profitFactor >= 1.5 ? 'var(--tf-green)' : m.profitFactor >= 1 ? 'var(--tf-yellow)' : 'var(--tf-red)'} />
        <QuickStat label="Max DD" value={`${m.maxDrawdownPercent.toFixed(1)}%`} color={m.maxDrawdownPercent <= 10 ? 'var(--tf-green)' : m.maxDrawdownPercent <= 20 ? 'var(--tf-yellow)' : 'var(--tf-red)'} />
        <QuickStat label="Sharpe" value={m.sharpeRatio.toFixed(2)} color={m.sharpeRatio >= 1 ? 'var(--tf-green)' : m.sharpeRatio >= 0 ? 'var(--tf-yellow)' : 'var(--tf-red)'} />
      </div>

      {/* Tabs */}
      <div className="tf-backtest-tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`tf-backtest-tab ${activeTab === tab.id ? 'tf-backtest-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="tf-backtest-tab-content">
        {activeTab === 'overview' && <OverviewTab metrics={m} />}
        {activeTab === 'trades' && <TradesTab trades={trades} />}
        {activeTab === 'equity' && <EquityCurveTab equity={equity} initialCapital={result.config.initialCapital} />}
      </div>
    </div>
  );
}

// ─── Quick Stat Badge ────────────────────────────────────────────

function QuickStat({ label, value, color }) {
  return (
    <div className="tf-quick-stat">
      <div className="tf-quick-stat__label">{label}</div>
      <div className="tf-quick-stat__value" style={{ color }}>{value}</div>
    </div>
  );
}

// ─── Overview Tab ────────────────────────────────────────────────

function OverviewTab({ metrics: m }) {
  return (
    <div className="tf-backtest-overview">
      <div className="tf-backtest-section">
        <h4 className="tf-backtest-section__title">Performance</h4>
        <div className="tf-metrics-grid">
          <MetricRow label="Total Return" value={`${m.netPnLPercent}%`} color={m.netPnLPercent >= 0} />
          <MetricRow label="Gross Profit" value={`$${m.grossProfit?.toLocaleString()}`} positive />
          <MetricRow label="Gross Loss" value={`-$${m.grossLoss?.toLocaleString()}`} negative />
          <MetricRow label="Profit Factor" value={m.profitFactor === Infinity ? '∞' : m.profitFactor} color={m.profitFactor >= 1} />
          <MetricRow label="Expectancy" value={`$${m.expectancy}`} color={m.expectancy >= 0} />
        </div>
      </div>

      <div className="tf-backtest-section">
        <h4 className="tf-backtest-section__title">Risk</h4>
        <div className="tf-metrics-grid">
          <MetricRow label="Max Drawdown" value={`$${m.maxDrawdown}`} />
          <MetricRow label="Max DD %" value={`${m.maxDrawdownPercent}%`} />
          <MetricRow label="Sharpe Ratio" value={m.sharpeRatio} color={m.sharpeRatio >= 1} />
          <MetricRow label="Sortino Ratio" value={m.sortinoRatio} color={m.sortinoRatio >= 1} />
          <MetricRow label="Calmar Ratio" value={m.calmarRatio} color={m.calmarRatio >= 1} />
        </div>
      </div>

      <div className="tf-backtest-section">
        <h4 className="tf-backtest-section__title">Trades</h4>
        <div className="tf-metrics-grid">
          <MetricRow label="Total Trades" value={m.totalTrades} />
          <MetricRow label="Wins / Losses" value={`${m.wins} / ${m.losses}`} />
          <MetricRow label="Win Rate" value={`${m.winRate}%`} color={m.winRate >= 50} />
          <MetricRow label="Avg Win" value={`$${m.avgWin}`} positive />
          <MetricRow label="Avg Loss" value={`-$${m.avgLoss}`} negative />
          <MetricRow label="Avg Trade" value={`$${m.avgTrade}`} color={m.avgTrade >= 0} />
          <MetricRow label="Max Consec. Wins" value={m.maxConsecutiveWins} />
          <MetricRow label="Max Consec. Losses" value={m.maxConsecutiveLosses} />
          <MetricRow label="Avg Hold (bars)" value={m.avgHoldingBars} />
        </div>
      </div>

      <div className="tf-backtest-section">
        <h4 className="tf-backtest-section__title">Long / Short</h4>
        <div className="tf-metrics-grid">
          <MetricRow label="Long Trades" value={m.longTrades} />
          <MetricRow label="Long Win Rate" value={`${m.longWinRate}%`} color={m.longWinRate >= 50} />
          <MetricRow label="Short Trades" value={m.shortTrades} />
          <MetricRow label="Short Win Rate" value={`${m.shortWinRate}%`} color={m.shortWinRate >= 50} />
        </div>
      </div>

      <div className="tf-backtest-exec-info">
        ⚡ Executed in {m.execMs}ms
      </div>
    </div>
  );
}

function MetricRow({ label, value, color, positive, negative }) {
  let colorClass = '';
  if (positive) colorClass = 'tf-metric--positive';
  else if (negative) colorClass = 'tf-metric--negative';
  else if (color === true) colorClass = 'tf-metric--positive';
  else if (color === false) colorClass = 'tf-metric--negative';

  return (
    <div className="tf-metric-row">
      <span className="tf-metric-row__label">{label}</span>
      <span className={`tf-metric-row__value ${colorClass}`}>{value}</span>
    </div>
  );
}

// ─── Trades Tab ──────────────────────────────────────────────────

function TradesTab({ trades }) {
  const [sortKey, setSortKey] = useState('entryIdx');
  const [sortDir, setSortDir] = useState('asc');

  const sorted = [...trades].sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey];
    const mult = sortDir === 'asc' ? 1 : -1;
    return (av > bv ? 1 : av < bv ? -1 : 0) * mult;
  });

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  return (
    <div className="tf-backtest-trades">
      <div className="tf-backtest-trades__table-wrap">
        <table className="tf-backtest-trades__table">
          <thead>
            <tr>
              {[
                { key: 'entryIdx', label: '#' },
                { key: 'side', label: 'Side' },
                { key: 'entryPrice', label: 'Entry' },
                { key: 'exitPrice', label: 'Exit' },
                { key: 'pnl', label: 'P&L' },
                { key: 'pnlPercent', label: '%' },
                { key: 'rMultiple', label: 'R' },
                { key: 'holdingBars', label: 'Bars' },
                { key: 'exitReason', label: 'Exit' },
              ].map(col => (
                <th key={col.key} onClick={() => handleSort(col.key)} className="tf-bt-th">
                  {col.label} {sortKey === col.key ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((t, idx) => (
              <tr key={idx} className={t.isWin ? 'tf-bt-row--win' : 'tf-bt-row--loss'}>
                <td>{idx + 1}</td>
                <td className={t.side === 'long' ? 'tf-bt-long' : 'tf-bt-short'}>
                  {t.side === 'long' ? '▲ Long' : '▼ Short'}
                </td>
                <td>{t.entryPrice?.toFixed(2)}</td>
                <td>{t.exitPrice?.toFixed(2)}</td>
                <td className={t.pnl >= 0 ? 'tf-bt-positive' : 'tf-bt-negative'}>
                  {t.pnl >= 0 ? '+' : ''}{t.pnl?.toFixed(2)}
                </td>
                <td className={t.pnlPercent >= 0 ? 'tf-bt-positive' : 'tf-bt-negative'}>
                  {t.pnlPercent?.toFixed(1)}%
                </td>
                <td>{t.rMultiple !== null ? `${t.rMultiple?.toFixed(1)}R` : '—'}</td>
                <td>{t.holdingBars}</td>
                <td className="tf-bt-exit-reason">{formatExitReason(t.exitReason)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="tf-backtest-trades__summary">
        {trades.length} trades • {trades.filter(t => t.isWin).length} wins • {trades.filter(t => !t.isWin).length} losses
      </div>
    </div>
  );
}

function formatExitReason(reason) {
  const map = { signal: '📊 Signal', stop_loss: '🛑 Stop', take_profit: '🎯 TP', end_of_data: '⏹ End' };
  return map[reason] || reason;
}

// ─── Equity Curve Tab (Canvas) ───────────────────────────────────

function EquityCurveTab({ equity, initialCapital }) {
  const canvasRef = useRef(null);

  const drawEquityCurve = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !equity?.length) return;

    const pr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    canvas.width = Math.round(w * pr);
    canvas.height = Math.round(h * pr);

    const ctx = canvas.getContext('2d');
    ctx.scale(pr, pr);

    const minEq = Math.min(...equity);
    const maxEq = Math.max(...equity);
    const range = maxEq - minEq || 1;
    const pad = 40;

    // Background
    ctx.fillStyle = 'rgba(19, 23, 34, 0.8)';
    ctx.fillRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = 'rgba(54, 58, 69, 0.4)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = pad + ((h - pad * 2) * i / 4);
      ctx.beginPath();
      ctx.moveTo(pad, y);
      ctx.lineTo(w - pad, y);
      ctx.stroke();

      const val = maxEq - (range * i / 4);
      ctx.fillStyle = '#787B86';
      ctx.font = '10px Arial';
      ctx.textAlign = 'right';
      ctx.fillText(`$${val.toFixed(0)}`, pad - 4, y + 3);
    }

    // Baseline (initial capital)
    const baseY = pad + ((maxEq - initialCapital) / range) * (h - pad * 2);
    ctx.strokeStyle = 'rgba(120, 123, 134, 0.5)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(pad, baseY);
    ctx.lineTo(w - pad, baseY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Equity Curve Line
    const chartW = w - pad * 2;
    const chartH = h - pad * 2;
    const step = chartW / (equity.length - 1);

    // Area fill (gradient)
    ctx.beginPath();
    ctx.moveTo(pad, pad + ((maxEq - equity[0]) / range) * chartH);
    for (let i = 1; i < equity.length; i++) {
      const x = pad + i * step;
      const y = pad + ((maxEq - equity[i]) / range) * chartH;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(pad + (equity.length - 1) * step, h - pad);
    ctx.lineTo(pad, h - pad);
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    const isProfit = equity[equity.length - 1] >= initialCapital;
    gradient.addColorStop(0, isProfit ? 'rgba(38, 166, 154, 0.25)' : 'rgba(239, 83, 80, 0.25)');
    gradient.addColorStop(1, 'rgba(19, 23, 34, 0)');
    ctx.fillStyle = gradient;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.moveTo(pad, pad + ((maxEq - equity[0]) / range) * chartH);
    for (let i = 1; i < equity.length; i++) {
      const x = pad + i * step;
      const y = pad + ((maxEq - equity[i]) / range) * chartH;
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = isProfit ? '#26A69A' : '#EF5350';
    ctx.lineWidth = 2;
    ctx.stroke();

    // End dot
    const lastX = pad + (equity.length - 1) * step;
    const lastY = pad + ((maxEq - equity[equity.length - 1]) / range) * chartH;
    ctx.beginPath();
    ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
    ctx.fillStyle = isProfit ? '#26A69A' : '#EF5350';
    ctx.fill();

    // Labels
    ctx.fillStyle = '#D1D4DC';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'left';
    const finalVal = equity[equity.length - 1];
    const pnl = finalVal - initialCapital;
    ctx.fillText(
      `Final: $${finalVal.toFixed(2)} (${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)})`,
      pad, 16,
    );
  }, [equity, initialCapital]);

  useEffect(() => {
    drawEquityCurve();
    window.addEventListener('resize', drawEquityCurve);
    return () => window.removeEventListener('resize', drawEquityCurve);
  }, [drawEquityCurve]);

  return (
    <div className="tf-backtest-equity">
      <canvas ref={canvasRef} className="tf-backtest-equity__canvas" />
    </div>
  );
}
