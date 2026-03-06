# charEdge — STRATEGIC TASK LIST v22.0

> **March 6, 2026** | Score: **98**/100 | **338 / 637** tasks done (**53.1%**)
> **Phase:** Launch Prep | **Target:** Beta Launch — April 15, 2026
> **Codebase:** 1,080 files · 235,410 LOC · 270 TS (25%) · 156 tests · 17 E2E
> **Architecture:** Unified Feedback Loop — Chart + Journal + AI are ONE organism
>
> **Health:** Engine A- · Intelligence B+ · Production B+ · Security B+ · Docs D-
> **Audit Sources:** 19 specialized audits consolidated into 77 new items (v22.0)

---

## ✅ DONE — Batch 14: Indicator Settings Upgrade (~17h)

> **Completed March 6, 2026.** Shared shell + 3-tab indicator dialog (Inputs/Style/Visibility). Unblocked Batch 15.

| # | Task | ID | Status | Effort | Dep |
|---|------|----|--------|--------|-----|
| 1 | **`SettingsTabShell` component** — tabbed dialog: header (title + icon + close), animated tab bar, scrollable body, footer (Cancel/Ok + Template), keyboard nav | 1.5.1 | ✅ | 3h | — |
| 2 | **`SettingsControls` shared library** — consolidate `ColorSwatch`, `Toggle`, `RangeSlider`, `SelectDropdown`, `NumberInput`, `LineStylePicker`, `SectionLabel` from 3 duplicate impls | 1.5.2 | ✅ | 2h | — |
| 3 | **Indicator Inputs tab** — section headers, `source` dropdown, smoothing `type` dropdown, info tooltips | 1.5.3 | ✅ | 3h | 1,2 |
| 4 | **Indicator Style tab** — per-output row with color/line/visibility, band values, fill controls, precision, status line | 1.5.4 | ✅ | 4h | 3 |
| 5 | **Indicator Visibility tab** — timeframe checkbox matrix (Sec/Min/Hr/Day/Wk/Mo), range sliders | 1.5.5 | ✅ | 3h | 3 |
| 6 | **`indicatorSlice` state extension** — `outputStyles`, `visibility`, `precision`, `showOnScale`, `showInStatusLine` | 1.5.6 | ✅ | 2h | 4 |

---

## ✅ DONE — Batch 15: Drawing Settings Upgrade (~12h)

> **Completed March 6, 2026.** Full tabbed drawing dialog: Fib per-level config, coordinates, visibility, gear icon bridge.

| # | Task | ID | Status | Effort | Dep |
|---|------|----|--------|--------|-----|
| 1 | **Drawing Style tab** — Fib per-level rows, toggle levels, colors, background fill, labels, log scale | 1.5.7 | ✅ | 5h | 1.5.1 |
| 2 | **Drawing Coordinates tab** — anchor points with price/bar spinners | 1.5.8 | ✅ | 2h | 1 |
| 3 | **Drawing Visibility tab** — timeframe checkbox matrix, per-drawing defaults | 1.5.9 | ✅ | 2h | 1 |
| 4 | **Drawing defaults store extension** — `fibLevels`, `visibility`, `labelPosition`, `showPrices`, etc. | 1.5.10 | ✅ | 2h | 1 |
| 5 | **Gear icon bridge** — Settings gear in `DrawingEditPopup` for complex tools, keep compact popup for simple | 1.5.11 | ✅ | 1h | 1 |

---

## ✅ DONE — Batch 16: Launch Blockers (~21h)

> **Completed March 6, 2026.** Security D→B+, WCAG AA contrast + keyboard nav, unified BackupService, PWA push, skill-adaptive onboarding.

| # | Task | ID | Status | Effort | Why Critical |
|---|------|----|--------|--------|--------------|
| 1 | **Activate `EncryptedStore.js`** — wired into AppBoot Phase 1 | 4.5.1 | ✅ | 3h | Security D → C |
| 2 | **SRI helper** — `sriHelper.js` build-time hash generation + HTML audit | 4.5.2 | ✅ | 1h | Supply chain safety |
| 3 | **CSP reporting** — Report-To header + JSONL structured logging | 4.5.3 | ✅ | 1h | XSS defense |
| 4 | **`Permissions-Policy`** — expanded to 11 APIs (payment, USB, bluetooth, etc.) | 4.5.4 | ✅ | 30m | Best practice |
| 5 | **Bug bounty / security.txt** — RFC 9116 + `SECURITY.md` disclosure policy | 4.5.5 | ✅ | 1h | Responsible disclosure |
| 6 | **Color contrast enforcement** — `contrastEnforcer.ts` (WCAG AA 4.5:1) | 4.6.1 | ✅ | 2h | Legal minimum |
| 7 | **Keyboard nav for chart elements** — `ChartKeyboardNav.jsx` + ARIA live region | 4.6.2 | ✅ | 3h | Accessibility floor |
| 8 | **Unified `BackupService`** — strategy pattern (cloud/filesystem/download) | 3.1.4 | ✅ | 4h | Data loss risk |
| 9 | **Push notifications (PWA)** — `PushManager.js` + SW push/notificationclick | 3.5.4 | ✅ | 4h | Alerts delivery |
| 10 | **Skill-adaptive onboarding** — `coachmarkRegistry.ts` + `onboardingSlice` skillLevel | 3.1.7 | ✅ | 3h | Retention critical |

---

## ✅ DONE — Batch 17: Bug Sweep & Data Integrity (~30h)

> **Completed March 6, 2026.** 18 confirmed bugs fixed: WebSocket reconnect/failover, data pipeline guards, state persistence, PnL fee math, drawing coordinates, UTC timestamps, render guards.

