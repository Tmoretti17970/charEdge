// ═══════════════════════════════════════════════════════════════════
// charEdge — Pipeline Dashboard (Sprint 4, Task 4.2)
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { C } from '../../../constants.js';
import { Card } from '../ui/UIKit.jsx';
import st from './PipelineDashboard.module.css';

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

function DashSection({ title, icon, children }) {
  return (
    <div className={st.dashSection}>
      <div className={st.dashSectionHeader}>
        <span className={st.dashSectionIcon}>{icon}</span>
        {title}
      </div>
      {children}
    </div>
  );
}

function StatRow({ label, value, valueColor }) {
  return (
    <div className={st.statRow}>
      <span className={st.statLabel}>{label}</span>
      <span className={st.statValue} style={{ color: valueColor || C.t1 }}>{value}</span>
    </div>
  );
}

function MiniBar({ pct, color }) {
  return (
    <div className={st.miniBar}>
      <div className={st.miniBarFill} style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
    </div>
  );
}

function PipelineDashboard() {
  const [expanded, setExpanded] = useState(false);
  const [data, setData] = useState(null);
  const intervalRef = useRef(null);

  const collectData = useCallback(async () => {
    try {
      const snap = {};
      try { const { cacheManager } = await import('../../../data/engine/infra/CacheManager.js'); snap.cache = cacheManager.getStats(); } catch (_) { snap.cache = null; }
      try { const { getAllCircuitStates } = await import('../../../data/engine/infra/CircuitBreaker.ts'); snap.circuits = getAllCircuitStates(); } catch (_) { snap.circuits = {}; }
      try {
        const { apiMeter } = await import('../../../data/engine/infra/ApiMeter.js');
        snap.api = apiMeter.getStats(); snap.apiTopProviders = apiMeter.getTopProviders();
        snap.apiRateLimits = {};
        for (const provider of Object.keys(snap.api)) snap.apiRateLimits[provider] = apiMeter.getRateLimitPercent(provider);
      } catch (_) { snap.api = {}; }
      try { const { symbolSwitchTracker } = await import('../../../observability/SymbolSwitchTracker.js'); snap.latency = symbolSwitchTracker.getPercentiles(); } catch (_) { snap.latency = null; }
      try { const { errorBudget } = await import('../../../observability/ErrorBudget.ts'); snap.errorBudget = errorBudget.getStatus(); } catch (_) { snap.errorBudget = null; }
      setData(snap);
    } catch (_) { /* best effort */ }
  }, []);

  useEffect(() => {
    if (expanded) { collectData(); intervalRef.current = setInterval(collectData, 2000); }
    else { if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; } }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [expanded, collectData]);

  return (
    <Card className={st.card}>
      <button onClick={() => setExpanded(!expanded)} className={st.toggleBtn}>
        <div className={st.toggleLeft}>
          <span className={st.toggleIcon}>📡</span>
          <div>
            <div className={st.toggleTitle}>Pipeline Dashboard</div>
            <div className={st.toggleSub}>Cache, providers, API usage, latency</div>
          </div>
        </div>
        <span className={`${st.chevron} ${expanded ? st.chevronOpen : ''}`}>▼</span>
      </button>

      {expanded && data && (
        <div className={st.content}>
          {data.cache && (
            <DashSection title="Cache Performance" icon="💾">
              <StatRow label="Memory Entries" value={`${data.cache.memorySize} / ${data.cache.maxSize}`} />
              <StatRow label="Overall Hit Rate" value={`${data.cache.hitRate}%`}
                valueColor={data.cache.hitRate >= 80 ? '#4ecdc4' : data.cache.hitRate >= 50 ? '#ffa726' : '#ef5350'} />
              <div className={st.cacheMeta}>
                <span>Memory: {data.cache.hits?.memory || 0}</span>
                <span>IDB: {data.cache.hits?.idb || 0}</span>
                <span>OPFS: {data.cache.hits?.opfs || 0}</span>
                <span>Miss: {data.cache.misses || 0}</span>
              </div>
            </DashSection>
          )}

          {Object.keys(data.circuits || {}).length > 0 && (
            <DashSection title="Provider Health" icon="🔌">
              {Object.entries(data.circuits).map(([name, stats]) => (
                <div key={name} className={st.provRow}>
                  <span className={st.provName}>{name}</span>
                  <div className={st.provRight}>
                    <span className={st.stateBadge} style={{ background: stateColor(stats.state) + '20', color: stateColor(stats.state) }}>
                      {stats.state}
                    </span>
                    {stats.failureRate > 0 && (
                      <span className={st.stateMeta}>{(stats.failureRate * 100).toFixed(0)}% fail</span>
                    )}
                  </div>
                </div>
              ))}
            </DashSection>
          )}

          {data.apiTopProviders?.length > 0 && (
            <DashSection title="API Usage" icon="📊">
              {data.apiTopProviders.slice(0, 6).map((p) => {
                const rlPct = data.apiRateLimits?.[p.provider] || 0;
                return (
                  <div key={p.provider} className={st.provRow}>
                    <span className={st.provName}>{p.provider}</span>
                    <div className={st.provRight}>
                      <span className={st.apiValue}>{p.callsPerMin}/min</span>
                      {rlPct > 0 && (
                        <>
                          <MiniBar pct={rlPct} color={rateLimitColor(rlPct)} />
                          <span className={st.rlPct} style={{ color: rateLimitColor(rlPct) }}>{rlPct}%</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </DashSection>
          )}

          {data.latency && data.latency.count > 0 && (
            <DashSection title="Symbol Switch Latency" icon="⏱️">
              <div className={st.latencyRow}>
                <div>
                  <div className={st.latencyLabel}>P50</div>
                  <div className={st.latencyValue} style={{ color: data.latency.p50 < 500 ? '#4ecdc4' : '#ffa726' }}>{data.latency.p50}ms</div>
                </div>
                <div>
                  <div className={st.latencyLabel}>P95</div>
                  <div className={st.latencyValue} style={{ color: data.latency.p95 < 3000 ? '#4ecdc4' : '#ef5350' }}>{data.latency.p95}ms</div>
                </div>
                <div>
                  <div className={st.latencyLabel}>Avg</div>
                  <div className={st.latencyValue} style={{ color: C.t1 }}>{data.latency.avg}ms</div>
                </div>
                <div>
                  <div className={st.latencyLabel}>Samples</div>
                  <div className={st.latencyValue} style={{ color: C.t1 }}>{data.latency.count}</div>
                </div>
              </div>
            </DashSection>
          )}

          {data.errorBudget && (
            <DashSection title="Error Budget" icon="🛡️">
              {Object.entries(data.errorBudget).map(([key, s]) => {
                if (s.total === 0) return null;
                return (
                  <div key={key} className={st.provRow}>
                    <span className={st.provName}>{s.label}</span>
                    <div className={st.provRight}>
                      <span className={st.budgetRate} style={{ color: s.breached ? '#ef5350' : '#4ecdc4' }}>
                        {(s.rate * 100).toFixed(2)}%
                      </span>
                      <span className={st.budgetThreshold}>/ {(s.threshold * 100).toFixed(2)}%</span>
                      {s.breached && <span className={st.budgetWarn}>⚠</span>}
                    </div>
                  </div>
                );
              })}
            </DashSection>
          )}
        </div>
      )}

      {expanded && !data && <div className={st.loading}>Loading pipeline data...</div>}
    </Card>
  );
}

export default React.memo(PipelineDashboard);
