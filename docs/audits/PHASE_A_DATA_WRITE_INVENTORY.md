# Phase A Data Write Inventory (ADR-001)

Date: 2026-03-24
Goal: Identify chart-bar write call sites that are non-canonical and must migrate.

## Canonical Path (Keep)

- `src/app/components/chart/core/ChartEngineWidget.jsx`
  - Subscribes to `datafeedService` and updates chart metadata/state in sync with engine runtime.

## Non-Canonical / Compatibility Paths (Migrate)

- `src/pages/charts/useChartDataLoader.js`
  - Phase B update complete: direct `setData(...)` writes removed.
  - Now updates metadata via `setDataMeta(...)` only.

- `src/data/useWebSocket.js`
  - Phase B update complete: direct `setData(...)` writes removed.
  - Kept as non-authoritative subscription helper/no-op candle callback.

- `src/app/components/chart/core/ChartCanvas.jsx`
  - Phase B update complete: legacy `setData(..., 'legacy')` write path removed.
  - Wrapper is now pass-through only to `ChartEngineWidget`.

## Guardrails Added

- Runtime warning guard in `src/state/chart/dataAuthorityGuard.ts`.
- Guard is invoked from `setData` in `src/state/chart/dataSlice.ts`.
- Behavior: warns in non-production when stack indicates non-canonical write caller.

## Next Migration Actions (Phase B)

- Ensure all chart bars flow through `DatafeedService` + `ChartEngineWidget` path.
- Add temporary telemetry counter for any remaining non-canonical `setData` warnings in dev.
