# Post-Incident Review Template

## Incident Summary

| Field | Value |
|-------|-------|
| **Date** | YYYY-MM-DD |
| **Duration** | Start → End (total minutes) |
| **Severity** | P1 (critical) / P2 (major) / P3 (minor) |
| **Impact** | Users affected, data loss, financial impact |
| **On-Call** | Who responded |

## Timeline

| Time (UTC) | Event |
|------------|-------|
| HH:MM | First alert / detection |
| HH:MM | Investigation started |
| HH:MM | Root cause identified |
| HH:MM | Mitigation applied |
| HH:MM | Verified resolved |

## Metrics

| Metric | Value |
|--------|-------|
| **MTTA** (Mean Time To Acknowledge) | X min |
| **MTTR** (Mean Time To Resolve) | X min |
| **Error rate during incident** | X% |
| **Users affected** | X |

## Root Cause

> Describe the technical root cause. Link to relevant code, commits, or configs.

## What Went Well

- [ ] Detection was fast (< 5 min)
- [ ] Runbook was followed
- [ ] Communication was clear

## What Went Wrong

- [ ] Detection was delayed
- [ ] Runbook was missing/outdated
- [ ] Fix introduced secondary issues

## Action Items

| Action | Owner | Due | Status |
|--------|-------|-----|--------|
| Add test for specific failure case | | | |
| Update runbook with new steps | | | |
| Add monitoring for root cause | | | |

## Lessons Learned

> What should we do differently next time?
