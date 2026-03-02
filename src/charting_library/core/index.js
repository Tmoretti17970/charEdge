// ═══════════════════════════════════════════════════════════════════
// charEdge — Chart Engine
// Public API surface
// ═══════════════════════════════════════════════════════════════════

// Core engine
export { createChartEngine } from './ChartEngine.js';

// React wrapper (planned — not yet created in charting_library/core)
// export { default as ChartWidget } from './ChartWidget.jsx';

// Coordinate system (for drawing tools, indicators, custom renderers)
export {
  mediaToBitmap,
  bitmapToMedia,
  mediaWidthToBitmap,
  positionsLine,
  positionsBox,
  createPriceTransform,
  createTimeTransform,
  candleWidthCoefficient,
  candleBodyWidth,
  candleWickWidth,
  visiblePriceRange,
  niceScale,
  formatPrice,
  formatTimeLabel,
} from './CoordinateSystem.js';

// Canvas management
export { createFancyCanvas } from '../renderers/FancyCanvas.js';

// Pane widget
export { createPaneWidget } from '../model/PaneWidget.js';

// Renderers
export {
  createCandlestickRenderer,
  createLineRenderer,
  toHeikinAshi,
  DEFAULT_CANDLE_THEME,
} from '../renderers/renderers/CandlestickRenderer.js';

export {
  createGridRenderer,
  createCrosshairRenderer,
  drawPriceLabel,
  drawOHLCVLegend,
} from '../renderers/renderers/GridCrosshair.js';

// Data feeds
export { RESOLUTION_MS, normalizeResolution } from '../datafeed/feeds/DataFeed.js';
export { createBinanceFeed } from '../datafeed/feeds/BinanceFeed.js';
export { createDataManager } from '../datafeed/feeds/DataManager.js';
export { createLRUCache, CACHE_TTL, getTTLForResolution } from '../datafeed/feeds/LRUCache.js';
// Data feed hook (planned — not yet created in charting_library/core)
// export { useChartData } from './feeds/useChartData.js';

// Multi-pane layout
export { createPaneLayout, DEFAULT_PANE_CONFIGS } from '../model/PaneLayout.js';

// Theme system
export { createThemeManager, DARK_THEME, LIGHT_THEME } from './ThemeManager.js';

// Chart types
export {
  CHART_TYPES,
  getChartDrawFunction,
  getChartTypeList,
  drawCandlesticks,
  drawHollowCandles,
  drawHeikinAshi,
  drawOHLCBars,
  drawLineChart,
  drawAreaChart,
  drawBaselineChart,
} from '../renderers/renderers/ChartTypes.js';

// Volume pane
export { createVolumePaneRenderer } from '../renderers/renderers/VolumePaneRenderer.js';

// Drawing tools
export {
  createDrawing,
  generateId,
  DEFAULT_STYLES,
  FIB_LEVELS,
  FIB_COLORS,
  TOOL_POINT_COUNT,
  serializeDrawings,
  deserializeDrawings,
} from '../tools/tools/DrawingModel.js';
export { createDrawingEngine } from '../tools/tools/DrawingEngine.js';
export { createDrawingRenderer } from '../tools/tools/DrawingRenderer.js';

// Indicators
export * as IndicatorMath from '../studies/indicators/computations.js';
export {
  INDICATORS,
  getIndicator,
  getOverlayIndicators,
  getPaneIndicators,
  getAllIndicators,
  createIndicatorInstance,
} from '../studies/indicators/registry.js';
export { renderOverlayIndicator, renderPaneIndicator } from '../studies/indicators/renderer.js';

// UI components (planned — not yet created in charting_library/core)
// export { default as SymbolSearch } from './ui/SymbolSearch.jsx';
// export { default as TimeframeSwitcher } from './ui/TimeframeSwitcher.jsx';
// export { default as ConnectionStatus } from './ui/ConnectionStatus.jsx';
// export { default as DrawingToolbar } from './ui/DrawingToolbar.jsx';
