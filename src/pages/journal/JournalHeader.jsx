// ═══════════════════════════════════════════════════════════════════
// JournalHeader — App header + insight sub-tabs
// Extracted from JournalPage (Phase 0.1 decomposition)
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { C, F, M } from '../../constants.js';
import { Btn } from '../../app/components/ui/UIKit.jsx';
import Coachmark from '../../app/components/ui/Coachmark.jsx';

const INSIGHT_SUB_TABS = [
  { id: 'strategies', label: 'Strategies', icon: '🎯' },
  { id: 'psychology', label: 'Psychology', icon: '🧠' },
  { id: 'timing', label: 'Timing', icon: '⏱️' },
  { id: 'risk', label: 'Risk', icon: '🛡️' },
  { id: 'calendar', label: 'Calendar', icon: '📅' },
  { id: 'playbooks', label: 'Playbooks', icon: '📚' },
  { id: 'plans', label: 'Plans', icon: '📋' },
];

export { INSIGHT_SUB_TABS };

export default function JournalHeader({ journalTab, setJournalTab, openAddTrade, tradeCount }) {
  const showSubTabs = INSIGHT_SUB_TABS.some((s) => s.id === journalTab);

  return (
    <>
      {/* ─── Global App Header (Sprint 1: One-Action Principle) ──── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 24px',
          background: C.bg2,
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, fontFamily: F, color: C.t1, margin: 0 }}>Home</h1>
          {/* Sprint 1: Subtle hint that Import/Export live in ⌘K */}
          <span
            style={{
              fontSize: 10,
              color: C.t3,
              fontFamily: M,
              cursor: 'pointer',
              opacity: 0.6,
              transition: 'opacity 0.15s',
            }}
            onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
            onMouseEnter={(e) => (e.target.style.opacity = '1')}
            onMouseLeave={(e) => (e.target.style.opacity = '0.6')}
            title="Open Command Palette for Import, Export, and more"
          >
            ⌘K for more
          </span>
        </div>

        {/* Sprint 1: Single hero CTA — the ONE action on this screen */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Btn onClick={openAddTrade} id="tf-add-trade-btn" style={{ fontSize: 13, padding: '8px 18px', fontWeight: 700 }}>
            + Add Trade
          </Btn>

          {/* Coachmark for new users */}
          {tradeCount === 0 && (
            <Coachmark
              tipId="home_add_trade"
              targetSel="#tf-add-trade-btn"
              title="Log your first trade"
              message="Click here to record a trade. Adding context like strategy and emotions unlocks powerful insights. Use ⌘K to import trades from CSV."
              position="bottom"
              ctaLabel="Let's go →"
              onCta={openAddTrade}
              delay={1200}
            />
          )}
        </div>
      </div>

      {/* Insight Sub-tabs — only visible when an insight tab is active */}
      {showSubTabs && (
        <div
          style={{
            padding: '6px 24px 10px',
            background: C.bg2,
            borderBottom: `1px solid ${C.bd}`,
            flexShrink: 0,
            animation: 'scaleInSm 0.2s ease forwards',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              onClick={() => setJournalTab('dashboard')}
              className="tf-btn"
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                border: 'none',
                background: 'transparent',
                color: C.t3,
                fontSize: 12,
                fontWeight: 400,
                fontFamily: F,
                cursor: 'pointer',
              }}
            >
              ← Back
            </button>
            <span style={{ width: 1, height: 16, background: C.bd, margin: '0 4px' }} />
            {INSIGHT_SUB_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setJournalTab(tab.id)}
                className="tf-btn"
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: 'none',
                  background: journalTab === tab.id ? C.b + '20' : 'transparent',
                  color: journalTab === tab.id ? C.b : C.t3,
                  fontSize: 12,
                  fontWeight: journalTab === tab.id ? 600 : 400,
                  fontFamily: F,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
