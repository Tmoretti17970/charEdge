// ═══════════════════════════════════════════════════════════════════
// charEdge — Markets Page (Unified)
//
// Thin shell with 3 top-level tabs: Top | Predictions | Watchlist.
// Each tab is an independent panel with its own data, layout, and
// features. No state shared between tabs except the active tab.
//
// Top: Market discovery (CoinGecko + equity rankings)
// Predictions: Full prediction markets (5 sources, 30+ components)
// Watchlist: Personal watchlist (grid, folders, copilot, screener)
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef, useCallback, useLayoutEffect, Suspense } from 'react';
import AIOrb from '../app/components/design/AIOrb.jsx';
import MarketsGridSkeleton from '../app/components/markets/MarketsGridSkeleton.jsx';
import MarketsSearchBar from '../app/components/markets/MarketsSearchBar.jsx';
import MarketsTopLevelTabs from '../app/components/markets/MarketsTopLevelTabs.jsx';
import TopTabContent from '../app/components/markets/TopTabContent.jsx';
import useMarketsURLSync from '../app/components/markets/useMarketsURLSync.js';
import WatchlistTabContent from '../app/components/markets/WatchlistTabContent.jsx';
import { Btn } from '../app/components/ui/UIKit.jsx';
import { C, F, M } from '../constants.js';
import useCopilotChat from '../hooks/useCopilotChat';
import { useAccountStore, ACCOUNTS } from '../state/useAccountStore';
import { useMarketsPrefsStore } from '../state/useMarketsPrefsStore';
import { useUIStore } from '../state/useUIStore';
import { useWatchlistStore } from '../state/useWatchlistStore.js';
import { alpha } from '@/shared/colorUtils';

// ─── Lazy-loaded Predictions tab (code-split) ──────────────────
const PredictionsTabContent = React.lazy(() => import('../app/components/markets/PredictionsTabContent.jsx'));

// ─── ModePill — Apple-style Segmented Toggle (Real / Demo) ─────
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

// ─── Markets Page (Unified Shell) ───────────────────────────────

function MarketsPage() {
  const setPage = useUIStore((s) => s.setPage);
  const activeTopTab = useMarketsPrefsStore((s) => s.activeTopTab);
  const items = useWatchlistStore((s) => s.items);

  // URL sync for tab deep-linking
  useMarketsURLSync();

  // Copilot state
  const copilotOpen = useCopilotChat((s) => s.panelOpen);
  const toggleCopilot = useCopilotChat((s) => s.togglePanel);

  // Logbook / Import hover states
  const [logbookHover, setLogbookHover] = useState(false);
  const [importHover, setImportHover] = useState(false);

  const searchRef = useRef(null);

  // ─── Global Hotkeys (page-level) ──────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case '1':
          e.preventDefault();
          setPage('journal');
          break;
        case '2':
          e.preventDefault();
          setPage('charts');
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setPage]);

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: C.bg,
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      {/* ─── Shared Header Bar ─────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px 12px',
          background: C.bg2,
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, fontFamily: F, color: C.t1 }}>Markets</h1>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              fontFamily: M,
              color: C.t3,
              background: `${C.bd}30`,
              padding: '2px 8px',
              borderRadius: 4,
            }}
          >
            {items.length}
          </span>
          <button
            className="tf-btn"
            id="tf-markets-copilot-pill"
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

        {/* Right side: Search + Mode Toggle + Logbook | + Add Trade */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <MarketsSearchBar ref={searchRef} />
          <ModePill />

          {/* Segmented CTA: Logbook | Import | + Add Trade */}
          <div
            style={{
              display: 'flex',
              borderRadius: 12,
              overflow: 'hidden',
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            }}
          >
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('charEdge:open-logbook'))}
              onMouseEnter={() => setLogbookHover(true)}
              onMouseLeave={() => setLogbookHover(false)}
              id="tf-markets-logbook-btn"
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

            <button
              onClick={() => window.dispatchEvent(new CustomEvent('charEdge:open-import'))}
              onMouseEnter={() => setImportHover(true)}
              onMouseLeave={() => setImportHover(false)}
              id="tf-markets-import-btn"
              aria-label="Open import hub"
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
                borderRadius: 0,
                background: importHover ? C.b + '12' : 'transparent',
                color: importHover ? C.b : C.t2,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <span style={{ fontSize: 14, lineHeight: 1 }}>📥</span>
              Import
            </button>

            <Btn
              onClick={() => window.dispatchEvent(new CustomEvent('charEdge:add-trade'))}
              id="tf-markets-add-trade-btn"
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
        </div>
      </div>

      {/* ─── Top-Level Tabs ────────────────────────────────── */}
      <MarketsTopLevelTabs />

      {/* ─── Tab Content ───────────────────────────────────── */}
      {activeTopTab === 'top' && <TopTabContent />}

      {activeTopTab === 'predictions' && (
        <Suspense fallback={<MarketsGridSkeleton rows={6} />}>
          <PredictionsTabContent />
        </Suspense>
      )}

      {activeTopTab === 'watchlist' && <WatchlistTabContent />}
    </div>
  );
}

export { MarketsPage };
export default React.memo(MarketsPage);
