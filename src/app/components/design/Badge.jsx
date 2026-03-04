// ═══════════════════════════════════════════════════════════════════
// charEdge — Badge Component
//
// Status indicator badges with semantic colors from design tokens.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';

const STATUS_STYLES = {
  success: {
    background: 'hsla(152, 69%, 48%, 0.15)',
    color: 'hsl(152, 69%, 48%)',
    border: '1px solid hsla(152, 69%, 48%, 0.25)',
  },
  warning: {
    background: 'hsla(38, 92%, 50%, 0.15)',
    color: 'hsl(38, 92%, 50%)',
    border: '1px solid hsla(38, 92%, 50%, 0.25)',
  },
  danger: {
    background: 'hsla(356, 75%, 53%, 0.15)',
    color: 'hsl(356, 75%, 53%)',
    border: '1px solid hsla(356, 75%, 53%, 0.25)',
  },
  info: {
    background: 'hsla(217, 91%, 60%, 0.15)',
    color: 'hsl(217, 91%, 60%)',
    border: '1px solid hsla(217, 91%, 60%, 0.25)',
  },
  neutral: {
    background: 'hsla(210, 13%, 68%, 0.12)',
    color: 'var(--c-fg-secondary, hsl(210, 13%, 68%))',
    border: '1px solid hsla(210, 13%, 68%, 0.2)',
  },
};

const SIZE_STYLES = {
  sm: { fontSize: 'var(--fs-xs, 11px)', padding: '2px 8px' },
  md: { fontSize: 'var(--fs-sm, 13px)', padding: '4px 12px' },
};

/**
 * Status indicator badge.
 *
 * @example
 * <Badge status="success">+12.3%</Badge>
 * <Badge status="danger" size="sm">SELL</Badge>
 * <Badge status="info" dot>Live</Badge>
 */
export default function Badge({
  status = 'neutral',
  size = 'md',
  dot = false,
  children,
  className = '',
  style,
  ...props
}) {
  const statusStyle = STATUS_STYLES[status] || STATUS_STYLES.neutral;
  const sizeStyle = SIZE_STYLES[size] || SIZE_STYLES.md;

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: dot ? 6 : 0,
        borderRadius: 'var(--br-full, 9999px)',
        fontWeight: 'var(--fw-semibold, 600)',
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap',
        lineHeight: 1,
        ...statusStyle,
        ...sizeStyle,
        ...style,
      }}
      {...props}
    >
      {dot && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'currentColor',
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </span>
  );
}
