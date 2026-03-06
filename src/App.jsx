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
import AuthGate from './app/components/auth/AuthGate.jsx';
import { animationBudget } from './utils/AnimationBudget.js';
import { useAuthStore } from './state/useAuthStore.js';

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
const ReactionBarOverlay = React.lazy(() => import('./app/components/dialogs/ReactionBarOverlay.jsx'));
const VercelAnalytics = React.lazy(() => import('@vercel/analytics/react').then(m => ({ default: m.Analytics })));
const VercelSpeedInsights = React.lazy(() => import('@vercel/speed-insights/react').then(m => ({ default: m.SpeedInsights })));

// ─── Chunk Load Error Boundary ──────────────────────────────────
// Handles stale cache: when old cached HTML references JS chunks
// that no longer exist after a new deployment, the lazy imports fail.
// This boundary catches those errors and reloads the page once to
// get the fresh index.html with correct chunk references.
class ChunkErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error) {
    const isChunkError =
      error?.message?.includes('dynamically imported module') ||
      error?.message?.includes('Loading chunk') ||
      error?.message?.includes('Failed to fetch') ||
      error?.message?.includes('Loading CSS chunk');
    if (isChunkError) {
      // Only auto-reload once to avoid infinite loops
      const key = 'ce_chunk_reload';
      const last = sessionStorage.getItem(key);
      if (!last || Date.now() - Number(last) > 30000) {
        sessionStorage.setItem(key, String(Date.now()));
        window.location.reload();
      }
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '100vh', background: '#09090b', color: '#ececef',
          fontFamily: "'Inter', sans-serif", textAlign: 'center', padding: '2rem',
        }}>
          <div>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔄</div>
            <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700 }}>Update Available</h2>
            <p style={{ color: '#888', fontSize: 14, marginBottom: 24 }}>
              A new version of charEdge was deployed. Please reload to continue.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '12px 32px', borderRadius: 12, border: 'none',
                background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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
    // Sprint D: Start animation budget monitoring
    animationBudget.start();

    // Task 2.3.23: Check for crash recovery state on boot
    let recoveryHandled = false;
    import('./charting_library/core/SessionRecovery.js').then(({ getRecoveryState, clearRecoveryState }) => {
      if (recoveryHandled) return;
      recoveryHandled = true;
      getRecoveryState().then((recovery) => {
        if (!recovery) return;
        // Show recovery toast via existing Toast system
        import('./app/components/ui/Toast.jsx').then(({ default: toast }) => {
          toast.action(
            `💾 Restore session? (${recovery.symbol} ${recovery.timeframe})`,
            'Restore →',
            () => {
              // Apply recovery state to stores
              const chartStore = require('./state/useChartStore.js').useChartStore;
              if (recovery.symbol) chartStore.getState().setSymbol(recovery.symbol);
              if (recovery.timeframe) chartStore.getState().setTf(recovery.timeframe);
              if (recovery.chartType) chartStore.getState().setChartType(recovery.chartType);
              if (recovery.indicators?.length) {
                // Clear + re-add indicators
                const existing = chartStore.getState().indicators || [];
                for (let i = existing.length - 1; i >= 0; i--) chartStore.getState().removeIndicator(i);
                for (const ind of recovery.indicators) chartStore.getState().addIndicator(ind);
              }
              if (recovery.page) useUIStore.getState().setPage(recovery.page);
              clearRecoveryState();
            },
            { type: 'info', duration: 12000 },
          );
          // Clear recovery state after 15s regardless (auto-dismiss)
          setTimeout(() => clearRecoveryState(), 15000);
        }).catch(() => { /* Toast import is best-effort */ });
      }).catch(() => { /* recovery check is best-effort */ });
    }).catch(() => { /* SessionRecovery import is best-effort */ });

    return () => animationBudget.stop();
  }, []);

  // Initialize Supabase auth listener
  useEffect(() => {
    const unsubscribe = useAuthStore.getState().initialize();
    return unsubscribe;
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
    <ChunkErrorBoundary>
      <AuthGate>
        <Suspense fallback={<LoadingScreen phase="loading" />}>
          <div
            key={theme}
            data-container="app"
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
              <ReactionBarOverlay />
              {/* Consent-gated: only load analytics when user opted in */}
              {analyticsConsent === true && <VercelAnalytics />}
              {analyticsConsent === true && <VercelSpeedInsights />}
            </Suspense>
            <KeyboardShortcuts isOpen={shortcutsOpen} onClose={closeShortcuts} />
          </div>
        </Suspense>
      </AuthGate>
    </ChunkErrorBoundary>
  );
}

// ─── Loading Screen ─────────────────────────────────────────────

function LoadingScreen({ phase = 'connecting' }) {
  const PHASES = {
    connecting: { text: 'Connecting to market…', step: 1 },
    loading: { text: 'Loading price data…', step: 2 },
    computing: { text: 'Computing indicators…', step: 3 },
    ready: { text: 'Ready', step: 4 },
  };
  const current = PHASES[phase] || PHASES.connecting;

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
      <div className={styles.loadingTagline}>{current.text}</div>

      {/* Progress bar instead of spinner */}
      <div className={styles.loadingBarTrack}>
        <div className={styles.loadingBar} style={{ width: `${current.step * 25}%` }} />
      </div>
    </div>
  );
}

