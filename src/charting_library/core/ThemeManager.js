// ═══════════════════════════════════════════════════════════════════
// charEdge — Theme System
// Dark and light themes matching TradingView's color palette.
// Runtime switching via CSS variables + direct canvas color refs.
//
// Usage:
//   const theme = createThemeManager('dark');
//   theme.apply(containerElement);
//   theme.setTheme('light');
// ═══════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} ChartTheme
 * @property {string} name
 * @property {string} background
 * @property {string} foreground
 * @property {string} axisBackground
 * @property {string} axisBorder
 * @property {string} textPrimary
 * @property {string} textSecondary
 * @property {string} textDisabled
 * @property {string} gridColor
 * @property {string} crosshairColor
 * @property {string} candleUp
 * @property {string} candleDown
 * @property {string} candleUpWick
 * @property {string} candleDownWick
 * @property {string} volumeUp
 * @property {string} volumeDown
 * @property {string} lineColor
 * @property {string} areaTopColor
 * @property {string} areaBottomColor
 * @property {string} currentPriceLine
 * @property {string} dividerColor
 * @property {string} dividerHover
 * @property {string} toolbarBg
 * @property {string} toolbarBorder
 * @property {string} buttonHover
 * @property {string} buttonActive
 * @property {string} accentColor
 * @property {string} dangerColor
 * @property {string} warningColor
 * @property {string} successColor
 * @property {string} tooltipBg
 * @property {string} tooltipText
 * @property {string} scrollbarTrack
 * @property {string} scrollbarThumb
 */

/** TradingView Dark Theme (default) */
export const DARK_THEME = {
  name: 'dark',

  // Canvas colors
  background: '#131722',
  foreground: '#D1D4DC',
  axisBackground: '#1E222D',
  axisBorder: 'rgba(54, 58, 69, 0.6)',
  textPrimary: '#D1D4DC',
  textSecondary: '#787B86',
  textDisabled: '#4E5266',

  // Grid & Crosshair
  gridColor: 'rgba(54, 58, 69, 0.3)',
  crosshairColor: 'rgba(149, 152, 161, 0.5)',

  // Candles
  candleUp: '#26A69A',
  candleDown: '#EF5350',
  candleUpWick: '#26A69A',
  candleDownWick: '#EF5350',

  // Volume
  volumeUp: 'rgba(38, 166, 154, 0.3)',
  volumeDown: 'rgba(239, 83, 80, 0.3)',

  // Line/Area chart
  lineColor: '#2962FF',
  areaTopColor: 'rgba(41, 98, 255, 0.28)',
  areaBottomColor: 'rgba(41, 98, 255, 0.02)',

  // Current price
  currentPriceLine: '#787B86',

  // Layout
  dividerColor: '#363A45',
  dividerHover: '#2962FF',

  // UI components
  toolbarBg: '#131722',
  toolbarBorder: '#1E222D',
  buttonHover: '#2A2E39',
  buttonActive: '#2962FF',
  accentColor: '#2962FF',
  dangerColor: '#EF5350',
  warningColor: '#FF9800',
  successColor: '#26A69A',

  // Tooltips
  tooltipBg: '#363A45',
  tooltipText: '#D1D4DC',

  // Scrollbar
  scrollbarTrack: '#1E222D',
  scrollbarThumb: '#363A45',
};

/** TradingView Light Theme */
export const LIGHT_THEME = {
  name: 'light',

  background: '#FFFFFF',
  foreground: '#131722',
  axisBackground: '#F8F9FD',
  axisBorder: 'rgba(0, 0, 0, 0.08)',
  textPrimary: '#131722',
  textSecondary: '#787B86',
  textDisabled: '#B2B5BE',

  gridColor: 'rgba(0, 0, 0, 0.06)',
  crosshairColor: 'rgba(0, 0, 0, 0.25)',

  candleUp: '#26A69A',
  candleDown: '#EF5350',
  candleUpWick: '#26A69A',
  candleDownWick: '#EF5350',

  volumeUp: 'rgba(38, 166, 154, 0.2)',
  volumeDown: 'rgba(239, 83, 80, 0.2)',

  lineColor: '#2962FF',
  areaTopColor: 'rgba(41, 98, 255, 0.2)',
  areaBottomColor: 'rgba(41, 98, 255, 0.01)',

  currentPriceLine: '#9E9E9E',

  dividerColor: '#E0E3EB',
  dividerHover: '#2962FF',

  toolbarBg: '#FFFFFF',
  toolbarBorder: '#E0E3EB',
  buttonHover: '#F0F3FA',
  buttonActive: '#2962FF',
  accentColor: '#2962FF',
  dangerColor: '#EF5350',
  warningColor: '#FF9800',
  successColor: '#26A69A',

  tooltipBg: '#FFFFFF',
  tooltipText: '#131722',

  scrollbarTrack: '#F0F3FA',
  scrollbarThumb: '#D1D4DC',
};

