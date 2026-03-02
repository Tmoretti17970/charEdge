// ═══════════════════════════════════════════════════════════════════
// charEdge — Data Staleness Indicator
//
// Shows data freshness as a small badge in the chart header:
//   🟢 Live       — WebSocket is delivering real-time data
//   🟢 Fresh      — Cached data is less than 5 minutes old
//   🟡 Cached Xm  — Cached data is 5min–1hr old
//   🟠 Stale Xh   — Cached data is 1hr–24hr old
//   🔴 Offline Xd — Cached data is more than 24hr old
//
// Usage:
//   <DataStalenessIndicator symbol="BTCUSDT" tfId="1D" isLive={wsConnected} />
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import { cacheManager } from '../../../../data/engine/infra/CacheManager.js';

// ─── Constants ─────────────────────────────────────────────────

const THRESHOLDS = {
  fresh: 5 * 60 * 1000,      // 5 minutes
  cached: 60 * 60 * 1000,     // 1 hour
  stale: 24 * 60 * 60 * 1000, // 24 hours
};

const STATUS = {
  live:    { label: 'Live',    color: '#22c55e', dotColor: '#22c55e', pulse: true },
  fresh:   { label: 'Fresh',   color: '#22c55e', dotColor: '#22c55e', pulse: false },
  cached:  { label: 'Cached',  color: '#f59e0b', dotColor: '#f59e0b', pulse: false },
  stale:   { label: 'Stale',   color: '#f97316', dotColor: '#f97316', pulse: false },
  offline: { label: 'Offline', color: '#ef4444', dotColor: '#ef4444', pulse: false },
  unknown: { label: '—',       color: '#6b7280', dotColor: '#6b7280', pulse: false },
};

// ─── Helpers ───────────────────────────────────────────────────

function formatAge(ms) {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  if (ms < 86_400_000) return `${(ms / 3_600_000).toFixed(1)}h`;
  return `${(ms / 86_400_000).toFixed(1)}d`;
}

function getStatus(ageMs, isLive) {
  if (isLive) return 'live';
  if (ageMs == null) return 'unknown';
  if (ageMs < THRESHOLDS.fresh) return 'fresh';
  if (ageMs < THRESHOLDS.cached) return 'cached';
  if (ageMs < THRESHOLDS.stale) return 'stale';
  return 'offline';
}

// ─── Styles ────────────────────────────────────────────────────

const styles = {
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 600,
    fontFamily: '"Inter", system-ui, sans-serif',
    letterSpacing: '0.3px',
    whiteSpace: 'nowrap',
    userSelect: 'none',
    cursor: 'default',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
  },
  tooltip: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 4,
    padding: '6px 10px',
    borderRadius: 6,
    fontSize: 10,
    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    border: '1px solid rgba(148, 163, 184, 0.2)',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
    color: '#94a3b8',
    whiteSpace: 'nowrap',
    zIndex: 100,
    lineHeight: 1.5,
  },
};

// ─── Component ─────────────────────────────────────────────────

export default function DataStalenessIndicator({ symbol, tfId, isLive = false }) {
  const [info, setInfo] = useState(null);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    function update() {
      const lastUpdate = cacheManager.getLastUpdate(symbol, tfId);
      setInfo(lastUpdate);
    }
    update();
    const timer = setInterval(update, 5000); // Update every 5s
    return () => clearInterval(timer);
  }, [symbol, tfId]);

  const ageMs = info?.ageMs ?? null;
  const statusKey = getStatus(ageMs, isLive);
  const status = STATUS[statusKey];
  const ageLabel = ageMs != null && statusKey !== 'live' && statusKey !== 'fresh' && statusKey !== 'unknown'
    ? ` (${formatAge(ageMs)} ago)`
    : '';

  return (
    <div
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      aria-label={`Data status: ${status.label}${ageLabel}`}
    >
      <div
        style={{
          ...styles.badge,
          color: status.color,
          backgroundColor: `${status.color}15`,
        }}
      >
        <span
          style={{
            ...styles.dot,
            backgroundColor: status.dotColor,
            ...(status.pulse ? { animation: 'stalenessLivePulse 1.5s ease-in-out infinite' } : {}),
          }}
        />
        {status.label}{ageLabel}
      </div>

      {showTooltip && info && (
        <div style={styles.tooltip}>
          <div>Source: <span style={{ color: '#e2e8f0' }}>{info.source || 'unknown'}</span></div>
          <div>Age: <span style={{ color: '#e2e8f0' }}>{ageMs != null ? formatAge(ageMs) : '—'}</span></div>
          <div>Updated: <span style={{ color: '#e2e8f0' }}>{info.timestamp ? new Date(info.timestamp).toLocaleTimeString() : '—'}</span></div>
        </div>
      )}

      <style>{`
        @keyframes stalenessLivePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
