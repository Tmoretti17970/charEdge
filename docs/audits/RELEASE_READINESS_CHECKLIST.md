# Release Readiness Checklist

Use before each production release.

## Product Readiness
- [ ] User-facing changes are documented.
- [ ] UX acceptance completed for critical workflows.
- [ ] Known issues are triaged and accepted explicitly.

## Quality Gates
- [ ] Unit/integration/E2E suites pass.
- [ ] No unresolved P0/P1 defects.
- [ ] Performance checks pass against baseline.
- [ ] Accessibility checks pass for changed screens.

## Data and Runtime Health
- [ ] No duplicate stream/data authority regressions.
- [ ] Freshness and failover dashboards look healthy.
- [ ] Tick-to-render latency remains within SLO.
- [ ] Cache behavior validated on cold and warm starts.

## Security and Compliance
- [ ] Secrets/config verified for target environment.
- [ ] Auth and permission-sensitive flows spot-checked.
- [ ] Dependency and vulnerability scan reviewed.

## Operational Readiness
- [ ] Rollout plan approved (staged/canary/full).
- [ ] Rollback plan tested or validated.
- [ ] On-call and incident comms prepared.
- [ ] Post-release verification checklist assigned.

## Launch Decision
- [ ] Go
- [ ] Go with guardrails
- [ ] No-go

Approvers:
- Product:
- Engineering:
- QA:
