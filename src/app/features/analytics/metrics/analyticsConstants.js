// ═══════════════════════════════════════════════════════════════════
// Shared analytics constants and utilities
// ═══════════════════════════════════════════════════════════════════

import { SCALE } from '../../../../charting_library/model/Money.js';

export const FIAT = SCALE.FIAT; // 100 — used for integer accumulation
export const toC = (v) => Math.round((v || 0) * FIAT); // float → cents
export const fromC = (c) => c / FIAT; // cents → float

export const MIN_SAMPLES = {
    kelly: 10,
    sharpe: 20,
    sortino: 20,
    monteCarlo: 30,
    correlation: 10,
};
