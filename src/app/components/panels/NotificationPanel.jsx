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
import { C, F, M } from '../../../constants.js';
import { radii } from '../../../theme/tokens.js';
import { useNotificationLog } from '../../../state/useNotificationLog.js';
import { useAlertStore } from '../../../state/useAlertStore';
import { playAlertSound } from '../../../app/misc/alertSounds';
import { usePriceTracker } from '../../../state/usePriceTracker';
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
  const entries = useNotificationLog((s) => s.entries);
  const panelOpen = useNotificationLog((s) => s.panelOpen);
  const closePanel = useNotificationLog((s) => s.closePanel);
  const clearLog = useNotificationLog((s) => s.clear);
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
      <div
        onClick={closePanel}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,.35)',
          zIndex: 8000,
          backdropFilter: 'blur(2px)',
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: 400,
          maxWidth: '92vw',
          height: '100vh',
          background: C.bg2 || C.sf,
          borderLeft: `1px solid ${C.bd}`,
          zIndex: 8001,
          display: 'flex',
          flexDirection: 'column',
          animation: 'scaleInSm 0.2s ease-out',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 16px 0',
            borderBottom: `1px solid ${C.bd}`,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 800, fontFamily: F, color: C.t1 }}>Notifications</span>
              {entries.length > 0 && (
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: M,
                    color: '#fff',
                    background: C.b,
                    padding: '2px 7px',
                    borderRadius: 10,
                    fontWeight: 600,
                  }}
                >
                  {entries.length}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {entries.length > 0 && (
                <button
                  className="tf-btn"
                  onClick={clearLog}
                  style={{
                    background: 'none',
                    border: `1px solid ${C.bd}`,
                    borderRadius: radii.sm,
                    color: C.t3,
                    fontSize: 10,
                    fontFamily: M,
                    cursor: 'pointer',
                    padding: '3px 8px',
                    transition: 'all 0.15s',
                  }}
                >
                  Clear All
                </button>
              )}
              <button
                className="tf-btn"
                onClick={closePanel}
                style={{
                  background: 'none',
                  border: 'none',
                  color: C.t3,
                  fontSize: 18,
                  cursor: 'pointer',
                  padding: '0 2px',
                }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Tab Bar */}
          <div style={{ display: 'flex', gap: 0 }}>
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  className="tf-btn"
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    flex: 1,
                    padding: '8px 0',
                    border: 'none',
                    background: 'none',
                    color: isActive ? C.b : C.t3,
                    fontSize: 11,
                    fontWeight: isActive ? 700 : 500,
                    fontFamily: F,
                    cursor: 'pointer',
                    borderBottom: isActive ? `2px solid ${C.b}` : '2px solid transparent',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Area */}
        <div
          ref={panelRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '4px 0',
          }}
        >
          {/* Alerts Tab: Show alert management ABOVE the notification feed */}
          {activeTab === 'alerts' && <AlertManagementSection />}

          {/* Notification Feed */}
          {totalFiltered === 0 && activeTab !== 'alerts' ? (
            <div
              style={{
                padding: '48px 16px',
                textAlign: 'center',
                color: C.t3,
                fontSize: 12,
                fontFamily: F,
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 10, opacity: 0.4 }}>🔔</div>
              <div style={{ fontWeight: 600, color: C.t2, marginBottom: 4 }}>
                {activeTab === 'all' ? 'No notifications yet' : `No ${activeTab} notifications`}
              </div>
              <div style={{ fontSize: 11, lineHeight: 1.5 }}>
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
                    <div style={{
                      padding: '10px 16px 4px',
                      fontSize: 9,
                      fontWeight: 700,
                      color: C.t3,
                      textTransform: 'uppercase',
                      fontFamily: M,
                      letterSpacing: '0.5px',
                      borderTop: `1px solid ${C.bd}20`,
                    }}>
                      Alert History
                    </div>
                  )}
                  {Object.entries(grouped).map(([label, items]) => (
                    <TimeGroup key={label} label={activeTab === 'alerts' ? null : label} entries={items} onDismiss={handleDismiss} />
                  ))}
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '10px 16px',
            borderTop: `1px solid ${C.bd}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <button
            className="tf-btn"
            onClick={() => {
              closePanel();
              // Navigate to Settings > Notifications
              window.dispatchEvent(new CustomEvent('charEdge:navigate', { detail: { page: 'settings', section: 'notifications' } }));
            }}
            style={{
              background: 'none',
              border: 'none',
              color: C.b,
              fontSize: 11,
              fontFamily: F,
              fontWeight: 500,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            ⚙ Notification Settings
          </button>
          <span style={{ fontSize: 10, color: C.t3, fontFamily: M }}>
            Ctrl+. to toggle
          </span>
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
    return ((stat.lastPrice - stat.high52w) / stat.high52w * 100);
  });
  const lowProximity = usePriceTracker((s) => {
    const stat = s.stats[symbol.toUpperCase()];
    if (!stat || stat.low52w === 0) return null;
    return ((stat.lastPrice - stat.low52w) / stat.low52w * 100);
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

  const handlePresetClick = useCallback((presetId) => {
    if (!symbol.trim()) return;
    addMarketAlert({ symbol: symbol.trim().toUpperCase(), preset: presetId });
  }, [symbol, addMarketAlert]);

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
    <div style={{ padding: '12px 16px 0' }}>

      {/* ─── Quick Presets ─────────────────────────── */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: M }}>
              ⚡ Quick Alerts
            </span>
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
            <span style={{
              fontSize: 9, fontFamily: M, padding: '2px 8px', borderRadius: radii.sm,
              background: '#10b98115',
              color: '#10b981',
              fontWeight: 600,
            }}>
              🌟 {Math.abs(highProximity).toFixed(1)}% from 52W High
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handlePresetClick(preset.id)}
              style={{
                flex: '1 1 calc(33% - 4px)',
                padding: '6px 8px',
                fontSize: 10,
                fontWeight: 600,
                fontFamily: F,
                cursor: 'pointer',
                border: `1px solid ${preset.color}25`,
                borderRadius: radii.sm,
                background: `${preset.color}08`,
                color: preset.color,
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = `${preset.color}20`; e.currentTarget.style.borderColor = `${preset.color}50`; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = `${preset.color}08`; e.currentTarget.style.borderColor = `${preset.color}25`; }}
            >
              {preset.label}
            </button>
          ))}
        </div>
        {lowProximity != null && Math.abs(lowProximity) < 5 && (
          <div style={{ marginTop: 6, fontSize: 9, color: '#ef4444', fontFamily: M, fontWeight: 500 }}>
            ⚠️ Within {lowProximity.toFixed(1)}% of 52-Week Low
          </div>
        )}
      </div>

      {/* ─── Create Alert Toggle ───────────────────── */}
      <button
        onClick={() => setShowForm(!showForm)}
        style={{
          width: '100%',
          padding: '8px 0',
          border: `1px solid ${showForm ? C.b + '30' : C.bd}`,
          borderRadius: radii.sm,
          background: showForm ? `${C.b}08` : 'transparent',
          color: showForm ? C.b : C.t2,
          fontSize: 11,
          fontWeight: 600,
          fontFamily: F,
          cursor: 'pointer',
          marginBottom: showForm ? 0 : 12,
          transition: 'all 0.2s ease',
        }}
      >
        {showForm ? '✕ Close' : '+ Create Price Alert'}
      </button>

      {/* ─── Alert Creation Form ───────────────────── */}
      {showForm && (
        <div style={{
          padding: 12,
          background: C.sf,
          borderRadius: `0 0 ${radii.sm}px ${radii.sm}px`,
          border: `1px solid ${C.bd}`,
          borderTop: 'none',
          marginBottom: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          <div style={{ display: 'flex', gap: 6 }}>
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
                <option key={c.id} value={c.id}>{c.label}</option>
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
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Note (optional)"
              style={{ ...inputStyle, flex: 1, fontSize: 11 }}
            />
            <label style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 10, color: C.t3, cursor: 'pointer', whiteSpace: 'nowrap',
            }}>
              <input
                type="checkbox"
                checked={repeating}
                onChange={(e) => setRepeating(e.target.checked)}
                style={{ width: 12, height: 12, accentColor: C.b }}
              />
              Repeat
            </label>
            <button
              className="tf-btn"
              onClick={handleAdd}
              disabled={!symbol.trim() || !price || isNaN(parseFloat(price))}
              style={{
                background: C.b,
                color: '#fff',
                border: 'none',
                borderRadius: radii.sm,
                padding: '6px 14px',
                fontSize: 11,
                fontWeight: 600,
                fontFamily: F,
                cursor: 'pointer',
                opacity: !symbol.trim() || !price ? 0.4 : 1,
                transition: 'opacity 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              + Add
            </button>
          </div>
        </div>
      )}

      {/* ─── Active Alerts ─────────────────────────── */}
      {activeAlerts.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{
            fontSize: 9, fontWeight: 700, color: C.t3, textTransform: 'uppercase',
            fontFamily: M, letterSpacing: '0.5px', marginBottom: 6,
          }}>
            Active ({activeAlerts.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {activeAlerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} onToggle={toggleAlert} onRemove={removeAlert} />
            ))}
          </div>
        </div>
      )}

      {/* ─── Triggered Alerts ──────────────────────── */}
      {triggeredAlerts.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6,
          }}>
            <span style={{
              fontSize: 9, fontWeight: 700, color: C.t3, textTransform: 'uppercase',
              fontFamily: M, letterSpacing: '0.5px',
            }}>
              Triggered ({triggeredAlerts.length})
            </span>
            <button
              className="tf-btn"
              onClick={clearTriggered}
              style={{
                background: 'none', border: 'none', color: C.t3,
                fontSize: 10, cursor: 'pointer', padding: '2px 4px',
                fontFamily: M,
              }}
            >
              Clear all
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {triggeredAlerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} onToggle={toggleAlert} onRemove={removeAlert} triggered />
            ))}
          </div>
        </div>
      )}

      {/* ─── Empty State ──────────────────────────── */}
      {alerts.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '20px 12px', color: C.t3, fontSize: 12, fontFamily: F,
        }}>
          <div style={{ fontSize: 24, marginBottom: 6, opacity: 0.4 }}>🔔</div>
          <div style={{ fontWeight: 600, color: C.t2, marginBottom: 4 }}>No alerts yet</div>
          <div style={{ fontSize: 11, lineHeight: 1.5 }}>
            Use quick presets above or create a custom alert to get started.
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Alert Card (unified styling) ─────────────────────────────────
// Uses the same card design language as NotificationEntry for visual consistency.

function AlertCard({ alert, onToggle, onRemove, triggered = false }) {
  const [hovered, setHovered] = useState(false);

  const condIcons = { above: '↑', below: '↓', cross_above: '↗', cross_below: '↘',
    '52w_high': '🌟', '52w_low': '⚠️', percent_above: '📈', percent_below: '📉' };

  const severityColor = triggered ? C.g : C.b;
  const iconChar = condIcons[alert.condition] || '🔔';

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        gap: 10,
        padding: '10px 12px',
        background: hovered ? `${C.b}06` : C.sf,
        borderRadius: radii.sm,
        border: `1px solid ${C.bd}20`,
        transition: 'background 0.15s ease',
        position: 'relative',
        opacity: triggered ? 0.7 : 1,
      }}
    >
      {/* Icon — same rounded badge as notification entries */}
      <div style={{
        width: 28,
        height: 28,
        borderRadius: 8,
        background: severityColor + '12',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 13,
        color: severityColor,
        flexShrink: 0,
        marginTop: 1,
      }}>
        {iconChar}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontFamily: M, fontWeight: 700, fontSize: 12, color: C.t1 }}>{alert.symbol}</span>
          <span style={{ fontSize: 10, color: C.t3, fontFamily: F }}>
            {condIcons[alert.condition] || ''} {alert.condition.replace('_', ' ')}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          {alert.price > 0 && (
            <span style={{ fontFamily: M, fontWeight: 600, fontSize: 12, color: C.b }}>
              ${alert.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          )}
          {alert.repeating && (
            <span style={{
              fontSize: 8, color: C.t3, background: C.bd + '40',
              padding: '1px 5px', borderRadius: 3, fontFamily: M, fontWeight: 600,
            }}>
              REPEAT
            </span>
          )}
          {alert.note && (
            <span style={{
              fontSize: 9, color: C.t3, overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: F,
            }}>
              {alert.note}
            </span>
          )}
        </div>
        {/* Category pill + time — matching notification entry style */}
        <div style={{
          display: 'flex', gap: 6, marginTop: 4, fontSize: 10,
          color: C.t3, fontFamily: M, alignItems: 'center',
        }}>
          <span style={{
            background: severityColor + '10',
            color: severityColor,
            padding: '1px 6px',
            borderRadius: 4,
            fontSize: 9,
            fontWeight: 600,
          }}>
            {alert.alertCategory === '52w_range' ? '🌟 52W Range'
              : alert.alertCategory === 'percent_change' ? '📊 % Change'
                : '💰 Price'}
          </span>
          <span style={{ opacity: 0.7 }}>·</span>
          <span>{triggered ? `Triggered ${formatAlertTime(alert.triggeredAt)}` : `Created ${formatAlertTime(alert.createdAt)}`}</span>
        </div>
      </div>

      {/* Actions */}
      <div style={{
        display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center',
        opacity: hovered ? 1 : 0.5,
        transition: 'opacity 0.15s',
      }}>
        <button
          className="tf-btn"
          onClick={() => onToggle(alert.id)}
          title={alert.active ? 'Pause' : 'Re-arm'}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: alert.active ? C.t2 : C.g, fontSize: 12, padding: '2px 4px',
          }}
        >{alert.active ? '⏸' : '▶'}</button>
        <button
          className="tf-btn"
          onClick={() => onRemove(alert.id)}
          title="Delete"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: C.r + '80', fontSize: 11, padding: '2px 4px',
          }}
        >✕</button>
      </div>
    </div>
  );
}

// ─── Time Group ───────────────────────────────────────────────────

function TimeGroup({ label, entries, onDismiss }) {
  return (
    <div>
      {label && (
        <div
          style={{
            padding: '10px 16px 4px',
            fontSize: 9,
            fontWeight: 700,
            color: C.t3,
            textTransform: 'uppercase',
            fontFamily: M,
            letterSpacing: '0.5px',
          }}
        >
          {label}
        </div>
      )}
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
      style={{
        display: 'flex',
        gap: 10,
        padding: '10px 16px',
        borderBottom: `1px solid ${C.bd}15`,
        background: hovered ? `${C.b}06` : 'transparent',
        transition: 'background 0.15s ease',
        position: 'relative',
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          background: style.color + '12',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          color: style.color,
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        {style.icon}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            color: C.t1,
            fontFamily: F,
            lineHeight: 1.45,
            wordBreak: 'break-word',
          }}
        >
          {entry.message}
        </div>
        <div
          style={{
            display: 'flex',
            gap: 6,
            marginTop: 4,
            fontSize: 10,
            color: C.t3,
            fontFamily: M,
            alignItems: 'center',
          }}
        >
          <span
            style={{
              background: style.color + '10',
              color: style.color,
              padding: '1px 6px',
              borderRadius: 4,
              fontSize: 9,
              fontWeight: 600,
            }}
          >
            {catLabel}
          </span>
          <span style={{ opacity: 0.7 }}>·</span>
          <span>{timeAgo(entry.ts)}</span>
        </div>
      </div>

      {/* Dismiss button (appears on hover) */}
      {hovered && (
        <button
          className="tf-btn"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss(entry.id);
          }}
          style={{
            position: 'absolute',
            top: 8,
            right: 12,
            background: C.sf,
            border: `1px solid ${C.bd}30`,
            borderRadius: radii.sm,
            color: C.t3,
            fontSize: 10,
            cursor: 'pointer',
            padding: '2px 6px',
            fontFamily: M,
            transition: 'all 0.1s',
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
}

// ─── Notification Bell (for Sidebar) ──────────────────────────────

export function NotificationBell() {
  const unreadCount = useNotificationLog((s) => s.unreadCount);
  const toggle = useNotificationLog((s) => s.togglePanel);

  return (
    <button
      className="tf-btn"
      onClick={toggle}
      title="Notifications (Ctrl+.)"
      style={{
        position: 'relative',
        background: 'none',
        border: 'none',
        color: C.t3,
        fontSize: 16,
        cursor: 'pointer',
        padding: 4,
        borderRadius: 6,
        transition: 'color 0.15s',
      }}
    >
      🔔
      {unreadCount > 0 && (
        <span
          style={{
            position: 'absolute',
            top: -2,
            right: -4,
            minWidth: 16,
            height: 16,
            borderRadius: '50%',
            background: C.r,
            color: '#fff',
            fontSize: 9,
            fontWeight: 700,
            fontFamily: M,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
            padding: '0 3px',
          }}
        >
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  );
}

export { NotificationPanel };

export default React.memo(NotificationPanel);
