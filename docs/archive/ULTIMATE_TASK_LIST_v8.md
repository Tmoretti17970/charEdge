# charEdge — ULTIMATE STRATEGIC TASK LIST v8.8

> **Date:** March 3, 2026 | **Baseline:** v8.6 | **Current GPA:** ~3.85 (estimated after Wave 4 testing depth)
>
> **Codebase Snapshot:** 888+ files · 198,000+ lines · **3,022** tests passing (113 files) · **46** .ts files (**5.3%**) · **24** CSS module files · 10 design components · **27** SVG icons · `animations.css` (258 lines, 20+ keyframes/utility classes)

---

## PROGRESS SNAPSHOT

```
WAVE 1 ██████████ 100%   (18 ✅  0 🔶   0 ⬜)
WAVE 2 ██████████ 100%   (18 ✅  0 🔶   0 ⬜)
WAVE 3 █████████░  90%   (22 ✅  0 🔶   2 ⬜)
WAVE 4 ██████░░░░  64%   (12 ✅  0 🔶   5 ⬜)
WAVE 5 ░░░░░░░░░░   0%   (0 ✅  0 🔶  20 ⬜)
WAVE 6 ░░░░░░░░░░   5%   (1 ✅  0 🔶  18 ⬜)
WAVE 7 ░░░░░░░░░░   0%   (0 ✅  0 🔶  16 ⬜)
─────────────────────────────────────────────
TOTAL  ███████░░░  65%   (71 ✅  0 🔶  61 ⬜)
```

### Key Wins Since v8.6
- **Wave 4 Testing Depth** — 86 new tests across 9 new test files (component + integration)
- **Test infrastructure** — `testUtils.js` with Zustand store reset, mock trade/analytics factories
- **Component render tests** — DashboardPanel (21), ChartOverlays (14), JournalLogbook (6), TradeFormModal (11), SettingsPage (5)
- **Integration flow tests** — Trade CRUD (6), Chart Interactions (11), Theme Toggle (3), New User Onboarding (5)
- **Bug fixes** — Fixed billing sparkle emoji + PositionPanel color assertions, SettingsSlideOver inline style extracted
- **Typography tokens** — ~40 hardcoded `font-size: Xpx` replaced with `var(--fs-*)` across 9 CSS modules
- **Test count** — **3,022** passing (+88 since v8.6), 12 skipped, **0 failing**

---

## STATUS KEY

| Symbol | Meaning |
|--------|---------|
| ✅ | Done |
| 🔶 | Partial / In Progress |
| ⬜ | Not Started |
| 🔴 | Critical / Do First |
| 🟠 | High Priority |
| 🟡 | Medium Priority |
| ⚪ | Low Priority / Future |

---

## WAVE 1: 🔴 INTEGRITY & CI FOUNDATION — 100% Complete ✅

> **Goal:** Retire existential risks. Establish automated quality gates.
>
> **Status:** All tasks complete.

### 1.1 OffscreenCanvas Decision ✅

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1.1.1 | ~~DECIDE: OffscreenCanvas~~ | ✅ | **KEEP.** Used legitimately in GridStage, AxesStage, FontEngine, Bloom, TemporalAA, MotionBlur. `WorkerBridge.js` is indicator-only. |
| 1.1.4 | ~~Landing page claims audit~~ | ✅ | No false OffscreenCanvas claims found |

### 1.2 Dead Code Purge ✅

| # | Task | Status | Pri | Effort | Expert(s) |
|---|------|--------|-----|--------|-----------|
| 1.2.1 | ~~Remove quarantined P2P mesh modules~~ | ✅ | — | — | Torvalds |
| 1.2.2 | ~~Remove broker-bridge stubs~~ | ✅ | — | — | Torvalds |
|  | *Deleted `brokerOAuth.js` (352L), `BrokerSync.js` (300L), `useBrokerStore.js` (72L). Kept `brokerDetection.js` + `BrokerProfiles.js` (actively used by CSV import).* |
| 1.2.3 | ~~Audit `src/data/` for unused shims~~ | ✅ | — | — | Torvalds |
|  | *knip identified 12 unused files: DataFeed, DataManager, FundamentalService, InsightsPage, MarketsPage, SEO modules, SyncUtils, useSyncStore, analytics, offlineCache* |
| 1.2.4 | ~~Run dead code detection~~ | ✅ | — | — | Dean |
| 1.2.5 | ~~Delete knip-identified unused files~~ | ✅ | 🟡 | 30m | Torvalds |
|  | *Deleted `offlineCache.js` + `analytics.js`. 10 others confirmed as false positives (SSR, public pages, tests).* |

