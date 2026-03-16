// ═══════════════════════════════════════════════════════════════════
// charEdge — AILoadingSkeleton (Sprint 0 — AI Design Kit)
//
// AI-branded shimmer placeholder for AI content sections.
// Wraps the existing Skeleton with AI surface tinting.
// Never shows a spinner — always shimmer skeletons.
// ═══════════════════════════════════════════════════════════════════

import Skeleton from './Skeleton.jsx';

/**
 * AILoadingSkeleton — shimmer placeholder for AI sections.
 *
 * @param {number} lines   - Number of text shimmer lines (default 3)
 * @param {string} variant - 'compact' (3 narrow lines) | 'full' (title + 4 lines + bar)
 * @param {string} className
 * @param {Object} style
 */
export default function AILoadingSkeleton({
  lines = 3,
  variant = 'compact',
  className = '',
  style = {},
}) {
  if (variant === 'full') {
    return (
      <div
        className={`ai-loading-skeleton ${className}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          padding: '12px 0',
          background: 'var(--ai-surface, rgba(232,100,44,0.04))',
          borderRadius: 'var(--tf-radius-sm, 8px)',
          ...style,
        }}
      >
        <Skeleton variant="text" width="45%" height={14} />
        <Skeleton variant="text" count={3} />
        <Skeleton variant="text" width="70%" />
        <Skeleton variant="rect" height={6} style={{ borderRadius: 999, marginTop: 4 }} />
      </div>
    );
  }

  // Compact
  return (
    <div
      className={`ai-loading-skeleton ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '8px 0',
        background: 'var(--ai-surface, rgba(232,100,44,0.04))',
        borderRadius: 'var(--tf-radius-sm, 8px)',
        ...style,
      }}
    >
      <Skeleton variant="text" count={Math.min(lines, 6)} />
      <Skeleton variant="text" width="55%" />
    </div>
  );
}

export { AILoadingSkeleton };
