// ═══════════════════════════════════════════════════════════════════
// charEdge — Markets Grid Skeleton (Sprint 53)
//
// Shimmer skeleton rows shown while watchlist data is loading.
// Uses staggered mount + CSS shimmer animation.
// ═══════════════════════════════════════════════════════════════════

import { memo } from 'react';
import { C } from '../../../constants.js';
import { radii } from '../../../theme/tokens.js';
import '../../../styles/markets-animations.css';
import st from './MarketsGridSkeleton.module.css';

const SKELETON_ROWS = 8;

// ─── Column skeletons (matching grid column layout) ──────────────

function SkeletonCell({ width, align = 'left' }) {
  return (
    <div style={{
      width, height: 12, borderRadius: 4,
      background: `linear-gradient(90deg, ${C.bd}15 25%, ${C.bd}30 50%, ${C.bd}15 75%)`,
      backgroundSize: '200% 100%',
      animation: 'markets-shimmer 1.5s ease-in-out infinite',
      marginLeft: align === 'right' ? 'auto' : 0,
      marginRight: align === 'left' ? 'auto' : 0,
    }} />
  );
}

function SkeletonRow({ index }) {
  return (
    <div
      className="markets-row-stagger"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 16px',
        borderBottom: `1px solid ${C.bd}30`,
        animationDelay: `${index * 60}ms`,
      }}
    >
      {/* Sparkline placeholder */}
      <div style={{
        width: 54, height: 22, borderRadius: 4,
        background: `${C.bd}12`,
      }} />

      {/* Symbol + name */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <SkeletonCell width={Math.random() > 0.5 ? 60 : 48} />
        <div style={{ height: 4 }} />
        <SkeletonCell width={Math.random() > 0.5 ? 80 : 64} />
      </div>

      {/* Price */}
      <SkeletonCell width={70} align="right" />

      {/* Change % */}
      <SkeletonCell width={48} align="right" />

      {/* Volume */}
      <SkeletonCell width={50} align="right" />
    </div>
  );
}

// ─── Main Skeleton ───────────────────────────────────────────────

function MarketsGridSkeleton({ rows = SKELETON_ROWS }) {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      padding: '4px 0',
    }}>
      {/* Header skeleton */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 16px 6px',
        borderBottom: `1px solid ${C.bd}40`,
      }}>
        <div style={{ width: 54 }} />
        <SkeletonCell width={44} />
        <div style={{ flex: 1 }} />
        <SkeletonCell width={40} align="right" />
        <SkeletonCell width={36} align="right" />
        <SkeletonCell width={42} align="right" />
      </div>

      {/* Rows */}
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonRow key={i} index={i} />
      ))}

      {/* Loading text */}
      <div style={{
        textAlign: 'center',
        padding: '14px 0',
        fontSize: 10,
        fontWeight: 600,
        fontFamily: 'var(--tf-mono)',
        color: C.t3,
        letterSpacing: 1,
        textTransform: 'uppercase',
        opacity: 0,
        animation: 'markets-stagger-in 0.4s ease-out 0.5s forwards',
      }}>
        Loading sparklines…
      </div>
    </div>
  );
}

// ─── Error State ─────────────────────────────────────────────────

export function MarketsGridError({ message, onRetry }) {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 40,
      fontFamily: 'var(--tf-font)',
    }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
      <div style={{
        fontSize: 14, fontWeight: 700, color: C.t1, marginBottom: 6,
      }}>
        Something went wrong
      </div>
      <div style={{
        fontSize: 12, color: C.t3, textAlign: 'center', marginBottom: 16,
        maxWidth: 280,
      }}>
        {message || 'Could not load market data. Please try again.'}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            padding: '8px 20px',
            borderRadius: radii.md,
            background: `linear-gradient(135deg, ${C.p}, ${C.b})`,
            color: '#fff',
            fontSize: 12,
            fontWeight: 700,
            fontFamily: 'var(--tf-font)',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      )}
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────

export function MarketsGridEmpty() {
  const TRENDING = ['BTC', 'ETH', 'SOL', 'SPY', 'TSLA'];

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 40,
      fontFamily: 'var(--tf-font)',
    }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>📈</div>
      <div style={{
        fontSize: 14, fontWeight: 700, color: C.t1, marginBottom: 6,
      }}>
        Your watchlist is empty
      </div>
      <div style={{
        fontSize: 12, color: C.t3, textAlign: 'center', marginBottom: 16,
      }}>
        Search for symbols to start tracking
      </div>
      <div style={{
        display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center',
      }}>
        {TRENDING.map((sym) => (
          <span
            key={sym}
            style={{
              padding: '4px 10px',
              borderRadius: radii.sm,
              background: `${C.b}10`,
              border: `1px solid ${C.b}25`,
              color: C.b,
              fontSize: 11,
              fontWeight: 700,
              fontFamily: 'var(--tf-mono)',
            }}
          >
            {sym}
          </span>
        ))}
      </div>
    </div>
  );
}

export default memo(MarketsGridSkeleton);