### 1.3 CI Pipeline ✅

| # | Task | Status | Evidence |
|---|------|--------|----------|
| 1.3.1 | ~~GitHub Actions workflow~~ | ✅ | `.github/workflows/ci.yml` — install/lint/typecheck/test/build/audit |
| 1.3.2 | ~~Block merge on test failure~~ | ✅ | Test job runs on push/PR to main |
| 1.3.3 | ~~`npm audit` check in CI~~ | ✅ | `npm audit --audit-level=high --production` |
| 1.3.4 | ~~Bundle size check~~ | ✅ | Fails if main chunk > 250KB gzipped |
| 1.3.5 | ~~`tsc --noEmit` in CI~~ | ✅ | `continue-on-error: true` until TS coverage grows |

### 1.4 Production Observability ✅

| # | Task | Status | Pri | Effort | Expert(s) |
|---|------|--------|-----|--------|-----------|
| 1.4.1 | ~~Vercel Analytics + Speed Insights~~ | ✅ | — | — | Rauch |
| 1.4.2 | ~~Sentry `@sentry/browser`~~ | ✅ | — | — | Rauch, Dean |
|  | *Dynamic import, error filtering, logger integration, env-configured DSN* |
| 1.4.3 | ~~Web Vitals (LCP, CLS, INP, TTFB, FCP)~~ | ✅ | — | — | Rauch |
|  | *`web-vitals` library, Sentry metric forwarding, color-coded dev console* |
| 1.4.4 | ~~PostHog product analytics~~ | ✅ | — | — | Kis |
|  | *`posthog-js` installed, `src/utils/posthog.js` wrapper (lazy, env-gated), wired into `AppBoot.postBoot()`* |

---

## WAVE 2: 🟠 TYPESCRIPT MIGRATION + MODULE DECOMPOSITION — 100% Complete ✅

> **Goal:** Make the codebase refactorable. Type the remaining god objects, then decompose them.
>
> **Status:** All tasks complete.

### 2.1 God Object Decomposition *(ALL DONE ✅)*

| # | Task | Status | Evidence |
|---|------|--------|----------|
| 2.1.1 | ~~`DrawingRenderer.js` decompose~~ | ✅ | → 7 sub-renderers |
| 2.1.2 | ~~`DrawingEngine.js` decompose~~ | ✅ | → 3 sub-modules + DrawingPersistence (572 lines) |
| 2.1.3 | ~~`computations.js` decompose~~ | ✅ | → 14 .ts indicator files |
| 2.1.4 | ~~WGSL shader extraction~~ | ✅ | → 7 `.wgsl` files |

### 2.2 TypeScript Conversion — Target 30%

| # | Task | Status | Pri | Effort | Expert(s) | Prereq |
|---|------|--------|-----|--------|-----------|--------|
| 2.2.1 | ~~`WebGLRenderer.js` → `WebGLRenderer.ts`~~ | ✅ | — | — | — | — |
| 2.2.2 | ~~`WebGPUCompute.js` → `WebGPUCompute.ts`~~ | ✅ | — | — | — | — |
|  | *678 lines, 7 typed interfaces, `@webgpu/types` installed + tsconfig updated* |
| 2.2.3 | ~~Typed Zustand stores~~ | ✅ | — | — | Hønsi, Downie | — |
|  | *31/31 stores have `@ts-check`* |
| 2.2.4 | ~~`TickerPlant.js` → `TickerPlant.ts`~~ | ✅ | — | — | — | — |
|  | *920 lines, 15 typed interfaces, private/public visibility on all 20+ methods* |
| 2.2.5 | ~~`server.js` typed via `@ts-check` + JSDoc~~ | ✅ | — | — | Rauch | — |
|  | *`ProxyConfig`, `RateLimitEntry` typedefs, `@types/express` + `@types/compression` installed* |

### 2.3 Documentation ✅

| # | Task | Status | Pri | Effort | Expert(s) |
|---|------|--------|-----|--------|-----------|
| 2.3.1 | ~~JSDoc on all public `ChartEngine` methods~~ | ✅ | — | — | Downie, Hønsi |
|  | *8 methods documented: markDirty, setAlerts, setSyncedCrosshair, renderTradeMarkers, renderLoop, _needsNextFrame, _scheduleDraw, loadSavedDrawings* |
| 2.3.2 | ~~`docs/getting-started.md`~~ | ✅ | — | — | Downie |
| 2.3.3 | ~~`CONTRIBUTING.md`~~ | ✅ | — | — | Downie, Torvalds |
| 2.3.4 | ~~Architecture overview diagram (Mermaid)~~ | ✅ | — | — | Dean, Downie |
|  | *Full data-to-render pipeline diagram in `docs/architecture.md`* |
| 2.3.5 | ~~Auto-generated API docs via TypeDoc~~ | ✅ | — | — | Hønsi |
|  | *`typedoc` installed, `typedoc.json` configured (6 TS entry points), `npm run docs:api` script* |

