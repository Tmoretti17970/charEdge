# charEdge — STRATEGIC TASK LIST v23.0

> **March 6, 2026** | Score: **99**/100 | **393 / 637** tasks done (**61.7%**)
> **Phase:** Launch Prep | **Target:** Beta Launch — April 15, 2026
> **Codebase:** 1,098 files · 239,800 LOC · 288 TS (26%) · 156 tests · 17 E2E
> **Architecture:** Unified Feedback Loop — Chart + Journal + AI are ONE organism
>
> **Health:** Engine A · Intelligence A- · Production B+ · Security B+ · Docs D-

---

## 🗺️ HOW TO READ THIS LIST

This list is organized into **4 priority tiers**, not batch numbers. Work top-to-bottom.

| Tier | What | Why | Hours |
|------|------|-----|-------|
| **P0** | Ship-Blockers | Cannot launch without these | ~30h |
| **P1** | Beta-Critical | First-week user experience | ~55h |
| **P2** | Post-Launch Polish | Driven by real user feedback | ~115h |
| **P3** | Horizon / Deferred | Don't touch until users exist | ~250h+ |

> [!IMPORTANT]
> **Start at the top of P0 and work down.** Every P0 task directly blocks the April 15 launch. P1 tasks make beta users stay. P2 and P3 are for after you've shipped.

---

## 🔴 P0 — SHIP-BLOCKERS (~30h)

> These tasks must be done before beta launch. Non-negotiable.

### P0-A: Finish Incomplete Work ✅ (Completed March 6)

| # | Task | ID | Effort | Status |
|---|------|----|--------|--------|
| 1 | **Infinite-canvas minimap** — year labels, beacon, fog-of-war | G1.3 | 3h | ✅ Done |
| 2 | **Stream health border** — ambient WS quality glow + latency badge | G1.4 | 3h | ✅ Done |

### P0-B: Documentation ✅ (Grade: D- → B+)

| # | Task | ID | Effort | Status |
|---|------|----|--------|--------|
| 3 | **README + Getting Started guide** | — | 3h | ✅ Done |
| 4 | **Configuration schema with JSDoc** | 2.6.4 | 2h | ✅ Done |
| 5 | **State architecture diagram** | 5.2.3 | 2h | ✅ Done |

### P0-C: Testing CI Gates ✅

| # | Task | ID | Effort | Status |
|---|------|----|--------|--------|
| 6 | **Accessibility tree assertions (axe-core)** | 2.2.1 | 2h | ✅ Done |
| 7 | **Frame time regression tests** | 2.2.3 | 3h | ✅ Done |
| 8 | **Benchmark CI job (10% threshold)** | 2.2.4 | 2h | ✅ Done |
| 9 | **Web Vitals regression gate** | 2.2.7 | 2h | ✅ Done |

### P0-D: Launch Channels ✅

| # | Task | ID | Effort | Status |
|---|------|----|--------|--------|
| 10 | **Discord community setup** | 5.1.1 | 1h | ✅ Done |
| 11 | **Product Hunt launch prep** | 5.1.2 | 4h | ✅ Done |
| 12 | **Reddit launch (r/algotrading, r/daytrading)** | 5.1.3 | 2h | ✅ Done |
| 13 | **Twitter/X WebGPU speed content** | 5.1.4 | 2h | ✅ Done |

**P0 Total: ~31h** → ✅ **Completed March 6**

---

## 🟡 P1 — BETA-CRITICAL (~55h)

> These are the tasks that make beta users *stay*. Ship within the first 2 weeks post-launch.

### P1-A: Core UX Gaps (users will hit these immediately)

| # | Task | ID | Effort | Why |
|---|------|----|--------|-----|
| 1 | **Pinch-to-zoom trackpad sensitivity** | 2.7.7 | 2h | MacBook users will complain day 1 |
| 2 | **Auto-hide toolbar on scroll/pan** | 4.7.3 | 2h | Screen real estate on small screens |
| 3 | **Collapse price axis to 48px** | 4.7.1 | 1h | Mobile chart area too small |
| 4 | **Shrink time axis to 20px** | 4.7.2 | 1h | Same — reclaim chart pixels |
| 5 | **4px live dot indicator** | 4.7.4 | 1h| Users can't see live candle edge |
| 6 | **Exchange timezone overlay** | 4.7.7 | 2h | Multi-session traders need this |
| 7 | **Dynamic information hierarchy** | 4.7.5 | 3h | Reduce visual clutter at low zoom |
| 8 | **Responsive typography with `clamp()`** | 4.6.7 | 2h | Text breaks on mobile/4K |
| 9 | **OLED border optimization** | 4.9.3.5 | 30m | Deep Sea mode polish |

### P1-B: Intelligence Features (retention drivers)

