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

import React, { useEffect } from 'react';
import { C, F, M } from '../constants.js';
import { useUIStore } from '../state/useUIStore';
import { useWatchlistStore } from '../state/useWatchlistStore.js';
import { useMarketsPrefsStore } from '../state/useMarketsPrefsStore';
import AIOrb from '../app/components/design/AIOrb.jsx';
import MarketsSearchBar from '../app/components/markets/MarketsSearchBar.jsx';
import MarketsWatchlistGrid from '../app/components/markets/MarketsWatchlistGrid.jsx';
import MarketsToolbar from '../app/components/markets/MarketsToolbar.jsx';
import MarketsDetailPanel from '../app/components/markets/MarketsDetailPanel.jsx';
import MarketsCardView from '../app/components/markets/MarketsCardView.jsx';
import MarketsCompactView from '../app/components/markets/MarketsCompactView.jsx';
import MarketsHeatMap from '../app/components/markets/MarketsHeatMap.jsx';
import MarketsWatchlistTabs from '../app/components/markets/MarketsWatchlistTabs.jsx';
import MarketsCompareOverlay from '../app/components/markets/MarketsCompareOverlay.jsx';
import SmartAlertPicker from '../app/components/markets/SmartAlertPicker.jsx';
import MarketsCopilotPanel from '../app/components/markets/MarketsCopilotPanel.jsx';
import SmartFolderManager from '../app/components/markets/SmartFolderManager.jsx';
import MarketsScreenerPanel from '../app/components/markets/MarketsScreenerPanel.jsx';
import WatchlistAlertCreator from '../app/components/markets/WatchlistAlertCreator.jsx';
import MarketsPerformancePanel from '../app/components/markets/MarketsPerformancePanel.jsx';

// ─── Constants ──────────────────────────────────────────────────

const ACCENT = '#6e5ce6';
const ACCENT_GLOW = '#6e5ce630';

// ─── Markets Page ───────────────────────────────────────────────

function MarketsPage() {
  const setPage = useUIStore((s) => s.setPage);
  const items = useWatchlistStore((s) => s.items);
  const addSymbol = useWatchlistStore((s) => s.add);
  const hasItems = items.length > 0;

  const selectedSymbol = useMarketsPrefsStore((s) => s.selectedSymbol);
  const viewMode = useMarketsPrefsStore((s) => s.viewMode);
  const smartFolderOpen = useMarketsPrefsStore((s) => s.smartFolderOpen);
  const setSmartFolderOpen = useMarketsPrefsStore((s) => s.setSmartFolderOpen);
  const screenerPanelOpen = useMarketsPrefsStore((s) => s.screenerPanelOpen);
  const setScreenerPanelOpen = useMarketsPrefsStore((s) => s.setScreenerPanelOpen);
  const watchlistAlertOpen = useMarketsPrefsStore((s) => s.watchlistAlertOpen);
  const setWatchlistAlertOpen = useMarketsPrefsStore((s) => s.setWatchlistAlertOpen);
  const performancePanelOpen = useMarketsPrefsStore((s) => s.performancePanelOpen);
  const setPerformancePanelOpen = useMarketsPrefsStore((s) => s.setPerformancePanelOpen);
  const panelOpen = !!selectedSymbol;

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
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 800,
              fontFamily: F,
              color: C.t1,
              letterSpacing: '-0.02em',
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
        </div>

        {/* Search bar (Sprint 5) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MarketsSearchBar />
        </div>
      </div>

      {/* ─── Content ───────────────────────────────────────── */}
      {hasItems ? (
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
              {viewMode === 'heatmap' ? (
                <MarketsHeatMap />
              ) : viewMode === 'cards' ? (
                <MarketsCardView />
              ) : viewMode === 'compact' ? (
                <MarketsCompactView />
              ) : (
                <MarketsWatchlistGrid />
              )}
            </div>

            {/* Comparison overlay (Sprint 20) */}
            <MarketsCompareOverlay />

            {/* Detail panel (Sprint 9) */}
            {panelOpen && <MarketsDetailPanel />}

            {/* Smart Alert Picker (Sprint 22) */}
            <SmartAlertPicker />

            {/* AI Copilot Panel (Sprint 23) */}
            <MarketsCopilotPanel />

            {/* Smart Folder Manager (Sprint 28) */}
            <SmartFolderManager
              open={smartFolderOpen}
              onClose={() => setSmartFolderOpen(false)}
            />

            {/* Screener Panel (Sprint 29) */}
            <MarketsScreenerPanel
              open={screenerPanelOpen}
              onClose={() => setScreenerPanelOpen(false)}
            />

            {/* Watchlist Alert Creator (Sprint 30) */}
            <WatchlistAlertCreator
              open={watchlistAlertOpen}
              onClose={() => setWatchlistAlertOpen(false)}
            />

            {/* Performance Analytics Panel (Sprint 31) */}
            <MarketsPerformancePanel
              open={performancePanelOpen}
              onClose={() => setPerformancePanelOpen(false)}
            />
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
          Add symbols to see live prices, sparklines, volume, and your
          trading P&L — all in one view.
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
        <span style={{ background: ACCENT_GLOW, color: ACCENT, borderRadius: 4, padding: '2px 6px', fontWeight: 700 }}>3</span>
        <span style={{ color: ACCENT, fontWeight: 600 }}>Markets</span>
      </div>
    </div>
  );
}

export { MarketsPage };
export default React.memo(MarketsPage);