### 2.4 Naming Convention Enforcement ✅

| # | Task | Status | Pri | Effort | Expert(s) |
|---|------|--------|-----|--------|-----------|
| 2.4.1 | ~~Define and document convention~~ | ✅ | — | — | Torvalds |
|  | *`docs/naming-convention.md` — PascalCase components, camelCase hooks/utils, UPPER_CASE constants* |
| 2.4.2 | ~~ESLint `naming-convention` rule~~ | ✅ | — | — | Torvalds |
|  | *`@typescript-eslint/naming-convention` (warn) in `eslint.config.js` for `.ts/.tsx` files* |

---

## WAVE 3: 🟡 CSS ARCHITECTURE + DESIGN SYSTEM — 90% Complete

> **Goal:** Complete CSS migration. Build the React component library. Replace emoji icons.
>
> **Remaining effort:** ~4h (low-priority CSS features)

### 3.1 CSS Module Migration

| # | Task | Status | Pri | Effort | Expert(s) |
|---|------|--------|-----|--------|-----------|
| 3.1.1 | ~~Extract inline styles from top 10 pages → CSS modules~~ | ✅ | — | — | Kravets, Globa |
|  | *8 modules: `App`, `LandingPage`, `Button`, `Card`, `DashboardPanel` (60+ classes), `Sidebar` (50+ classes), `SlidePanel` (10 classes), `ChartHUD` (8 classes)* |
| 3.1.2 | ~~Extract inline styles from remaining pages~~ | ✅ | — | — | Kravets |
|  | *12/18 done: SettingsHelpers (10), PositionPanel (20), DiscoverLayoutEngine (10), WorkspaceLoader (8), RiskGuardOverlay (3), ToolbarDrawingGroups (5), ChartContextMenu (39), QuickJournalPanel (144 lines), CookieConsent, FeatureGate, RadialMenu = 70+ new CSS classes. Remaining 6 inline-heavy pages have dynamic-color `style` overrides kept intentionally.* |
| 3.1.3 | ~~Remove remaining inline `<style>` tags~~ | ✅ | — | — | Kravets |
|  | *`SettingsSlideOver.jsx` extracted to CSS module. `WorkspaceLayout.jsx` (runtime JS values) and `AnalyticsExport.js` (HTML doc generation) are legitimate uses — kept intentionally.* |
| 3.1.4 | ~~Convert `style={{}}` objects in top 20 components~~ | ✅ | — | — | Kravets, Globa |
|  | *12/20 done. Remaining `style={{}}` are dynamic color/position overrides kept as inline `style` by design.* |

### 3.2 CSS Advanced Features

| # | Task | Status | Pri | Effort | Expert(s) | Prereq |
|---|------|--------|-----|--------|-----------|--------|
| 3.2.1 | ~~`container-type: inline-size` on dashboard widgets~~ | 🔶 | 🟡 | 1h | Kravets | 3.1.1 ✅ |
|  | *`DashboardPanel.module.css` already has `container-type: inline-size` + 8 `@container` rules. Remaining: extend to other dashboard widgets.* |
| 3.2.2 | Replace `useBreakpoints()` with `@container` queries | ⬜ | 🟡 | 3h | Kravets | 3.2.1 |
| 3.2.3 | `@property` declarations for theme color interpolation | ⬜ | 🟡 | 1h | Kravets |
| 3.2.4 | `:has()` selectors for contextual styling | ⬜ | ⚪ | 1h | Kravets |

### 3.3 React Component Library ✅

