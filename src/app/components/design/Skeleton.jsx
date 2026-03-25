// ═══════════════════════════════════════════════════════════════════
// charEdge — Skeleton Component
//
// Loading placeholder with shimmer animation.
// Variants: text, rect, circle, chart.
// ═══════════════════════════════════════════════════════════════════

const BASE_STYLE = {
  background: 'linear-gradient(90deg, var(--tf-bg2) 25%, var(--tf-sf) 50%, var(--tf-bg2) 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.5s ease-in-out infinite',
  borderRadius: 'var(--tf-radius-sm)',
};

const VARIANT_DEFAULTS = {
  text: { width: '100%', height: 16, borderRadius: 'var(--tf-radius-xs)' },
  rect: { width: '100%', height: 120 },
  circle: { width: 40, height: 40, borderRadius: '50%' },
  chart: { width: '100%', height: 200, borderRadius: 'var(--tf-radius-md)' },
};

/**
 * Loading placeholder with shimmer animation.
 *
 * @example
 * <Skeleton variant="text" width="60%" />
 * <Skeleton variant="chart" height={300} />
 * <Skeleton variant="circle" width={48} height={48} />
 */
export default function Skeleton({ variant = 'rect', width, height, className = '', style, count = 1, ...props }) {
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--tf-space-2)' }}>
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className={className} style={skeletonStyle} aria-hidden="true" {...props} />
        ))}
      </div>
    );
  }

  return <div className={className} style={skeletonStyle} aria-hidden="true" {...props} />;
}
