// ═══════════════════════════════════════════════════════════════════
// charEdge — Data Health Dashboard Panel
//
// Unified dashboard showing data infrastructure health:
//   - Per-adapter circuit breaker states (green/yellow/red)
//   - OPFS + IndexedDB storage usage
//   - Cache hit/miss metrics
//   - Memory budget status
//   - Bandwidth report
//   - Event bus statistics
//
// Accessible from PipelineDevTools or Settings page.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { logger } from '@/observability/logger';
// ─── Styles ────────────────────────────────────────────────────

const s = {
  panel: {
    background: 'rgba(10, 14, 22, 0.96)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(100, 200, 255, 0.12)',
    borderRadius: '12px',
    padding: '16px',
    color: '#c8d6e5',
    fontFamily: "'SF Mono', 'Fira Code', monospace",
    fontSize: '11px',
    maxHeight: '80vh',
    overflowY: 'auto',
  },
  title: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#64d8ff',
    marginBottom: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  section: {
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '8px',
    padding: '10px 12px',
    marginBottom: '10px',
    border: '1px solid rgba(255, 255, 255, 0.05)',
  },
  sectionTitle: {
    color: '#64d8ff',
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginBottom: '8px',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '3px 0',
  },
  label: { color: '#8899aa' },
  value: { color: '#e0e8f0', fontWeight: 500 },
  green: { color: '#4ecdc4' },
  yellow: { color: '#ffa726' },
  red: { color: '#ef5350' },
  badge: (color) => ({
    display: 'inline-block',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: color,
    marginRight: '6px',
    boxShadow: `0 0 6px ${color}`,
  }),
  barContainer: {
    height: '6px',
    background: 'rgba(255,255,255,0.08)',
    borderRadius: '3px',
    overflow: 'hidden',
    marginTop: '4px',
  },
  barFill: (pct, color) => ({
    height: '100%',
    width: `${Math.min(pct, 100)}%`,
    background: color,
    borderRadius: '3px',
    transition: 'width 0.5s ease',
  }),
  refreshBtn: {
    background: 'rgba(100, 216, 255, 0.1)',
    border: '1px solid rgba(100, 216, 255, 0.3)',
    color: '#64d8ff',
    cursor: 'pointer',
    padding: '3px 8px',
    borderRadius: '4px',
    fontSize: '10px',
    fontFamily: 'inherit',
  },
};

// ─── Helper ────────────────────────────────────────────────────