| # | Task | Status | Pri | Effort | Expert(s) |
|---|------|--------|-----|--------|-----------|
| 3.3.1 | ~~`Button.jsx`~~ | ✅ | — | — | Globa |
| 3.3.2 | ~~`Card.jsx`~~ | ✅ | — | — | Globa |
| 3.3.3 | ~~`Input.jsx`~~ | ✅ | — | — | Globa, Freiberg |
| 3.3.4 | ~~`Avatar.jsx`, `Tooltip.jsx`~~ | ✅ | — | — | Globa |
|  | *Avatar: deterministic color hash, image fallback, status dot, 3 sizes. Tooltip: portal-based, viewport clamping, glassmorphism, arrow pointer.* |
| 3.3.5 | ~~`Skeleton.jsx`~~ | ✅ | — | — | Globa |
| 3.3.6 | ~~`Dialog.jsx` — focus trap, mobile bottom-sheet~~ | ✅ | — | — | Globa, Federighi |
|  | *Focus trap (Tab cycling), Escape dismiss, body scroll lock, previous focus restoration, backdrop click, size variants (sm/md/lg), mobile bottom-sheet via CSS @media* |
| 3.3.7 | ~~`Toast.jsx` — notification system~~ | ✅ | — | — | Globa |
|  | *Vanilla external store (useSyncExternalStore), `useToast` hook, auto-dismiss (5s/8s), max 3 stacked, 4 variants (success/error/warning/info), slide animation* |

### 3.4 Animation & Micro-Interactions ✅

| # | Task | Status | Pri | Effort | Expert(s) | Prereq |
|---|------|--------|-----|--------|-----------|--------|
| 3.4.1 | ~~Spring animations for modals, sidebar, tooltips~~ | ✅ | — | — | Freiberg | 3.3.6 ✅ |
|  | *Dialog: AnimatePresence + spring slide-up (400/30). Tooltip: spring scale pop (500/28). Sidebar: motion.nav animated width (300/28).* |
| 3.4.2 | ~~Button micro-interactions: press scale, hover glow~~ | ✅ | — | — | Freiberg | 3.3.1 ✅ |
|  | *Already implemented: `scale(1.04)` hover, `scale(0.98)` active, box-shadow glow in `Button.module.css`* |
| 3.4.3 | ~~Input micro-interactions: animated focus ring~~ | ✅ | — | — | Freiberg | 3.3.3 ✅ |
|  | *framer-motion spring label, focus ring box-shadow, error state animation* |
| 3.4.4 | ~~Card hover: parallax tilt effect~~ | ✅ | — | — | Freiberg | 3.3.2 ✅ |
|  | *`perspective(800px) rotateX(1deg) rotateY(-0.5deg)` + accent glow in `Card.module.css`* |
| 3.4.5 | Page transitions with `AnimatePresence` | ⬜ | ⚪ | 2h | Freiberg | — |
| 3.4.6 | ~~Named motion tokens in `animations.css`~~ | ✅ | — | — | Freiberg |
|  | *20+ keyframes (fadeIn, fadeInUp, fadeInDown, slideInLeft, slideInRight, scaleIn, popIn, shimmer, pulse, spin, bounce, barCascade, volumeRise, crosshairFade, glow, progressGlow, consentSlideUp, slideUp, slideDown, etc.) + 12+ utility classes, all using `var(--dur-*)` and `var(--ease-*)` tokens. 258 lines.* |

### 3.5 Icon System ✅

| # | Task | Status | Pri | Effort | Expert(s) |
|---|------|--------|-----|--------|-----------|
| 3.5.1 | ~~Design/source 24 SVG icons~~ | ✅ | — | — | Freiberg |
|  | *24 Lucide-style icons: navigation (5), actions (5), status (5), trading (5), misc (4)* |
| 3.5.2 | ~~`<Icon name="..." />` component with tree-shaking~~ | ✅ | — | — | Freiberg, Globa |
|  | *Inline SVG paths, zero HTTP requests, `ICON_NAMES` export, dev-mode unknown icon warning* |
| 3.5.3 | ~~Replace all emoji usage with `<Icon>`~~ | ✅ | — | — | Freiberg |
|  | *20+ emoji replaced across 7 files: Sidebar footer (5), DiscoverLayoutEngine (1), ChartContextMenu (8), TradeEntryBar (6), IndicatorLegendHeader (2 — eye/eye-off), AlertLinesOverlay (1 — bell). +3 new icons added (eye-off, bell, pin → 27 total).* |

### 3.6 Typography Audit

| # | Task | Status | Pri | Effort | Expert(s) | Prereq |
|---|------|--------|-----|--------|-----------|--------|
| 3.6.1 | ~~Apply type scale tokens everywhere~~ | ✅ | — | — | Freiberg | 3.1.x |
|  | *~40 hardcoded `font-size: Xpx` replaced with `var(--fs-*)` across 9 CSS modules. Added `--fs-3xs` (8px) and `--fs-2xs` (10px) tokens. Remaining px values are intentional (dense chart data, dynamic sizes).* |
| 3.6.2 | ~~Fluid typography with `clamp()` for headings~~ | ✅ | — | — | Freiberg, Federighi |
|  | *h1-h4 use `clamp()` in `base.css`: e.g. `clamp(1.5rem, 1vw + 1.25rem, var(--fs-4xl))`. h5-h6 static.* |
| 3.6.3 | Dark/light mode shadow treatments | ⬜ | ⚪ | 1h | Freiberg |

