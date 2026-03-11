# charEdge — ULTIMATE STRATEGIC TASK LIST v9.0

> **Date:** March 4, 2026 | **Baseline:** v8.8 → v9.0 | **Current GPA:** ~4.05
>
> **Codebase Snapshot:** 986 files · 102,000+ LOC · **151** test files · **255** .ts files (**26%**) · **29** CSS modules · 11 design components · **27** SVG icons · 7 WGSL shaders · 16 E2E specs

---

## PROGRESS SNAPSHOT

```
WAVE 1 ██████████ 100%   (18 ✅  0 🔶   0 ⬜)  Integrity & CI
WAVE 2 ██████████ 100%   (18 ✅  0 🔶   0 ⬜)  TS Migration & Decomp
WAVE 3 █████████░  90%   (22 ✅  0 🔶   2 ⬜)  CSS & Design System
WAVE 4 ██████░░░░  64%   (12 ✅  0 🔶   5 ⬜)  Testing Depth
WAVE 5 ███░░░░░░░  30%   ( 6 ✅  0 🔶  14 ⬜)  Engine & Data Infra
WAVE 6 █░░░░░░░░░   5%   ( 1 ✅  0 🔶  25 ⬜)  AI & Differentiation
WAVE 7 ░░░░░░░░░░   0%   ( 0 ✅  0 🔶  19 ⬜)  Ship & Growth
WAVE 8 ██████████ 100%   ( 8 ✅  0 🔶   0 ⬜)  Chart Feel & Hardening
─────────────────────────────────────────────
TOTAL  ██████░░░░  58%   (85 ✅  0 🔶  65 ⬜)
```

### Key Wins Since v8.8

- **Wave 8 "Chart Feel"** — `TickChannel.ts` (168L), `FormingCandleInterpolator.ts` (217L), direct data flow to ChartEngine, numeric timestamps in hot paths
- **Engine Hardening** — `MemoryBudget.js` (252L) wired to render loop, `GPUMemoryBudget.ts` (188L), `GapDetector.ts` (177L), per-adapter rate budget tracking
- **Safari Fix** — `requestIdleCallback` polyfill, stale SW self-destruct, ChunkErrorBoundary
- **Data Quality** — canonical data schemas, gap detection + backfill
- **Infrastructure** — Staging env (`vercel.staging.json`), fuzzy symbol search, TDZ sweep across codebase
- **E2E Overhaul** — 16 E2E specs with realistic user workflow scenarios
- **TypeScript** — 255 .ts files (up from 46), 26% coverage (up from 5.3%)

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

> All tasks complete. See v8.8 for details.

| Section | Status | Highlights |
|---------|--------|------------|
| 1.1 OffscreenCanvas Decision | ✅ | KEEP. Legitimate usage in 6 rendering modules |
| 1.2 Dead Code Purge | ✅ | knip audit, quarantined modules removed |
| 1.3 CI Pipeline | ✅ | GitHub Actions: lint/typecheck/test/build/audit |
| 1.4 Production Observability | ✅ | Vercel Analytics, Sentry, Web Vitals, PostHog |

---

## WAVE 2: 🟠 TYPESCRIPT MIGRATION + MODULE DECOMPOSITION — 100% Complete ✅

> All tasks complete. See v8.8 for details.

| Section | Status | Highlights |
|---------|--------|------------|
| 2.1 God Object Decomposition | ✅ | DrawingRenderer → 7 sub-renderers, computations.js → 14 .ts files |
| 2.2 TypeScript Conversion | ✅ | 255 .ts files, 31/31 stores `@ts-check`, `TickerPlant.ts` (920L) |
| 2.3 Documentation | ✅ | Getting started, CONTRIBUTING, architecture diagram, TypeDoc |
| 2.4 Naming Convention | ✅ | ESLint rules enforced on .ts/.tsx |

---

## WAVE 3: 🟡 CSS ARCHITECTURE + DESIGN SYSTEM — 90% Complete

> **Remaining effort:** ~4h (low-priority polish)

| # | Task | Status | Pri | Effort |
|---|------|--------|-----|--------|
| 3.2.2 | Replace `useBreakpoints()` with `@container` queries | ⬜ | 🟡 | 3h |
| 3.2.3 | `@property` declarations for theme color interpolation | ⬜ | 🟡 | 1h |
| 3.4.5 | Page transitions with `AnimatePresence` | ⬜ | ⚪ | 2h |
| 3.6.3 | Dark/light mode shadow treatments | ⬜ | ⚪ | 1h |

