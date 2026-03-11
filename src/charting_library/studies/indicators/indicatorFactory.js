// ═══════════════════════════════════════════════════════════════════
// charEdge — Indicator Factory Functions
// Lookup, filtering, and instance creation for indicators.
//
// NOTE: INDICATORS is assembled HERE (not in registry.js) to avoid
// the circular dependency that previously caused React useState to
// be null at module-init time.
// ═══════════════════════════════════════════════════════════════════

import { ADVANCED_INDICATORS } from './advancedIndicators.js';
import { OVERLAY_INDICATORS } from './overlayIndicators.js';
import { PANE_INDICATORS } from './paneIndicators.js';

/** All built-in indicators */
export const INDICATORS = {
  ...OVERLAY_INDICATORS,
  ...PANE_INDICATORS,
  ...ADVANCED_INDICATORS,
};

/** Get an indicator definition by ID */
export function getIndicator(id) {
    return INDICATORS[id] || null;
}

/** Get all overlay indicators */
export function getOverlayIndicators() {
    return Object.values(INDICATORS).filter((i) => i.mode === 'overlay');
}

/** Get all pane indicators */
export function getPaneIndicators() {
    return Object.values(INDICATORS).filter((i) => i.mode === 'pane');
}

/** Get all indicator definitions as a list */
export function getAllIndicators() {
    return Object.values(INDICATORS);
}

/**
 * Create an active indicator instance from a definition.
 * @param {string} indicatorId
 * @param {Object} [paramOverrides]
 * @param {Object} [styleOverrides]
 * @returns {Object} Active indicator instance
 */
export function createIndicatorInstance(indicatorId, paramOverrides = {}, styleOverrides = {}) {
    const def = INDICATORS[indicatorId];
    if (!def) throw new Error(`Unknown indicator: ${indicatorId}`);

    // Build params from defaults + overrides, clamping to min/max bounds
    const params = {};
    for (const [key, config] of Object.entries(def.params)) {
        let val = paramOverrides[key] !== undefined ? paramOverrides[key] : config.default;
        if (typeof val === 'number' && config.min !== undefined) val = Math.max(config.min, val);
        if (typeof val === 'number' && config.max !== undefined) val = Math.min(config.max, val);
        params[key] = val;
    }

    // Build outputs with style overrides
    const outputs = def.outputs.map((o) => ({
        ...o,
        ...styleOverrides[o.key],
    }));

    return {
        id: `${indicatorId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        indicatorId,
        name: def.name,
        shortName: def.shortName,
        mode: def.mode,
        params,
        outputs,
        fills: def.fills,
        paneConfig: def.paneConfig,
        visible: true,
        computed: null, // Filled after compute()

        /** Compute indicator values from bar data */
        compute(bars) {
            this.computed = def.compute(bars, this.params);
            return this.computed;
        },

        /** Incrementally update indicator values on tick */
        update(bars) {
            if (!this.computed || !def.update) return this.compute(bars);

            const lastVals = def.update(bars, this.params, this.computed);
            const isNewBar = bars.length > Object.values(this.computed)[0].length;

            for (const [key, val] of Object.entries(lastVals)) {
                if (!this.computed[key]) continue;
                if (isNewBar) {
                    this.computed[key].push(val);
                } else {
                    this.computed[key][this.computed[key].length - 1] = val;
                }
            }
            return this.computed;
        },

        /** Get the parameter label string (e.g., "SMA(20)") */
        get label() {
            const paramStr = Object.values(this.params).join(', ');
            return paramStr ? `${def.shortName}(${paramStr})` : def.shortName;
        },
    };
}