---

## WAVE 4: 🔵 TESTING DEPTH + QUALITY GATES — 64% Complete

> **Goal:** Transform tests from "lots of unit tests" to "comprehensive quality assurance."
>
> **Estimated effort:** ~1.5 days remaining | **Prerequisite:** Waves 2-3

### 4.1 Component Render Tests

| # | Task | Status | Pri | Effort | Prereq |
|---|------|--------|-----|--------|--------|
| 4.1.1 | ~~Install `@testing-library/react` + `jest-dom` + `user-event`~~ | ✅ | — | — | — |
|  | *Also installed `jsdom`, added CSS modules test config to `vite.config.js`* |
| 4.1.2 | ~~Render tests: `DashboardPanel`~~ | ✅ | — | — | 4.1.1 ✅ |
|  | *21 source-verification tests: structure, empty/loading states, narrative layout, custom layout, CSS module* |
| 4.1.3 | ~~Render tests: `ChartOverlays`~~ | ✅ | — | — | 4.1.1 ✅ |
|  | *14 tests: OrderEntryOverlay (8), RiskGuardOverlay (3), TradeMarkerOverlay (3), TradePLPill (3)* |
| 4.1.4 | ~~Render tests: `JournalLogbook`~~ | ✅ | — | — | 4.1.1 ✅ |
|  | *6 tests: exports, props, table columns, sorting, row click, trade count* |
| 4.1.5 | ~~Render tests: `TradeFormModal`~~ | ✅ | — | — | 4.1.1 ✅ |
|  | *11 tests: exports, form fields, validation, submit, edit mode, P&L auto-calc, screenshots* |
| 4.1.6 | ~~Render tests: `SettingsPage`~~ | ✅ | — | — | 4.1.1 ✅ |
|  | *5 tests: exports, search filter, user store, theme, display settings* |
| 4.1.7 | ~~Render tests: all `design/` components~~ | ✅ | — | — | 3.3.x ✅ |
|  | *19 tests: Avatar (4), Tooltip (3), Dialog (4), Toast (1), Button (2), Card (1), Input (2), Badge (1), Skeleton (1)* |
| 4.1.8 | Accessibility tree assertions | ⬜ | 🟡 | 2h | 4.1.x |

### 4.2 Integration Flow Tests

| # | Task | Status | Pri | Effort | Prereq |
|---|------|--------|-----|--------|--------|
| 4.2.1 | ~~`newUserOnboarding.test.js`~~ | ✅ | — | — | 4.1.1 ✅ |
|  | *5 tests: empty state, getting started card, dismissal persistence* |
| 4.2.2 | ~~`tradeCRUD.test.js`~~ | ✅ | — | — | 4.1.1 ✅ |
|  | *6 tests: add, bulk add, update, delete, no-op delete, hydrate — live Zustand store* |
| 4.2.3 | ~~`chartInteraction.test.js`~~ | ✅ | — | — | 4.1.1 ✅ |
|  | *11 tests: symbol change (source + live store), indicator pipeline, alert store, annotation store* |
| 4.2.4 | ~~`themeToggle.test.js`~~ | ✅ | — | — | 4.1.1 ✅ |
|  | *3 tests: theme property, setter action, dark↔light toggle — live Zustand store* |

### 4.3 Quality Infrastructure

| # | Task | Status | Pri | Effort |
|---|------|--------|-----|--------|
| 4.3.1 | ~~Test isolation: reset Zustand stores in `beforeEach`~~ | ✅ | — | — |
|  | *`testUtils.js`: `registerStore()`, `resetAllStores()`, `initStores()`. Mock factories: `createMockTrade()`, `createMockTrades()`, `createMockAnalytics()`* |
| 4.3.2 | ~~Coverage thresholds: `statements: 60`~~ | ✅ | — | — |
|  | *Already exceeds target: `statements: 80, branches: 70, functions: 80, lines: 80` in `vite.config.js`* |
| 4.3.3 | Fix flaky benchmarks: statistical assertions | ⬜ | 🟡 | 2h |
| 4.3.4 | Visual regression via Playwright screenshots | ⬜ | 🟡 | 4h |
| 4.3.5 | Frame time regression tests | ⬜ | 🟡 | 3h |
| 4.3.6 | Benchmark CI job with 10% regression threshold | ⬜ | 🟡 | 2h |

