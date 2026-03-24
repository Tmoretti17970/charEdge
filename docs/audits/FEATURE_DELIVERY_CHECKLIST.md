# Feature Delivery Checklist (Chart/Product)

Use for every meaningful feature before merge and release.

## 1) Problem + Scope
- [ ] User problem is explicit and testable.
- [ ] In-scope and out-of-scope are documented.
- [ ] Success metrics are defined.

## 2) Architecture + Contracts
- [ ] Fits existing domain boundaries (UI/domain/data/infra).
- [ ] No direct UI store mutation outside command APIs.
- [ ] Data contracts (symbol/tf/source/quality) are explicit.
- [ ] ADR created if architecture boundary changes.

## 3) UX + Accessibility
- [ ] Uses existing interaction patterns (no redundant control paradigms).
- [ ] Keyboard behavior added to single keymap registry.
- [ ] Focus behavior and escape semantics verified.
- [ ] Screen reader labels and modal semantics verified.

## 4) Data + Performance
- [ ] Abort/cancel behavior works on symbol/tf switch.
- [ ] No duplicate data subscriptions introduced.
- [ ] Perf impact measured (latency/fps/memory).
- [ ] Fallback and stale states handled explicitly.

## 5) Observability + Debuggability
- [ ] Key events logged with structured fields.
- [ ] Runtime debug panel surfaces feature state.
- [ ] Failure modes mapped to alerts or dashboard metrics.

## 6) Testing
- [ ] Unit tests for core logic and edge cases.
- [ ] Integration tests for data + UI wiring.
- [ ] E2E tests for critical user path.
- [ ] Regression test added for prior bug class.

## 7) Rollout + Safety
- [ ] Feature flag or staged rollout plan exists.
- [ ] Rollback path documented.
- [ ] Release notes include user-visible behavior changes.

## 8) Definition of Done
- [ ] Metrics hold for 48h after rollout.
- [ ] No P1/P0 defects introduced.
- [ ] Ownership and maintenance notes documented.
