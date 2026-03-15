// ═══════════════════════════════════════════════════════════════════
// charEdge — Multi-Asset Alert Dashboard (Sprint 10)
//
// Bird's-eye view of all alerts across all symbols.
//   - Grouped by symbol with alert counts
//   - Statistics bar: active, triggered today, expired
//   - Per-symbol expand to see individual alert details
//   - Bulk actions: mute all, delete triggered, export config
//   - Accessible from AlertPanel or Settings
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useMemo, useCallback } from 'react';
import { C, F, M } from '../../../constants.js';
import { radii } from '../../../theme/tokens.js';
import { Card } from '../ui/UIKit.jsx';

// ─── Dashboard Component ────────────────────────────────────────

function AlertDashboard({ alerts = [], onMuteSymbol, onDeleteAlert, onEditAlert }) {
  const [expanded, setExpanded] = useState(null);
  const [filter, setFilter] = useState('all'); // all | active | triggered | expired

  // Group alerts by symbol
  const grouped = useMemo(() => {
    const map = {};
    for (const alert of alerts) {
      const sym = alert.symbol || 'Unknown';
      if (!map[sym]) map[sym] = [];
      map[sym].push(alert);
    }
    return map;
  }, [alerts]);

  // Filter alerts
  const filteredAlerts = useMemo(() => {
    if (filter === 'all') return alerts;
    if (filter === 'active') return alerts.filter((a) => !a.triggered && !a.expired);
    if (filter === 'triggered') return alerts.filter((a) => a.triggered);
    if (filter === 'expired') return alerts.filter((a) => a.expired);
    return alerts;
  }, [alerts, filter]);

  // Stats
  const stats = useMemo(() => {
    const active = alerts.filter((a) => !a.triggered && !a.expired).length;
    const triggeredToday = alerts.filter((a) => {
      if (!a.lastTriggered) return false;
      const d = new Date(a.lastTriggered);
      const now = new Date();
      return d.getDate() === now.getDate() && d.getMonth() === now.getMonth();
    }).length;
    const expired = alerts.filter((a) => a.expired).length;
    return { active, triggeredToday, expired, total: alerts.length };
  }, [alerts]);

  // Group the filtered alerts
  const filteredGrouped = useMemo(() => {
    const map = {};
    for (const alert of filteredAlerts) {
      const sym = alert.symbol || 'Unknown';
      if (!map[sym]) map[sym] = [];
      map[sym].push(alert);
    }
    return map;
  }, [filteredAlerts]);

  const symbolList = Object.keys(filteredGrouped).sort();

  return (
    <div>
      {/* Stats Bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[
          { label: 'Active', value: stats.active, color: C.g },
          { label: 'Triggered Today', value: stats.triggeredToday, color: C.b },
          { label: 'Expired', value: stats.expired, color: C.t3 },
          { label: 'Total', value: stats.total, color: C.t1 },
        ].map((stat) => (
          <Card
            key={stat.label}
            style={{
              flex: 1,
              padding: '12px 10px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 800, color: stat.color, fontFamily: F }}>
              {stat.value}
            </div>
            <div style={{ fontSize: 9, color: C.t3, fontFamily: M, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.3 }}>
              {stat.label}
            </div>
          </Card>
        ))}
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {['all', 'active', 'triggered', 'expired'].map((f) => (
          <button
            key={f}
            className="tf-btn"
            onClick={() => setFilter(f)}
            style={{
              padding: '5px 12px',
              borderRadius: radii.sm,
              border: `1px solid ${filter === f ? C.b : C.bd}`,
              background: filter === f ? `${C.b}12` : 'transparent',
              color: filter === f ? C.b : C.t3,
              fontSize: 10,
              fontFamily: M,
              fontWeight: filter === f ? 600 : 400,
              cursor: 'pointer',
              textTransform: 'capitalize',
              transition: 'all 0.15s',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Symbol Groups */}
      {symbolList.length === 0 ? (
        <Card style={{ padding: '32px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.4 }}>🔔</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.t2, fontFamily: F }}>No alerts found</div>
          <div style={{ fontSize: 11, color: C.t3, fontFamily: F, marginTop: 4 }}>
            {filter === 'all' ? 'Create your first price alert to get started.' : `No ${filter} alerts to show.`}
          </div>
        </Card>
      ) : (
        symbolList.map((symbol) => (
          <SymbolGroup
            key={symbol}
            symbol={symbol}
            alerts={filteredGrouped[symbol]}
            isExpanded={expanded === symbol}
            onToggle={() => setExpanded(expanded === symbol ? null : symbol)}
            onMuteSymbol={onMuteSymbol}
            onDeleteAlert={onDeleteAlert}
            onEditAlert={onEditAlert}
          />
        ))
      )}
    </div>
  );
}

// ─── Symbol Group ───────────────────────────────────────────────

function SymbolGroup({ symbol, alerts, isExpanded, onToggle, onMuteSymbol, onDeleteAlert, onEditAlert }) {
  const active = alerts.filter((a) => !a.triggered && !a.expired).length;
  const triggered = alerts.filter((a) => a.triggered).length;

  return (
    <Card style={{ padding: 0, marginBottom: 8, overflow: 'hidden' }}>
      {/* Group Header */}
      <button
        className="tf-btn"
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          padding: '12px 14px',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 12, color: C.t3, transition: 'transform 0.2s', transform: isExpanded ? 'rotate(90deg)' : 'none' }}>
          ▸
        </span>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: F }}>{symbol}</span>
          <span style={{ fontSize: 11, color: C.t3, fontFamily: M, marginLeft: 8 }}>
            {alerts.length} alert{alerts.length > 1 ? 's' : ''}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {active > 0 && (
            <span style={{
              fontSize: 9, fontFamily: M, fontWeight: 600,
              padding: '2px 6px', borderRadius: 4,
              background: `${C.g}15`, color: C.g,
            }}>
              {active} active
            </span>
          )}
          {triggered > 0 && (
            <span style={{
              fontSize: 9, fontFamily: M, fontWeight: 600,
              padding: '2px 6px', borderRadius: 4,
              background: `${C.b}15`, color: C.b,
            }}>
              {triggered} fired
            </span>
          )}
        </div>
      </button>

      {/* Expanded Alert List */}
      {isExpanded && (
        <div style={{ borderTop: `1px solid ${C.bd}20` }}>
          {/* Bulk Actions */}
          <div style={{ display: 'flex', gap: 6, padding: '8px 14px', borderBottom: `1px solid ${C.bd}10` }}>
            {onMuteSymbol && (
              <button
                className="tf-btn"
                onClick={() => onMuteSymbol(symbol)}
                style={actionBtnStyle}
              >
                🔇 Mute All
              </button>
            )}
            {triggered > 0 && onDeleteAlert && (
              <button
                className="tf-btn"
                onClick={() => {
                  alerts.filter((a) => a.triggered).forEach((a) => onDeleteAlert(a.id));
                }}
                style={actionBtnStyle}
              >
                🗑 Delete Triggered
              </button>
            )}
          </div>

          {/* Individual Alerts */}
          {alerts.map((alert) => (
            <AlertRow key={alert.id} alert={alert} onEdit={onEditAlert} onDelete={onDeleteAlert} />
          ))}
        </div>
      )}
    </Card>
  );
}

