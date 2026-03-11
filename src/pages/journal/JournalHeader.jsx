import { useState, useRef, useCallback } from 'react';
import AICopilotPopover from '../../app/components/dashboard/AICopilotPopover.jsx';
import AIOrb from '../../app/components/design/AIOrb.jsx';
import Coachmark from '../../app/components/ui/Coachmark.jsx';
import { Btn } from '../../app/components/ui/UIKit.jsx';
import { C, F } from '../../constants.js';
import useHotkeys from '@/hooks/useHotkeys';

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
  const [logbookHover, setLogbookHover] = useState(false);

  // ─── Copilot popover state ─────────────────────────────────────
  const [copilotOpen, setCopilotOpen] = useState(false);
  const pillRef = useRef(null);

  const toggleCopilot = useCallback(() => setCopilotOpen((p) => !p), []);
  const closeCopilot = useCallback(() => setCopilotOpen(false), []);

  // ⌘K / Ctrl+K → toggle copilot (via useHotkeys — no duplicate listener)
  useHotkeys(
    [{ key: 'meta+k', handler: toggleCopilot, description: 'Toggle AI Copilot' }],
    { scope: 'page' },
  );

  return (
    <>
      {/* ─── Global App Header ──────────────────────────────────── */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, fontFamily: F, color: C.t1, margin: 0 }}>Home</h1>
          <button
            ref={pillRef}
            className="tf-btn"
            id="tf-copilot-pill"
            aria-label="Open AI Copilot"
            aria-expanded={copilotOpen}
            onClick={toggleCopilot}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 30,
              padding: '0 12px 0 8px',
              borderRadius: 15,
              background: copilotOpen ? C.b + '15' : C.sf2,
              border: `1px solid ${copilotOpen ? C.b + '40' : C.bd}`,
              color: copilotOpen ? C.t1 : C.t2,
              fontSize: 11,
              fontWeight: 600,
              fontFamily: F,
              cursor: 'pointer',
              transition: 'all 0.25s cubic-bezier(0.25, 0.1, 0.25, 1)',
              boxShadow: copilotOpen ? `0 0 16px ${C.b}25` : 'none',
            }}
            onMouseEnter={(e) => {
              if (!copilotOpen) {
                e.currentTarget.style.background = C.b + '12';
                e.currentTarget.style.borderColor = C.b + '30';
                e.currentTarget.style.color = C.t1;
                e.currentTarget.style.boxShadow = `0 0 14px ${C.b}18`;
              }
            }}
            onMouseLeave={(e) => {
              if (!copilotOpen) {
                e.currentTarget.style.background = C.sf2;
                e.currentTarget.style.borderColor = C.bd;
                e.currentTarget.style.color = C.t2;
                e.currentTarget.style.boxShadow = 'none';
              }
            }}
          >
            <AIOrb size={16} glow={copilotOpen} animate={copilotOpen} />
            Copilot
          </button>

          {/* ─── Copilot Popover ──────────────────────────── */}
          {copilotOpen && (
            <AICopilotPopover anchorRef={pillRef} onClose={closeCopilot} />
          )}
        </div>

        {/* ─── Segmented CTA: Logbook | + Add Trade ──── */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div
            style={{
              display: 'flex',
              borderRadius: 12,
              overflow: 'hidden',
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            }}
          >
            {/* Logbook button (ghost left segment) */}
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('charEdge:open-logbook'))}
              onMouseEnter={() => setLogbookHover(true)}
              onMouseLeave={() => setLogbookHover(false)}
              id="tf-logbook-btn"
              aria-label="Open trade logbook"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                fontSize: 13,
                fontWeight: 600,
                fontFamily: F,
                border: `1.5px solid ${C.b}`,
                borderRight: 'none',
                borderRadius: '12px 0 0 12px',
                background: logbookHover ? C.b + '12' : 'transparent',
                color: logbookHover ? C.b : C.t2,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <span style={{ fontSize: 14, lineHeight: 1 }}>📓</span>
              Logbook
            </button>

            {/* Add Trade button (primary right segment) */}
            <Btn
              onClick={openAddTrade}
              id="tf-add-trade-btn"
              style={{
                fontSize: 13,
                padding: '8px 18px',
                fontWeight: 700,
                borderRadius: '0 12px 12px 0',
                border: `1.5px solid ${C.b}`,
                borderLeft: 'none',
              }}
            >
              + Add Trade
            </Btn>
          </div>

          {/* Coachmark for new users */}
          {tradeCount === 0 && (
            <Coachmark
              tipId="home_add_trade"
              targetSel="#tf-add-trade-btn"
              title="Log your first trade"
              message="Click 📓 Logbook to browse your trades, or + Add Trade to log a new one."
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
