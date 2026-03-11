// ═══════════════════════════════════════════════════════════════════
// charEdge — Skeleton Pulse Primitives
//
// Reusable, content-aware skeleton placeholders with shimmer effect.
// Uses existing .tf-skeleton CSS class for the shimmer animation.
//
// Usage:
//   <SkeletonRect w={200} h={16} />
//   <SkeletonCircle size={40} />
//   <SkeletonText lines={3} />
//   <SkeletonGrid cols={4} rows={2} cardHeight={120} />
// ═══════════════════════════════════════════════════════════════════

import { memo } from 'react';

/**
 * Rectangular skeleton block with shimmer.
 * Use for card placeholders, headers, buttons, etc.
 */
export const SkeletonRect = memo(function SkeletonRect({
  w = '100%',
  h = 16,
  radius = 6,
  delay = 0,
  style = {},
  className = '',
}) {
  return (
    <div
      className={`tf-skeleton ${className}`}
      style={{
        width: typeof w === 'number' ? `${w}px` : w,
        height: typeof h === 'number' ? `${h}px` : h,
        borderRadius: radius,
        flexShrink: 0,
        animationDelay: delay ? `${delay}s` : undefined,
        ...style,
      }}
    />
  );
});

/**
 * Circular skeleton (avatars, icons).
 */
export const SkeletonCircle = memo(function SkeletonCircle({
  size = 40,
  delay = 0,
  style = {},
}) {
  return (
    <div
      className="tf-skeleton"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        flexShrink: 0,
        animationDelay: delay ? `${delay}s` : undefined,
        ...style,
      }}
    />
  );
});

/**
 * Text line skeleton with variable widths for natural appearance.
 */
export const SkeletonText = memo(function SkeletonText({
  lines = 3,
  lineHeight = 14,
  gap = 8,
  lastLineWidth = '60%',
  style = {},
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap, ...style }}>
      {Array.from({ length: lines }, (_, i) => (
        <SkeletonRect
          key={i}
          w={i === lines - 1 ? lastLineWidth : '100%'}
          h={lineHeight}
          radius={4}
          delay={i * 0.04}
        />
      ))}
    </div>
  );
});

/**
 * Grid of skeleton cards — for dashboard stat grids, card lists.
 */
export const SkeletonGrid = memo(function SkeletonGrid({
  cols = 4,
  rows = 1,
  cardHeight = 100,
  gap = 12,
  style = {},
}) {
  const total = cols * rows;
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap,
        ...style,
      }}
    >
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className="tf-skeleton"
          style={{
            height: cardHeight,
            borderRadius: 12,
            animationDelay: `${i * 0.05}s`,
          }}
        />
      ))}
    </div>
  );
});

/**
 * Table row skeleton — mimics trade logbook rows.
 */
export const SkeletonTableRow = memo(function SkeletonTableRow({
  cols = 6,
  height = 44,
  delay = 0,
}) {
  const widths = ['12%', '15%', '8%', '13%', '10%', '10%', '12%', '10%', '10%'].slice(0, cols);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 14px',
        height,
        borderBottom: '1px solid var(--tf-bd, #2a2e3a)',
        opacity: 0.7,
      }}
    >
      {widths.map((w, i) => (
        <SkeletonRect
          key={i}
          w={w}
          h={12}
          radius={4}
          delay={delay + i * 0.03}
        />
      ))}
    </div>
  );
});

/**
 * Full table skeleton — header + rows.
 */
export const SkeletonTable = memo(function SkeletonTable({
  rows = 8,
  cols = 6,
  style = {},
}) {
  return (
    <div style={style}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 14px',
          borderBottom: '2px solid var(--tf-bd, #2a2e3a)',
        }}
      >
        {Array.from({ length: cols }, (_, i) => (
          <SkeletonRect
            key={i}
            w={`${8 + Math.random() * 8}%`}
            h={10}
            radius={3}
            delay={i * 0.02}
            style={{ opacity: 0.5 }}
          />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonTableRow key={i} cols={cols} delay={i * 0.04} />
      ))}
    </div>
  );
});

/**
 * Dashboard skeleton — stat cards + equity curve + calendar.
 */
export function DashboardSkeleton() {
  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Stat cards row */}
      <SkeletonGrid cols={4} rows={1} cardHeight={88} gap={12} />

      {/* Equity curve */}
      <SkeletonRect w="100%" h={200} radius={12} delay={0.15} />

      {/* Secondary stats */}
      <SkeletonGrid cols={3} rows={1} cardHeight={72} gap={12} />
    </div>
  );
}

/**
 * Journal skeleton — trade logbook placeholder.
 */
export function JournalSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Filters bar */}
      <div style={{ display: 'flex', gap: 8, padding: '12px 14px' }}>
        <SkeletonRect w={100} h={28} radius={7} />
        <SkeletonRect w={120} h={28} radius={7} delay={0.03} />
        <SkeletonRect w={80} h={28} radius={7} delay={0.06} />
        <div style={{ flex: 1 }} />
        <SkeletonRect w={90} h={28} radius={7} delay={0.09} />
      </div>
      {/* Trade table */}
      <SkeletonTable rows={10} cols={7} />
    </div>
  );
}

export default {
  Rect: SkeletonRect,
  Circle: SkeletonCircle,
  Text: SkeletonText,
  Grid: SkeletonGrid,
  Table: SkeletonTable,
  TableRow: SkeletonTableRow,
  Dashboard: DashboardSkeleton,
  Journal: JournalSkeleton,
};
