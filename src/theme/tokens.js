// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — Design Tokens
//
// Single source of truth for spacing, radii, shadows, typography,
// z-index, transitions, and semantic color aliases.
// Colors remain in constants.js (C, F, M) — this file extends
// the design system with dimensional and behavioral tokens.
// ═══════════════════════════════════════════════════════════════════

import { C, F, M } from '../constants.js';
export { alpha } from '../utils/colorUtils.js';

// ─── Spacing Scale (4px base) ─────────────────────────────────
export const space = {
  0: 0,
  1: 4, // tight
  2: 8, // compact
  3: 12, // default gap
  4: 16, // card padding
  5: 20,
  6: 24, // section gap
  7: 28, // section breathing room
  8: 32, // page padding (desktop)
  9: 36, // generous section gap
  10: 40,
  12: 48,
  16: 64,
};

// ─── Card Padding Presets ─────────────────────────────────────
// Use these instead of arbitrary padding values in components.
export const cardPadding = {
  compact: '10px 14px', // stat card secondary tier
  standard: '14px 16px', // stat card primary tier, info cards
  hero: '20px 22px', // hero stat card
  form: '20px 24px', // settings/form sections
  section: '24px 28px', // top-level settings sections
};

// ─── Border Radius ────────────────────────────────────────────
export const radii = {
  none: 0,
  xs: 4,     // tags, badges, small buttons
  sm: 8,     // inputs, small cards
  md: 12,    // cards, panels
  lg: 16,    // modals, drawers
  xl: 20,    // hero cards, dialogs
  pill: 9999,
};

// ─── Shadows ──────────────────────────────────────────────────
export const shadows = {
  none: 'none',
  sm: '0 1px 2px rgba(0,0,0,0.3)',
  md: '0 2px 8px rgba(0,0,0,0.4)',
  lg: '0 4px 16px rgba(0,0,0,0.5)',
  hover: '0 8px 24px rgba(0,0,0,0.25), 0 2px 8px rgba(0,0,0,0.15)',
  glow: (color) => `0 0 12px ${color}40`,
  // Light theme variants (softer, more diffuse)
  light: {
    sm: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)',
    md: '0 2px 8px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
    lg: '0 4px 16px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04)',
  },
};

/**
 * Theme-aware shadow helper.
 * Returns the appropriate shadow for the active theme (dark or light).
 * @param {'sm'|'md'|'lg'} size - Shadow size
 * @returns {string} CSS box-shadow value
 */
export function shadow(size = 'md') {
  // Detect light theme by checking background brightness
  const isLight = C.bg && (C.bg.startsWith('#f') || C.bg.startsWith('#e'));
  return isLight ? (shadows.light[size] || shadows.light.md) : (shadows[size] || shadows.md);
}

// ─── Brand Gradients (theme-reactive via getters) ───────────
// These use getters so they always read the current C.* values,
// even after a theme swap via refreshThemeCache().
export const gradient = {
  get brand() {
    return `linear-gradient(135deg, ${C.b}, ${C.y})`;
  },
  get glow() {
    return `radial-gradient(ellipse, ${C.b}15, transparent)`;
  },
  get subtle() {
    return `linear-gradient(135deg, ${C.sf}, ${C.b}08)`;
  },
  get heroPositive() {
    return `linear-gradient(135deg, ${C.sf}, ${C.g}06)`;
  },
  get heroNegative() {
    return `linear-gradient(135deg, ${C.sf}, ${C.r}06)`;
  },
};

// ─── Z-Index Scale ────────────────────────────────────────────
export const zIndex = {
  base: 0,
  sticky: 10,
  dropdown: 50,
  sidebar: 100,
  overlay: 200,
  modal: 300,
  toast: 400,
  tooltip: 500,
  popover: 1000,
  topmost: 9999,
};

// ─── Transitions ──────────────────────────────────────────────
export const transition = {
  micro: '0.08s ease',       // hover feedback (instant feel)
  fast: '0.1s ease',
  base: '0.15s ease',
  slow: '0.25s ease',
  enter: '0.2s cubic-bezier(0.16, 1, 0.3, 1)',   // elements appearing
  exit: '0.15s ease-in',                           // elements disappearing
  spring: '0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
};

// ─── Theme-reactive style factory ─────────────────────────────
// Creates an object whose property accesses return fresh style
// objects that read from the mutable C palette. Spread operators
// ({...text.h1}) call the getter at render time, so colors are
// always current.
function reactiveStyles(factory) {
  const out = {};
  for (const [key, fn] of Object.entries(factory)) {
    Object.defineProperty(out, key, { get: fn, enumerable: true });
  }
  return out;
}

