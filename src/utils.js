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

export { uid, fmt, fmtD } from '@/shared/formatting';
export { fmtPrice, niceNum, niceScale, findNearestBar, bestTfForTrade, toHeikinAshi } from '@/charting_library/utils/chartMath';
export { todayStr, timeAgo } from '@/shared/time';
export { METRIC_TIPS } from '@/trading/metricTips';
