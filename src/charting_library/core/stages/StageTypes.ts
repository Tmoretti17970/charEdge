// ═══════════════════════════════════════════════════════════════════
// charEdge — Render Stage Types
//
// Shared type definitions for all pipeline render stages.
// Each stage receives the same (fs, ctx, engine) triple.
// ═══════════════════════════════════════════════════════════════════

import type { FrameStateData, Theme } from '../../../types/chart.js';

/** Render contexts passed to each stage. */
export interface StageContext {
  /** Per-layer 2D contexts */
  layers: {
    isDirty(layer: number): boolean;
    clearDirty(layer: number): void;
    markDirty(layer: number): void;
    getCanvas(layer: number): HTMLCanvasElement;
    getCtx(layer: number): CanvasRenderingContext2D;
  };
  /** Resolved theme colors */
  theme: Theme;
  /** Grid layer context */
  gridCtx: CanvasRenderingContext2D;
  /** Main data layer context */
  mainCtx: CanvasRenderingContext2D;
  /** Top/UI layer context */
  topCtx: CanvasRenderingContext2D;
  /** Indicator layer context */
  indicatorCtx: CanvasRenderingContext2D;
  /** Drawing layer context */
  drawingCtx: CanvasRenderingContext2D;
  /** WebGL renderer (may be null) */
  webgl: {
    available: boolean;
    drawGrid?: (...args: unknown[]) => void;
    drawCandles?: (...args: unknown[]) => void;
    drawVolume?: (...args: unknown[]) => void;
    drawLine?: (...args: unknown[]) => void;
    drawArea?: (...args: unknown[]) => void;
    drawAALine?: (...args: unknown[]) => void;
    drawSDFText?: (...args: unknown[]) => void;
    measureSDFText?: (...args: unknown[]) => number;
    drawIndicatorLines?: (...args: unknown[]) => void;
    drawFibFill?: (...args: unknown[]) => void;
    drawVolumeProfile?: (...args: unknown[]) => void;
    drawHeatmap?: (...args: unknown[]) => void;
    getProgram?: (name: string) => unknown;
    [key: string]: unknown;
  } | null;
  /** GPU command buffer for deferred draw calls */
  commandBuffer: Array<{
    program: unknown;
    blendMode: number;
    texture: unknown;
    zOrder: number;
    label: string;
    drawFn: () => void;
  }> | null;
  /** Top canvas element ref */
  topCanvas: HTMLCanvasElement;
  /** Main canvas element ref */
  mainCanvas: HTMLCanvasElement;
  [key: string]: unknown;
}

/** Minimal ChartEngine interface used by stages (avoids circular import). */
export interface StageEngine {
  state: Record<string, unknown>;
  bars: Array<Record<string, unknown>>;
  props: Record<string, unknown>;
  indicators: unknown[];
  alerts: unknown[];
  symbol: string;
  timeframe: string;
  drawingEngine: unknown;
  drawingRenderer: unknown;
  syncedCrosshair: unknown;
  _webglRenderer: unknown;
  _sceneGraph: unknown;
  _lastNiceStep: unknown;
  _lastDisplayTicks: unknown;
  _lastPriceTransform: unknown;
  _lastTimeTransform: unknown;
  _loadTimestamp: number | null;
  _tickUpdate: boolean;
  _barBuffer: unknown;
  _gpuCompute: unknown;
  callbacks: Record<string, unknown>;
  renderTradeMarkers: (...args: unknown[]) => void;
  [key: string]: unknown;
}

/**
 * A render stage executor function.
 * All stages follow this same signature.
 */
export type StageExecutor = (
  fs: FrameStateData,
  ctx: StageContext,
  engine: StageEngine,
) => void;
