// ═══════════════════════════════════════════════════════════════════
// charEdge — Drawing ↔ Alert Store Bridge (Phase A, A1)
//
// Listens for drawing alert creation events from DrawingAlertEngine
// and persists them in useAlertStore so they survive page reloads.
//
// Usage: mount <DrawingAlertsBridge /> once in the chart viewport,
//   or call useDrawingAlerts() in any component inside the chart area.
// ═══════════════════════════════════════════════════════════════════

import { useEffect } from 'react';
import { useChartCoreStore } from '../../../../state/chart/useChartCoreStore';
import { useAlertStore } from '../../../../state/useAlertStore';

/**
 * Map a DrawingAlertEngine alert → useAlertStore.addAlert() params.
 * Drawing alerts use the first point's price as the alert level.
 */
function drawingAlertToStoreParams(drawingAlert, symbol) {
  const price = drawingAlert.points?.[0]?.price ?? 0;

  // Map drawing trigger types to alert conditions
  const conditionMap = {
    cross: 'cross_above',
    enter: 'above',
    exit: 'below',
  };

  return {
    symbol,
    condition: conditionMap[drawingAlert.triggerType] || 'cross_above',
    price,
    note: `📐 ${drawingAlert.drawingType} — ${drawingAlert.message}`,
    repeating: true, // drawing alerts should repeat by default
    style: 'indicator',
  };
}

/**
 * Hook that bridges DrawingAlertEngine events → useAlertStore.
 * Listens for 'charEdge:drawing-alert-created' custom events.
 */
export function useDrawingAlerts() {
  const addAlert = useAlertStore((s) => s.addAlert);

  useEffect(() => {
    const handler = (e) => {
      const drawingAlert = e.detail;
      if (!drawingAlert) return;

      const symbol = useChartCoreStore.getState().symbol || 'UNKNOWN';
      const params = drawingAlertToStoreParams(drawingAlert, symbol);

      if (params.price > 0) {
        const alertId = addAlert(params);

        // Store the mapping for potential future cleanup
        const key = `charEdge:drawingAlert:${drawingAlert.drawingId}`;
        try {
          const existing = JSON.parse(localStorage.getItem(key) || '[]');
          existing.push(alertId);
          localStorage.setItem(key, JSON.stringify(existing));
        } catch {
          /* localStorage may be unavailable */
        }
      }
    };

    window.addEventListener('charEdge:drawing-alert-created', handler);
    return () => window.removeEventListener('charEdge:drawing-alert-created', handler);
  }, [addAlert]);
}

export default useDrawingAlerts;
