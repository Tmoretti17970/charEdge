// ═══════════════════════════════════════════════════════════════════
// charEdge — Pipeline Dashboard (Sprint 4, Task 4.2)
//
// User-facing Settings panel showing data infrastructure health:
//   1. Cache Performance (hit/miss rates per tier)
//   2. Provider Health (circuit breaker states)
//   3. API Usage (request counts, rate limit %)
//   4. WebSocket Health (connection status)
//
// Data polled every 2s when expanded, no polling when collapsed.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { C, M } from '../../../constants.js';
import { Card } from '../ui/UIKit.jsx';

// ─── State Colors ──────────────────────────────────────────────

function stateColor(state) {
  if (state === 'CLOSED') return '#4ecdc4';
  if (state === 'HALF_OPEN') return '#ffa726';
  return '#ef5350';
}

function rateLimitColor(pct) {
  if (pct < 50) return '#4ecdc4';
  if (pct < 80) return '#ffa726';
  return '#ef5350';
}

// ─── Section Component ─────────────────────────────────────────

function DashSection({ title, icon, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontSize: 11,
        fontWeight: 700,
        color: C.t3,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 6,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}>
        <span style={{ fontSize: 12 }}>{icon}</span>
        {title}
      </div>
      {children}
    </div>
  );
}

// ─── Stat Row ──────────────────────────────────────────────────

function StatRow({ label, value, valueColor }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '3px 0',
      fontSize: 11,
    }}>
      <span style={{ color: C.t3 }}>{label}</span>
      <span style={{ color: valueColor || C.t1, fontWeight: 600, fontFamily: M }}>{value}</span>
    </div>
  );
}

// ─── Mini Progress Bar ─────────────────────────────────────────

