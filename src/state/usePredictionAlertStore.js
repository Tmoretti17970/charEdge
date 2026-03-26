// ═══════════════════════════════════════════════════════════════════
// charEdge — Prediction Alert Store
//
// Manages price threshold alerts for prediction markets.
// Persisted to localStorage. Checks alerts on each data refresh.
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';

const usePredictionAlertStore = create((set, get) => ({
  alerts: [],

  /** Add a new alert. */
  addAlert: ({ marketId, marketTitle, threshold, direction, source }) => {
    const alert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      marketId,
      marketTitle,
      threshold,
      direction, // 'above' | 'below'
      source,
      triggered: false,
      triggeredAt: null,
      createdAt: Date.now(),
    };
    set((s) => ({ alerts: [...s.alerts, alert] }));
  },

  /** Remove an alert by ID. */
  removeAlert: (alertId) => {
    set((s) => ({ alerts: s.alerts.filter((a) => a.id !== alertId) }));
  },

  /** Get alerts for a specific market. */
  getAlertsForMarket: (marketId) => {
    return get().alerts.filter((a) => a.marketId === marketId);
  },

  /** Get all active (untriggered) alerts. */
  getActiveAlerts: () => {
    return get().alerts.filter((a) => !a.triggered);
  },

  /** Get triggered alerts count. */
  getTriggeredCount: () => {
    return get().alerts.filter((a) => a.triggered).length;
  },

  /**
   * Check all alerts against current market data.
   * Call this on each data refresh cycle.
   * Returns array of newly triggered alerts.
   */
  checkAlerts: (markets) => {
    const { alerts } = get();
    const newlyTriggered = [];

    const updatedAlerts = alerts.map((alert) => {
      if (alert.triggered) return alert;

      const market = markets.find((m) => m.id === alert.marketId);
      if (!market) return alert;

      const leadProb = market.outcomes?.[0]?.probability || 0;
      const shouldTrigger =
        (alert.direction === 'above' && leadProb >= alert.threshold) ||
        (alert.direction === 'below' && leadProb <= alert.threshold);

      if (shouldTrigger) {
        newlyTriggered.push({ ...alert, currentProbability: leadProb });
        return { ...alert, triggered: true, triggeredAt: Date.now() };
      }

      return alert;
    });

    if (newlyTriggered.length > 0) {
      set({ alerts: updatedAlerts });
    }

    return newlyTriggered;
  },

  /** Clear all triggered alerts. */
  clearTriggered: () => {
    set((s) => ({ alerts: s.alerts.filter((a) => !a.triggered) }));
  },
}));

export default usePredictionAlertStore;
