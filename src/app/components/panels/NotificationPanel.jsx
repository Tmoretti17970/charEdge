// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — Unified Notification Center (Sprint 8)
//
// Single Apple-style notification hub. The Alerts tab now includes
// full price alert management (create, quick presets, active list).
//
//   - Tabbed view: All | Alerts | Trading | System
//   - Alerts tab: inline alert creation + active/triggered list
//   - Category badges per notification
//   - Quick actions: dismiss individual, mute category
//   - Time grouping: Now | Earlier Today | Yesterday
//   - "Notification Settings" footer link
//   - Keyboard accessible (Ctrl+. to toggle, Esc to close)
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { C, M } from '../../../constants.js';
import { useAlertStore } from '../../../state/useAlertStore';
import { useNotificationStore } from '../../../state/useNotificationStore';
import { usePriceTracker } from '../../../state/usePriceTracker';
import { radii } from '../../../theme/tokens.js';
import css from './NotificationPanel.module.css';
import { useHotkeys } from '@/hooks/useHotkeys';

// ─── Constants ────────────────────────────────────────────────────

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'trading', label: 'Trading' },
  { id: 'system', label: 'System' },
];

const TAB_CATEGORIES = {
  all: null, // show everything
  alerts: ['alert', 'priceAlerts', 'customAlerts', 'smartAlerts', 'securityAlerts'],
  trading: ['trade', 'advancedTransactions', 'import', 'reconcile'],
  system: ['system', 'undo', 'redo', 'offersAnnouncements'],
};

const TYPE_STYLES = {
  success: { icon: '✓', color: C.g },
  error: { icon: '✕', color: C.r },
  warning: { icon: '⚠', color: C.y },
  info: { icon: 'ℹ', color: C.b },
  undo: { icon: '↶', color: C.p || '#a78bfa' },
  redo: { icon: '↷', color: C.p || '#a78bfa' },
};

const CATEGORY_LABELS = {
  trade: '📋 Trade',
  import: '📥 Import',
  reconcile: '🔄 Reconcile',
  system: '⚙️ System',
  undo: '↶ Undo',
  alert: '🔔 Alert',
  priceAlerts: '💰 Price',
  customAlerts: '🎯 Custom',
  smartAlerts: '⚡ Smart',
  securityAlerts: '🔐 Security',
  advancedTransactions: '📋 Trade',
  offersAnnouncements: '🎁 Offers',
  tradingInsights: '📊 Insights',
};

// ─── Alert Constants ──────────────────────────────────────────────

const CONDITIONS = [
  { id: 'above', label: '↑ Above', desc: 'Price goes above target' },
  { id: 'below', label: '↓ Below', desc: 'Price drops below target' },
  { id: 'cross_above', label: '↗ Cross Above', desc: 'Price crosses above target' },
  { id: 'cross_below', label: '↘ Cross Below', desc: 'Price crosses below target' },
];

const PRESETS = [
  { id: '52w_high', label: '📈 52W High', color: '#10b981' },
  { id: '52w_low', label: '📉 52W Low', color: '#ef4444' },
  { id: 'percent_5_up', label: '📊 +5%', color: '#3b82f6' },
  { id: 'percent_5_down', label: '📊 -5%', color: '#f59e0b' },
  { id: 'percent_10_up', label: '🚀 +10%', color: '#8b5cf6' },
  { id: 'percent_10_down', label: '💥 -10%', color: '#ec4899' },
];

// ─── Time Formatting ──────────────────────────────────────────────

