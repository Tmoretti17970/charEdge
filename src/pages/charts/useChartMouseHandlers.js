// ═══════════════════════════════════════════════════════════════════
// charEdge — Chart Mouse Handlers Hook
// Extracted from ChartsPage (Phase 0.1): mouse move, context menu,
// double-click handlers for the chart area.
// ═══════════════════════════════════════════════════════════════════

import { useCallback } from 'react';

/**
 * @param {Object} opts
 * @param {React.RefObject} opts.chartRef - ref to ChartCanvas
 * @param {Array} opts.data - OHLCV data
 * @param {boolean} opts.isMobile
 * @param {boolean} opts.multiMode
 * @param {boolean} opts.tradeMode
 * @param {Function} opts.setHoverInfo
 * @param {Function} opts.setRadialMenu
 * @param {Function} opts.setFocusMode
 * @param {Function} opts.handleContextMenu - from useChartDrawingHandler
 */
export default function useChartMouseHandlers({
  chartRef,
  data,
  isMobile,
  multiMode,
  tradeMode,
  setHoverInfo,
  setRadialMenu,
  _setFocusMode,
  handleContextMenu,
}) {
  const onMouseMove = useCallback(
    (e) => {
      if (isMobile || multiMode || !data?.length) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const w = rect.width - 60;
      const mouseY = e.clientY - rect.top;
      const chartState = chartRef.current;
      let barIdx = -1;
      if (chartState?.getLayout) {
        const layout = chartState.getLayout();
        if (layout?.barSpacing && layout.startIdx != null) {
          barIdx = layout.startIdx + Math.floor(x / layout.barSpacing);
          barIdx = Math.max(0, Math.min(barIdx, data.length - 1));
        }
      }
      if (barIdx < 0) {
        const frac = Math.max(0, Math.min(x / w, 1));
        barIdx = Math.round(frac * (data.length - 1));
      }
      setHoverInfo({ barIdx, mouseY });
    },
    [isMobile, multiMode, data, chartRef, setHoverInfo],
  );

  const onMouseLeave = useCallback(() => {
    setHoverInfo({ barIdx: -1, mouseY: 0 });
  }, [setHoverInfo]);

  const onDoubleClick = useCallback((_e) => {
    // Focus mode is now activated via the 'F' key or a toolbar button, not double-click.
    // Double-click on the chart is used for drawing interactions.
  }, []);

  const onChartContextMenu = useCallback(
    (e) => {
      if (isMobile || multiMode) return;
      e.preventDefault();
      e.stopPropagation();
      const rect = e.currentTarget.getBoundingClientRect();
      const mouseY = e.clientY - rect.top;
      const chartState = chartRef.current;
      let price = 0;

      // DEBUG: log all available paths
      console.log('[ContextMenu] mouseY:', mouseY, 'rect.height:', rect.height);
      console.log('[ContextMenu] chartState:', !!chartState);
      console.log('[ContextMenu] _lastPriceTransform:', chartState?._lastPriceTransform);
      console.log('[ContextMenu] lastRender:', chartState?.state?.lastRender ? { yMin: chartState.state.lastRender.yMin, yMax: chartState.state.lastRender.yMax, mainH: chartState.state.lastRender.mainH } : null);

      // Primary: use the engine's price transform for pixel-perfect conversion
      if (chartState?._lastPriceTransform?.yToPrice) {
        price = chartState._lastPriceTransform.yToPrice(mouseY);
        console.log('[ContextMenu] price from _lastPriceTransform:', price);
      }
      // Fallback: use lastRender yMin/yMax/mainH for manual computation
      if (!price && chartState?.state?.lastRender) {
        const R = chartState.state.lastRender;
        if (R.yMin != null && R.yMax != null && R.mainH) {
          price = R.yMin + ((R.mainH - mouseY) / R.mainH) * (R.yMax - R.yMin);
          console.log('[ContextMenu] price from lastRender fallback:', price);
        }
      }
      // Last resort: estimate from visible data range
      if (!price && data?.length) {
        const yFrac = mouseY / rect.height;
        const visibleSlice = data.slice(-Math.min(data.length, 200));
        const highs = visibleSlice.map((d) => d.high).filter(Boolean);
        const lows = visibleSlice.map((d) => d.low).filter(Boolean);
        if (highs.length && lows.length) {
          const yMax = Math.max(...highs);
          const yMin = Math.min(...lows);
          price = yMax - yFrac * (yMax - yMin);
          console.log('[ContextMenu] price from data fallback:', price);
        }
      }
      console.log('[ContextMenu] FINAL price:', price);
      if (!tradeMode) setRadialMenu({ x: e.clientX, y: e.clientY, price });
      else handleContextMenu(e, price, 0, null);
    },
    [isMobile, multiMode, chartRef, data, tradeMode, setRadialMenu, handleContextMenu],
  );

  return { onMouseMove, onMouseLeave, onDoubleClick, onChartContextMenu };
}
