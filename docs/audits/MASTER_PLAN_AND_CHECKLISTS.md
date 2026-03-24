# charEdge Master Plan and Checklist System

Date: 2026-03-24
Owner: Product + Platform + Chart Runtime teams

## Purpose

Create a repeatable execution framework that converts the audit into shipped reliability, UX quality, and competitive strength.

## North Star (12 Months)

- Reach TradingView-grade chart consistency and responsiveness.
- Establish one canonical chart data authority and deterministic behavior.
- Turn AI + behavioral intelligence into a durable product advantage.
- Build engineering rhythm with measurable quality gates.

## Strategic Pillars

1. Runtime Stability and Determinism
2. Data Pipeline Integrity and Freshness
3. UX Coherence and Speed
4. Observability and Incident Readiness
5. Ecosystem/Extensibility Foundation

## 30 / 60 / 90 Day Plan

## 0-30 Days (Stabilize Core)

Goals:
- Eliminate highest-risk defects and architecture ambiguity.

Milestones:
- [ ] Confirm single chart data authority decision (documented ADR).
- [ ] Remove/disable duplicate write paths in chart runtime.
- [ ] Fix abort propagation in fetch chain.
- [ ] Fix source labeling and freshness semantics.
- [ ] Create one chart keymap registry and map all current shortcuts.
- [ ] Add chart runtime debug panel (source, freshness, queue, latency).

Exit criteria:
- [ ] No known stale-switch race in test matrix.
- [ ] No duplicate keybinding collisions in critical flows.

## 31-60 Days (Decompose + Standardize)

Goals:
- Reduce regression blast radius and standardize contracts.

Milestones:
- [ ] Split `ChartEngineWidget` into focused runtime hooks/modules.
- [ ] Split `ChartsPage` orchestration into shell/runtime/panels.
- [ ] Introduce typed command/event contracts for chart actions.
- [ ] Normalize timeframe contract and parsing.
- [ ] Consolidate status surfaces (single primary state UI).

Exit criteria:
- [ ] No chart runtime module >500 LOC orchestration role.
- [ ] Command ownership documented for 100% chart interactions.

## 61-90 Days (Harden + Operationalize)

Goals:
- Make reliability measurable and enforceable.

Milestones:
- [ ] Deterministic capture/replay harness in CI.
- [ ] SLO dashboards (freshness, latency, failover, drop rate).
- [ ] Incident playbook adoption in on-call workflow.
- [ ] Architecture boundary lint rules + deprecation enforcement.

Exit criteria:
- [ ] p95 tick-to-render latency target is met.
- [ ] Incident MTTR improved vs baseline.

## Decision Cadence

- Weekly: runtime quality review (defects, SLO trends, regressions).
- Biweekly: architecture board (boundary changes, ADR approvals).
- Monthly: competitor parity review and roadmap reprioritization.

## Artifact Index

Use these docs as the recurring execution package:

- Program board: `docs/audits/PROGRAM_BOARD_TEMPLATE.md`
- Feature checklist: `docs/audits/FEATURE_DELIVERY_CHECKLIST.md`
- Architecture review checklist: `docs/audits/ARCHITECTURE_REVIEW_CHECKLIST.md`
- Release readiness checklist: `docs/audits/RELEASE_READINESS_CHECKLIST.md`
- Incident/debug checklist: `docs/audits/INCIDENT_DEBUG_CHECKLIST.md`
- KPI scorecard: `docs/audits/QUALITY_SCORECARD_TEMPLATE.md`