/** Theme registry */
const THEMES = {
  dark: DARK_THEME,
  light: LIGHT_THEME,
};

// Sprint 21: Preset Palettes
/** Bloomberg Terminal theme */
export const BLOOMBERG_THEME = {
  name: 'bloomberg',
  background: '#000000',
  foreground: '#FF8C00',
  axisBackground: '#0A0A0A',
  axisBorder: 'rgba(255, 140, 0, 0.15)',
  textPrimary: '#FF8C00',
  textSecondary: '#CC7000',
  textDisabled: '#664000',
  gridColor: 'rgba(255, 140, 0, 0.08)',
  crosshairColor: 'rgba(255, 140, 0, 0.35)',
  candleUp: '#00FF00',
  candleDown: '#FF0000',
  candleUpWick: '#00FF00',
  candleDownWick: '#FF0000',
  volumeUp: 'rgba(0, 255, 0, 0.25)',
  volumeDown: 'rgba(255, 0, 0, 0.25)',
  lineColor: '#FF8C00',
  areaTopColor: 'rgba(255, 140, 0, 0.2)',
  areaBottomColor: 'rgba(255, 140, 0, 0.01)',
  currentPriceLine: '#FF8C00',
  dividerColor: '#1A1A1A',
  dividerHover: '#FF8C00',
  toolbarBg: '#000000',
  toolbarBorder: '#1A1A1A',
  buttonHover: '#1A1A0A',
  buttonActive: '#FF8C00',
  accentColor: '#FF8C00',
  dangerColor: '#FF0000',
  warningColor: '#FFFF00',
  successColor: '#00FF00',
  tooltipBg: '#1A1A1A',
  tooltipText: '#FF8C00',
  scrollbarTrack: '#0A0A0A',
  scrollbarThumb: '#333333',
};

/** TradingView Pro Dark (refined) */
export const TRADINGVIEW_PRO_THEME = {
  name: 'tradingview-pro',
  background: '#0C0E15',
  foreground: '#E0E3EB',
  axisBackground: '#161A25',
  axisBorder: 'rgba(42, 46, 57, 0.6)',
  textPrimary: '#E0E3EB',
  textSecondary: '#6A6E78',
  textDisabled: '#3E4254',
  gridColor: 'rgba(42, 46, 57, 0.25)',
  crosshairColor: 'rgba(120, 123, 134, 0.4)',
  candleUp: '#089981',
  candleDown: '#F23645',
  candleUpWick: '#089981',
  candleDownWick: '#F23645',
  volumeUp: 'rgba(8, 153, 129, 0.25)',
  volumeDown: 'rgba(242, 54, 69, 0.25)',
  lineColor: '#2962FF',
  areaTopColor: 'rgba(41, 98, 255, 0.3)',
  areaBottomColor: 'rgba(41, 98, 255, 0.02)',
  currentPriceLine: '#6A6E78',
  dividerColor: '#2A2E39',
  dividerHover: '#2962FF',
  toolbarBg: '#0C0E15',
  toolbarBorder: '#161A25',
  buttonHover: '#1E222D',
  buttonActive: '#2962FF',
  accentColor: '#2962FF',
  dangerColor: '#F23645',
  warningColor: '#FF9800',
  successColor: '#089981',
  tooltipBg: '#2A2E39',
  tooltipText: '#E0E3EB',
  scrollbarTrack: '#161A25',
  scrollbarThumb: '#2A2E39',
};

THEMES['bloomberg'] = BLOOMBERG_THEME;
THEMES['tradingview-pro'] = TRADINGVIEW_PRO_THEME;

/**
 * Create a theme manager for runtime theme switching.
 *
 * @param {string} [initialTheme='dark']
 * @returns {Object} ThemeManager
 */
