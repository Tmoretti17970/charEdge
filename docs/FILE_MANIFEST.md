# charEdge — File Manifest

**192 source files · 53,197 lines · Generated from live codebase**

---

## Summary

| Layer | Files | Lines |
|-------|------:|------:|
| `(root)/` | 8 | 1,458 |
| `api/` | 4 | 1,198 |
| `components/` | 64 | 19,671 |
| `components/analytics/` | 6 | 716 |
| `components/chart/` | 6 | 994 |
| `components/journal/` | 7 | 1,821 |
| `data/` | 13 | 4,111 |
| `data/adapters/` | 3 | 301 |
| `engine/` | 28 | 10,503 |
| `pages/` | 6 | 4,289 |
| `pages/public/` | 4 | 1,156 |
| `seo/` | 3 | 498 |
| `services/` | 3 | 557 |
| `state/` | 23 | 3,357 |
| `theme/` | 1 | 263 |
| `utils/` | 13 | 2,304 |
| **Total** | **192** | **53,197** |

---


## `(root)/` (8 files, 1,458 lines)

| File | Lines | Description |
|------|------:|-------------|
| App.jsx | 164 | charEdge v10.1 — Application Root |
| AppBoot.js | 271 | charEdge v10 — App Boot Sequence |
| constants.js | 176 | charEdge v10 — Constants & Theme |
| csv.js | 418 | charEdge v10 — CSV Import/Export |
| entry-server.jsx | 117 | charEdge v10 — SSR Entry Point |
| main.jsx | 16 |  |
| registerSW.js | 62 | charEdge — Service Worker Registration (Sprint 5.7) |
| utils.js | 234 | charEdge v10 — Utility Functions |

## `api/` (4 files, 1,198 lines)

| File | Lines | Description |
|------|------:|-------------|
| billingRoutes.js | 287 | charEdge v10 — Stripe Billing Routes (Sprint 5.6) |
| brokerOAuth.js | 350 | charEdge v10 — Broker OAuth Proxy (Sprint 5.3) |
| middleware.js | 208 | charEdge v10 — API Middleware |
| routes.js | 353 | charEdge v10 — API Routes |

## `components/` (64 files, 19,671 lines)

