// ═══════════════════════════════════════════════════════════════
// charEdge — Indicator Helpers
// Bar-field extractors used by other indicator modules.
// ═══════════════════════════════════════════════════════════════

export interface Bar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

/** Extract close prices from bar array. */
export function closes(bars: Bar[]): number[] {
  return bars.map((b) => b.close);
}

export function highs(bars: Bar[]): number[] {
  return bars.map((b) => b.high);
}

export function lows(bars: Bar[]): number[] {
  return bars.map((b) => b.low);
}

export function volumes(bars: Bar[]): number[] {
  return bars.map((b) => b.volume || 0);
}
