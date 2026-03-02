// ═══════════════════════════════════════════════════════════════════
// charEdge — Unified Icon System (Sprint 5)
// Consistent icon sizing, accessibility, and a small SVG icon set
// for core UI actions. Replaces ad-hoc emoji/text icons in toolbar
// buttons and navigation elements.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';

// ─── Size Presets (aligned to 4px grid) ──────────────────────────
const SIZES = {
  xs: 12,
  sm: 16,
  md: 18, // Default — toolbar, nav, inline
  lg: 20,
  xl: 24,
  '2xl': 32,
};

// ─── Core SVG Icons ──────────────────────────────────────────────
// Minimal path-only SVGs for common UI actions. Each entry is
// { viewBox, paths } where paths is an array of <path d=""> strings.
const ICONS = {
  // Navigation
  home:       { vb: '0 0 24 24', d: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1' },
  chart:      { vb: '0 0 24 24', d: 'M3 3v18h18M7 16l4-4 4 4 4-8' },
  compass:    { vb: '0 0 24 24', d: 'M12 2a10 10 0 100 20 10 10 0 000-20zm3.5 6.5L14 14l-5.5 1.5L10 10l5.5-1.5z' },
  settings:   { vb: '0 0 24 24', d: 'M12 15a3 3 0 100-6 3 3 0 000 6zm7.94-2.06a1.98 1.98 0 00.06-.94V11a1.98 1.98 0 00-.06-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.49.49 0 00-.59-.22l-2.39.96a7.36 7.36 0 00-1.62-.94L15.09 2a.49.49 0 00-.49-.4h-3.84a.49.49 0 00-.49.4l-.36 2.35a7.36 7.36 0 00-1.62.94L5.9 4.33a.49.49 0 00-.59.22L3.39 7.87a.49.49 0 00.12.61l2.03 1.58A7.6 7.6 0 005.48 11v2a1.98 1.98 0 00.06.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32a.49.49 0 00.59.22l2.39-.96c.5.38 1.04.71 1.62.94l.36 2.35a.49.49 0 00.49.4h3.84a.49.49 0 00.49-.4l.36-2.35a7.36 7.36 0 001.62-.94l2.39.96a.49.49 0 00.59-.22l1.92-3.32a.49.49 0 00-.12-.61l-2.03-1.58z' },

  // Actions
  search:     { vb: '0 0 24 24', d: 'M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z' },
  plus:       { vb: '0 0 24 24', d: 'M12 5v14m-7-7h14' },
  close:      { vb: '0 0 24 24', d: 'M18 6L6 18M6 6l12 12' },
  check:      { vb: '0 0 24 24', d: 'M20 6L9 17l-5-5' },
  chevDown:   { vb: '0 0 24 24', d: 'M6 9l6 6 6-6' },
  chevRight:  { vb: '0 0 24 24', d: 'M9 6l6 6-6 6' },
  chevLeft:   { vb: '0 0 24 24', d: 'M15 18l-6-6 6-6' },
  menu:       { vb: '0 0 24 24', d: 'M4 6h16M4 12h16M4 18h16' },
  moreH:      { vb: '0 0 24 24', d: 'M5 12h.01M12 12h.01M19 12h.01' },
  moreV:      { vb: '0 0 24 24', d: 'M12 5h.01M12 12h.01M12 19h.01' },
  filter:     { vb: '0 0 24 24', d: 'M22 3H2l8 9.46V19l4 2v-8.54L22 3z' },
  download:   { vb: '0 0 24 24', d: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3' },
  upload:     { vb: '0 0 24 24', d: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12' },
  copy:       { vb: '0 0 24 24', d: 'M8 4H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2v-2M16 4h2a2 2 0 012 2v6M8 4a2 2 0 012-2h4a2 2 0 012 2v0a2 2 0 01-2 2h-4a2 2 0 01-2-2' },
  trash:      { vb: '0 0 24 24', d: 'M3 6h18m-2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2' },
  edit:       { vb: '0 0 24 24', d: 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z' },
  eye:        { vb: '0 0 24 24', d: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zm11 3a3 3 0 100-6 3 3 0 000 6z' },
  eyeOff:     { vb: '0 0 24 24', d: 'M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22' },
  lock:       { vb: '0 0 24 24', d: 'M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zm-2 0V7a5 5 0 00-10 0v4' },

  // Chart-specific
  candle:     { vb: '0 0 24 24', d: 'M12 2v4m0 12v4M8 6h8v12H8z' },
  indicator:  { vb: '0 0 24 24', d: 'M3 20l4-8 4 4 4-8 4 4' },
  crosshair:  { vb: '0 0 24 24', d: 'M12 2v20M2 12h20M12 8a4 4 0 100 8 4 4 0 000-8z' },
  ruler:      { vb: '0 0 24 24', d: 'M3 5l18 14M3 5v8l18 6V5' },
  layers:     { vb: '0 0 24 24', d: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5' },
  grid:       { vb: '0 0 24 24', d: 'M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18' },
  fullscreen: { vb: '0 0 24 24', d: 'M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3' },
  refresh:    { vb: '0 0 24 24', d: 'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15' },

  // Status
  bell:       { vb: '0 0 24 24', d: 'M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0' },
  info:       { vb: '0 0 24 24', d: 'M12 22a10 10 0 100-20 10 10 0 000 20zm0-14v4m0 4h.01' },
  warning:    { vb: '0 0 24 24', d: 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4m0 4h.01' },
  star:       { vb: '0 0 24 24', d: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z' },
  zap:        { vb: '0 0 24 24', d: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z' },

  // Appearance section
  moon:       { vb: '0 0 24 24', d: 'M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z' },
  sun:        { vb: '0 0 24 24', d: 'M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42M12 6a6 6 0 100 12 6 6 0 000-12z' },
  monitor:    { vb: '0 0 24 24', d: 'M2 3h20v14H2zM8 21h8M12 17v4' },
  layout:     { vb: '0 0 24 24', d: 'M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zM3 9h18M9 21V9' },
  minimize:   { vb: '0 0 24 24', d: 'M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7' },

  // Settings sections
  book:       { vb: '0 0 24 24', d: 'M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 004 22h16V2H6.5A2.5 2.5 0 004 4.5v15z' },
  palette:    { vb: '0 0 24 24', d: 'M12 2a10 10 0 00-1.26 19.93c.81.1 1.26-.36 1.26-.8v-.45c0-.8-.66-1.08-1.35-1.08-3 0-3.66-2.27-3.66-2.27-.49-1.26-1.2-1.6-1.2-1.6-.99-.68.07-.66.07-.66 1.09.08 1.66 1.12 1.66 1.12.97 1.66 2.55 1.18 3.17.9.1-.7.38-1.18.69-1.45-2.4-.27-4.92-1.2-4.92-5.33 0-1.18.42-2.14 1.11-2.9-.11-.27-.48-1.37.1-2.85 0 0 .91-.29 2.98 1.1A10.4 10.4 0 0112 6.84c.92.004 1.85.12 2.72.36 2.06-1.4 2.97-1.1 2.97-1.1.59 1.48.22 2.58.11 2.85.69.76 1.1 1.72 1.1 2.9 0 4.14-2.53 5.06-4.94 5.32.39.34.74 1 .74 2.02v2.99c0 .44.45.91 1.27.8A10 10 0 0012 2z' },
  folder:     { vb: '0 0 24 24', d: 'M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z' },
  plug:       { vb: '0 0 24 24', d: 'M12 22v-5M7 12V3m10 9V3M7 12a5 5 0 0010 0' },
  user:       { vb: '0 0 24 24', d: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z' },
  trophy:     { vb: '0 0 24 24', d: 'M6 9H4a2 2 0 01-2-2V5a2 2 0 012-2h2M18 9h2a2 2 0 002-2V5a2 2 0 00-2-2h-2M6 3h12v6a6 6 0 01-12 0V3zM9 21h6M12 15v6' },
  flask:      { vb: '0 0 24 24', d: 'M9 3h6M10 3v5.172a2 2 0 01-.586 1.414L5 14l-1.5 5.5a1 1 0 00.963 1.271h15.074a1 1 0 00.963-1.271L19 14l-4.414-4.414A2 2 0 0114 8.172V3' },
};

/**
 * Unified icon component.
 *
 * @param {string} name - Icon name from the ICONS registry
 * @param {'xs'|'sm'|'md'|'lg'|'xl'|'2xl'|number} size - Preset name or pixel value
 * @param {string} color - CSS color (defaults to currentColor)
 * @param {number} strokeWidth - SVG stroke width (default 2)
 * @param {string} className - Additional CSS class
 * @param {object} style - Additional inline styles
 * @param {string} title - Accessible title for the icon
 */
export default function TFIcon({
  name,
  size = 'md',
  color = 'currentColor',
  strokeWidth = 2,
  className = '',
  style = {},
  title,
  ...rest
}) {
  const icon = ICONS[name];
  if (!icon) {
    // Fallback: render as emoji/text
    return (
      <span
        className={`tf-icon ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: typeof size === 'number' ? size : SIZES[size] || SIZES.md,
          height: typeof size === 'number' ? size : SIZES[size] || SIZES.md,
          fontSize: (typeof size === 'number' ? size : SIZES[size] || SIZES.md) * 0.75,
          lineHeight: 1,
          flexShrink: 0,
          ...style,
        }}
        role={title ? 'img' : 'presentation'}
        aria-label={title}
        {...rest}
      >
        {name}
      </span>
    );
  }

  const px = typeof size === 'number' ? size : SIZES[size] || SIZES.md;

  return (
    <svg
      className={`tf-icon ${className}`}
      width={px}
      height={px}
      viewBox={icon.vb}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0, ...style }}
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      aria-hidden={!title}
      {...rest}
    >
      {title && <title>{title}</title>}
      <path d={icon.d} />
    </svg>
  );
}

// Named exports for direct import
export { ICONS, SIZES };
