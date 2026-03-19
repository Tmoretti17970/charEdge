// ═══════════════════════════════════════════════════════════════════
// charEdge — Settings Page (Sprint 1: Navigation Overhaul)
//
// Apple/Notion-style sidebar + content pane layout.
// 6 focused pages replace the old 10-section accordion:
//   1. Account — Profile, identity, security, gamification
//   2. App     — Appearance, density, feature lab
//   3. AI      — Engine, personality, context sources
//   4. Alerts  — Notifications, DND, per-category controls
//   5. Data    — Import, export, backup
//   6. Privacy — API keys, consent, data rights, danger zone
//
// Each page lazy-loads its content for performance.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, Suspense, useCallback, useMemo, useRef } from 'react';
import MobileSettings from '../app/components/mobile/MobileSettings.jsx';
import { searchSettings } from '../app/components/settings/settingsSearchIndex.js';
import TFIcon from '../app/components/ui/TFIcon.jsx';
import { C, F, M } from '../constants.js';
import { useUserStore } from '../state/useUserStore';
import { radii, transition } from '../theme/tokens.js';
import { useBreakpoints } from '@/hooks/useMediaQuery';

// ─── Lazy-loaded Section Components ─────────────────────────────

// Account page (Profile + Achievements merged)
const ProfileSection = React.lazy(() => import('../app/components/settings/ProfileSection.jsx'));
const SecuritySection = React.lazy(() => import('../app/components/settings/SecuritySection.jsx'));
const AchievementsSection = React.lazy(() => import('../app/components/settings/AchievementsSection.jsx'));

// App page (Appearance + Feature Lab)
const AppearanceSection = React.lazy(() => import('../app/components/settings/AppearanceSection.jsx'));
const FeatureLabPanel = React.lazy(() => import('../app/components/settings/FeatureLabPanel.jsx'));

// AI page
const IntelligenceSection = React.lazy(() => import('../app/components/settings/IntelligenceSection.jsx'));

// Alerts page
const NotificationsSection = React.lazy(() => import('../app/components/settings/NotificationsSection.jsx'));

// Data page
const DataSection = React.lazy(() => import('../app/components/settings/DataSection.jsx'));

const ApiKeySettings = React.lazy(() => import('../app/components/settings/ApiKeySettings.jsx'));
const PrivacyAIControls = React.lazy(() => import('../app/components/settings/PrivacyAIControls.jsx'));
const DataPrivacySection = React.lazy(() => import('../app/components/settings/DataPrivacySection.jsx'));
const DangerZoneSection = React.lazy(() => import('../app/components/settings/DangerZoneSection.jsx'));
const RecentlyChanged = React.lazy(() => import('../app/components/settings/RecentlyChanged.jsx'));

// ─── Page Definitions ───────────────────────────────────────────

const PAGES = [
  { id: 'account', label: 'Account', icon: 'user',   hint: 'Profile, identity & progress' },
  { id: 'app',     label: 'App',     icon: 'palette', hint: 'Theme, density & display' },
  { id: 'ai',      label: 'AI',      icon: 'brain',   hint: 'Engine, personality & context' },
  { id: 'alerts',  label: 'Alerts',  icon: 'bell',    hint: 'Notifications & DND' },
  { id: 'data',    label: 'Data',    icon: 'folder',  hint: 'Import, export & backup' },
  { id: 'privacy', label: 'Privacy & Security', icon: 'shield', hint: 'Keys, consent & data rights' },
];

// ─── Search Keywords (page-level fallback for sidebar filtering) ─

const SEARCH_KEYWORDS = {
  account: 'avatar name community identity display profile username bio gamification xp level badge streak quest trader card',
  app: 'density layout spacing font size theme dark light appearance accent color chart candle simple mode feature lab',
  ai: 'ai model copilot intelligence webllm tone personality context cloud gemini groq engine brain memory coaching dna',
  alerts: 'notification alert push email sound mute dnd quiet pause price',
  data: 'import export csv json report backup download sync cloud',
  privacy: 'api key broker polygon alpha vantage privacy gdpr consent analytics delete data reset danger',
};

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

export default function SettingsPage({ searchFilter = '' }) {
  const { isMobile } = useBreakpoints();
  if (isMobile) return <MobileSettings />;
  return <DesktopSettings searchFilter={searchFilter} />;
}

// ─── Loading Fallback ───────────────────────────────────────────

