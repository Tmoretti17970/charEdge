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
// C, F, M constants removed — using CSS module tokens (Sprint 24)
import { useGamificationStore } from '../../../state/useGamificationStore';
import {
  useNotificationPreferences,
  NOTIFICATION_CATEGORIES,
  CATEGORY_META,
  CHANNEL_META,
  FREQUENCY_META,
  PAUSE_DURATIONS,
} from '../../../state/useNotificationStore';
import { Card } from '../ui/UIKit.jsx';
import AlertSoundPicker from './AlertSoundPicker.jsx';
import DNDScheduleBuilder from './DNDScheduleBuilder.jsx';
import css from './NotificationsSection.module.css';
import { SectionHeader } from './SettingsHelpers.jsx';

// ─── Main Component ─────────────────────────────────────────────

function NotificationsSection() {
  const [activeCat, setActiveCat] = useState(null);

  return (
    <section className={css.sectionWrap}>
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

  // ─── Quick Presets ──────────────────────────────────────────
  const applyPreset = (preset) => {
    const store = useNotificationPreferences.getState();
    if (preset === 'all') {
      store.resumeAll();
    } else if (preset === 'important') {
      // Resume but enable DND for non-essential hours
      store.resumeAll();
      store.setDnd(true, '22:00', '08:00');
    } else if (preset === 'silent') {
      store.setPauseAll(true);
    }
  };

  return (
    <>
      {/* Quick Presets */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[
          { id: 'all', label: 'All', desc: 'Everything on' },
          { id: 'important', label: 'Important Only', desc: 'Alerts & errors' },
          { id: 'silent', label: 'Silent', desc: 'Everything off' },
        ].map((p) => (
          <button
            key={p.id}
            className={`tf-btn ${css.pauseBtn}`}
            onClick={() => applyPreset(p.id)}
            title={p.desc}
            style={{
              flex: 1,
              padding: '8px 12px',
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 8,
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Global Pause Control */}
      <Card className={css.cardPad}>
        <div className={css.rowBetween}>
          <div>
            <div className={css.heading}>Pause push notifications</div>
            <div className={css.hint}>
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
          <div className={css.flexWrapGap}>
            {Object.entries(PAUSE_DURATIONS).map(([key, { label }]) => (
              <button
                key={key}
                className={`tf-btn ${css.pauseBtn}`}
                onClick={() => {
                  setPauseAll(true, key);
                  setShowPausePicker(false);
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
        <div className={css.pauseBanner}>
          <span className={css.pauseBannerIcon}>⏸️</span>
          <span className={css.pauseBannerText}>
            Notifications paused{pauseLabel ? ` · ${pauseLabel}` : ''}
          </span>
          <button
            className={`tf-btn ${css.resumeBtn}`}
            onClick={() => setPauseAll(false)}

          >
            Resume
          </button>
        </div>
      )}

      {/* DND Schedule */}
      <Card className={css.cardPad}>
        <div className={css.rowBetween}>
          <div>
            <div className={css.heading}>🌙 Do Not Disturb</div>
            <div className={css.hint}>
              {dndEnabled ? `Active ${dndStart} — ${dndEnd}` : 'Schedule quiet hours for sound alerts'}
            </div>
          </div>
          <ToggleSwitch checked={dndEnabled} onChange={(val) => setDnd(val)} />
        </div>
        {dndEnabled && (
          <div className={css.flexGapMd}>
            <TimeInput label="From" value={dndStart} onChange={(v) => setDnd(true, v, dndEnd)} />
            <span className={css.timeArrow}>→</span>
            <TimeInput label="To" value={dndEnd} onChange={(v) => setDnd(true, dndStart, v)} />
          </div>
        )}
      </Card>

      {/* Category List */}
      <div className={css.sectionLabel}>Customize notifications</div>
      <Card className={css.cardPadFlush}>
        {NOTIFICATION_CATEGORIES.map((catId, _i) => {
          const meta = CATEGORY_META[catId];
          const summary = getActiveChannelSummary(catId);
          const channels = useNotificationPreferences.getState().categories[catId];
          const enabledCount = channels ? [channels.push, channels.inApp, channels.email, channels.sound].filter(Boolean).length : 0;
          const isAllOff = enabledCount === 0;
          return (
            <button
              key={catId}
              className={`tf-btn ${css.catRow}`}
              onClick={() => onSelectCategory(catId)}

            >
              <span className={css.catStatusIcon} data-off={isAllOff || undefined}>
                {isAllOff ? '○' : '✓'}
              </span>
              <span className={css.iconMd}>{meta.icon}</span>
              <div className={css.flex1}>
                <div className={css.rowGapTiny}>
                  <span className={css.catLabel}>{meta.label}</span>
                  <span
                    className={css.catCountBadge}
                    data-off={isAllOff || undefined}
                  >
                    {enabledCount}/4
                  </span>
                </div>
                <div className={css.catSummary} data-paused={pauseAll || undefined}>{summary}</div>
              </div>
              <span className={css.catChevron}>›</span>
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
    <label className={css.timeLabel}>
      <span className={css.timeLabelText}>{label}</span>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={css.timeInput}
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
      <button className={`tf-btn ${css.backBtn}`} onClick={onBack}>
        ← Back to Notifications
      </button>

      {/* Category Header */}
      <Card className={css.cardPadLg}>
        <div className={css.rowGap}>
          <span className={css.iconLg}>{meta.icon}</span>
          <div>
            <div className={css.headingLg}>{meta.label}</div>
            <div className={css.hint}>Tell us how you'd like to be notified.</div>
          </div>
        </div>
        <div className={css.bodyText}>{meta.description}</div>
      </Card>

      {/* Recommendation Banners */}
      {meta.recommendedChannels.map((ch) => {
        const bannerKey = `${categoryId}_${ch}`;
        if (config[ch] || dismissedBanners.includes(bannerKey)) return null;
        return (
          <div
            key={bannerKey}
            className={css.recBanner}
          >
            <span className={css.recBannerIcon}>{CHANNEL_META[ch].icon}</span>
            <span className={css.recBannerText}>
              We recommend turning on <strong>{CHANNEL_META[ch].label}</strong> for {meta.label.toLowerCase()}
            </span>
            <button
              className={`tf-btn ${css.recTurnOnBtn}`}
              onClick={() => setChannel(categoryId, ch, true)}
            >
              Turn On
            </button>
            <button
              className={`tf-btn ${css.recDismissBtn}`}
              onClick={() => dismissBanner(bannerKey)}
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
          <Card className={css.cardInline}>
            <div className={css.subHeading}>Alert Frequency</div>
            <div className={css.flexGapSm}>
              {Object.entries(FREQUENCY_META).map(([key, { label, description }]) => (
                <button
                  key={key}
                  className={`tf-btn ${css.freqBtn}`}
                  onClick={() => setFrequency(key)}
                  data-active={alertFrequency === key || undefined}
                  title={description}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className={css.tinyHintMt}>{FREQUENCY_META[alertFrequency]?.description}</div>
          </Card>

          {/* Watchlist Auto-Alerts */}
          <Card className={css.cardInline}>
            <div className={css.rowBetween}>
              <div>
                <div className={css.heading}>Watchlist Auto-Alerts</div>
                <div className={css.tinyHint}>
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
        <Card className={css.cardInline}>
          <div className={css.subHeading}>Alert Types by Asset Class</div>
          {Object.entries(assetClassPrefs).map(([cls, prefs]) => (
            <div key={cls} className={css.assetClassRow}>
              <div className={css.assetClassLabel}>{cls}</div>
              <div className={css.flexGapSm}>
                {[
                  { key: 'priceAlerts', label: 'Price' },
                  { key: 'percentAlerts', label: 'Percent' },
                  { key: 'fiftyTwoWeekAlerts', label: '52W Range' },
                ].map((item) => (
                  <button
                    key={item.key}
                    className={`tf-btn ${css.assetToggle}`}
                    onClick={() => setAssetClassPref(cls, item.key, !prefs[item.key])}
                    data-active={!!prefs[item.key] || undefined}
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
        <Card className={css.cardInline}>
          <div className={css.subHeading}>Transaction Events</div>
          <div className={css.tinyHint}>
            Choose which paper trading events trigger notifications
          </div>
          {TRANSACTION_EVENTS.map((evt) => (
            <div
              key={evt.id}
              className={css.eventRow}
            >
              <span className={css.iconSm}>{evt.icon}</span>
              <div className={css.flex1}>
                <div className={css.eventLabel}>{evt.label}</div>
                <div className={css.eventDesc}>{evt.desc}</div>
              </div>
              <ToggleSwitch checked={true} onChange={() => {}} />
            </div>
          ))}
        </Card>
      )}

      {/* Security Alerts: Event list (informational, all required) */}
      {categoryId === 'securityAlerts' && (
        <Card className={css.cardInline}>
          <div className={css.subHeading}>Monitored Events</div>
          <div className={css.tinyHint}>
            All security events are always monitored for your protection
          </div>
          {SECURITY_EVENTS.map((evt) => (
            <div
              key={evt.id}
              className={`${css.eventRow} ${css.eventRowSm}`}
            >
              <span className={css.iconSm}>{evt.icon}</span>
              <span className={css.eventLabelPlain}>{evt.label}</span>
              <span className={css.alwaysOnBadge}>ALWAYS ON</span>
            </div>
          ))}
          <div className={css.rateNote}>Message and data rates may apply.</div>
        </Card>
      )}

      {/* Smart Alerts: Sub-type list */}
      {categoryId === 'smartAlerts' && (
        <Card className={css.cardInline}>
          <div className={css.subHeading}>Alert Types</div>
          {SMART_ALERT_TYPES.map((type) => (
            <div
              key={type.id}
              className={css.eventRow}
            >
              <span className={css.iconSm}>{type.icon}</span>
              <div className={css.flex1}>
                <div className={css.eventLabel}>{type.label}</div>
                <div className={css.eventDesc}>{type.desc}</div>
              </div>
              <ToggleSwitch checked={true} onChange={() => {}} />
            </div>
          ))}
        </Card>
      )}

      {/* Channel Preferences */}
      <Card className={css.cardInline}>
        <div className={css.subHeading}>Delivery Channels</div>
        <div className={css.colGapSm}>
          {Object.entries(CHANNEL_META).map(([ch, chMeta]) => {
            const enabled = config[ch];
            const required = isChannelRequired(categoryId, ch);
            return (
              <div
                key={ch}
                className={css.channelRow}
            >
                <div className={css.rowGapSm}>
                  <span className={css.iconSm}>{chMeta.icon}</span>
                  <div>
                    <div className={css.channelLabel}>
                      {chMeta.label}
                      {required && <span className={css.requiredBadge}>REQUIRED</span>}
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
      className={css.previewWrap}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(12px)',
      }}
    >
      <Card className={css.previewCard}>
        <div className={css.previewLabel}>Preview</div>
        <div className={css.previewMockup}>
          <span className={`${css.iconXl} ${css.iconXlShadow}`}>{preview.icon}</span>
          <div className={css.flex1}>
            <div className={css.rowGapTiny}>
              <span className={css.previewCatLabel}>{CATEGORY_META[categoryId]?.label}</span>
            </div>
            <div className={css.previewTitle}>{preview.title}</div>
            <div className={css.previewBody}>{preview.body}</div>
            <div className={css.previewTime}>Just now</div>
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
      className={`tf-btn ${css.toggleTrack}`}
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      data-checked={checked || undefined}
      data-disabled={disabled || undefined}
    >
      <span
        className={css.toggleThumb}
        data-checked={checked || undefined}
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
    <Card className={css.cardPadTop}>
      <div className={css.sectionLabelInCard}>🎮 Gamification</div>
      {PREFS.map(({ key, label, desc, icon }) => (
        <div key={key} className={css.gamRow}>
          <div className={css.rowGap}>
            <span className={css.iconSm}>{icon}</span>
            <div>
              <div className={css.gamLabel}>{label}</div>
              <div className={css.gamDesc}>{desc}</div>
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
