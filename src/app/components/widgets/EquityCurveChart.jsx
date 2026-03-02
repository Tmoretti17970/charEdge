// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — Equity Curve Chart
// Cumulative P&L line chart with gradient fill
// ═══════════════════════════════════════════════════════════════════

import React, { useMemo } from 'react';
import ChartWrapper from '../chart/core/ChartWrapper.jsx';
import { C, M } from '../../../constants.js';

/**
 * @param {Array} eq - Equity curve array from computeFast: [{ date, pnl, daily, dd }]
 * @param {number} height - Chart height (default 280)
 * @param {boolean} showBenchmark - If true, overlays a benchmark index curve
 */
function EquityCurveChart({ eq = [], height = 280, showBenchmark = false, showDrawdown = false }) {
  const config = useMemo(() => {
    if (!eq.length) return null;

    const labels = eq.map((p) => p.date);
    const values = eq.map((p) => p.pnl);
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
  }, [eq, showBenchmark, showDrawdown]);

  if (!config) return null;

  return <ChartWrapper config={config} height={height} />;
}
export default React.memo(EquityCurveChart);