| File | Lines | Description |
|------|------:|-------------|
| AlertPanel.jsx | 332 | charEdge v10 — Alert Panel |
| BreakdownBarChart.jsx | 107 | charEdge v10 — Breakdown Bar Chart |
| CSVImportModal.jsx | 426 | charEdge v10 — CSV Import Modal |
| ChartCanvas.jsx | 539 | charEdge v10 — ChartCanvas |
| ChartInsightsPanel.jsx | 290 | charEdge v10.3 — Chart Insights Panel |
| ChartPane.jsx | 356 | charEdge v10 — ChartPane |
| ChartSettingsBar.jsx | 401 | charEdge v10 — Chart Settings Panel |
| ChartWrapper.jsx | 79 | charEdge v10 — Chart.js React Wrapper |
| CommandPalette.jsx | 357 | charEdge v10 — Command Palette (Ctrl+K) |
| ComparePanel.jsx | 462 | charEdge v10 — Compare & Goals Panel (Sprint 4.4 + 4.7) |
| DailyGuardBanner.jsx | 103 | charEdge v10 — Daily Guard Banner |
| DailyPnlChart.jsx | 106 | charEdge v10 — Daily P&L Bar Chart |
| DashboardWidgets.jsx | 627 | charEdge v10.4 — Dashboard Widgets |
| DrawingToolbar.jsx | 452 | charEdge v10 — Drawing Toolbar (TradingView-style) |
| EmptyState.jsx | 491 | charEdge — Empty State System (Redesign) |
| EquityCurveChart.jsx | 125 | charEdge v10 — Equity Curve Chart |
| ErrorBoundary.jsx | 167 | charEdge v10 — Error Boundary (Enhanced) |
| FundamentalsCard.jsx | 224 | charEdge v10 — Fundamentals Card |
| GestureGuide.jsx | 161 | charEdge v10.2 — Gesture Guide Overlay |
| IndicatorPanel.jsx | 391 | charEdge v10 — Indicator Panel |
| InsightsPanel.jsx | 569 | charEdge v10 — Insights Panel (Sprint 4) |
| KeyboardShortcuts.jsx | 216 | charEdge v10.1 — Keyboard Shortcuts Panel |
| Leaderboard.jsx | 201 | charEdge v10 — Leaderboard |
| LiveTicker.jsx | 153 | charEdge v10 — LiveTicker |
| MobileAnalytics.jsx | 392 | charEdge v10 — Mobile Analytics (Mobile Optimization) |
| MobileChartSheet.jsx | 288 | charEdge v10.2 — Mobile Chart Sheet |
| MobileDrawingSheet.jsx | 237 | charEdge v10.2 — Mobile Drawing Sheet |
| MobileJournal.jsx | 376 | charEdge v10 — Mobile Journal (Mobile Optimization) |
| MobileNav.jsx | 127 | charEdge — Mobile Navigation (Sprint 2: 5-Tab Bottom Bar) |
| MobileSettings.jsx | 908 | charEdge — Mobile Settings |
| MobileShareSheet.jsx | 222 | charEdge v10.2 — Mobile Share Sheet |
| NotificationPanel.jsx | 389 | charEdge v10 — Notification Panel |
| OnboardingWizard.jsx | 550 | charEdge v10 — Enhanced Onboarding Wizard |
| PageRouter.jsx | 76 | charEdge — Page Router (Sprint 2: 5-Page IA) |
| PlaybookDashboard.jsx | 380 | charEdge v10 — Playbook Dashboard |
| PlaybookManager.jsx | 221 | charEdge v10 — Playbook Manager |
| PropFirmWidget.jsx | 399 | charEdge v10 — Prop Firm Widget (Sprint 5) |
| QuadChart.jsx | 269 | charEdge v10 — Quad Chart View |
| RDistributionChart.jsx | 104 | charEdge v10 — R-Multiple Distribution Chart |
| ReplayBar.jsx | 413 | charEdge v10 — Replay Control Bar |
| RiskCalculator.jsx | 269 | charEdge v10 — Risk Calculator |
| ScriptEditor.jsx | 509 | charEdge v10 — Script Editor (Bottom Panel) |
| ScriptManager.jsx | 428 | charEdge v10 — Script Manager Panel |
| ShareSnapshotModal.jsx | 262 | charEdge v10 — Share Snapshot Modal |
| Sidebar.jsx | 300 | charEdge — Sidebar Navigation (Sprint 2: 5-Page IA) |
| SnapshotPublisher.jsx | 207 | charEdge v10.1 — Snapshot Publisher |
| SwipeChartNav.jsx | 186 | charEdge v10.2 — Swipe Chart Navigation |
| SymbolSearch.jsx | 245 | charEdge v10 — SymbolSearch |
| TemplateSelector.jsx | 282 | charEdge v10 — Template Selector |
| TimeBarChart.jsx | 111 | charEdge v10 — Time Bar Chart |
| Toast.jsx | 181 | charEdge v10 — Toast Notification System |
| Tooltip.jsx | 156 | charEdge v10 — Contextual Tooltip |
| TradeFormModal.jsx | 596 | charEdge v10 — Trade Form Modal |
| TradeHeatmap.jsx | 350 | charEdge v10 — TradeHeatmap |
| TradePlanManager.jsx | 429 | charEdge v10 — Trade Plans |
| UIKit.jsx | 362 | charEdge v10 — UIKit Design System |
| WatchlistPanel.jsx | 199 | charEdge v10 — Watchlist Panel |
| WidgetBoundary.jsx | 90 | charEdge — Widget Error Boundary |
| WidgetCustomizer.jsx | 233 | charEdge v10.4 — Widget Customizer Modal |
| WidgetGrid.jsx | 175 | charEdge v10.4 — Widget Grid System |
| WinRateDonut.jsx | 101 | charEdge v10 — Win Rate Donut Chart |
| WorkspaceLayout.jsx | 689 | charEdge v10 — WorkspaceLayout |
| WorkspaceLoader.jsx | 87 | charEdge v10 — Workspace Loader |
| useChartInteractions.js | 538 | charEdge v10 — Chart Interaction Hook |

