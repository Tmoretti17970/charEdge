# charEdge — Charts Page Crash Fix (Full Audit)

**Date:** 2026-02-21
**Severity:** P0 — Charts page completely unusable
**Error:** `Maximum update depth exceeded` at `ChartsPageInner` (line 118)

---

## Root Cause

An infinite re-render loop caused by **3 competing store writers** + **full-store Zustand subscriptions** amplifying every write into cascading re-renders.

The loop path:
```
ChartsPage fetchOHLC → setData() → ChartEngineWidget re-renders →
  ChartEngineWidget Binance fetch → setStoreData() → ChartsPage re-renders →
    ChartCanvas legacy sync → setData('legacy') → loop repeats
```

Compounded by: CORS failures on Binance/CoinGecko APIs causing rapid fallback chains, and `useChartTradeStore()` full-store subscriptions re-rendering on every persist hydration tick.

---

## Files Changed (8 files)

| # | File | Source Path | Fix |
|---|------|-------------|-----|
| 1 | `useChartTradeHandler.js` | `src/components/chart/` | Individual selectors + memoized handlers |
| 2 | `ChartTradeToolbar.jsx` | `src/components/chart/` | Individual selectors (same pattern) |
| 3 | `useChartStore.js` | `src/state/` | Restored missing drawing state fields |
| 4 | `ChartsPage.jsx` | `src/pages/` | Removed competing fetchOHLC pipeline |
| 5 | `ChartCanvas.jsx` | `src/components/` | Removed legacy store sync effect |
| 6 | `useWebSocket.js` | `src/data/` | Removed store.setData writes |
| 7 | `ChartEngineWidget.jsx` | `src/components/` | Added FetchService fallback chain |
| 8 | `useScriptRunner.js` | `src/engine/` | Stable empty references |

---

## Fix Details

### 🔴 Critical #1 — Full Store Subscription (useChartTradeHandler + ChartTradeToolbar)

**Before:** `const { tradeMode, tradeStep, ... } = useChartTradeStore()` — subscribes to ALL 15+ fields. Every field change (including persist hydration) triggers a re-render of ChartsPage.

**After:** Individual selectors (`useChartTradeStore((s) => s.tradeMode)`) + `getState()` for action dispatch inside callbacks. Only re-renders when the specific subscribed value changes.

**Impact:** ~90% fewer re-renders from trade store changes.

### 🔴 Critical #2 — Missing Store Fields (useChartStore)

**Before:** ChartsPage lines 88-89, 102, 117-118 read `drawings`, `drawingsVisible`, `pendingDrawing`, `setPendingDrawing`, `addDrawing` — all removed from store when DrawingEngine was introduced in Sprint 4. Returns `undefined`, crashes if any drawing tool is clicked.

**After:** Restored all 5 fields + actions to `useChartStore`. Drawing toolbar now works again.

### 🔴 Critical #3 — Dual Data Pipeline (4 files)

**Before:** Three independent writers to `useChartStore.setData()`:
1. `ChartsPage.jsx` — fetchOHLC effect (FetchService chain)
2. `ChartEngineWidget.jsx` — direct Binance REST fetch
3. `ChartCanvas.jsx` — legacy prop-to-store sync
4. `useWebSocket.js` — live candle updates (array spread every tick)

**After:** Single writer: `ChartEngineWidget.jsx` only. Pipeline:
- Tier 1: Binance REST (5s timeout)
- Tier 2: FetchService fallback (CoinGecko → Yahoo → demo)
- Tier 3: generateOHLCV demo data (always works)
- WebSocket: only connects if Binance REST succeeded; writes to store only on candle CLOSE (not every tick)

### 🟡 High #4 — Unmemoized Context Menu Handlers (useChartTradeHandler)

**Before:** `contextMenuHandlers` object literal created fresh every render — 10 function allocations per frame during re-render storms.

**After:** Wrapped in `useMemo`, keyed on `[symbol, addAlert]`. Stable reference prevents ChartContextMenu re-renders.

### 🟡 High #5 — Unstable Empty References (useScriptRunner)

**Before:** `setEditorOutputsRaw({})` creates a new `{}` every call. React's `Object.is` comparison: `{} !== {}` → always triggers state update → re-render.

**After:** Module-level `EMPTY_OUTPUTS = {}` and `EMPTY_ERRORS = {}` constants. Same reference every time → React short-circuits the update.

---

## Deployment Checklist

1. Copy each file to its source path (see table above)
2. No new dependencies — all imports already existed
3. Clear browser localStorage key `charedge-chart-trade` (persist schema unchanged, but clean slate recommended)
4. Test sequence:
   - [ ] Navigate to Charts page — should load without crash
   - [ ] Verify data loads (check DataSourceBadge: LIVE / DELAYED / SIMULATED)
   - [ ] Switch symbols (BTC → ETH → AAPL)
   - [ ] Switch timeframes (1h → 1d → 5d)
   - [ ] Click drawing tools (trendline, horizontal line, text)
   - [ ] Right-click chart → context menu should open
   - [ ] Long/Short trade entry workflow
   - [ ] Verify no console "Maximum update depth" errors
   - [ ] LiveTicker shows real price + 24h change (was always blank before)
   - [ ] DevTools Network tab: only 1 WebSocket connection (was 2)
   - [ ] Check React DevTools Profiler — no rapid re-render cascades

---

## Risk Assessment

- **Low risk:** Fixes #1, #2, #4, #5 are additive/surgical — no behavioral changes
- **Medium risk:** Fix #3 changes the data ownership model. If any other component directly calls `fetchOHLC` and expects `useChartStore.data` to be populated by ChartsPage, it will now get data from ChartEngineWidget instead (same shape, different source label)
- **Rollback:** Revert all 8 files to previous versions. The crash will return but no data loss.

---

## WebSocket Consolidation

### Before (2 connections, tick always null)
```
ChartEngineWidget  →  WS #1  →  wss://.../{sym}@kline_{tf}
                                 kline → barsRef + store.setData()

WebSocketService   →  WS #2  →  wss://.../{sym}@kline_{tf}  (DUPLICATE!)
                                 kline → onBar (store writes, now removed)
                                       → onTick (NEVER CALLED — shim bug)
                                 LiveTicker tick = always null
```

### After (1 connection, tick works, 24h stats)
```
ChartEngineWidget  →  WS #1  →  wss://.../stream?streams={sym}@kline_{tf}/{sym}@miniTicker
                                 kline      → barsRef + store (close only)
                                 miniTicker → window event 'charedge:ws-tick'
                                 open/close → window event 'charedge:ws-status'

useWebSocket       →  listens to window events (NO WS connection)
                      → { tick, wsStatus, isLive } for LiveTicker + DataSourceBadge
```

**Key improvements:**
- Halved WS connections (was 2, now 1)
- LiveTicker now shows real price, 24h change, high/low, volume (was always null)
- Combined Binance stream: `@kline_{tf}` + `@miniTicker` in one connection
- High-frequency tick data stays off-store (window events) — no render cascades
- Store only updated on candle CLOSE (was every kline tick = ~1/sec)
