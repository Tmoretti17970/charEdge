// ═══════════════════════════════════════════════════════════════════
// charEdge v11.0 — Application Root
// Boot sequence → Loading → Sidebar + Page layout
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { useAppBoot } from './AppBoot.js';
import Sidebar from './app/layouts/Sidebar.jsx';
import MobileNav from './app/layouts/MobileNav.jsx';
import PageRouter from './app/layouts/PageRouter.jsx';
import { ToastContainer } from './app/components/ui/Toast.jsx';
import ErrorBoundary from './app/components/ui/ErrorBoundary.jsx';
import DailyGuardBanner from './app/misc/components/DailyGuardBanner.jsx';
import { useNotificationLog } from './state/useNotificationLog.js';
import { useBreakpoints } from './utils/useMediaQuery.js';
import { useHotkeys } from './utils/useHotkeys.js';
import { useUserStore } from './state/useUserStore.js';
import { useUIStore } from './state/useUIStore.js';
import { installGlobalErrorHandlers } from './utils/globalErrorHandler.js';
// Sentry is now consent-gated — see below in render
import { useConsentStore } from './state/useConsentStore.js';
import { C, F, M } from './constants.js';
import KeyboardShortcuts from './app/components/ui/KeyboardShortcuts.jsx';
import { useGamificationStore, XP_TABLE } from './state/useGamificationStore.js';
import { useJournalStore } from './state/useJournalStore.js';
import { processPendingAchievements } from './app/components/ui/AchievementToast.jsx';
import styles from './App.module.css';

import { useFocusStore } from './state/useFocusStore.js';
import PasswordGate from './app/components/ui/PasswordGate.jsx';

// Lazy-load overlay components (not needed on initial render)
const CommandPalette = React.lazy(() => import('./app/components/ui/CommandPalette.jsx'));
const NotificationPanel = React.lazy(() => import('./app/components/panels/NotificationPanel.jsx'));
const OnboardingWizard = React.lazy(() => import('./app/layouts/OnboardingWizard.jsx'));
const GlobalQuickAddModal = React.lazy(() => import('./app/components/ui/GlobalQuickAddModal.jsx'));
const LevelUpModal = React.lazy(() => import('./app/components/ui/LevelUpModal.jsx'));
const MilestoneModal = React.lazy(() => import('./app/components/ui/MilestoneModal.jsx'));
const SettingsSlideOver = React.lazy(() => import('./app/layouts/SettingsSlideOver.jsx'));
const FocusOverlay = React.lazy(() => import('./app/components/ui/FocusOverlay.jsx'));
const CookieConsent = React.lazy(() => import('./app/components/ui/CookieConsent.jsx'));
const FeedbackWidget = React.lazy(() => import('./app/components/ui/FeedbackWidget.jsx'));
const AgeVerificationGate = React.lazy(() => import('./app/components/ui/AgeVerificationGate.jsx'));
const VercelAnalytics = React.lazy(() => import('@vercel/analytics/react').then(m => ({ default: m.Analytics })));
const VercelSpeedInsights = React.lazy(() => import('@vercel/speed-insights/react').then(m => ({ default: m.SpeedInsights })));

// Install global error handlers once at module load
installGlobalErrorHandlers();

// Expose notification store globally for error handler integration
if (typeof globalThis !== 'undefined') {
  setTimeout(() => {
    try {
      globalThis.__charEdge_notification_store__ = useNotificationLog;
    } catch (_) { /* storage/API may be blocked */ }
  }, 0);
}