function timeAgo(ts) {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatAlertTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  if (diffMs < 60_000) return 'just now';
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getTimeGroup(ts) {
  const now = new Date();
  const date = new Date(ts);
  const diff = now - date;

  if (diff < 3_600_000) return 'Now';
  if (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  ) {
    return 'Earlier Today';
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  ) {
    return 'Yesterday';
  }

  return 'Older';
}

// ─── Panel Component ──────────────────────────────────────────────

function NotificationPanel({ initialTab = null }) {
  const entries = useNotificationStore((s) => s.logEntries);
  const panelOpen = useNotificationStore((s) => s.logPanelOpen);
  const closePanel = useNotificationStore((s) => s.closeLogPanel);
  const clearLog = useNotificationStore((s) => s.clearLog);
  const panelRef = useRef(null);
  const [activeTab, setActiveTab] = useState(initialTab || 'all');
  const [dismissed, setDismissed] = useState(new Set());

  // If initialTab changes (e.g. from workspace alerts slot), update tab
  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  useHotkeys([{ key: 'Escape', handler: closePanel, description: 'Close notification panel', allowInInput: true }], {
    scope: 'panel:notifications',
    enabled: panelOpen,
  });

  // Reset dismissed when panel closes
  useEffect(() => {
    if (!panelOpen) setDismissed(new Set());
  }, [panelOpen]);

  // Filtered + grouped entries
  const grouped = useMemo(() => {
    const tabCats = TAB_CATEGORIES[activeTab];
    const filtered = entries
      .filter((e) => !dismissed.has(e.id))
      .filter((e) => !tabCats || tabCats.includes(e.category))
      .reverse(); // newest first

    const groups = {};
    for (const entry of filtered) {
      const group = getTimeGroup(entry.ts);
      if (!groups[group]) groups[group] = [];
      groups[group].push(entry);
    }

    return groups;
  }, [entries, activeTab, dismissed]);

  const totalFiltered = Object.values(grouped).reduce((sum, g) => sum + g.length, 0);

  const handleDismiss = useCallback((id) => {
    setDismissed((prev) => new Set(prev).add(id));
  }, []);

  if (!panelOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div onClick={closePanel} className={css.backdrop} />

      {/* Panel */}
      <div className={css.panel} style={{ background: C.bg2 || C.sf, borderLeft: `1px solid ${C.bd}` }}>
        {/* Header */}
        <div className={css.headerWrap} style={{ borderBottom: `1px solid ${C.bd}` }}>
          <div className={css.headerRow}>
            <div className={css.headerLeft}>
              <span className={css.headerTitle}>Notifications</span>
              {entries.length > 0 && (
                <span className={css.headerBadge} style={{ background: C.b }}>
                  {entries.length}
                </span>
              )}
            </div>
            <div className={css.headerActions}>
              {entries.length > 0 && (
                <button
                  className={`tf-btn ${css.clearAllBtn}`}
                  onClick={clearLog}
                  style={{ border: `1px solid ${C.bd}` }}
                >
                  Clear All
                </button>
              )}
              <button className={`tf-btn ${css.closeBtn}`} onClick={closePanel}>
                ✕
              </button>
            </div>
          </div>

          {/* Tab Bar */}
          <div className={css.tabBar}>
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  className={`tf-btn ${css.tabBtn}`}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    color: isActive ? C.b : C.t3,
                    fontWeight: isActive ? 700 : 500,
                    borderBottom: isActive ? `2px solid ${C.b}` : '2px solid transparent',
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Area */}
        <div ref={panelRef} className={css.contentArea}>
          {activeTab === 'alerts' && <AlertManagementSection />}

          {totalFiltered === 0 && activeTab !== 'alerts' ? (
            <div className={css.emptyState}>
              <div className={css.emptyIcon}>🔔</div>
              <div className={css.emptyTitle}>
                {activeTab === 'all' ? 'No notifications yet' : `No ${activeTab} notifications`}
              </div>
              <div className={css.emptyDesc}>
                {activeTab === 'all'
                  ? 'Price alerts, trade activity, and system events will appear here.'
                  : 'Try switching tabs to see other notification types.'}
              </div>
            </div>
          ) : (
            <>
              {/* For alerts tab, show triggered notifications under the alert management section */}
              {activeTab === 'alerts' && totalFiltered === 0 ? null : (
                <>
                  {activeTab === 'alerts' && totalFiltered > 0 && (
                    <div className={css.timeGroupLabel} style={{ borderTop: `1px solid ${C.bd}20` }}>
                      Alert History
                    </div>
                  )}
                  {Object.entries(grouped).map(([label, items]) => (
                    <TimeGroup
                      key={label}
                      label={activeTab === 'alerts' ? null : label}
                      entries={items}
                      onDismiss={handleDismiss}
                    />
                  ))}
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className={css.footer} style={{ borderTop: `1px solid ${C.bd}` }}>
          <button
            className={`tf-btn ${css.settingsLink}`}
            onClick={() => {
              closePanel();
              window.dispatchEvent(
                new CustomEvent('charEdge:navigate', { detail: { page: 'settings', section: 'notifications' } }),
              );
            }}
            style={{ color: C.b }}
          >
            ⚙ Notification Settings
          </button>
          <span className={css.footerShortcut}>Ctrl+. to toggle</span>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Alert Management Section — embedded in the Alerts tab
// ═══════════════════════════════════════════════════════════════════

function AlertManagementSection() {
  const alerts = useAlertStore((s) => s.alerts);
  const addAlert = useAlertStore((s) => s.addAlert);
  const addMarketAlert = useAlertStore((s) => s.addMarketAlert);
  const removeAlert = useAlertStore((s) => s.removeAlert);
  const toggleAlert = useAlertStore((s) => s.toggleAlert);
  const clearTriggered = useAlertStore((s) => s.clearTriggered);

  const [symbol, setSymbol] = useState('BTC');
  const [condition, setCondition] = useState('above');
  const [price, setPrice] = useState('');
  const [note, setNote] = useState('');
  const [repeating, setRepeating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const activeAlerts = useMemo(() => alerts.filter((a) => a.active), [alerts]);
  const triggeredAlerts = useMemo(() => alerts.filter((a) => !a.active && a.triggeredAt), [alerts]);

  // 52w proximity
  const highProximity = usePriceTracker((s) => {
    const stat = s.stats[symbol.toUpperCase()];
    if (!stat || stat.high52w === 0) return null;
    return ((stat.lastPrice - stat.high52w) / stat.high52w) * 100;
  });
  const lowProximity = usePriceTracker((s) => {
    const stat = s.stats[symbol.toUpperCase()];
    if (!stat || stat.low52w === 0) return null;
    return ((stat.lastPrice - stat.low52w) / stat.low52w) * 100;
  });

  const handleAdd = useCallback(() => {
    const p = parseFloat(price);
    if (!symbol.trim() || isNaN(p) || p <= 0) return;
    addAlert({
      symbol: symbol.trim().toUpperCase(),
      condition,
      price: p,
      note,
      repeating,
    });
    setPrice('');
    setNote('');
  }, [symbol, condition, price, note, repeating, addAlert]);

  const handlePresetClick = useCallback(
    (presetId) => {
      if (!symbol.trim()) return;
      addMarketAlert({ symbol: symbol.trim().toUpperCase(), preset: presetId });
    },
    [symbol, addMarketAlert],
  );

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleAdd();
  };

  const inputStyle = {
    background: C.sf,
    border: `1px solid ${C.bd}`,
    color: C.t1,
    borderRadius: radii.sm,
    padding: '6px 10px',
    fontFamily: M,
    fontSize: 12,
    outline: 'none',
    transition: 'border-color 0.15s',
  };

  return (
    <div className={css.alertWrap}>
      {/* ─── Quick Presets ─────────────────────────── */}
      <div className={css.presetSection}>
        <div className={css.presetHeader}>
          <div className={css.presetLeft}>
            <span className={css.presetLabel}>⚡ Quick Alerts</span>
            <input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="SYM"
              style={{
                ...inputStyle,
                width: 56,
                fontWeight: 700,
                textAlign: 'center',
                padding: '3px 6px',
                fontSize: 11,
              }}
            />
          </div>
          {highProximity != null && Math.abs(highProximity) < 3 && (
            <span className={css.proximityBadge} style={{ background: '#10b98115', color: '#10b981' }}>
              🌟 {Math.abs(highProximity).toFixed(1)}% from 52W High
            </span>
          )}
        </div>
        <div className={css.presetGrid}>
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handlePresetClick(preset.id)}
              className={css.presetBtn}
              style={{
                border: `1px solid ${preset.color}25`,
                background: `${preset.color}08`,
                color: preset.color,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = `${preset.color}20`;
                e.currentTarget.style.borderColor = `${preset.color}50`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = `${preset.color}08`;
                e.currentTarget.style.borderColor = `${preset.color}25`;
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
        {lowProximity != null && Math.abs(lowProximity) < 5 && (
          <div className={css.lowWarning}>⚠️ Within {lowProximity.toFixed(1)}% of 52-Week Low</div>
        )}
      </div>

      {/* ─── Create Alert Toggle ───────────────────── */}
      <button
        onClick={() => setShowForm(!showForm)}
        className={css.createToggle}
        style={{
          border: `1px solid ${showForm ? C.b + '30' : C.bd}`,
          background: showForm ? `${C.b}08` : 'transparent',
          color: showForm ? C.b : C.t2,
          marginBottom: showForm ? 0 : 12,
        }}
      >
        {showForm ? '✕ Close' : '+ Create Price Alert'}
      </button>

      {/* ─── Alert Creation Form ───────────────────── */}
      {showForm && (
        <div className={css.alertForm} style={{ background: C.sf, border: `1px solid ${C.bd}` }}>
          <div className={css.formRow}>
            <input
              aria-label="Alert symbol"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              placeholder="SYM"
              style={{ ...inputStyle, width: 64, fontWeight: 700, textAlign: 'center' }}
            />
            <select
              aria-label="Alert condition"
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              style={{ ...inputStyle, flex: 1, cursor: 'pointer', appearance: 'none' }}
            >
              {CONDITIONS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Price"
              type="number"
              step="any"
              style={{ ...inputStyle, width: 90, textAlign: 'right' }}
            />
          </div>
          <div className={css.formRowCenter}>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Note (optional)"
              style={{ ...inputStyle, flex: 1, fontSize: 11 }}
            />
            <label className={css.repeatLabel}>
              <input
                type="checkbox"
                checked={repeating}
                onChange={(e) => setRepeating(e.target.checked)}
                style={{ width: 12, height: 12, accentColor: C.b }}
              />
              Repeat
            </label>
            <button
              className={`tf-btn ${css.addBtn}`}
              onClick={handleAdd}
              disabled={!symbol.trim() || !price || isNaN(parseFloat(price))}
              style={{
                background: C.b,
                opacity: !symbol.trim() || !price ? 0.4 : 1,
              }}
            >
              + Add
            </button>
          </div>
        </div>
      )}

      {/* ─── Active Alerts ─────────────────────────── */}
      {activeAlerts.length > 0 && (
        <div className={css.alertSectionWrap}>
          <div className={css.sectionHeading}>Active ({activeAlerts.length})</div>
          <div className={css.colGapSm}>
            {activeAlerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} onToggle={toggleAlert} onRemove={removeAlert} />
            ))}
          </div>
        </div>
      )}

      {/* ─── Triggered Alerts ──────────────────────── */}
      {triggeredAlerts.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div className={css.triggeredHeader}>
            <span className={css.sectionHeading} style={{ marginBottom: 0 }}>
              Triggered ({triggeredAlerts.length})
            </span>
            <button className={`tf-btn ${css.clearTriggeredBtn}`} onClick={clearTriggered}>
              Clear all
            </button>
          </div>
          <div className={css.colGapSm}>
            {triggeredAlerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} onToggle={toggleAlert} onRemove={removeAlert} triggered />
            ))}
          </div>
        </div>
      )}

      {/* ─── Empty State ──────────────────────────── */}
      {alerts.length === 0 && (
        <div className={css.alertEmptyState}>
          <div className={css.alertEmptyIcon}>🔔</div>
          <div className={css.alertEmptyTitle}>No alerts yet</div>
          <div className={css.alertEmptyDesc}>Use quick presets above or create a custom alert to get started.</div>
        </div>
      )}
    </div>
  );
}

// ─── Alert Card (unified styling) ─────────────────────────────────
// Uses the same card design language as NotificationEntry for visual consistency.

function AlertCard({ alert, onToggle, onRemove, triggered = false }) {
  const [hovered, setHovered] = useState(false);

  const condIcons = {
    above: '↑',
    below: '↓',
    cross_above: '↗',
    cross_below: '↘',
    '52w_high': '🌟',
    '52w_low': '⚠️',
    percent_above: '📈',
    percent_below: '📉',
  };

  const severityColor = triggered ? C.g : C.b;
  const iconChar = condIcons[alert.condition] || '🔔';

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={css.alertCard}
      style={{
        background: hovered ? `${C.b}06` : C.sf,
        border: `1px solid ${C.bd}20`,
        opacity: triggered ? 0.7 : 1,
      }}
    >
      <div className={css.alertIcon} style={{ background: severityColor + '12', color: severityColor }}>
        {iconChar}
      </div>

      <div className={css.flex1}>
        <div className={css.symbolRow}>
          <span className={css.symbol}>{alert.symbol}</span>
          <span className={css.condLabel}>
            {condIcons[alert.condition] || ''} {alert.condition.replace('_', ' ')}
          </span>
        </div>
        <div className={css.detailRow}>
          {alert.price > 0 && (
            <span className={css.priceVal} style={{ color: C.b }}>
              ${alert.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          )}
          {alert.repeating && (
            <span className={css.repeatBadge} style={{ background: C.bd + '40' }}>
              REPEAT
            </span>
          )}
          {alert.note && <span className={css.noteText}>{alert.note}</span>}
        </div>
        <div className={css.metaRow}>
          <span className={css.catPill} style={{ background: severityColor + '10', color: severityColor }}>
            {alert.alertCategory === '52w_range'
              ? '🌟 52W Range'
              : alert.alertCategory === 'percent_change'
                ? '📊 % Change'
                : '💰 Price'}
          </span>
          <span className={css.dot}>·</span>
          <span>
            {triggered
              ? `Triggered ${formatAlertTime(alert.triggeredAt)}`
              : `Created ${formatAlertTime(alert.createdAt)}`}
          </span>
        </div>
      </div>

      <div className={css.alertActions} style={{ opacity: hovered ? 1 : 0.5 }}>
        <button
          className={`tf-btn ${css.alertActionBtn}`}
          onClick={() => onToggle(alert.id)}
          title={alert.active ? 'Pause' : 'Re-arm'}
          style={{ color: alert.active ? C.t2 : C.g, fontSize: 12 }}
        >
          {alert.active ? '⏸' : '▶'}
        </button>
        <button
          className={`tf-btn ${css.alertActionBtn}`}
          onClick={() => onRemove(alert.id)}
          title="Delete"
          style={{ color: C.r + '80', fontSize: 11 }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ─── Time Group ───────────────────────────────────────────────────

function TimeGroup({ label, entries, onDismiss }) {
  return (
    <div>
      {label && <div className={css.timeGroupLabel}>{label}</div>}
      {entries.map((entry) => (
        <NotificationEntry key={entry.id} entry={entry} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

// ─── Individual Notification Entry ────────────────────────────────

function NotificationEntry({ entry, onDismiss }) {
  const [hovered, setHovered] = useState(false);
  const style = TYPE_STYLES[entry.type] || TYPE_STYLES.info;
  const catLabel = CATEGORY_LABELS[entry.category] || entry.category;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={css.entryWrap}
      style={{
        borderBottom: `1px solid ${C.bd}15`,
        background: hovered ? `${C.b}06` : 'transparent',
      }}
    >
      <div className={css.entryIcon} style={{ background: style.color + '12', color: style.color }}>
        {style.icon}
      </div>

      <div className={css.flex1}>
        <div className={css.entryMessage}>{entry.message}</div>
        <div className={css.entryMeta}>
          <span className={css.catPill} style={{ background: style.color + '10', color: style.color }}>
            {catLabel}
          </span>
          <span className={css.dot}>·</span>
          <span>{timeAgo(entry.ts)}</span>
        </div>
      </div>

      {hovered && (
        <button
          className={`tf-btn ${css.dismissBtn}`}
          onClick={(e) => {
            e.stopPropagation();
            onDismiss(entry.id);
          }}
          style={{ background: C.sf, border: `1px solid ${C.bd}30` }}
        >
          ✕
        </button>
      )}
    </div>
  );
}

// ─── Notification Bell (for Sidebar) ──────────────────────────────

export function NotificationBell() {
  const unreadCount = useNotificationStore((s) => s.logUnreadCount);
  const toggle = useNotificationStore((s) => s.toggleLogPanel);

  return (
    <button className={`tf-btn ${css.bellBtn}`} onClick={toggle} title="Notifications (Ctrl+.)">
      🔔
      {unreadCount > 0 && (
        <span className={css.bellBadge} style={{ background: C.r }}>
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  );
}

export { NotificationPanel };

export default React.memo(NotificationPanel);
