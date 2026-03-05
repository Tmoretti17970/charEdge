// ═══════════════════════════════════════════════════════════════════
// charEdge — AnimatedNumber
//
// Smoothly animates numeric value transitions using spring physics.
// Perfect for stat cards, P&L displays, and metrics.
//
// Usage:
//   <AnimatedNumber value={1234.56} prefix="$" format="currency" />
//   <AnimatedNumber value={68.5} suffix="%" decimals={1} />
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState, useCallback, memo } from 'react';

/**
 * Format number with commas, decimals, prefix/suffix.
 */
function formatValue(val, { decimals = 2, prefix = '', suffix = '', format } = {}) {
  if (val == null || isNaN(val)) return `${prefix}0${suffix}`;

  let num = val;
  if (format === 'currency') {
    // Force 2 decimals for currency
    decimals = 2;
  } else if (format === 'compact') {
    if (Math.abs(num) >= 1_000_000) {
      return `${prefix}${(num / 1_000_000).toFixed(1)}M${suffix}`;
    }
    if (Math.abs(num) >= 1_000) {
      return `${prefix}${(num / 1_000).toFixed(1)}K${suffix}`;
    }
  }

  const fixed = Math.abs(num).toFixed(decimals);
  const [int, dec] = fixed.split('.');
  const withCommas = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const sign = num < 0 ? '-' : '';
  return `${prefix}${sign}${withCommas}${dec ? `.${dec}` : ''}${suffix}`;
}

/**
 * Spring-based count animation.
 * Uses requestAnimationFrame for smooth interpolation.
 */
function useAnimatedValue(target, { duration = 600, enabled = true } = {}) {
  const [display, setDisplay] = useState(target);
  const prevRef = useRef(target);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!enabled || typeof target !== 'number' || isNaN(target)) {
      setDisplay(target);
      prevRef.current = target;
      return;
    }

    const from = prevRef.current ?? 0;
    const to = target;
    prevRef.current = to;

    if (from === to) return;

    const startTime = performance.now();

    const tick = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic for snappy feel
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = from + (to - from) * eased;

      setDisplay(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(to);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration, enabled]);

  return display;
}

/**
 * AnimatedNumber — smoothly transitions between numeric values.
 *
 * @param {Object} props
 * @param {number} props.value - The target numeric value
 * @param {string} [props.prefix=''] - Text before the number (e.g. '$')
 * @param {string} [props.suffix=''] - Text after the number (e.g. '%')
 * @param {number} [props.decimals=2] - Decimal places
 * @param {'currency'|'compact'|undefined} [props.format] - Number format preset
 * @param {number} [props.duration=600] - Animation duration in ms
 * @param {boolean} [props.animate=true] - Enable/disable animation
 * @param {boolean} [props.colorize=false] - Green/red based on positive/negative
 * @param {string} [props.className] - CSS class name
 * @param {Object} [props.style] - Inline styles
 */
const AnimatedNumber = memo(function AnimatedNumber({
  value = 0,
  prefix = '',
  suffix = '',
  decimals = 2,
  format,
  duration = 600,
  animate = true,
  colorize = false,
  className = '',
  style = {},
}) {
  // Check reduced motion preference
  const prefersReducedMotion = useRef(
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
  );

  const shouldAnimate = animate && !prefersReducedMotion.current;
  const animatedValue = useAnimatedValue(value, { duration, enabled: shouldAnimate });

  // Flash class on value change
  const [flash, setFlash] = useState(false);
  // Phase 4 Task 4.2.7: Directional tick flash (green ↑ / red ↓)
  const [tickDir, setTickDir] = useState(null); // 'up' | 'down' | null
  const prevValueRef = useRef(value);

  useEffect(() => {
    if (prevValueRef.current !== value) {
      setFlash(true);
      // Directional tick for price morphing
      if (value > prevValueRef.current) {
        setTickDir('up');
      } else if (value < prevValueRef.current) {
        setTickDir('down');
      }
      prevValueRef.current = value;
      const t = setTimeout(() => { setFlash(false); setTickDir(null); }, 600);
      return () => clearTimeout(t);
    }
  }, [value]);

  const formattedValue = formatValue(animatedValue, { decimals, prefix, suffix, format });

  const colorStyle = colorize
    ? { color: value >= 0 ? 'var(--tf-green)' : 'var(--tf-red)' }
    : {};

  const glowClass = colorize
    ? value >= 0 ? 'tf-glow-positive' : 'tf-glow-negative'
    : '';

  const tickClass = tickDir === 'up' ? 'tf-tick-up' : tickDir === 'down' ? 'tf-tick-down' : '';

  return (
    <span
      className={`tf-stat-value tf-data-mono ${flash ? 'tf-stat-flash' : ''} ${tickClass} ${glowClass} ${className}`.trim()}
      style={{ fontVariantNumeric: 'tabular-nums', ...colorStyle, ...style }}
      aria-label={formatValue(value, { decimals, prefix, suffix, format })}
    >
      {formattedValue}
    </span>
  );
});

export default AnimatedNumber;
export { formatValue, useAnimatedValue };
