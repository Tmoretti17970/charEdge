export const createFeaturesSlice = (set) => ({
  // Replay
  replayMode: false,
  replayIdx: 0,
  replayPlaying: false,
  backtestTrades: [],

  toggleReplay: () => set((s) => ({ replayMode: !s.replayMode, replayIdx: 0, replayPlaying: false })),
  setReplayIdx: (idx) => set({ replayIdx: idx }),
  setReplayPlaying: (v) => set({ replayPlaying: v }),
  addBacktestTrade: (t) => set((s) => ({ backtestTrades: [...s.backtestTrades, t] })),
  clearBacktestTrades: () => set({ backtestTrades: [] }),

  // Comparison
  comparisonSymbol: null,
  comparisonData: null,

  setComparison: (symbol, data) => set({ comparisonSymbol: symbol, comparisonData: data }),
  clearComparison: () => set({ comparisonSymbol: null, comparisonData: null }),

  // Intelligence (all off by default — user must opt in)
  intelligence: {
    enabled: false,
    showSR: false,
    showPatterns: false,
    showDivergences: false,
    showAutoFib: false,
  },

  // Heatmap
  showHeatmap: false,
  heatmapIntensity: 1.0,
  toggleHeatmap: () => set((s) => ({ showHeatmap: !s.showHeatmap })),
  setHeatmapIntensity: (val) => set({ heatmapIntensity: val }),

  // Session Dividers
  showSessions: false,
  toggleSessions: () => set((s) => ({ showSessions: !s.showSessions })),

  // Multi-Timeframe Panel
  showMTF: false,
  mtfTimeframes: ['15m', '1h', '4h'],
  toggleMTF: () => set((s) => ({ showMTF: !s.showMTF })),
  setMTFTimeframes: (tfs) => set({ mtfTimeframes: tfs }),

  // DOM (Depth of Market) Ladder
  showDOM: false,
  toggleDOM: () => set((s) => ({ showDOM: !s.showDOM })),

  // Minimap Navigator
  showMinimap: true,
  toggleMinimap: () => set((s) => ({ showMinimap: !s.showMinimap })),

  // Status Bar
  showStatusBar: true,
  toggleStatusBar: () => set((s) => ({ showStatusBar: !s.showStatusBar })),

  // Depth Chart (Webull-style)
  showDepthChart: false,
  toggleDepthChart: () => set((s) => ({ showDepthChart: !s.showDepthChart })),

  // Extended Hours / Pre-Market / After-Hours
  showExtendedHours: false,
  toggleExtendedHours: () => set((s) => ({ showExtendedHours: !s.showExtendedHours })),

  // Comparison Overlay
  showComparisonOverlay: false,
  toggleComparisonOverlay: () => set((s) => ({ showComparisonOverlay: !s.showComparisonOverlay })),

  // Custom Timeframe Input
  showCustomTf: false,
  toggleCustomTf: () => set((s) => ({ showCustomTf: !s.showCustomTf })),

  // Drawing Favorites (pinned tool IDs)
  drawingFavorites: ['trendline', 'hline', 'fib', 'rect'],
  addDrawingFavorite: (toolId) => set((s) => ({
    drawingFavorites: s.drawingFavorites.includes(toolId) ? s.drawingFavorites : [...s.drawingFavorites, toolId]
  })),
  removeDrawingFavorite: (toolId) => set((s) => ({
    drawingFavorites: s.drawingFavorites.filter((id) => id !== toolId)
  })),

  // Pattern Overlay Visibility
  showPatternOverlays: false,
  togglePatternOverlays: () => set((s) => ({ showPatternOverlays: !s.showPatternOverlays })),

  // Volume Spike Detection
  showVolumeSpikes: false,
  volumeSpikeMultiplier: 2,
  toggleVolumeSpikes: () => set((s) => ({ showVolumeSpikes: !s.showVolumeSpikes })),
  setVolumeSpikeMultiplier: (val) => set({ volumeSpikeMultiplier: val }),

  // Order Flow Overlays (rendered on chart canvas via ChartEngine)
  showDeltaOverlay: false,
  toggleDeltaOverlay: () => set((s) => ({ showDeltaOverlay: !s.showDeltaOverlay })),
  showVPOverlay: false,
  toggleVPOverlay: () => set((s) => ({ showVPOverlay: !s.showVPOverlay })),
  showOIOverlay: false,
  toggleOIOverlay: () => set((s) => ({ showOIOverlay: !s.showOIOverlay })),
  showLargeTradesOverlay: false,
  toggleLargeTradesOverlay: () => set((s) => ({ showLargeTradesOverlay: !s.showLargeTradesOverlay })),

  // Arbitrage Spread Overlay (Phase 6)
  showArbitrageSpread: false,
  toggleArbitrageSpread: () => set((s) => ({ showArbitrageSpread: !s.showArbitrageSpread })),

  // Resizable Indicator Pane Heights (maps pane index to fraction of available height)
  paneHeights: {},
  setPaneHeight: (paneIdx, fraction) => set((s) => ({
    paneHeights: { ...s.paneHeights, [paneIdx]: Math.max(0.08, Math.min(0.5, fraction)) }
  })),
  resetPaneHeights: () => set({ paneHeights: {} }),

  // Scale Mode: 'auto' | 'log' | 'pct' | 'inverted'
  scaleMode: 'auto',
  setScaleMode: (mode) => set({ scaleMode: mode }),

  // Chart Appearance
  chartAppearance: {
    upColor: '#26A69A',
    downColor: '#EF5350',
    upWickColor: '#26A69A',
    downWickColor: '#EF5350',
    bodyStyle: 'filled', // 'filled' | 'hollow'
    gridVisible: true,
    gridOpacity: 0.3,
    crosshairStyle: 'cross', // 'cross' | 'dot' | 'line'
  },
  setChartAppearance: (key, val) =>
    set((s) => ({ chartAppearance: { ...s.chartAppearance, [key]: val } })),
  resetChartAppearance: () =>
    set({
      chartAppearance: {
        upColor: '#26A69A',
        downColor: '#EF5350',
        upWickColor: '#26A69A',
        downWickColor: '#EF5350',
        bodyStyle: 'filled',
        gridVisible: true,
        gridOpacity: 0.3,
        crosshairStyle: 'cross',
      },
    }),

  // Phase 4: Preset Themes
  chartPresets: {
    default: { upColor: '#26A69A', downColor: '#EF5350', upWickColor: '#26A69A', downWickColor: '#EF5350', gridOpacity: 0.3 },
    midnight: { upColor: '#5C6BC0', downColor: '#EC407A', upWickColor: '#7986CB', downWickColor: '#F06292', gridOpacity: 0.15 },
    ocean: { upColor: '#00BCD4', downColor: '#FF7043', upWickColor: '#26C6DA', downWickColor: '#FF8A65', gridOpacity: 0.2 },
    terminal: { upColor: '#00E676', downColor: '#FF1744', upWickColor: '#69F0AE', downWickColor: '#FF5252', gridOpacity: 0.35 },
    monochrome: { upColor: '#B0BEC5', downColor: '#546E7A', upWickColor: '#CFD8DC', downWickColor: '#78909C', gridOpacity: 0.25 },
  },
  activePreset: 'default',
  applyChartPreset: (presetId) => set((s) => {
    const p = s.chartPresets[presetId];
    if (!p) return {};
    return {
      activePreset: presetId,
      chartAppearance: { ...s.chartAppearance, ...p },
    };
  }),

  setIntelligence: (key, val) => set((s) => ({ intelligence: { ...s.intelligence, [key]: val } })),
  toggleIntelligence: (key) => set((s) => ({ intelligence: { ...s.intelligence, [key]: !s.intelligence[key] } })),
  toggleIntelligenceMaster: () =>
    set((s) => ({ intelligence: { ...s.intelligence, enabled: !s.intelligence.enabled } })),
});
