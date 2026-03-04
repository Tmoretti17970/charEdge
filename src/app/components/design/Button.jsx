// ═══════════════════════════════════════════════════════════════════
// charEdge — Button Component
//
// Consumes Button.module.css. Supports variants (primary, secondary,
// ghost, icon, danger), sizes (sm, md, lg), loading state, and
// spring press animation via framer-motion.
// ═══════════════════════════════════════════════════════════════════

import React, { forwardRef } from 'react';
import { motion } from 'framer-motion';
import styles from '../../../styles/Button.module.css';

const VARIANT_MAP = {
  primary: styles.primary,
  secondary: styles.secondary,
  ghost: styles.ghost,
  icon: styles.icon,
  danger: styles.primary, // danger uses primary shape with override color
};

const SIZE_MAP = {
  sm: styles.sm,
  md: '', // default size — no modifier needed
  lg: styles.lg,
};

/**
 * Design system button with spring press animation.
 *
 * @example
 * <Button variant="primary" size="lg" onClick={handleSave}>Save Trade</Button>
 * <Button variant="ghost" icon={<ChevronIcon />}>More</Button>
 * <Button variant="icon" aria-label="Settings"><GearIcon /></Button>
 */
const Button = forwardRef(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    fullWidth = false,
    icon = null,
    children,
    className = '',
    style,
    ...props
  },
  ref,
) {
  const variantClass = VARIANT_MAP[variant] || styles.primary;
  const sizeClass = SIZE_MAP[size] || '';
  const isDanger = variant === 'danger';

  const classes = [
    styles.base,
    variantClass,
    sizeClass,
    fullWidth ? 'fullWidth' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const dangerStyle = isDanger
    ? {
        background: 'linear-gradient(135deg, hsl(356, 75%, 53%), hsl(356, 65%, 45%))',
        boxShadow: '0 4px 16px hsla(356, 75%, 53%, 0.19)',
        ...style,
      }
    : style;

  return (
    <motion.button
      ref={ref}
      className={classes}
      disabled={disabled || loading}
      style={{
        width: fullWidth ? '100%' : undefined,
        position: 'relative',
        ...dangerStyle,
      }}
      whileTap={{ scale: 0.97 }}
      whileHover={{ scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      {...props}
    >
      {loading && (
        <span
          style={{
            width: 16,
            height: 16,
            border: '2px solid currentColor',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 600ms linear infinite',
          }}
        />
      )}
      {icon && <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>}
      {children}
    </motion.button>
  );
});

export default Button;