function PageLoader() {
  return (
    <div style={{
      padding: 40,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      color: C.t3,
      minHeight: 200,
    }}>
      <div style={{
        width: 24, height: 24, borderRadius: '50%',
        border: `2px solid ${C.bd}`, borderTopColor: C.b,
        animation: 'spin 0.8s linear infinite',
      }} />
      <span style={{ fontSize: 12, fontFamily: F }}>Loading…</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}

// ─── Desktop Settings (Sidebar + Content Pane) ──────────────────

function DesktopSettings({ searchFilter = '' }) {
  const [activePage, setActivePage] = useState('account');
  const simpleMode = useUserStore((s) => s.simpleMode);
  const contentRef = useRef(null);

  // Deep search results from index
  const searchResults = useMemo(() => searchSettings(searchFilter), [searchFilter]);

  // Filter pages based on search
  const filteredPages = useMemo(() => {
    if (!searchFilter.trim()) return PAGES;
    // If deep search has results, show all pages that match
    if (searchResults.length > 0) {
      const matchedPages = new Set(searchResults.map((r) => r.page));
      return PAGES.filter((p) => matchedPages.has(p.id));
    }
    const q = searchFilter.toLowerCase();
    return PAGES.filter((p) =>
      p.label.toLowerCase().includes(q) ||
      p.hint.toLowerCase().includes(q) ||
      (SEARCH_KEYWORDS[p.id] || '').includes(q)
    );
  }, [searchFilter, searchResults]);

  // Keep active page valid when filtering
  const effectiveActive = useMemo(() => {
    if (filteredPages.some((p) => p.id === activePage)) return activePage;
    return filteredPages[0]?.id || 'account';
  }, [filteredPages, activePage]);

  const handlePageSelect = useCallback((id) => {
    setActivePage(id);
  }, []);

  // Navigate to a search result — switch page + scroll to section
  const handleSearchResultClick = useCallback((result) => {
    setActivePage(result.page);
    // Scroll to section after page renders
    setTimeout(() => {
      const el = contentRef.current?.querySelector(`[data-settings-section="${result.section}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  }, []);

  // Listen for external navigation requests (e.g., Dashboard "Import Trades" CTA)
  useEffect(() => {
    const handler = () => setActivePage('data');
    window.addEventListener('tf:openSettingsImport', handler);
    return () => window.removeEventListener('tf:openSettingsImport', handler);
  }, []);

  return (
    <div style={{
      display: 'flex',
      height: '100%',
      minHeight: 0,
    }}>
      {/* ─── Sidebar ────────────────────────────────────────── */}
      <nav
        aria-label="Settings navigation"
        style={{
          width: 180,
          flexShrink: 0,
          padding: '20px 8px',
          borderRight: `1px solid ${C.bd}30`,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          overflowY: 'auto',
        }}
      >
        {filteredPages.map((page) => {
          const isActive = effectiveActive === page.id;
          return (
            <button
              key={page.id}
              onClick={() => handlePageSelect(page.id)}
              className="tf-btn"
              aria-current={isActive ? 'page' : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '10px 12px',
                border: 'none',
                borderRadius: radii.sm,
                background: isActive ? C.b + '12' : 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
                transition: `background ${transition.base}, color ${transition.base}`,
                position: 'relative',
              }}
            >
              {/* Active indicator bar */}
              {isActive && (
                <div style={{
                  position: 'absolute',
                  left: 0,
                  top: '20%',
                  bottom: '20%',
                  width: 3,
                  borderRadius: 2,
                  background: C.b,
                  transition: `all ${transition.slow}`,
                }} />
              )}
              <TFIcon
                name={page.icon}
                size={16}
                color={isActive ? C.b : C.t3}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? C.b : C.t1,
                  fontFamily: F,
                  lineHeight: 1.2,
                }}>
                  {page.label}
                </div>
                <div style={{
                  fontSize: 10,
                  color: isActive ? C.b + '90' : C.t3,
                  fontFamily: F,
                  marginTop: 1,
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {page.hint}
                </div>
              </div>
            </button>
          );
        })}

        {/* Version info at bottom */}
        <div style={{
          marginTop: 'auto',
          padding: '12px 12px 0',
          fontSize: 10,
          color: C.t3 + '60',
          fontFamily: M,
        }}>
          charEdge v11
        </div>
      </nav>

      {/* ─── Content Pane ───────────────────────────────────── */}
      <div
        ref={contentRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '20px 28px',
          minHeight: 0,
          position: 'relative',
        }}
      >
        {/* Deep Search Results Dropdown */}
        {searchResults.length > 0 && (
          <div style={{
            marginBottom: 16,
            background: C.sf,
            border: `1px solid ${C.bd}`,
            borderRadius: radii.md,
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '8px 12px',
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: C.t3,
              borderBottom: `1px solid ${C.bd}40`,
            }}>
              {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
            </div>
            {searchResults.map((r, i) => (
              <button
                key={`${r.page}-${r.section}-${r.label}`}
                onClick={() => handleSearchResultClick(r)}
                className="tf-btn"
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  border: 'none',
                  borderBottom: i < searchResults.length - 1 ? `1px solid ${C.bd}20` : 'none',
                  background: r.page === effectiveActive ? C.b + '08' : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.1s',
                }}
              >
                <span style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: C.t1,
                  fontFamily: F,
                }}>
                  {r.label}
                </span>
                <span style={{
                  fontSize: 10,
                  color: C.t3,
                  fontFamily: F,
                  marginLeft: 'auto',
                  textTransform: 'capitalize',
                }}>
                  {PAGES.find((p) => p.id === r.page)?.label || r.page}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Sprint 24: Recently Changed Pill */}
        <Suspense fallback={null}>
          <RecentlyChanged />
        </Suspense>

        <Suspense fallback={<PageLoader />}>
          <PageContent pageId={effectiveActive} simpleMode={simpleMode} />
        </Suspense>
      </div>
    </div>
  );
}

// ─── Page Content Router ────────────────────────────────────────

function PageContent({ pageId, simpleMode }) {
  switch (pageId) {
    case 'account':
      return (
        <div key="account" style={{ animation: 'settingsFadeIn 0.2s ease' }}>
          <PageHeader
            icon="user"
            title="Account"
            description="Your profile, identity, and progress"
          />
          <div data-settings-section="profile"><ProfileSection /></div>
          <div data-settings-section="security"><SecuritySection /></div>
          {!simpleMode && <div data-settings-section="achievements"><AchievementsSection /></div>}
        </div>
      );

    case 'app':
      return (
        <div key="app" style={{ animation: 'settingsFadeIn 0.2s ease' }}>
          <PageHeader
            icon="palette"
            title="App"
            description="Customize how the interface looks and feels"
          />
          <div data-settings-section="appearance"><AppearanceSection /></div>
          {!simpleMode && (
            <details style={{ marginTop: 20 }}>
              <summary style={{
                fontSize: 13,
                fontWeight: 700,
                color: C.t2,
                fontFamily: F,
                cursor: 'pointer',
                padding: '12px 0',
                borderTop: `1px solid ${C.bd}30`,
                listStyle: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <TFIcon name="flask" size={14} color={C.t3} />
                Advanced: Feature Lab
                <span style={{ fontSize: 10, color: C.t3, fontFamily: M, marginLeft: 'auto' }}>
                  Power-user features
                </span>
              </summary>
              <div style={{ padding: '12px 0' }}>
                <FeatureLabPanel />
              </div>
            </details>
          )}
        </div>
      );

    case 'ai':
      return (
        <div key="ai" style={{ animation: 'settingsFadeIn 0.2s ease' }}>
          <PageHeader
            icon="brain"
            title="AI"
            description="Configure your copilot's engine and personality"
          />
          <div data-settings-section="intelligence"><IntelligenceSection /></div>
        </div>
      );

    case 'alerts':
      return (
        <div key="alerts" style={{ animation: 'settingsFadeIn 0.2s ease' }}>
          <PageHeader
            icon="bell"
            title="Alerts"
            description="Control how and when charEdge notifies you"
          />
          <div data-settings-section="notifications"><NotificationsSection /></div>
        </div>
      );

    case 'data':
      return (
        <div key="data" style={{ animation: 'settingsFadeIn 0.2s ease' }}>
          <PageHeader
            icon="folder"
            title="Data"
            description="Import trades, export backups, and sync"
          />
          <div data-settings-section="import"><DataSection /></div>
        </div>
      );

    case 'privacy':
      return (
        <div key="privacy" style={{ animation: 'settingsFadeIn 0.2s ease' }}>
          <PageHeader
            icon="shield"
            title="Privacy & Security"
            description="API keys, data rights, and account controls"
          />
          <div data-settings-section="apikeys"><ApiKeySettings /></div>
          <div data-settings-section="consent"><PrivacyAIControls /></div>
          <div data-settings-section="consent"><DataPrivacySection /></div>
          <div data-settings-section="danger"><DangerZoneSection /></div>
        </div>
      );

    default:
      return null;
  }
}

// ─── Page Header ────────────────────────────────────────────────

function PageHeader({ icon, title, description }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 4,
      }}>
        <TFIcon name={icon} size={22} color={C.b} />
        <h2 style={{
          margin: 0,
          fontSize: 20,
          fontWeight: 800,
          fontFamily: F,
          color: C.t1,
        }}>
          {title}
        </h2>
      </div>
      {description && (
        <p style={{
          margin: 0,
          fontSize: 13,
          color: C.t3,
          fontFamily: F,
          paddingLeft: 32,
        }}>
          {description}
        </p>
      )}
      {/* Keyframes for page transitions */}
      <style>{`
        @keyframes settingsFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
