# ADR-001 Implementation Checklist

Decision: `docs/adr/001-canonical-chart-data-authority.md`
Objective: Move chart runtime to one canonical data authority (`DatafeedService`)

## Phase A: Guardrails (Day 1-2)

- [ ] Add runtime warnings/assertions for dual chart-bar writes.
- [ ] Inventory all chart-bar write call sites outside canonical path.
- [ ] Mark non-canonical write paths as deprecated in comments/docs.

## Phase B: Rewire Data Ownership (Day 3-7)

- [ ] Remove direct canonical bar writes from `useChartDataLoader`.
- [ ] Ensure `ChartEngineWidget` consumes canonical feed metadata for status.
- [ ] Verify symbol/timeframe switch cancels in-flight non-canonical requests.
- [ ] Normalize source/freshness metadata propagation to UI.

## Phase C: Validation (Week 2)

- [x] Add tests for rapid symbol/timeframe switches.
- [x] Add tests for source failover and stale-state transitions.
- [ ] Run long-session smoke test for memory/perf stability. (blocked in current environment; see smoke report)
- [x] Validate no duplicate subscription in runtime logs.

Notes:
- Updated `src/__tests__/data/infra_pipeline.test.js` with ADR-001 guardrail assertions:
  - `useWebSocket` has no `setData(...)` writes.
  - `useChartDataLoader` uses `setDataMeta(...)` and no legacy `setData(...)`.
  - `ChartCanvas` no longer writes legacy bar data.
- Updated `src/__tests__/data/datafeedRace.test.js` for metadata consistency and error transitions:
  - Asserts crypto load writes canonical `setDataMeta(..., 'datafeed:crypto', ...)`.
  - Asserts fetch failure transitions entry to `error` and calls `onError` without metadata write.
- Executed targeted tests:
  - `src/__tests__/data/datafeedRace.test.js`
  - `src/__tests__/data/infra_pipeline.test.js`
  - Result: passing.
- Smoke validation report:
  - `docs/audits/PHASE_C_SMOKE_REPORT_2026-03-24.md`
  - Browser perf suite blocked by Chromium launch error `-86` in this environment.
  - Fallback engine benchmark/interaction tests passed.

## Phase D: Cleanup (Week 3)

- [ ] Remove obsolete compatibility paths no longer needed.
- [ ] Update architecture/data docs to reflect new ownership.
- [ ] Add lint/rule to prevent new non-canonical bar write patterns.

## Definition of Done

- [ ] Canonical chart bars are only produced by `DatafeedService` path.
- [ ] No stale-switch race reproduced in regression matrix.
- [ ] Status/source/freshness are consistent across chart UI surfaces.
- [ ] Team signs off in architecture review checklist.
