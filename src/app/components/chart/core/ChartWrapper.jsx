// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — Chart.js React Wrapper
// Handles Chart.js lifecycle: create → update → destroy
// Theme-reactive defaults, responsive, retina-aware
// ═══════════════════════════════════════════════════════════════════

import { useRef, useEffect, useState } from 'react';
import Chart from 'chart.js/auto';
import { C } from '../../../../constants.js';

// ─── Lazy plugin registration (once only) ───────────────────────
let _pluginRegistered = false;

function registerPlugins() {
  if (_pluginRegistered) return;
  _pluginRegistered = true;

  if (typeof window !== 'undefined') {
    import('chartjs-plugin-zoom')
      .then((mod) => {
        Chart.register(mod.default || mod);
      })
      .catch(() => { });
  }
}

/**
 * Apply Chart.js global defaults from the current C (theme) values.
 * Called on every chart mount so light/dark mode is always in sync.
 */
function applyThemeDefaults() {
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

  // Listen for theme changes to force chart re-creation
  const [themeKey, setThemeKey] = useState(0);
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.attributeName === 'class') {
          setThemeKey((k) => k + 1);
        }
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    registerPlugins();
    applyThemeDefaults();

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
  }, [config, themeKey]);

  return (
    <div style={{ position: 'relative', height, width: '100%', ...style }}>
      <canvas ref={canvasRef} />
    </div>
  );
}

export { Chart, ChartWrapper };
