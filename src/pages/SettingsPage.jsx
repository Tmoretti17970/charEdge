// ═══════════════════════════════════════════════════════════════════
// charEdge — Settings Page (Orchestrator)
//
// Narrative layout with section navigation:
//   1. Trading Setup — Account, risk params, chart defaults
//   2. Playbooks — Strategy management
//   3. Appearance — Density, theming
//   4. Data — Import/export, reports
//   5. Integrations — API keys, cloud sync
//   6. Profile — Community identity
//   7. Achievements — Gamification
//   8. Feature Lab — Feature flags
//   9. Danger Zone — Destructive actions
//
// Each section is in its own file under app/components/settings/.
// ═══════════════════════════════════════════════════════════════════

import { useState, useMemo } from 'react';
import { C, F } from '../constants.js';
import { radii } from '../theme/tokens.js';
import { useUserStore } from '../state/useUserStore.js';
import { Card } from '../app/components/ui/UIKit.jsx';
import TFIcon from '../app/components/ui/TFIcon.jsx';
import { useBreakpoints } from '../utils/useMediaQuery.js';
import MobileSettings from '../app/components/mobile/MobileSettings.jsx';

// Section components
import TradingSetupSection from '../app/components/settings/TradingSetupSection.jsx';
import AppearanceSection from '../app/components/settings/AppearanceSection.jsx';
import PlaybooksSection from '../app/components/settings/PlaybooksSection.jsx';
import DataSection from '../app/components/settings/DataSection.jsx';
import IntegrationsSection from '../app/components/settings/IntegrationsSection.jsx';
import ProfileSection from '../app/components/settings/ProfileSection.jsx';
import AchievementsSection from '../app/components/settings/AchievementsSection.jsx';
import DangerZoneSection from '../app/components/settings/DangerZoneSection.jsx';
import FeatureLabPanel from '../app/components/settings/FeatureLabPanel.jsx';
import DataPrivacySection from '../app/components/settings/DataPrivacySection.jsx';

// ─── Section Definitions ────────────────────────────────────────

const SECTIONS = [
  { id: 'trading', label: 'Trading Setup', icon: 'settings' },
  { id: 'playbooks', label: 'Playbooks', icon: 'book' },
  { id: 'appearance', label: 'Appearance', icon: 'palette' },
  { id: 'data', label: 'Data', icon: 'folder' },
  { id: 'integrations', label: 'Integrations', icon: 'plug' },
  { id: 'profile', label: 'Profile', icon: 'user' },
  { id: 'achievements', label: 'Achievements', icon: 'trophy' },
  { id: 'featurelab', label: 'Feature Lab', icon: 'flask' },
  { id: 'privacy', label: 'Data & Privacy', icon: 'shield' },
  { id: 'danger', label: 'Danger Zone', icon: 'warning' },
];

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

export default function SettingsPage({ searchFilter = '' }) {
  const { isMobile } = useBreakpoints();

  // Mobile gets its own dedicated component
  if (isMobile) return <MobileSettings />;

  return <DesktopSettings searchFilter={searchFilter} />;
}

// ─── Desktop Settings ───────────────────────────────────────────

// Sections hidden when Simple Mode is on
const SIMPLE_HIDDEN_SECTIONS = new Set(['featurelab', 'achievements', 'integrations']);

