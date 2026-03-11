// ═══════════════════════════════════════════════════════════════════
// charEdge — Mobile Settings
//
// Mobile-native settings experience:
//   - Collapsible accordion sections (one open at a time)
//   - 44px touch targets on all inputs/buttons
//   - Full-width cards, 16px edge padding
//   - Safe area handling for notched phones
//   - Sections: Trading · Playbooks · Data · Integrations · Profile · Danger
//
// Decomposed: primitives in MobilePrimitives.jsx,
// section content in sections/*.jsx
//
// Usage:
//   <MobileSettings />
// ═══════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { C } from '../../../constants.js';
import PlaybookManager from '../../features/playbook/PlaybookManager.jsx';
// eslint-disable-next-line import/order
import { AccordionSection } from './MobilePrimitives.jsx';

// Section content components
import DangerContent from './sections/DangerContent.jsx';
import DataContent from './sections/DataContent.jsx';
import IntegrationsContent from './sections/IntegrationsContent.jsx';
import ProfileContent from './sections/ProfileContent.jsx';
import TradingContent from './sections/TradingContent.jsx';

// ─── Section Definitions ────────────────────────────────────────

const SECTIONS = [
  { id: 'trading', label: 'Trading Setup', icon: '⚙️' },
  { id: 'playbooks', label: 'Playbooks', icon: '📚' },
  { id: 'data', label: 'Data', icon: '📁' },
  { id: 'integrations', label: 'Integrations', icon: '🔌' },
  { id: 'profile', label: 'Profile', icon: '👤' },
  { id: 'danger', label: 'Danger Zone', icon: '⚠️' },
];

// ─── Section Content Map ────────────────────────────────────────

const SECTION_CONTENT = {
  trading: TradingContent,
  playbooks: () => <PlaybookManager />,
  data: DataContent,
  integrations: IntegrationsContent,
  profile: ProfileContent,
  danger: DangerContent,
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
