// ═══════════════════════════════════════════════════════════════════
// charEdge — Skeleton Component
//
// Loading placeholder with shimmer animation.
// Variants: text, rect, circle, chart.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';

const shimmerKeyframes = `
@keyframes ce-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
`;

// Inject keyframes once
if (typeof document !== 'undefined' && !document.getElementById('ce-shimmer-style')) {
  const style = document.createElement('style');
  style.id = 'ce-shimmer-style';
  style.textContent = shimmerKeyframes;
  document.head.appendChild(style);
}

const BASE_STYLE = {
  background: 'linear-gradient(90deg, var(--c-bg-secondary, hsl(225, 13%, 12%)) 25%, var(--c-bg-tertiary, hsl(225, 13%, 15%)) 50%, var(--c-bg-secondary, hsl(225, 13%, 12%)) 75%)',
  backgroundSize: '200% 100%',
  animation: 'ce-shimmer 1.5s ease-in-out infinite',
  borderRadius: 'var(--br-md, 8px)',
};

const VARIANT_DEFAULTS = {
  text: { width: '100%', height: 16, borderRadius: 'var(--br-sm, 4px)' },
  rect: { width: '100%', height: 120 },
  circle: { width: 40, height: 40, borderRadius: '50%' },
  chart: { width: '100%', height: 200, borderRadius: 'var(--br-lg, 12px)' },
};

/**
 * Loading placeholder with shimmer animation.
 *
 * @example
 * <Skeleton variant="text" width="60%" />
 * <Skeleton variant="chart" height={300} />
 * <Skeleton variant="circle" width={48} height={48} />
 */
export default function Skeleton({
  variant = 'rect',
  width,
  height,
  className = '',
  style,
  count = 1,
  ...props
}) {
  const defaults = VARIANT_DEFAULTS[variant] || VARIANT_DEFAULTS.rect;

  const skeletonStyle = {
    ...BASE_STYLE,
    ...defaults,
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
    ...style,
  };

  if (count > 1) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2, 8px)' }}>
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className={className} style={skeletonStyle} aria-hidden="true" {...props} />
        ))}
      </div>
    );
  }

  return <div className={className} style={skeletonStyle} aria-hidden="true" {...props} />;
}
