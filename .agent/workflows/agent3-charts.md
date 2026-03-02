---
description: Charts Progressive Disclosure — lazy imports, toolbar consolidation, slide-in panels, chart skeleton
---

# Agent 3: Charts Progressive Disclosure

// turbo-all

## Overview
Implement Sprint 4 of the Design Overhaul from `DESIGN_OVERHAUL_SPRINTS.md`. Tame the 57-import ChartsPage by implementing lazy loading, consolidating toolbars, and creating a slide-in panel system.

## File Boundaries (ONLY modify these files)
- `src/pages/ChartsPage.jsx` — the main file (currently ~1035 lines with 57 imports)
- `src/pages/charts/ChartPanelManager.jsx`
- **NEW** `src/app/components/chart/SlidePanel.jsx`
- **NEW** `src/app/components/chart/UnifiedToolbar.jsx`
- **NEW** `src/app/components/chart/ChartSkeleton.jsx`
- `src/charting_library/` — only if needed for skeleton appearance

**DO NOT modify any files outside this list.** Especially do not touch `src/data/`, `src/state/`, `src/constants.js`, `src/theme/`, or dashboard components.

## Steps

### 1. Read the sprint doc and ChartsPage
```
Read DESIGN_OVERHAUL_SPRINTS.md — focus on Sprint 4 tasks 4.1 through 4.6
Read src/pages/ChartsPage.jsx — understand all 57 imports and their usage
```

### 2. Audit and categorize imports (Task 4.1)
Categorize all ChartsPage imports into 3 tiers:

**Tier 1 — Always loaded (critical path):**
- ChartCanvas / ChartEngineWidget
- SymbolSearch
- DrawingToolbar
- IndicatorPanel
- ChartSettingsBar

**Tier 2 — Lazy, triggered by user action:**
- ReplayBar
- ScriptEditor, ScriptManager
- QuadChart
- WorkspaceLayout
- AlertPanel
- FundamentalsCard
- ShareSnapshotModal, SnapshotPublisher
- WatchlistPanel
- ChartInsightsPanel
- PositionSizer, QuickJournalPanel
- ChartContextMenu

**Tier 3 — Lazy, mobile-only:**
- Mobile* components
- SwipeChartNav
- GestureGuide

Wrap Tier 2 and 3 with `React.lazy()` + `<Suspense>` fallbacks.

### 3. Create UnifiedToolbar component (Task 4.2)
Consolidate the 4 separate toolbars into one:
- Current: ChartSettingsBar + DrawingToolbar + ChartTradeToolbar + TradeEntryBar
- New: Single unified toolbar with icon groups:
  `[Chart Type | Timeframe | Indicators | Drawing Tools | (divider) | Trade Mode | Share | More ▼]`
- "More" dropdown expands to: Replay, Scripts, Quad View, Fundamentals, Alerts
- Keep it thin (36px height) to maximize chart space

### 4. Create SlidePanel component (Task 4.3)
Generic panel that slides in from the right (desktop) or bottom (mobile):
- Used for: Watchlist, Indicators, Scripts, Alerts, Insights
- Only one panel open at a time
- Header with title + close button
- Remembers last-open state
- Overlay mode (default) or push mode (user preference)
- Smooth CSS transition (enter/exit)

### 5. Chart-first layout (Task 4.4)
Maximize chart canvas viewport:
- Chart gets maximum available space by default
- Toolbar is thin strip (36px) above chart
- Side panels overlay rather than sharing initial viewport
- No wasted space on initial render

### 6. Create ChartSkeleton component (Task 4.6)
While OHLCV data fetches, show a chart-shaped skeleton:
- Axis lines (horizontal price levels, vertical time markers)
- Shimmer animation in the chart area
- Looks like a chart is about to appear (not a generic spinner)

### 7. Warm cache on mount (Task 4.5)
Pre-warm data cache for user's watchlist symbols when Charts page mounts:
- Read watchlist from `useWatchlistStore`
- Trigger background data fetches for common timeframes
- Makes symbol switching feel instant

### 8. Verify
```
npx vitest run
```

Run the full test suite. The Charts page initial bundle should be significantly smaller. Only core chart + indicators + drawing tools render on first load. All secondary tools accessible via toolbar → slide-in panel.
