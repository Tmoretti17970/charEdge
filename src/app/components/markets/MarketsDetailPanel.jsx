// ═══════════════════════════════════════════════════════════════════
// charEdge — Markets Detail Panel (Sprint 9)
//
// Bloomberg-style right-side slide-in panel (40% width) showing
// deep analysis for the selected ticker. Linked browsing — clicking
// different grid rows updates the panel without closing.
//
// Sections (slots for Sprint 10–13):
//   • Mini chart (Sprint 10)
//   • Technical snapshot (Sprint 11)
//   • Ticker news feed (Sprint 12)
//   • AI narrative insight (Sprint 13)
//
// Keyboard: Escape closes
// Animation: 300ms slide-in with spring-like easing
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useRef, memo, useMemo } from 'react';
import { C, F, M } from '../../../constants.js';
import { useWatchlistStore } from '../../../state/useWatchlistStore.js';
import { useMarketsPrefsStore } from '../../../state/useMarketsPrefsStore';
import useWatchlistStreaming from '../../../hooks/useWatchlistStreaming.js';
import { radii, transition } from '../../../theme/tokens.js';
import MiniChart from './MiniChart.jsx';
import TechnicalSnapshot from './TechnicalSnapshot.jsx';
import TickerNewsFeed from './TickerNewsFeed.jsx';
import AITickerNarrative from './AITickerNarrative.jsx';
import { detectPeers } from '../../../charting_library/ai/PeerGroupEngine.js';
import WeekRangeBar from './WeekRangeBar.jsx';
import TradingActivityInsights from './TradingActivityInsights.jsx';
import VolumeProfileBar from './VolumeProfileBar.jsx';
import TickerNotes from './TickerNotes.jsx';
import { usePriceTracker } from '../../../state/usePriceTracker';

// ─── Asset class colors (shared with grid) ─────────────────────

const ASSET_COLORS = {
  crypto: '#F7931A',
  stocks: '#4A90D9',
  futures: '#8B5CF6',
  etf: '#10B981',
  forex: '#06B6D4',
  options: '#EC4899',
  other: '#6B7280',
};

const ACCENT = '#6e5ce6';

// ─── Format helpers ────────────────────────────────────────────

function fmtPrice(val) {
  if (val == null || isNaN(val)) return '—';
  if (val >= 1000) return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (val >= 1) return `$${val.toFixed(2)}`;
  return `$${val.toFixed(4)}`;
}

function fmtChange(val) {
  if (val == null || isNaN(val)) return '—';
  const sign = val >= 0 ? '+' : '';
  return `${sign}${val.toFixed(2)}%`;
}

// ═══════════════════════════════════════════════════════════════════
// MarketsDetailPanel — Main Component
// ═══════════════════════════════════════════════════════════════════