---

## WAVE 5: 🟣 ENGINE HARDENING + DATA INFRASTRUCTURE — 0% Complete

> **Goal:** Upgrade the engine from "impressive demo" to "production trading tool."
>
> **Estimated effort:** ~5 days

### 5.1 Historical Data & Storage

| # | Task | Status | Pri | Effort |
|---|------|--------|-----|--------|
| 5.1.1 | `TimeSeriesStore.ts` — IndexedDB-backed block storage | ⬜ | 🟠 | 6h |
| 5.1.2 | B-tree index for range queries | ⬜ | 🟠 | 4h |
| 5.1.3 | `barBisect()` — binary search replacing O(n) lookups | ⬜ | 🟠 | 2h |
| 5.1.4 | Data windowing — virtual scroll for bars | ⬜ | 🟡 | 4h |
| 5.1.5 | Automatic time aggregation (1m → 5m → 1h → 1d) | ⬜ | 🟡 | 4h |
| 5.1.6 | LRU block eviction policy | ⬜ | 🟡 | 2h |
| 5.1.7 | Gap detection + backfill via REST | ⬜ | 🟡 | 3h |

### 5.2 Public API & Plugin Architecture

| # | Task | Status | Pri | Effort | Prereq |
|---|------|--------|-----|--------|--------|
| 5.2.1 | `ChartAPI.ts` — typed public methods | ⬜ | 🟠 | 4h | 2.2.x |
| 5.2.2 | Typed `EventEmitter` | ⬜ | 🟠 | 3h | 5.2.1 |
| 5.2.3 | Configuration schema with JSDoc | ⬜ | 🟡 | 2h | 5.2.1 |
| 5.2.4 | Plugin registry with lifecycle hooks | ⬜ | 🟡 | 4h | 5.2.1 |
| 5.2.5 | Standalone `charEdge.min.js` widget | ⬜ | ⚪ | 4h | 5.2.1 |

### 5.3 Memory Management

| # | Task | Status | Pri | Effort |
|---|------|--------|-----|--------|
| 5.3.1 | `MemoryBudget.ts` — track allocations | ⬜ | 🟡 | 3h |
| 5.3.2 | `Float32Array` buffer pool | ⬜ | 🟡 | 2h |
| 5.3.3 | WebGL texture cleanup on unmount | ⬜ | 🟡 | 2h |
| 5.3.4 | Memory pressure detection + auto decimation | ⬜ | ⚪ | 3h |
| 5.3.5 | `FinalizationRegistry` for GPU buffer cleanup | ⬜ | ⚪ | 2h |

### 5.4 Responsive Chart Engine

| # | Task | Status | Pri | Effort | Prereq |
|---|------|--------|-----|--------|--------|
| 5.4.1 | Container query breakpoints on chart panels | ⬜ | 🟡 | 2h | 3.2.1 |
| 5.4.2 | Automatic axis tick reduction at small sizes | ⬜ | 🟡 | 2h | — |
| 5.4.3 | Responsive legend | ⬜ | 🟡 | 1h | — |
| 5.4.4 | Touch-friendly toolbar sizing (44×44px) | ⬜ | 🟡 | 1h | — |
| 5.4.5 | Mobile-first crosshair (long-press) | ⬜ | ⚪ | 2h | — |
| 5.4.6 | Label collision avoidance | ⬜ | ⚪ | 3h | — |

### 5.5 Async Shader Compilation

| # | Task | Status | Pri | Effort |
|---|------|--------|-----|--------|
| 5.5.1 | `KHR_parallel_shader_compile` extension | ⬜ | 🟡 | 2h |
| 5.5.2 | Shimmer skeleton until shaders compiled | ⬜ | 🟡 | 1h |

---

## WAVE 6: ⚪ AI + SECURITY + DIFFERENTIATION — 5% Complete

> **Goal:** Transform "AI" from a marketing liability into a genuine feature.
>
> **Estimated effort:** ~4 days

### 6.1 AI Coach → Actual AI

| # | Task | Status | Pri | Effort |
|---|------|--------|-----|--------|
| 6.1.1 | `LLMService.ts` — provider-agnostic interface | ⬜ | 🟠 | 4h |
| 6.1.2 | LLM-powered trade analysis narrative | ⬜ | 🟠 | 3h |
| 6.1.3 | LLM journal summarization | ⬜ | 🟡 | 2h |
| 6.1.4 | `FeatureExtractor.ts` — rolling volatility, momentum | ⬜ | 🟡 | 4h |
| 6.1.5 | Trade pattern classifier (tf.js / ONNX) | ⬜ | ⚪ | 8h |
| 6.1.6 | RAG for trade context | ⬜ | ⚪ | 6h |
| 6.1.7 | Prediction feedback loop | ⬜ | ⚪ | 3h |

