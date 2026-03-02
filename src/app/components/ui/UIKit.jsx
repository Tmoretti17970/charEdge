// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — UIKit Design System
// Replaces 38+ instances of inline stat cards, 20+ toolbar buttons,
// and scattered Label/DataValue patterns across the monolith.
//
// All components use the C (colors), F (font), M (mono) constants.
// No external CSS dependencies.
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { C, F, M } from '../../../constants.js';
import { space, radii, transition, text as textTokens, preset } from '../../../theme/tokens.js';
import { useCountUp } from '../../../utils/useCountUp.js';

// Re-export tokens for convenience
export { space, radii, transition, preset } from '../../../theme/tokens.js';
export { pnlColor, severityColor, responsive } from '../../../theme/tokens.js';
export { SegmentedControl, ToggleSwitch, Tooltip, GroupedList } from './AppleHIG.jsx';

// ─── Input Style (theme-reactive) ───────────────────────────────
// Plain object with getters that delegate to preset.input, ensuring
// {...inputStyle} always reads current theme colors.
export const inputStyle = Object.defineProperties(
  {},
  {
    padding: { get: () => preset.input.padding, enumerable: true },
    borderRadius: { get: () => preset.input.borderRadius, enumerable: true },
    border: { get: () => preset.input.border, enumerable: true },
    background: { get: () => preset.input.background, enumerable: true },
    color: { get: () => preset.input.color, enumerable: true },
    fontSize: { get: () => preset.input.fontSize, enumerable: true },
    fontFamily: { get: () => preset.input.fontFamily, enumerable: true },
    outline: { get: () => preset.input.outline, enumerable: true },
    width: { get: () => preset.input.width, enumerable: true },
    transition: { get: () => preset.input.transition, enumerable: true },
  },
);

// ─── Card ───────────────────────────────────────────────────────
export const Card = React.forwardRef(function Card(
  { children, style = {}, onClick, className = '', hoverable = true, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      onClick={onClick}
      className={`${hoverable ? 'tf-card-hover' : ''} ${className}`}
      style={{ ...preset.card, ...style }}
      {...rest}
    >
      {children}
    </div>
  );
});

