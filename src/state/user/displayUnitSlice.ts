// ═══════════════════════════════════════════════════════════════════
// charEdge — Display Unit Slice
// Extracted from useDisplayUnitStore for useUserStore consolidation.
//
// Global toggle for how P&L is displayed: $ / % / R
// ═══════════════════════════════════════════════════════════════════

function fmtDollar(n) {
  return (n >= 0 ? '+' : '-') + '$' + Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export const createDisplayUnitSlice = (_set, get) => ({
  // Current display unit: 'dollar' | 'percent' | 'rmultiple'
  displayUnit: 'dollar',
  // Backward compat alias (consumers use s.unit)
  unit: 'dollar',

  // Cycle through units
  cycleDisplayUnit: () => _set((s) => {
    const next = s.displayUnit === 'dollar' ? 'percent' : s.displayUnit === 'percent' ? 'rmultiple' : 'dollar';
    return { displayUnit: next, unit: next };
  }),
  // Backward compat alias (consumers use s.cycle)
  cycle: () => _set((s) => {
    const next = s.unit === 'dollar' ? 'percent' : s.unit === 'percent' ? 'rmultiple' : 'dollar';
    return { displayUnit: next, unit: next };
  }),

  // Set specific unit
  setDisplayUnit: (u) => _set({ displayUnit: u, unit: u }),
  setUnit: (u) => _set({ displayUnit: u, unit: u }),

  // Hydrate from saved state
  hydrateDisplayUnit: (saved = {}) => {
    if (saved.displayUnit) _set({ displayUnit: saved.displayUnit, unit: saved.displayUnit });
  },
  hydrate: (saved = {}) => {
    if (saved.displayUnit) _set({ displayUnit: saved.displayUnit, unit: saved.displayUnit });
  },

  /**
   * Format a P&L value based on active display unit.
   * @param {number} pnl - Raw P&L in dollars
   * @param {Object} opts - { accountSize, riskPerTrade }
   * @returns {string} Formatted string
   */
  formatPnl: (pnl, opts = {}) => {
    const { displayUnit } = get();
    const { accountSize = 0, riskPerTrade = 0 } = opts;

    switch (displayUnit) {
      case 'percent': {
        if (!accountSize || accountSize <= 0) return fmtDollar(pnl);
        const pct = (pnl / accountSize) * 100;
        return (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%';
      }
      case 'rmultiple': {
        if (!riskPerTrade || riskPerTrade <= 0) {
          if (!accountSize || accountSize <= 0) return fmtDollar(pnl);
          const fallbackRisk = accountSize * 0.01;
          const r = pnl / fallbackRisk;
          return (r >= 0 ? '+' : '') + r.toFixed(2) + 'R';
        }
        const r = pnl / riskPerTrade;
        return (r >= 0 ? '+' : '') + r.toFixed(2) + 'R';
      }
      case 'dollar':
      default:
        return fmtDollar(pnl);
    }
  },

  /**
   * Get the unit label for display.
   */
  getDisplayUnitLabel: () => {
    const { displayUnit } = get();
    switch (displayUnit) {
      case 'percent': return '%';
      case 'rmultiple': return 'R';
      default: return '$';
    }
  },
  // Backward compat alias
  getLabel: () => {
    const { displayUnit } = get();
    switch (displayUnit) {
      case 'percent': return '%';
      case 'rmultiple': return 'R';
      default: return '$';
    }
  },
});
