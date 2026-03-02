// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — Time Bar Chart
// Vertical bars for day-of-week or hour-of-day P&L breakdowns
// ═══════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import ChartWrapper from './core/ChartWrapper.jsx';
import { C, M } from '../../../constants.js';

/**
 * @param {Array} buckets - Array of { name, pnl, count, wins }
 * @param {number} height - Chart height
 * @param {string} valueKey - Which field to chart ('pnl' or 'count')
 */
export default function TimeBarChart({ buckets = [], height = 200, valueKey = 'pnl' }) {
  const config = useMemo(() => {
    const filtered = buckets.filter((b) => b.count > 0);
    if (filtered.length === 0) return null;

    const labels = filtered.map((b) => b.name);
    const values = filtered.map((b) => b[valueKey]);
    const colors = values.map((v) => (valueKey === 'pnl' ? (v >= 0 ? C.g : C.r) : C.b + '80'));

    return {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: valueKey === 'pnl' ? 'P&L' : 'Trades',
            data: values,
            backgroundColor: colors,
            hoverBackgroundColor: colors.map((c) => c + 'cc'),
            borderRadius: 3,
            borderSkipped: false,
            maxBarThickness: 40,
          },
        ],
      },
      options: {
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              font: { family: "'Outfit', sans-serif", size: 10, weight: 600 },
              color: C.t2,
            },
            border: { display: false },
          },
          y: {
            grid: { color: C.bd + '40', drawTicks: false },
            ticks: {
              font: { family: M, size: 9 },
              color: C.t3,
              callback: (v) =>
                valueKey === 'pnl'
                  ? Math.abs(v) >= 1000
                    ? `$${(v / 1000).toFixed(1)}k`
                    : `$${v.toFixed(0)}`
                  : v.toString(),
            },
            border: { display: false },
          },
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: (item) => {
                const bucket = filtered[item.dataIndex];
                if (valueKey === 'pnl') {
                  const sign = bucket.pnl >= 0 ? '+' : '';
                  return `${sign}$${bucket.pnl.toFixed(2)} (${bucket.count} trades)`;
                }
                return `${bucket.count} trades`;
              },
            },
          },
        },
      },
      plugins: [
        {
          id: 'zeroLine',
          beforeDraw(chart) {
            if (valueKey !== 'pnl') return;
            const { ctx, chartArea, scales } = chart;
            const yScale = scales.y;
            if (!yScale) return;
            const zeroY = yScale.getPixelForValue(0);
            if (zeroY < chartArea.top || zeroY > chartArea.bottom) return;
            ctx.save();
            ctx.strokeStyle = C.t3 + '30';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(chartArea.left, zeroY);
            ctx.lineTo(chartArea.right, zeroY);
            ctx.stroke();
            ctx.restore();
          },
        },
      ],
    };
  }, [buckets, valueKey]);

  if (!config) return null;

  return <ChartWrapper config={config} height={height} />;
}
