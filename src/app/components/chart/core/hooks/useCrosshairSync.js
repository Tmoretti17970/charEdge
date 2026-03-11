// ═══════════════════════════════════════════════════════════════════
// charEdge — useCrosshairSync Hook (Sprint 6)
//
// Extracts crosshair sync logic from ChartEngineWidget. Subscribes
// to CrosshairBus for synced crosshair display across panes.
// ═══════════════════════════════════════════════════════════════════

import { useEffect } from 'react';
import crosshairBus from '@/charting_library/utils/CrosshairBus';

/**
 * Subscribe to CrosshairBus for synced crosshair from other panes.
 * @param {React.MutableRefObject} engineRef - Ref to ChartEngine
 * @param {string} paneId - Unique pane identifier
 */
export function useCrosshairSync(engineRef, paneId) {
  useEffect(() => {
    const unsub = crosshairBus.subscribe(paneId, (payload) => {
      if (engineRef.current) {
        engineRef.current.setSyncedCrosshair(
          payload ? { time: payload.timestamp, price: payload.price } : null
        );
      }
    });
    return unsub;
  }, [paneId, engineRef]);
}
