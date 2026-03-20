// ═══════════════════════════════════════════════════════════════════
// charEdge v11.0 — Application Root
// Boot sequence → Loading → Sidebar + Page layout
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useCallback, useEffect, useRef, Suspense } from 'react';
import AuthGate from './app/components/auth/AuthGate.jsx';
import ErrorBoundary from './app/components/ui/ErrorBoundary.jsx';
import KeyboardShortcuts from './app/components/ui/KeyboardShortcuts.jsx';
import { ToastContainer } from './app/components/ui/Toast.jsx';
import MobileNav from './app/layouts/MobileNav.jsx';
import PageRouter from './app/layouts/PageRouter.jsx';
import Sidebar from './app/layouts/Sidebar.jsx';
import DailyGuardBanner from './app/misc/components/DailyGuardBanner.jsx';
import { useHashRouter } from './hooks/useHashRouter.js';
import styles from './App.module.css';
import { useAppBoot } from './AppBoot.js';
import { useBootEffects } from './hooks/useBootEffects.js';
import { useConsentStore } from './state/useConsentStore';
import { useFocusStore } from './state/useFocusStore.js';
import { useNotificationStore } from './state/useNotificationStore';
import { useUIStore } from './state/useUIStore';
import { useAccountStore } from './state/useAccountStore';
import { useJournalStore } from './state/useJournalStore';
import { useUserStore } from './state/useUserStore';
import useCopilotChat from './hooks/useCopilotChat';
import { useHotkeys } from '@/hooks/useHotkeys';
import { useBreakpoints } from '@/hooks/useMediaQuery';
import { installGlobalErrorHandlers } from '@/shared/globalErrorHandler';
// Sentry is now consent-gated — see below in render

// Lazy-load overlay components (not needed on initial render)
const LogbookBridge = React.lazy(() => import('./app/components/ui/LogbookBridge.jsx'));
const ImportBridge = React.lazy(() => import('./app/components/ui/ImportBridge.jsx'));
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
const VercelAnalytics = React.lazy(() => import('@vercel/analytics/react').then((m) => ({ default: m.Analytics })));
const VercelSpeedInsights = React.lazy(() =>
  import('@vercel/speed-insights/react').then((m) => ({ default: m.SpeedInsights })),
);

// Sprint 5: Global AI Copilot Panel (lazy-loaded)
const CopilotPanel = React.lazy(() => import('./app/components/ai/CopilotPanel.jsx'));
const ErrorBudgetBanner = React.lazy(() => import('./app/components/ui/ErrorBudgetBanner.jsx'));
const PipelineDevTools = React.lazy(() => import('./app/components/data/PipelineDevTools.jsx'));

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
      try {
        const last = sessionStorage.getItem(key);
        if (!last || Date.now() - Number(last) > 30000) {
          sessionStorage.setItem(key, String(Date.now()));
          window.location.reload();
        }
      } catch {
        // sessionStorage throws in some private browsing modes — skip reload guard
      }
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            background: '#09090b',
            color: '#ececef',
            fontFamily: "'Inter', sans-serif",
            textAlign: 'center',
            padding: '2rem',
          }}
        >
          <div>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔄</div>
            <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700 }}>Update Available</h2>
            <p style={{ color: '#888', fontSize: 14, marginBottom: 24 }}>
              A new version of charEdge was deployed. Please reload to continue.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '12px 32px',
                borderRadius: 12,
                border: 'none',
                background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                color: '#fff',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
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
// Guard with typeof window to prevent SSR state leaks across requests
if (typeof window !== 'undefined') {
  setTimeout(() => {
    try {
      globalThis.__charEdge_notification_store__ = useNotificationStore;
      // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (_) {
      /* storage/API may be blocked */
    }
  }, 0);
}