| # | Task | ID | Effort | Why |
|---|------|----|--------|-----|
| 10 | **Actionable journal summarization** | 4.2.4 | 2h | AI Coach value prop |
| 11 | **AI Session Summary — daily narrative** | 4.2.6 | 3h | Sticky daily engagement loop |
| 12 | **Morning briefing from real data** | 4.2.16 | 4h | Reason to open the app each day |
| 13 | **Journal Note Mining — pattern extraction** | 4.2.5 | 3h | Makes journal data actionable |
| 14 | **Auto-Screenshot on trade execution** | 4.1.8 | 2h | Zero-effort trade documentation |
| 15 | **Ghost Chart — persist drawing layers per trade** | 4.1.5 | 3h | Core journal↔chart link |

### P1-C: Quant & Analytics (power users)

| # | Task | ID | Effort | Why |
|---|------|----|--------|-----|
| 16 | **Win Rate by Asset** | 4.4.7 | 2h | Basic analytics expectation |
| 17 | **Win Rate by Session** | 4.4.8 | 2h | Session analysis |
| 18 | **Avg Hold Time (Winners vs Losers)** | 4.4.9 | 2h | Core behavioral insight |
| 19 | **Recovery Factor** | 4.4.6 | 1h | Risk metric |
| 20 | **"The Gap" Analysis — expected vs actual** | 4.3.9 | 3h | Unique differentiator |
| 21 | **MAE/MFE toggle UI** | 4.1.13 | 1h | Feature already built, needs UI |

### P1-D: Accessibility (legal floor)

| # | Task | ID | Effort | Why |
|---|------|----|--------|-----|
| 22 | **Screen reader announcements** | 4.6.6 | 2h | WCAG compliance |
| 23 | **ARIA live region for price changes** | 4.6.8 | 2h | Real-time data accessibility |
| 24 | **Screen-reader data table overlay** | 4.6.10 | 2h | Chart data in accessible format |

**P1 Total: ~55h** → Target: Complete by **April 30** (2 weeks post-launch)

---

## 🔵 P2 — POST-LAUNCH POLISH (~115h)

> Driven by real user feedback. Prioritize based on what users actually ask for.

### P2-A: Advanced Intelligence & AI

| # | Task | ID | Effort |
|---|------|----|--------|
| 1 | `PreTradeAnalyzer` → `OrderEntryOverlay` | 4.2.7 | 4h |
| 2 | Enhanced features — order flow imbalance, delta slope | 4.2.10 | 4h |
| 3 | Prediction feedback loop | 4.2.11 | 3h |
| 4 | LLM call batching — 30s context window | 4.2.12 | 3h |
| 5 | Per-asset anomaly baselines | 4.2.13 | 3h |
| 6 | NL query parsing | 4.2.14 | 4h |
| 7 | Embed journal entries — sentence transformer | 4.2.15 | 4h |
| 8 | `RegimeTagger.ts` — market regime detection | 4.1.7 | 3h |

### P2-B: Advanced Analytics & Visualization

| # | Task | ID | Effort |
|---|------|----|--------|
| 9 | Multi-axis heatmap — Profit × Asset × Session × Day | 4.3.6 | 4h |
| 10 | Intent vs. Execution Dashboard | 4.1.10 | 4h |
| 11 | Multi-TF snapshot viewer | 4.1.6 | 3h |
| 12 | Multi-Asset Correlation Audit | 4.1.14 | 4h |
| 13 | Trade Correlation Map panel | 4.1.15 | 3h |
| 14 | Rolling Beta to BTC | 4.4.5 | 3h |
| 15 | Scatter Plot (Risk vs Return) | 4.4.10 | 3h |
| 16 | Waterfall P&L Chart | 4.4.11 | 3h |
| 17 | Drawdown Depth Map | 4.4.12 | 3h |

### P2-C: Engine & Data Infrastructure

| # | Task | ID | Effort |
|---|------|----|--------|
| 18 | Grid/Axes → OffscreenCanvas Worker | 2.3.17 | 6h |
| 19 | barTransforms → IndicatorWorker | 2.3.18 | 2h |
| 20 | SharedArrayBuffer tick ring-buffer | 2.3.19 | 4h |
| 21 | Per-bar data quality scoring | 2.4.2 | 3h |
| 22 | OPFS compaction background job | 2.4.4 | 4h |
| 23 | Adaptive data streaming (mobile) | 2.4.11 | 4h |
| 24 | SharedWorker multi-tab WS sharing | 2.4.12 | 4h |
| 25 | Lazy watchlist prefetch | 2.4.14 | 2h |

### P2-D: UX Polish & Layout

