// ═══════════════════════════════════════════════════════════════════
// charEdge — Markets Page (Sprints 3–9)
//
// World-class market watchlist with AI insights, live prices,
// and multi-asset support.
//
// Sprint 3: Page shell + sidebar nav
// Sprint 4: Watchlist grid with live prices, sparklines, P&L
// Sprint 5: Quick-add search bar
// Sprint 6: Column customization
// Sprint 7: Sort, filter, group toolbar
// Sprint 9: Detail panel (slide-in, linked browsing)
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef, useCallback, useLayoutEffect, Suspense } from 'react';
import AIOrb from '../app/components/design/AIOrb.jsx';
import MarketsCardView from '../app/components/markets/MarketsCardView.jsx';
import MarketsCompactView from '../app/components/markets/MarketsCompactView.jsx';
import MarketsCompareOverlay from '../app/components/markets/MarketsCompareOverlay.jsx';
import MarketsCopilotPanel from '../app/components/markets/MarketsCopilotPanel.jsx';
import MarketsGridSkeleton from '../app/components/markets/MarketsGridSkeleton.jsx';
// MarketsHeatMap moved to Intel page
import MarketsMobileView from '../app/components/markets/MarketsMobileView.jsx';
import MarketsSearchBar from '../app/components/markets/MarketsSearchBar.jsx';
import MarketsToolbar from '../app/components/markets/MarketsToolbar.jsx';
import MarketsWatchlistGrid from '../app/components/markets/MarketsWatchlistGrid.jsx';
import MarketsWatchlistTabs from '../app/components/markets/MarketsWatchlistTabs.jsx';
import SmartAlertPicker from '../app/components/markets/SmartAlertPicker.jsx';
import { Btn } from '../app/components/ui/UIKit.jsx';
import { C, F, M } from '../constants.js';
import useCopilotChat from '../hooks/useCopilotChat';
import { useMarketsKeyboard } from '../hooks/useMarketsKeyboard';
import { useChartCoreStore } from '../state/chart/useChartCoreStore';
import { useAccountStore, ACCOUNTS } from '../state/useAccountStore';
import { useMarketsPrefsStore } from '../state/useMarketsPrefsStore';
import { useUIStore } from '../state/useUIStore';
import { useWatchlistStore } from '../state/useWatchlistStore.js';
import { alpha } from '@/shared/colorUtils';

// ─── Lazy-loaded panels (breaks HMR circular dep chain) ────────
const MarketsDetailPanel = React.lazy(() => import('../app/components/markets/MarketsDetailPanel.jsx'));
const SmartFolderManager = React.lazy(() => import('../app/components/markets/SmartFolderManager.jsx'));
const MarketsScreenerPanel = React.lazy(() => import('../app/components/markets/MarketsScreenerPanel.jsx'));

const MarketsPerformancePanel = React.lazy(() => import('../app/components/markets/MarketsPerformancePanel.jsx'));

// ─── Constants ──────────────────────────────────────────────────

const ACCENT = '#6e5ce6';
const ACCENT_GLOW = '#6e5ce630';
const MOBILE_BREAKPOINT = 768;

// ─── Responsive hook ────────────────────────────────────────────
function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(
    typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false,
  );
  React.useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isMobile;
}

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

// ─── Markets Page ───────────────────────────────────────────────

