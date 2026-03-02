// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — Utility Functions (Re-export Barrel)
//
// This file now re-exports from focused modules in src/utils/.
// All existing consumer imports continue to work with zero changes.
//
// The focused modules are:
//   utils/formatting.js  — uid, fmt, fmtD
//   utils/chartMath.js   — fmtPrice, niceNum, niceScale, findNearestBar,
//                          bestTfForTrade, toHeikinAshi
//   utils/time.js        — todayStr, timeAgo
//   utils/metricTips.js  — METRIC_TIPS
// ═══════════════════════════════════════════════════════════════════

export { uid, fmt, fmtD } from './utils/formatting.js';
export { fmtPrice, niceNum, niceScale, findNearestBar, bestTfForTrade, toHeikinAshi } from './utils/chartMath.js';
export { todayStr, timeAgo } from './utils/time.js';
export { METRIC_TIPS } from './utils/metricTips.js';