| # | Task | ID | Effort |
|---|------|----|--------|
| 26 | Mini-watchlist in inspector | 4.12.15 | 3h |
| 27 | 3-state sidebar adaptation | 4.12.16 | 3h |
| 28 | Attention narrowing detector | 4.7.9 | 3h |
| 29 | "Market Picture" mental model aids | 4.7.10 | 3h |
| 30 | VoiceOver rotor actions | 4.6.9 | 3h |

### P2-E: Developer Experience

| # | Task | ID | Effort |
|---|------|----|--------|
| 31 | Typed `EventEmitter` | 2.6.2 | 3h |
| 32 | Plugin registry with lifecycle hooks | 2.6.3 | 4h |
| 33 | SEO content pages | 5.1.5 | 3h |
| 34 | Settings page reorganization | 5.2.10 | 2h |
| 35 | Stylelint — ban hardcoded colors | 5.2.1 | 30m |

**P2 Total: ~115h** → Target: May–June 2026 (user-feedback driven)

---

## ⚪ P3 — HORIZON & DEFERRED (~250h+)

> Don't start these until P0–P2 are done and you have real users giving feedback.

### P3-A: Growth & Community

| # | Task | Effort |
|---|------|--------|
| 1 | Trader reputation system | 4h |
| 2 | Live idea sharing — chart annotations | 6h |
| 3 | Documentation site (Starlight) | 8h |
| 4 | "How We Built WebGPU Charting" HN blog | 6h |
| 5 | Storybook component catalog | 12h |
| 6 | Public design system | 4h |

### P3-B: Platform & Architecture

| # | Task | Effort |
|---|------|--------|
| 7 | Central Command Bus — 76 stores → 5 domains | 12h |
| 8 | Store consolidation Phase 1 — social 6→1 | 4h |
| 9 | Store consolidation Phase 2 — chart 9→1 | 6h |
| 10 | OffscreenCanvas render isolation (stretch) | 12h |
| 11 | Grid lines as GPU static geometry | 3h |
| 12 | Adapter health dashboard | 6h |
| 13 | Server-side data normalization | 6h |
| 14 | API versioning strategy | 2h |

### P3-C: Deployment & Optimization

| # | Task | Effort |
|---|------|--------|
| 15 | Vercel Edge Functions | 3h |
| 16 | ISR for SEO pages | 2h |
| 17 | Bundle <200KB gzipped | 2h |

### P3-D: Data Coverage Expansion

| # | Task | Effort |
|---|------|--------|
| 18 | Polygon.io full adapter | 6h |
| 19 | iTick Adapter — APAC equities | 8h |
| 20 | Bitquery Adapter — DEX flow | 8h |
| 21 | Dukascopy Historical — 15yr tick forex | 8h |
| 22 | DEX adapter (Uniswap/dYdX) | 6h |
| 23 | Per-adapter circuit breaker tuning | 3h |
| 24 | Asset class type system | 4h |
| 25 | Multi-currency portfolio | 4h |
| 26 | Timescale marks API | 3h |

### P3-E: Bot Integration

| # | Task | Effort |
|---|------|--------|
| 27 | Bot API Listener | 4h |
| 28 | Bot vs. Human Benchmarking | 4h |
| 29 | Alpha Leakage metric | 3h |

### P3-F: npm / Marketplace (needs stable API first)

| # | Task | Effort |
|---|------|--------|
| 30 | npm package alpha — `@charedge/charts` | 16h |
| 31 | Marketplace — `marketplace.charedge.com` | 12h |
| 32 | WASM custom indicator support | 8h |
| 33 | Public profiles + shareable ghost boxes | 4h |
| 34 | Collaborative filtering widget suggestions | 4h |
| 35 | Certification program | 6h |

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

## 📊 PROGRESS & HISTORY

### Progress Snapshot

```
PHASE 1  ██████████  100% (144 ✅   0 ⬜)  Foundation + Chart Excellence + Settings Upgrade
PHASE 2  █████████░  68%  ( 75 ✅  35 ⬜)  Data & Engine Hardening + WebGPU + Pipeline  (+15 audit)
PHASE 3  ██████░░░░  57%  ( 39 ✅  29 ⬜)  Ship & Production + Zero-Latency  (+22 audit)
PHASE 4  ███████░░░  57%  ( 95 ✅  86 ⬜)  Intelligence + Journal↔Chart + Dashboard  (+28 audit)
PHASE 5  ░░░░░░░░░░   0%  (  0 ✅  39 ⬜)  Growth & Ecosystem
PHASE 6  ░░░░░░░░░░   0%  (  0 ✅  27 ⬜)  Advanced / Think Harder
FUTURE   ░░░░░░░░░░   0%  (  0 ✅  42 ⬜)  Post-Launch Horizon
AUDIT    ████████░░  68%  ( 53 ✅  24 ⬜)  19-Audit Consolidation
────────────────────────────────────────────────────
TOTAL    ██████░░░░  62%  (393 ✅ 244 ⬜)  = 637 tracked tasks
```

