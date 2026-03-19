// ═══════════════════════════════════════════════════════════════════
// charEdge v17 — Pipeline Dev Tools Panel
//
// Developer-focused diagnostic overlay (Ctrl+Shift+D) that shows
// real-time engine internals: tick rates, memory budgets, worker
// pool status, adapter health, connection states, and telemetry.
//
// This is NOT shown to end users — it's a debug tool for
// development and performance tuning.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { logger } from '@/observability/logger';

// ─── Styles ────────────────────────────────────────────────────

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    width: '420px',
    background: 'rgba(10, 14, 22, 0.96)',
    backdropFilter: 'blur(12px)',
    borderLeft: '1px solid rgba(100, 200, 255, 0.15)',
    color: '#c8d6e5',
    fontFamily: '"JetBrains Mono", "Fira Code", "SF Mono", monospace',
    fontSize: '11px',
    lineHeight: '1.5',
    zIndex: 99999,
    overflowY: 'auto',
    padding: '12px',
    boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.5)',
    transition: 'transform 0.2s ease',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '4px 0 8px',
    borderBottom: '1px solid rgba(100, 200, 255, 0.1)',
    marginBottom: '8px',
  },
  title: {
    color: '#64d8ff',
    fontSize: '13px',
    fontWeight: 700,
    letterSpacing: '0.5px',
  },
  closeBtn: {
    background: 'none',
    border: '1px solid rgba(255, 100, 100, 0.3)',
    color: '#ff6464',
    cursor: 'pointer',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontFamily: 'inherit',
  },
  section: {
    marginBottom: '12px',
    padding: '8px',
    background: 'rgba(255, 255, 255, 0.02)',
    borderRadius: '6px',
    border: '1px solid rgba(255, 255, 255, 0.05)',
  },
  sectionTitle: {
    color: '#64d8ff',
    fontSize: '11px',
    fontWeight: 600,
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '2px 0',
  },
  label: {
    color: '#8899aa',
  },
  value: {
    color: '#e0e8f0',
    fontWeight: 500,
  },
  good: { color: '#4ecdc4' },
  warn: { color: '#ffa726' },
  bad: { color: '#ef5350' },
  badge: (color) => ({
    display: 'inline-block',
    padding: '1px 6px',
    borderRadius: '3px',
    background: `${color}20`,
    color: color,
    fontSize: '10px',
    fontWeight: 600,
  }),
  exportBtn: {
    background: 'rgba(100, 216, 255, 0.1)',
    border: '1px solid rgba(100, 216, 255, 0.3)',
    color: '#64d8ff',
    cursor: 'pointer',
    padding: '4px 10px',
    borderRadius: '4px',
    fontSize: '10px',
    fontFamily: 'inherit',
    marginTop: '4px',
  },
};

// ─── Health Color Helper ───────────────────────────────────────

function healthColor(level) {
  if (level === 'healthy') return '#4ecdc4';
  if (level === 'degraded' || level === 'warning') return '#ffa726';
  return '#ef5350';
}

function scoreStyle(score) {
  if (score >= 70) return styles.good;
  if (score >= 40) return styles.warn;
  return styles.bad;
}

// ─── Component ─────────────────────────────────────────────────

