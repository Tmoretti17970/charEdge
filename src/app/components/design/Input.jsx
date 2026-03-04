// ═══════════════════════════════════════════════════════════════════
// charEdge — Input Component
//
// Text input with animated focus ring, floating label,
// error state, and prefix/suffix slots.
// ═══════════════════════════════════════════════════════════════════

import React, { forwardRef, useState, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Design system input with animated focus ring and floating label.
 *
 * @example
 * <Input label="Symbol" placeholder="BTCUSDT" />
 * <Input type="number" label="Stop Loss" error="Must be positive" prefix="$" />
 * <Input variant="search" placeholder="Search symbols..." prefix={<SearchIcon />} />
 */
const Input = forwardRef(function Input(
  {
    label,
    error,
    variant = 'text', // text | number | search
    prefix,
    suffix,
    className = '',
    style,
    ...props
  },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const id = useId();
  const inputId = props.id || id;

  const hasValue = props.value !== undefined ? !!props.value : false;
  const isFloating = focused || hasValue || !!props.placeholder;

  return (
    <div className={className} style={{ position: 'relative', ...style }}>
      {/* Floating label */}
      {label && (
        <motion.label
          htmlFor={inputId}
          initial={false}
          animate={{
            y: isFloating ? -22 : 0,
            scale: isFloating ? 0.85 : 1,
            color: error
              ? 'hsl(356, 75%, 53%)'
              : focused
                ? 'var(--c-accent-blue, hsl(217, 91%, 60%))'
                : 'var(--c-fg-secondary, hsl(210, 13%, 68%))',
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          style={{
            position: 'absolute',
            left: prefix ? 36 : 12,
            top: 14,
            fontSize: 'var(--fs-sm, 13px)',
            pointerEvents: 'none',
            transformOrigin: 'left center',
            zIndex: 1,
          }}
        >
          {label}
        </motion.label>
      )}

      {/* Input wrapper */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--sp-2, 8px)',
          background: 'var(--tf-sf, var(--c-bg-secondary))',
          border: `1px solid ${
            error
              ? 'hsl(356, 75%, 53%)'
              : focused
                ? 'var(--c-border-focus, hsl(217, 91%, 60%))'
                : 'var(--c-border, hsl(225, 13%, 18%))'
          }`,
          borderRadius: 'var(--br-lg, 12px)',
          padding: '0 var(--sp-3, 12px)',
          transition: 'border-color var(--dur-normal, 200ms) var(--ease-default)',
          boxShadow: focused
            ? '0 0 0 3px var(--c-focus-ring, hsla(217, 91%, 60%, 0.25))'
            : 'none',
        }}
      >
        {/* Prefix */}
        {prefix && (
          <span style={{ color: 'var(--c-fg-tertiary)', display: 'flex', flexShrink: 0 }}>
            {prefix}
          </span>
        )}

        {/* Input */}
        <input
          ref={ref}
          id={inputId}
          type={variant === 'number' ? 'number' : variant === 'search' ? 'search' : 'text'}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--c-fg-primary, hsl(210, 20%, 92%))',
            fontSize: 'var(--fs-base, 15px)',
            padding: '14px 0',
            fontFamily: 'inherit',
          }}
          {...props}
        />

        {/* Suffix */}
        {suffix && (
          <span style={{ color: 'var(--c-fg-tertiary)', display: 'flex', flexShrink: 0 }}>
            {suffix}
          </span>
        )}
      </div>

      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            style={{
              color: 'hsl(356, 75%, 53%)',
              fontSize: 'var(--fs-xs, 11px)',
              marginTop: 'var(--sp-1, 4px)',
              paddingLeft: 'var(--sp-3, 12px)',
            }}
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
});

export default Input;
