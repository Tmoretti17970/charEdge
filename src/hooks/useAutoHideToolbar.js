// ═══════════════════════════════════════════════════════════════════
// charEdge — useAutoHideToolbar Hook (P1-A #2)
// Hides the chart toolbar during scroll/pan, reveals on hover or idle.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook that manages toolbar auto-hide behavior during chart interactions.
 * Toolbar hides on pan/zoom and reveals on mouse hover near the top edge
 * or after an idle timeout.
 *
 * @param {Object} opts
 * @param {number} [opts.delay=2000] - ms to wait after interaction ends before showing
 * @param {number} [opts.revealZone=24] - px from top edge that triggers reveal
 * @param {boolean} [opts.enabled=true] - whether auto-hide is active
 * @returns {{ visible, onMouseMove, containerStyle }}
 */
export function useAutoHideToolbar({ delay = 2000, revealZone = 24, enabled = true } = {}) {
  const [visible, setVisible] = useState(true);
  const timerRef = useRef(null);
  const interactingRef = useRef(false);

  // ─── Listen for pan start/end events from InputManager ──────
  useEffect(() => {
    if (!enabled) {
      setVisible(true);
      return;
    }

    const onPanStart = () => {
      interactingRef.current = true;
      setVisible(false);
      if (timerRef.current) clearTimeout(timerRef.current);
    };

    const onPanEnd = () => {
      interactingRef.current = false;
      timerRef.current = setTimeout(() => {
        setVisible(true);
      }, delay);
    };

    window.addEventListener('charEdge:pan-start', onPanStart);
    window.addEventListener('charEdge:pan-end', onPanEnd);

    return () => {
      window.removeEventListener('charEdge:pan-start', onPanStart);
      window.removeEventListener('charEdge:pan-end', onPanEnd);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, delay]);

  // ─── Mouse move handler for reveal zone ──────────────────────
  const onMouseMove = useCallback(
    (e) => {
      if (!enabled) return;
      // Reveal toolbar when mouse is in the top N pixels
      const rect = e.currentTarget?.getBoundingClientRect();
      if (rect && e.clientY - rect.top < revealZone) {
        setVisible(true);
        if (timerRef.current) clearTimeout(timerRef.current);
      }
    },
    [enabled, revealZone],
  );

  // ─── CSS transition styles ──────────────────────────────────
  const containerStyle = {
    transform: visible ? 'translateY(0)' : 'translateY(-100%)',
    opacity: visible ? 1 : 0,
    transition: 'transform 0.3s ease, opacity 0.3s ease',
    pointerEvents: visible ? 'auto' : 'none',
  };

  return { visible, onMouseMove, containerStyle };
}

export default useAutoHideToolbar;