| # | Task | ID | Status | Effort | Source Audit |
|---|------|----|--------|--------|--------------|
| 1 | **Fix `_reconnectDebounce` not cleared on `_closeWs()`** → zombie reconnect | A1.1 | ✅ | 1h | Full-Stack Integrity |
| 2 | **Fix `onclose` ignores `_tradeSubs`** → trade-only streams never reconnect | A1.2 | ✅ | 1h | Full-Stack Integrity |
| 3 | **Fix `_notifyStatus` missing `_tradeSubs`** → stale UI health indicators | A1.3 | ✅ | 30m | Full-Stack Integrity |
| 4 | **Fix `WebSocketFailover._switchTo()` destructive loop** → only last sub survives | A1.4 | ✅ | 2h | Full-Stack Integrity |
| 5 | **Fix `historyLoading` stuck true after OPFS hit** → blocks future scroll-left | A2.1 | ✅ | 1h | Full-Stack Integrity |
| 6 | **Add cancellation for in-flight `prefetchHistory`** → wrong data on symbol switch | A2.2 | ✅ | 2h | Full-Stack Integrity |
| 7 | **Clear `adjacentPrefetchedRef` on symbol change** → stale cache keys | A2.3 | ✅ | 30m | Full-Stack Integrity |
| 8 | **Fix `hydrateSettings` full-replace race** → in-session changes erased | A3.1 | ✅ | 2h | Full-Stack Integrity |
| 9 | **Add trading settings to `partialize`** → 12 fields lost on force-quit | A3.2 | ✅ | 1h | Full-Stack Integrity |
| 10 | **Fix `autoCalcPnl` fee subtraction** → inflated P&L in trade form | A4.1 | ✅ | 30m | PnL Math Audit |
| 11 | **Fix `gradeExit` short-side analysis** → wrong AI coaching for shorts | A4.2 | ✅ | 1h | PnL Math Audit |
| 12 | **Add `CHANGED.PROPS` to drawings pipeline** → drawings drift on Log/Linear toggle | A5.1 | ✅ | 1h | Coordinate System |
| 13 | **Fix `DrawingStage` early-return** → ignores scale mode changes | A5.2 | ✅ | 30m | Coordinate System |
| 14 | **UTC timestamp normalization utilities** — `toEpoch`, `toUTCDateStr`, `utcStartOfDay` | A6.1 | ✅ | 3h | Timestamp Audit |
| 15 | **Fix Journal UTC/local mismatch** — trades on wrong day after 6pm CST | A6.2 | ✅ | 2h | Timestamp Audit |
| 16 | **Guard `PositionSizer` behind `tradeMode`** — rendered always, zero-actionable | F3.1 | ✅ | 30m | HFE Audit |
| 17 | **Guard `QuickStylePalette` behind `activeTool`** — rendered always | F3.2 | ✅ | 30m | HFE Audit |
| 18 | **Guard `RiskGuardOverlay` behind `riskLevel > 0.7`** — rendered always | F3.3 | ✅ | 30m | HFE Audit |

---

## ✅ DONE — Batch 18: Engine Performance & 120fps (~32h)

> **Completed March 6, 2026.** 15/15 tasks done. 120Hz detection, dynamic budgets, quintic-out physics, PixelRatio singleton, drawing shadows, rAF unification, elastic pinch, Y-axis cross-fade.

| # | Task | ID | Status | Effort | Source Audit |
|---|------|----|----|--------|--------|
| 1 | **Auto-detect 120Hz displays** via rAF delta measurement | B1.4 | ✅ | 2h | High-FPS Render |
| 2 | **Dynamic `FrameBudget` target** — pass detected Hz, scale LOD thresholds | B1.1 | ✅ | 2h | High-FPS Render |
| 3 | **Reduce pan layer dirtying** — only DATA+UI during inertia, not INDICATORS/DRAWINGS | B1.2 | ✅ | 2h | High-FPS Render |
| 4 | **Dynamic `MicroJankDetector` budget** — accept configurable `budgetMs` | B1.3 | ✅ | 1h | High-FPS Render |
| 5 | **Cache `getBoundingClientRect()`** in InputManager — invalidate on resize | B1.5 | ✅ | 1h | High-FPS Render |
| 6 | **Unify inertia rAF into engine renderLoop** — eliminate 5 separate rAF loops | B1.6 | ✅ | 3h | High-FPS Render |
| 7 | **Quintic-out pan deceleration** — replace linear `v *= 0.96` with time-normalized curve | B2.1 | ✅ | 3h | Interaction Physics |
| 8 | **Float-precise zoom settle** — compute offset before integer snap | B2.2 | ✅ | 2h | Interaction Physics |
| 9 | **Elastic touch pinch** — spring-back on release with 0.3x resistance + easeOutExpo | B2.3 | ✅ | 2h | Interaction Physics |
| 10 | **Y-axis scale cross-fade** — interpolate tick step changes over 120ms | B2.4 | ✅ | 3h | Interaction Physics |
| 11 | **Centralized `PixelRatio.js` singleton** — replace 35+ ad-hoc DPR reads | B3.1 | ✅ | 3h | Sub-Pixel Retina |
| 12 | **`snapToPixel` / `snapLineToPixel` utilities** — consistent half-pixel offset | B3.2 | ✅ | 2h | Sub-Pixel Retina |
| 13 | **DPR change listener** — `onPixelRatioChange` for display switching | B3.3 | ✅ | 1h | Sub-Pixel Retina |
| 14 | **Always-on drawing shadows** — 1.5px drop-shadow at 18% opacity | E3.1 | ✅ | 2h | Interaction Physics |
| 15 | **CSS `translateZ` on DRAWINGS canvas** — GPU depth separation | E3.2 | ✅ | 1h | Interaction Physics |

---

## ✅ DONE — Batch 19: Intelligence Pipe (~42h)

> **Completed March 6, 2026.** The Moat — 10 intelligence features: Co-Pilot stream bar, Ghost Trade Engine, MFE/MAE tracker, TruePnL card, AlphaTag, Voice-to-Chart, trade narrative, decision tree, post-trade replay, MFE/MAE visualizer.

| # | Task | ID | Status | Effort | Why Moat |
|---|------|----|--------|--------|----------|
| 1 | **Co-Pilot real-time wire** — FrameState→LLM→CopilotBar | 4.2.2 | ✅ | 8h | #1 blue-ocean feature |
| 2 | **Ghost Trade Engine** — drawing→AI watches→auto-journal | 4.1.9 | ✅ | 6h | Zero competitors have this |
| 3 | **MFE/MAE intra-trade tracking** | 4.1.3 | ✅ | 4h | Pro-grade analytics |
| 4 | **TruePnL** — fee/slippage decomposition | 4.1.4 | ✅ | 3h | Honest P&L |
| 5 | **AlphaTagEngine** — auto-tag trades with indicator signals | 4.1.11 | ✅ | 4h | Makes journal queryable |
| 6 | **Voice-to-Chart Note** — hold V, transcribe, pin to candle | 4.2.8 | ✅ | 4h | Frictionless capture |
| 7 | **LLM trade analysis narrative** | 4.2.3 | ✅ | 3h | AI explains your trades |
| 8 | **Decision Tree Journal** — forced-choice pre-trade classification | 4.3.16 | ✅ | 4h | Unique workflow |
| 9 | **Post-Trade Replay** — "Current vs Past Self" split panel | 4.1.16 | ✅ | 4h | Learning accelerator |
| 10 | **MAE/MFE Visualizer** — canvas shadow boxes + efficiency ratio | 4.1.12 | ✅ | 6h | Visual trade analytics |

