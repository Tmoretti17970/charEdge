// ═══════════════════════════════════════════════════════════════════
// charEdge — Chart Type Selector
// Extracted from UnifiedChartToolbar for progressive disclosure.
// Visual chart type picker with preview grid.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useRef, useEffect, Suspense } from 'react';
import { C, CHART_TYPES } from '@/constants.js';

const ChartTypePreview = React.lazy(() => import('../ui/ChartTypePreview.jsx'));

const ChartTypeIcon = ({ type, size = 16 }) => {
  const s = size;
  const icons = {
    candles: (
      <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
        <rect x="3" y="4" width="3" height="8" rx="0.5" fill="currentColor" opacity="0.9" />
        <line x1="4.5" y1="2" x2="4.5" y2="4" stroke="currentColor" strokeWidth="1" />
        <line x1="4.5" y1="12" x2="4.5" y2="14" stroke="currentColor" strokeWidth="1" />
        <rect x="9" y="6" width="3" height="6" rx="0.5" fill="currentColor" opacity="0.5" />
        <line x1="10.5" y1="3" x2="10.5" y2="6" stroke="currentColor" strokeWidth="1" />
        <line x1="10.5" y1="12" x2="10.5" y2="14" stroke="currentColor" strokeWidth="1" />
      </svg>
    ),
    hollow: (
      <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
        <rect x="3" y="4" width="3" height="8" rx="0.5" stroke="currentColor" strokeWidth="1" fill="none" />
        <line x1="4.5" y1="2" x2="4.5" y2="4" stroke="currentColor" strokeWidth="1" />
        <line x1="4.5" y1="12" x2="4.5" y2="14" stroke="currentColor" strokeWidth="1" />
        <rect x="9" y="6" width="3" height="6" rx="0.5" stroke="currentColor" strokeWidth="1" fill="none" />
        <line x1="10.5" y1="3" x2="10.5" y2="6" stroke="currentColor" strokeWidth="1" />
        <line x1="10.5" y1="12" x2="10.5" y2="14" stroke="currentColor" strokeWidth="1" />
      </svg>
    ),
    ohlc: (
      <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
        <line x1="4" y1="2" x2="4" y2="14" stroke="currentColor" strokeWidth="1.2" />
        <line x1="2" y1="5" x2="4" y2="5" stroke="currentColor" strokeWidth="1.2" />
        <line x1="4" y1="11" x2="6" y2="11" stroke="currentColor" strokeWidth="1.2" />
        <line x1="11" y1="3" x2="11" y2="13" stroke="currentColor" strokeWidth="1.2" />
        <line x1="9" y1="6" x2="11" y2="6" stroke="currentColor" strokeWidth="1.2" />
        <line x1="11" y1="10" x2="13" y2="10" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    ),
    line: (
      <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
        <polyline points="1,12 4,8 7,10 10,4 14,6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    ),
    area: (
      <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
        <defs><linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity="0.3" /><stop offset="100%" stopColor="currentColor" stopOpacity="0.02" /></linearGradient></defs>
        <polygon points="1,12 4,8 7,10 10,4 14,6 14,14 1,14" fill="url(#areaGrad)" />
        <polyline points="1,12 4,8 7,10 10,4 14,6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    ),
    heikinashi: (
      <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
        <rect x="3" y="5" width="3" height="7" rx="0.5" fill="currentColor" opacity="0.7" />
        <line x1="4.5" y1="3" x2="4.5" y2="5" stroke="currentColor" strokeWidth="1" />
        <rect x="9" y="4" width="3" height="6" rx="0.5" fill="currentColor" opacity="0.4" />
        <line x1="10.5" y1="2" x2="10.5" y2="4" stroke="currentColor" strokeWidth="1" />
        <line x1="10.5" y1="10" x2="10.5" y2="13" stroke="currentColor" strokeWidth="1" />
      </svg>
    ),
    baseline: (
      <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
        <line x1="1" y1="8" x2="15" y2="8" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2 1" opacity="0.4" />
        <polyline points="1,10 3,6 6,9 9,4 12,7 15,5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    ),
    footprint: (
      <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
        <rect x="2" y="2" width="12" height="12" rx="1" stroke="currentColor" strokeWidth="0.8" opacity="0.3" />
        <line x1="8" y1="2" x2="8" y2="14" stroke="currentColor" strokeWidth="0.6" opacity="0.3" />
        <line x1="2" y1="5" x2="14" y2="5" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
        <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
        <line x1="2" y1="11" x2="14" y2="11" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
        <text x="5" y="7" fontSize="3.5" fill="currentColor" opacity="0.7">42</text>
        <text x="9" y="10" fontSize="3.5" fill="currentColor" opacity="0.7">38</text>
      </svg>
    ),
    renko: (
      <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
        <rect x="1" y="8" width="4" height="4" rx="0.5" fill="currentColor" opacity="0.7" />
        <rect x="5" y="4" width="4" height="4" rx="0.5" fill="currentColor" opacity="0.5" />
        <rect x="9" y="6" width="4" height="4" rx="0.5" fill="currentColor" opacity="0.4" />
      </svg>
    ),
    range: (
      <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
        <rect x="1" y="7" width="4" height="5" rx="0.5" fill="currentColor" opacity="0.6" />
        <rect x="5" y="4" width="4" height="5" rx="0.5" fill="currentColor" opacity="0.45" />
        <rect x="9" y="6" width="4" height="5" rx="0.5" fill="currentColor" opacity="0.6" />
      </svg>
    ),
    kagi: (
      <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
        <polyline points="2,12 2,4 5,4 5,10 8,10 8,3 11,3 11,9 14,9 14,5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    ),
    linebreak: (
      <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
        <rect x="1" y="6" width="3" height="6" rx="0.5" fill="currentColor" opacity="0.7" />
        <rect x="5" y="3" width="3" height="5" rx="0.5" fill="currentColor" opacity="0.5" />
        <rect x="9" y="5" width="3" height="7" rx="0.5" fill="currentColor" opacity="0.6" />
      </svg>
    ),
    pnf: (
      <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
        <line x1="2" y1="3" x2="6" y2="7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        <line x1="6" y1="3" x2="2" y2="7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        <circle cx="11" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.3" fill="none" />
      </svg>
    ),
    tick: (
      <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
        <polyline points="1,11 4,8 7,10 10,5 13,7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <circle cx="1" cy="11" r="1.2" fill="currentColor" />
        <circle cx="4" cy="8" r="1.2" fill="currentColor" />
        <circle cx="7" cy="10" r="1.2" fill="currentColor" />
        <circle cx="10" cy="5" r="1.2" fill="currentColor" />
        <circle cx="13" cy="7" r="1.2" fill="currentColor" />
      </svg>
    ),
    volumecandle: (
      <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
        <rect x="1" y="4" width="5" height="8" rx="0.5" fill="currentColor" opacity="0.7" />
        <line x1="3.5" y1="2" x2="3.5" y2="4" stroke="currentColor" strokeWidth="1" />
        <line x1="3.5" y1="12" x2="3.5" y2="14" stroke="currentColor" strokeWidth="1" />
        <rect x="8" y="6" width="2" height="5" rx="0.5" fill="currentColor" opacity="0.4" />
        <line x1="9" y1="4" x2="9" y2="6" stroke="currentColor" strokeWidth="1" />
        <line x1="9" y1="11" x2="9" y2="13" stroke="currentColor" strokeWidth="1" />
      </svg>
    ),
    hilo: (
      <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
        <rect x="2" y="3" width="2.5" height="10" rx="0.5" fill="currentColor" opacity="0.6" />
        <rect x="6" y="5" width="2.5" height="7" rx="0.5" fill="currentColor" opacity="0.5" />
        <rect x="10" y="4" width="2.5" height="8" rx="0.5" fill="currentColor" opacity="0.65" />
      </svg>
    ),
    columns: (
      <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
        <line x1="1" y1="8" x2="15" y2="8" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
        <rect x="2" y="4" width="2" height="4" rx="0.3" fill="currentColor" opacity="0.7" />
        <rect x="5" y="8" width="2" height="3" rx="0.3" fill="currentColor" opacity="0.5" />
        <rect x="8" y="5" width="2" height="3" rx="0.3" fill="currentColor" opacity="0.6" />
        <rect x="11" y="8" width="2" height="4" rx="0.3" fill="currentColor" opacity="0.5" />
      </svg>
    ),
    stepline: (
      <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
        <polyline points="1,10 4,10 4,6 8,6 8,9 12,9 12,4 15,4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="miter" fill="none" />
      </svg>
    ),
  };
  return icons[type] || icons.candles;
};

export { ChartTypeIcon };

export default function ChartTypeSelector({ chartType, setChartType }) {
  const [chartTypeOpen, setChartTypeOpen] = useState(false);
  const chartTypeRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (chartTypeRef.current && !chartTypeRef.current.contains(e.target)) setChartTypeOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentChartType = CHART_TYPES.find(t => t.engineId === chartType || t.id === chartType) || CHART_TYPES[0];

  return (
    <div ref={chartTypeRef} style={{ position: 'relative', display: 'flex', flexShrink: 0 }}>
      <button
        className="tf-chart-toolbar-btn"
        data-active={chartTypeOpen || undefined}
        onClick={() => setChartTypeOpen(!chartTypeOpen)}
        title="Chart Type"
      >
        <span style={{ display: 'flex', alignItems: 'center' }}><ChartTypeIcon type={currentChartType?.id} size={15} /></span>
        {currentChartType?.label || 'Candles'}
        <span style={{ fontSize: 8, color: C.t3, marginLeft: 2 }}>▼</span>
      </button>

      {chartTypeOpen && (
        <Suspense fallback={null}>
          <ChartTypePreview
            currentType={chartType}
            onSelect={(typeId) => { setChartType(typeId); setChartTypeOpen(false); }}
          />
        </Suspense>
      )}
    </div>
  );
}
