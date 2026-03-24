# Chart Debug and Stabilization Playbook

Date: 2026-03-24
Purpose: Practical debugging and incident response for chart/data/runtime issues

## Top Failure Classes

- Symbol/timeframe switches showing stale or mismatched bars/source.
- Live stream active but UI status indicates fallback/stale confusion.
- Shortcut and focus collisions causing inconsistent behavior.
- Overlay-heavy sessions causing frame drops or input lag.

## Triage Workflow

1. Verify source-of-truth path for current chart session.
2. Check data freshness state and cache tier used.
3. Confirm single active subscription authority for symbol/timeframe.
4. Validate runtime shortcut handler ownership for active context.
5. Capture tick-to-render latency and event sequence for regression replay.

## Instrumentation Checklist

- Add a per-chart runtime debug panel:
  - active symbol/timeframe
  - source and confidence
  - freshness state
  - queue depth/drop count
  - last 20 command events
- Structured logs for failover/retry/staleness transitions.
- Deterministic payload capture for replay in local tests.

## Immediate Fix Candidates

- Propagate abort signals through all fetch fallback paths.
- Remove duplicate data authority in chart runtime.
- Correct source labeling to reflect actual provider.
- Replace direct global events for critical chart actions with typed command dispatch.

## Regression Test Matrix

- Rapid symbol/timeframe switches under slow network.
- Source failover during active stream.
- Multi-tab session with shared worker enabled.
- Keyboard-heavy workflow with overlays and modal panels open.
- Long-running chart session memory/perf soak.

## Definition of Stable

- No stale-data incidents from switch races in controlled tests.
- Source/status convergence within 250ms median.
- No shortcut conflict regressions in interaction test suite.
- Frame pacing remains acceptable under overlay stress.
