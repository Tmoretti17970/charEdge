import React, { Suspense, useEffect, useRef } from 'react';
import { C } from '../../constants.js';
import { trackPageView } from '../../observability/telemetry';
import { useUIStore } from '../../state/useUIStore';
import ErrorBoundary from '../components/ui/ErrorBoundary.jsx';
import PageBreadcrumb from '../components/ui/PageBreadcrumb.jsx';

// All pages lazy-loaded for optimal initial bundle size
const JournalPage = React.lazy(() => import('../../pages/JournalPage.jsx'));
const ChartsPage = React.lazy(() => import('../../pages/ChartsPage.jsx'));
const SettingsPage = React.lazy(() => import('../../pages/SettingsPage.jsx'));
const TelemetryDashboard = React.lazy(() => import('../../pages/TelemetryDashboard.jsx'));
const CharolettePage = React.lazy(() => import('../../pages/CharolettePage.jsx'));
const ChangelogPage = React.lazy(() => import('../../pages/ChangelogPage.jsx'));
const PrivacyPage = React.lazy(() => import('../../pages/PrivacyPage.jsx'));
const TermsPage = React.lazy(() => import('../../pages/TermsPage.jsx'));
const LandingPage = React.lazy(() => import('../../pages/LandingPage.jsx'));
const SpeedtestPage = React.lazy(() => import('../../pages/SpeedtestPage.jsx'));
const MarketsPage = React.lazy(() => import('../../pages/MarketsPage.jsx'));
const ImportPage = React.lazy(() => import('../../pages/ImportPage.jsx'));

// Prefetch Journal immediately (it's the default page) so it loads in background
if (typeof window !== 'undefined') {
  requestIdleCallback?.(() => import('../../pages/JournalPage.jsx'), { timeout: 500 })
    ?? setTimeout(() => import('../../pages/JournalPage.jsx'), 100);
}

const PAGES = {
  dashboard: JournalPage,
  journal: JournalPage,
  charts: ChartsPage,
  markets: MarketsPage,
  charolette: CharolettePage,
  changelog: ChangelogPage,
  privacy: PrivacyPage,
  terms: TermsPage,
  landing: LandingPage,
  speedtest: SpeedtestPage,
  settings: SettingsPage,
  telemetry: TelemetryDashboard,
  import: ImportPage,
};

function SkeletonBlock({ w, h, style }) {
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: 8,
        background: `linear-gradient(90deg, ${C.bd}30 0%, ${C.bd}50 50%, ${C.bd}30 100%)`,
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s ease-in-out infinite',
        ...style,
      }}
    />
  );
}

function PageFallback() {
  return (
    <div
      style={{
        padding: 32,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        maxWidth: 900,
      }}
    >
      {/* Header skeleton */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <SkeletonBlock w={160} h={28} />
        <div style={{ flex: 1 }} />
        <SkeletonBlock w={80} h={28} />
      </div>

      {/* Card skeletons */}
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            background: C.sf,
            borderRadius: 12,
            border: `1px solid ${C.bd}`,
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', gap: 12 }}>
            <SkeletonBlock w={40} h={40} style={{ borderRadius: 10 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <SkeletonBlock w="60%" h={14} />
              <SkeletonBlock w="40%" h={10} />
            </div>
            <SkeletonBlock w={60} h={20} />
          </div>
          {i === 1 && <SkeletonBlock w="100%" h={80} />}
        </div>
      ))}

    </div>
  );
}

function PageRouter() {
  const page = useUIStore((s) => s.page);
  const Page = PAGES[page] || JournalPage;
  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  const hasMounted = useRef(false);

  // Track page views for telemetry
  useEffect(() => {
    trackPageView(page || 'journal');
  }, [page]);

  // Skip animation on first mount
  useEffect(() => {
    hasMounted.current = true;
  }, []);

  // Sprint 23: Human-readable page labels for screen readers
  const PAGE_LABELS = {
    journal: 'Command Center',
    dashboard: 'Dashboard',
    charts: 'Charts',
    markets: 'Markets',
    charolette: "Charolette\u2019s Light",
    settings: 'Settings',
    telemetry: 'Telemetry',
    changelog: "What's New",
    privacy: 'Privacy Policy',
    terms: 'Terms of Service',
    landing: 'Landing',
    speedtest: 'Speed Test',
    import: 'Import Hub',
  };

  const motionEnabled = hasMounted.current && !prefersReducedMotion;

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        overflowY: page === 'charts' ? 'hidden' : 'auto',
        overflowX: 'hidden',
      }}
      role="region"
      aria-live="polite"
      aria-label={PAGE_LABELS[page] || 'Page content'}
    >
      <div
        key={page}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          animation: motionEnabled ? 'fadeInUp 250ms cubic-bezier(0.16, 1, 0.3, 1) both' : 'none',
        }}
      >
        {/* Sprint 11: Section title breadcrumb */}
        <PageBreadcrumb page={page} />
        <Suspense fallback={<PageFallback />}>
          <ErrorBoundary resetKey={page}>
            <Page />
          </ErrorBoundary>
        </Suspense>
      </div>
    </div>
  );
}

export default React.memo(PageRouter);