export function createThemeManager(initialTheme = 'dark') {
  let currentTheme = THEMES[initialTheme] || DARK_THEME;
  // Sprint 21: Per-key user overrides
  let userOverrides = {};

  /** @type {Set<(theme: ChartTheme) => void>} */
  const listeners = new Set();

  // Sprint 21: Load saved overrides
  try {
    const raw = localStorage.getItem('tf_theme_overrides');
    if (raw) userOverrides = JSON.parse(raw);
  } catch {}

  function getTheme() {
    return { ...currentTheme, ...userOverrides };
  }

  return {
    /** Current theme object (with user overrides applied) */
    get theme() {
      return getTheme();
    },

    /** Current theme name */
    get name() {
      return currentTheme.name;
    },

    /** Is dark theme */
    get isDark() {
      return currentTheme.name === 'dark' || currentTheme.background?.startsWith('#0') || currentTheme.background === '#000000';
    },

    /** Sprint 21: List all available theme names */
    get availableThemes() {
      return Object.keys(THEMES);
    },

    /**
     * Switch theme.
     * @param {string} themeName - 'dark' | 'light' | 'bloomberg' | 'tradingview-pro'
     */
    setTheme(themeName) {
      const newTheme = THEMES[themeName];
      if (!newTheme || newTheme === currentTheme) return;

      currentTheme = newTheme;

      // Persist
      try {
        localStorage.setItem('tf_theme', themeName);
      } catch {}

      // Notify listeners
      for (const listener of listeners) {
        listener(getTheme());
      }
    },

    /** Toggle between dark and light */
    toggle() {
      this.setTheme(currentTheme.name === 'dark' ? 'light' : 'dark');
    },

    /**
     * Sprint 21: Set per-key color overrides.
     * @param {string} key - Theme property key (e.g., 'candleUp')
     * @param {string} value - CSS color value
     */
    setOverride(key, value) {
      userOverrides[key] = value;
      try {
        localStorage.setItem('tf_theme_overrides', JSON.stringify(userOverrides));
      } catch {}
      for (const listener of listeners) {
        listener(getTheme());
      }
    },

    /**
     * Sprint 21: Clear all user overrides.
     */
    clearOverrides() {
      userOverrides = {};
      try {
        localStorage.removeItem('tf_theme_overrides');
      } catch {}
      for (const listener of listeners) {
        listener(getTheme());
      }
    },

    /**
     * Sprint 21: Get gradient background CSS (for gradient background option).
     * @param {string} [direction='to bottom'] - CSS gradient direction
     * @returns {string} CSS linear-gradient value
     */
    getGradientBackground(direction = 'to bottom') {
      const bg = getTheme().background || '#131722';
      // Lighten the top, darken the bottom
      return `linear-gradient(${direction}, ${bg}, ${adjustBrightness(bg, -10)})`;
    },

    /**
     * Apply theme CSS variables to a container element.
     * @param {HTMLElement} el
     */
    apply(el) {
      const merged = getTheme();
      for (const [key, value] of Object.entries(merged)) {
        if (key === 'name') continue;
        el.style.setProperty(`--tf-${camelToKebab(key)}`, value);
      }
    },

    /**
     * Register a theme change listener.
     * @param {(theme: ChartTheme) => void} callback
     * @returns {() => void} Unsubscribe function
     */
    onChange(callback) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },

    /**
     * Get a specific color from the current theme (with overrides).
     * @param {string} key - Theme key (e.g., 'candleUp')
     * @returns {string}
     */
    color(key) {
      return getTheme()[key] || '#FF00FF'; // Magenta = missing color
    },

    /**
     * Register a custom theme.
     * @param {string} name
     * @param {ChartTheme} theme
     */
    registerTheme(name, theme) {
      THEMES[name] = { ...theme, name };
    },

    /**
     * Sprint 21: Export current theme + overrides as JSON string.
     * @returns {string}
     */
    exportThemeJSON() {
      return JSON.stringify({
        base: currentTheme.name,
        overrides: userOverrides,
        theme: getTheme(),
      }, null, 2);
    },

    /**
     * Sprint 21: Import theme from JSON string.
     * @param {string} json
     */
    importThemeJSON(json) {
      try {
        const parsed = JSON.parse(json);
        if (parsed.base && THEMES[parsed.base]) {
          this.setTheme(parsed.base);
        }
        if (parsed.overrides && typeof parsed.overrides === 'object') {
          userOverrides = { ...parsed.overrides };
          try {
            localStorage.setItem('tf_theme_overrides', JSON.stringify(userOverrides));
          } catch {}
        }
        for (const listener of listeners) {
          listener(getTheme());
        }
      } catch (e) {
        console.warn('[ThemeManager] Invalid theme JSON:', e);
      }
    },

    /**
     * Load saved theme from localStorage.
     */
    loadSaved() {
      try {
        const saved = localStorage.getItem('tf_theme');
        if (saved && THEMES[saved]) {
          this.setTheme(saved);
        }
      } catch {}
    },
  };
}

/** Convert camelCase to kebab-case */
function camelToKebab(str) {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase();
}

/**
 * Sprint 21: Adjust brightness of a hex color.
 * @param {string} hex - e.g. '#131722'
 * @param {number} amount - positive = lighter, negative = darker
 * @returns {string}
 */
function adjustBrightness(hex, amount) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.min(255, ((num >> 16) & 0xFF) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xFF) + amount));
  const b = Math.max(0, Math.min(255, (num & 0xFF) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
