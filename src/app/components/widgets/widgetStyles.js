// ═══════════════════════════════════════════════════════════════════
// charEdge — Widget Shared Styles
//
// Sprint 9 #68: Extracted from DashboardWidgets.jsx.
// Common style factories shared across all dashboard widget components.
// ═══════════════════════════════════════════════════════════════════

import { C, F, M } from '../../../constants.js';

/**
 * Widget header style.
 * @returns {object} CSS style object
 */
export const hdr = (_label, _icon) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 11,
    fontWeight: 700,
    color: C.t1,
    fontFamily: F,
    marginBottom: 10,
    padding: '12px 14px 0',
});

/** Metric row layout (label + value, space-between). */
export const metricRow = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '5px 14px',
    fontSize: 11,
};

/** Metric label style. */
export function getMetricLabel() { return { color: C.t2, fontFamily: F }; }

/** Metric value style. */
export function getMetricValue(color) { return { fontFamily: M, fontWeight: 700, color: color || C.t1 }; }