*Everything else in Wave 3 is done: CSS modules (29), component library (11), animations.css (258L, 20+ keyframes), icon system (27 SVG), typography tokens.*

---

## WAVE 4: 🔵 TESTING DEPTH + QUALITY GATES — 64% Complete

> **Remaining effort:** ~1.5 days

| # | Task | Status | Pri | Effort |
|---|------|--------|-----|--------|
| 4.1.8 | Accessibility tree assertions | ⬜ | 🟡 | 2h |
| 4.3.3 | Fix flaky benchmarks: statistical assertions | ⬜ | 🟡 | 2h |
| 4.3.4 | Visual regression via Playwright screenshots | ⬜ | 🟡 | 4h |
| 4.3.5 | Frame time regression tests | ⬜ | 🟡 | 3h |
| 4.3.6 | Benchmark CI job with 10% regression threshold | ⬜ | 🟡 | 2h |

*All component render tests (DashboardPanel, ChartOverlays, JournalLogbook, TradeFormModal, SettingsPage, design components), integration flows, and test infrastructure are done.*

---

## WAVE 5: 🟣 ENGINE HARDENING + DATA INFRASTRUCTURE — 30% Complete

> **Goal:** Upgrade from "impressive demo" to "production trading tool."

### 5.1 Historical Data & Storage

| # | Task | Status | Pri | Effort |
|---|------|--------|-----|--------|
| 5.1.1 | `TimeSeriesStore.ts` — IndexedDB-backed block storage | ⬜ | 🟠 | 6h |
| 5.1.2 | B-tree index for range queries | ⬜ | 🟠 | 4h |
| 5.1.3 | `barBisect()` — binary search replacing O(n) lookups | ⬜ | 🟠 | 2h |
| 5.1.4 | Data windowing — virtual scroll for bars | ⬜ | 🟡 | 4h |
| 5.1.5 | Automatic time aggregation (1m → 5m → 1h → 1d) | ⬜ | 🟡 | 4h |
| 5.1.6 | LRU block eviction policy | ⬜ | 🟡 | 2h |
| 5.1.7 | ~~Gap detection + backfill via REST~~ | ✅ | — | — |
|  | *`GapDetector.ts` (177L) — canonical gap detection with backfill* |

### 5.2 Public API & Plugin Architecture

| # | Task | Status | Pri | Effort |
|---|------|--------|-----|--------|
| 5.2.1 | `ChartAPI.ts` — typed public methods | ⬜ | 🟠 | 4h |
| 5.2.2 | Typed `EventEmitter` | ⬜ | 🟠 | 3h |
| 5.2.3 | Configuration schema with JSDoc | ⬜ | 🟡 | 2h |
| 5.2.4 | Plugin registry with lifecycle hooks | ⬜ | 🟡 | 4h |
| 5.2.5 | Standalone `charEdge.min.js` widget | ⬜ | ⚪ | 4h |

### 5.3 Memory Management

| # | Task | Status | Pri | Effort |
|---|------|--------|-----|--------|
| 5.3.1 | ~~`MemoryBudget` — track allocations~~ | ✅ | — | — |
|  | *`MemoryBudget.js` (252L) + `GPUMemoryBudget.ts` (188L), wired to render loop* |
| 5.3.2 | `Float32Array` buffer pool | ⬜ | 🟡 | 2h |
| 5.3.3 | WebGL texture cleanup on unmount | ⬜ | 🟡 | 2h |
| 5.3.4 | Memory pressure detection + auto decimation | ⬜ | ⚪ | 3h |
| 5.3.5 | `FinalizationRegistry` for GPU buffer cleanup | ⬜ | ⚪ | 2h |

### 5.4 Responsive Chart Engine

| # | Task | Status | Pri | Effort |
|---|------|--------|-----|--------|
| 5.4.1 | Container query breakpoints on chart panels | ⬜ | 🟡 | 2h |
| 5.4.2 | Automatic axis tick reduction at small sizes | ⬜ | 🟡 | 2h |
| 5.4.3 | Responsive legend | ⬜ | 🟡 | 1h |
| 5.4.4 | Touch-friendly toolbar sizing (44×44px) | ⬜ | 🟡 | 1h |
| 5.4.5 | Mobile-first crosshair (long-press) | ⬜ | ⚪ | 2h |
| 5.4.6 | Label collision avoidance | ⬜ | ⚪ | 3h |

