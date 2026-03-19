// ═══════════════════════════════════════════════════════════════════
// charEdge — Markets Mobile View (Sprint 52)
//
// Full-width stacked card layout for < 768px viewports.
// Features: tap-to-detail, swipe-left-to-remove, pull indicator.
// ═══════════════════════════════════════════════════════════════════

import { useState, useRef, useCallback, memo } from 'react';
import { C, F, M } from '../../../constants.js';
import useWatchlistStreaming from '../../../hooks/useWatchlistStreaming';
import { useMarketsPrefsStore } from '../../../state/useMarketsPrefsStore';
import { useWatchlistStore } from '../../../state/useWatchlistStore';
import { radii, transition } from '../../../theme/tokens.js';

// ─── Asset class colors ──────────────────────────────────────────

const ASSET_COLORS = {
  crypto: '#F7931A', stocks: '#4A90D9', futures: '#8B5CF6',
  etf: '#10B981', forex: '#06B6D4', options: '#EC4899', other: '#6B7280',
};

// ─── Mini Sparkline (inline SVG) ─────────────────────────────────

function MiniSparkline({ data, color, width = 64, height = 24 }) {
  if (!data || data.length < 2) return <div style={{ width, height }} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─── Swipeable Card ──────────────────────────────────────────────

function MobileCard({ item, liveData, onTap, onRemove, index }) {
  const [swipeX, setSwipeX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const startX = useRef(0);
  const selectedSymbol = useMarketsPrefsStore((s) => s.selectedSymbol);
  const isSelected = selectedSymbol === item.symbol;

  const price = liveData?.price ?? null;
  const change = liveData?.changePercent ?? null;
  const isUp = (change ?? 0) >= 0;
  const changeColor = change != null ? (isUp ? C.g : C.r) : C.t3;
  const assetColor = ASSET_COLORS[item.assetClass] || ASSET_COLORS.other;

  // Generate mock sparkline data from price
  const sparkData = Array.from({ length: 20 }, (_, i) =>
    (price || 100) * (1 + (Math.sin(i * 0.8 + item.symbol.charCodeAt(0)) * 0.03)),
  );

  const handleTouchStart = useCallback((e) => {
    startX.current = e.touches[0].clientX;
    setSwiping(true);
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (!swiping) return;
    const dx = e.touches[0].clientX - startX.current;
    setSwipeX(Math.min(0, Math.max(-100, dx))); // Only swipe left
  }, [swiping]);

  const handleTouchEnd = useCallback(() => {
    setSwiping(false);
    if (swipeX < -60) {
      onRemove(item.symbol);
    } else {
      setSwipeX(0);
    }
  }, [swipeX, item.symbol, onRemove]);

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: radii.lg,
        marginBottom: 8,
        animation: `markets-stagger-in 0.3s ease-out ${index * 50}ms both`,
      }}
    >
      {/* Remove backdrop */}
      <div style={{
        position: 'absolute', top: 0, right: 0, bottom: 0,
        width: 80, background: C.r,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontSize: 18, fontWeight: 700,
        borderRadius: `0 ${radii.lg} ${radii.lg} 0`,
      }}>
        🗑️
      </div>

      {/* Main card content */}
      <div
        onClick={() => { if (!swiping && swipeX === 0) onTap(item.symbol); }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          position: 'relative',
          transform: `translateX(${swipeX}px)`,
          transition: swiping ? 'none' : `transform 0.25s ease`,
          padding: '14px 16px',
          background: isSelected ? `${C.b}08` : C.bg2,
          borderLeft: `3px solid ${isSelected ? C.b : assetColor}`,
          borderRadius: radii.lg,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          cursor: 'pointer',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        {/* Symbol info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              fontSize: 14, fontWeight: 800, color: C.t1, fontFamily: F,
            }}>
              {item.symbol}
            </span>
            <span style={{
              fontSize: 8, fontWeight: 700, fontFamily: M,
              padding: '1px 5px', borderRadius: 4,
              background: `${assetColor}18`, color: assetColor,
              textTransform: 'uppercase',
            }}>
              {item.assetClass || 'other'}
            </span>
          </div>
          <div style={{
            fontSize: 10, color: C.t3, fontFamily: F,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {item.name || item.symbol}
          </div>
        </div>

        {/* Sparkline */}
        <MiniSparkline data={sparkData} color={changeColor} />

        {/* Price + Change */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 800, fontFamily: M, color: C.t1,
          }}>
            {price != null ? (price >= 1000
              ? `$${price.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
              : price >= 1
                ? `$${price.toFixed(2)}`
                : `$${price.toFixed(4)}`)
              : '—'}
          </div>
          <div style={{
            fontSize: 11, fontWeight: 700, fontFamily: M, color: changeColor,
          }}>
            {change != null ? `${isUp ? '+' : ''}${change.toFixed(2)}%` : '—'}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Bottom Sheet Detail Preview ─────────────────────────────────

function MobileDetailSheet({ symbol, onClose }) {
  const items = useWatchlistStore((s) => s.items);
  const item = items.find((i) => i.symbol === symbol);
  const { prices } = useWatchlistStreaming(symbol ? [symbol] : [], !!symbol);
  const liveData = symbol ? prices[symbol] : null;

  if (!symbol || !item) return null;

  const price = liveData?.price ?? null;
  const change = liveData?.changePercent ?? null;
  const isUp = (change ?? 0) >= 0;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 1100,
          background: 'rgba(0,0,0,0.5)',
          animation: 'fadeIn 0.2s ease-out',
        }}
      />
      {/* Sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        zIndex: 1200,
        background: C.bg,
        borderTop: `1px solid ${C.bd}`,
        borderRadius: `${radii.xl} ${radii.xl} 0 0`,
        padding: '16px 20px 32px',
        animation: 'tf-slide-up 0.3s ease-out',
        maxHeight: '60vh',
        overflowY: 'auto',
      }}>
        {/* Drag handle */}
        <div style={{
          width: 36, height: 4, borderRadius: 2,
          background: C.bd, margin: '0 auto 14px',
        }} />

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', marginBottom: 16,
        }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.t1, fontFamily: F }}>
              {item.symbol}
            </div>
            <div style={{ fontSize: 11, color: C.t3, fontFamily: F }}>
              {item.name || item.symbol}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: M, color: C.t1 }}>
              {price != null ? `$${price.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : '—'}
            </div>
            <div style={{
              fontSize: 13, fontWeight: 700, fontFamily: M,
              color: change != null ? (isUp ? C.g : C.r) : C.t3,
            }}>
              {change != null ? `${isUp ? '+' : ''}${change.toFixed(2)}%` : '—'}
            </div>
          </div>
        </div>

        {/* Quick stats grid */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8, marginBottom: 16,
        }}>
          {[
            { label: 'Volume', value: liveData?.volume ? `${(liveData.volume / 1e6).toFixed(1)}M` : '—' },
            { label: 'High 24h', value: liveData?.high24h ? `$${liveData.high24h.toFixed(2)}` : '—' },
            { label: 'Low 24h', value: liveData?.low24h ? `$${liveData.low24h.toFixed(2)}` : '—' },
          ].map((stat) => (
            <div key={stat.label} style={{
              padding: '10px 8px', borderRadius: radii.md,
              background: C.bg2, textAlign: 'center',
            }}>
              <div style={{ fontSize: 9, color: C.t3, fontFamily: M, textTransform: 'uppercase', marginBottom: 2 }}>
                {stat.label}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, fontFamily: M, color: C.t1 }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          style={{
            width: '100%', padding: '12px 0',
            borderRadius: radii.md,
            background: `linear-gradient(135deg, ${C.p}, ${C.b})`,
            color: '#fff', fontSize: 13, fontWeight: 700,
            fontFamily: F, border: 'none', cursor: 'pointer',
            transition: transition.base,
          }}
        >
          View Full Details →
        </button>
      </div>
    </>
  );
}

// ─── Main Mobile View ────────────────────────────────────────────

function MarketsMobileView() {
  const items = useWatchlistStore((s) => s.items);
  const removeSymbol = useWatchlistStore((s) => s.remove);
  const setSelectedSymbol = useMarketsPrefsStore((s) => s.setSelectedSymbol);
  const [mobileDetailSymbol, setMobileDetailSymbol] = useState(null);

  const symbols = items.map((i) => i.symbol);
  const { prices } = useWatchlistStreaming(symbols, symbols.length > 0);

  const handleTap = useCallback((symbol) => {
    setMobileDetailSymbol(symbol);
    setSelectedSymbol(symbol);
  }, [setSelectedSymbol]);

  const handleRemove = useCallback((symbol) => {
    removeSymbol(symbol);
  }, [removeSymbol]);

  const handleCloseSheet = useCallback(() => {
    setMobileDetailSymbol(null);
  }, []);

  if (items.length === 0) {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 32, color: C.t3, fontFamily: F,
      }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📱</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.t1, marginBottom: 4 }}>
          No symbols yet
        </div>
        <div style={{ fontSize: 12, textAlign: 'center' }}>
          Use the search bar above to add symbols to your watchlist.
        </div>
      </div>
    );
  }

  return (
    <div style={{
      flex: 1, overflowY: 'auto', padding: '8px 12px',
      WebkitOverflowScrolling: 'touch',
    }}>
      {items.map((item, index) => (
        <MobileCard
          key={item.symbol}
          item={item}
          liveData={prices[item.symbol]}
          onTap={handleTap}
          onRemove={handleRemove}
          index={index}
        />
      ))}

      {/* Bottom safe area spacer */}
      <div style={{ height: 20 }} />

      {/* Mobile detail bottom sheet */}
      {mobileDetailSymbol && (
        <MobileDetailSheet
          symbol={mobileDetailSymbol}
          onClose={handleCloseSheet}
        />
      )}
    </div>
  );
}

export default memo(MarketsMobileView);
