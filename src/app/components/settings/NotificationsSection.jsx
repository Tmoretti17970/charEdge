// ═══════════════════════════════════════════════════════════════════
// charEdge — Notification Settings Section (Sprints 2 + 4-6 Polish)
//
// Coinbase-style notification settings hub inside the Settings page.
//   Sprint 2: Base hub + category detail pages
//   Sprint 4: Per-category event toggles, DND schedule, watchlist auto-alerts
//   Sprint 5: Animated preview cards with slide-up entrance
//   Sprint 6: Smart recommendation banners with "Turn On" quick-action
//
// Uses useNotificationPreferences for all state.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { C, F, M } from '../../../constants.js';
import { radii } from '../../../theme/tokens.js';
import { Card } from '../ui/UIKit.jsx';
import { SectionHeader } from './SettingsHelpers.jsx';
import {
  useNotificationPreferences,
  NOTIFICATION_CATEGORIES,
  CATEGORY_META,
  CHANNEL_META,
  FREQUENCY_META,
  PAUSE_DURATIONS,
} from '../../../state/useNotificationStore';
import DNDScheduleBuilder from './DNDScheduleBuilder.jsx';
import AlertSoundPicker from './AlertSoundPicker.jsx';
import { useGamificationStore } from '../../../state/useGamificationStore';

// ─── Main Component ─────────────────────────────────────────────

function NotificationsSection() {
  const [activeCat, setActiveCat] = useState(null);

  return (
    <section style={{ marginBottom: 40 }}>
      <SectionHeader icon="bell" title="Notifications" description="Control how and when charEdge notifies you" />
      {activeCat ? (
        <CategoryDetailPage categoryId={activeCat} onBack={() => setActiveCat(null)} />
      ) : (
        <NotificationHub onSelectCategory={setActiveCat} />
      )}
      <DNDScheduleBuilder />
      <AlertSoundPicker />
      <GamificationNotifPrefs />
    </section>
  );
}

// ─── Notification Hub (Main View) ───────────────────────────────

