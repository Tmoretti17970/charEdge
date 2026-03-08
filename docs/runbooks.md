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

---

## 5. TDZ Error in Production Bundle

**Symptoms**: `ReferenceError: Cannot access 'X' before initialization` in a minified chunk (e.g., `chart-tools`). App crashes on load.

**Steps**:
1. **Map the minified symbol**: Open the `.js.map` file or search the chunk for the variable name. Common mapping: `f` → `useAlertStore` or similar Zustand store.
2. **Trace the circular dependency**: Check `vite.config.js` `manualChunks` — was this chunk recently expanded? Look for cross-imports between stores and UI components.
3. **Identify the eager import**: Search for direct `import X from './Component.jsx'` that pulls in stores at module evaluation time.
4. **Fix with `React.lazy()`**: Replace the eager import with `const X = React.lazy(() => import('./Component.jsx'))`. Wrap usage in `<Suspense>`.
5. **Verify**: `npm run build && npx serve dist -p 5173` — confirm no TDZ on fresh load.
6. **Prevent recurrence**: Add the component to the `react-lazy-imports` lint rule or add a comment `// LAZY: prevents TDZ in chart-tools chunk`.

**Root cause**: Rollup evaluates all modules in a chunk during initial load. If Store A imports Component B which imports Store C which imports Store A, the evaluation order creates a TDZ.

---

## 6. Blank Chart / No Data After Symbol Switch

**Symptoms**: Symbol label updates (e.g., shows "AAPL") but chart area is blank. Previous symbol's candles may still be visible. Indicators update but candles don't.

**Steps**:
1. **Check console** for `historyExhausted: true` — reset may have been skipped.
2. **Check `scrollOffset`** via `useChartStore.getState().scrollOffset` — a large offset from the previous symbol's deep history can position the viewport past the new asset's data range.
3. **Check `BarDataBuffer`** — ensure it was cleared before new data arrived (ghost candles from previous symbol).
4. **Check `TickChannel`** — verify `tickChannel.pushHistorical(bars)` was called for the new symbol's data path (crypto vs equity data routes).
5. **Remediation**: In `ChartEngine.setProps()`, force a hard viewport reset when `symbol !== prevSymbol`:
   - `scrollOffset = 0`
   - `priceScale = 1.0`
   - `historyExhausted = false`
   - Clear prefetch fail counters

**Common cause**: Non-crypto symbols use Yahoo/Polygon data, which has a separate delivery path that may skip `TickChannel.pushHistorical`.

---

## 7. API Rate Limiting / Excessive Call Volume

**Symptoms**: 429 responses in console, provider-specific rate limit warnings, `ApiMeter` showing >100 calls/min for a single provider.

**Steps**:
1. **Check ApiMeter**: `window.__apiMeter.getStats()` in dev console — identify which provider is spiking.
2. **Check AdaptivePoller**: `VISIBLE_CHART_MIN` should be ≥5000ms. If lower, the poller was misconfigured.
3. **Check for tab-hidden throttle**: When tab is hidden, all polling should pause. Verify `document.visibilityState` handling in `AdaptivePoller.js`.
4. **Check for watchlist dedup**: `_dedupMap` in `AdaptivePoller` should prevent duplicate symbol+provider scheduling. If a symbol is on both visible chart AND watchlist, only one poll task should exist.
5. **Check sparkline/fundamental double-fetch**: `SparklineService` and `FundamentalService` should read from `QuoteService` cache, not making independent API calls.
6. **Remediation**: If a specific provider is over-polled, increase the minimum interval in `AdaptivePoller.INTERVALS` or temporarily disable the provider in `ProviderRegistry`.

**Monitoring**: `ApiMeter.getTopProviders()` shows real-time calls/min per provider.

---

## 8. Data Pipeline Infinite Fetch Loop

**Symptoms**: Browser freezes, hundreds of requests per second to the same endpoint, `isLoading` flag rapidly toggling.

**Steps**:
1. **Identify the loop source**: Check Network tab for the repeating URL pattern. Common: `fetchOHLCPage` for historical data prefetch.
2. **Check fail counter**: `prefetchFailCountRef` in `useChartDataLoader.js` should cap retries at `MAX_PREFETCH_RETRIES` (3). If counter isn't incrementing, the reset logic is firing prematurely.
3. **Check for the "data exhaustion" false negative**: Binance returns 400/4xx for dates before the asset's listing. This should set `historyExhausted: true`, not trigger a retry.
4. **Look for the scroll-triggered loop**: Scroll handlers dispatch `prefetch-history` on every frame when near the left edge. If `isLoading` resets to `false` too quickly after a failure, the scroll handler re-triggers immediately.
5. **Remediation**: Ensure exponential backoff: `cooldown = baseDelay * 2^(failCount-1)`. Reset only on successful fetch or symbol/timeframe change.

**Prevention**: The `MAX_PREFETCH_RETRIES` constant exists exactly for this. If you see this, ensure the retry cap is working in both `useChartDataLoader.js` and `DataManager.js`.
