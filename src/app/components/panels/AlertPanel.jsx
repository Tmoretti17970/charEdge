// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — Alert Panel
//
// Compact sidebar/overlay panel for managing price alerts.
// Inline form: symbol input + condition select + price input + add button.
// Shows active and triggered alerts with toggle/delete controls.
//
// Usage:
//   <AlertPanel /> — shows in sidebar/overlay
//   <AlertPanel compact /> — minimal mode for workspace panels
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useState, useCallback, useMemo } from 'react';
import { C, F, M } from '../../../constants.js';
import { useAlertStore } from '../../../state/useAlertStore';
import { playAlertSound } from '../../../app/misc/alertSounds';
import { useNotificationPreferences } from '../../../state/useNotificationStore';
import CompoundAlertBuilder from './CompoundAlertBuilder.jsx';
import { usePriceTracker } from '../../../state/usePriceTracker';

const AlertHistoryPanel = React.lazy(() => import('./AlertHistoryPanel.jsx'));
const AlertAnalytics = React.lazy(() => import('./AlertAnalytics.jsx'));

const CONDITIONS = [
  { id: 'above', label: '↑ Above', desc: 'Price goes above target' },
  { id: 'below', label: '↓ Below', desc: 'Price drops below target' },
  { id: 'cross_above', label: '↗ Cross Above', desc: 'Price crosses above target' },
  { id: 'cross_below', label: '↘ Cross Below', desc: 'Price crosses below target' },
];

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  if (diffMs < 60_000) return 'just now';
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function AlertPanel({ compact = false, currentSymbol = '' }) {
  const alerts = useAlertStore((s) => s.alerts);
  const addAlert = useAlertStore((s) => s.addAlert);
  const removeAlert = useAlertStore((s) => s.removeAlert);
  const toggleAlert = useAlertStore((s) => s.toggleAlert);

  // E3: Tab sub-navigation
  const [activeTab, setActiveTab] = useState('manage');
  const clearTriggered = useAlertStore((s) => s.clearTriggered);

  const [symbol, setSymbol] = useState(currentSymbol.toUpperCase());
  const [condition, setCondition] = useState('above');
  const [price, setPrice] = useState('');
  const [note, setNote] = useState('');
  const [repeating, setRepeating] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [cooldownMs, setCooldownMs] = useState(0);
  const [soundType, setSoundType] = useState('');

  const activeAlerts = useMemo(() => alerts.filter((a) => a.active), [alerts]);
  const triggeredAlerts = useMemo(() => alerts.filter((a) => !a.active && a.triggeredAt), [alerts]);

  const handleAdd = useCallback(() => {
    const p = parseFloat(price);
    if (!symbol.trim() || isNaN(p) || p <= 0) return;

    addAlert({
      symbol: symbol.trim().toUpperCase(),
      condition,
      price: p,
      note,
      repeating,
      expiresAt: expiresAt || null,
      cooldownMs: cooldownMs || null,
      soundType: soundType || null,
    });

    setPrice('');
    setNote('');
    setExpiresAt('');
    setCooldownMs(0);
    setSoundType('');
  }, [symbol, condition, price, note, repeating, expiresAt, cooldownMs, soundType, addAlert]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleAdd();
  };

  const inputStyle = {
    background: C.sf,
    border: `1px solid ${C.bd}`,
    color: C.t1,
    borderRadius: 4,
    padding: '4px 8px',
    fontFamily: M,
    fontSize: 12,
    outline: 'none',
  };

  // ─── Coinbase-Style Presets ──────────────────────────────────
  const PRESETS = [
    { id: '52w_high', label: '📈 52W High', desc: 'Alert at 52-week high', color: '#10b981' },
    { id: '52w_low', label: '📉 52W Low', desc: 'Alert at 52-week low', color: '#ef4444' },
    { id: 'percent_5_up', label: '📊 +5%', desc: 'Price rises 5% in 24h', color: '#3b82f6' },
    { id: 'percent_5_down', label: '📊 -5%', desc: 'Price drops 5% in 24h', color: '#f59e0b' },
    { id: 'percent_10_up', label: '🚀 +10%', desc: 'Price rises 10% in 24h', color: '#8b5cf6' },
    { id: 'percent_10_down', label: '💥 -10%', desc: 'Price drops 10% in 24h', color: '#ec4899' },
  ];

  const addMarketAlert = useAlertStore((s) => s.addMarketAlert);
  const alertFrequency = useNotificationPreferences((s) => s.alertFrequency);
  const watchlistAutoAlerts = useNotificationPreferences((s) => s.watchlistAutoAlerts);

  const handlePresetClick = useCallback((presetId) => {
    if (!symbol.trim()) return;
    addMarketAlert({ symbol: symbol.trim().toUpperCase(), preset: presetId });
  }, [symbol, addMarketAlert]);

  // 52w proximity data for current symbol
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

  return (
    <div
      style={{
        height: '100%',
        overflow: 'auto',
        padding: compact ? 8 : 12,
        fontFamily: F,
        background: C.bg,
        color: C.t2,
      }}
    >
      {/* ─── Header ───────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 10,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: C.t1 }}>🔔 Price Alerts</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => useNotificationPreferences.getState().toggleMute()}
            title={useNotificationPreferences.getState().globalMute ? 'Unmute alerts' : 'Mute all alerts'}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 12,
              padding: '2px 4px',
              opacity: useNotificationPreferences.getState().globalMute ? 1 : 0.4,
              transition: 'opacity 0.15s',
            }}
          >{useNotificationPreferences.getState().globalMute ? '🔇' : '🔊'}</button>
          <span style={{ fontSize: 10, color: C.t3, fontFamily: M }}>{activeAlerts.length} active</span>
        </div>
      </div>

      {/* E3: Tab bar */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 10, borderRadius: 6, overflow: 'hidden', border: `1px solid ${C.bd}` }}>
        {[{ id: 'manage', label: '🔔 Manage' }, { id: 'history', label: '📜 History' }, { id: 'analytics', label: '📈 Analytics' }].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              padding: '5px 0',
              fontSize: 10,
              fontWeight: 600,
              fontFamily: F,
              cursor: 'pointer',
              border: 'none',
              background: activeTab === tab.id ? C.b + '20' : 'transparent',
              color: activeTab === tab.id ? C.b : C.t3,
              borderBottom: activeTab === tab.id ? `2px solid ${C.b}` : '2px solid transparent',
              transition: 'all 0.15s',
            }}
          >{tab.label}</button>
        ))}
      </div>

      {/* E3: History tab */}
      {activeTab === 'history' && (
        <React.Suspense fallback={<div style={{ padding: 12, color: C.t3, fontSize: 11 }}>Loading...</div>}>
          <AlertHistoryPanel />
        </React.Suspense>
      )}

      {/* E3: Analytics tab */}
      {activeTab === 'analytics' && (
        <React.Suspense fallback={<div style={{ padding: 12, color: C.t3, fontSize: 11 }}>Loading...</div>}>
          <AlertAnalytics />
        </React.Suspense>
      )}

      {/* Manage tab — existing form + alert list */}
      {activeTab === 'manage' && (<>

      {/* ─── Coinbase-Style Quick Presets ──────────────── */}
      {symbol.trim() && (
        <div
          style={{
            marginBottom: 10,
            padding: 8,
            background: C.sf,
            borderRadius: 8,
            border: `1px solid ${C.bd}`,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              ⚡ Quick Alerts for {symbol.toUpperCase()}
            </span>
            {highProximity != null && (
              <span style={{
                fontSize: 9, fontFamily: M, padding: '1px 6px', borderRadius: 4,
                background: Math.abs(highProximity) < 3 ? '#10b98120' : 'transparent',
                color: Math.abs(highProximity) < 3 ? '#10b981' : C.t3,
              }}>
                {Math.abs(highProximity) < 3 ? `🌟 ${Math.abs(highProximity).toFixed(1)}% from 52W High` : ''}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handlePresetClick(preset.id)}
                title={preset.desc}
                style={{
                  flex: '1 1 calc(33% - 4px)',
                  padding: '5px 6px',
                  fontSize: 9,
                  fontWeight: 700,
                  fontFamily: F,
                  cursor: 'pointer',
                  border: `1px solid ${preset.color}30`,
                  borderRadius: 6,
                  background: `${preset.color}10`,
                  color: preset.color,
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = `${preset.color}25`; e.currentTarget.style.borderColor = `${preset.color}60`; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = `${preset.color}10`; e.currentTarget.style.borderColor = `${preset.color}30`; }}
              >
                {preset.label}
              </button>
            ))}
          </div>
          {lowProximity != null && Math.abs(lowProximity) < 5 && (
            <div style={{ marginTop: 4, fontSize: 9, color: '#ef4444', fontFamily: M }}>
              ⚠️ Within {lowProximity.toFixed(1)}% of 52-Week Low
            </div>
          )}
        </div>
      )}

      {/* ─── Add Alert Form ───────────────────────────── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          padding: 8,
          background: C.sf,
          borderRadius: 8,
          border: `1px solid ${C.bd}`,
          marginBottom: 12,
        }}
      >
        <div style={{ display: 'flex', gap: 4 }}>
          <input
            aria-label="Alert parameter"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            onKeyDown={handleKeyDown}
            placeholder="SYM"
            style={{ ...inputStyle, width: 60, fontWeight: 700, textAlign: 'center' }}
          />
          <select
            aria-label="Alert condition"
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            style={{
              ...inputStyle,
              flex: 1,
              cursor: 'pointer',
              appearance: 'none',
              paddingRight: 4,
            }}
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
            style={{ ...inputStyle, width: 80, textAlign: 'right' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Note (optional)"
            style={{ ...inputStyle, flex: 1, fontSize: 11 }}
          />
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              fontSize: 10,
              color: C.t3,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <input
              type="checkbox"
              checked={repeating}
              onChange={(e) => setRepeating(e.target.checked)}
              style={{ width: 12, height: 12 }}
            />
            Repeat
          </label>
          {/* C4: Sound type selector + preview */}
          <select
            value={soundType}
            onChange={(e) => setSoundType(e.target.value)}
            style={{ ...inputStyle, width: 58, cursor: 'pointer', appearance: 'none', fontSize: 10 }}
            title="Alert sound"
          >
            <option value="">🔔 Auto</option>
            <option value="price">🔔 Price</option>
            <option value="urgent">🚨 Urgent</option>
            <option value="info">ℹ️ Info</option>
            <option value="success">✅ Win</option>
            <option value="error">❌ Err</option>
          </select>
          <button
            className="tf-btn"
            onClick={() => { try { playAlertSound(soundType || 'price'); } catch {} }}
            title="Preview sound"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: C.t3, padding: '2px 2px' }}
          >▶</button>
          <button
            className="tf-btn"
            onClick={handleAdd}
            disabled={!symbol.trim() || !price || isNaN(parseFloat(price))}
            style={{
              background: C.b,
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              padding: '4px 12px',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              opacity: !symbol.trim() || !price ? 0.4 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            + Add
          </button>
        </div>
      </div>

      {/* ─── Advanced Toggle ──────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          style={{
            background: 'none',
            border: `1px solid ${C.bd}`,
            borderRadius: 4,
            color: showAdvanced ? C.b : C.t3,
            fontSize: 10,
            fontWeight: 600,
            padding: '3px 10px',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          {showAdvanced ? '✕ Simple' : '⚙ Advanced'}
        </button>
      </div>

      {/* ─── Compound Alert Builder (B1) ──────────────── */}
      {showAdvanced && (
        <CompoundAlertBuilder symbol={symbol || currentSymbol} onClose={() => setShowAdvanced(false)} />
      )}

      {/* ─── Active Alerts ────────────────────────────── */}
      {activeAlerts.length > 0 && (
        <>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: C.t3,
              textTransform: 'uppercase',
              marginBottom: 6,
              letterSpacing: '0.04em',
            }}
          >
            Active ({activeAlerts.length})
          </div>
          {activeAlerts.map((alert) => (
            <AlertRow key={alert.id} alert={alert} onToggle={toggleAlert} onRemove={removeAlert} />
          ))}
        </>
      )}

      {/* ─── Triggered Alerts ─────────────────────────── */}
      {triggeredAlerts.length > 0 && (
        <>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: activeAlerts.length > 0 ? 12 : 0,
              marginBottom: 6,
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: C.t3,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Triggered ({triggeredAlerts.length})
            </span>
            <button
              className="tf-btn"
              onClick={clearTriggered}
              style={{
                background: 'none',
                border: 'none',
                color: C.t3,
                fontSize: 10,
                cursor: 'pointer',
                padding: '2px 4px',
              }}
            >
              Clear all
            </button>
          </div>
          {triggeredAlerts.map((alert) => (
            <AlertRow key={alert.id} alert={alert} onToggle={toggleAlert} onRemove={removeAlert} triggered />
          ))}
        </>
      )}

      {/* ─── Empty State ──────────────────────────────── */}
      {alerts.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '24px 12px',
            color: C.t3,
            fontSize: 12,
          }}
        >
          <div style={{ fontSize: 24, marginBottom: 8 }}>🔔</div>
          <div>No alerts yet</div>
          <div style={{ fontSize: 10, marginTop: 4, lineHeight: 1.5 }}>
            Get notified when a symbol hits your target price. Set an alert above to get started.
          </div>
        </div>
      )}
      {/* E6: DND Preferences Section */}
      <details style={{ marginTop: 12, borderRadius: 6, border: `1px solid ${C.bd}`, background: C.sf }}>
        <summary style={{
          padding: '6px 10px', fontSize: 11, fontWeight: 600, color: C.t2, cursor: 'pointer',
          listStyle: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>⚙ Alert Preferences</span>
          <span style={{ fontSize: 9, color: C.t3 }}>
            {useNotificationPreferences.getState().dndEnabled ? '🌙 DND On' : ''}
            {watchlistAutoAlerts ? ' · 🔔 Auto' : ''}
          </span>
        </summary>
        <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 10 }}>

          {/* Alert Frequency */}
          <div>
            <label style={{ color: C.t3, display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              📬 Alert Frequency
            </label>
            <div style={{ display: 'flex', gap: 0, borderRadius: 4, overflow: 'hidden', border: `1px solid ${C.bd}` }}>
              {[{ id: 'instant', label: '⚡ Instant' }, { id: 'hourly_digest', label: '📋 Hourly' }, { id: 'daily_digest', label: '📰 Daily' }].map((freq) => (
                <button
                  key={freq.id}
                  onClick={() => useNotificationPreferences.getState().setFrequency(freq.id)}
                  style={{
                    flex: 1, padding: '4px 0', fontSize: 9, fontWeight: 600,
                    border: 'none', cursor: 'pointer', fontFamily: F,
                    background: alertFrequency === freq.id ? C.b + '20' : 'transparent',
                    color: alertFrequency === freq.id ? C.b : C.t3,
                    borderBottom: alertFrequency === freq.id ? `2px solid ${C.b}` : '2px solid transparent',
                    transition: 'all 0.15s',
                  }}
                >{freq.label}</button>
              ))}
            </div>
          </div>

          {/* Watchlist Auto-Alerts */}
          <div>
            <label style={{ color: C.t3, display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="checkbox"
                checked={watchlistAutoAlerts}
                onChange={(e) => useNotificationPreferences.getState().setWatchlistAutoAlerts(e.target.checked)}
                style={{ accentColor: C.b }}
              />
              🔔 Auto-alert all watchlist assets
            </label>
            <div style={{ fontSize: 8, color: C.t3, marginLeft: 20, marginTop: 2, opacity: 0.7 }}>
              Automatically creates 52W High/Low alerts for new watchlist additions
            </div>
          </div>

          {/* DND Schedule */}
          <div>
            <label style={{ color: C.t3, display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="checkbox"
                checked={useNotificationPreferences.getState().dndEnabled}
                onChange={(e) => useNotificationPreferences.setState({ dndEnabled: e.target.checked })}
                style={{ accentColor: C.b }}
              />
              🌙 Do Not Disturb Schedule
            </label>
            {useNotificationPreferences.getState().dndEnabled && (
              <div style={{ display: 'flex', gap: 6, marginTop: 4, marginLeft: 20 }}>
                <label style={{ color: C.t3 }}>Start:
                  <input
                    type="time"
                    value={useNotificationPreferences.getState().dndStart || '22:00'}
                    onChange={(e) => useNotificationPreferences.setState({ dndStart: e.target.value })}
                    style={{
                      marginLeft: 4, background: C.bg, border: `1px solid ${C.bd}`,
                      borderRadius: 4, color: C.t1, padding: '2px 4px', fontSize: 10,
                    }}
                  />
                </label>
                <label style={{ color: C.t3 }}>End:
                  <input
                    type="time"
                    value={useNotificationPreferences.getState().dndEnd || '07:00'}
                    onChange={(e) => useNotificationPreferences.setState({ dndEnd: e.target.value })}
                    style={{
                      marginLeft: 4, background: C.bg, border: `1px solid ${C.bd}`,
                      borderRadius: 4, color: C.t1, padding: '2px 4px', fontSize: 10,
                    }}
                  />
                </label>
              </div>
            )}
          </div>

          {/* Master Volume */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: C.t3, minWidth: 50 }}>🔊 Volume</span>
            <input
              type="range" min="0" max="100" step="5"
              value={Math.round((useNotificationPreferences.getState().globalVolume ?? 0.7) * 100)}
              onChange={(e) => useNotificationPreferences.setState({ globalVolume: parseInt(e.target.value) / 100 })}
              style={{ flex: 1, accentColor: C.b }}
            />
            <span style={{ fontSize: 9, color: C.t2, fontFamily: M, minWidth: 24, textAlign: 'right' }}>
              {Math.round((useNotificationPreferences.getState().globalVolume ?? 0.7) * 100)}%
            </span>
          </div>

          {/* Global Mute */}
          <label style={{ color: C.t3, display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="checkbox"
              checked={useNotificationPreferences.getState().globalMute}
              onChange={() => useNotificationPreferences.getState().toggleMute()}
              style={{ accentColor: C.r }}
            />
            🔇 Mute all alerts
          </label>
        </div>
      </details>

      {/* End Manage tab */}
      </>)}
    </div>
  );
}

// ─── Alert Row Component ────────────────────────────────────────

function AlertRow({ alert, onToggle, onRemove, triggered = false }) {
  const condIcons = {
    above: '↑',
    below: '↓',
    cross_above: '↗',
    cross_below: '↘',
  };

  // P2 2.1: 3-tier severity based on proximity to current price
  const severityColor = triggered ? C.g
    : alert.severity === 'urgent' ? C.r
      : alert.severity === 'warning' ? C.y
        : C.b;
  const _severityLabel = triggered ? null
    : alert.severity === 'urgent' ? 'URGENT'
      : alert.severity === 'warning' ? 'WARN'
        : null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 8px',
        background: triggered ? C.sf + '80' : C.sf,
        borderRadius: 6,
        marginBottom: 3,
        opacity: triggered ? 0.7 : 1,
        borderLeft: `3px solid ${severityColor}`,
      }}
    >
      {/* Symbol + condition */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontFamily: M, fontWeight: 700, fontSize: 12, color: C.t1 }}>{alert.symbol}</span>
          <span style={{ fontSize: 10, color: C.t3 }}>
            {condIcons[alert.condition] || ''} {alert.condition.replace('_', ' ')}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 1 }}>
          <span style={{ fontFamily: M, fontWeight: 600, fontSize: 12, color: C.b }}>
            ${alert.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          {alert.repeating && (
            <span style={{ fontSize: 8, color: C.t3, background: C.bd + '60', padding: '1px 4px', borderRadius: 2 }}>
              REPEAT
            </span>
          )}
          {alert.note && (
            <span
              style={{ fontSize: 9, color: C.t3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {alert.note}
            </span>
          )}
          {/* B1: Compound condition badges */}
          {alert.conditions && alert.conditions.length > 0 && (
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 2 }}>
              {alert.conditions.map((sub, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: 8,
                    color: sub.type === 'indicator' ? '#FF9800' : C.b,
                    background: (sub.type === 'indicator' ? '#FF9800' : C.b) + '15',
                    padding: '1px 4px',
                    borderRadius: 3,
                    fontFamily: M,
                    fontWeight: 600,
                  }}
                >
                  {sub.type === 'indicator' ? sub.indicator : 'Price'}
                  {' '}{sub.condition?.replace('_', ' ')}
                  {' '}{sub.price != null ? `$${sub.price}` : ''}
                  {i < alert.conditions.length - 1 ? ` ${alert.compoundLogic || 'AND'}` : ''}
                </span>
              ))}
            </div>
          )}
          {/* B5: Expiration badge */}
          {alert.expiresAt && (
            <span style={{ fontSize: 7, color: C.t3, background: C.bd + '40', padding: '1px 4px', borderRadius: 2 }}>
              ⏰ Expires {new Date(alert.expiresAt).toLocaleDateString()}
            </span>
          )}
        </div>
        {triggered && alert.triggeredAt && (
          <div style={{ fontSize: 9, color: C.g, marginTop: 2, fontFamily: M }}>
            ✓ Triggered {formatTime(alert.triggeredAt)}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
        <button
          className="tf-btn"
          onClick={() => onToggle(alert.id)}
          title={alert.active ? 'Pause alert' : 'Re-arm alert'}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: alert.active ? C.t2 : C.t3,
            fontSize: 12,
            padding: '2px 4px',
          }}
        >
          {alert.active ? '⏸' : '▶'}
        </button>
        <button
          className="tf-btn"
          onClick={() => onRemove(alert.id)}
          title="Delete alert"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: C.r + '80',
            fontSize: 11,
            padding: '2px 4px',
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export { AlertPanel };

export default React.memo(AlertPanel);
