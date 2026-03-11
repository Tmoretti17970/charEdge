// ═══════════════════════════════════════════════════════════════════
// charEdge — useScrollSync Hook (Sprint 6)
//
// Extracts scroll-sync logic from ChartEngineWidget into a reusable
// hook. Handles both subscribing to and emitting scroll position
// changes via ScrollSyncBus for multi-pane chart synchronization.
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useRef } from 'react';
import scrollSyncBus from '@/charting_library/utils/ScrollSyncBus.js';

/**
 * Sync scroll position between chart panes via ScrollSyncBus.
 * @param {React.MutableRefObject} engineRef - Ref to ChartEngine
 * @param {string} paneId - Unique pane identifier
 * @param {number} barCount - Current bar count (triggers emission check)
 */
export function useScrollSync(engineRef, paneId, barCount) {
  const scrollSyncMutedRef = useRef(false);
  const lastEmittedOffset = useRef(-1);

  // Subscribe: receive scroll position from other panes
  useEffect(() => {
    const unsub = scrollSyncBus.subscribe(paneId, (payload) => {
      const engine = engineRef.current;
      if (!engine || !payload) return;
      const bars = engine.bars;
      if (!bars?.length) return;
      const maxScroll = Math.max(0, bars.length - engine.state.visibleBars);
      const newOffset = Math.round(payload.fraction * maxScroll);
      if (Math.abs(engine.state.scrollOffset - newOffset) > 0.5) {
        scrollSyncMutedRef.current = true;
        engine.state.scrollOffset = newOffset;
        engine.markDirty();
        requestAnimationFrame(() => { scrollSyncMutedRef.current = false; });
      }
    });
    return unsub;
  }, [paneId, engineRef]);

  // Emit: broadcast scroll position changes to other panes
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || scrollSyncMutedRef.current) return;
    const bars = engine.bars;
    const offset = engine.state.scrollOffset;
    if (bars?.length && Math.abs(offset - lastEmittedOffset.current) > 0.5) {
      lastEmittedOffset.current = offset;
      const maxScroll = Math.max(1, bars.length - engine.state.visibleBars);
      scrollSyncBus.emit(paneId, {
        fraction: offset / maxScroll,
        visibleBars: engine.state.visibleBars,
      });
    }
  }, [barCount, paneId, engineRef]);  
}
