# Architecture Audit (TradingView-Style Lens)

Date: 2026-03-24
System: charEdge charting stack

## Current System Map

Primary runtime zones:
- App boot/orchestration: `src/App.jsx`, `src/AppBoot.js`
- Chart page orchestration: `src/pages/ChartsPage.jsx`
- Chart engine bridge: `src/app/components/chart/core/ChartCanvas.jsx`, `src/app/components/chart/core/ChartEngineWidget.jsx`
- Engine core: `src/charting_library/core/ChartEngine.ts`
- State layer: `src/state/useChartStore.ts`, `src/state/chart/*`
- Data feed/services: `src/charting_library/datafeed/DatafeedService.js`, `src/data/*`

The architecture is strong in ambition but currently transitional (legacy + new patterns coexist).

## Findings

### Critical
- Dual chart data authority: both `useChartDataLoader` and `DatafeedService` paths influence chart state and status.
- Incomplete state migration assumptions between slice ownership and selectors.

### High
- Heavy global event coupling via `window`/`CustomEvent`.
- UI components bypassing domain boundaries via direct `getState/setState`.
- Monolithic runtime controllers (`ChartsPage`, `ChartEngineWidget`).
- Compatibility paths active without strict sunset boundaries.

### Medium
- Duplicate logic modules (trade handlers in multiple paths).
- Architecture docs drift from code reality.
- Cross-domain reads in slices that erode ownership boundaries.

## TradingView-Like Target State

- One canonical chart model/runtime per pane.
- Typed command bus for chart actions (no ad hoc custom event mesh).
- Strict layering:
  - UI -> typed commands
  - Domain -> invariant-checked reducers/services
  - Data -> normalized envelopes + quality metadata
  - Infra -> cache/retry/telemetry
- Plugin lifecycle for tools/overlays (`init`, `onData`, `onViewport`, `render`, `dispose`).

## Improvement Plan

### Phase 1 (0-2 weeks)
- Select one canonical chart data authority and remove dual writes.
- Add `chartCommands` API and route UI writes through it.
- Freeze new global custom events.

### Phase 2 (2-6 weeks)
- Split `ChartEngineWidget` into lifecycle, data bridge, input, overlays modules.
- Decompose `ChartsPage` into shell/runtime/panels domains.

### Phase 3 (6-12 weeks)
- Move compat modules into explicit `compat/` namespace.
- Enforce architecture boundary lint rules and CODEOWNERS by subdomain.

## Success Criteria

- No dual-write chart data paths in runtime.
- No UI module directly mutating chart stores outside command API.
- Reduced regression blast radius via smaller runtime modules.