// ─── Typography Presets (theme-reactive) ──────────────────────
export const text = reactiveStyles({
  // Page titles
  h1: () => ({ fontSize: 26, fontWeight: 700, fontFamily: F, color: C.t1, margin: 0, lineHeight: 1.2 }),
  h2: () => ({ fontSize: 18, fontWeight: 650, fontFamily: F, color: C.t1, margin: 0, lineHeight: 1.3 }),
  h3: () => ({ fontSize: 14, fontWeight: 700, fontFamily: F, color: C.t1, margin: 0, lineHeight: 1.4 }),

  // Body
  body: () => ({ fontSize: 14, fontFamily: F, color: C.t1, lineHeight: 1.5 }),
  bodySm: () => ({ fontSize: 13, fontFamily: F, color: C.t2, lineHeight: 1.5 }),
  bodyXs: () => ({ fontSize: 12, fontFamily: F, color: C.t2, lineHeight: 1.4 }),

  // Captions & labels
  label: () => ({
    fontSize: 11,
    fontWeight: 600,
    fontFamily: F,
    color: C.t3,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  }),
  caption: () => ({ fontSize: 11, fontFamily: F, color: C.t3 }),
  captionSm: () => ({ fontSize: 10, fontFamily: M, color: C.t3 }),

  // Data display — hero to small hierarchy
  dataHero: () => ({ fontSize: 32, fontFamily: M, fontWeight: 700, color: C.t1, fontVariantNumeric: 'tabular-nums' }),
  dataLg: () => ({ fontSize: 20, fontFamily: M, fontWeight: 700, color: C.t1, fontVariantNumeric: 'tabular-nums' }),
  dataMd: () => ({ fontSize: 14, fontFamily: M, fontWeight: 600, color: C.t1, fontVariantNumeric: 'tabular-nums' }),
  dataSm: () => ({ fontSize: 12, fontFamily: M, fontWeight: 500, color: C.t2, fontVariantNumeric: 'tabular-nums' }),

  // Mono / data (legacy compat)
  mono: () => ({ fontSize: 13, fontFamily: M, color: C.t1 }),
  monoSm: () => ({ fontSize: 12, fontFamily: M, color: C.t2 }),
  monoXs: () => ({ fontSize: 11, fontFamily: M, color: C.t2 }),
  monoBold: () => ({ fontSize: 14, fontFamily: M, fontWeight: 700, color: C.t1 }),
});

// ─── Common Layout Patterns ───────────────────────────────────
export const layout = {
  // Flex shortcuts
  row: { display: 'flex', alignItems: 'center' },
  rowBetween: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  rowCenter: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
  col: { display: 'flex', flexDirection: 'column' },
  colCenter: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },

  // Full-page containers
  page: { padding: space[8], maxWidth: 1200 },
  pageMobile: { padding: space[4], maxWidth: 1200 },

  // Scroll containers
  scrollY: { overflowY: 'auto', overflowX: 'hidden' },
  scrollX: { overflowX: 'auto', overflowY: 'hidden' },
};

// ─── Component Style Presets (theme-reactive) ─────────────────
export const preset = reactiveStyles({
  // Card base
  card: () => ({
    background: C.sf,
    border: `1px solid ${C.bd}`,
    borderRadius: radii.xl,
    padding: space[4],
  }),

  // Input base
  input: () => ({
    padding: '9px 12px',
    borderRadius: radii.lg,
    border: `1px solid ${C.bd}`,
    background: C.bg2,
    color: C.t1,
    fontSize: 12,
    fontFamily: F,
    outline: 'none',
    width: '100%',
    transition: `border-color ${transition.base}`,
  }),

  // Toolbar button
  toolbarBtn: () => ({
    padding: '4px 8px',
    borderRadius: radii.sm,
    border: 'none',
    background: 'transparent',
    color: C.t2,
    fontSize: 11,
    fontWeight: 600,
    fontFamily: F,
    cursor: 'pointer',
    transition: `background ${transition.fast}, color ${transition.fast}`,
  }),

  // Badge
  badge: () => ({
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: radii.pill,
    fontSize: 10,
    fontWeight: 600,
    fontFamily: M,
  }),

  // Divider (horizontal)
  divider: () => ({
    width: 1,
    height: 16,
    background: C.bd,
    flexShrink: 0,
  }),

  // Section label
  sectionLabel: () => ({
    fontSize: 11,
    fontWeight: 600,
    fontFamily: F,
    color: C.t3,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: space[2],
  }),

  // Metric row (label + value)
  metricRow: () => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${space[1]}px 0`,
    borderBottom: `1px solid ${C.bd}20`,
  }),

  // Overlay backdrop
  overlay: () => ({
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    zIndex: zIndex.overlay,
  }),

  // Modal container
  modal: () => ({
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    background: C.sf,
    border: `1px solid ${C.bd}`,
    borderRadius: radii.xl,
    zIndex: zIndex.modal,
    maxHeight: '90vh',
    overflow: 'auto',
  }),
});

// ─── Responsive Helpers ───────────────────────────────────────

/**
 * Merge responsive overrides based on breakpoint.
 * @param {Object} base - Base styles
 * @param {boolean} condition - Breakpoint condition
 * @param {Object} override - Styles to merge when condition is true
 * @returns {Object}
 */
export function responsive(base, condition, override) {
  return condition ? { ...base, ...override } : base;
}

/**
 * Color utility: return green/red based on positive/negative value.
 * @param {number} value
 * @returns {string} color hex
 */
export function pnlColor(value) {
  return (value || 0) >= 0 ? C.g : C.r;
}

/**
 * Color utility: return color based on severity.
 * @param {number} value
 * @param {number} warn - Warning threshold
 * @param {number} danger - Danger threshold
 * @returns {string}
 */
export function severityColor(value, warn = 5, danger = 30) {
  if (value < warn) return C.g;
  if (value < danger) return C.y;
  return C.r;
}

export default {
  space,
  radii,
  shadows,
  shadow,
  gradient,
  zIndex,
  transition,
  text,
  layout,
  preset,
  responsive,
  pnlColor,
  severityColor,
};