---

## ⬜ Batch 20: Data Resilience & Pipeline (~28h)

> WebSocket heartbeat monitoring, API failover, and memory virtualization.

| # | Task | ID | Status | Effort | Source |
|---|------|----|--------|--------|--------|
| 1 | **`HeartbeatMonitor.js`** — data-level staleness detection (90s threshold) | C1.1 | ⬜ | 4h | WebSocket Heartbeat Audit |
| 2 | **Gap-stitching on reconnect** — wire `GapBackfill.ts` into reconnect flow | C1.2 | ⬜ | 3h | WebSocket Heartbeat Audit |
| 3 | **`silentReconnect()` API** for WebSocketService | C1.3 | ⬜ | 2h | WebSocket Heartbeat Audit |
| 4 | **`ApiKeyRoundRobin.js`** — provider ring + 100ms race failover | C2.1 | ⬜ | 4h | API Key Orchestrator |
| 5 | **Wire round-robin into `ProviderOrchestrator`** | C2.2 | ⬜ | 2h | API Key Orchestrator |
| 6 | **Per-provider cooldown tracking** with Retry-After respect | C2.3 | ⬜ | 1h | API Key Orchestrator |
| 7 | **`CandleVirtualizer.js`** — sliding window, eviction to IndexedDB | B4.1 | ⬜ | 6h | Candle Virtualization |
| 8 | **DataManager virtualizer integration** — scroll-back restore | B4.2 | ⬜ | 3h | Candle Virtualization |
| 9 | **MemoryBudget pressure integration** — reduce window on critical | B4.3 | ⬜ | 1h | Candle Virtualization |
| 10 | `SecurityMaster.ts` — canonical instrument IDs | 2.4.1 | ⬜ | 4h | Existing |

---

## ⬜ Batch 21: Drawing & Interaction Tools (~25h)

> Magnet mode, hit-testing, replay interpolation, and equity curve polish.

| # | Task | ID | Status | Effort | Source |
|---|------|----|--------|--------|--------|
| 1 | **Pixel-radius OHLC snap** — scan all visible bars within 15px | D1.1 | ⬜ | 3h | Magnet Mode Audit |
| 2 | **High/Low priority boost** in snap tiebreaks (0.8× multiplier) | D1.2 | ⬜ | 1h | Magnet Mode Audit |
| 3 | **Export `CLICK_BUFFER`** — rename HIT_THRESHOLD, default 5px | D2.1 | ⬜ | 1h | Hit-Test Audit |
| 4 | **`hitTestNearest()`** — ranked nearest-hit for overlapping drawings | D2.2 | ⬜ | 2h | Hit-Test Audit |
| 5 | **Normalize `signpost` & DrawingEngine** to use CLICK_BUFFER | D2.3 | ⬜ | 1h | Hit-Test Audit |
| 6 | **`ReplayInterpolator.ts`** — O→H→L→C intra-candle path generation | D3.1 | ⬜ | 3h | Market Replay Audit |
| 7 | **rAF-based replay playback** — replace `setInterval` with 60fps loop | D3.2 | ⬜ | 2h | Market Replay Audit |
| 8 | **`tick-interpolate` event** — partial OHLC revelation during replay | D3.3 | ⬜ | 2h | Market Replay Audit |
| 9 | **`equityCurveSmooth.js`** — Gaussian + WMA smoothing utilities | D4.1 | ⬜ | 2h | Equity Curve Audit |
| 10 | **Smoothing toggle UI** — Raw / Gaussian / WMA pill buttons | D4.2 | ⬜ | 1h | Equity Curve Audit |
| 11 | **Canvas renderer smoothing** — wire into `EquityCurveRenderer.js` | D4.3 | ⬜ | 1h | Equity Curve Audit |
| 12 | Mobile-first crosshair (long-press) | 2.7.5 | ⬜ | 2h | Existing |
| 13 | Label collision avoidance | 2.7.6 | ⬜ | 3h | Existing |

---

## ⬜ Batch 22: Visual Design System (~22h)

> Liquid Glass depth, radius harmony, z-index standardization, and micro-transitions.

| # | Task | ID | Status | Effort | Source |
|---|------|----|--------|--------|--------|
| 1 | **Refractive glass depth system** — specular highlights + variable blur per Z-tier | E1.1 | ⬜ | 3h | Liquid Glass Audit |
| 2 | **6-step Apple-aligned radius scale** — replace 9 hardcoded values | E1.2 | ⬜ | 3h | Liquid Glass Audit |
| 3 | **Clear Mode** — `[data-clear-mode]` CSS + `useDynamicMaterial` canvas sampling | E1.3 | ⬜ | 4h | Liquid Glass Audit |
| 4 | **Timeframe switch micro-transition** — blur+scale animation (0.2s) | E1.4 | ⬜ | 2h | Liquid Glass Audit |
| 5 | **Z-index token expansion** — add `popover: 1000`, `topmost: 9999` tiers | E2.1 | ⬜ | 1h | Full-Stack Integrity |
| 6 | **Z-index CSS standardization** — replace 65+ ad-hoc values with tokens | E2.2 | ⬜ | 4h | Full-Stack Integrity |
| 7 | **Fix hardcoded `#26A69A` / `#EF5350`** in ChartInfoWindow (4 instances) | F2.1 | ⬜ | 30m | HFE Audit |
| 8 | Deep Sea OLED mode — true black, warm-shifted | 4.9.3.2 | ⬜ | 2h | Existing |
| 9 | Neon-Amber alert tier — 4-tier visual hierarchy | 4.9.3.3 | ⬜ | 1h | Existing |
| 10 | Blue Light Filter — CSS filter in Deep Sea mode | 4.9.3.4 | ⬜ | 15m | Existing |

---

## ⬜ Batch 23: Human Factors & Cognitive UX (~28h)

> HFE-grade improvements: crosshair HUD, saliency system, ghost layer, low-stress palette, gap-stitch animation.

