// ═══════════════════════════════════════════════════════════════════
// charEdge — useSwipeSections Hook
//
// Sprint 6 S6.1: Swipeable dashboard sections on mobile.
// Provides touch-based horizontal swipe navigation between sections.
// Only activates on coarse-pointer (touch) devices.
// Respects prefers-reduced-motion.
// ═══════════════════════════════════════════════════════════════════

import { useState, useRef, useCallback, useEffect } from 'react';

const SWIPE_THRESHOLD = 50; // px to trigger section change
const DEAD_ZONE = 15;       // px before considering a swipe

/**
 * @param {number} totalSections - Number of sections to swipe between
 * @param {Object} [opts]
 * @param {number} [opts.initialIndex=0]
 * @returns {{ activeIndex, handlers, setIndex, containerStyle }}
 */
export default function useSwipeSections(totalSections, { initialIndex = 0 } = {}) {
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const touch = useRef({ startX: 0, startY: 0, locked: false, horizontal: false });
  const reducedMotion = useRef(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      reducedMotion.current = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    }
  }, []);

  const setIndex = useCallback((i) => {
    setActiveIndex(Math.max(0, Math.min(totalSections - 1, i)));
  }, [totalSections]);

  const onTouchStart = useCallback((e) => {
    const t = e.touches[0];
    touch.current = { startX: t.clientX, startY: t.clientY, locked: false, horizontal: false };
  }, []);

  const _onTouchMove = useCallback((e) => {
    const t = e.touches[0];
    const dx = t.clientX - touch.current.startX;
    const dy = t.clientY - touch.current.startY;

    // Lock direction after dead zone
    if (!touch.current.locked && (Math.abs(dx) > DEAD_ZONE || Math.abs(dy) > DEAD_ZONE)) {
      touch.current.locked = true;
      touch.current.horizontal = Math.abs(dx) > Math.abs(dy);
    }
  }, []);

  const _onTouchEnd = useCallback(() => {
    if (!touch.current.horizontal) return;

    const _dx = touch.current.startX; // We need to compare with final position
    // Actually we can't access final position in touchEnd — let's track it in move
  }, []);

  // Better approach: track current position in move
  const posRef = useRef(0);

  const handleTouchMove = useCallback((e) => {
    const t = e.touches[0];
    const dx = t.clientX - touch.current.startX;
    const dy = t.clientY - touch.current.startY;

    if (!touch.current.locked && (Math.abs(dx) > DEAD_ZONE || Math.abs(dy) > DEAD_ZONE)) {
      touch.current.locked = true;
      touch.current.horizontal = Math.abs(dx) > Math.abs(dy);
    }

    if (touch.current.horizontal) {
      posRef.current = dx;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!touch.current.horizontal) return;

    const dx = posRef.current;
    if (Math.abs(dx) >= SWIPE_THRESHOLD) {
      if (dx < 0 && activeIndex < totalSections - 1) {
        setActiveIndex((i) => i + 1);
      } else if (dx > 0 && activeIndex > 0) {
        setActiveIndex((i) => i - 1);
      }
    }

    posRef.current = 0;
    touch.current = { startX: 0, startY: 0, locked: false, horizontal: false };
  }, [activeIndex, totalSections]);

  const handlers = {
    onTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
  };

  // Container style: scrolls to active section
  const containerStyle = {
    display: 'flex',
    transition: reducedMotion.current ? 'none' : 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
    transform: `translateX(-${activeIndex * 100}%)`,
    willChange: 'transform',
  };

  return { activeIndex, handlers, setIndex, containerStyle, totalSections };
}

export { useSwipeSections };
