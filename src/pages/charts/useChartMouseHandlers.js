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
  chartRef, data, isMobile, multiMode, tradeMode,
  setHoverInfo, setRadialMenu, setFocusMode, handleContextMenu,
}) {
  const onMouseMove = useCallback((e) => {
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
  }, [isMobile, multiMode, data, chartRef, setHoverInfo]);

  const onMouseLeave = useCallback(() => {
    setHoverInfo({ barIdx: -1, mouseY: 0 });
  }, [setHoverInfo]);

  const onDoubleClick = useCallback((e) => {
    // Focus mode is now activated via the 'F' key or a toolbar button, not double-click.
    // Double-click on the chart is used for drawing interactions.
  }, []);

  const onChartContextMenu = useCallback((e) => {
    if (isMobile || multiMode) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const yFrac = (e.clientY - rect.top) / rect.height;
    const chartState = chartRef.current;
    let price = 0;
    if (chartState?.getLayout) {
      const layout = chartState.getLayout();
      if (layout) price = layout.yMax - yFrac * (layout.yMax - layout.yMin);
    }
    if (!tradeMode) setRadialMenu({ x: e.clientX, y: e.clientY, price });
    else handleContextMenu(e, price, 0, null);
  }, [isMobile, multiMode, chartRef, tradeMode, setRadialMenu, handleContextMenu]);

  return { onMouseMove, onMouseLeave, onDoubleClick, onChartContextMenu };
}