// ─── Individual Alert Row ───────────────────────────────────────

const COND_ICONS = {
  above: '↑',
  below: '↓',
  cross_above: '↗',
  cross_below: '↘',
  percent_above: '📈',
  percent_below: '📉',
  '52w_high': '🌟',
  '52w_low': '⚠️',
};

function AlertRow({ alert, onEdit, onDelete }) {
  const condIcon = COND_ICONS[alert.condition] || '🔔';
  const isTriggered = alert.triggered;
  const isExpired = alert.expired;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        borderBottom: `1px solid ${C.bd}10`,
        opacity: isExpired ? 0.5 : 1,
      }}
    >
      <span style={{ fontSize: 14, width: 20, textAlign: 'center' }}>{condIcon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, color: C.t1, fontFamily: F }}>
          {alert.condition} ${alert.price?.toFixed(2)}
        </div>
        <div style={{ fontSize: 10, color: C.t3, fontFamily: M, marginTop: 1 }}>
          {isTriggered ? `Fired ${timeAgo(alert.lastTriggered)}` : isExpired ? 'Expired' : 'Active'}
          {alert.repeatMode && ` · ${alert.repeatMode}`}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {onEdit && (
          <button className="tf-btn" onClick={() => onEdit(alert)} style={smBtnStyle}>✏️</button>
        )}
        {onDelete && (
          <button className="tf-btn" onClick={() => onDelete(alert.id)} style={smBtnStyle}>🗑</button>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const actionBtnStyle = {
  padding: '4px 8px',
  borderRadius: radii.sm,
  border: `1px solid ${C.bd}`,
  background: C.sf,
  color: C.t2,
  fontSize: 10,
  fontFamily: M,
  cursor: 'pointer',
  transition: 'all 0.15s',
};

const smBtnStyle = {
  background: 'none',
  border: 'none',
  fontSize: 12,
  cursor: 'pointer',
  padding: '2px 4px',
  borderRadius: radii.sm,
};

export default React.memo(AlertDashboard);