function statusColor(level) {
  if (level === 'critical' || level === 'open') return '#ef5350';
  if (level === 'warning' || level === 'half-open') return '#ffa726';
  return '#4ecdc4';
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Component ─────────────────────────────────────────────────

export default function DataHealthPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = {};

      // Memory budget
      try {
        const { memoryBudget } = await import('../../data/engine/MemoryBudget.js');
        result.memory = memoryBudget.getStatus();
      // eslint-disable-next-line unused-imports/no-unused-vars
      } catch (_) { result.memory = null; }

      // Circuit breaker states
      try {
        const { getAllCircuitStates } = await import('../../../data/engine/infra/CircuitBreaker');
        result.circuits = getAllCircuitStates?.() || {};
      // eslint-disable-next-line unused-imports/no-unused-vars
      } catch (_) { result.circuits = {}; }

      // OPFS usage
      try {
        const { opfsBarStore } = await import('../../data/engine/OPFSBarStore.js');
        result.opfs = opfsBarStore.getStats?.() || {};
      // eslint-disable-next-line unused-imports/no-unused-vars
      } catch (_) { result.opfs = {}; }

      // IndexedDB cache stats
      try {
        const { dataCache } = await import('../../data/DataCache.ts');
        result.idb = await dataCache.getStats?.() || {};
        result.storage = await dataCache.getStorageUsage?.() || {};
      // eslint-disable-next-line unused-imports/no-unused-vars
      } catch (_) { result.idb = {}; result.storage = {}; }

      // FetchService cache stats
      try {
        const { cacheStats } = await import('../../data/FetchService.ts');
        result.fetchCache = cacheStats?.() || {};
      // eslint-disable-next-line unused-imports/no-unused-vars
      } catch (_) { result.fetchCache = {}; }

      // Bandwidth
      try {
        const { getBandwidthMonitor } = await import('../../data/engine/BandwidthMonitor.js');
        const bw = getBandwidthMonitor?.();
        result.bandwidth = bw?.getReport?.() || {};
      // eslint-disable-next-line unused-imports/no-unused-vars
      } catch (_) { result.bandwidth = {}; }

      // Event bus stats
      try {
        const { dataEventBus } = await import('../../data/engine/DataEventBus.js');
        result.events = dataEventBus.getStats?.() || {};
      // eslint-disable-next-line unused-imports/no-unused-vars
      } catch (_) { result.events = {}; }

      // Streaming indicators
      try {
        const { streamingIndicatorBridge } = await import('../../data/engine/indicators/StreamingIndicatorBridge.js');
        result.indicators = {
          active: streamingIndicatorBridge.getActiveSymbols?.() || {},
          workerActive: streamingIndicatorBridge.isWorkerActive?.() || false,
        };
      // eslint-disable-next-line unused-imports/no-unused-vars
      } catch (_) { result.indicators = {}; }

      setData(result);
    } catch (err) {
      logger.data.warn('[DataHealthPanel] Failed to gather stats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => clearInterval(timer);
  }, [refresh]);

  if (loading && !data) return <div style={s.panel}>Loading health data...</div>;

  const mem = data?.memory;
  const stor = data?.storage;

  return (
    <div style={s.panel}>
      <div style={s.title}>
        <span>📊</span> Data Health Dashboard
        <button style={s.refreshBtn} onClick={refresh}>⟳ Refresh</button>
      </div>

      {/* Memory Budget */}
      {mem && (
        <div style={s.section}>
          <div style={s.sectionTitle}>Memory Budget</div>
          <div style={s.row}>
            <span style={s.label}>Usage</span>
            <span style={{ ...s.value, color: statusColor(mem.level) }}>
              {mem.usedMB} MB / {mem.budgetMB} MB ({mem.pct}%)
            </span>
          </div>
          <div style={s.barContainer}>
            <div style={s.barFill(mem.pct, statusColor(mem.level))} />
          </div>
          <div style={s.row}>
            <span style={s.label}>Level</span>
            <span style={{ ...s.value, color: statusColor(mem.level) }}>
              <span style={s.badge(statusColor(mem.level))} />
              {mem.level}
            </span>
          </div>
          {mem.breakdown && Object.keys(mem.breakdown).length > 0 && (
            <div style={{ marginTop: '6px' }}>
              {Object.entries(mem.breakdown).map(([name, bytes]) => (
                <div key={name} style={s.row}>
                  <span style={s.label}>{name}</span>
                  <span style={s.value}>{formatBytes(bytes)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Storage */}
      {stor && stor.quotaMB > 0 && (
        <div style={s.section}>
          <div style={s.sectionTitle}>Browser Storage</div>
          <div style={s.row}>
            <span style={s.label}>Used / Quota</span>
            <span style={s.value}>
              {stor.usedMB} MB / {stor.quotaMB} MB ({stor.pct}%)
            </span>
          </div>
          <div style={s.barContainer}>
            <div style={s.barFill(stor.pct, stor.pct > 80 ? '#ef5350' : '#4ecdc4')} />
          </div>
        </div>
      )}

      {/* Circuit Breakers */}
      {data?.circuits && Object.keys(data.circuits).length > 0 && (
        <div style={s.section}>
          <div style={s.sectionTitle}>Circuit Breakers</div>
          {Object.entries(data.circuits).map(([adapter, state]) => (
            <div key={adapter} style={s.row}>
              <span style={s.label}>
                <span style={s.badge(statusColor(state.state || 'closed'))} />
                {adapter}
              </span>
              <span style={{ ...s.value, color: statusColor(state.state || 'closed') }}>
                {state.state || 'closed'}
                {state.failures > 0 && ` (${state.failures} failures)`}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Fetch Cache */}
      {data?.fetchCache && (
        <div style={s.section}>
          <div style={s.sectionTitle}>In-Memory Cache</div>
          <div style={s.row}>
            <span style={s.label}>Entries</span>
            <span style={s.value}>
              {data.fetchCache.size || 0} / {data.fetchCache.maxSize || '?'}
            </span>
          </div>
        </div>
      )}

      {/* IndexedDB Stats */}
      {data?.idb && Object.keys(data.idb).length > 0 && (
        <div style={s.section}>
          <div style={s.sectionTitle}>IndexedDB Stores</div>
          {Object.entries(data.idb).map(([store, count]) => (
            <div key={store} style={s.row}>
              <span style={s.label}>{store}</span>
              <span style={s.value}>{count} records</span>
            </div>
          ))}
        </div>
      )}

      {/* Streaming Indicators */}
      {data?.indicators && (
        <div style={s.section}>
          <div style={s.sectionTitle}>Streaming Indicators</div>
          <div style={s.row}>
            <span style={s.label}>Worker</span>
            <span style={{ ...s.value, color: data.indicators.workerActive ? '#4ecdc4' : '#8899aa' }}>
              {data.indicators.workerActive ? 'Active (off-thread)' : 'Main thread fallback'}
            </span>
          </div>
          {data.indicators.active && Object.keys(data.indicators.active).length > 0 && (
            Object.entries(data.indicators.active).map(([sym, inds]) => (
              <div key={sym} style={s.row}>
                <span style={s.label}>{sym}</span>
                <span style={s.value}>{Array.isArray(inds) ? inds.join(', ') : String(inds)}</span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Event Bus */}
      {data?.events && Object.keys(data.events).length > 0 && (
        <div style={s.section}>
          <div style={s.sectionTitle}>Event Bus</div>
          {Object.entries(data.events)
            .filter(([k]) => !k.startsWith('_'))
            .slice(0, 10)
            .map(([type, count]) => (
              <div key={type} style={s.row}>
                <span style={s.label}>{type}</span>
                <span style={s.value}>{count}×</span>
              </div>
            ))}
          <div style={s.row}>
            <span style={s.label}>Listeners</span>
            <span style={s.value}>{data.events._totalListeners || 0}</span>
          </div>
        </div>
      )}

      {/* Bandwidth */}
      {data?.bandwidth && Object.keys(data.bandwidth).length > 0 && (
        <div style={s.section}>
          <div style={s.sectionTitle}>Bandwidth</div>
          {data.bandwidth.totalBytes != null && (
            <div style={s.row}>
              <span style={s.label}>Total transferred</span>
              <span style={s.value}>{formatBytes(data.bandwidth.totalBytes)}</span>
            </div>
          )}
          {data.bandwidth.savedBytes != null && (
            <div style={s.row}>
              <span style={s.label}>Saved by caching</span>
              <span style={s.green}>{formatBytes(data.bandwidth.savedBytes)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