// ─── Button ─────────────────────────────────────────────────────
export function Btn({ children, onClick, disabled, style = {}, variant = 'primary' }) {
  const bg = variant === 'primary' ? C.b : variant === 'danger' ? C.r : C.bg2;
  return (
    <button
      className="tf-btn"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: `${space[2] + 2}px ${space[5]}px`,
        borderRadius: radii.lg,
        border: variant === 'ghost' ? `1px solid ${C.bd}` : 'none',
        background: disabled ? C.bg2 : bg,
        color: disabled ? C.t3 : C.t1,
        fontWeight: textTokens.bodySm.fontWeight || 700,
        fontSize: textTokens.bodySm.fontSize,
        fontFamily: F,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: `background ${transition.base}`,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

// ─── Label ──────────────────────────────────────────────────────
export function Label({ text, size = 'sm', style = {} }) {
  const base = size === 'md' ? textTokens.label : { ...textTokens.label, fontSize: 10 };
  return <div style={{ ...base, ...style }}>{text}</div>;
}

// ─── DataValue ──────────────────────────────────────────────────
export function DataValue({ value, color = C.t1, size = 'md', style = {} }) {
  // Map sizes to token-based presets
  const sizeMap = {
    sm:   { fontSize: textTokens.dataSm.fontSize,   fontWeight: textTokens.dataSm.fontWeight },
    md:   { fontSize: 17,                           fontWeight: 800 },
    lg:   { fontSize: textTokens.dataLg.fontSize,   fontWeight: textTokens.dataLg.fontWeight },
    hero: { fontSize: textTokens.dataHero.fontSize,  fontWeight: textTokens.dataHero.fontWeight },
  };
  const s = sizeMap[size] || sizeMap.md;
  return (
    <div
      style={{
        fontSize: s.fontSize,
        fontWeight: s.fontWeight,
        fontFamily: M,
        color,
        fontVariantNumeric: 'tabular-nums',
        ...style,
      }}
    >
      {value}
    </div>
  );
}

// ─── StatCard (replaces 38+ inline instances) ───────────────────
export function StatCard({
  label,
  value,
  rawValue,
  formatter,
  color = C.t1,
  blurred = false,
  tier = 'primary',
  tip = null,
  style = {},
}) {
  const isHero = tier === 'hero';
  const isSecondary = tier === 'secondary';

  // Animate the raw number if provided
  const animatedValue = useCountUp(rawValue !== undefined ? rawValue : null, 800);
  const displayValue = rawValue !== undefined && formatter ? formatter(animatedValue) : value;

  // Determine glow context for narrative polish
  let glowClass = '';
  if (color === C.g) glowClass = 'tf-glow-positive';
  else if (color === C.r) glowClass = 'tf-glow-negative';

  return (
    <Card
      className={glowClass}
      style={{
        padding: isHero ? '20px 22px' : isSecondary ? '10px 14px' : '14px 16px',
        background: isHero ? `linear-gradient(135deg, ${C.sf}, ${C.b}08)` : C.sf,
        border: `1px solid ${isHero ? C.b + '25' : C.bd}`,
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
    >
      {isHero && (
        <div
          style={{
            position: 'absolute',
            top: -30,
            right: -30,
            width: 100,
            height: 100,
            background: `radial-gradient(circle, ${C.b}12, transparent)`,
            borderRadius: '50%',
            pointerEvents: 'none',
          }}
        />
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: isHero ? 8 : 4 }}>
        <Label text={label} style={{ marginBottom: 0 }} />
        {tip && (
          <Tooltip content={tip} position="top">
            <span style={{ cursor: 'help', color: C.t3, fontSize: 11, fontWeight: 700 }}>(i)</span>
          </Tooltip>
        )}
      </div>
      <DataValue
        value={displayValue}
        color={color}
        size={isHero ? 'hero' : isSecondary ? 'sm' : 'md'}
        style={blurred ? { filter: 'blur(8px)', userSelect: 'none' } : {}}
      />
    </Card>
  );
}

// ─── ToolbarBtn (replaces 20+ inline toolbar buttons) ───────────
export function ToolbarBtn({ active, onClick, icon, title, style = {} }) {
  return (
    <button
      className="tf-btn"
      onClick={onClick}
      title={title}
      style={{
        ...preset.toolbarBtn,
        padding: '2px 7px',
        border: `1px solid ${active ? C.b : C.bd}`,
        background: active ? C.b + '30' : 'transparent',
        color: active ? C.b : C.t3,
        ...style,
      }}
    >
      {icon}
    </button>
  );
}

// ─── Badge ──────────────────────────────────────────────────────
export function Badge({ text, color = C.b, style = {} }) {
  return (
    <span
      style={{
        ...preset.badge,
        background: color + '20',
        color,
        ...style,
      }}
    >
      {text}
    </span>
  );
}

// ─── PnlBar (horizontal bar used in 6+ analytics components) ───
export function PnlBar({ pnl, maxPnl, height = 6, style = {} }) {
  const width = maxPnl > 0 ? Math.min((Math.abs(pnl) / maxPnl) * 100, 100) : 0;
  const color = pnl >= 0 ? C.g : C.r;
  return (
    <div
      style={{
        height,
        borderRadius: height / 2,
        background: C.bg2,
        overflow: 'hidden',
        ...style,
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${width}%`,
          background: color + '60',
          borderRadius: height / 2,
          transition: 'width 0.3s ease',
        }}
      />
    </div>
  );
}

// ─── GridLayout ─────────────────────────────────────────────────
export function GridLayout({ cols = 2, gap = 12, children, style = {} }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: typeof cols === 'string' ? cols : `repeat(${cols}, 1fr)`,
        gap,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─── AutoGrid (responsive) ──────────────────────────────────────
export function AutoGrid({ minWidth = 140, gap = 8, children, style = {} }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fit, minmax(${minWidth}px, 1fr))`,
        gap,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─── SectionHeader ──────────────────────────────────────────────
export function SectionHeader({ title, right, style = {} }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: space[2],
        ...style,
      }}
    >
      <div style={{ ...textTokens.label, margin: 0 }}>{title}</div>
      {right && <div>{right}</div>}
    </div>
  );
}

// ─── Modal Overlay (Sprint 5: Framer Motion entrance/exit) ──────
export function ModalOverlay({ isOpen, onClose, children, width = 480, 'aria-label': ariaLabel }) {
  const contentRef = useRef(null);
  const prefersReducedMotion = useReducedMotion();

  // Escape key closes the modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // Auto-focus the modal content on open
  useEffect(() => {
    if (isOpen && contentRef.current) {
      contentRef.current.focus();
    }
  }, [isOpen]);

  const skipMotion = prefersReducedMotion;

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Backdrop with fade */}
          <motion.div
            initial={skipMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={skipMotion ? undefined : { opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,.6)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
            }}
          />
          {/* Content with scale + fade */}
          <motion.div
            ref={contentRef}
            initial={skipMotion ? false : { opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={skipMotion ? undefined : { opacity: 0, scale: 0.95, y: 8 }}
            transition={{
              type: 'spring',
              stiffness: 500,
              damping: 35,
              mass: 0.8,
            }}
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel || 'Dialog'}
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              background: C.sf,
              border: `1px solid ${C.bd}`,
              borderRadius: 16,
              padding: 24,
              width,
              maxWidth: '95vw',
              maxHeight: '85vh',
              overflowY: 'auto',
              outline: 'none',
            }}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ─── EmptyState ─────────────────────────────────────────────────
export function EmptyState({ message, icon = '📊', style = {} }) {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: 48,
        color: C.t3,
        ...style,
      }}
    >
      <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.4 }}>{icon}</div>
      <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.5 }}>{message}</div>
    </div>
  );
}

// ─── Skeleton Loading (replaces spinners per review §8.2) ───────

/**
 * Animated shimmer card for loading states.
 * Relies on the tf-skeleton CSS class for shimmer animation.
 */
export function SkeletonCard({ width = '100%', height = 120, style = {} }) {
  return (
    <div
      className="tf-skeleton"
      style={{
        width,
        height,
        borderRadius: 12,
        border: `1px solid ${C.bd}`,
        ...style,
      }}
    >
      {/* Inner content placeholders */}
      <div style={{ padding: '14px 16px' }}>
        <div
          style={{
            width: '40%',
            height: 8,
            borderRadius: 4,
            background: C.bd + '60',
            marginBottom: 10,
          }}
        />
        <div
          style={{
            width: '65%',
            height: 18,
            borderRadius: 4,
            background: C.bd + '40',
          }}
        />
      </div>
    </div>
  );
}

/**
 * Row of skeleton cards for stat card loading states.
 * Drop-in replacement for AutoGrid of StatCards.
 */
export function SkeletonRow({ count = 4 }) {
  return (
    <AutoGrid minWidth={130} gap={8}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} height={72} />
      ))}
    </AutoGrid>
  );
}
