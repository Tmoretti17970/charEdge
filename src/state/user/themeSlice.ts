// ═══════════════════════════════════════════════════════════════════
// charEdge — Theme Slice
// Extracted from useThemeStore for useUserStore consolidation.
//
// Manages dark/light theme + appearance customization.
// CSS side-effect helpers stay module-level.
// ═══════════════════════════════════════════════════════════════════

import { refreshThemeCache } from '../../constants.js';
import { notifyThemeChange } from '../../hooks/useThemeVars.js';

// ─── Accent Color Presets ────────────────────────────────────────
export const ACCENT_PRESETS = [
  { id: 'forge', hex: '#e8642c', label: 'Forge Orange' },
  { id: 'ocean', hex: '#2962FF', label: 'Ocean Blue' },
  { id: 'emerald', hex: '#059669', label: 'Emerald' },
  { id: 'violet', hex: '#7c3aed', label: 'Violet' },
  { id: 'rose', hex: '#e11d48', label: 'Rose' },
  { id: 'cyan', hex: '#0891b2', label: 'Cyan' },
  { id: 'amber', hex: '#d97706', label: 'Amber' },
  { id: 'fuchsia', hex: '#c026d3', label: 'Fuchsia' },
];

// ─── Chart Color Presets ─────────────────────────────────────────
export const CHART_COLOR_PRESETS = [
  { id: 'classic', label: 'Classic', bull: '#2dd4a0', bear: '#f25c5c' },
  { id: 'neon', label: 'Neon', bull: '#00ff88', bear: '#ff3366' },
  { id: 'monochrome', label: 'Mono', bull: '#a0a0a0', bear: '#505050' },
  { id: 'ocean', label: 'Ocean', bull: '#22d3ee', bear: '#6366f1' },
  { id: 'sunset', label: 'Sunset', bull: '#f0b64e', bear: '#e8642c' },
];

// ─── Helpers (module-level, not in store) ────────────────────────

/** Darken a hex color by ~15% for hover states */
function darkenHex(hex) {
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - 30);
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - 30);
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - 30);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function resolveTheme(theme) {
  if (theme !== 'system') return theme;
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

/** Apply theme class to document root with smooth transition */
function applyTheme(resolved) {
  const root = typeof document !== 'undefined' ? document.documentElement : null;
  if (!root) return;

  root.classList.add('tf-transitioning');

  if (resolved === 'light') {
    root.classList.add('theme-light');
    root.classList.remove('theme-dark');
  } else {
    root.classList.add('theme-dark');
    root.classList.remove('theme-light');
  }

  setTimeout(() => root.classList.remove('tf-transitioning'), 400);
}

/** Apply all appearance CSS vars at once (used on hydrate) */
function applyAppearance(state) {
  applyAccent(state.accentColor);
  applyFontSize(state.fontSize);
  applyChartColors(state.chartColorPreset);
}

function applyAccent(hex) {
  const root = typeof document !== 'undefined' ? document.documentElement : null;
  if (!root) return;
  root.style.setProperty('--tf-accent', hex);
  root.style.setProperty('--tf-accent-h', darkenHex(hex));
}

function applyFontSize(px) {
  const root = typeof document !== 'undefined' ? document.documentElement : null;
  if (!root) return;
  root.style.setProperty('--tf-font-base', `${px}px`);
}

function applyChartColors(presetId) {
  const root = typeof document !== 'undefined' ? document.documentElement : null;
  if (!root) return;
  const preset = CHART_COLOR_PRESETS.find((p) => p.id === presetId) || CHART_COLOR_PRESETS[0];
  root.style.setProperty('--tf-chart-bull', preset.bull);
  root.style.setProperty('--tf-chart-bear', preset.bear);
}

// ─── Slice ───────────────────────────────────────────────────────

export const createThemeSlice = (set, get) => ({
  theme: 'dark',                      // 'dark' | 'light' | 'system'
  accentColor: '#e8642c',             // hex string
  fontSize: 13,                       // 12–18 px
  chartColorPreset: 'classic',        // one of CHART_COLOR_PRESETS.id

  setTheme(theme) {
    const resolved = resolveTheme(theme);
    set({ theme });
    applyTheme(resolved);
    applyAppearance(get());
    refreshThemeCache();
    notifyThemeChange();
  },

  toggleTheme() {
    const cur = get().theme;
    const next = cur === 'dark' ? 'light' : cur === 'light' ? 'system' : 'dark';
    get().setTheme(next);
  },

  setAccentColor(hex) {
    set({ accentColor: hex });
    applyAccent(hex);
    refreshThemeCache();
    notifyThemeChange();
  },

  setFontSize(px) {
    const clamped = Math.min(18, Math.max(12, px));
    set({ fontSize: clamped });
    applyFontSize(clamped);
  },

  setChartColorPreset(presetId) {
    set({ chartColorPreset: presetId });
    applyChartColors(presetId);
    refreshThemeCache();
    notifyThemeChange();
  },

  /** Call once on app boot to sync DOM and C object with persisted state */
  hydrate() {
    let theme = get().theme;
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('charEdge-theme');
      if (!stored) {
        // Default to 'system' — respect OS preference automatically
        theme = 'system';
        set({ theme });
      }

      // Listen for OS color scheme changes when theme is 'system'
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', () => {
        if (get().theme === 'system') {
          const resolved = resolveTheme('system');
          applyTheme(resolved);
          refreshThemeCache();
          notifyThemeChange();
        }
      });
    }
    const resolved = resolveTheme(theme);
    applyTheme(resolved);
    applyAppearance(get());
    refreshThemeCache();
    notifyThemeChange();
  },
});