export default function App() {
  const { ready, phase } = useAppBoot();
  const { isMobile } = useBreakpoints();
  const toggleNotifications = useNotificationStore((s) => s.toggleLogPanel);
  const page = useUIStore((s) => s.page);
  const setPage = useUIStore((s) => s.setPage);
  const theme = useUserStore((s) => s.theme);
  const analyticsConsent = useConsentStore((s) => s.analytics);

  // Sprint 4: Global copilot state
  const copilotOpen = useCopilotChat((s) => s.panelOpen);
  const toggleCopilot = useCopilotChat((s) => s.togglePanel);
  const copilotRef = useRef(null);

  // Keyboard shortcuts panel
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const closeShortcuts = useCallback(() => setShortcutsOpen(false), []);

  // Sprint 6: Hash-based URL routing — enables deep links & back/forward buttons
  useHashRouter();

  // Post-mount side effects (theme, auth, gamification) — extracted to keep App.jsx render-only
  useBootEffects();

  // ─── Guaranteed demo data seeding ──────────────────────────
  const demoActive = useAccountStore((s) => s.activeAccountId === 'demo');
  const tradeCount = useJournalStore((s) => s.trades?.length || 0);
  const journalLoaded = useJournalStore((s) => s.loaded);

  useEffect(() => {
    if (!ready || !demoActive || tradeCount > 0 || !journalLoaded) return;
    let cancelled = false;
    (async () => {
      try {
        const { genDemoData } = await import('./data/demoData.js');
        const demo = genDemoData();
        if (cancelled || !demo.trades?.length) return;
        console.info(`[App] Seeding ${demo.trades.length} demo trades (fallback)`);
        useJournalStore.getState().hydrate({
          trades: demo.trades,
          playbooks: demo.playbooks,
          notes: [],
          tradePlans: [],
        });
      } catch (err) {
        console.warn('[App] Demo seed failed:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [ready, demoActive, tradeCount, journalLoaded]);

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
      {
        key: 'ctrl+/',
        handler: () => window.dispatchEvent(new CustomEvent('tf:openTradeForm')),
        description: 'Quick add trade',
        allowInInput: true,
      },
      {
        key: 'ctrl+n',
        handler: () => window.dispatchEvent(new CustomEvent('tf:openTradeForm')),
        description: 'New trade',
        allowInInput: true,
      },
      // Sprint 20: Focus mode toggle
      {
        key: 'ctrl+shift+f',
        handler: () => useFocusStore.getState().toggleFocus(),
        description: 'Toggle focus mode',
        allowInInput: true,
      },
      // Sprint 4: Global copilot toggle
      {
        key: 'meta+k',
        handler: toggleCopilot,
        description: 'Toggle AI Copilot',
        allowInInput: true,
      },
      {
        key: 'ctrl+k',
        handler: toggleCopilot,
        description: 'Toggle AI Copilot',
        allowInInput: true,
      },
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
          <div key={theme} data-container="app" className={isMobile ? styles.appRootMobile : styles.appRoot}>
            {/* Sprint 23: Skip-to-content for keyboard/screen-reader users */}
            <a href="#tf-main-content" className={styles.skipLink}>
              Skip to content
            </a>
            {!isMobile && <Sidebar />}
            <ErrorBoundary resetKey={page}>
              <div className={isMobile ? styles.mainAreaMobile : styles.mainArea}>
                <DailyGuardBanner />
                <main className={styles.mainContent} id="tf-main-content" aria-label="Page content">
                  <PageRouter />
                </main>
              </div>
            </ErrorBoundary>
            {isMobile && <MobileNav />}
            <ToastContainer />
            {/* overlay modals — each in its own Suspense so triggering one doesn't suspend all */}
            <Suspense fallback={null}>
              <LogbookBridge />
            </Suspense>
            <Suspense fallback={null}>
              <ImportBridge />
            </Suspense>
            <Suspense fallback={null}>
              <GlobalQuickAddModal />
            </Suspense>
            <Suspense fallback={null}>
              <NotificationPanel />
            </Suspense>
            <Suspense fallback={null}>
              <OnboardingWizard />
            </Suspense>
            <Suspense fallback={null}>
              <LevelUpModal />
            </Suspense>
            <Suspense fallback={null}>
              <MilestoneModal />
            </Suspense>
            <Suspense fallback={null}>
              <SettingsSlideOver />
            </Suspense>
            <Suspense fallback={null}>
              <FocusOverlay />
            </Suspense>
            <Suspense fallback={null}>
              <CookieConsent />
            </Suspense>
            <Suspense fallback={null}>
              <FeedbackWidget />
            </Suspense>
            <Suspense fallback={null}>
              <ReactionBarOverlay />
            </Suspense>
            {/* Consent-gated: only load analytics when user opted in */}
            {analyticsConsent === true && (
              <Suspense fallback={null}>
                <VercelAnalytics />
              </Suspense>
            )}
            {analyticsConsent === true && (
              <Suspense fallback={null}>
                <VercelSpeedInsights />
              </Suspense>
            )}
            <KeyboardShortcuts isOpen={shortcutsOpen} onClose={closeShortcuts} />
            {/* Sprint 5: Global AI Copilot Panel */}
            {copilotOpen && (
              <Suspense fallback={null}>
                <CopilotPanel />
              </Suspense>
            )}
            {/* Sprint 4: Error Budget Banner + Pipeline DevTools */}
            <Suspense fallback={null}>
              <ErrorBudgetBanner />
            </Suspense>
            <Suspense fallback={null}>
              <PipelineDevTools />
            </Suspense>
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
        <div aria-hidden="true" className={styles.loadingSpark}>
          ✦
        </div>
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
