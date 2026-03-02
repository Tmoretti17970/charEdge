// ═══════════════════════════════════════════════════════════════════
// charEdge — Widget Loading Skeletons (Per-Widget Shapes)
//
// Shaped skeleton variants that match each widget's visual structure,
// replacing the uniform SkeletonRow with context-aware loading states.
// All variants use the existing tf-skeleton CSS animation class.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { C } from '../../../constants.js';

const shimmer = (w, h, extra = {}) => ({
  width: w,
  height: h,
  borderRadius: 4,
  background: C.bd + '40',
  ...extra,
});

// ─── Hero Skeleton ──────────────────────────────────────────────
// Large tile + two small tiles matching the hero layout
export function HeroSkeleton({ isMobile = false }) {
  return (
    <div
      className="tf-skeleton"
      style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'minmax(240px, 1.8fr) minmax(120px, 1fr) minmax(120px, 1fr)',
        gap: 12,
        marginBottom: 24,
      }}
    >
      {/* Hero P&L placeholder */}
      <div
        style={{
          borderRadius: 14,
          border: `1px solid ${C.bd}`,
          padding: '20px 22px',
          background: C.sf,
          minHeight: isMobile ? 100 : 130,
        }}
      >
        <div style={shimmer('50%', 10, { marginBottom: 12 })} />
        <div style={shimmer('70%', 28, { marginBottom: 8 })} />
        <div style={shimmer('100%', 20, { marginTop: 'auto', opacity: 0.3 })} />
      </div>

      {/* Win Rate placeholder */}
      <div
        style={{
          borderRadius: 14,
          border: `1px solid ${C.bd}`,
          padding: '16px 18px',
          background: C.sf,
        }}
      >
        <div style={shimmer('60%', 8, { marginBottom: 10 })} />
        <div style={shimmer('50%', 22)} />
      </div>

      {/* Trades placeholder */}
      <div
        style={{
          borderRadius: 14,
          border: `1px solid ${C.bd}`,
          padding: '16px 18px',
          background: C.sf,
        }}
      >
        <div style={shimmer('60%', 8, { marginBottom: 10 })} />
        <div style={shimmer('40%', 22)} />
      </div>
    </div>
  );
}

// ─── Chart Skeleton ─────────────────────────────────────────────
// Aspect-ratio box with faux wavy line and axis placeholders
export function ChartSkeleton({ height = 260 }) {
  return (
    <div
      className="tf-skeleton"
      style={{
        borderRadius: 14,
        border: `1px solid ${C.bd}`,
        background: C.sf,
        height,
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Title bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={shimmer('30%', 10)} />
        <div style={shimmer('15%', 16)} />
      </div>
      {/* Faux chart area */}
      <div style={{ flex: 1, position: 'relative' }}>
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 400 120"
          preserveAspectRatio="none"
          style={{ opacity: 0.15 }}
        >
          <polyline
            fill="none"
            stroke={C.bd}
            strokeWidth="2"
            points="0,90 40,70 80,80 120,50 160,60 200,40 240,55 280,30 320,45 360,25 400,35"
          />
        </svg>
        {/* Y axis marks */}
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 0,
              top: `${i * 30}%`,
              width: '100%',
              borderBottom: `1px dashed ${C.bd}20`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Bento Grid Skeleton ────────────────────────────────────────
// 4-column grid of shimmer tiles matching the bento layout
export function BentoGridSkeleton({ isMobile = false }) {
  return (
    <div
      className="tf-skeleton"
      style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)',
        gap: 16,
        marginBottom: 24,
      }}
    >
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            borderRadius: 14,
            border: `1px solid ${C.bd}`,
            background: C.sf,
            padding: 16,
            height: 100,
          }}
        >
          <div style={shimmer('60%', 8, { marginBottom: 10 })} />
          <div style={shimmer('45%', 20)} />
        </div>
      ))}
    </div>
  );
}

// ─── Table Skeleton ─────────────────────────────────────────────
// Header row + N shimmer rows with column alignment
export function TableSkeleton({ rows = 4, cols = 3 }) {
  return (
    <div
      className="tf-skeleton"
      style={{
        borderRadius: 14,
        border: `1px solid ${C.bd}`,
        background: C.sf,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '14px 20px',
          borderBottom: `1px solid ${C.bd}40`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={shimmer('30%', 10)} />
        <div style={shimmer('12%', 10)} />
      </div>
      {/* Rows */}
      {Array.from({ length: rows }, (_, r) => (
        <div
          key={r}
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gap: 8,
            padding: '10px 20px',
            borderBottom: `1px solid ${C.bd}20`,
          }}
        >
          {Array.from({ length: cols }, (_, c) => (
            <div key={c} style={shimmer(c === 0 ? '70%' : '50%', 10)} />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Metric Card Skeleton ───────────────────────────────────────
export function MetricCardSkeleton() {
  return (
    <div
      className="tf-skeleton"
      style={{
        borderRadius: 14,
        border: `1px solid ${C.bd}`,
        background: C.sf,
        padding: '14px 16px',
        height: 72,
      }}
    >
      <div style={shimmer('45%', 8, { marginBottom: 8 })} />
      <div style={shimmer('60%', 18)} />
    </div>
  );
}

// ─── Full Dashboard Skeleton (composed) ─────────────────────────
// Replaces the blanket SkeletonRow with shaped loading state
export function DashboardSkeleton({ isMobile = false }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <HeroSkeleton isMobile={isMobile} />
      <ChartSkeleton height={isMobile ? 200 : 260} />
      <BentoGridSkeleton isMobile={isMobile} />
      <TableSkeleton rows={3} cols={3} />
    </div>
  );
}
