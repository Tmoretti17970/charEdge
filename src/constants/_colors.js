// ═══════════════════════════════════════════════════════════════════
// charEdge — Color Primitives (Leaf Module)
//
// ⚠️  THIS FILE MUST HAVE ZERO IMPORTS.
//
// Rollup evaluates leaf modules (no imports) before all others.
// By defining C, F, M, and color palettes here with no import
// statements, we guarantee they are initialized before any
// consumer module reads them — even at module scope.
//
// This eliminates TDZ (Temporal Dead Zone) errors caused by
// circular dependency chains in barrel re-exports.
// ═══════════════════════════════════════════════════════════════════

// ─── Theme Palettes ──────────────────────────────────────────────

export const DARK_COLORS = {
  bg: '#08090a',
  bg2: '#0e1013',
  sf: '#16181d',
  sf2: '#1d2027',
  bd: '#2a2e3a',
  bd2: '#363b4a',
  t1: '#ececef',
  t2: '#8b8fa2',
  t3: '#4e5266',
  b: '#e8642c',
  bH: '#d4551e',
  g: '#34C759',
  r: '#FF3B30',
  y: '#f0b64e',
  p: '#c084fc',
  cyan: '#22d3ee',
  orange: '#e8642c',
  pink: '#f472b6',
  rose: '#e8a0b0',
  lime: '#a3e635',
  info: '#5c9cf5',
  bullish: '#34C759',
  bearish: '#FF3B30',
  rS: '#FF3B3020',
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
  g: '#34C759',
  r: '#FF3B30',
  y: '#d4930b',
  p: '#7c3aed',
  cyan: '#0891b2',
  orange: '#d4551e',
  pink: '#db2777',
  rose: '#c47a8a',
  lime: '#65a30d',
  info: '#2563eb',
  bullish: '#34C759',
  bearish: '#FF3B30',
  rS: '#FF3B3020',
};

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

// ─── Active Color Palette ────────────────────────────────────────
// Mutable object that starts with dark defaults. refreshThemeCache()
// in theme.js mutates this at runtime when the user switches themes.

export const C = { ...DARK_COLORS };

// ─── Font Stacks ─────────────────────────────────────────────────

export const F = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
export const M = "'JetBrains Mono', 'SF Mono', monospace";