| # | Task | ID | Status | Effort | Source |
|---|------|----|--------|--------|--------|
| 1 | **Crosshair HUD overlay** — OHLCV + indicator values follow cursor at 16px offset | F1.1 | ⬜ | 4h | HFE Audit |
| 2 | **Signal-state saliency** — indicators grayscale by default, colorize at thresholds | F5.2 | ⬜ | 4h | Cognitive Friction Audit |
| 3 | **Ghost Layer for trade markers** — 20% opacity, proximity-fade to 100% at 80px | F5.3 | ⬜ | 3h | Cognitive Friction Audit |
| 4 | **Low-Stress palette** — surgeon-grade colors for 12hr sessions, `[data-palette]` | F2.2 | ⬜ | 3h | HFE Audit |
| 5 | **`GapStitchOverlay.jsx`** — 3-phase visual recovery (disconnect→sync→stitch) | F4.1 | ⬜ | 4h | HFE Audit |
| 6 | **Sequential bar reveal animation** on reconnect backfill | F4.2 | ⬜ | 2h | HFE Audit |
| 7 | Predictive Velocity HUD ($/sec) | 4.7.6 | ⬜ | 6h | Existing |
| 8 | Cognitive load auto-reduction | 4.7.8 | ⬜ | 4h | Existing |

---

## ⬜ Batch 24: UX Polish & Dashboard (~25h)

> Bento-box dashboard, quant metrics, and gamification.

| # | Task | ID | Status | Effort | Source |
|---|------|----|--------|--------|--------|
| 1 | **react-grid-layout bento box** — replace WidgetGrid | 4.9.2.1 | ⬜ | 6h | Existing |
| 2 | **Widget size variants** — 1×1, 2×1, 2×2, 4×1 | 4.9.2.2 | ⬜ | 3h | Existing |
| 3 | **Snap spring animations** — widget drag physics | 4.9.2.3 | ⬜ | 1h | Existing |
| 4 | **2D Layout serialization** — persist grid positions | 4.9.2.4 | ⬜ | 2h | Existing |
| 5 | **Kelly Criterion Calculator** | 4.4.3 | ⬜ | 3h | Existing |
| 6 | **Max Drawdown Tracker** with alerts | 4.4.4 | ⬜ | 3h | Existing |
| 7 | **Level-gated features** — unlock footprint at L5, WebGPU at L10 | 4.3.15 | ⬜ | 3h | Existing |
| 8 | Quick-Resize handles | 4.9.2.5 | ⬜ | 2h | Existing |
| 9 | Widget engagement tracking | 3.6.4 | ⬜ | 2h | Existing |

---

## ⬜ Batch 25: Visionary Features (~35h)

> Intent-driven UI, AI ghost overlays, NLP navigation, and haptic snap feedback.

| # | Task | ID | Status | Effort | Source |
|---|------|----|--------|--------|--------|
| 1 | **Intent detection engine** — `useIntentDetector.js` + `intentSlice.js` | G1.1 | ⬜ | 4h | Intent-Morphing Audit |
| 2 | **Contextual toolbar** — morphs per intent (drawing/scalping/analysis/trading) | G1.2 | ⬜ | 5h | Intent-Morphing Audit |
| 3 | **Infinite-canvas minimap** — year labels, beacon, fog-of-war | G1.3 | ⬜ | 3h | Intent-Morphing Audit |
| 4 | **Stream health border** — ambient WS quality glow + latency badge | G1.4 | ⬜ | 3h | Intent-Morphing Audit |
| 5 | **One-handed Pro Mode** — WASD pan, Q/E zoom, Tab TF cycle | G1.5 | ⬜ | 4h | Intent-Morphing Audit |
| 6 | **AI Ghost Overlay** — proactive S/R + harmonic pattern detection | G2.1 | ⬜ | 6h | Intent-Driven UI Audit |
| 7 | **Command-K NLP navigation** — "Show me 2024 NVDA gap" | G2.2 | ⬜ | 5h | Intent-Driven UI Audit |
| 8 | **Flow State Haptics** — graded Force Touch snap feedback | G2.3 | ⬜ | 4h | Intent-Driven UI Audit |

---

## 📋 BACKLOG — Remaining Score Movers

> Existing items not yet batched. Will be assigned to future batches.

### Remaining Engine Work

| # | Task | ID | Status | Effort |
|---|------|----|--------|--------|
| 1 | Grid/Axes → OffscreenCanvas Worker | 2.3.17 | ⬜ | 6h |
| 2 | barTransforms → IndicatorWorker | 2.3.18 | ⬜ | 2h |
| 3 | SharedArrayBuffer tick ring-buffer | 2.3.19 | ⬜ | 4h |
| 4 | OffscreenCanvas render isolation (stretch) | 2.3.20 | ⬜ | 12h |
| 5 | Grid lines as GPU static geometry | 2.3.22 | ⬜ | 3h |

### Data Infrastructure

| # | Task | ID | Status | Effort |
|---|------|----|--------|--------|
| 1 | Per-bar data quality scoring | 2.4.2 | ⬜ | 3h |
| 2 | Adapter health dashboard | 2.4.3 | ⬜ | 6h |
| 3 | OPFS compaction background job | 2.4.4 | ⬜ | 4h |
| 4 | Server-side data normalization | 2.4.5 | ⬜ | 6h |
| 5 | Adaptive data streaming (mobile) | 2.4.11 | ⬜ | 4h |
| 6 | SharedWorker multi-tab WS sharing | 2.4.12 | ⬜ | 4h |
| 7 | Lazy watchlist prefetch | 2.4.14 | ⬜ | 2h |

### Testing, Public API, Accessibility, AI, Intelligence, Quant, HUD, Journal