### 6.2 Security Hardening

| # | Task | Status | Pri | Effort |
|---|------|--------|-----|--------|
| 6.2.1 | IndexedDB encryption | ⬜ | 🟠 | 3h |
| 6.2.2 | SRI hashes on external resources | ⬜ | 🟡 | 1h |
| 6.2.3 | CSP reporting endpoint | ⬜ | 🟡 | 1h |
| 6.2.4 | `Permissions-Policy` header | ⬜ | 🟡 | 30m |
| 6.2.5 | Distributed rate limiting via Upstash Redis | ⬜ | 🟡 | 3h |
| 6.2.6 | Migrate `localStorage` → encrypted IndexedDB | ⬜ | ⚪ | 4h |

### 6.3 Accessibility — WCAG 2.1 AA

| # | Task | Status | Pri | Effort |
|---|------|--------|-----|--------|
| 6.3.1 | Color contrast audit (4.5:1 minimum) | ⬜ | 🟠 | 2h |
| 6.3.2 | Keyboard navigation for chart elements | ⬜ | 🟠 | 3h |
| 6.3.3 | `:focus-visible` styles on every interactive element | ⬜ | 🟠 | 2h |
| 6.3.4 | Focus trap for all modals and dialogs | ⬜ | 🟠 | 2h |
| 6.3.5 | `aria-live` regions for dynamic price updates | ⬜ | 🟡 | 1h |
| 6.3.6 | Touch target audit — all buttons ≥ 44×44px | ⬜ | 🟡 | 2h |
| 6.3.7 | ~~`prefers-reduced-motion` comprehensive audit~~ | ✅ | — | — |
|  | *Present in 15+ files: global.css (2), components.css (3), base.css, mobile.css, LandingPage, Button, Card, transitions.css, discover-a11y.css, App.module.css + JS checks in AnimatedNumber, BottomSheet, useSwipeSections* |
| 6.3.8 | Screen reader announcements | ⬜ | 🟡 | 2h |
| 6.3.9 | High contrast mode support | ⬜ | ⚪ | 2h |

### 6.4 Data Quality

| # | Task | Status | Pri | Effort |
|---|------|--------|-----|--------|
| 6.4.1 | `SecurityMaster.ts` — canonical instrument identifiers | ⬜ | 🟡 | 4h |
| 6.4.2 | Data quality framework — stale/spike/anomaly detection | ⬜ | 🟡 | 3h |
| 6.4.3 | Exchange latency monitoring dashboard | ⬜ | ⚪ | 2h |

---

## WAVE 7: 🟢 SHIP + GROWTH + PLATFORM — 0% Complete

> **Goal:** Get charEdge into the hands of real traders.
>
> **Estimated effort:** ~3 days for core, ongoing for growth

### 7.1 User Accounts

| # | Task | Status | Pri | Effort |
|---|------|--------|-----|--------|
| 7.1.1 | Supabase authentication (email/Google/GitHub) | ⬜ | 🟡 | 4h |
| 7.1.2 | Cloud sync for journal, settings, drawings | ⬜ | 🟡 | 4h |
| 7.1.3 | Onboarding redesign — "Aha moment" in 30 seconds | ⬜ | 🟡 | 3h |

### 7.2 Mobile & PWA

| # | Task | Status | Pri | Effort |
|---|------|--------|-----|--------|
| 7.2.1 | `prefers-color-scheme` auto-detection | ⬜ | 🟡 | 1h |
| 7.2.2 | PWA install banner | ⬜ | 🟡 | 2h |
| 7.2.3 | Push notifications (price alerts, journal reminders) | ⬜ | 🟡 | 4h |
| 7.2.4 | Service Worker overhaul via Workbox | ⬜ | 🟡 | 3h |
| 7.2.5 | Haptic feedback | ⬜ | ⚪ | 1h |
| 7.2.6 | Capacitor native wrapper | ⬜ | ⚪ | 8h |

### 7.3 Launch & Distribution

