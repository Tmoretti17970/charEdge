// ═══════════════════════════════════════════════════════════════════
// charEdge — Tablet Drawing Adapter (Sprint 22)
//
// Apple Pencil + stylus support:
//   - Detect pen input via pointerType === 'pen'
//   - Pressure sensitivity → dynamic line width
//   - Split-view compatible (ResizeObserver)
//   - Hover effects for stylus proximity (pointerover)
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * Hook that adapts drawing engine for tablet/stylus input.
 * Returns state about pen proximity and pressure.
 *
 * @param {object} engineRef - ref to the DrawingEngine
 * @param {object} containerRef - ref to the chart container element
 */
export function useTabletDrawing(engineRef, containerRef) {
  const [isPenActive, setIsPenActive] = useState(false);
  const [penPressure, setPenPressure] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const lastPressureRef = useRef(0);

  // Detect Apple Pencil / stylus proximity
  const handlePointerEnter = useCallback((e) => {
    if (e.pointerType === 'pen') {
      setIsPenActive(true);
      setIsHovering(true);
    }
  }, []);

  const handlePointerLeave = useCallback((e) => {
    if (e.pointerType === 'pen') {
      setIsHovering(false);
    }
  }, []);

  // Pressure-sensitive drawing
  const handlePointerMove = useCallback((e) => {
    if (e.pointerType !== 'pen') return;

    const pressure = e.pressure || 0;
    setPenPressure(pressure);
    lastPressureRef.current = pressure;

    // Apply pressure to active drawing line width
    const engine = engineRef?.current;
    if (engine && engine._state === 'CREATING' && pressure > 0) {
      // Map pressure 0-1 → line width 1-6
      const dynamicWidth = 1 + pressure * 5;
      if (engine._activeDrawing?.style) {
        engine._activeDrawing.style._dynamicLineWidth = dynamicWidth;
      }
    }
  }, [engineRef]);

  const handlePointerDown = useCallback((e) => {
    if (e.pointerType === 'pen') {
      setIsPenActive(true);
      // Prevent default to avoid scrolling with pen
      e.preventDefault();
    }
  }, []);

  const handlePointerUp = useCallback((e) => {
    if (e.pointerType === 'pen') {
      setPenPressure(0);
      lastPressureRef.current = 0;
    }
  }, []);

  // Attach listeners
  useEffect(() => {
    const el = containerRef?.current;
    if (!el) return;

    el.addEventListener('pointerenter', handlePointerEnter);
    el.addEventListener('pointerleave', handlePointerLeave);
    el.addEventListener('pointermove', handlePointerMove);
    el.addEventListener('pointerdown', handlePointerDown);
    el.addEventListener('pointerup', handlePointerUp);

    return () => {
      el.removeEventListener('pointerenter', handlePointerEnter);
      el.removeEventListener('pointerleave', handlePointerLeave);
      el.removeEventListener('pointermove', handlePointerMove);
      el.removeEventListener('pointerdown', handlePointerDown);
      el.removeEventListener('pointerup', handlePointerUp);
    };
  }, [containerRef, handlePointerEnter, handlePointerLeave, handlePointerMove, handlePointerDown, handlePointerUp]);

  return {
    isPenActive,
    penPressure,
    isHovering,
  };
}

/**
 * Hook for split-view compatible layout.
 * Uses ResizeObserver to detect container size changes
 * and returns whether we're in a compact layout.
 */
export function useSplitViewLayout(containerRef) {
  const [isCompact, setIsCompact] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const el = containerRef?.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const width = entry.contentRect.width;
        setContainerWidth(width);
        setIsCompact(width < 500); // Compact below 500px
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [containerRef]);

  return { isCompact, containerWidth };
}
