# Incident and Debug Checklist (Chart/Data)

Use during live incidents and high-priority bug investigations.

## 0) Incident Setup
- [ ] Incident owner assigned.
- [ ] Severity level declared.
- [ ] Affected symbols/timeframes/users scoped.
- [ ] Timeline doc started.

## 1) Fast Diagnosis
- [ ] Confirm data authority path currently active.
- [ ] Capture source, freshness, latency, queue depth.
- [ ] Check symbol/timeframe switch history and race conditions.
- [ ] Validate shortcut/focus/global listener interference (if UX issue).

## 2) Evidence Capture
- [ ] Save structured logs around incident window.
- [ ] Save runtime debug panel snapshot.
- [ ] Capture transport payload sample (if data mismatch).
- [ ] Capture replay artifact for deterministic reproduction.

## 3) Stabilization Actions
- [ ] Apply safe mitigations (disable feature flag / reduce load path).
- [ ] Verify mitigation impact on key KPIs.
- [ ] Communicate status and ETA.

## 4) Root Cause Analysis
- [ ] Primary failure mechanism identified.
- [ ] Contributing factors identified.
- [ ] Detection gap identified.
- [ ] Why existing tests did not catch this is documented.

## 5) Fix Validation
- [ ] Unit/integration tests cover root cause.
- [ ] Regression replay passes.
- [ ] Performance impact measured.
- [ ] Rollback path remains available.

## 6) Closure
- [ ] Customer/user impact documented.
- [ ] Permanent fix shipped.
- [ ] Follow-up tasks added to program board.
- [ ] Post-incident review scheduled.
