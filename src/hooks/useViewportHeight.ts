// ═══════════════════════════════════════════════════════════════════
// charEdge — useViewportHeight Hook (Phase 6: Mobile Polish)
//
// Sets a --vh CSS custom property based on visualViewport height.
// Prevents mobile keyboard from hiding form inputs.
// Use `calc(var(--vh, 1vh) * 100)` instead of `100vh` in modals.
// ═══════════════════════════════════════════════════════════════════

import { useEffect } from 'react';

export function useViewportHeight() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const vh = vv.height * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);

    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);
}

export default useViewportHeight;