| # | Task | ID | Status | Effort |
|---|------|----|--------|--------|
| 1 | Accessibility tree assertions (axe-core) | 2.2.1 | ⬜ | 2h |
| 2 | Frame time regression tests | 2.2.3 | ⬜ | 3h |
| 3 | Benchmark CI job (10% threshold) | 2.2.4 | ⬜ | 2h |
| 4 | Web Vitals regression gate | 2.2.7 | ⬜ | 2h |
| 5 | Typed `EventEmitter` | 2.6.2 | ⬜ | 3h |
| 6 | Plugin registry with lifecycle hooks | 2.6.3 | ⬜ | 4h |
| 7 | Configuration schema with JSDoc | 2.6.4 | ⬜ | 2h |
| 8 | Pinch-to-zoom trackpad sensitivity | 2.7.7 | ⬜ | 2h |
| 9 | Actionable journal summarization | 4.2.4 | ⬜ | 2h |
| 10 | Journal Note Mining — pattern extraction | 4.2.5 | ⬜ | 3h |
| 11 | AI Session Summary — daily narrative | 4.2.6 | ⬜ | 3h |
| 12 | `PreTradeAnalyzer` → `OrderEntryOverlay` | 4.2.7 | ⬜ | 4h |
| 13 | Enhanced features — order flow imbalance, delta slope | 4.2.10 | ⬜ | 4h |
| 14 | Prediction feedback loop | 4.2.11 | ⬜ | 3h |
| 15 | LLM call batching — 30s context window | 4.2.12 | ⬜ | 3h |
| 16 | Per-asset anomaly baselines | 4.2.13 | ⬜ | 3h |
| 17 | NL query parsing | 4.2.14 | ⬜ | 4h |
| 18 | Embed journal entries — sentence transformer | 4.2.15 | ⬜ | 4h |
| 19 | Morning briefing from real data | 4.2.16 | ⬜ | 4h |
| 20 | Multi-axis heatmap — Profit × Asset × Session × Day | 4.3.6 | ⬜ | 4h |
| 21 | "The Gap" Analysis — expected vs actual | 4.3.9 | ⬜ | 3h |
| 22 | Ghost Chart — persist drawing layers per trade | 4.1.5 | ⬜ | 3h |
| 23 | Multi-TF snapshot viewer | 4.1.6 | ⬜ | 3h |
| 24 | `RegimeTagger.ts` — market regime detection | 4.1.7 | ⬜ | 3h |
| 25 | Auto-Screenshot on trade execution | 4.1.8 | ⬜ | 2h |
| 26 | Intent vs. Execution Dashboard | 4.1.10 | ⬜ | 4h |
| 27 | MAE/MFE toggle UI | 4.1.13 | ⬜ | 1h |
| 28 | Multi-Asset Correlation Audit | 4.1.14 | ⬜ | 4h |
| 29 | Trade Correlation Map panel | 4.1.15 | ⬜ | 3h |
| 30 | Rolling Beta to BTC | 4.4.5 | ⬜ | 3h |
| 31 | Recovery Factor | 4.4.6 | ⬜ | 1h |
| 32 | Win Rate by Asset | 4.4.7 | ⬜ | 2h |
| 33 | Win Rate by Session | 4.4.8 | ⬜ | 2h |
| 34 | Avg Hold Time (Winners vs Losers) | 4.4.9 | ⬜ | 2h |
| 35 | Scatter Plot (Risk vs Return) | 4.4.10 | ⬜ | 3h |
| 36 | Waterfall P&L Chart | 4.4.11 | ⬜ | 3h |
| 37 | Drawdown Depth Map | 4.4.12 | ⬜ | 3h |
| 38 | Screen reader announcements | 4.6.6 | ⬜ | 2h |
| 39 | Responsive typography with `clamp()` | 4.6.7 | ⬜ | 2h |
| 40 | ARIA live region for price changes | 4.6.8 | ⬜ | 2h |
| 41 | VoiceOver rotor actions | 4.6.9 | ⬜ | 3h |
| 42 | Screen-reader data table overlay | 4.6.10 | ⬜ | 2h |
| 43 | Collapse price axis to 48px | 4.7.1 | ⬜ | 1h |
| 44 | Shrink time axis to 20px | 4.7.2 | ⬜ | 1h |
| 45 | Auto-hide toolbar on scroll/pan | 4.7.3 | ⬜ | 2h |
| 46 | 4px live dot indicator | 4.7.4 | ⬜ | 1h |
| 47 | Dynamic information hierarchy | 4.7.5 | ⬜ | 3h |
| 48 | Exchange timezone overlay | 4.7.7 | ⬜ | 2h |
| 49 | Attention narrowing detector | 4.7.9 | ⬜ | 3h |
| 50 | "Market Picture" mental model aids | 4.7.10 | ⬜ | 3h |
| 51 | OLED border optimization | 4.9.3.5 | ⬜ | 30m |
| 52 | Mini-watchlist in inspector | 4.12.15 | ⬜ | 3h |
| 53 | 3-state sidebar adaptation | 4.12.16 | ⬜ | 3h |

---

## 📋 BACKLOG — Tier 4: Growth & Ecosystem (~80h)

> Do after launch, driven by real user feedback. **Proposed Batch 19.**

### Launch & Distribution

| # | Task | ID | Status | Effort |
|---|------|----|--------|--------|
| 1 | Discord community | 5.1.1 | ⬜ | 1h |
| 2 | Product Hunt launch | 5.1.2 | ⬜ | 4h |
| 3 | Reddit launch (r/algotrading, r/daytrading) | 5.1.3 | ⬜ | 2h |
| 4 | Twitter/X WebGPU speed content | 5.1.4 | ⬜ | 2h |
| 5 | SEO content pages | 5.1.5 | ⬜ | 3h |
| 6 | Trader reputation system | 5.1.6 | ⬜ | 4h |
| 7 | Live idea sharing — chart annotations | 5.1.7 | ⬜ | 6h |

### Developer Experience

| # | Task | ID | Status | Effort |
|---|------|----|--------|--------|
| 1 | Stylelint — ban hardcoded colors | 5.2.1 | ⬜ | 30m |
| 2 | Central Command Bus — 76 stores → 5 domains | 5.2.2 | ⬜ | 12h |
| 3 | State architecture diagram | 5.2.3 | ⬜ | 2h |
| 4 | Store consolidation Phase 1 — social 6→1 | 5.2.4 | ⬜ | 4h |
| 5 | Store consolidation Phase 2 — chart 9→1 | 5.2.5 | ⬜ | 6h |
| 6 | Documentation site (Starlight) | 5.2.6 | ⬜ | 8h |
| 7 | "How We Built WebGPU Charting" HN blog | 5.2.7 | ⬜ | 6h |
| 8 | Storybook component catalog | 5.2.8 | ⬜ | 12h |
| 9 | npm package alpha — `@charedge/charts` | 5.2.9 | ⬜ | 16h |
| 10 | Settings page reorganization | 5.2.10 | ⬜ | 2h |
| 11 | API versioning strategy | 5.2.11 | ⬜ | 2h |
| 12 | Marketplace — `marketplace.charedge.com` | 5.2.12 | ⬜ | 12h |
| 13 | WASM custom indicator support | 5.2.13 | ⬜ | 8h |
| 14 | Public profiles + shareable ghost boxes | 5.2.14 | ⬜ | 4h |
| 15 | Collaborative filtering widget suggestions | 5.2.15 | ⬜ | 4h |
| 16 | Certification program | 5.2.16 | ⬜ | 6h |
| 17 | Public design system | 5.2.17 | ⬜ | 4h |

