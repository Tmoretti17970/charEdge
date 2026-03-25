// ═══════════════════════════════════════════════════════════════════
// charEdge — Card Component
//
// Consumes Card.module.css. Supports variants (default, elevated,
// glass, compact, flat), optional hover lift, and clickable state.
// ═══════════════════════════════════════════════════════════════════

import { forwardRef } from 'react';
import styles from '../../../styles/Card.module.css';

const VARIANT_MAP = {
  default: styles.card,
  elevated: styles.cardElevated,
  glass: styles.cardGlass,
  compact: styles.cardCompact,
  flat: styles.card, // flat uses base with no shadow override
};

/**
 * Design system card surface with glassmorphism and hover lift.
 *
 * @example
 * <Card variant="glass" padding="lg">
 *   <h3>Performance</h3>
 *   <p>+12.3% this week</p>
 * </Card>
 */
const Card = forwardRef(function Card(
  { variant = 'default', padding, hoverable = true, clickable = false, children, className = '', style, ...props },
  ref,
) {
  const variantClass = VARIANT_MAP[variant] || styles.card;
  const isFlat = variant === 'flat';

  const classes = [variantClass, className].filter(Boolean).join(' ');

  const paddingMap = {
    none: 0,
    sm: 'var(--tf-space-3)',
    md: 'var(--tf-space-4)',
    lg: 'var(--tf-space-6)',
    xl: 'var(--tf-space-8)',
  };

  const mergedStyle = {
    ...(padding ? { padding: paddingMap[padding] || padding } : {}),
    ...(isFlat ? { boxShadow: 'none', border: 'none' } : {}),
    ...(clickable ? { cursor: 'pointer' } : {}),
    ...(hoverable === false ? { pointerEvents: 'auto', transform: 'none' } : {}),
    ...style,
  };

  const Tag = clickable ? 'button' : 'div';

  return (
    <Tag ref={ref} className={classes} style={mergedStyle} {...props}>
      {children}
    </Tag>
  );
});

export default Card;
