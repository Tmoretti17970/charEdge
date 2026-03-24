# Chart UI/UX Audit

Date: 2026-03-24
Lens: TradingView-level interaction quality, consistency, and maintainability

## Interaction Architecture

- Core runtime: `src/app/components/chart/core/ChartEngineWidget.jsx`
- Shell/pane composition: `src/app/components/chart/core/ChartPane.jsx`
- Primary controls: `UnifiedChartToolbar.jsx`, `toolbar/*`
- Secondary panels: `panels/*`
- Overlay layer: `overlays/*`, status surfaces in `ui/*`

## Findings

### Critical
- Keyboard shortcut ownership is fragmented across multiple global handlers.
- Global custom-event mesh creates non-deterministic interaction coupling.

### High
- `ChartEngineWidget` acts as a monolith with broad responsibility.
- Overlay update loops can stack and increase render pressure.
- Control paradigms are duplicated (timeframe/menu variants) creating UX inconsistency.
- Dialog/popover accessibility patterns are uneven (focus trap, modal semantics).

### Medium
- Desktop/mobile capability parity is inconsistent for advanced actions.
- Status surfaces are noisy/overlapping (`HUD`, status bar, staleness, fallback).
- Inline style density increases theming drift and UI maintenance cost.

## What TradingView Would Prioritize

- One interaction contract for each command (mouse, keyboard, touch parity).
- One canonical command/search surface.
- Single keymap registry with user overrides.
- Strong focus management and accessibility defaults in all overlays.
- Progressive disclosure with strict control hierarchy.

## Recommended UX Program

### Sprint 1-2 (Quick Wins)
- Centralize keybindings into one chart keymap module.
- Unify timeframe tokens and selectors.
- Reduce status duplication by defining a single primary status surface.
- Baseline accessibility pass across chart dialogs/popovers.

### Sprint 3-6 (Strategic)
- Split `ChartEngineWidget` into composable runtime hooks.
- Create central overlay scheduler (single RAF coordinator).
- Standardize control primitives and tokenized styling.
- Consolidate to one “More/Command” interaction pattern.

## UX Quality KPIs

- Reduced shortcut conflict defects to near zero.
- Time-to-discover advanced tools under 30 seconds for new users.
- Lower interaction latency/jank during heavy overlay scenarios.
- Accessibility audit pass rate across chart control surfaces.