function MarketsDetailPanel() {
  const selectedSymbol = useMarketsPrefsStore((s) => s.selectedSymbol);
  const closeDetail = useMarketsPrefsStore((s) => s.closeDetail);
  const items = useWatchlistStore((s) => s.items);

  const panelRef = useRef(null);

  // Find item data for the selected symbol
  const item = items.find((i) => i.symbol === selectedSymbol);

  // Live prices for the selected symbol
  const symbolArr = selectedSymbol ? [selectedSymbol] : [];
  const { prices } = useWatchlistStreaming(symbolArr, symbolArr.length > 0);
  const liveData = selectedSymbol ? prices[selectedSymbol] : null;

  const livePrice = liveData?.price ?? null;
  const changePercent = liveData?.changePercent ?? null;
  const volume = liveData?.volume ?? null;

  // ─── Keyboard: Escape closes ─────────────────────────────
  useEffect(() => {
    if (!selectedSymbol) return;
    const handler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeDetail();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedSymbol, closeDetail]);

  // Close when symbol is removed from watchlist
  useEffect(() => {
    if (selectedSymbol && !items.find((i) => i.symbol === selectedSymbol)) {
      closeDetail();
    }
  }, [selectedSymbol, items, closeDetail]);

  if (!selectedSymbol || !item) return null;

  const assetColor = ASSET_COLORS[item.assetClass] || ASSET_COLORS.other;
  const isPositive = (changePercent ?? 0) >= 0;
  const changeColor = changePercent != null ? (isPositive ? C.g : C.r) : C.t3;

  return (
    <div
      ref={panelRef}
      style={{
        width: '40%',
        minWidth: 400,
        maxWidth: 580,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: C.bg,
        borderLeft: `1px solid ${C.bd}`,
        boxShadow: `-8px 0 32px ${C.bd}20`,
        animation: 'detail-slide-in 0.3s cubic-bezier(0.2, 0.9, 0.3, 1)',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {/* ─── Header ───────────────────────────────────────── */}
      <div
        style={{
          padding: '16px 20px 14px',
          borderBottom: `1px solid ${C.bd}`,
          flexShrink: 0,
        }}
      >
        {/* Top row: symbol + close */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: assetColor,
                  boxShadow: `0 0 8px ${assetColor}60`,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  fontFamily: M,
                  color: C.t1,
                  letterSpacing: '-0.01em',
                }}
              >
                {item.symbol}
              </span>
              {item.assetClass && item.assetClass !== 'other' && (
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    color: assetColor,
                    background: `${assetColor}12`,
                    padding: '2px 6px',
                    borderRadius: radii.xs,
                    letterSpacing: '0.04em',
                    fontFamily: M,
                  }}
                >
                  {item.assetClass}
                </span>
              )}
            </div>
            {item.name && item.name !== item.symbol && (
              <div
                style={{
                  fontSize: 12,
                  color: C.t2,
                  fontFamily: F,
                  marginTop: 3,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.name}
              </div>
            )}
          </div>

          {/* Close button */}
          <button
            onClick={closeDetail}
            style={{
              background: `${C.bd}20`,
              border: 'none',
              borderRadius: radii.sm,
              color: C.t2,
              fontSize: 14,
              fontWeight: 600,
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: `all ${transition.fast}`,
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = `${C.bd}40`;
              e.currentTarget.style.color = C.t1;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = `${C.bd}20`;
              e.currentTarget.style.color = C.t2;
            }}
            title="Close (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Price row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 10,
            marginTop: 12,
          }}
        >
          <span
            style={{
              fontSize: 26,
              fontWeight: 800,
              fontFamily: M,
              color: C.t1,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-0.02em',
            }}
          >
            {fmtPrice(livePrice)}
          </span>
          {changePercent != null && (
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                fontFamily: M,
                color: changeColor,
                fontVariantNumeric: 'tabular-nums',
                padding: '2px 8px',
                borderRadius: radii.xs,
                background: `${changeColor}10`,
              }}
            >
              {fmtChange(changePercent)}
            </span>
          )}
          {volume != null && (
            <span
              style={{
                fontSize: 11,
                color: C.t3,
                fontFamily: M,
              }}
            >
              Vol {volume >= 1_000_000 ? `${(volume / 1_000_000).toFixed(1)}M` : volume >= 1_000 ? `${(volume / 1_000).toFixed(1)}K` : volume.toFixed(0)}
            </span>
          )}
        </div>
      </div>

      {/* ─── Body — scrollable section slots ──────────────── */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '0 0 20px',
        }}
      >
        {/* Sprint 10: Mini Chart */}
        <DetailSection title="Chart" icon="📈">
          <MiniChart symbol={selectedSymbol} />
        </DetailSection>

        {/* Sprint 11: Technical Snapshot */}
        <DetailSection title="Technicals" icon="📊">
          <TechnicalSnapshot symbol={selectedSymbol} />
        </DetailSection>

        {/* Sprint 13: AI Narrative */}
        <DetailSection title="AI Insight" icon="🧠">
          <AITickerNarrative symbol={selectedSymbol} />
        </DetailSection>

        {/* Sprint 12: Ticker News Feed */}
        <DetailSection title="News" icon="📰">
          <TickerNewsFeed symbol={selectedSymbol} assetClass={item.assetClass} />
        </DetailSection>

        {/* Sprint 21: Similar Assets */}
        <SimilarAssets symbol={selectedSymbol} items={items} />

        {/* Sprint 34: 52-Week Range */}
        <DetailSection title="52-Week Range" icon="📏">
          <WeekRangeBar
            low52w={(() => { const s = usePriceTracker.getState().getStats(selectedSymbol); return s?.low52w; })()}
            high52w={(() => { const s = usePriceTracker.getState().getStats(selectedSymbol); return s?.high52w; })()}
            currentPrice={livePrice}
            expanded
          />
        </DetailSection>

        {/* Sprint 36: Volume Profile */}
        <DetailSection title="Volume Profile" icon="📊">
          <VolumeProfileBar
            currentVolume={volume}
            avgVolume={volume ? volume * 0.8 : null}
            expanded
          />
        </DetailSection>

        {/* Sprint 35: Trading Activity */}
        <DetailSection title="Your Trading Activity" icon="📈">
          <TradingActivityInsights symbol={selectedSymbol} />
        </DetailSection>

        {/* Sprint 37: Notes */}
        <DetailSection title="Notes" icon="📝">
          <TickerNotes symbol={selectedSymbol} />
        </DetailSection>

        {/* Quick actions */}
        <div
          style={{
            padding: '16px 20px',
            display: 'flex',
            gap: 8,
          }}
        >
          <ActionButton label="Open Chart" onClick={() => {
            // Will wire to setChartSymbol + setPage('charts') in Sprint 10
          }} />
          <ActionButton label="Set Alert" variant="secondary" onClick={() => {}} />
        </div>
      </div>

      {/* ─── Slide-in animation keyframe ──────────────────── */}
      <style>{`
        @keyframes detail-slide-in {
          from { transform: translateX(100%); opacity: 0.5; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// DetailSection — Collapsible section wrapper
// ═══════════════════════════════════════════════════════════════════

function DetailSection({ title, icon, children }) {
  return (
    <div
      style={{
        borderBottom: `1px solid ${C.bd}15`,
      }}
    >
      <div
        style={{
          padding: '12px 20px 6px',
          fontSize: 10,
          fontWeight: 700,
          fontFamily: M,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: C.t3,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span style={{ fontSize: 12 }}>{icon}</span>
        {title}
      </div>
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ActionButton — Quick action buttons in the panel footer
// ═══════════════════════════════════════════════════════════════════

function ActionButton({ label, onClick, variant = 'primary' }) {
  const isPrimary = variant === 'primary';
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: '8px 12px',
        borderRadius: radii.sm,
        fontSize: 11,
        fontWeight: 700,
        fontFamily: M,
        cursor: 'pointer',
        transition: `all ${transition.fast}`,
        border: isPrimary ? 'none' : `1px solid ${C.bd}`,
        background: isPrimary ? ACCENT : 'transparent',
        color: isPrimary ? '#fff' : C.t2,
      }}
      onMouseEnter={(e) => {
        if (isPrimary) {
          e.currentTarget.style.filter = 'brightness(1.15)';
        } else {
          e.currentTarget.style.background = `${C.bd}15`;
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.filter = '';
        e.currentTarget.style.background = isPrimary ? ACCENT : 'transparent';
      }}
    >
      {label}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SimilarAssets — Peer group section (Sprint 21)
// ═══════════════════════════════════════════════════════════════════

function SimilarAssets({ symbol, items }) {
  const setSelectedSymbol = useMarketsPrefsStore((s) => s.setSelectedSymbol);
  const addCompareSymbol = useMarketsPrefsStore((s) => s.addCompareSymbol);

  const peers = useMemo(() => {
    if (!symbol || !items?.length) return [];
    return detectPeers(symbol, items, 5);
  }, [symbol, items]);

  if (peers.length === 0) return null;

  return (
    <DetailSection title="Similar Assets" icon="🔗">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {peers.map((peer) => (
          <div
            key={peer.symbol}
            onClick={() => setSelectedSymbol(peer.symbol)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 8px', borderRadius: 6,
              cursor: 'pointer',
              transition: `background ${transition.fast}`,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = `${C.bd}15`; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, fontFamily: F, color: C.t1 }}>
                {peer.symbol.replace('USDT', '')}
              </div>
              <div style={{ fontSize: 9, fontFamily: M, color: C.t3 }}>
                {(peer.similarity * 100).toFixed(0)}% similar
              </div>
            </div>
            <span style={{
              fontSize: 10, fontWeight: 700, fontFamily: M,
              color: (peer.change ?? 0) >= 0 ? C.g : C.r,
            }}>
              {(peer.change ?? 0) >= 0 ? '+' : ''}{(peer.change ?? 0).toFixed(2)}%
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                addCompareSymbol(symbol);
                addCompareSymbol(peer.symbol);
              }}
              title="Compare"
              style={{
                background: 'transparent', border: `1px solid ${C.bd}30`,
                borderRadius: 4, fontSize: 8, fontFamily: M,
                color: C.t3, cursor: 'pointer', padding: '2px 6px',
              }}
            >
              ⟷
            </button>
          </div>
        ))}
      </div>
    </DetailSection>
  );
}

export { MarketsDetailPanel };
export default memo(MarketsDetailPanel);
