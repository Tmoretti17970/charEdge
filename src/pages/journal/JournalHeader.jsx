import { useState, useRef, useCallback, useLayoutEffect } from 'react';
import AIOrb from '../../app/components/design/AIOrb.jsx';
import Coachmark from '../../app/components/ui/Coachmark.jsx';
import { Btn } from '../../app/components/ui/UIKit.jsx';
import { C, F } from '../../constants.js';
import useCopilotChat from '../../hooks/useCopilotChat';
import { alpha } from '@/shared/colorUtils';
import { useAccountStore, ACCOUNTS } from '@/state/useAccountStore';
import { useUIStore } from '@/state/useUIStore';

// ─── ModePill — Apple-style Segmented Toggle (Real / Demo) ─────
// Compact pill, always visible in header. Spring-physics slider,
// colour-coded dot + text so the active mode is unmistakable.

function ModePill() {
  const activeAccountId = useAccountStore((s) => s.activeAccountId);
  const switchAccount = useAccountStore((s) => s.switchAccount);
  const activeAccount = ACCOUNTS.find((a) => a.id === activeAccountId) || ACCOUNTS[0];

  const containerRef = useRef(null);
  const optionRefs = useRef({});
  const [sliderStyle, setSliderStyle] = useState({ left: 0, width: 0, ready: false });

  const updateSlider = useCallback(() => {
    const container = containerRef.current;
    const activeEl = optionRefs.current[activeAccountId];
    if (!container || !activeEl) return;
    const cRect = container.getBoundingClientRect();
    const aRect = activeEl.getBoundingClientRect();
    setSliderStyle({ left: aRect.left - cRect.left, width: aRect.width, ready: true });
  }, [activeAccountId]);

  useLayoutEffect(() => {
    updateSlider();
  }, [updateSlider]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 20,
        padding: 3,
        gap: 2,
        background: C.sf2,
        border: `1px solid ${C.bd}`,
        height: 32,
        flexShrink: 0,
      }}
    >
      {/* Animated slider */}
      {sliderStyle.ready && (
        <div
          style={{
            position: 'absolute',
            top: 3,
            height: 'calc(100% - 6px)',
            borderRadius: 16,
            left: sliderStyle.left,
            width: sliderStyle.width,
            background: alpha(activeAccount.color, 0.15),
            boxShadow: `0 0 8px ${alpha(activeAccount.color, 0.1)}, inset 0 1px 0 ${alpha(activeAccount.color, 0.08)}`,
            transition:
              'left 0.28s cubic-bezier(0.34, 1.56, 0.64, 1), width 0.28s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.3s ease',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
      )}

      {ACCOUNTS.map((account) => {
        const isActive = activeAccountId === account.id;
        return (
          <button
            key={account.id}
            ref={(el) => {
              optionRefs.current[account.id] = el;
            }}
            onClick={() => switchAccount(account.id)}
            aria-label={`Switch to ${account.label} account`}
            aria-pressed={isActive}
            style={{
              position: 'relative',
              zIndex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              padding: '2px 10px',
              borderRadius: 16,
              fontSize: 11,
              fontWeight: isActive ? 700 : 500,
              fontFamily: F,
              color: isActive ? account.color : C.t3,
              whiteSpace: 'nowrap',
              transition: 'color 0.2s ease',
              lineHeight: 1,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: account.color,
                flexShrink: 0,
                opacity: isActive ? 1 : 0.35,
                transition: 'opacity 0.2s ease',
              }}
            />
            {account.label}
          </button>
        );
      })}
    </div>
  );
}

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
  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowRef = useRef(null);
  const _setPage = useUIStore((s) => s.setPage);

  // Close overflow menu on outside click
  const handleClickOutside = useCallback((e) => {
    if (overflowRef.current && !overflowRef.current.contains(e.target)) {
      setOverflowOpen(false);
    }
  }, []);

  // Attach/detach listener
  useState(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  });

  // ─── Copilot (Sprint 4: use global store) ─────────────────────
  const copilotOpen = useCopilotChat((s) => s.panelOpen);
  const toggleCopilot = useCopilotChat((s) => s.togglePanel);

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
        </div>

        {/* ─── Right side: Mode Toggle + Logbook | + Add Trade ─── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* ─── Real / Demo Mode Pill ──────────────── */}
          <ModePill />

          {/* ─── Primary CTA + Overflow Menu ──── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Add Trade — primary action */}
            <Btn
              onClick={openAddTrade}
              id="tf-add-trade-btn"
              style={{
                fontSize: 13,
                padding: '8px 18px',
                fontWeight: 700,
                borderRadius: 12,
              }}
            >
              + Add Trade
            </Btn>

            {/* Overflow menu — Logbook + Import */}
            <div ref={overflowRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setOverflowOpen((v) => !v)}
                className="tf-btn"
                aria-label="More actions"
                aria-expanded={overflowOpen}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  border: `1px solid ${C.bd}`,
                  background: overflowOpen ? C.sf2 : 'transparent',
                  color: C.t2,
                  fontSize: 16,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                ⋯
              </button>
              {overflowOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: 6,
                    minWidth: 160,
                    background: C.sf,
                    border: `1px solid ${C.bd}`,
                    borderRadius: 10,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                    padding: 4,
                    zIndex: 100,
                    animation: 'fadeIn 0.12s ease',
                  }}
                >
                  <button
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('charEdge:open-logbook'));
                      setOverflowOpen(false);
                    }}
                    id="tf-logbook-btn"
                    aria-label="Open trade logbook"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: 13,
                      fontWeight: 500,
                      fontFamily: F,
                      border: 'none',
                      borderRadius: 8,
                      background: 'transparent',
                      color: C.t1,
                      cursor: 'pointer',
                      transition: 'background 0.12s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = C.sf2; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{ fontSize: 14 }}>📓</span>
                    Logbook
                  </button>
                  <button
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('charEdge:open-import'));
                      setOverflowOpen(false);
                    }}
                    id="tf-import-btn"
                    aria-label="Open import hub"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: 13,
                      fontWeight: 500,
                      fontFamily: F,
                      border: 'none',
                      borderRadius: 8,
                      background: 'transparent',
                      color: C.t1,
                      cursor: 'pointer',
                      transition: 'background 0.12s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = C.sf2; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{ fontSize: 14 }}>📥</span>
                    Import
                  </button>
                </div>
              )}
            </div>
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