function NotificationHub({ onSelectCategory }) {
  const pauseAll = useNotificationPreferences((s) => s.pauseAll);
  const pauseUntil = useNotificationPreferences((s) => s.pauseUntil);
  const setPauseAll = useNotificationPreferences((s) => s.setPauseAll);
  const dndEnabled = useNotificationPreferences((s) => s.dndEnabled);
  const dndStart = useNotificationPreferences((s) => s.dndStart);
  const dndEnd = useNotificationPreferences((s) => s.dndEnd);
  const setDnd = useNotificationPreferences((s) => s.setDnd);
  const getActiveChannelSummary = useNotificationPreferences((s) => s.getActiveChannelSummary);

  const [showPausePicker, setShowPausePicker] = useState(false);

  // Auto-resume check
  const isPauseExpired = pauseAll && pauseUntil && Date.now() >= pauseUntil;
  if (isPauseExpired) {
    useNotificationPreferences.getState().resumeAll();
  }

  const pauseLabel = useMemo(() => {
    if (!pauseAll) return null;
    if (!pauseUntil) return 'Until you turn it back on';
    const remaining = pauseUntil - Date.now();
    if (remaining <= 0) return null;
    const mins = Math.round(remaining / 60000);
    if (mins < 60) return `${mins}m remaining`;
    const hours = Math.round(mins / 60);
    return `${hours}h remaining`;
  }, [pauseAll, pauseUntil]);

  return (
    <>
      {/* Global Pause Control */}
      <Card style={{ padding: 16, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.t1, fontFamily: F }}>
              Pause push notifications
            </div>
            <div style={{ fontSize: 11, color: C.t3, fontFamily: F, marginTop: 2 }}>
              {pauseAll ? pauseLabel || 'All notifications paused' : 'Take a break for a short time'}
            </div>
          </div>
          <ToggleSwitch
            checked={pauseAll}
            onChange={(checked) => {
              if (checked) {
                setShowPausePicker(true);
              } else {
                setPauseAll(false);
                setShowPausePicker(false);
              }
            }}
          />
        </div>

        {/* Pause Duration Picker */}
        {showPausePicker && !pauseAll && (
          <div style={{
            marginTop: 12,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
          }}>
            {Object.entries(PAUSE_DURATIONS).map(([key, { label }]) => (
              <button
                key={key}
                className="tf-btn"
                onClick={() => {
                  setPauseAll(true, key);
                  setShowPausePicker(false);
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: radii.sm,
                  border: `1px solid ${C.bd}`,
                  background: C.sf,
                  color: C.t2,
                  fontSize: 11,
                  fontFamily: M,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Pause active banner */}
      {pauseAll && (
        <div style={{
          padding: '10px 16px',
          marginBottom: 12,
          borderRadius: radii.sm,
          background: `${C.y}12`,
          border: `1px solid ${C.y}30`,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span style={{ fontSize: 14 }}>⏸️</span>
          <span style={{ fontSize: 11, color: C.y, fontFamily: F, fontWeight: 500 }}>
            Notifications paused{pauseLabel ? ` · ${pauseLabel}` : ''}
          </span>
          <button
            className="tf-btn"
            onClick={() => setPauseAll(false)}
            style={{
              marginLeft: 'auto',
              padding: '4px 10px',
              borderRadius: radii.sm,
              border: `1px solid ${C.y}40`,
              background: 'transparent',
              color: C.y,
              fontSize: 10,
              fontFamily: M,
              cursor: 'pointer',
            }}
          >
            Resume
          </button>
        </div>
      )}

      {/* DND Schedule */}
      <Card style={{ padding: 16, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.t1, fontFamily: F }}>
              🌙 Do Not Disturb
            </div>
            <div style={{ fontSize: 11, color: C.t3, fontFamily: F, marginTop: 2 }}>
              {dndEnabled ? `Active ${dndStart} — ${dndEnd}` : 'Schedule quiet hours for sound alerts'}
            </div>
          </div>
          <ToggleSwitch checked={dndEnabled} onChange={(val) => setDnd(val)} />
        </div>
        {dndEnabled && (
          <div style={{ display: 'flex', gap: 12, marginTop: 12, alignItems: 'center' }}>
            <TimeInput label="From" value={dndStart} onChange={(v) => setDnd(true, v, dndEnd)} />
            <span style={{ color: C.t3, fontSize: 11 }}>→</span>
            <TimeInput label="To" value={dndEnd} onChange={(v) => setDnd(true, dndStart, v)} />
          </div>
        )}
      </Card>

      {/* Category List */}
      <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', fontFamily: M, letterSpacing: 0.5, padding: '8px 0 4px', marginBottom: 4 }}>
        Customize notifications
      </div>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {NOTIFICATION_CATEGORIES.map((catId, i) => {
          const meta = CATEGORY_META[catId];
          const summary = getActiveChannelSummary(catId);
          const channels = useNotificationPreferences.getState().categories[catId];
          const enabledCount = channels ? [channels.push, channels.inApp, channels.email, channels.sound].filter(Boolean).length : 0;
          const isAllOff = enabledCount === 0;
          return (
            <button
              key={catId}
              className="tf-btn"
              onClick={() => onSelectCategory(catId)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: '100%',
                padding: '14px 16px',
                border: 'none',
                borderBottom: i < NOTIFICATION_CATEGORIES.length - 1 ? `1px solid ${C.bd}20` : 'none',
                background: 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 0.15s ease',
              }}
            >
              <span style={{
                fontSize: 10, width: 14, textAlign: 'center',
                color: isAllOff ? C.t3 : C.g,
                opacity: isAllOff ? 0.4 : 0.7,
              }}>{isAllOff ? '○' : '✓'}</span>
              <span style={{ fontSize: 16, width: 24, textAlign: 'center' }}>{meta.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.t1, fontFamily: F }}>{meta.label}</span>
                  <span style={{
                    fontSize: 9, fontWeight: 700, fontFamily: M,
                    padding: '1px 5px', borderRadius: 99,
                    background: isAllOff ? `${C.r}12` : `${C.g}12`,
                    color: isAllOff ? C.r : C.g,
                  }}>
                    {enabledCount}/4
                  </span>
                </div>
                <div style={{
                  fontSize: 11, color: C.t3, fontFamily: M, marginTop: 1,
                  opacity: pauseAll ? 0.5 : 1,
                }}>
                  {summary}
                </div>
              </div>
              <span style={{ fontSize: 14, color: C.t3 }}>›</span>
            </button>
          );
        })}
      </Card>
    </>
  );
}

// ─── Time Input ─────────────────────────────────────────────────

function TimeInput({ label, value, onChange }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 10, color: C.t3, fontFamily: M }}>{label}</span>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: '6px 8px',
          borderRadius: radii.sm,
          border: `1px solid ${C.bd}`,
          background: C.sf,
          color: C.t1,
          fontSize: 12,
          fontFamily: M,
          outline: 'none',
        }}
      />
    </label>
  );
}

// ─── Category Detail Page ───────────────────────────────────────

// Event definitions for Advanced Transactions
const TRANSACTION_EVENTS = [
  { id: 'orderFilled', label: 'Order Filled', icon: '✅', desc: 'Paper trade buy/sell orders executed' },
  { id: 'orderCanceled', label: 'Order Canceled', icon: '❌', desc: 'Orders that were canceled' },
  { id: 'stopLossHit', label: 'Stop Loss Hit', icon: '🛑', desc: 'When a stop-loss triggers' },
  { id: 'takeProfitHit', label: 'Take Profit Hit', icon: '🎯', desc: 'When a take-profit triggers' },
  { id: 'positionOpened', label: 'Position Opened', icon: '📂', desc: 'New positions opened' },
  { id: 'slTpModified', label: 'SL/TP Modified', icon: '✏️', desc: 'Changes to stop-loss or take-profit' },
];

// Security alert event list
const SECURITY_EVENTS = [
  { id: 'newSignIn', label: 'New sign-in detected', icon: '🔐' },
  { id: 'passwordReset', label: 'Password reset', icon: '🔑' },
  { id: 'oauthLink', label: 'OAuth account linked', icon: '🔗' },
  { id: 'sessionExpiry', label: 'Session expiry warning', icon: '⏰' },
];

// Smart alert sub-types
const SMART_ALERT_TYPES = [
  { id: 'volumeSpike', label: 'Volume Spikes', icon: '📊', desc: 'Unusual volume detected' },
  { id: 'patternComplete', label: 'Pattern Completions', icon: '📐', desc: 'Chart patterns recognized' },
  { id: 'sentimentShift', label: 'Sentiment Shifts', icon: '🧠', desc: 'Market sentiment changes' },
  { id: 'anomaly', label: 'Anomaly Detection', icon: '🔍', desc: 'Unusual market behavior' },
];

function CategoryDetailPage({ categoryId, onBack }) {
  const meta = CATEGORY_META[categoryId];
  const categories = useNotificationPreferences((s) => s.categories);
  const setChannel = useNotificationPreferences((s) => s.setChannel);
  const isChannelRequired = useNotificationPreferences((s) => s.isChannelRequired);
  const dismissedBanners = useNotificationPreferences((s) => s.dismissedBanners);
  const dismissBanner = useNotificationPreferences((s) => s.dismissBanner);
  const config = categories[categoryId];

  // Category-specific state
  const alertFrequency = useNotificationPreferences((s) => s.alertFrequency);
  const setFrequency = useNotificationPreferences((s) => s.setFrequency);
  const watchlistAutoAlerts = useNotificationPreferences((s) => s.watchlistAutoAlerts);
  const setWatchlistAutoAlerts = useNotificationPreferences((s) => s.setWatchlistAutoAlerts);
  const assetClassPrefs = useNotificationPreferences((s) => s.assetClassPrefs);
  const setAssetClassPref = useNotificationPreferences((s) => s.setAssetClassPref);

  return (
    <div>
      {/* Back button */}
      <button
        className="tf-btn"
        onClick={onBack}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 0',
          border: 'none',
          background: 'none',
          color: C.b,
          fontSize: 12,
          fontFamily: F,
          fontWeight: 500,
          cursor: 'pointer',
          marginBottom: 12,
        }}
      >
        ← Back to Notifications
      </button>

      {/* Category Header */}
      <Card style={{ padding: 20, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 24 }}>{meta.icon}</span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.t1, fontFamily: F }}>{meta.label}</div>
            <div style={{ fontSize: 11, color: C.t3, fontFamily: M, marginTop: 2 }}>
              Tell us how you'd like to be notified.
            </div>
          </div>
        </div>
        <div style={{ fontSize: 12, color: C.t3, fontFamily: F, lineHeight: 1.5 }}>
          {meta.description}
        </div>
      </Card>

      {/* Recommendation Banners (Sprint 6 — with "Turn On" action) */}
      {meta.recommendedChannels.map((ch) => {
        const bannerKey = `${categoryId}_${ch}`;
        if (config[ch] || dismissedBanners.includes(bannerKey)) return null;
        return (
          <div
            key={bannerKey}
            style={{
              padding: '10px 14px',
              marginBottom: 10,
              borderRadius: radii.sm,
              background: `${C.b}08`,
              border: `1px solid ${C.b}18`,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 13 }}>{CHANNEL_META[ch].icon}</span>
            <span style={{ flex: 1, fontSize: 11, color: C.b, fontFamily: F }}>
              We recommend turning on <strong>{CHANNEL_META[ch].label}</strong> for {meta.label.toLowerCase()}
            </span>
            {/* Sprint 6: Quick-action "Turn On" button */}
            <button
              className="tf-btn"
              onClick={() => setChannel(categoryId, ch, true)}
              style={{
                padding: '4px 10px',
                borderRadius: radii.sm,
                border: 'none',
                background: C.b,
                color: '#fff',
                fontSize: 10,
                fontFamily: M,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Turn On
            </button>
            <button
              className="tf-btn"
              onClick={() => dismissBanner(bannerKey)}
              style={{
                background: 'none', border: 'none', color: C.t3,
                fontSize: 12, cursor: 'pointer', padding: '2px 4px',
              }}
            >
              ✕
            </button>
          </div>
        );
      })}

      {/* ── Category-Specific Controls (Sprint 4) ── */}

      {/* Price Alerts: Frequency + Watchlist Auto-Alerts */}
      {categoryId === 'priceAlerts' && (
        <>
          <Card style={{ padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.t1, fontFamily: F, marginBottom: 10 }}>
              Alert Frequency
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {Object.entries(FREQUENCY_META).map(([key, { label, description }]) => (
                <button
                  key={key}
                  className="tf-btn"
                  onClick={() => setFrequency(key)}
                  style={{
                    flex: 1,
                    padding: '10px 8px',
                    borderRadius: radii.sm,
                    border: `1px solid ${alertFrequency === key ? C.b : C.bd}`,
                    background: alertFrequency === key ? `${C.b}12` : C.sf,
                    color: alertFrequency === key ? C.b : C.t2,
                    fontSize: 12,
                    fontWeight: alertFrequency === key ? 600 : 400,
                    fontFamily: F,
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.15s ease',
                  }}
                  title={description}
                >
                  {label}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 10, color: C.t3, fontFamily: M, marginTop: 6 }}>
              {FREQUENCY_META[alertFrequency]?.description}
            </div>
          </Card>

          {/* Watchlist Auto-Alerts */}
          <Card style={{ padding: 16, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.t1, fontFamily: F }}>
                  Watchlist Auto-Alerts
                </div>
                <div style={{ fontSize: 10, color: C.t3, fontFamily: M, marginTop: 2 }}>
                  Automatically create 52-week range alerts for watchlist symbols
                </div>
              </div>
              <ToggleSwitch checked={watchlistAutoAlerts} onChange={setWatchlistAutoAlerts} />
            </div>
          </Card>
        </>
      )}

      {/* Custom Alerts: Per-Asset-Class Toggles */}
      {categoryId === 'customAlerts' && (
        <Card style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.t1, fontFamily: F, marginBottom: 10 }}>
            Alert Types by Asset Class
          </div>
          {Object.entries(assetClassPrefs).map(([cls, prefs]) => (
            <div key={cls} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.t2, fontFamily: M, textTransform: 'uppercase', marginBottom: 6 }}>
                {cls}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[
                  { key: 'priceAlerts', label: 'Price' },
                  { key: 'percentAlerts', label: 'Percent' },
                  { key: 'fiftyTwoWeekAlerts', label: '52W Range' },
                ].map((item) => (
                  <button
                    key={item.key}
                    className="tf-btn"
                    onClick={() => setAssetClassPref(cls, item.key, !prefs[item.key])}
                    style={{
                      padding: '5px 10px',
                      borderRadius: radii.sm,
                      border: `1px solid ${prefs[item.key] ? C.g + '40' : C.bd}`,
                      background: prefs[item.key] ? `${C.g}10` : C.sf,
                      color: prefs[item.key] ? C.g : C.t3,
                      fontSize: 10,
                      fontFamily: M,
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {prefs[item.key] ? '✓ ' : ''}{item.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Advanced Transactions: Per-Event Toggles */}
      {categoryId === 'advancedTransactions' && (
        <Card style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.t1, fontFamily: F, marginBottom: 10 }}>
            Transaction Events
          </div>
          <div style={{ fontSize: 10, color: C.t3, fontFamily: M, marginBottom: 10 }}>
            Choose which paper trading events trigger notifications
          </div>
          {TRANSACTION_EVENTS.map((evt) => (
            <div
              key={evt.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 0',
                borderBottom: `1px solid ${C.bd}12`,
              }}
            >
              <span style={{ fontSize: 14, width: 20, textAlign: 'center' }}>{evt.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: C.t1, fontFamily: F }}>{evt.label}</div>
                <div style={{ fontSize: 10, color: C.t3, fontFamily: M }}>{evt.desc}</div>
              </div>
              <ToggleSwitch checked={true} onChange={() => {}} />
            </div>
          ))}
        </Card>
      )}

      {/* Security Alerts: Event list (informational, all required) */}
      {categoryId === 'securityAlerts' && (
        <Card style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.t1, fontFamily: F, marginBottom: 10 }}>
            Monitored Events
          </div>
          <div style={{ fontSize: 10, color: C.t3, fontFamily: M, marginBottom: 8 }}>
            All security events are always monitored for your protection
          </div>
          {SECURITY_EVENTS.map((evt) => (
            <div
              key={evt.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 0',
                borderBottom: `1px solid ${C.bd}12`,
              }}
            >
              <span style={{ fontSize: 14, width: 20, textAlign: 'center' }}>{evt.icon}</span>
              <span style={{ fontSize: 12, color: C.t1, fontFamily: F }}>{evt.label}</span>
              <span style={{ marginLeft: 'auto', fontSize: 9, color: C.g, fontFamily: M, fontWeight: 600 }}>ALWAYS ON</span>
            </div>
          ))}
          <div style={{ fontSize: 10, color: C.t3, fontFamily: M, marginTop: 10 }}>
            Message and data rates may apply.
          </div>
        </Card>
      )}

      {/* Smart Alerts: Sub-type list */}
      {categoryId === 'smartAlerts' && (
        <Card style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.t1, fontFamily: F, marginBottom: 10 }}>
            Alert Types
          </div>
          {SMART_ALERT_TYPES.map((type) => (
            <div
              key={type.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 0',
                borderBottom: `1px solid ${C.bd}12`,
              }}
            >
              <span style={{ fontSize: 14, width: 20, textAlign: 'center' }}>{type.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: C.t1, fontFamily: F }}>{type.label}</div>
                <div style={{ fontSize: 10, color: C.t3, fontFamily: M }}>{type.desc}</div>
              </div>
              <ToggleSwitch checked={true} onChange={() => {}} />
            </div>
          ))}
        </Card>
      )}

      {/* Channel Preferences */}
      <Card style={{ padding: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.t1, fontFamily: F, marginBottom: 12 }}>
          Delivery Channels
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {Object.entries(CHANNEL_META).map(([ch, chMeta]) => {
            const enabled = config[ch];
            const required = isChannelRequired(categoryId, ch);
            return (
              <div
                key={ch}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 0',
                  borderBottom: `1px solid ${C.bd}15`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14 }}>{chMeta.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: C.t1, fontFamily: F }}>
                      {chMeta.label}
                      {required && (
                        <span style={{
                          fontSize: 9, fontFamily: M, color: C.g,
                          marginLeft: 6, fontWeight: 600,
                        }}>
                          REQUIRED
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <ToggleSwitch
                  checked={enabled}
                  onChange={(val) => setChannel(categoryId, ch, val)}
                  disabled={required}
                />
              </div>
            );
          })}
        </div>
      </Card>

      {/* Preview Card (Sprint 5 — animated) */}
      <AnimatedPreviewCard categoryId={categoryId} />
    </div>
  );
}

