// ═══════════════════════════════════════════════════════════════════
// charEdge — Watchlist Quick-Switch Bar
// Horizontal chip bar for instant symbol switching from watchlist.
// ═══════════════════════════════════════════════════════════════════

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { C, F } from '../../../../constants.js';
import { useWatchlistStore } from '../../../../state/useWatchlistStore.js';

/**
 * Simulated price change % — in production this would use live data.
 * Generates a stable but "random-looking" change per symbol using a hash.
 */
function getSimulatedChange(symbol) {
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    hash = ((hash << 5) - hash + symbol.charCodeAt(i)) | 0;
  }
  // Mix with minute-level time so it shifts periodically
  const minute = Math.floor(Date.now() / 60000);
  const seed = Math.abs(hash ^ minute);
  return ((seed % 1000) / 100 - 5).toFixed(2); // range -5 to +5
}

export default function WatchlistQuickBar({ currentSymbol, onSymbolChange }) {
  const items = useWatchlistStore((s) => s.items);
  const removeItem = useWatchlistStore((s) => s.remove);
  const scrollRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [changes, setChanges] = useState({});

  // Update simulated changes every 60 seconds
  useEffect(() => {
    function update() {
      const newChanges = {};
      items.forEach((item) => {
        newChanges[item.symbol] = getSimulatedChange(item.symbol);
      });
      setChanges(newChanges);
    }
    update();
    const iv = setInterval(update, 60000);
    return () => clearInterval(iv);
  }, [items]);

  // Drag-to-scroll
  const handleMouseDown = useCallback((e) => {
    setIsDragging(true);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    scrollRef.current.scrollLeft = scrollLeft - walk;
  }, [isDragging, startX, scrollLeft]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  if (!items || items.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 12px',
        borderBottom: `1px solid ${C.bd}`,
        background: `${C.bg}`,
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      <span
        style={{
          fontSize: 9,
          fontWeight: 700,
          color: C.t3,
          letterSpacing: '0.5px',
          flexShrink: 0,
          fontFamily: F,
        }}
      >
        WL
      </span>
      <div
        ref={scrollRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          display: 'flex',
          gap: 4,
          overflowX: 'auto',
          scrollBehavior: 'smooth',
          msOverflowStyle: 'none',
          scrollbarWidth: 'none',
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
          flex: 1,
        }}
      >
        {items.map((item) => {
          const sym = item.symbol;
          const isActive = sym === currentSymbol;
          const change = parseFloat(changes[sym] || 0);
          const isPositive = change >= 0;

          return (
            <button
              key={sym}
              onClick={() => onSymbolChange(sym)}
              onContextMenu={(e) => {
                e.preventDefault();
                removeItem(sym);
              }}
              title={`${sym} — Right-click to remove`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 10px',
                borderRadius: 16,
                border: `1px solid ${isActive ? C.b + '60' : C.bd}`,
                background: isActive
                  ? `${C.b}18`
                  : 'transparent',
                color: isActive ? C.b : C.t1,
                fontFamily: F,
                fontSize: 11,
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 0.15s ease',
                boxShadow: isActive ? `0 0 8px ${C.b}25` : 'none',
                whiteSpace: 'nowrap',
              }}
            >
              <span>{sym}</span>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 600,
                  fontFamily: F,
                  color: isPositive ? '#26A69A' : '#EF5350',
                  opacity: 0.9,
                }}
              >
                {isPositive ? '+' : ''}{change}%
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
