// ═══════════════════════════════════════════════════════════════════
// charEdge — Swipe Dot Pagination
//
// Sprint 6 S6.1: Horizontal dot indicators for swipeable sections.
// Active dot scales up + accent color, inactive muted.
// ═══════════════════════════════════════════════════════════════════

import { C } from '../../../constants.js';

/**
 * @param {{ count: number, active: number, onDotClick?: (i: number) => void }} props
 */
export default function SwipeDots({ count, active, onDotClick }) {
  if (count <= 1) return null;

  return (
    <div
      role="tablist"
      aria-label="Section navigation"
      className="tf-swipe-dots"
      style={{
        display: 'flex',
        justifyContent: 'center',
        gap: 6,
        padding: '8px 0',
      }}
    >
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          role="tab"
          aria-selected={i === active}
          aria-label={`Section ${i + 1}`}
          onClick={() => onDotClick?.(i)}
          style={{
            width: i === active ? 18 : 6,
            height: 6,
            borderRadius: 3,
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            background: i === active ? C.b : C.bd,
            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            minHeight: 'auto',
            minWidth: 'auto',
          }}
        />
      ))}
    </div>
  );
}

export { SwipeDots };
