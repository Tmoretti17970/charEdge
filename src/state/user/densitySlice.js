// ═══════════════════════════════════════════════════════════════════
// charEdge — Density Slice
// Extracted from useDensityStore for useUserStore consolidation.
//
// 3 density modes: comfortable, standard, compact
// Auto-detect from screen width + manual override.
// ═══════════════════════════════════════════════════════════════════

export const DENSITY_MODES = {
  COMFORTABLE: 'comfortable',
  STANDARD: 'standard',
  COMPACT: 'compact',
};

export const DENSITY_CONFIG = {
  [DENSITY_MODES.COMFORTABLE]: {
    label: 'Comfortable',
    icon: '🪟',
    description: 'More whitespace, larger controls — great for smaller screens',
  },
  [DENSITY_MODES.STANDARD]: {
    label: 'Standard',
    icon: '⬜',
    description: 'Balanced density — default for most users',
  },
  [DENSITY_MODES.COMPACT]: {
    label: 'Compact',
    icon: '🔲',
    description: 'Dense information, smaller controls — for large monitors',
  },
};

/**
 * Auto-detect density from screen width.
 *  <1440 → comfortable
 *  1440-1919 → standard
 *  ≥1920 → compact
 */
function detectDensity() {
  if (typeof window === 'undefined') return DENSITY_MODES.STANDARD;
  const w = window.innerWidth;
  if (w < 1440) return DENSITY_MODES.COMFORTABLE;
  if (w >= 1920) return DENSITY_MODES.COMPACT;
  return DENSITY_MODES.STANDARD;
}

/**
 * Apply density as a data attribute on <html> so CSS can react.
 */
function applyDensity(density) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-density', density);
}

// ─── Slice ─────────────────────────────────────────────────────────

export const createDensitySlice = (set, get) => ({
  // 'auto' means follow screen width detection
  mode: 'auto', // 'auto' | 'comfortable' | 'standard' | 'compact'

  // The resolved density (what's actually applied)
  activeDensity: DENSITY_MODES.STANDARD,

  // ─── Actions ─────────────────────────────────────────

  /** Set density mode ('auto' or a specific mode) */
  setMode(mode) {
    const active = mode === 'auto' ? detectDensity() : mode;
    applyDensity(active);
    set({ mode, activeDensity: active });
  },

  /** Re-evaluate auto mode (called on resize) */
  redetect() {
    const { mode } = get();
    if (mode !== 'auto') return;
    const active = detectDensity();
    if (active !== get().activeDensity) {
      applyDensity(active);
      set({ activeDensity: active });
    }
  },

  /** Initialize on app boot */
  initDensity() {
    const { mode } = get();
    const active = mode === 'auto' ? detectDensity() : mode;
    applyDensity(active);
    set({ activeDensity: active });

    // Listen for resize to auto-adjust
    if (typeof window !== 'undefined') {
      let resizeTimer;
      window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          get().redetect();
        }, 250);
      });
    }
  },

  // Backward compat alias — old store used `init()`
  init() {
    get().initDensity();
  },
});
