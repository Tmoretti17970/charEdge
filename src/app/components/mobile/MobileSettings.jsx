// ═══════════════════════════════════════════════════════════════════
// charEdge — Mobile Settings
//
// Mobile-native settings experience:
//   - Collapsible accordion sections (one open at a time)
//   - 44px touch targets on all inputs/buttons
//   - Full-width cards, 16px edge padding
//   - Safe area handling for notched phones
//   - Sections: Profile · Intelligence · Data · Integrations · Danger
//
// Decomposed: primitives in MobilePrimitives.jsx,
// section content in sections/*.jsx
//
// Usage:
//   <MobileSettings />
// ═══════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { C } from '../../../constants.js';
// eslint-disable-next-line import/order
import { AccordionSection } from './MobilePrimitives.jsx';

// Section content components
import DangerContent from './sections/DangerContent.jsx';
import DataContent from './sections/DataContent.jsx';
import IntegrationsContent from './sections/IntegrationsContent.jsx';
import ProfileContent from './sections/ProfileContent.jsx';
import IntelligenceSection from '../settings/IntelligenceSection.jsx';
import AppearanceSection from '../settings/AppearanceSection.jsx';
import NotificationsSection from '../settings/NotificationsSection.jsx';

// ─── Section Definitions ────────────────────────────────────────

const SECTIONS = [
  { id: 'account',  label: 'Account',           icon: '👤' },
  { id: 'app',      label: 'App',               icon: '🎨' },
  { id: 'ai',       label: 'AI',                icon: '🧠' },
  { id: 'alerts',   label: 'Alerts',            icon: '🔔' },
  { id: 'data',     label: 'Data',              icon: '💾' },
  { id: 'privacy',  label: 'Privacy & Security', icon: '🔒' },
];

// ─── Section Content Map ────────────────────────────────────────

const SECTION_CONTENT = {
  account: ProfileContent,
  app: () => <AppearanceSection />,
  ai: () => <IntelligenceSection />,
  alerts: () => <NotificationsSection />,
  data: DataContent,
  privacy: () => (
    <>
      <IntegrationsContent />
      <DangerContent />
    </>
  ),
};

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

export default function MobileSettings() {
  const [openSection, setOpenSection] = useState('trading');

  const toggle = (id) => {
    setOpenSection((prev) => (prev === id ? null : id));
  };

  return (
    <div
      style={{
        padding: '16px 16px',
        paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        height: '100%',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: C.t1, margin: 0 }}>Settings</h1>
        <div style={{ fontSize: 13, color: C.t3, marginTop: 4 }}>Manage your trading setup and preferences</div>
      </div>

      {/* Accordion Sections */}
      {SECTIONS.map((section) => {
        const Content = SECTION_CONTENT[section.id];
        return (
          <AccordionSection
            key={section.id}
            id={section.id}
            icon={section.icon}
            label={section.label}
            isOpen={openSection === section.id}
            onToggle={() => toggle(section.id)}
            isDanger={section.id === 'danger'}
          >
            <Content />
          </AccordionSection>
        );
      })}
    </div>
  );
}