### Deployment & Optimization

| # | Task | ID | Status | Effort |
|---|------|----|--------|--------|
| 1 | Vercel Edge Functions | 5.3.1 | ⬜ | 3h |
| 2 | ISR for SEO pages | 5.3.2 | ⬜ | 2h |
| 3 | Bundle <200KB gzipped | 5.3.3 | ⬜ | 2h |

### Bot Integration

| # | Task | ID | Status | Effort |
|---|------|----|--------|--------|
| 1 | Bot API Listener | 5.4.1 | ⬜ | 4h |
| 2 | Bot vs. Human Benchmarking | 5.4.2 | ⬜ | 4h |
| 3 | Alpha Leakage metric | 5.4.3 | ⬜ | 3h |

### Data Coverage Expansion

| # | Task | ID | Status | Effort |
|---|------|----|--------|--------|
| 1 | Polygon.io full adapter | 5.5.1 | ⬜ | 6h |
| 2 | iTick Adapter — APAC equities | 5.5.2 | ⬜ | 8h |
| 3 | Bitquery Adapter — DEX flow | 5.5.3 | ⬜ | 8h |
| 4 | Dukascopy Historical — 15yr tick forex | 5.5.4 | ⬜ | 8h |
| 5 | DEX adapter (Uniswap/dYdX) | 5.5.5 | ⬜ | 6h |
| 6 | Per-adapter circuit breaker tuning | 5.5.6 | ⬜ | 3h |
| 7 | Asset class type system | 5.5.7 | ⬜ | 4h |
| 8 | Multi-currency portfolio | 5.5.8 | ⬜ | 4h |
| 9 | Timescale marks API | 5.5.9 | ⬜ | 3h |

---

## 🚫 NOT NOW — Deferred & Future

> Good ideas parked until core is shipped and users exist. Don't touch these.

### Deferred (Correctly Parked)

| Category | Tasks | Hours | Why Not Now |
|----------|-------|-------|-------------|
| WebGPU compute shaders (2.8.1–5) | 5 | 36h | WebGL is fast enough. No user demand. |
| FinCast model integration (4.11.x) | 8 | 37h | Foundation model APIs aren't stable. |
| Order Flow microstructure (4.10.x) | 8 | 37h | Needs tick-level data feeds. |
| Web3/Sovereignty (6.3.x) | 6 | 31h | Zero user demand. |
| Real-money trading (6.4.x) | 6 | 38h | Regulatory minefield. |
| Think Harder (6.1.x) | 10 | 65h | Post-PMF features. |
| Advanced security (4.5.11–16) | 6 | 21h | SOC 2/FINRA — enterprise, premature. |
| Security & Encryption (6.2.x) | 5 | 15h | Argon2, WebAuthn, rotation — post-launch. |

### Future Horizon (Post-Launch)

| # | Task | Notes |
|----|------|-------|
| F.1 | Custom scripting language (Pine-like DSL) | 100+h, needs users first |
| F.2 | Strategy backtesting with walk-forward | BacktestEngine exists |
| F.3 | WASM fallback for GPU-less devices | Safety net |
| F.4 | Capacitor native iOS/Android app | Mobile expansion |
| F.5 | i18n layer | International markets |
| F.6 | Compliance layer (FINRA/SEC/MiFID II) | Institutional req |
| F.7 | Stripe integration / subscriptions | Monetization |
| F.8 | Computer Vision pattern recognition | ML frontier |
| F.9 | PostgreSQL multi-device sync | Enterprise backend |
| F.10 | Cross-exchange arb visual overlay | Unify existing |
| F.11 | Trading YouTuber partnerships | Distribution |
| F.12 | 30+ drawing tools | Power user completion |
| F.13 | Biometric Tilt Switch | 2027+ feature |
| F.14 | P2P Data Mesh (Hypercore/IPFS) | True decentralization |
| F.15 | Generative Trade Replay | AI-narrated what-if |
| F.16 | Token-Gated Content | No token, no community |
| F.17 | FIX Protocol adapter | Institutional play |
| F.18 | DOM/Depth ladder one-click trading | Pro execution |
| F.19 | Declarative Mark System (D3-style) | Composition layer |
| F.20 | Community leaderboards | With ZK proofs |
| F.21 | Corporate actions processor | Institutional (SplitAdjustment exists) |
| F.22 | Fundamental data parser | Quant |
| F.23 | Bloomberg-style command line | Power users |
| F.24 | Compute circuit breaker | Perf guard |
| F.25 | FlatBuffers for REST | Zero-copy |
| F.26 | Execution cost modeling | Arb UX |
| F.27 | Weekly team challenges | Social |
| F.28 | Markov chain symbol predictor | Smart prefetch |
| F.29 | CNN/LSTM candlestick model | ML |
| F.30 | BandwidthMonitor throttling | Resilience |
| F.31 | MCP agent orchestration | Multi-Agent |
| F.32 | On-device LLM inference | Privacy AI |
| F.33 | Multi-monitor PWA sync | PWA |
| F.34 | App Store PWA bypass | Distribution |
| F.35 | Auditory market cues | HFE |
| F.36 | APAC/MENA deep data adapters | Emerging markets |
| F.37 | WebGPU thermal management | Mobile edge case |
| F.38 | Volatility surface 3D viz | Options |
| F.39 | Compliance-as-a-feature marketing | GTM strategy |
| F.40 | Cross-asset correlation heatmap | Portfolio |
| F.41 | In-Context Fine-Tuning pipeline | Personalized AI |
| F.42 | Local GPU inference workbench | Extends F.32 |

### ❌ TRAPS — What NOT to Do

| Trap | Why |
|------|-----|
| Custom scripting language (Pine-like) | 100+ hours. Not until 10K users. |
| ONNX pattern classifier | No training data, no model. Premature. |
| ZK Proof of Alpha | Zero user demand. Ship first. |
| Biometric Tilt Switch | Wearable API support spotty. 2027. |
| npm package alpha | Chart API must stabilize first. |
| P2P Data Mesh (Hypercore) | 4-6 weeks. No users need it today. |
| FIX Protocol | Institutional play. Premature. |
| Token-Gated Content | No token. No community. No point. |
| Rust/WASM Math Core | WebGPU already faster for parallel work. |
| SharedArrayBuffer for ALL data | Only useful for live tick data. |
| WebGPU for drawing snap | GPU dispatch overhead > simple loop. |
| Host your own foundation model | Kronos has 12B records. Use the API. |

