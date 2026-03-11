// ═══════════════════════════════════════════════════════════════════
// charEdge — Indicator Registry (Barrel)
//
// Re-exports INDICATORS + factory functions from indicatorFactory.js.
// This file is kept for backward compatibility — all consumers that
// import from './registry.js' continue to work unchanged.
// ═══════════════════════════════════════════════════════════════════

export {
  INDICATORS,
  getIndicator,
  getOverlayIndicators,
  getPaneIndicators,
  getAllIndicators,
  createIndicatorInstance,
} from './indicatorFactory.js';
