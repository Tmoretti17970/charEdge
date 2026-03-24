# Architecture Review Checklist

Use in design reviews, ADR approvals, and major refactors.

## Boundaries
- [ ] Clear ownership by layer (UI/domain/data/infra).
- [ ] No new global event coupling without contract justification.
- [ ] No duplicate source-of-truth introduced.
- [ ] Module ownership and CODEOWNERS impact reviewed.

## Data Flow Integrity
- [ ] Single authority for chart runtime ingest path.
- [ ] Timeframe/symbol/source contracts consistent across modules.
- [ ] Freshness model remains canonical and reusable.
- [ ] Retry/failover behavior classifies transient vs permanent failures.

## State Management
- [ ] Domain actions are explicit and invariant-checked.
- [ ] No cross-domain hidden writes.
- [ ] Selectors are stable and migration-safe.

## Runtime Safety
- [ ] Cancellation/abort propagation is end-to-end.
- [ ] Listener/event lifecycles are deterministic and cleaned up.
- [ ] Overlay/render scheduling does not add unbounded loops.

## Operability
- [ ] Structured telemetry fields defined.
- [ ] Dashboards/alerts updated for new behaviors.
- [ ] Incident playbook impact reviewed.

## Risk + Migration
- [ ] Backward compatibility strategy is explicit.
- [ ] Deprecation timeline exists for legacy paths.
- [ ] Rollout and rollback strategy is documented.

## Decision Outcome
- [ ] Approved
- [ ] Approved with conditions
- [ ] Rejected

Review notes:
- 