function MarketsPage() {
  const setPage = useUIStore((s) => s.setPage);
  const items = useWatchlistStore((s) => s.items);
  const loaded = useWatchlistStore((s) => s.loaded);
  const addSymbol = useWatchlistStore((s) => s.add);
  const removeSymbol = useWatchlistStore((s) => s.remove);
  const hasItems = items.length > 0;
  const isLoading = !loaded;

  const selectedSymbol = useMarketsPrefsStore((s) => s.selectedSymbol);
  const viewMode = useMarketsPrefsStore((s) => s.viewMode);
  const setSelectedSymbol = useMarketsPrefsStore((s) => s.setSelectedSymbol);
  const closeDetail = useMarketsPrefsStore((s) => s.closeDetail);
  const smartFolderOpen = useMarketsPrefsStore((s) => s.smartFolderOpen);
  const setSmartFolderOpen = useMarketsPrefsStore((s) => s.setSmartFolderOpen);
  const screenerPanelOpen = useMarketsPrefsStore((s) => s.screenerPanelOpen);
  const setScreenerPanelOpen = useMarketsPrefsStore((s) => s.setScreenerPanelOpen);

  const performancePanelOpen = useMarketsPrefsStore((s) => s.performancePanelOpen);
  const setPerformancePanelOpen = useMarketsPrefsStore((s) => s.setPerformancePanelOpen);
  const panelOpen = !!selectedSymbol;

  // Copilot state
  const copilotOpen = useCopilotChat((s) => s.panelOpen);
  const toggleCopilot = useCopilotChat((s) => s.togglePanel);

  // Logbook / Import hover states
  const [logbookHover, setLogbookHover] = useState(false);
  const [importHover, setImportHover] = useState(false);

  const setChartSymbol = useChartCoreStore((s) => s.setSymbol);
  const searchRef = useRef(null);
  const isMobile = useIsMobile();

  // ─── Keyboard navigation (Sprint 50) ──────────────────────
  const onSelectRow = useCallback((symbol) => setSelectedSymbol(symbol), [setSelectedSymbol]);
  const onRemoveRow = useCallback((symbol) => removeSymbol(symbol), [removeSymbol]);
  const onDoubleClickRow = useCallback(
    (symbol) => {
      setChartSymbol(symbol);
      setPage('charts');
    },
    [setChartSymbol, setPage],
  );

  const { focusedIndex, setFocusedIndex } = useMarketsKeyboard({
    items,
    onSelect: onSelectRow,
    onRemove: onRemoveRow,
    onDoubleClick: onDoubleClickRow,
    searchRef,
    detailOpen: panelOpen,
    closeDetail,
  });

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
      {/* ─── Header Bar ────────────────────────────────────── */}
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
          <h1
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 700,
              fontFamily: F,
              color: C.t1,
            }}
          >
            Markets
          </h1>
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

          {/* Real / Demo Mode Pill */}
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
            {/* Logbook button (ghost left segment) */}
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

            {/* Import button (ghost middle segment) */}
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

            {/* Add Trade button (primary right segment) */}
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

      {/* ─── Content ───────────────────────────────────────── */}
      {isLoading ? (
        <MarketsGridSkeleton rows={8} />
      ) : hasItems ? (
        <>
          <MarketsToolbar />
          <MarketsWatchlistTabs />
          <div
            style={{
              flex: 1,
              display: 'flex',
              minHeight: 0,
              overflow: 'hidden',
            }}
          >
            {/* Grid (shrinks when panel is open) */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                minWidth: 0,
                minHeight: 0,
                transition: 'flex 0.3s ease',
              }}
            >
              {/* Sprint 17+18: Conditional view rendering */}
              {isMobile ? (
                <MarketsMobileView />
              ) : viewMode === 'cards' ? (
                <MarketsCardView />
              ) : viewMode === 'compact' ? (
                <MarketsCompactView />
              ) : (
                <MarketsWatchlistGrid focusedIndex={focusedIndex} setFocusedIndex={setFocusedIndex} />
              )}
            </div>

            {/* Comparison overlay (Sprint 20) */}
            <MarketsCompareOverlay />

            {/* Detail panel (Sprint 9) — lazy loaded */}
            {panelOpen && (
              <Suspense fallback={null}>
                <MarketsDetailPanel />
              </Suspense>
            )}

            {/* Smart Alert Picker (Sprint 22) */}
            <SmartAlertPicker />

            {/* AI Copilot Panel (Sprint 23) */}
            <MarketsCopilotPanel />

            {/* Lazy-loaded slide-over panels */}
            <Suspense fallback={null}>
              {/* Smart Folder Manager (Sprint 28) */}
              <SmartFolderManager open={smartFolderOpen} onClose={() => setSmartFolderOpen(false)} />

              {/* Screener Panel (Sprint 29) */}
              <MarketsScreenerPanel open={screenerPanelOpen} onClose={() => setScreenerPanelOpen(false)} />

              {/* Performance Analytics Panel (Sprint 31) */}
              <MarketsPerformancePanel open={performancePanelOpen} onClose={() => setPerformancePanelOpen(false)} />
            </Suspense>
          </div>
        </>
      ) : (
        <EmptyState addSymbol={addSymbol} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Empty State — shown when watchlist has 0 items
// ═══════════════════════════════════════════════════════════════════

const POPULAR = [
  { symbol: 'BTC', name: 'Bitcoin', assetClass: 'crypto' },
  { symbol: 'ETH', name: 'Ethereum', assetClass: 'crypto' },
  { symbol: 'ES', name: 'E-mini S&P 500', assetClass: 'futures' },
  { symbol: 'NQ', name: 'E-mini Nasdaq', assetClass: 'futures' },
  { symbol: 'AAPL', name: 'Apple Inc.', assetClass: 'stocks' },
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF', assetClass: 'etf' },
];

function EmptyState({ addSymbol }) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
        padding: 40,
        minHeight: 0,
      }}
    >
      {/* Orb + glow */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            position: 'absolute',
            width: 120,
            height: 120,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${ACCENT_GLOW} 0%, transparent 70%)`,
            animation: 'ai-pulse 3s ease-in-out infinite',
          }}
        />
        <AIOrb size={56} glow state="idle" />
      </div>

      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <h2
          style={{
            margin: '0 0 8px',
            fontSize: 18,
            fontWeight: 700,
            fontFamily: F,
            color: C.t1,
          }}
        >
          Your Market Intelligence Hub
        </h2>
        <p
          style={{
            margin: '0 0 20px',
            fontSize: 13,
            color: C.t2,
            lineHeight: 1.6,
            fontFamily: F,
          }}
        >
          Add symbols to see live prices, sparklines, volume, and your trading P&L — all in one view.
        </p>
      </div>

      {/* Quick-add popular symbols */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          justifyContent: 'center',
          maxWidth: 400,
        }}
      >
        {POPULAR.map((s) => (
          <button
            key={s.symbol}
            onClick={() => addSymbol(s)}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              fontFamily: M,
              background: `${ACCENT}10`,
              color: ACCENT,
              border: `1px solid ${ACCENT}25`,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = `${ACCENT}20`;
              e.currentTarget.style.borderColor = ACCENT;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = `${ACCENT}10`;
              e.currentTarget.style.borderColor = `${ACCENT}25`;
            }}
          >
            + {s.symbol}
          </button>
        ))}
      </div>

      {/* Hotkey hint */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 10,
          color: C.t3,
          fontFamily: M,
          marginTop: 8,
        }}
      >
        <span style={{ background: `${C.bd}80`, borderRadius: 4, padding: '2px 6px', fontWeight: 600 }}>1</span> Home
        <span style={{ margin: '0 4px', opacity: 0.3 }}>·</span>
        <span style={{ background: `${C.bd}80`, borderRadius: 4, padding: '2px 6px', fontWeight: 600 }}>2</span> Charts
        <span style={{ margin: '0 4px', opacity: 0.3 }}>·</span>
        <span style={{ background: ACCENT_GLOW, color: ACCENT, borderRadius: 4, padding: '2px 6px', fontWeight: 700 }}>
          3
        </span>
        <span style={{ color: ACCENT, fontWeight: 600 }}>Markets</span>
      </div>
    </div>
  );
}

export { MarketsPage };
export default React.memo(MarketsPage);
