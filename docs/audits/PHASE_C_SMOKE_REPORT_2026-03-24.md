# Phase C Smoke Report

Date: 2026-03-24
Scope: Long-session/performance smoke validation for ADR-001 migration

## What Was Attempted

Browser-level perf smoke suite (Playwright):
- `e2e/performance-budget.spec.ts`
- `e2e/frame-time-regression.spec.ts`

Command:
- `npx playwright test e2e/performance-budget.spec.ts e2e/frame-time-regression.spec.ts --project=chromium`

## Result

Browser-level smoke was **blocked by environment/runtime incompatibility**:
- Playwright Chromium launch failed with `spawn Unknown system error -86`.
- This indicates browser binary architecture/runtime mismatch in the current execution environment.
- Failures are infra-level (launch) rather than application assertions.

## Fallback Validation Executed

Engine/runtime smoke tests were run as fallback:
- `src/__tests__/engine/chartBenchmarks.test.js`
- `src/__tests__/engine/chartEnhancements.test.js`
- `src/__tests__/engine/chartInteractions.test.js`

Result:
- 3 test files passed
- 304 tests passed

## Interpretation

- ADR-001 migration is stable under unit/integration/engine-level validation.
- Browser-level frame-time and web-vitals metrics remain pending due to environment blocker.

## Action Required

To close Phase C fully, run these on a compatible local CI/dev machine:
- `npx playwright install chromium`
- `npx playwright test e2e/performance-budget.spec.ts e2e/frame-time-regression.spec.ts --project=chromium`

Capture and store:
- p95 frame times (idle/pan/zoom)
- bundle transfer sizes
- LCP/CLS
- DOM node count
