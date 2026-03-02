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
import { C, F, M } from './constants.js';
import KeyboardShortcuts from './app/components/ui/KeyboardShortcuts.jsx';
import { useGamificationStore, XP_TABLE } from './state/useGamificationStore.js';
import { useJournalStore } from './state/useJournalStore.js';
import { processPendingAchievements } from './app/components/ui/AchievementToast.jsx';

import { useFocusStore } from './state/useFocusStore.js';

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

// Install global error handlers once at module load
installGlobalErrorHandlers();

// Expose notification store globally for error handler integration
if (typeof globalThis !== 'undefined') {
  setTimeout(() => {
    try {
      globalThis.__charEdge_notification_store__ = useNotificationLog;
    } catch {}
  }, 0);
}

export default function App() {
  const ready = useAppBoot();
  const { isMobile } = useBreakpoints();
  const toggleNotifications = useNotificationLog((s) => s.togglePanel);
  const page = useUIStore((s) => s.page);
  const setPage = useUIStore((s) => s.setPage);
  const theme = useUserStore((s) => s.theme);

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
              }).catch(() => {}); // intentional: Toast import is best-effort UI
            }
          }).catch(() => {}); // intentional: dynamic import is best-effort
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
    return <LoadingScreen />;
  }

  return (
    <div
      key={theme}
      style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        height: '100vh',
        overflow: 'hidden',
        background: C.bg,
        transition: 'background-color 0.2s ease',
      }}
    >
      {/* Sprint 23: Skip-to-content for keyboard/screen-reader users */}
      <a href="#tf-main-content" className="tf-skip-link">Skip to content</a>
      {!isMobile && <Sidebar />}
      <ErrorBoundary resetKey={page}>
        <div
          style={{
            flex: 1,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            paddingBottom: isMobile ? 56 : 0,
          }}
        >
          <DailyGuardBanner />
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }} id="tf-main-content" role="main" aria-label="Page content">
            <PageRouter />
          </div>
        </div>
      </ErrorBoundary>
      {isMobile && <MobileNav />}
      <ToastContainer />
      <Suspense fallback={null}>
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
      </Suspense>
      <KeyboardShortcuts isOpen={shortcutsOpen} onClose={closeShortcuts} />
    </div>
  );
}

// ─── Loading Screen ─────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        fontFamily: F,
        background: C.bg,
      }}
    >
      {/* Brand icon with glow */}
      <div style={{ position: 'relative' }}>
        {/* ✦ Ember spark — rises and fades before logo appears */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '50%',
            top: -8,
            transform: 'translateX(-50%)',
            fontSize: 14,
            color: C.rose || '#e8a0b0',
            textShadow: `0 0 8px ${C.rose || '#e8a0b0'}80`,
            animation: 'tfEmberSpark 2s ease-out infinite',
            pointerEvents: 'none',
          }}
        >
          ✦
        </div>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            background: `linear-gradient(135deg, ${C.b}, ${C.y})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: 24,
            fontFamily: M,
            color: '#fff',
            boxShadow: `0 8px 32px ${C.b}40, 0 0 0 1px rgba(255,255,255,0.06) inset`,
          }}
        >
          CE
        </div>
        {/* Ambient glow */}
        <div
          style={{
            position: 'absolute',
            inset: -20,
            borderRadius: 32,
            background: `radial-gradient(ellipse, ${C.b}15, transparent 70%)`,
            pointerEvents: 'none',
          }}
        />
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color: C.t1, letterSpacing: '-0.02em' }}>
        charEdge
      </div>
      <div style={{ fontSize: 12, color: C.t3, fontFamily: F, fontWeight: 500, letterSpacing: '0.04em' }}>
        Find Your Edge.
      </div>

      {/* Progress bar instead of spinner */}
      <div
        style={{
          width: 120,
          height: 3,
          borderRadius: 2,
          background: `${C.bd}40`,
          overflow: 'hidden',
          marginTop: 4,
        }}
      >
        <div
          style={{
            width: '40%',
            height: '100%',
            borderRadius: 2,
            background: `linear-gradient(90deg, ${C.b}, ${C.y})`,
            animation: 'tfLoadBar 1.2s ease-in-out infinite',
          }}
        />
      </div>

      <style>{`
        @keyframes tfLoadBar {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(150%); }
          100% { transform: translateX(350%); }
        }
        @keyframes tfEmberSpark {
          0% { opacity: 0; transform: translateX(-50%) translateY(0) scale(0.5); }
          30% { opacity: 1; transform: translateX(-50%) translateY(-16px) scale(1); }
          70% { opacity: 0.6; transform: translateX(-50%) translateY(-32px) scale(0.8); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-44px) scale(0.4); }
        }
        @media (prefers-reduced-motion: reduce) {
          [aria-hidden="true"] { animation: none !important; opacity: 0.7 !important; }
        }
      `}</style>
    </div>
  );
}
