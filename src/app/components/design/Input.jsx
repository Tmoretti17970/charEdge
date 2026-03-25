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
            fontSize: 'var(--tf-fs-sm)',
            pointerEvents: 'none',
            transformOrigin: 'left center',
            zIndex: 1,
            transform: isFloating ? 'translateY(-22px) scale(0.85)' : 'translateY(0) scale(1)',
            color: error ? 'hsl(356, 75%, 53%)' : focused ? 'var(--tf-info)' : 'var(--tf-t2)',
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
          gap: 'var(--tf-space-2)',
          background: 'var(--tf-sf, var(--tf-bg2)',
          border: `1px solid ${error ? 'hsl(356, 75%, 53%)' : focused ? 'var(--tf-info)' : 'var(--tf-bd)'}`,
          borderRadius: 'var(--tf-radius-md)',
          padding: '0 var(--tf-space-3)',
          transition: 'border-color var(--motion-base) var(--ease-out)',
          boxShadow: focused ? '0 0 0 3px rgba(92, 156, 245, 0.5)' : 'none',
        }}
      >
        {/* Prefix */}
        {prefix && <span style={{ color: 'var(--tf-t3)', display: 'flex', flexShrink: 0 }}>{prefix}</span>}

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
            color: 'var(--tf-t1)',
            fontSize: 'var(--tf-fs-base)',
            padding: '14px 0',
            fontFamily: 'inherit',
          }}
          {...props}
        />

        {/* Suffix */}
        {suffix && <span style={{ color: 'var(--tf-t3)', display: 'flex', flexShrink: 0 }}>{suffix}</span>}
      </div>

      {/* Error message */}
      {error && (
        <p
          style={{
            color: 'hsl(356, 75%, 53%)',
            fontSize: 'var(--tf-fs-xs)',
            marginTop: 'var(--tf-space-1)',
            paddingLeft: 'var(--tf-space-3)',
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