function DesktopSettings({ searchFilter = '' }) {
  // Sprint 8: Accordion — only one section open at a time (null = all collapsed)
  const [activeSection, setActiveSection] = useState(null);
  const simpleMode = useUserStore((s) => s.simpleMode);

  // Filter sections based on search (driven by SlideOver search bar)
  const SEARCH_KEYWORDS = {
    trading: 'account risk stop loss position size kelly chart symbol timeframe default',
    playbooks: 'strategy playbook rules template',
    appearance: 'density layout spacing comfortable compact standard font size ui',
    data: 'import export csv json report backup download',
    integrations: 'api key broker sync cloud polygon alpha vantage tradovate schwab ibkr',
    profile: 'avatar name community identity display',
    achievements: 'xp level badge rank gamification quest reward streak',
    featurelab: 'feature flag toggle unlock tier persona explorer builder architect progressive',
    privacy: 'gdpr privacy consent analytics export delete data',
    danger: 'reset delete clear data demo',
  };

  const baseSections = simpleMode
    ? SECTIONS.filter((s) => !SIMPLE_HIDDEN_SECTIONS.has(s.id))
    : SECTIONS;

  const filteredSections = searchFilter.trim()
    ? baseSections.filter((s) => {
        const q = searchFilter.toLowerCase();
        return s.label.toLowerCase().includes(q) || (SEARCH_KEYWORDS[s.id] || '').includes(q);
      })
    : baseSections;

  // When searching, auto-expand first match
  const effectiveActive = searchFilter.trim() && filteredSections.length > 0 && !activeSection
    ? filteredSections[0].id
    : activeSection;

  const toggle = (id) => setActiveSection((prev) => (prev === id ? null : id));

  // Section content mapping
  const SECTION_CONTENT = {
    trading: <TradingSetupSection />,
    playbooks: <PlaybooksSection />,
    appearance: <AppearanceSection />,
    data: <DataSection />,
    integrations: <IntegrationsSection />,
    profile: <ProfileSection />,
    achievements: <AchievementsSection />,
    featurelab: (
      <section style={{ marginBottom: 0 }}>
        <Card style={{ padding: 20 }}>
          <FeatureLabPanel />
        </Card>
      </section>
    ),
    privacy: <DataPrivacySection />,
    danger: <DangerZoneSection />,
  };

  // Section descriptions for collapsed state
  const SECTION_HINTS = {
    trading: 'Account, risk, chart defaults',
    playbooks: 'Strategy management',
    appearance: 'Density, font size, layout',
    data: 'Import, export, reports',
    integrations: 'API keys, broker sync',
    profile: 'Identity & community',
    achievements: 'XP, ranks, rewards',
    featurelab: 'Features & disclosure',
    privacy: 'GDPR, consent, export',
    danger: 'Reset & destructive',
  };

  return (
    <div
      data-container="settings"
      style={{
        padding: 24,
        maxWidth: 720,
        margin: '0 auto',
      }}
    >

      {/* Accordion Sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {filteredSections.map((s) => {
          const isOpen = effectiveActive === s.id;
          return (
            <div key={s.id} style={{ borderRadius: radii.lg, overflow: 'hidden', border: `1px solid ${isOpen ? C.b + '30' : C.bd}`, transition: 'border-color 0.25s ease' }}>
              {/* Header — always visible */}
              <button
                onClick={() => toggle(s.id)}
                className="tf-btn"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  width: '100%',
                  padding: '14px 18px',
                  border: 'none',
                  background: isOpen ? C.b + '08' : C.sf,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.2s ease',
                }}
              >
                <TFIcon name={s.icon} size="sm" color={isOpen ? C.b : C.t2} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.t1, fontFamily: F }}>{s.label}</div>
                  {!isOpen && (
                    <div style={{ fontSize: 11, color: C.t3, fontFamily: F, marginTop: 1 }}>{SECTION_HINTS[s.id]}</div>
                  )}
                </div>
                <span style={{
                  fontSize: 12,
                  color: C.t3,
                  transition: 'transform 0.25s ease',
                  transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  display: 'inline-block',
                }}>
                  ▼
                </span>
              </button>

              {/* Body — collapsible */}
              <div style={{
                maxHeight: isOpen ? 2000 : 0,
                overflow: 'hidden',
                transition: 'max-height 0.3s ease-in-out',
              }}>
                <div style={{ padding: isOpen ? '8px 18px 18px 18px' : '0 18px' }}>
                  {isOpen && SECTION_CONTENT[s.id]}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
