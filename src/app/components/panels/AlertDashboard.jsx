// ═══════════════════════════════════════════════════════════════════
// charEdge — Multi-Asset Alert Dashboard (Sprint 10)
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useMemo } from 'react';
import { C } from '../../../constants.js';
import { Card } from '../ui/UIKit.jsx';
import st from './AlertDashboard.module.css';

function AlertDashboard({ alerts = [], onMuteSymbol, onDeleteAlert, onEditAlert }) {
  const [expanded, setExpanded] = useState(null);
  const [filter, setFilter] = useState('all');

  const grouped = useMemo(() => {
    const map = {};
    for (const alert of alerts) {
      const sym = alert.symbol || 'Unknown';
      if (!map[sym]) map[sym] = [];
      map[sym].push(alert);
    }
    return map;
  }, [alerts]);

  const filteredAlerts = useMemo(() => {
    if (filter === 'all') return alerts;
    if (filter === 'active') return alerts.filter((a) => !a.triggered && !a.expired);
    if (filter === 'triggered') return alerts.filter((a) => a.triggered);
    if (filter === 'expired') return alerts.filter((a) => a.expired);
    return alerts;
  }, [alerts, filter]);

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
      <div className={st.statsRow}>
        {[
          { label: 'Active', value: stats.active, color: C.g },
          { label: 'Triggered Today', value: stats.triggeredToday, color: C.b },
          { label: 'Expired', value: stats.expired, color: C.t3 },
          { label: 'Total', value: stats.total, color: C.t1 },
        ].map((stat) => (
          <Card key={stat.label} className={st.statCard}>
            <div className={st.statValue} style={{ color: stat.color }}>{stat.value}</div>
            <div className={st.statLabel}>{stat.label}</div>
          </Card>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className={st.filterRow}>
        {['all', 'active', 'triggered', 'expired'].map((f) => (
          <button
            key={f}
            className={`tf-btn ${st.filterBtn} ${filter === f ? st.filterBtnActive : st.filterBtnInactive}`}
            onClick={() => setFilter(f)}
          >{f}</button>
        ))}
      </div>

      {/* Symbol Groups */}
      {symbolList.length === 0 ? (
        <Card className={st.emptyCard}>
          <div className={st.emptyIcon}>🔔</div>
          <div className={st.emptyTitle}>No alerts found</div>
          <div className={st.emptyDesc}>
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
    <Card className={st.groupCard}>
      <button className={`tf-btn ${st.groupBtn}`} onClick={onToggle}>
        <span className={`${st.groupChevron} ${isExpanded ? st.groupChevronOpen : ''}`}>▸</span>
        <div className={st.groupBody}>
          <span className={st.groupSymbol}>{symbol}</span>
          <span className={st.groupCount}>
            {alerts.length} alert{alerts.length > 1 ? 's' : ''}
          </span>
        </div>
        <div className={st.groupBadges}>
          {active > 0 && <span className={`${st.groupBadge} ${st.badgeGreen}`}>{active} active</span>}
          {triggered > 0 && <span className={`${st.groupBadge} ${st.badgeBlue}`}>{triggered} fired</span>}
        </div>
      </button>

      {isExpanded && (
        <div className={st.expandedBody}>
          <div className={st.bulkRow}>
            {onMuteSymbol && (
              <button className={`tf-btn ${st.actionBtn}`} onClick={() => onMuteSymbol(symbol)}>
                🔇 Mute All
              </button>
            )}
            {triggered > 0 && onDeleteAlert && (
              <button className={`tf-btn ${st.actionBtn}`} onClick={() => {
                alerts.filter((a) => a.triggered).forEach((a) => onDeleteAlert(a.id));
              }}>
                🗑 Delete Triggered
              </button>
            )}
          </div>
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
  above: '↑', below: '↓', cross_above: '↗', cross_below: '↘',
  percent_above: '📈', percent_below: '📉', '52w_high': '🌟', '52w_low': '⚠️',
};

function AlertRow({ alert, onEdit, onDelete }) {
  const condIcon = COND_ICONS[alert.condition] || '🔔';

  return (
    <div className={`${st.alertRow} ${alert.expired ? st.alertRowExpired : ''}`}>
      <span className={st.alertIcon}>{condIcon}</span>
      <div className={st.alertBody}>
        <div className={st.alertCond}>{alert.condition} ${alert.price?.toFixed(2)}</div>
        <div className={st.alertMeta}>
          {alert.triggered ? `Fired ${timeAgo(alert.lastTriggered)}` : alert.expired ? 'Expired' : 'Active'}
          {alert.repeatMode && ` · ${alert.repeatMode}`}
        </div>
      </div>
      <div className={st.alertActions}>
        {onEdit && <button className={`tf-btn ${st.smBtn}`} onClick={() => onEdit(alert)}>✏️</button>}
        {onDelete && <button className={`tf-btn ${st.smBtn}`} onClick={() => onDelete(alert.id)}>🗑</button>}
      </div>
    </div>
  );
}

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default React.memo(AlertDashboard);