// ─── Notification Preview Card (Sprint 5 — Animated) ────────────

const PREVIEW_DATA = {
  securityAlerts: { title: 'New sign-in detected', body: 'Chrome on macOS · Just now', icon: '🔐' },
  priceAlerts: { title: 'BTC moved above $70,000', body: 'Bitcoin is up +5.1% in the last 2 hours', icon: '📈' },
  customAlerts: { title: 'AAPL 52-Week High Alert', body: 'Apple is within 2% of its 52-week high ($198.23)', icon: '🎯' },
  tradingInsights: { title: "Today's Top Mover", body: 'ETH is up 10.0% in the last 24 hours', icon: '📊' },
  advancedTransactions: { title: 'Order Filled', body: 'Paper trade BUY 100 AAPL filled at $185.20', icon: '✅' },
  offersAnnouncements: { title: 'New Feature Available', body: 'Alert Automations are now live! Set up actions that trigger when alerts fire.', icon: '🎁' },
  smartAlerts: { title: 'Volume Spike Detected', body: 'NVDA volume 3.2x above average in the last 15 min', icon: '⚡' },
  system: { title: 'charEdge Updated', body: 'Version 10.3 is now live with alert improvements', icon: '⚙️' },
};

function AnimatedPreviewCard({ categoryId }) {
  const preview = PREVIEW_DATA[categoryId];
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const timeout = setTimeout(() => setVisible(true), 150);
    return () => clearTimeout(timeout);
  }, [categoryId]);

  if (!preview) return null;

  return (
    <div
      ref={ref}
      style={{
        marginTop: 12,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(12px)',
        transition: 'opacity 0.4s ease, transform 0.4s ease',
      }}
    >
      <Card style={{
        padding: 16,
        background: C.sf,
        border: `1px solid ${C.bd}30`,
        backdropFilter: 'blur(12px)',
      }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: C.t3, textTransform: 'uppercase', fontFamily: M, letterSpacing: 0.5, marginBottom: 8 }}>
          Preview
        </div>
        <div style={{
          display: 'flex',
          gap: 10,
          padding: '12px 14px',
          borderRadius: radii.md,
          background: `${C.bg2 || C.bg}`,
          border: `1px solid ${C.bd}20`,
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}>
          <span style={{ fontSize: 22, marginTop: 1, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))' }}>{preview.icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <span style={{ fontSize: 9, fontFamily: M, color: C.b, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                {CATEGORY_META[categoryId]?.label}
              </span>
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.t1, fontFamily: F }}>{preview.title}</div>
            <div style={{ fontSize: 11, color: C.t3, fontFamily: F, marginTop: 2, lineHeight: 1.4 }}>{preview.body}</div>
            <div style={{ fontSize: 10, color: C.t3, fontFamily: M, marginTop: 4, opacity: 0.6 }}>Just now</div>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─── Toggle Switch Component ────────────────────────────────────

