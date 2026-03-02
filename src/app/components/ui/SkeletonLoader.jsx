// ═══════════════════════════════════════════════════════════════════
// charEdge — Skeleton Loader (Phase 3.2.2)
//
// Reusable shimmer-animated placeholder components shown while
// data loads. Variants: card, chart, table, text, metric.
//
// Usage:
//   <SkeletonLoader variant="card" />
//   <SkeletonLoader variant="chart" height={300} />
//   <SkeletonLoader variant="metric" count={4} />
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { C, F, M } from '../../../constants.js';

// ─── Shimmer Keyframes (injected once) ─────────────────────────
const SHIMMER_ID = 'ce-shimmer-keyframes';

function ensureShimmerCSS() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(SHIMMER_ID)) return;
  const style = document.createElement('style');
  style.id = SHIMMER_ID;
  style.textContent = `
    @keyframes ce-shimmer {
      0% { background-position: -400px 0; }
      100% { background-position: 400px 0; }
    }
  `;
  document.head.appendChild(style);
}

// ─── Base Shimmer Bar ──────────────────────────────────────────

function ShimmerBar({ width = '100%', height = 14, borderRadius = 6, style: extraStyle }) {
  ensureShimmerCSS();
  return (
    <div style={{
      width,
      height,
      borderRadius,
      background: `linear-gradient(90deg, ${C.sf} 25%, ${C.bd}40 50%, ${C.sf} 75%)`,
      backgroundSize: '800px 100%',
      animation: 'ce-shimmer 1.5s ease-in-out infinite',
      ...extraStyle,
    }} />
  );
}

// ─── Variant: Card ─────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div style={{
      background: C.sf,
      border: `1px solid ${C.bd}`,
      borderRadius: 12,
      padding: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      minWidth: 200,
    }}>
      <ShimmerBar width={80} height={10} />
      <ShimmerBar width={120} height={28} />
      <ShimmerBar width={100} height={10} />
    </div>
  );
}

// ─── Variant: Chart ────────────────────────────────────────────

function SkeletonChart({ height = 300 }) {
  return (
    <div style={{
      background: C.sf,
      border: `1px solid ${C.bd}`,
      borderRadius: 12,
      padding: 20,
      height,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      gap: 8,
    }}>
      {/* Fake bar chart silhouette */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 3, paddingTop: 20 }}>
        {Array.from({ length: 24 }, (_, i) => (
          <ShimmerBar
            key={i}
            width="4%"
            height={`${20 + Math.sin(i * 0.5) * 30 + 40}%`}
            borderRadius={2}
          />
        ))}
      </div>
      {/* X-axis placeholder */}
      <ShimmerBar height={8} borderRadius={4} />
    </div>
  );
}

// ─── Variant: Table ────────────────────────────────────────────

function SkeletonTable({ rows = 5 }) {
  return (
    <div style={{
      background: C.sf,
      border: `1px solid ${C.bd}`,
      borderRadius: 12,
      padding: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 4 }}>
        <ShimmerBar width={60} height={10} />
        <ShimmerBar width={80} height={10} />
        <ShimmerBar width={60} height={10} />
        <ShimmerBar width={50} height={10} />
      </div>
      {/* Data rows */}
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <ShimmerBar width={60} height={12} />
          <ShimmerBar width={100} height={12} />
          <ShimmerBar width={70} height={12} />
          <ShimmerBar width={50} height={12} />
        </div>
      ))}
    </div>
  );
}

// ─── Variant: Text ─────────────────────────────────────────────

function SkeletonText({ lines = 3 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: lines }, (_, i) => (
        <ShimmerBar
          key={i}
          width={i === lines - 1 ? '60%' : '100%'}
          height={12}
        />
      ))}
    </div>
  );
}

// ─── Variant: Metric (row of cards) ────────────────────────────

function SkeletonMetric({ count = 4 }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────

/**
 * Skeleton loading placeholder with shimmer animation.
 *
 * @param {'card'|'chart'|'table'|'text'|'metric'} variant
 * @param {number} [height] — For chart variant
 * @param {number} [rows] — For table variant
 * @param {number} [lines] — For text variant
 * @param {number} [count] — For metric variant
 */
export default function SkeletonLoader({ variant = 'card', height, rows, lines, count }) {
  switch (variant) {
    case 'chart':
      return <SkeletonChart height={height} />;
    case 'table':
      return <SkeletonTable rows={rows} />;
    case 'text':
      return <SkeletonText lines={lines} />;
    case 'metric':
      return <SkeletonMetric count={count} />;
    case 'card':
    default:
      return <SkeletonCard />;
  }
}

export { ShimmerBar, SkeletonCard, SkeletonChart, SkeletonTable, SkeletonText, SkeletonMetric };
