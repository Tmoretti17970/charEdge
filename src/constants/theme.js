// ═══════════════════════════════════════════════════════════════════
// charEdge — Theme Constants
//
// Color palettes (dark/light), glassmorphism, depth shadows,
// CSS custom property bridge, font stacks.
//
// ⚠️  C, F, M, DARK_COLORS, LIGHT_COLORS, DEEP_SEA_COLORS are
//     defined in ./_colors.js (a leaf module with ZERO imports)
//     to guarantee Rollup evaluates them before any consumer.
//     This file re-exports them and adds derived tokens.
// ═══════════════════════════════════════════════════════════════════

// Re-export primitives from the leaf module
export { C, F, M, DARK_COLORS, LIGHT_COLORS, DEEP_SEA_COLORS } from './_colors.js';

// Import for local use (refreshThemeCache, earlyThemeInit)
import { C, LIGHT_COLORS } from './_colors.js';

// ─── CSS Custom Property → C key mapping ────────────────────────
const CSS_VAR_MAP = {
  bg: '--tf-bg',
  bg2: '--tf-bg2',
  sf: '--tf-sf',
  sf2: '--tf-sf2',
  bd: '--tf-bd',
  bd2: '--tf-bd2',
  t1: '--tf-t1',
  t2: '--tf-t2',
  t3: '--tf-t3',
  b: '--tf-accent',
  bH: '--tf-accent-h',
  g: '--tf-green',
  r: '--tf-red',
  y: '--tf-yellow',
  p: '--tf-purple',
  cyan: '--tf-cyan',
  orange: '--tf-orange',
  pink: '--tf-pink',
  lime: '--tf-lime',
  info: '--tf-info',
  bullish: '--tf-bullish',
  bearish: '--tf-bearish',
};

/**
 * Convert rgb()/rgba() to hex. Keeps hex strings untouched.
 * This ensures C.g + '18' always produces valid hex alpha like "#05966918".
 */
function toHex(color) {
  if (!color || color.startsWith('#')) return color;
  const m = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!m) return color;
  const r = parseInt(m[1], 10);
  const g = parseInt(m[2], 10);
  const b = parseInt(m[3], 10);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

/**
 * Refresh the C object by reading current CSS custom property values.
 * Called by useThemeStore after applying CSS vars on theme change.
 * Falls back to DARK_COLORS/LIGHT_COLORS when CSS vars aren't available (SSR/tests).
 */
export function refreshThemeCache() {
  const root = typeof document !== 'undefined' ? document.documentElement : null;
  if (!root) return;
  const cs = getComputedStyle(root);
  for (const [key, cssVar] of Object.entries(CSS_VAR_MAP)) {
    const val = cs.getPropertyValue(cssVar).trim();
    if (val) C[key] = toHex(val);
  }
  // Derived: red with alpha for subtle red backgrounds
  // Use proper rgba parsing — C.r may be rgb() from computed styles
  const rMatch = C.r.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rMatch) {
    C.rS = `rgba(${rMatch[1]},${rMatch[2]},${rMatch[3]},0.13)`;
  } else {
    // Hex fallback
    C.rS = C.r + '20';
  }

  // Swap GLASS & DEPTH to match current theme
  const isLight = root.classList.contains('theme-light');
  const glassSource = isLight ? GLASS_LIGHT : GLASS_DARK;
  const depthSource = isLight ? DEPTH_LIGHT : DEPTH_DARK;
  for (const k of Object.keys(glassSource)) GLASS[k] = glassSource[k];
  for (const k of Object.keys(depthSource)) DEPTH[k] = depthSource[k];
}

// ─── Sprint 3: Glass & Depth Tokens (JS-side) ────────────────────
// Mirror of CSS custom properties for inline-styled components.
// These are mutable objects that update on theme change via refreshThemeCache().

const GLASS_DARK = {
  subtle: 'rgba(22, 24, 29, 0.65)',
  standard: 'rgba(22, 24, 29, 0.78)',
  heavy: 'rgba(22, 24, 29, 0.88)',
  solid: 'rgba(22, 24, 29, 0.95)',
  blurSm: 'blur(8px) saturate(1.3)',
  blurMd: 'blur(16px) saturate(1.5)',
  blurLg: 'blur(24px) saturate(1.6)',
  blurXl: 'blur(40px) saturate(1.8)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderHover: '1px solid rgba(255,255,255,0.12)',
  borderActive: '1px solid rgba(232,100,44,0.3)',
  backdrop: 'rgba(0,0,0,0.4)',
};