function ToggleSwitch({ checked, onChange, disabled = false }) {
  return (
    <button
      className="tf-btn"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        border: 'none',
        padding: 2,
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: checked ? C.b : `${C.t3}30`,
        opacity: disabled ? 0.5 : 1,
        position: 'relative',
        transition: 'background 0.2s ease',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          display: 'block',
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#fff',
          transform: checked ? 'translateX(20px)' : 'translateX(0)',
          transition: 'transform 0.2s ease',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }}
      />
    </button>
  );
}

// ─── Gamification Notification Preferences ──────────────────────

function GamificationNotifPrefs() {
  const notificationPrefs = useGamificationStore((s) => s.notificationPrefs);
  const setNotificationPref = useGamificationStore((s) => s.setNotificationPref);
  const enabled = useGamificationStore((s) => s.enabled);

  if (!enabled) return null;

  const PREFS = [
    { key: 'levelUp', label: 'Level-Up Celebration', desc: 'Full-screen modal when you rank up', icon: '🎉' },
    { key: 'achievements', label: 'Achievement Toasts', desc: 'Pop-up notification when you unlock a badge', icon: '🏆' },
  ];

  return (
    <Card style={{ padding: 16, marginTop: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', fontFamily: M, letterSpacing: 0.5, marginBottom: 8 }}>
        🎮 Gamification
      </div>
      {PREFS.map(({ key, label, desc, icon }) => (
        <div key={key} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 0',
          borderBottom: key !== 'achievements' ? `1px solid ${C.bd}15` : 'none',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 14 }}>{icon}</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.t1, fontFamily: F }}>{label}</div>
              <div style={{ fontSize: 10, color: C.t3, fontFamily: M }}>{desc}</div>
            </div>
          </div>
          <ToggleSwitch
            checked={!!notificationPrefs[key]}
            onChange={(val) => setNotificationPref(key, val)}
          />
        </div>
      ))}
    </Card>
  );
}

export default React.memo(NotificationsSection);
