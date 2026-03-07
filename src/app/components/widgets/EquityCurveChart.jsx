// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — Equity Curve Chart
// Cumulative P&L line chart with gradient fill
// ═══════════════════════════════════════════════════════════════════

import React, { useMemo, useState } from 'react';
import ChartWrapper from '../chart/core/ChartWrapper.jsx';
import { C, M } from '../../../constants.js';

/**
 * @param {Array} eq - Equity curve array from computeFast: [{ date, pnl, daily, dd }]
 * @param {number} height - Chart height (default 280)
 * @param {boolean} showBenchmark - If true, overlays a benchmark index curve
 */
function EquityCurveChart({ eq = [], height = 280, showBenchmark = false, showDrawdown = false }) {
  const [smoothMode, setSmoothMode] = useState('raw');

  // D4.2: Apply smoothing to equity data
  const smoothedEq = useMemo(() => {
    if (!eq.length || smoothMode === 'raw') return eq;
    // Build points array for smoothing
    const points = eq.map(p => ({ date: p.date, pnl: p.pnl }));
    let smoothed;
    if (smoothMode === 'gaussian') {
      // Inline Gaussian: 1D kernel, sigma=3
      const sigma = 3;
      const halfK = Math.ceil(sigma * 3);
      const kernel = [];
      let ksum = 0;
      for (let i = -halfK; i <= halfK; i++) { const v = Math.exp(-(i*i)/(2*sigma*sigma)); kernel.push(v); ksum += v; }
      for (let i = 0; i < kernel.length; i++) kernel[i] /= ksum;
      smoothed = points.map((pt, idx) => {
        let s = 0, w = 0;
        for (let k = 0; k < kernel.length; k++) {
          const j = idx + k - halfK;
          if (j >= 0 && j < points.length) { s += points[j].pnl * kernel[k]; w += kernel[k]; }
        }
        return { ...eq[idx], pnl: w > 0 ? s / w : pt.pnl };
      });
    } else {
      // WMA with period 5
      const period = Math.min(5, points.length);
      smoothed = points.map((pt, idx) => {
        if (idx < period - 1) return { ...eq[idx] };
        let ws = 0, tw = 0;
        for (let j = 0; j < period; j++) { const wt = j + 1; ws += points[idx - period + 1 + j].pnl * wt; tw += wt; }
        return { ...eq[idx], pnl: tw > 0 ? ws / tw : pt.pnl };
      });
    }
    return smoothed;
  }, [eq, smoothMode]);

  const config = useMemo(() => {
    if (!smoothedEq.length) return null;

    const labels = smoothedEq.map((p) => p.date);
    const values = smoothedEq.map((p) => p.pnl);
    const isPositive = values[values.length - 1] >= 0;

    const datasets = [
      {
            label: 'Equity',
            data: values,
            borderColor: isPositive ? C.g : C.r,
            borderWidth: 2,
            pointRadius: 0,
            pointHitRadius: 8,
            pointHoverRadius: 4,
            pointHoverBackgroundColor: isPositive ? C.g : C.r,
            tension: 0.3,
            fill: {
              target: 'origin',
              above: isPositive ? C.g + '18' : C.r + '08',
              below: C.r + '18',
            },
            yAxisID: 'y',
            order: 1, // Draw equity on top
          }
        ];

        // H2.2: Drawdown overlay
        if (showDrawdown && eq.some((p) => p.dd > 0)) {
          datasets.push({
            label: 'Drawdown',
            data: eq.map((p) => -p.dd), // negate so it draws downward
            borderColor: C.r + '60',
            borderWidth: 1,
            pointRadius: 0,
            tension: 0.3,
            fill: {
              target: 'origin',
              above: 'transparent',
              below: C.r + '15',
            },
            yAxisID: 'y1',
            order: 3,
          });
        }

        // Ensure benchmark doesn't break if no length
        if (showBenchmark && values.length > 0) {
          // Illustrative benchmark: 10% annualized drift over the period
          // In a real app, this would fetch SPY/BTC data
          const daysTotal = Object.keys(eq).length;
          const driftPerDay = 0.10 / 252; // 10% over 252 trading days

          let accountBase = 5000; // Assumed starting capital for relative comp
          // We can size relative to the user's max absolute P&L to make the scale visible
          if (values.length > 0) {
            const maxVal = Math.max(...values.map(Math.abs));
            accountBase = Math.max(5000, maxVal * 2);
          }

          let currentBmk = 0;
          const bmkValues = eq.map(() => {
            currentBmk += accountBase * driftPerDay; // simple linear/geometric drift
            // Add a tiny bit of random noise for realism
            const noise = (Math.random() - 0.5) * (accountBase * 0.005);
            currentBmk += noise;
            return currentBmk;
          });

          datasets.push({
            label: 'Benchmark (SPY 10% Drift)',
            data: bmkValues,
            borderColor: C.b, // Blurple/Accent
            borderWidth: 2,
            borderDash: [4, 4], // Dashed line to differentiate
            pointRadius: 0,
            pointHitRadius: 8,
            tension: 0.2,
            fill: false,
            yAxisID: 'y',
            order: 2,
          });
        }

    const scales = {
          x: {
            grid: { display: false },
            ticks: {
              maxTicksLimit: 8,
              font: { family: M, size: 9 },
              color: C.t3,
            },
            border: { display: false },
          },
          y: {
            position: 'right',
            grid: {
              color: C.bd + '60',
              drawTicks: false,
            },
            ticks: {
              font: { family: M, size: 9 },
              color: C.t3,
              callback: (v) =>
                v >= 1000
                  ? `$${(v / 1000).toFixed(1)}k`
                  : v <= -1000
                    ? `-$${(Math.abs(v) / 1000).toFixed(1)}k`
                    : `$${v.toFixed(0)}`,
            },
            border: { display: false },
          },
        };

    // H2.2: Drawdown secondary axis
    if (showDrawdown) {
      scales.y1 = {
        position: 'left',
        reverse: false,
        grid: { display: false },
        ticks: {
          font: { family: M, size: 9 },
          color: C.r + '80',
          callback: (v) => `${Math.abs(v).toFixed(0)}%`,
        },
        border: { display: false },
        title: {
          display: true,
          text: 'Drawdown %',
          font: { family: M, size: 9 },
          color: C.r + '80',
        },
      };
    }

    return {
      type: 'line',
      data: {
        labels,
        datasets
      },
      options: {
        scales,
        plugins: {
          tooltip: {
            callbacks: {
              title: (items) => items[0]?.label || '',
              label: (item) => {
                if (item.dataset.label === 'Drawdown') {
                  return `DD: ${Math.abs(item.parsed.y).toFixed(1)}%`;
                }
                const val = item.parsed.y;
                const sign = val >= 0 ? '+' : '';
                return `P&L: ${sign}$${val.toFixed(2)}`;
              },
            },
          },
          // Zero line annotation
          annotation: undefined,
          // H2.2: Interactive zoom & pan
          zoom: {
            pan: {
              enabled: true,
              mode: 'x',
              modifierKey: null,
            },
            zoom: {
              wheel: { enabled: true, speed: 0.05 },
              pinch: { enabled: true },
              mode: 'x',
              onZoomComplete: undefined,
            },
            limits: {
              x: { minRange: 3 }, // Don't zoom below 3 data points
            },
          },
        },
        interaction: {
          mode: 'index',
          intersect: false,
        },
      },
      plugins: [
        {
          // Custom plugin to draw zero line
          id: 'zeroLine',
          beforeDraw(chart) {
            const { ctx, chartArea, scales } = chart;
            const yScale = scales.y;
            if (!yScale) return;
            const zeroY = yScale.getPixelForValue(0);
            if (zeroY < chartArea.top || zeroY > chartArea.bottom) return;

            ctx.save();
            ctx.strokeStyle = C.t3 + '40';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(chartArea.left, zeroY);
            ctx.lineTo(chartArea.right, zeroY);
            ctx.stroke();
            ctx.restore();
          },
        },
      ],
    };
  }, [smoothedEq, showBenchmark, showDrawdown]);

  if (!config) return null;

  // D4.2: Smoothing toggle pills
  const pillStyle = (mode) => ({
    padding: '3px 10px',
    fontSize: '10px',
    fontFamily: 'Inter, system-ui, sans-serif',
    borderRadius: '4px',
    border: 'none',
    cursor: 'pointer',
    background: smoothMode === mode ? 'rgba(99, 102, 241, 0.25)' : 'rgba(148, 163, 184, 0.08)',
    color: smoothMode === mode ? '#818cf8' : 'rgba(148, 163, 184, 0.7)',
    fontWeight: smoothMode === mode ? 600 : 400,
    transition: 'all 0.15s ease',
  });

  return (
    <div>
      <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', marginBottom: '4px' }}>
        <button style={pillStyle('raw')} onClick={() => setSmoothMode('raw')}>Raw</button>
        <button style={pillStyle('gaussian')} onClick={() => setSmoothMode('gaussian')}>Gaussian</button>
        <button style={pillStyle('wma')} onClick={() => setSmoothMode('wma')}>WMA</button>
      </div>
      <ChartWrapper config={config} height={height} />
    </div>
  );
}
export default React.memo(EquityCurveChart);
