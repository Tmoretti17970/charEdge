// ═══════════════════════════════════════════════════════════════════
// charEdge — Chart Focus Mode (Sprint 15)
// Double-click chart → distraction-free fullscreen.
// Hides toolbar, sidebar, all panels. Escape exits.
// Mouse-to-top-edge reveals floating info bar.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';

function FocusMode({ isActive, onExit, symbol, timeframe, lastPrice }) {
  const [showOverlay, setShowOverlay] = useState(false);
  const hideTimer = useRef(null);

  // When focus mode is active, show the overlay briefly then hide
  useEffect(() => {
    if (!isActive) return;
    setShowOverlay(true);
    hideTimer.current = setTimeout(() => setShowOverlay(false), 2500);
    return () => clearTimeout(hideTimer.current);
  }, [isActive]);

  // Mouse-to-top-edge reveals overlay
  const handleMouseMove = useCallback((e) => {
    if (!isActive) return;
    if (e.clientY < 48) {
      setShowOverlay(true);
      clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setShowOverlay(false), 2500);
    }
  }, [isActive]);

  useEffect(() => {
    if (!isActive) return;
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isActive, handleMouseMove]);

  // Escape key exits focus mode
  useEffect(() => {
    if (!isActive) return;
    const handler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onExit();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [isActive, onExit]);

  if (!isActive) return null;

  return (
    <div
      className="tf-focus-overlay"
      data-visible={showOverlay || undefined}
    >
      <span className="tf-focus-overlay-sym">{symbol}</span>
      <span className="tf-focus-overlay-tf">{timeframe}</span>
      {lastPrice != null && (
        <span className="tf-focus-overlay-price">
          {typeof lastPrice === 'number' ? lastPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : lastPrice}
        </span>
      )}
      <span className="tf-focus-overlay-exit">ESC to exit</span>
    </div>
  );
}

export default React.memo(FocusMode);
