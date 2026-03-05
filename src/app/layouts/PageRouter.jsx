import React, { Suspense, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useUIStore } from '../../state/useUIStore.js';
import { C } from '../../constants.js';
import ErrorBoundary from '../components/ui/ErrorBoundary.jsx';
import { trackPageView } from '../../utils/telemetry.js';

// All pages lazy-loaded for optimal initial bundle size
const JournalPage = React.lazy(() => import('../../pages/JournalPage.jsx'));
const ChartsPage = React.lazy(() => import('../../pages/ChartsPage.jsx'));
const SettingsPage = React.lazy(() => import('../../pages/SettingsPage.jsx'));
// Wave 0: Quarantined — social/community removed from v1.0 launch scope
// const CommunityPage = React.lazy(() => import('../../pages/CommunityPage.jsx'));
const TelemetryDashboard = React.lazy(() => import('../../pages/TelemetryDashboard.jsx'));
// Wave 0: Quarantined — AI Coach removed from v1.0 launch scope
// const CoachPage = React.lazy(() => import('../../pages/CoachPage.jsx'));
const CharolettePage = React.lazy(() => import('../../pages/CharolettePage.jsx'));
const ChangelogPage = React.lazy(() => import('../../pages/ChangelogPage.jsx'));
const PrivacyPage = React.lazy(() => import('../../pages/PrivacyPage.jsx'));
const TermsPage = React.lazy(() => import('../../pages/TermsPage.jsx'));
const LandingPage = React.lazy(() => import('../../pages/LandingPage.jsx'));
// Wave 0: Quarantined — pricing removed until Stripe integration
// const PricingPage = React.lazy(() => import('../../pages/PricingPage.jsx'));

// Prefetch Journal immediately (it's the default page) so it loads in background
if (typeof window !== 'undefined') {
  requestIdleCallback?.(() => import('../../pages/JournalPage.jsx'), { timeout: 500 })
    ?? setTimeout(() => import('../../pages/JournalPage.jsx'), 100);
}

const PAGES = {
  dashboard: JournalPage,
  journal: JournalPage,
  charts: ChartsPage,
  // Wave 0: Quarantined routes → fallback to JournalPage
  discover: JournalPage,
  coach: JournalPage,
  charolette: CharolettePage,
  changelog: ChangelogPage,
  privacy: PrivacyPage,
  terms: TermsPage,
  landing: LandingPage,
  pricing: JournalPage, // Wave 0: Quarantined
  settings: SettingsPage,
  telemetry: TelemetryDashboard,
  // Legacy routes → redirect to new locations
  markets: JournalPage, // Wave 0: was CommunityPage
  social: JournalPage, // Wave 0: was CommunityPage
  insights: JournalPage,
  analytics: JournalPage,
  notes: JournalPage,
  plans: JournalPage,
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

export default function PageRouter() {
  const page = useUIStore((s) => s.page);
  const Page = PAGES[page] || JournalPage;
  const prefersReducedMotion = useReducedMotion();
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
    coach: 'Smart Insights',
    charolette: "Charolette\u2019s Light",
    discover: 'Discover',
    settings: 'Settings',
    telemetry: 'Telemetry',
    changelog: "What's New",
    privacy: 'Privacy Policy',
    terms: 'Terms of Service',
    landing: 'Landing',
    pricing: 'Pricing',
  };

  // Sprint 1: Framer Motion page transition variants
  const motionEnabled = hasMounted.current && !prefersReducedMotion;

  const pageVariants = {
    initial: motionEnabled
      ? { opacity: 0, y: 8 }
      : { opacity: 1, y: 0 },
    animate: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.25,
        ease: [0.16, 1, 0.3, 1], // Apple ease-out
      },
    },
    exit: motionEnabled
      ? {
        opacity: 0,
        transition: {
          duration: 0.15,
          ease: 'easeIn',
        },
      }
      : { opacity: 1 },
  };

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
      <AnimatePresence mode="wait">
        <motion.div
          key={page}
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
        >
          <Suspense fallback={<PageFallback />}>
            <ErrorBoundary resetKey={page}>
              <Page />
            </ErrorBoundary>
          </Suspense>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