---

## 🗺️ EXECUTION ROADMAP

### Batch Sequence

| Batch | Name | Status | Tasks | Hours | Key Unlock |
|-------|------|--------|-------|-------|------------|
| 5 | Close Sprint 2 | ✅ | 8 | 23h | Data pipeline hardening |
| 6 | Ship-Ready | ✅ | 12 | 28h | Onboarding, alerts, replay, PWA |
| 7 | Intelligence Foundation | ✅ | 14 | 32h | AI, Ghost Boxes, quant metrics |
| 8 | Behavioral Intelligence | ✅ | 10 | 24h | Trigger maps, report cards |
| 9 | Sprint Closers + Growth | ✅ | 8 | 14h | Circuit breaker, reflections, cost savings |
| 10 | Pipeline Perf + Intelligence UI | ✅ | 8 | 12h | O(N) tick fix, Binance pagination |
| 11 | Seamless Data Pipeline | ✅ | 10 | 24h | Polygon, OPFS, binary storage |
| 12 | Security Hardening | ✅ | 5 | 10h | CSRF, DOMPurify, encrypted keys |
| 13 | Production Polish | ✅ | 9 | 18h | Rate limiting, audit logging, a11y |
| 14 | Indicator Settings | ✅ | 6 | 17h | TradingView-grade indicator dialogs |
| 15 | Drawing Settings | ✅ | 5 | 12h | Fib per-level, coordinates, visibility |
| 16 | Launch-Ready Security | ✅ | 10 | 21h | Security D → B+, WCAG AA, push, onboarding |
| 17 | Bug Sweep & Data Integrity | ✅ | 18 | 30h | 12 critical bugs, PnL math, timestamps |
| 18 | Engine Performance & 120fps | ✅ | 15 | 32h | ProMotion, physics, Retina clarity |
| 19 | Intelligence Pipe | ✅ | 10 | 42h | Co-Pilot, Ghost Trades, Voice |
| **20** | **Data Resilience & Pipeline** | ⬜ | **10** | **28h** | **HeartbeatMonitor, round-robin, virtualization** |
| **21** | **Drawing & Interaction Tools** | ⬜ | **13** | **25h** | **Magnet mode, hit-test, replay, equity curve** |
| **22** | **Visual Design System** | ⬜ | **10** | **22h** | **Liquid Glass, z-index, OLED** |
| **23** | **Human Factors & Cognitive UX** | ⬜ | **8** | **28h** | **Crosshair HUD, saliency, low-stress palette** |
| **24** | **UX Polish & Dashboard** | ⬜ | **9** | **25h** | **Bento box, quant metrics, gamification** |
| **25** | **Visionary Features** | ⬜ | **8** | **35h** | **Intent-Morphing, AI Ghost, NLP, haptics** |
| 26 | Community & Launch | ⬜ | 6 | 20h | Discord, PH, Reddit, docs |

### Score Projection

```
Current:           ██████████████████████░  98/100   (Batches 14-19 done)
After Batch 20-22: ██████████████████████░  99       (resilience + visual design)
After Batch 23-25: ███████████████████████  99+      (HFE + visionary features)
```

### Critical Path to Beta Launch

```
Batch 17 (30h) = Bug sweep — ship-safe  ✅
         ↓
   Batch 18 (32h) = 120fps engine  ✅
         ↓
   Batch 19 (42h) = Intelligence moat live  ✅
         ↓
   Batch 20 (28h) = Data resilience  ← YOU ARE HERE
         ↓
   Batches 21-25 = Tools → Visual → UX → Visionary
         ↓
   Batch 26 (20h) = Community launched
```

> [!TIP]
> **Data resilience next.** Batch 20 hardens the data pipeline (heartbeat monitoring, API failover, candle virtualization) to make charEdge bullet-proof for real trading.

---

## 📊 PROGRESS & HISTORY

### Progress Snapshot

```
PHASE 1  ██████████  100% (144 ✅   0 ⬜)  Foundation + Chart Excellence + Settings Upgrade
PHASE 2  ███████░░░  52%  ( 59 ✅  55 ⬜)  Data & Engine Hardening + WebGPU + Pipeline  (+15 audit)
PHASE 3  █████░░░░░  49%  ( 33 ✅  35 ⬜)  Ship & Production + Zero-Latency  (+22 audit)
PHASE 4  █████░░░░░  41%  ( 72 ✅ 105 ⬜)  Intelligence + Journal↔Chart + Dashboard  (+28 audit)
PHASE 5  ░░░░░░░░░░   0%  (  0 ✅  39 ⬜)  Growth & Ecosystem
PHASE 6  ░░░░░░░░░░   0%  (  0 ✅  27 ⬜)  Advanced / Think Harder
FUTURE   ░░░░░░░░░░   0%  (  0 ✅  42 ⬜)  Post-Launch Horizon
AUDIT    █████░░░░░  43%  ( 33 ✅  44 ⬜)  19-Audit Consolidation
────────────────────────────────────────────────────
TOTAL    █████░░░░░  53%  (338 ✅ 299 ⬜)  = 637 tracked tasks
```

### Version History

| Version | Total | Done | Key Change |
|---------|-------|------|------------|
| v9.0 | 150 | 85 | Initial |
| v10.0 | 207 | 85 | +57 tasks from audits |
| v11.0 | 269 | 87 | +62 tasks |
| v12.0 | 318 | 134 | Sprint restructure |
| v13.0 | 419 | 166 | +78 from 10+ audit sources |
| v14.0 | 437 | 168 | +18 tasks |
| v15.0 | 451 | 177 | +14 tasks |
| v16.0 | 496 | 177 | +45 (Strategic Blueprint) |
| v17.0 | 518 | 178 | +22 (2026 Report) |
| v18.0 | 535 | 251 | +17 (Narrative Tools) |
| v19.0 | 549 | 251 | +14 (Pipeline Audit) |
| v20.0 | 560 | 274 | +11 (Settings Upgrade), Batch 9-13 reconciliation |
| v21.0 | 560 | 274 | Strategic restructure |
| v21.1 | 560 | 285 | Batches 14+15 complete |
| v21.2 | 560 | 295 | Batch 16 complete: Security D→B+ |
| **v22.0** | **637** | **295** | **+77 from 19-audit consolidation: Batches 17-25 created (Bug Sweep, Engine 120fps, Intelligence Pipe, Data Resilience, Drawing Tools, Visual Design, Human Factors, UX Polish, Visionary Features)** |
| v22.1 | 637 | 328 | Batches 17+18 complete: 18 bug fixes, 120fps engine (rAF unification, elastic pinch, Y-axis cross-fade), sanitizer hardening, test fixes |
| **v22.2** | **637** | **338** | **Batch 19 complete: Intelligence Pipe — Co-Pilot stream bar, GhostTradeEngine, MFEMAETracker, AlphaTagEngine, VoiceToChart, DecisionTreeJournal, TruePnLCard, TradeNarrativeCard, PostTradeReplayPanel, MFEMAEVisualizer (38 new tests)** |