const GLASS_LIGHT = {
  subtle: 'rgba(255, 255, 255, 0.7)',
  standard: 'rgba(255, 255, 255, 0.82)',
  heavy: 'rgba(255, 255, 255, 0.92)',
  solid: 'rgba(255, 255, 255, 0.97)',
  blurSm: 'blur(8px) saturate(1.2)',
  blurMd: 'blur(16px) saturate(1.3)',
  blurLg: 'blur(24px) saturate(1.4)',
  blurXl: 'blur(40px) saturate(1.5)',
  border: '1px solid rgba(0,0,0,0.08)',
  borderHover: '1px solid rgba(0,0,0,0.15)',
  borderActive: '1px solid rgba(212,85,30,0.35)',
  backdrop: 'rgba(255,255,255,0.5)',
};

export const GLASS = { ...GLASS_DARK };

const DEPTH_DARK = {
  0: 'none',
  1: '0 1px 3px rgba(0,0,0,0.2), 0 0 1px rgba(0,0,0,0.1)',
  2: '0 4px 16px rgba(0,0,0,0.25), 0 0 1px rgba(0,0,0,0.1)',
  3: '0 12px 40px rgba(0,0,0,0.35), 0 0 1px rgba(0,0,0,0.08)',
  4: '0 24px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04) inset',
  innerGlow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
  innerGlowStrong: 'inset 0 1px 0 rgba(255,255,255,0.08), inset 0 0 0 1px rgba(255,255,255,0.03)',
};

const DEPTH_LIGHT = {
  0: 'none',
  1: '0 1px 3px rgba(0,0,0,0.06), 0 0 1px rgba(0,0,0,0.04)',
  2: '0 4px 16px rgba(0,0,0,0.08), 0 0 1px rgba(0,0,0,0.04)',
  3: '0 12px 40px rgba(0,0,0,0.12), 0 0 1px rgba(0,0,0,0.04)',
  4: '0 24px 80px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.02) inset',
  innerGlow: 'inset 0 1px 0 rgba(255,255,255,0.5)',
  innerGlowStrong: 'inset 0 1px 0 rgba(255,255,255,0.7), inset 0 0 0 1px rgba(255,255,255,0.3)',
};

export const DEPTH = { ...DEPTH_DARK };

// ─── Early Theme Init ────────────────────────────────────────────
// Detect the current theme BEFORE React renders so C, GLASS, and DEPTH
// have correct values from the very first component render.
// This prevents the flash of dark-mode colors in light mode.
(function earlyThemeInit() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  // Check persisted theme from Zustand store or legacy key
  const stored = (() => {
    try {
      // Primary: new consolidated user store
      const userRaw = localStorage.getItem('charEdge-user');
      if (userRaw) {
        const parsed = JSON.parse(userRaw);
        const theme = parsed?.state?.theme;
        if (theme) return theme;
      }
      // Fallback: legacy theme store
      const legacyRaw = localStorage.getItem('charEdge-theme');
      if (legacyRaw) {
        const parsed = JSON.parse(legacyRaw);
        return parsed?.state?.theme || parsed?.theme || null;
      }
      return null;
      // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (_) {
      return null;
    }
  })();
  const resolved =
    stored === 'light'
      ? 'light'
      : stored === 'system'
        ? window.matchMedia('(prefers-color-scheme: light)').matches
          ? 'light'
          : 'dark'
        : stored || 'dark';

  if (resolved === 'light') {
    // Apply theme class so CSS vars are available instantly
    root.classList.remove('theme-dark', 'theme-deep-sea');
    root.classList.add('theme-light');
    // Swap GLASS and DEPTH immediately
    for (const k of Object.keys(GLASS_LIGHT)) GLASS[k] = GLASS_LIGHT[k];
    for (const k of Object.keys(DEPTH_LIGHT)) DEPTH[k] = DEPTH_LIGHT[k];
    // Swap C to light defaults (CSS vars may not be computed yet)
    Object.assign(C, LIGHT_COLORS);
  }
})();
