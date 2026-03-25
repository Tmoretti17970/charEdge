// ═══════════════════════════════════════════════════════════════════
// charEdge v10.2 — Swipe Chart Navigation
// Sprint 6 C6.4: Swipe left/right to navigate between watchlist symbols.
//
// Renders subtle edge indicators during swipe and shows the
// next/prev symbol name. Triggers symbol change on release
// if swipe exceeds threshold.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useRef, useCallback } from 'react';
import { C, M } from '../../../constants.js';

const SWIPE_THRESHOLD = 80; // px to trigger navigation
const SWIPE_DEAD_ZONE = 20; // px before considering a swipe

/**
 * @param {string[]} watchlist - Array of symbols to navigate between
 * @param {string} currentSymbol - Currently displayed symbol
 * @param {Function} onSymbolChange - Callback to change symbol
 * @param {React.ReactNode} children - Chart content to wrap
 */
export default function SwipeChartNav({ watchlist = [], currentSymbol, onSymbolChange, children }) {
  const [swipeX, setSwipeX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const touchRef = useRef({ startX: 0, startY: 0, locked: false, direction: null });
  const containerRef = useRef(null);

  const currentIdx = watchlist.indexOf(currentSymbol);
  const prevSymbol = currentIdx > 0 ? watchlist[currentIdx - 1] : null;
  const nextSymbol = currentIdx < watchlist.length - 1 ? watchlist[currentIdx + 1] : null;

  const handleTouchStart = useCallback((e) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    touchRef.current = {
      startX: t.clientX,
      startY: t.clientY,
      locked: false,
      direction: null,
    };
  }, []);

  const handleTouchMove = useCallback(
    (e) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      const state = touchRef.current;
      const dx = t.clientX - state.startX;
      const dy = t.clientY - state.startY;

      // Lock direction on first significant move
      if (!state.locked && (Math.abs(dx) > SWIPE_DEAD_ZONE || Math.abs(dy) > SWIPE_DEAD_ZONE)) {
        state.locked = true;
        state.direction = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
      }

      // Only handle horizontal swipes, only from edge zones (first/last 60px)
      if (state.direction !== 'horizontal') return;

      // Check if swipe started from edge
      const containerW = containerRef.current?.offsetWidth || window.innerWidth;
      const fromLeftEdge = state.startX < 60;
      const fromRightEdge = state.startX > containerW - 60;

      if (!fromLeftEdge && !fromRightEdge) return;

      // Only allow swipe if there's a symbol to navigate to
      if (dx > 0 && !prevSymbol) return;
      if (dx < 0 && !nextSymbol) return;

      e.preventDefault();
      setSwiping(true);

      // Dampened swipe (rubber band effect past threshold)
      const clamped =
        Math.abs(dx) > SWIPE_THRESHOLD
          ? Math.sign(dx) * (SWIPE_THRESHOLD + (Math.abs(dx) - SWIPE_THRESHOLD) * 0.3)
          : dx;
      setSwipeX(clamped);
    },
    [prevSymbol, nextSymbol],
  );

  const handleTouchEnd = useCallback(() => {
    if (!swiping) return;

    if (Math.abs(swipeX) >= SWIPE_THRESHOLD) {
      // Trigger navigation
      const targetSymbol = swipeX > 0 ? prevSymbol : nextSymbol;
      if (targetSymbol) {
        // Haptic feedback
        if (navigator.vibrate) navigator.vibrate(15);
        onSymbolChange(targetSymbol);
      }
    }

    setSwiping(false);
    setSwipeX(0);
  }, [swiping, swipeX, prevSymbol, nextSymbol, onSymbolChange]);

  // Don't render if no watchlist
  if (watchlist.length < 2) return children;

  const progress = Math.min(1, Math.abs(swipeX) / SWIPE_THRESHOLD);
  const isSwipingLeft = swipeX < -SWIPE_DEAD_ZONE;
  const isSwipingRight = swipeX > SWIPE_DEAD_ZONE;

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}
    >
      {children}

      {/* Left edge indicator (swipe right → previous symbol) */}
      {swiping && isSwipingRight && prevSymbol && <EdgeIndicator side="left" symbol={prevSymbol} progress={progress} />}

      {/* Right edge indicator (swipe left → next symbol) */}
      {swiping && isSwipingLeft && nextSymbol && <EdgeIndicator side="right" symbol={nextSymbol} progress={progress} />}

      {/* Static edge hints (always visible) */}
      {/* Phase 6: Enhanced edge indicators — wider, more visible, with glow */}
      {!swiping && prevSymbol && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 5,
            height: 48,
            borderRadius: '0 4px 4px 0',
            background: `linear-gradient(90deg, ${C.b}40, ${C.b}10)`,
            boxShadow: `4px 0 12px ${C.b}15`,
          }}
        />
      )}
      {!swiping && nextSymbol && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 5,
            height: 48,
            borderRadius: '4px 0 0 4px',
            background: `linear-gradient(270deg, ${C.b}40, ${C.b}10)`,
            boxShadow: `-4px 0 12px ${C.b}15`,
          }}
        />
      )}
    </div>
  );
}

function EdgeIndicator({ side, symbol, progress }) {
  const isLeft = side === 'left';
  const ready = progress >= 1;

  return (
    <div
      style={{
        position: 'absolute',
        [side]: 0,
        top: 0,
        bottom: 0,
        width: 60 * progress + 20,
        background: `linear-gradient(${isLeft ? 'to right' : 'to left'}, ${C.b}${ready ? '30' : '15'}, transparent)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: isLeft ? 'flex-start' : 'flex-end',
        padding: '0 8px',
        transition: 'width 0.05s',
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          fontFamily: M,
          color: ready ? C.b : C.t3,
          transform: `scale(${0.8 + progress * 0.2})`,
          transition: 'color 0.15s',
          textAlign: isLeft ? 'left' : 'right',
        }}
      >
        <div style={{ fontSize: 8, fontWeight: 600, opacity: 0.7, marginBottom: 1 }}>{isLeft ? '◂' : '▸'}</div>
        {symbol}
      </div>
    </div>
  );
}

export { SwipeChartNav };
