// ═══════════════════════════════════════════════════════════════════
// charEdge — Bar Transform Stage (1.3.4)
//
// Render pipeline stage that applies chart-type-specific bar
// transforms (Renko, Range, Kagi, LineBreak, HeikinAshi, etc.)
// before the data reaches the rendering stages.
//
// Wraps the pure functions from barTransforms.js as a formal
// pipeline stage conforming to the StageTypes interface.
// ═══════════════════════════════════════════════════════════════════

import type { FrameStateData } from '../../../types/chart.js';
import type { StageContext, StageEngine } from './StageTypes.js';

import {
  toRenkoBricks,
  toRangeBars,
  toKagiBars,
  toLineBreakBars,
  toVolumeCandles,
  toHiLoBars,
} from '../barTransforms.js';

/**
 * Heikin-Ashi transform (inline — simple enough to not need barTransforms).
 * HA_Close = (O + H + L + C) / 4
 * HA_Open  = (prev_HA_Open + prev_HA_Close) / 2
 * HA_High  = max(H, HA_Open, HA_Close)
 * HA_Low   = min(L, HA_Open, HA_Close)
 */
function toHeikinAshi(bars: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  if (!bars || bars.length === 0) return [];

  const ha: Array<Record<string, unknown>> = [];

  for (let i = 0; i < bars.length; i++) {
    const b = bars[i] as { open: number; high: number; low: number; close: number; time: number; volume?: number };
    const haClose = (b.open + b.high + b.low + b.close) / 4;
    const haOpen = i === 0
      ? (b.open + b.close) / 2
      : ((ha[i - 1].open as number) + (ha[i - 1].close as number)) / 2;
    const haHigh = Math.max(b.high, haOpen, haClose);
    const haLow = Math.min(b.low, haOpen, haClose);

    ha.push({
      ...b,
      open: haOpen,
      high: haHigh,
      low: haLow,
      close: haClose,
      _originalClose: b.close,
    });
  }

  return ha;
}

/** Map of chart type → transform function. */
const TRANSFORM_MAP: Record<string, (bars: unknown[], ...args: unknown[]) => unknown> = {
  renko: (bars) => toRenkoBricks(bars as Array<Record<string, unknown>>).bricks,
  range: (bars) => toRangeBars(bars as Array<Record<string, unknown>>).rangeBars,
  kagi: (bars) => toKagiBars(bars as Array<Record<string, unknown>>).kagiSegments,
  linebreak: (bars) => toLineBreakBars(bars as Array<Record<string, unknown>>).lineBreakBars,
  volumecandle: (bars) => toVolumeCandles(bars as Array<Record<string, unknown>>),
  hilo: (bars) => toHiLoBars(bars as Array<Record<string, unknown>>),
  heikinashi: (bars) => toHeikinAshi(bars as Array<Record<string, unknown>>),
};

/** Chart types that pass through without transforms. */
const PASSTHROUGH_TYPES = new Set(['candlestick', 'line', 'area', 'hollow', 'footprint']);

/**
 * Bar Transform Stage — converts raw OHLCV bars into alternative
 * chart types before they reach the rendering stages.
 *
 * This stage reads engine.bars and the chartType from engine state,
 * then applies the appropriate transform. The transformed bars are
 * stored on engine._transformedBars for downstream stages to use.
 *
 * If the chart type has no transform (candlestick, line, area, etc.),
 * _transformedBars is set to null (indicating "use raw bars").
 */
export function executeBarTransformStage(
  fs: FrameStateData,
  _ctx: StageContext,
  engine: StageEngine,
): void {
  const chartType = (engine.state?.chartType as string) || 'candlestick';

  // Passthrough: no transform needed
  if (PASSTHROUGH_TYPES.has(chartType)) {
    (engine as Record<string, unknown>)._transformedBars = null;
    return;
  }

  const transform = TRANSFORM_MAP[chartType];
  if (!transform) {
    // Unknown chart type — passthrough
    (engine as Record<string, unknown>)._transformedBars = null;
    return;
  }

  const bars = engine.bars;
  if (!bars || bars.length === 0) {
    (engine as Record<string, unknown>)._transformedBars = [];
    return;
  }

  // Apply the transform and cache result
  (engine as Record<string, unknown>)._transformedBars = transform(bars);
}