### 5.5 Async Shader Compilation

| # | Task | Status | Pri | Effort |
|---|------|--------|-----|--------|
| 5.5.1 | `KHR_parallel_shader_compile` extension | ⬜ | 🟡 | 2h |
| 5.5.2 | Shimmer skeleton until shaders compiled | ⬜ | 🟡 | 1h |

### 5.6 🆕 Trade Context Capture ("Invisible Journal")

> *New — Phase 1 of Trading Journal Strategy. The foundation for every analytics upgrade below.*

| # | Task | Status | Pri | Effort | Description |
|---|------|--------|-----|--------|-------------|
| 5.6.1 | `TradeSnapshot.ts` — market state capture schema | ⬜ | 🔴 | 3h | JSON schema: price, volume, RSI, EMA, order book depth at execution time |
| 5.6.2 | `SnapshotCapture` hook — auto-capture on trade log | ⬜ | 🔴 | 4h | When `addTrade()` fires, read chart state + attach as `trade.context.snapshot` |
| 5.6.3 | Ghost Chart — persist drawing layers per trade | ⬜ | 🟡 | 3h | Serialize `useAnnotationStore` drawings; restore on TradeReplay |
| 5.6.4 | MFE/MAE intra-trade tracking | ⬜ | 🟠 | 4h | Record max favorable / max adverse excursion via tick stream |
| 5.6.5 | Multi-timeframe snapshot viewer | ⬜ | 🟡 | 3h | UI: 1m/5m/15m/1H/4H indicator states at trade entry |
| 5.6.6 | `TruePnL.ts` — fee decomposition | ⬜ | 🟠 | 3h | True P&L = Price Move − Commissions − Funding Rates − Slippage |
| 5.6.7 | `RegimeTagger.ts` — market regime detection | ⬜ | 🟡 | 3h | Auto-tag Trending/Ranging/Volatile using ATR + ADX from snapshot |
| 5.6.8 | Auto-Screenshot — pixel capture on trade execution | ⬜ | 🟡 | 2h | `canvas.toDataURL()` → clean + indicator overlay PNGs → IndexedDB |

---

## WAVE 6: ⚪ AI + BEHAVIORAL INTELLIGENCE + DIFFERENTIATION — 5% Complete

> **Goal:** Transform charEdge from "trading journal" to "Decision Intelligence Co-Pilot."

### 6.1 AI Coach → Actual AI

| # | Task | Status | Pri | Effort |
|---|------|--------|-----|--------|
| 6.1.1 | `LLMService.ts` — provider-agnostic interface | ⬜ | 🟠 | 4h |
| 6.1.2 | LLM-powered trade analysis narrative | ⬜ | 🟠 | 3h |
| 6.1.3 | LLM journal summarization | ⬜ | 🟡 | 2h |
| 6.1.3a | 🆕 Journal Note Mining — pattern extraction from text | ⬜ | 🟡 | 3h |
|  | *AI reads notes, finds recurring keywords in losing trades (e.g., "tired", "missed move")* |
| 6.1.4 | `FeatureExtractor.ts` — rolling volatility, momentum | ⬜ | 🟡 | 4h |
| 6.1.5 | Trade pattern classifier (tf.js / ONNX) | ⬜ | ⚪ | 8h |
| 6.1.6 | RAG for trade context | ⬜ | ⚪ | 6h |
| 6.1.7 | Prediction feedback loop | ⬜ | ⚪ | 3h |
| 6.1.8 | 🆕 Voice-to-Journal — Web Speech API transcription | ⬜ | 🟡 | 3h |
|  | *Mic button on trade form → transcribe → notes field + auto-tag emotions* |
| 6.1.9 | 🆕 AI Session Summary — daily narrative report | ⬜ | 🟡 | 3h |
|  | *Post-market LLM combines debrief stats + notes into narrative summary* |
| 6.1.10 | 🆕 Warden Agent — behavioral tilt auto-lock | ⬜ | ⚪ | 4h |
|  | *3+ Revenge/FOMO tags → mandatory 1hr cooldown. Extend session slice logic.* |

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
| 6.3.8 | Screen reader announcements | ⬜ | 🟡 | 2h |
| 6.3.9 | High contrast mode support | ⬜ | ⚪ | 2h |

