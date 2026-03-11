// ═══════════════════════════════════════════════════════════════════
// charEdge — Apple HIG Component Primitives
// SegmentedControl, ToggleSwitch, Tooltip
//
// These components follow Apple Human Interface Guidelines for
// visual consistency, motion, and interaction patterns.
// ═══════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect, useCallback } from 'react';
import { C, F, M } from '../../../constants.js';
import { radii, transition } from '../../../theme/tokens.js';
import { alpha } from '@/shared/colorUtils';

// ─── SegmentedControl ───────────────────────────────────────────
// Apple-style segmented picker with animated sliding indicator.
// Replaces 11+ inline tab-style button patterns across the app.
//
// Usage:
//   <SegmentedControl
//     items={[{ id: '1d', label: '1D' }, { id: '1w', label: '1W' }]}
//     value="1d"
//     onChange={(id) => setTimeframe(id)}
//   />

export function SegmentedControl({
  items = [],
  value,
  onChange,
  size = 'sm', // 'xs' | 'sm' | 'md'
  fullWidth = false,
  style = {},
}) {
  const containerRef = useRef(null);
  const [indicatorStyle, setIndicatorStyle] = useState({});

  // Measure the active segment and animate the indicator
  useEffect(() => {
    if (!containerRef.current) return;
    const idx = items.findIndex((i) => i.id === value);
    if (idx < 0) return;

    const btns = containerRef.current.querySelectorAll('[data-segment]');
    const btn = btns[idx];
    if (!btn) return;

    setIndicatorStyle({
      left: btn.offsetLeft,
      width: btn.offsetWidth,
    });
  }, [value, items]);

  const sizes = {
    xs: { fontSize: 10, padding: '4px 0', height: 26 },
    sm: { fontSize: 11, padding: '5px 0', height: 30 },
    md: { fontSize: 12, padding: '6px 0', height: 34 },
  };
  const s = sizes[size] || sizes.sm;

  return (
    <div
      ref={containerRef}
      style={{
        display: 'inline-flex',
        position: 'relative',
        background: alpha(C.bd, 0.15),
        borderRadius: radii.lg,
        padding: 2,
        gap: 0,
        width: fullWidth ? '100%' : undefined,
        ...style,
      }}
    >
      {/* Animated sliding indicator */}
      <div
        style={{
          position: 'absolute',
          top: 2,
          left: indicatorStyle.left || 0,
          width: indicatorStyle.width || 0,
          height: `calc(100% - 4px)`,
          background: C.sf,
          borderRadius: radii.md,
          boxShadow: `0 1px 3px ${alpha(C.bg, 0.15)}, 0 1px 2px ${alpha(C.bg, 0.1)}`,
          transition: `left 0.2s cubic-bezier(0.25, 0.1, 0.25, 1), width 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)`,
          zIndex: 0,
        }}
      />

      {items.map((item) => {
        const isActive = item.id === value;
        return (
          <button
            key={item.id}
            data-segment
            onClick={() => onChange?.(item.id)}
            style={{
              position: 'relative',
              zIndex: 1,
              flex: fullWidth ? 1 : undefined,
              border: 'none',
              background: 'transparent',
              color: isActive ? C.t1 : C.t3,
              fontSize: s.fontSize,
              fontWeight: isActive ? 600 : 500,
              fontFamily: F,
              padding: `${s.padding}`,
              paddingLeft: 12,
              paddingRight: 12,
              height: s.height,
              cursor: 'pointer',
              transition: `color ${transition.base}`,
              whiteSpace: 'nowrap',
            }}
          >
            {item.icon && <span style={{ marginRight: 4 }}>{item.icon}</span>}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── ToggleSwitch ───────────────────────────────────────────────
// Apple-style toggle switch with smooth animation.
// Replaces 9+ HTML checkboxes across the app.
//
// Usage:
//   <ToggleSwitch
//     checked={showGrid}
//     onChange={(v) => setShowGrid(v)}
//     label="Show Grid"
//   />

export function ToggleSwitch({
  checked = false,
  onChange,
  label,
  disabled = false,
  size = 'sm', // 'sm' | 'md'
  style = {},
}) {
  const [hovered, setHovered] = useState(false);

  const sizes = {
    sm: { track: { width: 36, height: 20 }, thumb: 16, offset: 2 },
    md: { track: { width: 44, height: 24 }, thumb: 20, offset: 2 },
  };
  const s = sizes[size] || sizes.sm;

  const trackColor = checked ? (disabled ? alpha(C.b, 0.4) : C.b) : alpha(C.t3, 0.25);

  const thumbLeft = checked ? s.track.width - s.thumb - s.offset : s.offset;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        ...style,
      }}
      onClick={() => !disabled && onChange?.(!checked)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Track */}
      <div
        style={{
          width: s.track.width,
          height: s.track.height,
          borderRadius: s.track.height / 2,
          background: trackColor,
          position: 'relative',
          flexShrink: 0,
          transition: `background ${transition.base}`,
          transform: hovered && !disabled ? 'scale(1.04)' : 'scale(1)',
        }}
      >
        {/* Thumb */}
        <div
          style={{
            position: 'absolute',
            top: s.offset,
            left: thumbLeft,
            width: s.thumb,
            height: s.thumb,
            borderRadius: '50%',
            background: '#fff',
            boxShadow: `0 1px 3px rgba(0,0,0,0.2), 0 1px 2px rgba(0,0,0,0.12)`,
            transition: `left 0.2s cubic-bezier(0.25, 0.1, 0.25, 1), transform ${transition.fast}`,
            transform: hovered && !disabled ? 'scale(1.05)' : 'scale(1)',
          }}
        />
      </div>

      {/* Label */}
      {label && (
        <span
          style={{
            fontSize: size === 'md' ? 13 : 12,
            fontFamily: F,
            color: C.t2,
            userSelect: 'none',
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

// ─── Tooltip ────────────────────────────────────────────────────
// Apple-style tooltip that appears on hover with subtle animation.
// Wraps any child element.
//
// Usage:
//   <Tooltip text="Risk-adjusted return. Above 1.0 is good.">
//     <span>Sharpe Ratio</span>
//   </Tooltip>

export function Tooltip({
  text,
  children,
  position = 'top', // 'top' | 'bottom' | 'left' | 'right'
  delay = 400,
  maxWidth = 220,
}) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef(null);

  const show = useCallback(() => {
    timerRef.current = setTimeout(() => setVisible(true), delay);
  }, [delay]);

  const hide = useCallback(() => {
    clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  if (!text) return children;

  const positions = {
    top: {
      bottom: '100%',
      left: '50%',
      transform: `translate(-50%, ${visible ? '-6px' : '0px'})`,
      marginBottom: 4,
    },
    bottom: {
      top: '100%',
      left: '50%',
      transform: `translate(-50%, ${visible ? '6px' : '0px'})`,
      marginTop: 4,
    },
    left: {
      right: '100%',
      top: '50%',
      transform: `translate(${visible ? '-6px' : '0px'}, -50%)`,
      marginRight: 4,
    },
    right: {
      left: '100%',
      top: '50%',
      transform: `translate(${visible ? '6px' : '0px'}, -50%)`,
      marginLeft: 4,
    },
  };

  return (
    <div
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}

      <div
        role="tooltip"
        style={{
          position: 'absolute',
          ...positions[position],
          background: alpha(C.bg, 0.92),
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: `1px solid ${alpha(C.bd, 0.3)}`,
          borderRadius: radii.md,
          padding: '6px 10px',
          fontSize: 11,
          fontFamily: F,
          color: C.t1,
          lineHeight: 1.4,
          maxWidth,
          whiteSpace: 'normal',
          pointerEvents: 'none',
          opacity: visible ? 1 : 0,
          transition: `opacity 0.15s ease, transform 0.15s ease`,
          zIndex: 9999,
          boxShadow: `0 4px 12px ${alpha(C.bg, 0.3)}`,
        }}
      >
        {text}
      </div>
    </div>
  );
}

// ─── GroupedList ─────────────────────────────────────────────────
// Apple Settings-style grouped list with section headers and
// visual separators. Used for Settings, preferences, options.
//
// Usage:
//   <GroupedList
//     title="Trading"
//     items={[
//       { label: 'Show Grid', right: <ToggleSwitch ... /> },
//       { label: 'Default Symbol', value: 'BTCUSDT' },
//     ]}
//   />

export function GroupedList({ title, items = [], style = {} }) {
  return (
    <div style={{ marginBottom: 20, ...style }}>
      {title && (
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            fontFamily: F,
            color: C.t3,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: 8,
            padding: '0 4px',
          }}
        >
          {title}
        </div>
      )}
      <div
        style={{
          background: C.sf,
          border: `1px solid ${C.bd}`,
          borderRadius: radii.xl,
          overflow: 'hidden',
        }}
      >
        {items.map((item, i) => (
          <div
            key={item.key || i}
            onClick={item.onClick}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderBottom: i < items.length - 1 ? `1px solid ${alpha(C.bd, 0.5)}` : 'none',
              cursor: item.onClick ? 'pointer' : 'default',
              transition: `background ${transition.fast}`,
              minHeight: 44, // Apple HIG minimum touch target
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {item.icon && <span style={{ fontSize: 18, flexShrink: 0 }}>{item.icon}</span>}
              <div>
                <div style={{ fontSize: 13, fontFamily: F, color: C.t1, fontWeight: 500 }}>{item.label}</div>
                {item.description && (
                  <div style={{ fontSize: 11, fontFamily: F, color: C.t3, marginTop: 2 }}>{item.description}</div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {item.value && <span style={{ fontSize: 13, fontFamily: M, color: C.t2 }}>{item.value}</span>}
              {item.right}
              {item.onClick && !item.right && <span style={{ fontSize: 14, color: C.t3 }}>›</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