## `components/analytics/` (6 files, 716 lines)

| File | Lines | Description |
|------|------:|-------------|
| AnalyticsPrimitives.jsx | 220 | charEdge v10 — Analytics Shared Primitives |
| OverviewTab.jsx | 106 | charEdge v10 — Analytics Overview Tab |
| PsychologyTab.jsx | 79 | charEdge v10 — Analytics Psychology Tab |
| RiskTab.jsx | 67 | charEdge v10 — Analytics Risk Tab |
| StrategiesTab.jsx | 143 | charEdge v10 — Analytics Strategies Tab |
| TimingTab.jsx | 101 | charEdge v10 — Analytics Timing Tab |

## `components/chart/` (6 files, 994 lines)

| File | Lines | Description |
|------|------:|-------------|
| ChartContextMenu.jsx | 128 | charEdge v10.6 — Chart Context Menu |
| ChartTradeToolbar.jsx | 87 | charEdge v10.6 — Chart Trade Toolbar |
| PositionSizer.jsx | 233 | charEdge v10.6 — Position Sizer Panel |
| QuickJournalPanel.jsx | 243 | charEdge v10.6 — Quick Journal Panel |
| TradeEntryBar.jsx | 177 | charEdge v10.6 — Trade Entry Bar |
| useChartTradeHandler.js | 126 | charEdge v10.6 — Chart Trade Handler Hook |

## `components/journal/` (7 files, 1,821 lines)

| File | Lines | Description |
|------|------:|-------------|
| BulkOperations.jsx | 212 | charEdge v10.5 — Bulk Operations Engine |
| ContextPerformanceTab.jsx | 268 | charEdge v10.5 — Context Performance Tab |
| JournalEvolution.jsx | 627 | charEdge v10.5 — Journal Evolution Components |
| JournalFilterBar.jsx | 160 | charEdge v10 — Journal Filter Bar |
| JournalQuickAdd.jsx | 131 | charEdge v10 — Journal Quick-Add Row (J1.1) |
| JournalTradeRow.jsx | 284 | charEdge v10.5 — Journal Trade Row (Sprint 9 update) |
| TradeReplay.js | 139 | charEdge v10.5 — Trade Replay Launcher |

## `data/` (13 files, 4,111 lines)

