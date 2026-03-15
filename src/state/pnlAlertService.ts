// ═══════════════════════════════════════════════════════════════════
// charEdge — P&L Alert System (Sprint 18)
//
// Alerts based on unrealized P&L, not just price levels.
// A charEdge differentiator — Coinbase doesn't have this.
//
// Alert types:
//   - Position P&L threshold (+$500, -$200)
//   - Daily P&L threshold ($1000 total)
//   - Daily loss limit warning (psychology integration)
//
// Usage:
//   import { checkPnLAlerts } from './pnlAlertService';
//   checkPnLAlerts(positions, dailyPnL);
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { notify } from './notificationRouter';

// ─── Types ──────────────────────────────────────────────────────

export type PnLAlertType = 'positionProfit' | 'positionLoss' | 'dailyProfit' | 'dailyLoss' | 'lossLimit';

export interface PnLAlert {
  id: string;
  type: PnLAlertType;
  /** Threshold value (positive for profit, value for loss — always stored positive) */
  threshold: number;
  /** Optional: symbol for position-specific alerts */
  symbol?: string;
  enabled: boolean;
  /** Last time this alert was triggered (to prevent spam) */
  lastTriggered: number;
}

// ─── Store ──────────────────────────────────────────────────────

interface PnLAlertState {
  alerts: PnLAlert[];
  addAlert: (alert: Omit<PnLAlert, 'id' | 'lastTriggered'>) => void;
  removeAlert: (id: string) => void;
  toggleAlert: (id: string) => void;
  updateThreshold: (id: string, threshold: number) => void;
}

let _pnlAlertId = 0;

export const usePnLAlertStore = create<PnLAlertState>()(
  persist(
    (set) => ({
      alerts: [
        // Default alerts
        { id: 'default-daily-loss', type: 'dailyLoss' as PnLAlertType, threshold: 500, enabled: true, lastTriggered: 0 },
        { id: 'default-daily-profit', type: 'dailyProfit' as PnLAlertType, threshold: 1000, enabled: false, lastTriggered: 0 },
      ],

      addAlert: (alert) => set((s) => ({
        alerts: [...s.alerts, {
          ...alert,
          id: `pnl-${Date.now()}-${++_pnlAlertId}`,
          lastTriggered: 0,
        }],
      })),

      removeAlert: (id) => set((s) => ({
        alerts: s.alerts.filter((a) => a.id !== id),
      })),

      toggleAlert: (id) => set((s) => ({
        alerts: s.alerts.map((a) => a.id === id ? { ...a, enabled: !a.enabled } : a),
      })),

      updateThreshold: (id, threshold) => set((s) => ({
        alerts: s.alerts.map((a) => a.id === id ? { ...a, threshold } : a),
      })),
    }),
    { name: 'charEdge-pnl-alerts' },
  ),
);

// ─── P&L Check Engine ───────────────────────────────────────────

const COOLDOWN_MS = 30 * 60 * 1000; // 30 min between re-triggers

interface PositionSnapshot {
  symbol: string;
  unrealizedPnL: number;
}

/**
 * Check all P&L alerts against current positions and daily P&L.
 * Call this on each price tick or at regular intervals.
 */
export function checkPnLAlerts(
  positions: PositionSnapshot[],
  dailyPnL: number,
): void {
  const store = usePnLAlertStore.getState();
  const now = Date.now();

  for (const alert of store.alerts) {
    if (!alert.enabled) continue;
    if (now - alert.lastTriggered < COOLDOWN_MS) continue;

    let triggered = false;
    let body = '';

    switch (alert.type) {
      case 'positionProfit': {
        const match = positions.find((p) =>
          (!alert.symbol || p.symbol === alert.symbol) && p.unrealizedPnL >= alert.threshold
        );
        if (match) {
          triggered = true;
          body = `${match.symbol} position P&L reached +$${match.unrealizedPnL.toFixed(2)} (target: +$${alert.threshold})`;
        }
        break;
      }
      case 'positionLoss': {
        const match = positions.find((p) =>
          (!alert.symbol || p.symbol === alert.symbol) && p.unrealizedPnL <= -alert.threshold
        );
        if (match) {
          triggered = true;
          body = `${match.symbol} position P&L dropped to -$${Math.abs(match.unrealizedPnL).toFixed(2)} (limit: -$${alert.threshold})`;
        }
        break;
      }
      case 'dailyProfit':
        if (dailyPnL >= alert.threshold) {
          triggered = true;
          body = `Daily P&L reached +$${dailyPnL.toFixed(2)} — you crossed your $${alert.threshold} target! 🎉`;
        }
        break;
      case 'dailyLoss':
        if (dailyPnL <= -alert.threshold) {
          triggered = true;
          body = `Daily P&L dropped to -$${Math.abs(dailyPnL).toFixed(2)} — you've hit your $${alert.threshold} loss limit. Consider stopping.`;
        }
        break;
      case 'lossLimit':
        if (dailyPnL <= -alert.threshold) {
          triggered = true;
          body = `⚠️ Daily loss limit of $${alert.threshold} reached. Time to step away and review your trades.`;
        }
        break;
    }

    if (triggered) {
      // Update lastTriggered
      usePnLAlertStore.setState((s) => ({
        alerts: s.alerts.map((a) => a.id === alert.id ? { ...a, lastTriggered: now } : a),
      }));

      const isProfitAlert = ['positionProfit', 'dailyProfit'].includes(alert.type);

      notify({
        category: 'advancedTransactions',
        title: isProfitAlert ? '💰 P&L Target Hit' : '⚠️ P&L Alert',
        body,
        icon: isProfitAlert ? '💰' : '⚠️',
        variant: isProfitAlert ? 'success' : 'warning',
        soundType: isProfitAlert ? 'success' : 'urgent',
        meta: { alertType: alert.type, threshold: alert.threshold, dailyPnL },
      });
    }
  }
}

export default usePnLAlertStore;
