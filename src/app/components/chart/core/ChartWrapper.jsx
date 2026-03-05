// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — Chart.js React Wrapper
// Handles Chart.js lifecycle: create → update → destroy
// Dark-themed defaults, responsive, retina-aware
// ═══════════════════════════════════════════════════════════════════

import { useRef, useEffect } from 'react';
import Chart from 'chart.js/auto';
import { C } from '../../../../constants.js';

// ─── Lazy initialisation (avoids Vite TDZ on `Chart` binding) ───
let _defaultsApplied = false;

function ensureDefaults() {
  if (_defaultsApplied) return;
  _defaultsApplied = true;

  // Register zoom/pan plugin only in browser (hammerjs requires window)
  if (typeof window !== 'undefined') {
    import('chartjs-plugin-zoom')
      .then((mod) => {
        Chart.register(mod.default || mod);
      })
      .catch(() => { });
  }

  // Global Chart.js defaults for dark theme
  Chart.defaults.color = C.t3;
  Chart.defaults.borderColor = C.bd;
  Chart.defaults.font.family = "'JetBrains Mono', monospace";
  Chart.defaults.font.size = 10;
  Chart.defaults.responsive = true;
  Chart.defaults.maintainAspectRatio = false;
  Chart.defaults.animation.duration = 300;
  Chart.defaults.plugins.legend.display = false;
  Chart.defaults.plugins.tooltip.backgroundColor = C.sf2;
  Chart.defaults.plugins.tooltip.borderColor = C.bd;
  Chart.defaults.plugins.tooltip.borderWidth = 1;
  Chart.defaults.plugins.tooltip.titleColor = C.t1;
  Chart.defaults.plugins.tooltip.bodyColor = C.t2;
  Chart.defaults.plugins.tooltip.cornerRadius = 6;
  Chart.defaults.plugins.tooltip.padding = 8;
  Chart.defaults.plugins.tooltip.displayColors = false;
}

/**
 * ChartWrapper — mounts a Chart.js instance on a canvas.
 *
 * @param {object} config - Chart.js config ({ type, data, options })
 * @param {number} height - Container height in px (default 240)
 * @param {object} style - Additional container styles
 *
 * Usage:
 *   <ChartWrapper config={{ type: 'line', data: {...}, options: {...} }} height={300} />
 */
export default function ChartWrapper({ config, height = 240, style = {} }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    ensureDefaults();

    if (!canvasRef.current || !config) return;

    // Destroy previous instance
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const ctx = canvasRef.current.getContext('2d');
    chartRef.current = new Chart(ctx, {
      ...config,
      options: {
        ...config.options,
        responsive: true,
        maintainAspectRatio: false,
      },
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [config]);

  return (
    <div style={{ position: 'relative', height, width: '100%', ...style }}>
      <canvas ref={canvasRef} />
    </div>
  );
}

export { Chart, ChartWrapper };