### 6.4 Data Quality

| # | Task | Status | Pri | Effort |
|---|------|--------|-----|--------|
| 6.4.1 | `SecurityMaster.ts` — canonical instrument identifiers | ⬜ | 🟡 | 4h |
| 6.4.2 | Data quality framework — stale/spike/anomaly detection | ⬜ | 🟡 | 3h |
| 6.4.3 | Exchange latency monitoring dashboard | ⬜ | ⚪ | 2h |

### 6.5 🆕 Behavioral Intelligence ("Leak Detection")

> *New — Phase 1.2 + 2.1 of Trading Journal Strategy. The "aha moment" features.*

| # | Task | Status | Pri | Effort | Description |
|---|------|--------|-----|--------|-------------|
| 6.5.1 | `LeakDetector.ts` — automatic behavioral tagging | ⬜ | 🔴 | 4h | Auto-tag: "Early Exit/Fear" (close >50% before TP), "Hope Trading" (SL moved), "Revenge Trade" (<2min after loss), "FOMO Entry" (no plan attached) |
| 6.5.2 | Reaction Bar — post-trade quick capture | ⬜ | 🔴 | 3h | 2-tap widget after trade: Mood (Neutral/Stressed/FOMO/Confident) + Process (Perfect/Deviation/Gambled). Auto-dismiss 30s. |
| 6.5.3 | Discipline Curve — actual vs. "if I followed rules" | ⬜ | 🟡 | 4h | Equity sim: real balance vs. excluding Revenge/FOMO/Hope-tagged trades |
| 6.5.4 | Expectancy display — (Win% × Avg Win R) − (Loss% × Avg Loss R) | ⬜ | 🟡 | 2h | Prominent in analytics overview + "walking liquidation" warning if negative |
| 6.5.5 | Rule Engine v2 — automated plan compliance | ⬜ | 🟡 | 4h | User-defined rules (max risk %, max daily loss) checked on `addTrade()`. Violations → toast + auto-tag. |
| 6.5.6 | Multi-axis heatmap — Profit × Asset × Session × Day | ⬜ | 🟡 | 4h | Selectable axes on heatmap: asset, day-of-week, hour, session |
| 6.5.7 | Setup Grading by day/session | ⬜ | ⚪ | 3h | "Bull Flag 70% win on Tue, 20% on Fri during London session" |

---

## WAVE 7: 🟢 SHIP + GROWTH + PLATFORM — 0% Complete

> **Goal:** Get charEdge into the hands of real traders.

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

### 7.5 🆕 Bot Integration ("Alpha Co-Pilot")

> *New — Phase 2.2 of Trading Journal Strategy.*

| # | Task | Status | Pri | Effort | Description |
|---|------|--------|-----|--------|-------------|
| 7.5.1 | Bot API Listener — ingest arb bot execution logs | ⬜ | 🟡 | 4h | WebSocket/REST listener for bot trades → auto-populate journal |
| 7.5.2 | Bot vs. Human Benchmarking dashboard | ⬜ | 🟡 | 4h | Side-by-side: bot win rate, expectancy, avg R vs. manual trades |
| 7.5.3 | Alpha Leakage metric | ⬜ | ⚪ | 3h | Show if manual interventions degrade or improve bot performance |

---

## WAVE 8: 🔥 CHART FEEL & ENGINE HARDENING — 100% Complete ✅

> **Status:** All tasks complete.

| # | Task | Status | Evidence |
|---|------|--------|----------|
| 8.1 | `TickChannel.ts` — direct data flow to ChartEngine | ✅ | 168L, bypasses store for tick-level rendering |
| 8.2 | `FormingCandleInterpolator.ts` — smooth candle animation | ✅ | 217L, spring-based interpolation replaces ad-hoc physics |
| 8.3 | Numeric timestamps in hot paths | ✅ | Eliminated `new Date()` in CoordinateSystem, barCountdown |
| 8.4 | `MemoryBudget` wired to render loop | ✅ | 252L + GPUMemoryBudget (188L), performance throttling |
| 8.5 | Per-adapter rate budget tracking | ✅ | Rate limiting per data provider |
| 8.6 | `GapDetector.ts` — data gap detection + backfill | ✅ | 177L, canonical schema enforcement |
| 8.7 | Safari `requestIdleCallback` polyfill | ✅ | Mobile Safari blank screen fix |
| 8.8 | Staging environment | ✅ | `vercel.staging.json` + deploy script |

