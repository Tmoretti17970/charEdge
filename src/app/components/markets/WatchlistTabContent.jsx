// ═══════════════════════════════════════════════════════════════════
// charEdge — Watchlist Tab Content
//
// Extracted from MarketsPage. Contains the full personal watchlist
// experience: toolbar, folder tabs, grid/card/compact views,
// detail panel, compare overlay, copilot, screener, smart folders,
// performance analytics, and keyboard navigation.
// ═══════════════════════════════════════════════════════════════════

import React, { useCallback, useRef, Suspense } from 'react';
import { C, F, M } from '../../../constants.js';
import { useMarketsKeyboard } from '../../../hooks/useMarketsKeyboard';
import { useChartCoreStore } from '../../../state/chart/useChartCoreStore';
import { useMarketsPrefsStore } from '../../../state/useMarketsPrefsStore';
import { useUIStore } from '../../../state/useUIStore';
import { useWatchlistStore } from '../../../state/useWatchlistStore.js';
import AIOrb from '../design/AIOrb.jsx';
import MarketsCardView from './MarketsCardView.jsx';
import MarketsCompactView from './MarketsCompactView.jsx';
import MarketsCompareOverlay from './MarketsCompareOverlay.jsx';
import MarketsCopilotPanel from './MarketsCopilotPanel.jsx';
import MarketsGridSkeleton from './MarketsGridSkeleton.jsx';
import MarketsMobileView from './MarketsMobileView.jsx';
import MarketsToolbar from './MarketsToolbar.jsx';
import MarketsWatchlistGrid from './MarketsWatchlistGrid.jsx';
import MarketsWatchlistTabs from './MarketsWatchlistTabs.jsx';
import SmartAlertPicker from './SmartAlertPicker.jsx';

// ─── Lazy-loaded panels ─────────────────────────────────────────
const MarketsDetailPanel = React.lazy(() => import('./MarketsDetailPanel.jsx'));
const SmartFolderManager = React.lazy(() => import('./SmartFolderManager.jsx'));
const MarketsScreenerPanel = React.lazy(() => import('./MarketsScreenerPanel.jsx'));
const MarketsPerformancePanel = React.lazy(() => import('./MarketsPerformancePanel.jsx'));

const MOBILE_BREAKPOINT = 768;

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

const ACCENT = '#6e5ce6';
const ACCENT_GLOW = '#6e5ce630';

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
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
        <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, fontFamily: F, color: C.t1 }}>
          Your Personal Watchlist
        </h2>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: C.t2, lineHeight: 1.6, fontFamily: F }}>
          Add symbols to see live prices, sparklines, volume, and your trading P&L — all in one view.
        </p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 400 }}>
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
    </div>
  );
}

export default function WatchlistTabContent() {
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

  const setChartSymbol = useChartCoreStore((s) => s.setSymbol);
  const searchRef = useRef(null);
  const isMobile = useIsMobile();

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

  if (isLoading) return <MarketsGridSkeleton rows={8} />;

  if (!hasItems) return <EmptyState addSymbol={addSymbol} />;

  return (
    <>
      <MarketsToolbar />
      <MarketsWatchlistTabs />
      <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
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

        <MarketsCompareOverlay />

        {panelOpen && (
          <Suspense fallback={null}>
            <MarketsDetailPanel />
          </Suspense>
        )}

        <SmartAlertPicker />
        <MarketsCopilotPanel />

        <Suspense fallback={null}>
          <SmartFolderManager open={smartFolderOpen} onClose={() => setSmartFolderOpen(false)} />
          <MarketsScreenerPanel open={screenerPanelOpen} onClose={() => setScreenerPanelOpen(false)} />
          <MarketsPerformancePanel open={performancePanelOpen} onClose={() => setPerformancePanelOpen(false)} />
        </Suspense>
      </div>
    </>
  );
}
