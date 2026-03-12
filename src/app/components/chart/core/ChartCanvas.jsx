// ═══════════════════════════════════════════════════════════════════
// charEdge v11 — ChartCanvas.jsx (Backward Compatibility Wrapper)
// Wraps ChartEngineWidget to maintain the old ChartCanvas prop interface.
// All rendering is now handled by the Sprint 1-5 chart engine.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useChartFeaturesStore } from '../../../../state/chart/useChartFeaturesStore';
import ChartEngineWidget from './ChartEngineWidget.jsx';

/**
 * ChartCanvas — Backward-compatible wrapper.
 *
 * The old ChartCanvas accepted data, layout, and drawing state as props.
 * The new ChartEngineWidget manages all of this internally via stores.
 * This wrapper bridges the two interfaces.
 *
 * @param {Object} props - All original ChartCanvas props are accepted but most
 *                         are now handled internally by ChartEngineWidget.
 */
const ChartCanvas = React.forwardRef(function ChartCanvas(
  {
    // Old props (accepted but delegated to engine)
    data,
    _startIdx,
    _endIdx,
    _chartW,
    _chartH,
    _indicators,
    _drawings,
    _pendingDrawing,
    _activeTool,
    _trades,
    _chartType,
    _candleMode,
    _logScale,
    _selectedDrawingId,
    _intelligence,
    _comparisonData,
    _comparisonSymbol,
    _replayMode,
    _replayIdx,
    _showVolumeProfile,
    _magnetMode,
    _orderFlow,
    _multiTfOverlay,
    _onViewportChange,
    _onDrawingComplete,
    _onDrawingSelect,
    canvasRef: externalCanvasRef,
    _scripts,
    // New/pass-through props
    ...rest
  },
  ref,
) {
  // If data is passed directly (from ChartsPage), sync to store
  React.useEffect(() => {
    if (data?.length) {
      const store = useChartFeaturesStore.getState();
      if (!store.data || store.data.length !== data.length) {
        setTimeout(() => store.setData(data, 'legacy'), 0);
      }
    }
  }, [data]);

  return (
    <ChartEngineWidget
      height="100%"
      width="100%"
      showVolume={true}
      onBarClick={rest.onBarClick}
      onCrosshairMove={rest.onCrosshairMove}
      onEngineReady={(eng) => {
        // Expose canvas ref for chart export
        if (externalCanvasRef) {
          externalCanvasRef.current = eng?.getCanvas?.() || null;
        }
        if (ref) {
          if (typeof ref === 'function') ref(eng);
          else ref.current = eng;
        }
        if (rest.onEngineReady) rest.onEngineReady(eng);
      }}
      {...rest}
    />
  );
});

export default ChartCanvas;

// Re-export the new widget for direct usage
export { default as ChartEngineWidget } from './ChartEngineWidget.jsx';