function MiniBar({ pct, color }) {
  return (
    <div style={{
      width: 60,
      height: 5,
      borderRadius: 3,
      background: C.sf2,
      overflow: 'hidden',
      display: 'inline-block',
      marginLeft: 8,
      verticalAlign: 'middle',
    }}>
      <div style={{
        height: '100%',
        width: `${Math.min(pct, 100)}%`,
        borderRadius: 3,
        background: color,
        transition: 'width 0.3s ease',
      }} />
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────

function PipelineDashboard() {
  const [expanded, setExpanded] = useState(false);
  const [data, setData] = useState(null);
  const intervalRef = useRef(null);

  const collectData = useCallback(async () => {
    try {
      const snap = {};

      // Cache stats
      try {
        const { cacheManager } = await import('../../../data/engine/infra/CacheManager.js');
        snap.cache = cacheManager.getStats();
      } catch (_) { snap.cache = null; }

      // Circuit breaker states
      try {
        const { getAllCircuitStates } = await import('../../../data/engine/infra/CircuitBreaker.ts');
        snap.circuits = getAllCircuitStates();
      } catch (_) { snap.circuits = {}; }

      // API meter stats
      try {
        const { apiMeter } = await import('../../../data/engine/infra/ApiMeter.js');
        snap.api = apiMeter.getStats();
        snap.apiTopProviders = apiMeter.getTopProviders();
        // Also get rate limit percentages
        snap.apiRateLimits = {};
        for (const provider of Object.keys(snap.api)) {
          snap.apiRateLimits[provider] = apiMeter.getRateLimitPercent(provider);
        }
      } catch (_) { snap.api = {}; }

      // Symbol switch latency
      try {
        const { symbolSwitchTracker } = await import('../../../observability/SymbolSwitchTracker.js');
        snap.latency = symbolSwitchTracker.getPercentiles();
      } catch (_) { snap.latency = null; }

      // Error budget
      try {
        const { errorBudget } = await import('../../../observability/ErrorBudget.ts');
        snap.errorBudget = errorBudget.getStatus();
      } catch (_) { snap.errorBudget = null; }

      setData(snap);
    } catch (_) { /* best effort */ }
  }, []);

  useEffect(() => {
    if (expanded) {
      collectData();
      intervalRef.current = setInterval(collectData, 2000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [expanded, collectData]);

  return (
    <Card style={{ padding: 16, marginTop: 12 }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          all: 'unset',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>📡</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>Pipeline Dashboard</div>
            <div style={{ fontSize: 11, color: C.t3, fontFamily: M }}>
              Cache, providers, API usage, latency
            </div>
          </div>
        </div>
        <span style={{
          fontSize: 11, color: C.t3,
          transition: 'transform 0.2s ease',
          transform: expanded ? 'rotate(180deg)' : 'rotate(0)',
        }}>▼</span>
      </button>

      {expanded && data && (
        <div style={{ marginTop: 14 }}>

          {/* ── Cache Performance ────────────────────────────── */}
          {data.cache && (
            <DashSection title="Cache Performance" icon="💾">
              <StatRow
                label="Memory Entries"
                value={`${data.cache.memorySize} / ${data.cache.maxSize}`}
              />
              <StatRow
                label="Overall Hit Rate"
                value={`${data.cache.hitRate}%`}
                valueColor={data.cache.hitRate >= 80 ? '#4ecdc4' : data.cache.hitRate >= 50 ? '#ffa726' : '#ef5350'}
              />
              <div style={{
                display: 'flex',
                gap: 12,
                marginTop: 4,
                fontSize: 10,
                color: C.t3,
                fontFamily: M,
              }}>
                <span>Memory: {data.cache.hits?.memory || 0}</span>
                <span>IDB: {data.cache.hits?.idb || 0}</span>
                <span>OPFS: {data.cache.hits?.opfs || 0}</span>
                <span>Miss: {data.cache.misses || 0}</span>
              </div>
            </DashSection>
          )}

          {/* ── Provider Health (Circuit Breakers) ───────────── */}
          {Object.keys(data.circuits || {}).length > 0 && (
            <DashSection title="Provider Health" icon="🔌">
              {Object.entries(data.circuits).map(([name, stats]) => (
                <div key={name} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '3px 0',
                  fontSize: 11,
                }}>
                  <span style={{ color: C.t2 }}>{name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '1px 6px',
                      borderRadius: 3,
                      fontSize: 9,
                      fontWeight: 700,
                      fontFamily: M,
                      background: stateColor(stats.state) + '20',
                      color: stateColor(stats.state),
                    }}>
                      {stats.state}
                    </span>
                    {stats.failureRate > 0 && (
                      <span style={{ fontSize: 9, color: C.t3, fontFamily: M }}>
                        {(stats.failureRate * 100).toFixed(0)}% fail
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </DashSection>
          )}

          {/* ── API Usage ─────────────────────────────────────── */}
          {data.apiTopProviders?.length > 0 && (
            <DashSection title="API Usage" icon="📊">
              {data.apiTopProviders.slice(0, 6).map((p) => {
                const rlPct = data.apiRateLimits?.[p.provider] || 0;
                return (
                  <div key={p.provider} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '3px 0',
                    fontSize: 11,
                  }}>
                    <span style={{ color: C.t2 }}>{p.provider}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontFamily: M, color: C.t1, fontWeight: 600 }}>
                        {p.callsPerMin}/min
                      </span>
                      {rlPct > 0 && (
                        <>
                          <MiniBar pct={rlPct} color={rateLimitColor(rlPct)} />
                          <span style={{
                            fontSize: 9,
                            fontFamily: M,
                            color: rateLimitColor(rlPct),
                          }}>
                            {rlPct}%
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </DashSection>
          )}

          {/* ── Symbol Switch Latency ─────────────────────────── */}
          {data.latency && data.latency.count > 0 && (
            <DashSection title="Symbol Switch Latency" icon="⏱️">
              <div style={{ display: 'flex', gap: 16, fontSize: 11, fontFamily: M }}>
                <div>
                  <div style={{ color: C.t3, fontSize: 9 }}>P50</div>
                  <div style={{ fontWeight: 700, color: data.latency.p50 < 500 ? '#4ecdc4' : '#ffa726' }}>
                    {data.latency.p50}ms
                  </div>
                </div>
                <div>
                  <div style={{ color: C.t3, fontSize: 9 }}>P95</div>
                  <div style={{ fontWeight: 700, color: data.latency.p95 < 3000 ? '#4ecdc4' : '#ef5350' }}>
                    {data.latency.p95}ms
                  </div>
                </div>
                <div>
                  <div style={{ color: C.t3, fontSize: 9 }}>Avg</div>
                  <div style={{ fontWeight: 700, color: C.t1 }}>{data.latency.avg}ms</div>
                </div>
                <div>
                  <div style={{ color: C.t3, fontSize: 9 }}>Samples</div>
                  <div style={{ fontWeight: 700, color: C.t1 }}>{data.latency.count}</div>
                </div>
              </div>
            </DashSection>
          )}

          {/* ── Error Budget ──────────────────────────────────── */}
          {data.errorBudget && (
            <DashSection title="Error Budget" icon="🛡️">
              {Object.entries(data.errorBudget).map(([key, s]) => {
                if (s.total === 0) return null;
                return (
                  <div key={key} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '3px 0',
                    fontSize: 11,
                  }}>
                    <span style={{ color: C.t2 }}>{s.label}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        fontFamily: M,
                        fontWeight: 600,
                        color: s.breached ? '#ef5350' : '#4ecdc4',
                      }}>
                        {(s.rate * 100).toFixed(2)}%
                      </span>
                      <span style={{ fontSize: 9, color: C.t3, fontFamily: M }}>
                        / {(s.threshold * 100).toFixed(2)}%
                      </span>
                      {s.breached && (
                        <span style={{ fontSize: 10, color: '#ef5350' }}>⚠</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </DashSection>
          )}
        </div>
      )}

      {expanded && !data && (
        <div style={{ textAlign: 'center', padding: 16, fontSize: 11, color: C.t3 }}>
          Loading pipeline data...
        </div>
      )}
    </Card>
  );
}

export default React.memo(PipelineDashboard);
