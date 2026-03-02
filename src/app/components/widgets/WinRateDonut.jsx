// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — Win Rate Donut Chart
// Compact donut showing win/loss ratio with center percentage
// ═══════════════════════════════════════════════════════════════════

import React, { useMemo } from 'react';
import ChartWrapper from '../chart/core/ChartWrapper.jsx';
import { C, M } from '../../../constants.js';

/**
 * @param {number} wins - Number of winning trades
 * @param {number} losses - Number of losing trades
 * @param {number} size - Chart size in px (default 140)
 */
function WinRateDonut({ wins = 0, losses = 0, size = 140 }) {
  const total = wins + losses;
  const winPct = total > 0 ? ((wins / total) * 100).toFixed(1) : '0.0';

  const config = useMemo(() => {
    if (total === 0) return null;

    return {
      type: 'doughnut',
      data: {
        labels: ['Wins', 'Losses'],
        datasets: [
          {
            data: [wins, losses],
            backgroundColor: [C.g, C.r],
            hoverBackgroundColor: [C.g + 'cc', C.r + 'cc'],
            borderWidth: 0,
            spacing: 2,
          },
        ],
      },
      options: {
        cutout: '72%',
        plugins: {
          tooltip: {
            callbacks: {
              label: (item) => {
                const pct = ((item.parsed / total) * 100).toFixed(1);
                return `${item.label}: ${item.parsed} (${pct}%)`;
              },
            },
          },
        },
      },
      plugins: [
        {
          id: 'centerLabel',
          beforeDraw(chart) {
            const { ctx, chartArea } = chart;
            const cx = (chartArea.left + chartArea.right) / 2;
            const cy = (chartArea.top + chartArea.bottom) / 2;

            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Percentage
            ctx.font = `800 18px ${M}`;
            ctx.fillStyle = C.t1;
            ctx.fillText(`${winPct}%`, cx, cy - 6);

            // Label
            ctx.font = `500 9px ${M}`;
            ctx.fillStyle = C.t3;
            ctx.fillText('WIN RATE', cx, cy + 12);

            ctx.restore();
          },
        },
      ],
    };
  }, [wins, losses, total, winPct]);

  if (!config) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: C.bg2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          color: C.t3,
        }}
      >
        No data
      </div>
    );
  }

  return <ChartWrapper config={config} height={size} style={{ width: size }} />;
}
export default React.memo(WinRateDonut);
