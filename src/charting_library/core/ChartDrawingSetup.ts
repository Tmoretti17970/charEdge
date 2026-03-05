// ═══════════════════════════════════════════════════════════════════
// charEdge — ChartDrawingSetup
//
// Factory function that creates the drawing engine with magnetSnap,
// onChange, and onStateChange callbacks wired to the ChartEngine.
// Extracted to reduce ChartEngine.ts constructor complexity.
// ═══════════════════════════════════════════════════════════════════

import { createDrawingEngine } from '../tools/tools/DrawingEngine.js';
import { LAYERS } from './LayerManager.js';
import { createDrawingRenderer } from '../tools/tools/DrawingRenderer.js';
import { debouncedSave } from '../tools/DrawingPersistence.js';

import type { Bar } from '../../types/chart.js';

/** Minimal interface for the engine properties the setup needs. */
// Extended engine ref to include layers for dirty marking
interface LayersRef {
  markDirty(layer: string): void;
}
interface EngineRef {
  bars: Bar[];
  layers: LayersRef;
  props: { magnetMode?: boolean;[key: string]: unknown };
  state: {
    lastRender: { vis?: Bar[] } | null;
    mainDirty: boolean;
    topDirty: boolean;
    [key: string]: unknown;
  };
  symbol: string;
  timeframe: string;
  callbacks: {
    onDrawingsChange?: (drawings: unknown[]) => void;
    onDrawingStateChange?: (state: unknown) => void;
  };
  _scheduleDraw(): void;
}

/**
 * Create a configured drawing engine with magnetSnap, onChange, and
 * onStateChange callbacks that reference the engine instance.
 *
 * @returns {{ drawingEngine, drawingRenderer }} — the engine and renderer pair
 */
export function createChartDrawingSetup(engine: EngineRef) {
  const drawingEngine = createDrawingEngine({
    // @ts-expect-error — DrawingEngine options not yet typed
    magnetSnap: (price: number, time: number) => {
      if (!engine.props.magnetMode) return { price, time };
      if (!engine.bars || !engine.bars.length) return { price, time };

      let targetBar: Bar | null = null;
      const vis = (engine.state.lastRender as any)?.vis;
      if (vis && vis.length > 0) {
        let minTimeDiff = Infinity;
        for (const b of vis) {
          const diff = Math.abs(b.time - time);
          if (diff < minTimeDiff) { minTimeDiff = diff; targetBar = b; }
        }
      } else {
        targetBar = engine.bars.find((b: Bar) => b.time === time) || null;
      }

      if (!targetBar) return { price, time };

      // Enhanced: track which OHLC level is closest for label display
      const ohlcPoints = [
        { p: targetBar.open, label: 'Open' },
        { p: targetBar.high, label: 'High' },
        { p: targetBar.low, label: 'Low' },
        { p: targetBar.close, label: 'Close' },
      ];
      let closest = price;
      let closestLabel = 'OHLC';
      let minDist = Infinity;
      for (const { p, label } of ohlcPoints) {
        const dist = Math.abs(p - price);
        if (dist < minDist) { minDist = dist; closest = p; closestLabel = label; }
      }

      const relThreshold = Math.abs(price) * 0.005;
      if (minDist <= relThreshold) {
        return { price: closest, time: targetBar.time, label: closestLabel };
      }
      return { price, time: targetBar.time };
    },
    onChange: (drawings: unknown[]) => {
      engine.state.mainDirty = true;
      engine.state.topDirty = true;
      if (engine.layers) engine.layers.markDirty(LAYERS.DRAWINGS);
      engine._scheduleDraw();
      if (engine.callbacks.onDrawingsChange) engine.callbacks.onDrawingsChange(drawings);
      // Sprint 13.1: Auto-save drawings to IndexedDB
      if (engine.symbol) {
        debouncedSave(engine.symbol, engine.timeframe, drawings);
      }
    },
    onStateChange: (state: unknown) => {
      engine.state.topDirty = true;
      if (engine.layers) engine.layers.markDirty(LAYERS.DRAWINGS);
      engine._scheduleDraw();
      if (engine.callbacks.onDrawingStateChange) engine.callbacks.onDrawingStateChange(state);
    },
  });

  const drawingRenderer = createDrawingRenderer(drawingEngine);

  return { drawingEngine, drawingRenderer };
}