export default function App() {
  const { ready, phase } = useAppBoot();
  const { isMobile } = useBreakpoints();
  const toggleNotifications = useNotificationLog((s) => s.togglePanel);
  const page = useUIStore((s) => s.page);
  const setPage = useUIStore((s) => s.setPage);
  const theme = useUserStore((s) => s.theme);
  const analyticsConsent = useConsentStore((s) => s.analytics);

  // Keyboard shortcuts panel
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const closeShortcuts = useCallback(() => setShortcutsOpen(false), []);

  // Hydrate theme + density on mount
  useEffect(() => {
    useUserStore.getState().hydrate();
    useUserStore.getState().init();
  }, []);

  // ─── Gamification: react to trade changes ──────────────
  useEffect(() => {
    const unsub = useJournalStore.subscribe((state, prevState) => {
      if (!state.loaded || !useGamificationStore.getState().enabled) return;
      const trades = state.trades;
      const prevTrades = prevState.trades;

      // Award XP for new trades
      if (trades.length > prevTrades.length) {
        const newCount = trades.length - prevTrades.length;
        for (let i = 0; i < newCount; i++) {
          useGamificationStore.getState().awardXP(XP_TABLE.trade_logged, 'trade_logged');
          // Check for notes
          const trade = trades[i];
          if (trade && trade.notes && trade.notes.trim().length > 10) {
            useGamificationStore.getState().awardXP(XP_TABLE.notes_written, 'notes_written');
          }
        }

        // Sprint 16: First-trade celebration 🎉
        if (prevTrades.length === 0 && trades.length >= 1) {
          import('./state/useUserStore.js').then((mod) => {
            const onboarding = mod.useUserStore;
            if (!onboarding.getState().isDiscovered('first_trade')) {
              onboarding.getState().markDiscovered('first_trade');
              import('./app/components/ui/Toast.jsx').then(({ default: toast }) => {
                toast.success('🎉 First trade logged! You\'re on your way.', {
                  duration: 6000,
                });
                // Delayed analytics CTA
                setTimeout(() => {
                  toast.action(
                    '📊 View your analytics',
                    'Go to Dashboard →',
                    () => useUIStore.getState().setPage('journal'),
                    { type: 'info', duration: 8000 },
                  );
                }, 2000);
              }).catch(() => { }); // intentional: Toast import is best-effort UI
            }
          }).catch(() => { }); // intentional: dynamic import is best-effort
        }
      }

      // Update streaks + evaluate achievements + update daily challenge
      useGamificationStore.getState().updateStreaks(trades);
      useGamificationStore.getState().evaluateAchievements(trades);
      useGamificationStore.getState().updateChallengeProgress(trades);

      // Show achievement toasts (if notifications enabled)
      if (useGamificationStore.getState().notificationPrefs.achievements) {
        processPendingAchievements(
          useGamificationStore.getState().consumePendingAchievements,
        );
      } else {
        // Still consume them so they don't pile up
        useGamificationStore.getState().consumePendingAchievements();
      }

      // Sprint C: Evaluate milestones
      useGamificationStore.getState().evaluateMilestones(trades);

      // Sprint D: Weekly challenge + quest progress
      useGamificationStore.getState().updateWeeklyChallengeProgress(trades);
      useGamificationStore.getState().evaluateQuestProgress(trades);
    });
    return unsub;
  }, []);

  // Page navigation map: keys 1-3 → pages, 4 → settings slide-over
  const PAGE_KEYS = ['journal', 'charts', 'discover'];
  const toggleSettings = useUIStore((s) => s.toggleSettings);

  // Global hotkeys
  useHotkeys(
    [
      { key: 'ctrl+.', handler: toggleNotifications, description: 'Toggle activity log', allowInInput: true },
      { key: '?', handler: () => setShortcutsOpen((o) => !o), description: 'Toggle keyboard shortcuts' },
      { key: '1', handler: () => setPage(PAGE_KEYS[0]), description: 'Go to Home' },
      { key: '2', handler: () => setPage(PAGE_KEYS[1]), description: 'Go to Charts' },
      { key: '3', handler: () => setPage(PAGE_KEYS[2]), description: 'Go to Discover' },
      { key: '4', handler: () => toggleSettings(), description: 'Toggle Settings' },
      // Sprint 15: Quick trade entry from anywhere
      { key: 'ctrl+/', handler: () => window.dispatchEvent(new CustomEvent('tf:openTradeForm')), description: 'Quick add trade', allowInInput: true },
      { key: 'ctrl+n', handler: () => window.dispatchEvent(new CustomEvent('tf:openTradeForm')), description: 'New trade', allowInInput: true },
      // Sprint 20: Focus mode toggle
      { key: 'ctrl+shift+f', handler: () => useFocusStore.getState().toggleFocus(), description: 'Toggle focus mode', allowInInput: true },
    ],
    { scope: 'global', enabled: true },
  );

  if (!ready) {
    return <LoadingScreen phase={phase} />;
  }

  return (
    <PasswordGate>
      <Suspense fallback={<LoadingScreen phase="loading" />}>
        <AgeVerificationGate>
          <div
            key={theme}
            className={isMobile ? styles.appRootMobile : styles.appRoot}
          >
            {/* Sprint 23: Skip-to-content for keyboard/screen-reader users */}
            <a href="#tf-main-content" className={styles.skipLink}>Skip to content</a>
            {!isMobile && <Sidebar />}
            <ErrorBoundary resetKey={page}>
              <div className={isMobile ? styles.mainAreaMobile : styles.mainArea}>
                <DailyGuardBanner />
                <div className={styles.mainContent} id="tf-main-content" role="main" aria-label="Page content">
                  <PageRouter />
                </div>
              </div>
            </ErrorBoundary>
            {isMobile && <MobileNav />}
            <ToastContainer />
            <Suspense fallback={null}>{/* overlay modals — null fallback OK */}
              <CommandPalette />
              <GlobalQuickAddModal />
              <NotificationPanel />
              <OnboardingWizard />
              <LevelUpModal />
              <MilestoneModal />
              <SettingsSlideOver />
              <FocusOverlay />
              <CookieConsent />
              <FeedbackWidget />
              {/* Consent-gated: only load analytics when user opted in */}
              {analyticsConsent === true && <VercelAnalytics />}
              {analyticsConsent === true && <VercelSpeedInsights />}
            </Suspense>
            <KeyboardShortcuts isOpen={shortcutsOpen} onClose={closeShortcuts} />
          </div>
        </AgeVerificationGate>
      </Suspense>
    </PasswordGate>
  );
}

// ─── Loading Screen ─────────────────────────────────────────────

function LoadingScreen({ phase = 'connecting' }) {
  const phaseText = {
    connecting: 'Connecting…',
    loading: 'Loading market data…',
    computing: 'Computing indicators…',
    ready: 'Ready',
  }[phase] || 'Loading…';
  return (
    <div className={styles.loadingRoot}>
      {/* Brand icon with glow */}
      <div className={styles.loadingLogoWrap}>
        {/* ✦ Ember spark — rises and fades before logo appears */}
        <div aria-hidden="true" className={styles.loadingSpark}>✦</div>
        <div className={styles.loadingLogo}>CE</div>
        {/* Ambient glow */}
        <div className={styles.loadingGlow} />
      </div>
      <div className={styles.loadingTitle}>charEdge</div>
      <div className={styles.loadingTagline}>{phaseText}</div>

      {/* Progress bar instead of spinner */}
      <div className={styles.loadingBarTrack}>
        <div className={styles.loadingBar} />
      </div>
    </div>
  );
}
