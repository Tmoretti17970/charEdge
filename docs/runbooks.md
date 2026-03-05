# Incident Runbooks

## 1. WebSocket Failure

**Symptoms**: No live ticks, WS error in Sentry, health check shows WS degraded

**Steps**:
1. Check `/health/deep` — verify DB is healthy (isolate DB vs WS issue)
2. Check Binance/exchange status page for upstream outage
3. Verify server WS connection: `curl -i -N -H "Upgrade: websocket" ws://localhost:3000`
4. Check server logs for `WebSocketService` errors
5. If reconnect loop detected: restart the server process
6. If exchange upstream: wait for resolution, verify auto-reconnect fires

**Escalation**: If > 5 min, notify on-call. If > 15 min, consider failover to REST polling.

---

## 2. High Memory Usage

**Symptoms**: Slow API responses, OOM kills, high P95 latency

**Steps**:
1. Check process memory: `process.memoryUsage().heapUsed`
2. Check DB size: `GET /health/deep` → `dbSizeBytes`
3. Run audit log retention: `archiveOldAuditLogs(db, 30)` to free space
4. Check for unclosed DB statements or WebSocket connections
5. If SQLite WAL file is large: `PRAGMA wal_checkpoint(TRUNCATE)`
6. Restart server if memory doesn't stabilize within 5 min

**Prevention**: Scheduled retention runs daily, audit logs capped at 90 days.

---

## 3. API Key Compromise

**Symptoms**: Unexpected API activity, unauthorized data access

**Steps**:
1. **Immediately** revoke compromised API key in the key store
2. Check audit_log for actions taken with the compromised key
3. Identify affected user accounts
4. Rotate all active sessions for affected users
5. Notify affected users via email
6. Review access patterns to determine scope of data exposure
7. File post-incident report

**Prevention**: API keys scoped per-endpoint, key rotation enforced.

---

## 4. Deployment Rollback

**Symptoms**: Build passes CI but production error rate spikes

**Steps**:
1. Verify error spike in Sentry: check release tag against current deploy
2. Compare error rate against previous release
3. If > 1% error rate increase:
   - Revert to previous Git SHA: `git revert HEAD && git push`
   - Or redeploy previous known-good build
4. Verify rollback via `/health/deep`
5. Investigate root cause in reverted commit
6. Fix and re-deploy with additional test coverage

**Prevention**: Canary deploys, feature flags for risky changes.