| File | Lines | Description |
|------|------:|-------------|
| DataManager.js | 170 | charEdge v10 — Data Manager (Arch Improvement #8) |
| DataProvider.js | 401 | charEdge v10 — DataProvider (Sprint 6) |
| FetchService.js | 295 | charEdge v10 — FetchService |
| FundamentalService.js | 149 | charEdge v10 — Fundamental Data Service |
| ImportExport.js | 686 | charEdge v10 — Import / Export Engine (Sprint 7) |
| SocialService.js | 207 | charEdge v10 — Social Service |
| StorageAdapter.js | 451 | charEdge v10 — StorageAdapter (Sprint 7) |
| StorageService.js | 530 | charEdge v10 — StorageService (MiniDB / IndexedDB) |
| SymbolRegistry.js | 223 | charEdge v10 — Symbol Registry (Arch Improvement #7) |
| WebSocketService.js | 366 | charEdge v10 — WebSocketService (Binance Spot) |
| demoData.js | 231 | charEdge v10 — Demo Data Generator |
| socialMockData.js | 270 | charEdge v10 — Social Mock Data |
| useWebSocket.js | 132 | charEdge v10 — useWebSocket Hook |

## `data/adapters/` (3 files, 301 lines)

| File | Lines | Description |
|------|------:|-------------|
| BaseAdapter.js | 71 | charEdge v10 — Base Data Adapter (Arch Improvement #8) |
| BinanceAdapter.js | 130 | charEdge v10 — Binance Adapter |
| YahooAdapter.js | 100 | charEdge v10 — Yahoo Finance Adapter |

## `engine/` (28 files, 10,503 lines)

| File | Lines | Description |
|------|------:|-------------|
| AnalyticsBridge.js | 191 | charEdge v10 — AnalyticsBridge |
| AnalyticsExport.js | 261 | charEdge v10 — Analytics Export (Sprint 4.5) |
| BrokerProfiles.js | 359 | charEdge v10 — Broker CSV Profiles |
| Calc.js | 652 | charEdge v10 — Indicator Calculation Engine |
| CanvasBuffer.js | 228 | charEdge v10 — CanvasBuffer (Offscreen Double-Buffering) |
| DailyDebrief.js | 231 | charEdge v10 — Daily Debrief Generator (Sprint 4.2) |
| FrameBudget.js | 380 | charEdge v10 — FrameBudget |
| LayoutCache.js | 120 | charEdge v10 — LayoutCache |
| Money.js | 303 | charEdge v10 — Financial Math Precision Module |
| PatternDetector.js | 535 | charEdge v10 — Behavioral Pattern Detector (Sprint 4.1) |
| PerformanceCompare.js | 248 | charEdge v10 — Performance Compare Engine (Sprint 4.4 + 4.6) |
| PriceActionEngine.js | 565 | charEdge v10.3 — Price Action Intelligence Engine |
| ReportGenerator.js | 167 | charEdge v10 — Analytics Report Generator (Sprint 8) |
| RiskPresets.js | 267 | charEdge v10 — Risk Presets |
| ScriptEngine.js | 318 | charEdge v10 — Script Engine |
| SubPaneManager.js | 273 | charEdge v10 — SubPaneManager (Sprint 8) |
| TradeSchema.js | 243 | charEdge v10 — Trade Schema (Sprint 7) |
| analytics.worker.js | 43 | charEdge v10 — Analytics Web Worker |
| analyticsFast.js | 712 | charEdge v10 — Single-Pass Analytics Engine (Phase 4) |
| analyticsSingleton.js | 209 | charEdge v10 — Analytics Singleton |
| chartRenderer.js | 1614 | charEdge v10 — Chart Renderer |
| compInd.js | 28 |  |
| drawingTools.js | 1190 | charEdge v10 — Drawing Tools Renderer (TradingView-style) |
| generateOHLCV.js | 135 | charEdge v10 — OHLCV Demo Data Generator |
| orderFlow.js | 112 | charEdge v10 — Order Flow / Volume Profile |
| reconcile.js | 428 | charEdge v10 — Trade Reconciliation Engine |
| scriptLibrary.js | 591 | charEdge v10 — Built-in Script Library |
| useScriptRunner.js | 100 | charEdge v10 — Script Runner Hook |

## `pages/` (6 files, 4,289 lines)

| File | Lines | Description |
|------|------:|-------------|
| ChartsPage.jsx | 1104 | charEdge — Charts Page (Sprint 4: Progressive Disclosure) |
| DashboardPage.jsx | 641 | charEdge — Dashboard Page (Sprint 3: Narrative Redesign) |
| InsightsPage.jsx | 268 | charEdge — Insights Page (Redesign) |
| JournalPage.jsx | 784 | charEdge — Journal Page (Redesign) |
| NotesPage.jsx | 467 | charEdge — Notes Page (Redesign) |
| SettingsPage.jsx | 1025 | charEdge — Settings Page (Redesign) |

## `pages/public/` (4 files, 1,156 lines)

| File | Lines | Description |
|------|------:|-------------|
| PublicLeaderboardPage.jsx | 263 | charEdge v10 — Public Leaderboard Page |
| PublicProfilePage.jsx | 287 | charEdge v10 — Public Profile Page (Sprint 8) |
| PublicSnapshotPage.jsx | 327 | charEdge v10 — Public Snapshot Page |
| PublicSymbolPage.jsx | 279 | charEdge v10 — Public Symbol Page |

## `seo/` (3 files, 498 lines)

| File | Lines | Description |
|------|------:|-------------|
| meta.js | 256 | charEdge v10 — SEO Meta System |
| routes.js | 169 | charEdge v10 — Public Route Definitions |
| sitemap.js | 73 | charEdge v10 — Sitemap Generator |

## `services/` (3 files, 557 lines)

| File | Lines | Description |
|------|------:|-------------|
| AuthService.js | 192 | charEdge v10 — Auth Service (Sprint 5.1) |
| BrokerSync.js | 291 | charEdge v10 — Broker Sync Service (Sprint 5.4) |
| SyncUtils.js | 74 | charEdge v10 — Sync Utilities (Sprint 5.2) |

## `state/` (23 files, 3,357 lines)

| File | Lines | Description |
|------|------:|-------------|
| useAlertStore.js | 253 | charEdge v10 — Alert Store |
| useAnalyticsStore.js | 49 | charEdge v10 — Analytics Result Store (Zustand) |
| useAuthStore.js | 140 | charEdge v10 — Auth Store (Sprint 5.1) |
| useChartStore.js | 152 | charEdge v10 — Chart Store (Zustand) |
| useChartTradeStore.js | 174 | charEdge v10.6 — Chart Trade Store |
| useChecklistStore.js | 126 | charEdge v10 — Pre-Trade Checklist Store (Sprint 4.3) |
| useDailyGuardStore.js | 196 | charEdge v10 — Daily Loss Guard |
| useDashboardStore.js | 67 | charEdge v10.4 — Dashboard Layout Store |
| useGoalStore.js | 179 | charEdge v10 — Goal Tracking Store (Sprint 4.7) |
| useNotificationLog.js | 100 | charEdge v10 — NotificationLog |
| useOnboardingStore.js | 48 | charEdge v10 — Onboarding Store (Zustand) |
| usePropFirmStore.js | 390 | charEdge v10 — Prop Firm Store (Sprint 5) |
| useScriptStore.js | 156 | charEdge v10 — Script Store (Zustand) |
| useSettingsStore.js | 22 | charEdge v10 — Settings Store (Zustand) |
| useSocialStore.js | 167 | charEdge v10 — Social Store (Zustand) |
| useSyncStore.js | 219 | charEdge v10 — Sync Service (Sprint 5.2) |
| useTemplateStore.js | 172 | charEdge v10 — Chart Template Store |
| useThemeStore.js | 58 | charEdge v10 — Theme Store |
| useTradeStore.js | 84 | charEdge v10 — Trade Store (Zustand) |
| useTradeTemplateStore.js | 78 | charEdge v10.5 — Trade Entry Templates |
| useUIStore.js | 42 | charEdge v10 — UI Store (Zustand) |
| useWatchlistStore.js | 198 | charEdge v10 — Watchlist Store |
| useWorkspaceStore.js | 287 | charEdge v10 — Workspace Manager |

## `theme/` (1 files, 263 lines)

| File | Lines | Description |
|------|------:|-------------|
| tokens.js | 263 | charEdge v10 — Design Tokens |

## `utils/` (13 files, 2,304 lines)

| File | Lines | Description |
|------|------:|-------------|
| CrosshairBus.js | 101 | charEdge v10.1 — CrosshairBus |
| RetryQueue.js | 170 | charEdge v10 — RetryQueue |
| UndoStack.js | 297 | charEdge v10 — UndoStack |
| VirtualList.jsx | 185 | charEdge v10 — VirtualList |
| chartExport.js | 317 | charEdge v10 — Chart Export & Sharing |
| globalErrorHandler.js | 238 | charEdge — Global Error Handler |
| groupTradesBy.js | 168 | charEdge v10 — groupTradesBy |
| navigateToTrade.js | 234 | charEdge v10 — navigateToTrade |
| safeJSON.js | 66 | charEdge — SafeJSON |
| safePersist.js | 158 | charEdge — Safe Persist Middleware |
| shallow.js | 17 | charEdge — Shallow equality for Zustand selectors |
| useHotkeys.js | 282 | charEdge v10 — useHotkeys |
| useMediaQuery.js | 71 | charEdge v10 — useMediaQuery Hook |
