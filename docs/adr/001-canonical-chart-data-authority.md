# ADR-001: Canonical Chart Data Authority

## Status

**Proposed** | Accepted | Deprecated | Superseded by [ADR-XXX](./XXX-title.md)

## Context

The current chart runtime has overlapping data orchestration responsibilities:

- `src/pages/charts/useChartDataLoader.js` performs fetch/stream related chart updates.
- `src/charting_library/datafeed/DatafeedService.js` and `src/app/components/chart/core/ChartEngineWidget.jsx` also own historical/live chart data flow.

This creates dual authority for symbol/timeframe sessions and can cause:

- divergent source/freshness status,
- stale writes after fast symbol/timeframe switches,
- duplicate subscriptions/network work,
- higher debugging and regression risk.

To reach TradingView-grade reliability, chart data authority must be singular and explicit.

## Decision

Adopt `DatafeedService` as the canonical chart data authority for chart pane runtime.

Decision details:

1. **Single authority**
   - Historical and live bars used by chart panes are owned by `DatafeedService` path.
   - `ChartEngineWidget` consumes this path as the runtime bridge.

2. **`useChartDataLoader` role change**
   - Convert `useChartDataLoader` into a metadata/observer role only (no direct bar writes to canonical chart data path).
   - It may provide non-authoritative UI metadata, diagnostics, and transitional compatibility hooks.

3. **Contract normalization**
   - Standardize symbol/timeframe/source/freshness contract emitted from `DatafeedService`.
   - UI status components consume the same canonical metadata.

4. **Transition guardrails**
   - Add temporary assertions/logging to detect dual-write attempts.
   - Block new chart-bar writes outside approved runtime command surface.

## Consequences

### Positive
- Deterministic chart data behavior for symbol/timeframe sessions.
- Reduced stale/race conditions from competing paths.
- Cleaner incident triage with one source-of-truth runtime.
- Easier performance and reliability instrumentation.

### Negative
- Requires migration work and temporary compatibility adapters.
- Some existing UI hooks that relied on loader-side writes must be rewired.

### Risks
- Regression risk during phased cutover if edge flows depend on old loader behavior.
- Potential temporary feature drift in replay/auxiliary panels until all consumers are aligned.

## Alternatives Considered

| Alternative | Pros | Cons | Why Rejected |
|-------------|------|------|--------------|
| Keep dual authority and patch locally | Low short-term change | Continues race/consistency risk; high long-term cost | Does not solve core reliability issue |
| Make `useChartDataLoader` canonical instead | Keeps React-centric flow | Weaker separation for engine runtime; increases page-level coupling | Less aligned with engine-centric chart runtime |
| Big-bang rewrite of all chart data layers | Could fully redesign contracts | High delivery and outage risk | Too risky vs phased migration |

## References

- `docs/audits/2026-03-24-architecture-audit.md`
- `docs/audits/2026-03-24-data-pipeline-audit.md`
- `docs/audits/PROGRAM_BOARD_2026-03-24.md`
