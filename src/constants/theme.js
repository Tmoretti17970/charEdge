// ═══════════════════════════════════════════════════════════════════
// charEdge — Theme Constants
//
// Color palettes (dark/light), glassmorphism, depth shadows,
// CSS custom property bridge, font stacks.
// ═══════════════════════════════════════════════════════════════════

// ─── Theme Palettes ──────────────────────────────────────────────

export const DARK_COLORS = {
  bg: '#08090a',      // Sprint 2: deepened page background
  bg2: '#0e1013',     // Sprint 2: +6 lightness (was #0f1012 = +1)
  sf: '#16181d',      // Sprint 2: cards clearly distinct from bg2
  sf2: '#1d2027',     // Sprint 2: interactive surfaces pop from sf
  bd: '#2a2e3a',      // Sprint 2: higher-contrast borders
  bd2: '#363b4a',     // Sprint 2: emphasis borders
  t1: '#ececef',
  t2: '#8b8fa2',
  t3: '#4e5266',
  b: '#e8642c',
  bH: '#d4551e',
  g: '#2dd4a0',
  r: '#f25c5c',
  y: '#f0b64e',
  p: '#c084fc',
  cyan: '#22d3ee',
  orange: '#e8642c',
  pink: '#f472b6',
  rose: '#e8a0b0',     // Charolette's Light — warm rose memorial accent
  lime: '#a3e635',
  info: '#5c9cf5',
  bullish: '#2dd4a0',
  bearish: '#f25c5c',
  rS: '#f25c5c20',
};

export const LIGHT_COLORS = {
  bg: '#f8f8fa',
  bg2: '#eef0f4',
  sf: '#ffffff',
  sf2: '#f2f3f6',
  bd: '#d4d7e0',
  bd2: '#bec3d0',
  t1: '#111318',
  t2: '#4a5068',
  t3: '#8890a4',
  b: '#d4551e',
  bH: '#bf4a18',
  g: '#059669',
  r: '#e11d48',
  y: '#d4930b',
  p: '#7c3aed',
  cyan: '#0891b2',
  orange: '#d4551e',
  pink: '#db2777',
  rose: '#c47a8a',     // Charolette's Light — warm rose (light theme variant)
  lime: '#65a30d',
  info: '#2563eb',
  bullish: '#059669',
  bearish: '#e11d48',
  rS: '#e11d4820',
};

// Task 4.9.3.2: Deep Sea OLED Dark Mode
// True black for OLED panels, warm-shifted text for eye strain reduction.
export const DEEP_SEA_COLORS = {
  bg: '#000000',
  bg2: '#050505',
  sf: '#0a0a08',
  sf2: '#121210',
  bd: '#1a1a16',
  bd2: '#28281e',
  t1: '#f0e8d8',
  t2: '#a09880',
  t3: '#6a6450',
  b: '#d4881e',
  bH: '#b87418',
  g: '#3dc78a',
  r: '#e85c5c',
  y: '#e8b830',
  p: '#b08ae0',
  cyan: '#d4a020',
  orange: '#d4881e',
  pink: '#d4889a',
  rose: '#c89898',
  lime: '#a8c830',
  info: '#c8a048',
  bullish: '#3dc78a',
  bearish: '#e85c5c',
  rS: '#e85c5c20',
};

// ─── CSS Custom Property → C key mapping ────────────────────────
const CSS_VAR_MAP = {
  bg: '--tf-bg', bg2: '--tf-bg2', sf: '--tf-sf', sf2: '--tf-sf2',
  bd: '--tf-bd', bd2: '--tf-bd2', t1: '--tf-t1', t2: '--tf-t2', t3: '--tf-t3',
  b: '--tf-accent', bH: '--tf-accent-h',
  g: '--tf-green', r: '--tf-red', y: '--tf-yellow', p: '--tf-purple',
  cyan: '--tf-cyan', orange: '--tf-orange', pink: '--tf-pink', lime: '--tf-lime',
  info: '--tf-info', bullish: '--tf-bullish', bearish: '--tf-bearish',
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
 * Active color palette — backed by CSS custom properties.
 * All components import C and read its properties at render time.
 * Values are refreshed from CSS vars on every theme change via refreshThemeCache().
 * CSS custom properties on <html> are the single source of truth.
 */
export const C = { ...DARK_COLORS };

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

export const F = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
export const M = "'JetBrains Mono', 'SF Mono', monospace";

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
    } catch (_) { return null; }
  })();
  const resolved = stored === 'light' ? 'light'
    : stored === 'system'
      ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
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
