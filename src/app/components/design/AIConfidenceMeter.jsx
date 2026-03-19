// ═══════════════════════════════════════════════════════════════════
// charEdge — AIConfidenceMeter (Sprint 0 — AI Design Kit)
//
// Compact visual indicator for model confidence (0–1).
// Variants: 'ring' (SVG circle) or 'bar' (horizontal bar).
// Color: green > 0.7, yellow 0.4–0.7, red < 0.4
// ═══════════════════════════════════════════════════════════════════

import React from 'react';

const METER_ID = { n: 0 };

/**
 * AIConfidenceMeter — visual confidence indicator.
 *
 * @param {number}  value     - Confidence 0–1
 * @param {number}  size      - Pixel size (ring diameter or bar height, default 24)
 * @param {string}  variant   - 'ring' | 'bar'
 * @param {boolean} showLabel - Show percentage text
 * @param {string}  className
 * @param {Object}  style
 */
export default function AIConfidenceMeter({
  value = 0,
  size = 24,
  variant = 'ring',
  showLabel = false,
  className = '',
  style = {},
}) {
  const clamped = Math.max(0, Math.min(1, value));
  const color = clamped >= 0.7
    ? 'var(--ai-confidence-high, #34C759)'
    : clamped >= 0.4
      ? 'var(--ai-confidence-mid, #f0b64e)'
      : 'var(--ai-confidence-low, #FF3B30)';

  const pct = Math.round(clamped * 100);

  // Ring variant helpers — must be called before any early return (Rules of Hooks)
  const id = React.useMemo(() => `ai-conf-${++METER_ID.n}`, []);

  if (variant === 'bar') {
    return (
      <div
        className={`ai-confidence-meter ai-confidence-bar ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          ...style,
        }}
      >
        <div
          style={{
            width: size * 3,
            height: Math.max(4, size * 0.2),
            borderRadius: 999,
            background: 'var(--tf-bd, #2a2e3a)',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: '100%',
              borderRadius: 999,
              background: color,
              transition: 'width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          />
        </div>
        {showLabel && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              fontFamily: 'var(--tf-mono)',
              color,
            }}
          >
            {pct}%
          </span>
        )}
      </div>
    );
  }

  // Ring variant (SVG circle)
  const strokeWidth = Math.max(2, size * 0.12);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - clamped);

  return (
    <div
      className={`ai-confidence-meter ai-confidence-ring ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        position: 'relative',
        ...style,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{
          transform: 'rotate(-90deg)',
          '--ai-dash-total': circumference,
          '--ai-dash-offset': dashOffset,
        }}
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--tf-bd, #2a2e3a)"
          strokeWidth={strokeWidth}
        />
        {/* Fill */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{
            transition: 'stroke-dashoffset 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), stroke 0.3s ease',
          }}
        />
      </svg>
      {showLabel && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            fontFamily: 'var(--tf-mono)',
            color,
          }}
        >
          {pct}%
        </span>
      )}
    </div>
  );
}

export { AIConfidenceMeter };
