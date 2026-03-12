// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — R-Multiple Distribution Chart
// Histogram showing frequency of R-multiple outcomes
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useMemo } from 'react';
import { C, M } from '../../../constants.js';
import ChartWrapper from '../chart/core/ChartWrapper.jsx';

/**
 * @param {Array} trades - Full trades array
 * @param {number} height - Chart height
 */
function RDistributionChart({ trades = [], height = 200 }) {
  const config = useMemo(() => {
    // Filter trades with valid R-multiples
    const rValues = trades.map((t) => t.rMultiple).filter((r) => r != null && isFinite(r));

    if (rValues.length < 3) return null;

    // Build histogram buckets from -4R to +4R in 0.5R steps
    const bucketSize = 0.5;
    const minR = -4;
    const maxR = 4;
    const buckets = [];

    for (let r = minR; r < maxR; r += bucketSize) {
      const label = r === 0 ? '0R' : `${r >= 0 ? '+' : ''}${r.toFixed(1)}R`;
      const count = rValues.filter((v) => v >= r && v < r + bucketSize).length;
      buckets.push({ label, r, count });
    }

    // Overflow buckets
    const belowCount = rValues.filter((v) => v < minR).length;
    const aboveCount = rValues.filter((v) => v >= maxR).length;
    if (belowCount > 0) buckets.unshift({ label: `<${minR}R`, r: minR - 1, count: belowCount });
    if (aboveCount > 0) buckets.push({ label: `>${maxR}R`, r: maxR, count: aboveCount });

    const labels = buckets.map((b) => b.label);
    const values = buckets.map((b) => b.count);
    const colors = buckets.map((b) => (b.r >= 0 ? C.g + '90' : C.r + '90'));

    return {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Trades',
            data: values,
            backgroundColor: colors,
            hoverBackgroundColor: buckets.map((b) => (b.r >= 0 ? C.g : C.r)),
            borderRadius: 2,
            borderSkipped: false,
          },
        ],
      },
      options: {
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              font: { family: M, size: 8 },
              color: C.t3,
              maxRotation: 45,
            },
            border: { display: false },
          },
          y: {
            grid: { color: C.bd + '40', drawTicks: false },
            ticks: {
              font: { family: M, size: 9 },
              color: C.t3,
              stepSize: 1,
            },
            border: { display: false },
            title: {
              display: true,
              text: 'Trades',
              font: { family: M, size: 9 },
              color: C.t3,
            },
          },
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: (item) => `${item.parsed.y} trade${item.parsed.y !== 1 ? 's' : ''}`,
            },
          },
        },
      },
    };
  }, [trades]);

  if (!config) return null;

  return <ChartWrapper config={config} height={height} />;
}

export default React.memo(RDistributionChart);