---

## FUTURE HORIZON (Post-Launch)

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
| F.19 | Computer Vision pattern recognition on snapshots | ⚪ |
| F.20 | PostgreSQL backend for multi-device sync | ⚪ |
| F.21 | Predictive Edge Discovery (ML-graded setups) | ⚪ |

---

## SUMMARY STATISTICS

| Metric | v7.0 | v8.0 | v8.8 | **v9.0 (Now)** |
|--------|------|------|------|----------------|
| **Total Tasks** | 143 | 127 | 132 | **150** (+18 journal) |
| ✅ **Done** | 14 | 35 | 71 | **85** (+14) |
| 🔶 **Partial** | 8 | 4 | 0 | **0** |
| ⬜ **Remaining** | 121 | 88 | 61 | **65** (+4 net) |
| **TypeScript Files** | 44 | 46 | 46 | **255** |
| **TS Coverage** | 4.9% | 5.3% | 5.3% | **26%** |
| **Tests Passing** | 2,928 | 2,775 | 3,022 | **3,022+** |
| **Test Files** | — | — | 113 | **151** |
| **E2E Specs** | — | — | — | **16** |
| **CSS Modules** | 4 | 14 | 24 | **29** |
| **SVG Icons** | 0 | 0 | 27 | **27** |
| **Design Components** | 5 | 5 | 10 | **11** |
| **WGSL Shaders** | — | — | 7 | **7** |
| **LOC** | — | — | — | **102,000+** |
| **Estimated GPA** | ~2.88 | ~3.15 | ~3.85 | **~4.05** |

---

## WHAT TO DO NEXT

> [!IMPORTANT]
> **New strategic priority: Trade Context Capture (5.6.x) + Leak Detection (6.5.x)**
> These are the features that make charEdge beat TraderSync, TradeZella, and TradesViz.

### Sprint A — "Invisible Journal" Foundation (Week 1-2, ~20h)

| # | Task | Effort | Why First |
|---|------|--------|-----------|
| 5.6.1 | `TradeSnapshot.ts` — market state schema | 3h | Everything depends on this |
| 5.6.2 | `SnapshotCapture` — auto-capture on trade | 4h | Immediate trade context ROI |
| 6.5.1 | `LeakDetector.ts` — behavioral auto-tags | 4h | The "aha" differentiator |
| 6.5.2 | Reaction Bar — 2-tap post-trade widget | 3h | Frictionless journaling USP |
| 6.5.4 | Expectancy display | 2h | Quick analytics win |
| 5.6.6 | `TruePnL.ts` — fee decomposition | 3h | Arb-specific differentiator |

### Sprint B — Analytics Layer (Week 3-4, ~24h)

| # | Task | Effort | Why |
|---|------|--------|-----|
| 5.6.4 | MFE/MAE tracking | 4h | "How much you left on the table" |
| 6.5.3 | Discipline Curve | 4h | Visual proof of rule-following impact |
| 6.5.5 | Rule Engine v2 | 4h | Automated plan compliance |
| 6.5.6 | Multi-axis heatmap | 4h | Profit × Asset × Session × Day |
| 5.6.3 | Ghost Chart drawings | 3h | Visual trade replay upgrade |
| 5.6.7 | Market Regime Tagger | 3h | Trending/Ranging/Volatile context |
| 5.6.8 | Auto-Screenshot capture | 2h | Pixel proof of every trade |

### Sprint C — AI Integration (Week 5-8, ~30h)

| # | Task | Effort | Why |
|---|------|--------|-----|
| 6.1.1 | `LLMService.ts` — AI foundation | 4h | All AI features depend on this |
| 6.1.8 | Voice-to-Journal | 3h | "Traders are lazy" — solved |
| 6.1.3a | Journal note mining | 3h | "You mention 'tired' in 80% of losses" |
| 6.1.9 | AI session summary | 3h | Automated daily narrative |
| 6.1.10 | Warden Agent | 4h | Tilt auto-lock |
| 5.1.1 | `TimeSeriesStore.ts` | 6h | Engine storage upgrade |
| 5.2.1 | `ChartAPI.ts` | 4h | Public API for plugins |