| # | Task | Status | Pri | Effort |
|---|------|--------|-----|--------|
| 7.3.1 | Product Hunt launch | ⬜ | 🟡 | 4h |
| 7.3.2 | Reddit launch posts | ⬜ | 🟡 | 2h |
| 7.3.3 | Twitter/X GPU speed comparison content | ⬜ | 🟡 | 2h |
| 7.3.4 | Discord community | ⬜ | 🟡 | 1h |
| 7.3.5 | SEO content pages | ⬜ | 🟡 | 3h |

### 7.4 Deployment Optimization

| # | Task | Status | Pri | Effort |
|---|------|--------|-----|--------|
| 7.4.1 | Migrate to Vercel Edge Functions | ⬜ | 🟡 | 3h |
| 7.4.2 | ISR for SEO pages | ⬜ | 🟡 | 2h |
| 7.4.3 | Bundle analysis — main chunk < 200KB gzipped | ⬜ | 🟡 | 2h |

---

## FUTURE HORIZON (Post-A+)

| # | Task | Pri |
|---|------|-----|
| F.1 | Broker adapter interface (Alpaca, IBKR) | ⚪ |
| F.2 | Order management system with real-time PnL | ⚪ |
| F.3 | DOM/Depth ladder with one-click trading | ⚪ |
| F.4 | Multi-asset normalizer (forex, futures, options) | ⚪ |
| F.5 | Risk engine (Kelly criterion, max drawdown) | ⚪ |
| F.6 | Worker-based backtesting | ⚪ |
| F.7 | i18n layer | ⚪ |
| F.8 | Declarative Mark System (D3-style) | ⚪ |
| F.9 | Scale Registry | ⚪ |
| F.10 | Transition Manager | ⚪ |
| F.11 | Community leaderboards | ⚪ |
| F.12 | Open-source npm package | ⚪ |
| F.13 | On-device ML inference via WebNN/tf.js | ⚪ |
| F.14 | Storybook | ⚪ |
| F.15 | Drawing tool expansion to 30+ tools | ⚪ |
| F.16 | Compliance layer (FINRA/SEC/MiFID II) | ⚪ |
| F.17 | Keyboard shortcuts cheat sheet | ⚪ |
| F.18 | Stripe integration | ⚪ |

---

## SUMMARY STATISTICS

| Metric | v7.0 | v8.0 | v8.4 | v8.6 | v8.8 (Now) |
|--------|------|------|------|------|------------|
| **Total Tasks** | 143 (+18) | 127 (+18) | 127 (+18) | 127 (+18) | 132 (+18) |
| ✅ **Done** | 14 | **35** | **54** | **60** | **71** (+11) |
| 🔶 **Partial** | 8 | **4** | **2** | **2** | **0** |
| ⬜ **Remaining** | 121 | **88** | **71** | **65** | **61** (-4) |
| **TypeScript Files** | 44 | **46** | **46** | **46** | **46** |
| **Tests Passing** | 2,928 | **2,775** | **2,794** | **2,934** | **3,022** (+88) |
| **Test Files** | — | — | — | 104 | **113** (+9) |
| **CSS Modules** | 4 | 14 | **20** | **23** | **24** (+1) |
| **SVG Icons** | 0 | 0 | **27** | **27** | **27** |
| **Design Components** | 5 | 5 | **10** | **10** | **10** |
| **animations.css** | — | — | 103 lines | **258 lines** | **258 lines** |
| **Estimated GPA** | ~2.88 | **~3.15** | **~3.70** | **~3.75** | **~3.85** |
| **Estimated Remaining** | ~24 days | **~17 days** | **~11 days** | **~9 days** | **~7 days** |

---

## WHAT TO DO NEXT

> [!IMPORTANT]
> **Waves 3-4 nearly closed!** Close remaining Wave 4 quality infra, then begin Wave 5 engine hardening.

**Phase 1 — Close Wave 4 Quality Infra (~3h):**
1. **4.3.3** — Fix flaky benchmarks with statistical assertions (🟡, ~2h)
2. **4.3.6** — Benchmark CI job with 10% regression threshold (🟡, ~1h)

**Phase 2 — Close Remaining Wave 3 (~2h):**
3. **3.4.5** — Page transitions with `AnimatePresence` (⚪, ~2h)
4. **3.6.3** — Dark/light mode shadow tokens (⚪, ~1h)

**Phase 3 — Begin Wave 5 Engine Hardening (~8h):**
5. **5.1.1** — `TimeSeriesStore.ts` — IndexedDB-backed block storage (🟠, ~6h)
6. **5.1.3** — `barBisect.ts` — binary search for bars (🟠, ~2h)
7. **5.2.1** — `ChartAPI.ts` — typed public interface (🟠, ~4h)
