// ═══════════════════════════════════════════════════════════════════
// charEdge — Input Component
//
// Text input with animated focus ring, floating label,
// error state, and prefix/suffix slots.
// ═══════════════════════════════════════════════════════════════════

import { forwardRef, useState, useId } from 'react';

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
        <label
          htmlFor={inputId}
          style={{
            position: 'absolute',
            left: prefix ? 36 : 12,
            top: 14,
            fontSize: 'var(--fs-sm, 13px)',
            pointerEvents: 'none',
            transformOrigin: 'left center',
            zIndex: 1,
            transform: isFloating ? 'translateY(-22px) scale(0.85)' : 'translateY(0) scale(1)',
            color: error
              ? 'hsl(356, 75%, 53%)'
              : focused
                ? 'var(--c-accent-blue, hsl(217, 91%, 60%))'
                : 'var(--c-fg-secondary, hsl(210, 13%, 68%))',
            transition: 'transform 200ms cubic-bezier(0.4, 0, 0.2, 1), color 200ms ease',
          }}
        >
          {label}
        </label>
      )}

      {/* Input wrapper */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--sp-2, 8px)',
          background: 'var(--tf-sf, var(--c-bg-secondary))',
          border: `1px solid ${error
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
      {error && (
        <p
          style={{
            color: 'hsl(356, 75%, 53%)',
            fontSize: 'var(--fs-xs, 11px)',
            marginTop: 'var(--sp-1, 4px)',
            paddingLeft: 'var(--sp-3, 12px)',
            animation: 'tf-fade-in 150ms ease',
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
});

export default Input;
