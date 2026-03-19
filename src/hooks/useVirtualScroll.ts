// ═══════════════════════════════════════════════════════════════════
// charEdge — Virtual Scroll Hook (Sprint 56)
//
// Windowed rendering for the Markets watchlist grid.
// Only mounts DOM nodes for visible + buffer rows, enabling
// smooth 60fps scrolling with 500+ rows.
//
// Usage:
//   const { virtualItems, totalHeight, offsetY } = useVirtualScroll({
//     itemCount: 500,
//     itemHeight: 48,
//     containerRef,
//     overscan: 5,
//   });
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from 'react';

interface VirtualScrollOptions {
  itemCount: number;
  itemHeight: number;
  containerRef: React.RefObject<HTMLElement | null>;
  overscan?: number;
  enabled?: boolean;
}

interface VirtualItem {
  index: number;
  offsetY: number;
}

interface VirtualScrollResult {
  virtualItems: VirtualItem[];
  totalHeight: number;
  startIndex: number;
  endIndex: number;
  offsetY: number;
  isVirtualized: boolean;
}

const VIRTUALIZATION_THRESHOLD = 50; // Only virtualize if > 50 items

/**
 * Hook for windowed/virtual scrolling.
 * Computes which rows are visible + buffer and returns their indices + offsets.
 */
export function useVirtualScroll({
  itemCount,
  itemHeight,
  containerRef,
  overscan = 5,
  enabled = true,
}: VirtualScrollOptions): VirtualScrollResult {

  const [scrollState, setScrollState] = useState({ scrollTop: 0, containerHeight: 0 });
  const rafId = useRef<number | null>(null);

  // Skip virtualization for small lists
  const isVirtualized = enabled && itemCount > VIRTUALIZATION_THRESHOLD;

  // ─── Scroll handler (rAF-throttled) ─────────────────────────
  const handleScroll = useCallback(() => {
    if (rafId.current) return;
    rafId.current = requestAnimationFrame(() => {
      rafId.current = null;
      const el = containerRef.current;
      if (!el) return;
      setScrollState({
        scrollTop: el.scrollTop,
        containerHeight: el.clientHeight,
      });
    });
  }, [containerRef]);

  // ─── Observe container resize ───────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !isVirtualized) return;

    // Initial measurement
    setScrollState({
      scrollTop: el.scrollTop,
      containerHeight: el.clientHeight,
    });

    el.addEventListener('scroll', handleScroll, { passive: true });

    // ResizeObserver for container height changes
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        setScrollState(prev => ({
          ...prev,
          containerHeight: el.clientHeight,
        }));
      });
      resizeObserver.observe(el);
    }

    return () => {
      el.removeEventListener('scroll', handleScroll);
      resizeObserver?.disconnect();
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
    };
  }, [containerRef, handleScroll, isVirtualized]);

  // ─── Compute visible range ──────────────────────────────────
  const totalHeight = itemCount * itemHeight;

  if (!isVirtualized) {
    // Not virtualized — return all items
    const allItems: VirtualItem[] = [];
    for (let i = 0; i < itemCount; i++) {
      allItems.push({ index: i, offsetY: i * itemHeight });
    }
    return {
      virtualItems: allItems,
      totalHeight,
      startIndex: 0,
      endIndex: itemCount - 1,
      offsetY: 0,
      isVirtualized: false,
    };
  }

  const { scrollTop, containerHeight } = scrollState;

  // Visible range
  const rawStartIndex = Math.floor(scrollTop / itemHeight);
  const rawEndIndex = Math.ceil((scrollTop + containerHeight) / itemHeight);

  // Add overscan buffer
  const startIndex = Math.max(0, rawStartIndex - overscan);
  const endIndex = Math.min(itemCount - 1, rawEndIndex + overscan);

  // Build virtual items
  const virtualItems: VirtualItem[] = [];
  for (let i = startIndex; i <= endIndex; i++) {
    virtualItems.push({
      index: i,
      offsetY: i * itemHeight,
    });
  }

  const offsetY = startIndex * itemHeight;

  return {
    virtualItems,
    totalHeight,
    startIndex,
    endIndex,
    offsetY,
    isVirtualized: true,
  };
}

export default useVirtualScroll;