### Audit Sources (19+ → 32)

100-Auditor Panel · Elite 30-Perspective · 100-Report Deep Audit · Zero-Latency Engine · Kinetic Interaction & Telemetry · Frictionless Journaling · Journal-to-Chart Analytics · Trade Visualization · Dashboard Information Density · Strategic Blueprint · 2026 Global Financial Data Report · Narrative Tools Architecture · Deep Data Pipeline · 10-Session Consolidated Review · Chart Performance · Critical Review · Trading Journal Strategy · Data Ingestion Research · TradingView Reference · **Full-Stack Integrity** · **High-FPS Render** · **Chart Interaction Physics** · **Sub-Pixel Retina** · **Magnet Mode** · **Drawing Hit-Test** · **Market Replay** · **Equity Curve** · **PnL Math** · **Timestamp Normalization** · **WebSocket Heartbeat** · **Liquid Glass UI** · **Human Factors Engineering** · **Cognitive Friction** · **Intent-Morphing UI** · **Intent-Driven UI** · **API Key Orchestrator** · **Candle Virtualization** · **Coordinate System**

### Industry Context

> charEdge operates where Bloomberg charges **$31,980/seat/year** (6.5% YoY increase). The industry shifts from monolithic terminals to **modular "smarter stacks"** — 80% of Bloomberg at 3% cost. WebGPU hit universal browser support Jan 2026, enabling **1M+ point rendering at 60fps**. Financial TSFMs (Kronos, Chronos-2) now **outperform hand-tuned models zero-shot**. FINRA 2026 mandates human-in-the-loop AI oversight.

### Completed Batches (Summary)

| Batch | Name | Key Deliverables |
|-------|------|-----------------|
| **5** | Close Sprint 2 | `DataWindow.ts`, `OfflineManager.ts`, `FreshnessBadge.jsx`, 98-test adapter compliance, RTT indicator, `DataFreshnessSLA.ts` |
| **6** | Ship-Ready | Supabase auth, cloud sync, onboarding, server alerts, push notifications, replay mode, SW caching |
| **7** | Intelligence Foundation | `TradeSnapshot.ts`, `LLMService.ts`, `LeakDetector.ts`, `ReactionBar`, Ghost Boxes, Equity Curve, Sharpe/Sortino |
| **8** | Behavioral Intelligence | Trigger correlation engine, Weekly Report Card, Mistake Heatmap, Bias Detection, Rule Engine v2 |
| **9** | Sprint Closers | Circuit breaker consolidation, multi-condition alerts, Expectancy Calculator, Post-Trade Reflection, Cost Savings Calculator |
| **10** | Pipeline Perf | O(N) tick fix, direct engine prefetch, Binance 15m pagination, AlphaVantage full output, ExpectancyCard + PostTradeReflection UI |
| **11** | Seamless Pipeline | ProviderOrchestrator, OPFS-first scroll-back, ScrollPrefetcher, binary columnar OPFS, SplitAdjustment, TransitionDedup |
| **12** | Security Hardening | CSRF enforcement, DOMPurify XSS sanitization, Alpaca server-side credentials, encrypted API keys, SSRF webhook validation |
| **13** | Production Polish | Per-user rate limiting, audit logging, migration checksums/dry-run, :focus-visible, focus traps, aria-live, safe-area insets, haptics |
| **14** | Indicator Settings | `SettingsTabShell`, `SettingsControls` (7 shared controls), 3-tab `IndicatorSettingsDialog` (Inputs/Style/Visibility), `indicatorSlice` extension (6 new actions), `ChartSettingsPanel` refactor |
| **15** | Drawing Settings | `DrawingSettingsDialog` (Style with Fib levels/Coordinates/Visibility), `drawingSlice` defaults extension, gear icon bridge in `DrawingEditPopup` |
| **16** | Launch Blockers | `EncryptedStore` activation, `sriHelper.js`, CSP Report-To + JSONL logging, expanded Permissions-Policy (11 APIs), `security.txt`/`SECURITY.md`, `contrastEnforcer.ts`, `ChartKeyboardNav.jsx` + ARIA, `BackupService.js` (strategy pattern), `PushManager.js` + SW push handlers, `coachmarkRegistry.ts` (12 skill-filtered tips) |
| **17** | Bug Sweep & Data Integrity | 18 bugs fixed: WebSocket reconnect/failover, data pipeline guards, state persistence, PnL fee math, drawing coordinates, UTC timestamps, render guards |
| **18** | Engine Performance & 120fps | 120Hz detection, dynamic FrameBudget, quintic-out physics, PixelRatio singleton, rAF loop unification (5→1), elastic pinch spring-back (0.3x + easeOutExpo), Y-axis tick cross-fade (120ms), drawing shadows, GPU depth separation |
| **19** | Intelligence Pipe | `CopilotStreamBar.jsx` (real-time insight bar + template fallback), `GhostTradeEngine.ts` (drawing→ghost trades + live MFE/MAE), `MFEMAETracker.ts` (efficiency ratio), `AlphaTagEngine.ts` (14 indicator rules + per-tag analytics), `VoiceToChart.ts` (Web Speech API + IndexedDB), `DecisionTreeJournal.ts` (4-level pre-trade wizard), `TruePnLCard.jsx` (fee decomposition), `TradeNarrativeCard.jsx` (LLM/template story), `PostTradeReplayPanel.jsx` (MFE/MAE bands + reflection), `MFEMAEVisualizer.jsx` (scatter + bar chart) |

---

> **charEdge v22.2** — 637 tasks tracked · 338 done · 299 remaining · 32 audit sources · Score 98/100
> _"The modular, intelligent alternative — institutional-grade visualization + behavioral intelligence at retail pricing."_
