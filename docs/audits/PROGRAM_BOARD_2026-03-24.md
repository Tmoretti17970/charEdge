# Program Board (Kickoff)

Cycle: 2026-03-24 to 2026-04-21 (4 weeks)
Owner: charEdge core team
Status: Yellow

## Objectives

- O1: Stabilize chart runtime by removing dual data authority risk.
- O2: Unify chart interaction ownership (keyboard/events) for deterministic UX.
- O3: Stand up observability and debug workflows to reduce incident time.

## Workstream: Runtime Stability

- Lead: Chart Runtime
- Goal: One canonical chart data authority and reduced orchestration blast radius.
- Current metric: Dual-path risk present (loader + datafeed path overlap).
- Target metric: Single authority in chart runtime for symbol/timeframe session.
- Top risks: Regressions in symbol switch, replay mode, and overlays.

Tasks:
- [ ] Decide and document canonical chart ingest path in ADR.
- [ ] Remove duplicate chart-state writes from non-canonical path.
- [ ] Split `ChartEngineWidget` responsibilities into:
  - `useChartEngineLifecycle`
  - `useChartDatafeedBridge`
  - `useChartInputBindings`
  - `useChartOverlayRuntime`
- [ ] Add regression tests for rapid symbol/timeframe switching.

## Workstream: Data Pipeline Integrity

- Lead: Data/Platform
- Goal: Accurate freshness/source state and reliable failover behavior.
- Current metric: Freshness/source consistency risk under cache/fallback paths.
- Target metric: Unified freshness model + verified source labels.
- Top risks: false-fresh cache reads, stale writes after switch, mislabeling.

Tasks:
- [ ] Thread `AbortSignal` through full `fetchOHLC` path and fallbacks.
- [ ] Fix source attribution propagation from provider -> store -> UI.
- [ ] Normalize timeframe contract across chart/datafeed services.
- [ ] Add per symbol+source health tracking for failover.

## Workstream: UX and Interaction Coherence

- Lead: Frontend UX
- Goal: Remove interaction collisions and reduce command surface confusion.
- Current metric: Shortcut ownership fragmented; duplicated control paradigms.
- Target metric: Single keymap registry and one canonical command surface.
- Top risks: keyboard conflicts, modal focus bugs, user cognitive overload.

Tasks:
- [ ] Create centralized chart keymap registry and migrate all chart shortcuts.
- [ ] Consolidate command surfaces (standardize around one “more/command” flow).
- [ ] Normalize timeframe tokens/components to one canonical model.
- [ ] Run accessibility pass for chart dialogs/popovers (focus trap + labels).

## Workstream: Observability and Incident Readiness

- Lead: Platform + QA
- Goal: Measurable pipeline health and faster debugging.
- Current metric: Partial visibility; limited deterministic replay.
- Target metric: Incident triage in <15 minutes to probable cause.
- Top risks: missing telemetry fields and hard-to-reproduce regressions.

Tasks:
- [ ] Add chart runtime debug panel:
  - active symbol/timeframe
  - source/confidence
  - freshness state
  - queue depth
  - tick-to-render latency
- [ ] Define structured log schema for failover/retry/staleness events.
- [ ] Build minimal capture/replay fixture for one symbol and one timeframe.
- [ ] Run first incident tabletop using `INCIDENT_DEBUG_CHECKLIST`.

## KPI Snapshot (Kickoff Baseline)

- Tick-to-render latency p95: TBD
- Freshness SLO pass rate: TBD
- Shortcut conflict defects: Baseline needed
- Incident count: Baseline needed
- MTTR: Baseline needed

## Decisions Needed (Week 1)

- [ ] Canonical chart data authority: `DatafeedService`-first vs loader-first.
- [ ] Command/event contract: typed internal bus vs store-command only.
- [ ] Primary chart status surface: `UnifiedStatusBar` vs HUD-first model.

## Blockers

- [ ] No baseline metrics dashboard yet.
- [ ] Existing in-flight CSS/module refactor may create merge noise.

## Checklist Gates for Every Task

Before merging major work, pass:
- `docs/audits/FEATURE_DELIVERY_CHECKLIST.md`
- `docs/audits/ARCHITECTURE_REVIEW_CHECKLIST.md`

Before releasing:
- `docs/audits/RELEASE_READINESS_CHECKLIST.md`

If incident/regression occurs:
- `docs/audits/INCIDENT_DEBUG_CHECKLIST.md`

## Weekly Ritual (Repeat)

Every Monday:
- Review this board.
- Update `QUALITY_SCORECARD_TEMPLATE.md`.
- Re-rank top 3 risks.
- Lock this week’s must-ship tasks.