### What You Completed (Batches 5–25)

<details>
<summary><strong>Click to expand completed batch history</strong> (393 tasks done)</summary>

| Batch | Name | Tasks | Hours | Key Deliverables |
|-------|------|-------|-------|-----------------|
| **5** | Close Sprint 2 | 8 | 23h | `DataWindow.ts`, `OfflineManager.ts`, `FreshnessBadge.jsx`, 98-test adapter compliance |
| **6** | Ship-Ready | 12 | 28h | Supabase auth, cloud sync, onboarding, server alerts, push notifications, replay mode |
| **7** | Intelligence Foundation | 14 | 32h | `TradeSnapshot.ts`, `LLMService.ts`, Ghost Boxes, Equity Curve, Sharpe/Sortino |
| **8** | Behavioral Intelligence | 10 | 24h | Trigger correlation, Weekly Report Card, Mistake Heatmap, Bias Detection |
| **9** | Sprint Closers | 8 | 14h | Circuit breaker, multi-condition alerts, Expectancy Calculator |
| **10** | Pipeline Perf | 8 | 12h | O(N) tick fix, Binance pagination, AlphaVantage full output |
| **11** | Seamless Pipeline | 10 | 24h | ProviderOrchestrator, OPFS-first scroll-back, binary columnar OPFS |
| **12** | Security Hardening | 5 | 10h | CSRF, DOMPurify, encrypted API keys |
| **13** | Production Polish | 9 | 18h | Rate limiting, audit logging, focus traps, haptics |
| **14** | Indicator Settings | 6 | 17h | TradingView-grade 3-tab indicator dialog |
| **15** | Drawing Settings | 5 | 12h | Fib per-level, coordinates, visibility tabs |
| **16** | Launch Blockers | 10 | 21h | Security D→B+, WCAG AA, push, onboarding |
| **17** | Bug Sweep | 18 | 30h | 18 critical bugs: WebSocket, PnL, timestamps |
| **18** | Engine 120fps | 15 | 32h | ProMotion, quintic physics, PixelRatio, rAF unification |
| **19** | Intelligence Pipe | 10 | 42h | Co-Pilot, Ghost Trades, Voice-to-Chart, Decision Tree |
| **20** | Data Resilience | 10 | 28h | HeartbeatMonitor, ApiKeyRoundRobin, CandleVirtualizer |
| **21** | Drawing Tools | 13 | 25h | Magnet snap, hit-test, replay interpolation, equity smoothing |
| **22** | Visual Design | 10 | 22h | Liquid Glass, z-index tokens, OLED, Clear Mode |
| **23** | Human Factors | 8 | 28h | CrosshairHUD, saliency, GhostLayer, low-stress palette |
| **24** | UX Polish | 9 | 25h | BentoGrid, KellyCriterion, DrawdownTracker, FeatureGates |
| **25** | Visionary | 8 | 35h | Intent detection, ProModeKeyMap, AIGhostOverlay, HapticSnap |

</details>

### Version History

| Version | Total | Done | Key Change |
|---------|-------|------|------------|
| v9.0 | 150 | 85 | Initial |
| v20.0 | 560 | 274 | Settings Upgrade, Batch 9-13 reconciliation |
| v21.0 | 560 | 274 | Strategic restructure |
| **v22.0** | **637** | **295** | +77 from 19-audit consolidation |
| v22.5 | 637 | 393 | Batches 22-25 complete (18 new files) |
| **v23.0** | **637** | **393** | **Priority-tier restructure (P0/P1/P2/P3), collapsed batch history** |

---

## 🎯 YOUR NEXT 2 WEEKS

```
Week 1 (Mar 7–13):   P0-A: Minimap + Stream Health     (6h)
                      P0-B: Docs (README, JSDoc, arch)   (7h)
                      P0-C: CI gates (axe, perf, vitals) (9h)
                      ─────────────────────────────────── 22h

Week 2 (Mar 14–20):  P0-D: Launch channels              (9h)
                      P1-A: Start UX gaps                (~8h)
                      ─────────────────────────────────── 17h

                      🟢 P0 COMPLETE → ship-ready for beta
```

> [!TIP]
> **Week 1 focus = finish the 2 leftover items + documentation + CI gates.**
> Week 2 = launch channel setup + start chipping away at P1 UX gaps.
> After March 20 you should be in "daily polish from P1" mode until April 15 launch.

---

> **charEdge v23.0** — 637 tasks tracked · 393 done · 244 remaining · 32 audit sources · Score 99/100
> _"The modular, intelligent alternative — institutional-grade visualization + behavioral intelligence at retail pricing."_