function PipelineDevTools() {
  const [visible, setVisible] = useState(false);
  const [snapshot, setSnapshot] = useState(null);
  const intervalRef = useRef(null);

  // Toggle on Ctrl+Shift+D
  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setVisible(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Poll engine stats when visible
  const collectSnapshot = useCallback(async () => {
    try {
      const snap = {};

      // Pipeline Logger
      try {
        const { pipelineLogger } = await import('../../../data/engine/infra/DataPipelineLogger.js');
        snap.logger = pipelineLogger.getStats();
        snap.recentErrors = pipelineLogger.getRecentErrors(5);
      // eslint-disable-next-line unused-imports/no-unused-vars
      } catch (_) { snap.logger = null; }

      // Pipeline Health Monitor
      try {
        const { pipelineHealthMonitor } = await import('../../../data/engine/infra/PipelineHealthMonitor.js');
        snap.health = pipelineHealthMonitor.getHealthSnapshot();
      // eslint-disable-next-line unused-imports/no-unused-vars
      } catch (_) { snap.health = null; }

      // Compute Worker Pool
      try {
        const { computePool } = await import('../../../data/engine/infra/ComputeWorkerPool.js');
        snap.workerPool = computePool.getStats();
      // eslint-disable-next-line unused-imports/no-unused-vars
      } catch (_) { snap.workerPool = null; }

      // Ticker Plant
      try {
        const { tickerPlant } = await import('../../../data/engine/streaming/TickerPlant.ts');
        snap.tickerPlant = tickerPlant.getHealth();
        snap.adapterHealth = tickerPlant.getAdapterHealth?.() || {};
      // eslint-disable-next-line unused-imports/no-unused-vars
      } catch (_) { snap.tickerPlant = null; snap.adapterHealth = {}; }

      // Tick Persistence
      try {
        const { tickPersistence } = await import('../../../data/engine/streaming/TickPersistence.js');
        snap.persistence = tickPersistence.getStats();
      // eslint-disable-next-line unused-imports/no-unused-vars
      } catch (_) { snap.persistence = null; }

      // Memory Budget
      try {
        const { memoryBudget } = await import('../../../data/engine/infra/MemoryBudget.js');
        snap.memory = memoryBudget.getSnapshot();
      // eslint-disable-next-line unused-imports/no-unused-vars
      } catch (_) { snap.memory = null; }

      // Streaming Indicator Bridge
      try {
        const { streamingIndicatorBridge } = await import('../../../data/engine/indicators/StreamingIndicatorBridge.js');
        snap.indicators = {
          workerActive: streamingIndicatorBridge.isWorkerActive?.() || false,
          activeSymbols: streamingIndicatorBridge.getActiveSymbols(),
        };
      // eslint-disable-next-line unused-imports/no-unused-vars
      } catch (_) { snap.indicators = null; }

      snap.timestamp = Date.now();
      setSnapshot(snap);
    } catch (e) { logger.ui.warn('Operation failed', e); }
  }, []);

  useEffect(() => {
    if (visible) {
      collectSnapshot();
      intervalRef.current = setInterval(collectSnapshot, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [visible, collectSnapshot]);

  const handleExportTelemetry = useCallback(async () => {
    try {
      const { pipelineLogger } = await import('../../../data/engine/infra/DataPipelineLogger.js');
      pipelineLogger.exportTelemetry({ download: true });
    } catch (e) { logger.ui.warn('Operation failed', e); }
  }, []);

  if (!visible) return null;

  const s = snapshot || {};

  return (
    <div style={styles.overlay} id="pipeline-dev-tools">
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.title}>⚡ Pipeline Dev Tools</span>
        <button style={styles.closeBtn} onClick={() => setVisible(false)}>✕ Close</button>
      </div>

      {/* Pipeline Health */}
      {s.health && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Pipeline Health</div>
          <div style={styles.row}>
            <span style={styles.label}>Status</span>
            <span style={styles.badge(healthColor(s.health.status))}>{s.health.status?.toUpperCase()}</span>
          </div>
          {s.health.issues?.length > 0 && (
            <div style={{ color: '#ffa726', marginTop: '4px', fontSize: '10px' }}>
              {s.health.issues.map((iss, i) => <div key={i}>⚠ {iss}</div>)}
            </div>
          )}
        </div>
      )}

      {/* Memory Budget */}
      {s.memory && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Memory Budget</div>
          <div style={styles.row}>
            <span style={styles.label}>Usage</span>
            <span style={scoreStyle(100 - (s.memory.usedPercent || 0))}>
              {(s.memory.usedMB || 0).toFixed(1)} / {(s.memory.budgetMB || 200).toFixed(0)} MB
              ({(s.memory.usedPercent || 0).toFixed(1)}%)
            </span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>Level</span>
            <span style={styles.badge(healthColor(s.memory.level || 'healthy'))}>{(s.memory.level || 'healthy').toUpperCase()}</span>
          </div>
        </div>
      )}

      {/* Worker Pool */}
      {s.workerPool && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Compute Worker Pool</div>
          <div style={styles.row}>
            <span style={styles.label}>Pool Size</span>
            <span style={styles.value}>{s.workerPool.poolSize} workers</span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>Busy / Idle</span>
            <span style={styles.value}>
              <span style={s.workerPool.busyWorkers > 0 ? styles.warn : styles.good}>{s.workerPool.busyWorkers}</span>
              {' / '}
              <span style={styles.good}>{s.workerPool.idleWorkers}</span>
            </span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>Queue</span>
            <span style={s.workerPool.queueLength > 5 ? styles.warn : styles.value}>{s.workerPool.queueLength}</span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>Total Tasks</span>
            <span style={styles.value}>{s.workerPool.totalSubmitted}</span>
          </div>
          {s.workerPool.workerStats?.map(w => (
            <div key={w.id} style={{ ...styles.row, fontSize: '10px', color: '#667788' }}>
              <span>W{w.id}: {w.specialization || '—'}</span>
              <span>{w.tasksCompleted} done {w.busy ? '🔴' : '🟢'}</span>
            </div>
          ))}
        </div>
      )}

      {/* Adapter Health */}
      {Object.keys(s.adapterHealth || {}).length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Adapter Health</div>
          {Object.entries(s.adapterHealth).map(([id, h]) => (
            <div key={id} style={{ ...styles.row, alignItems: 'center' }}>
              <span style={styles.label}>{id}</span>
              <span>
                <span style={scoreStyle(h.score)}>{h.score}</span>
                <span style={{ ...styles.badge(healthColor(h.level)), marginLeft: '6px' }}>{h.level}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Streaming Indicators */}
      {s.indicators && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Streaming Indicators</div>
          <div style={styles.row}>
            <span style={styles.label}>Worker</span>
            <span style={s.indicators.workerActive ? styles.good : styles.warn}>
              {s.indicators.workerActive ? '✓ Offloaded' : '⚠ Main Thread'}
            </span>
          </div>
          {Object.entries(s.indicators.activeSymbols || {}).map(([sym, inds]) => (
            <div key={sym} style={{ ...styles.row, fontSize: '10px' }}>
              <span style={styles.label}>{sym}</span>
              <span style={{ color: '#8899aa' }}>{(inds || []).join(', ')}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tick Persistence */}
      {s.persistence && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Tick Persistence</div>
          <div style={styles.row}>
            <span style={styles.label}>Enqueued / Flushed</span>
            <span style={styles.value}>{s.persistence.totalEnqueued} / {s.persistence.totalFlushed}</span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>Pending</span>
            <span style={s.persistence.pendingFlush > 100 ? styles.warn : styles.value}>{s.persistence.pendingFlush}</span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>Active Symbols</span>
            <span style={styles.value}>{(s.persistence.symbols || []).join(', ') || '—'}</span>
          </div>
        </div>
      )}

      {/* Logger Stats */}
      {s.logger && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Logger</div>
          <div style={styles.row}>
            <span style={styles.label}>Total Entries</span>
            <span style={styles.value}>{s.logger.totalEntries}</span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>Errors / Warns</span>
            <span style={styles.value}>
              <span style={s.logger.byLevel?.error > 0 ? styles.bad : styles.good}>{s.logger.byLevel?.error || 0}</span>
              {' / '}
              <span style={s.logger.byLevel?.warn > 0 ? styles.warn : styles.good}>{s.logger.byLevel?.warn || 0}</span>
            </span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>Error Rate (60s)</span>
            <span style={s.logger.recentErrorRate > 5 ? styles.bad : styles.value}>{s.logger.recentErrorRate}/min</span>
          </div>
          {s.logger.errorBudgetBreached && (
            <div style={{ color: '#ef5350', marginTop: '4px', fontSize: '10px' }}>🚨 Error budget breached!</div>
          )}
        </div>
      )}

      {/* Recent Errors */}
      {(s.recentErrors || []).length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Recent Errors</div>
          {s.recentErrors.map((err, i) => (
            <div key={i} style={{ fontSize: '10px', color: '#ff8a80', padding: '2px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <span style={{ color: '#667788' }}>[{err.source}]</span> {err.message}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Actions</div>
        <button style={styles.exportBtn} onClick={handleExportTelemetry}>
          📥 Export Telemetry JSON
        </button>
      </div>

      {/* Timestamp */}
      <div style={{ textAlign: 'center', color: '#445566', fontSize: '9px', marginTop: '8px' }}>
        Updated: {s.timestamp ? new Date(s.timestamp).toLocaleTimeString() : '—'}
        {' · '} Ctrl+Shift+D to toggle
      </div>
    </div>
  );
}

export default React.memo(PipelineDevTools);
