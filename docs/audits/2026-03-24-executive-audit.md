# charEdge Comprehensive Audit

Date: 2026-03-24
Scope: Architecture, data pipeline, chart UI/UX, wiring, debugging readiness
Method: Deep static analysis across core chart/runtime modules and docs

## Executive Findings

The product ambition is strong and close to a professional charting platform, but current implementation has platform-level risks that will cap reliability and speed of iteration if not corrected. The highest-risk issue is dual chart data authority (two active pipelines feeding similar chart concerns), followed by global-event coupling and a monolithic chart controller component.

Top risks:
- Critical: parallel/competing chart data flows can diverge source-of-truth and status.
- Critical: incomplete state migration assumptions in chart selectors and store slices.
- High: keyboard/global event collisions create non-deterministic behavior.
- High: chart runtime responsibilities are concentrated in one very large component.
- High: stale/fresh semantics across cache tiers can hide data age and reduce trust.

## What TradingView Would Do Differently

- Use one canonical chart model/runtime per pane (bars, viewport, studies, drawings).
- Enforce strict layering: UI dispatches commands; services never mutate UI directly.
- Replace ad hoc window events with typed command/event contracts.
- Centralize interaction ownership (single keymap registry, single focus model).
- Use deterministic replay traces for data, rendering, and interaction regressions.

## Report Set

- Architecture deep dive: `docs/audits/2026-03-24-architecture-audit.md`
- Data pipeline deep dive: `docs/audits/2026-03-24-data-pipeline-audit.md`
- Chart UI/UX deep dive: `docs/audits/2026-03-24-chart-ux-audit.md`
- Debug/incident playbook: `docs/audits/2026-03-24-debug-playbook.md`

## Priority Roadmap (Suggested)

### P0 (0-2 weeks)
- Select one canonical chart data authority; decommission duplicate write paths.
- Fix abort propagation and source labeling correctness.
- Introduce single keyboard map ownership and remove conflicting global handlers.
- Split `ChartEngineWidget` into focused runtime hooks/controllers.

### P1 (2-6 weeks)
- Normalize timeframe contract and source metadata contract.
- Unify staleness model and status surfaces.
- Consolidate overlay scheduling to one frame coordinator.
- Establish architecture boundaries and lint import rules for deprecated modules.

### P2 (6-12 weeks)
- Adopt plugin lifecycle for tools/overlays.
- Implement deterministic capture/replay harness.
- Auto-generate architecture docs from code graph in CI.

## Success Metrics

- 50% reduction in chart incident classes tied to stale or mismatched source state.
- <250ms median source/status convergence from feed to UI.
- 30-40% reduction in chart feature regression bug count per release.
- Reduced chart runtime file blast radius (no single >500 LOC orchestration component).
