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
import { playAlertSound } from '../../../app/misc/alertSounds';
import { C } from '../../../constants.js';
import { useAlertStore } from '../../../state/useAlertStore';
import { useNotificationPreferences } from '../../../state/useNotificationStore';
import { usePriceTracker } from '../../../state/usePriceTracker';
import s from './AlertPanel.module.css';
import CompoundAlertBuilder from './CompoundAlertBuilder.jsx';

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
    <div className={`${s.root} ${compact ? s.rootCompact : ''}`}>
      {/* ─── Header ───────────────────────────────────── */}
      <div className={s.header}>
        <span className={s.title}>🔔 Price Alerts</span>
        <div className={s.headerRight}>
          <button
            onClick={() => useNotificationPreferences.getState().toggleMute()}
            title={useNotificationPreferences.getState().globalMute ? 'Unmute alerts' : 'Mute all alerts'}
            className={`${s.muteBtn} ${useNotificationPreferences.getState().globalMute ? s.muteBtnActive : s.muteBtnInactive}`}
          >{useNotificationPreferences.getState().globalMute ? '🔇' : '🔊'}</button>
          <span className={s.activeCount}>{activeAlerts.length} active</span>
        </div>
      </div>

      {/* E3: Tab bar */}
      <div className={s.tabBar}>
        {[{ id: 'manage', label: '🔔 Manage' }, { id: 'history', label: '📜 History' }, { id: 'analytics', label: '📈 Analytics' }].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`${s.tab} ${activeTab === tab.id ? s.tabActive : ''}`}
          >{tab.label}</button>
        ))}
      </div>

      {/* E3: History tab */}
      {activeTab === 'history' && (
        <React.Suspense fallback={<div className={s.suspenseFallback}>Loading...</div>}>
          <AlertHistoryPanel />
        </React.Suspense>
      )}

      {/* E3: Analytics tab */}
      {activeTab === 'analytics' && (
        <React.Suspense fallback={<div className={s.suspenseFallback}>Loading...</div>}>
          <AlertAnalytics />
        </React.Suspense>
      )}

      {/* Manage tab — existing form + alert list */}
      {activeTab === 'manage' && (<>

      {/* ─── Coinbase-Style Quick Presets ──────────────── */}
      {symbol.trim() && (
        <div className={s.presetSection}>
          <div className={s.presetHeader}>
            <span className={s.presetLabel}>
              ⚡ Quick Alerts for {symbol.toUpperCase()}
            </span>
            {highProximity != null && (
              <span className={`${s.proximityBadge} ${Math.abs(highProximity) < 3 ? s.proximityNear : ''}`}>
                {Math.abs(highProximity) < 3 ? `🌟 ${Math.abs(highProximity).toFixed(1)}% from 52W High` : ''}
              </span>
            )}
          </div>
          <div className={s.presetGrid}>
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handlePresetClick(preset.id)}
                title={preset.desc}
                className={s.presetBtn}
                style={{ '--preset-color': preset.color }}
              >
                {preset.label}
              </button>
            ))}
          </div>
          {lowProximity != null && Math.abs(lowProximity) < 5 && (
            <div className={s.lowWarning}>
              ⚠️ Within {lowProximity.toFixed(1)}% of 52-Week Low
            </div>
          )}
        </div>
      )}

      {/* ─── Add Alert Form ───────────────────────────── */}
      <div className={s.formCard}>
        <div className={s.formRow}>
          <input
            aria-label="Alert parameter"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            onKeyDown={handleKeyDown}
            placeholder="SYM"
            className={`${s.input} ${s.inputSymbol}`}
          />
          <select
            aria-label="Alert condition"
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            className={`${s.input} ${s.selectCondition}`}
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
            className={`${s.input} ${s.inputPrice}`}
          />
        </div>

        <div className={s.formRowCenter}>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Note (optional)"
            className={`${s.input} ${s.inputNote}`}
          />
          <label className={s.repeatLabel}>
            <input
              type="checkbox"
              checked={repeating}
              onChange={(e) => setRepeating(e.target.checked)}
              className={s.checkbox}
            />
            Repeat
          </label>
          {/* C4: Sound type selector + preview */}
          <select
            value={soundType}
            onChange={(e) => setSoundType(e.target.value)}
            className={`${s.input} ${s.selectSound}`}
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
            className={`tf-btn ${s.btnGhost}`}
            onClick={() => { try { playAlertSound(soundType || 'price'); } catch { /* ignored */ } }}
            title="Preview sound"
          >▶</button>
          <button
            className={`tf-btn ${s.addBtn} ${(!symbol.trim() || !price || isNaN(parseFloat(price))) ? s.addBtnDisabled : ''}`}
            onClick={handleAdd}
            disabled={!symbol.trim() || !price || isNaN(parseFloat(price))}
          >
            + Add
          </button>
        </div>
      </div>

      {/* ─── Advanced Toggle ──────────────────────────── */}
      <div className={s.advancedCenter}>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`${s.advancedBtn} ${showAdvanced ? s.advancedBtnActive : ''}`}
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
          <div className={s.sectionLabel}>
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
            className={s.triggeredHeader}
            style={{ marginTop: activeAlerts.length > 0 ? 'var(--tf-space-3)' : 0 }}
          >
            <span className={s.sectionLabel}>
              Triggered ({triggeredAlerts.length})
            </span>
            <button
              className={`tf-btn ${s.clearBtn}`}
              onClick={clearTriggered}
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
        <div className={s.empty}>
          <div className={s.emptyIcon}>🔔</div>
          <div>No alerts yet</div>
          <div className={s.emptyHint}>
            Get notified when a symbol hits your target price. Set an alert above to get started.
          </div>
        </div>
      )}
      {/* E6: DND Preferences Section */}
      <details className={s.prefsDetails}>
        <summary className={s.prefsSummary}>
          <span>⚙ Alert Preferences</span>
          <span className={s.prefsBadge}>
            {useNotificationPreferences.getState().dndEnabled ? '🌙 DND On' : ''}
            {watchlistAutoAlerts ? ' · 🔔 Auto' : ''}
          </span>
        </summary>
        <div className={s.prefsBody}>

          {/* Alert Frequency */}
          <div>
            <label className={s.prefsLabel}>
              📬 Alert Frequency
            </label>
            <div className={s.freqBar}>
              {[{ id: 'instant', label: '⚡ Instant' }, { id: 'hourly_digest', label: '📋 Hourly' }, { id: 'daily_digest', label: '📰 Daily' }].map((freq) => (
                <button
                  key={freq.id}
                  onClick={() => useNotificationPreferences.getState().setFrequency(freq.id)}
                  className={`${s.freqBtn} ${alertFrequency === freq.id ? s.freqBtnActive : ''}`}
                >{freq.label}</button>
              ))}
            </div>
          </div>

          {/* Watchlist Auto-Alerts */}
          <div>
            <label className={s.checkLabel}>
              <input
                type="checkbox"
                checked={watchlistAutoAlerts}
                onChange={(e) => useNotificationPreferences.getState().setWatchlistAutoAlerts(e.target.checked)}
                className={s.checkAccent}
              />
              🔔 Auto-alert all watchlist assets
            </label>
            <div className={s.checkHint}>
              Automatically creates 52W High/Low alerts for new watchlist additions
            </div>
          </div>

          {/* DND Schedule */}
          <div>
            <label className={s.checkLabel}>
              <input
                type="checkbox"
                checked={useNotificationPreferences.getState().dndEnabled}
                onChange={(e) => useNotificationPreferences.setState({ dndEnabled: e.target.checked })}
                className={s.checkAccent}
              />
              🌙 Do Not Disturb Schedule
            </label>
            {useNotificationPreferences.getState().dndEnabled && (
              <div className={s.dndRow}>
                <label className={s.checkLabel}>Start:
                  <input
                    type="time"
                    value={useNotificationPreferences.getState().dndStart || '22:00'}
                    onChange={(e) => useNotificationPreferences.setState({ dndStart: e.target.value })}
                    className={s.timeInput}
                  />
                </label>
                <label className={s.checkLabel}>End:
                  <input
                    type="time"
                    value={useNotificationPreferences.getState().dndEnd || '07:00'}
                    onChange={(e) => useNotificationPreferences.setState({ dndEnd: e.target.value })}
                    className={s.timeInput}
                  />
                </label>
              </div>
            )}
          </div>

          {/* Master Volume */}
          <div className={s.volumeRow}>
            <span className={s.volumeLabel}>🔊 Volume</span>
            <input
              type="range" min="0" max="100" step="5"
              value={Math.round((useNotificationPreferences.getState().globalVolume ?? 0.7) * 100)}
              onChange={(e) => useNotificationPreferences.setState({ globalVolume: parseInt(e.target.value) / 100 })}
              className={s.volumeSlider}
            />
            <span className={s.volumeVal}>
              {Math.round((useNotificationPreferences.getState().globalVolume ?? 0.7) * 100)}%
            </span>
          </div>

          {/* Global Mute */}
          <label className={s.checkLabel}>
            <input
              type="checkbox"
              checked={useNotificationPreferences.getState().globalMute}
              onChange={() => useNotificationPreferences.getState().toggleMute()}
              className={s.checkRed}
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

  return (
    <div
      className={`${s.alertRow} ${triggered ? s.alertRowTriggered : ''}`}
      style={{ '--severity-color': severityColor }}
    >
      {/* Symbol + condition */}
      <div className={s.alertBody}>
        <div className={s.alertSymbolRow}>
          <span className={s.alertSymbol}>{alert.symbol}</span>
          <span className={s.alertCondition}>
            {condIcons[alert.condition] || ''} {alert.condition.replace('_', ' ')}
          </span>
        </div>
        <div className={s.alertDetailRow}>
          <span className={s.alertPrice}>
            ${alert.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          {alert.repeating && (
            <span className={s.alertBadge}>
              REPEAT
            </span>
          )}
          {alert.note && (
            <span className={s.alertNote}>
              {alert.note}
            </span>
          )}
          {/* B1: Compound condition badges */}
          {alert.conditions && alert.conditions.length > 0 && (
            <div className={s.compoundBadges}>
              {alert.conditions.map((sub, i) => (
                <span
                  key={i}
                  className={s.compoundBadge}
                  style={{ '--compound-color': sub.type === 'indicator' ? '#FF9800' : C.b }}
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
            <span className={s.expireBadge}>
              ⏰ Expires {new Date(alert.expiresAt).toLocaleDateString()}
            </span>
          )}
        </div>
        {triggered && alert.triggeredAt && (
          <div className={s.triggeredInfo}>
            ✓ Triggered {formatTime(alert.triggeredAt)}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className={s.alertActions}>
        <button
          className={`tf-btn ${s.actionBtn} ${alert.active ? s.actionBtnToggle : s.actionBtnToggleOff}`}
          onClick={() => onToggle(alert.id)}
          title={alert.active ? 'Pause alert' : 'Re-arm alert'}
        >
          {alert.active ? '⏸' : '▶'}
        </button>
        <button
          className={`tf-btn ${s.actionBtn} ${s.actionBtnDelete}`}
          onClick={() => onRemove(alert.id)}
          title="Delete alert"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export { AlertPanel };

export default React.memo(AlertPanel);
