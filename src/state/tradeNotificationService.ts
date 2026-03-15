// ═══════════════════════════════════════════════════════════════════
// charEdge — Trade Notification Service (Sprint 16)
//
// Wires paper trade events into the notification system.
// Mirrors Coinbase's "Advanced Transactions" category.
//
// Events:
//   - Order Filled (limit/stop → position)
//   - Order Canceled
//   - Stop Loss Hit
//   - Take Profit Hit
//   - Position Opened / Closed
//   - SL/TP Modified
// ═══════════════════════════════════════════════════════════════════

import { notifyTradeActivity } from './notificationRouter';

// ─── Trade Event Types ──────────────────────────────────────────

export type TradeEventType =
  | 'orderFilled'
  | 'orderCanceled'
  | 'stopLossHit'
  | 'takeProfitHit'
  | 'positionOpened'
  | 'positionClosed'
  | 'slTpModified';

interface TradeEventPayload {
  symbol: string;
  side?: 'BUY' | 'SELL' | 'long' | 'short';
  quantity?: number;
  price?: number;
  pnl?: number;
  orderId?: string;
  positionId?: string;
  extra?: Record<string, unknown>;
}

// ─── Event Templates ────────────────────────────────────────────

const EVENT_TEMPLATES: Record<TradeEventType, {
  icon: string;
  title: (p: TradeEventPayload) => string;
  body: (p: TradeEventPayload) => string;
}> = {
  orderFilled: {
    icon: '✅',
    title: (p) => `Order Filled — ${p.symbol}`,
    body: (p) => `Paper trade ${p.side || 'BUY'} ${p.quantity || ''} ${p.symbol} filled at $${(p.price || 0).toFixed(2)}`,
  },
  orderCanceled: {
    icon: '❌',
    title: (p) => `Order Canceled — ${p.symbol}`,
    body: (p) => `${p.side || ''} order for ${p.symbol} was canceled`,
  },
  stopLossHit: {
    icon: '🛑',
    title: (p) => `Stop Loss Hit — ${p.symbol}`,
    body: (p) => {
      const pnlStr = p.pnl != null ? ` · P&L: ${p.pnl >= 0 ? '+' : ''}$${p.pnl.toFixed(2)}` : '';
      return `${p.symbol} hit stop loss at $${(p.price || 0).toFixed(2)}${pnlStr}`;
    },
  },
  takeProfitHit: {
    icon: '🎯',
    title: (p) => `Take Profit Hit — ${p.symbol}`,
    body: (p) => {
      const pnlStr = p.pnl != null ? ` · P&L: +$${(p.pnl || 0).toFixed(2)}` : '';
      return `${p.symbol} hit take profit at $${(p.price || 0).toFixed(2)}${pnlStr}`;
    },
  },
  positionOpened: {
    icon: '📂',
    title: (p) => `Position Opened — ${p.symbol}`,
    body: (p) => `${p.side || 'BUY'} ${p.quantity || ''} ${p.symbol} at $${(p.price || 0).toFixed(2)}`,
  },
  positionClosed: {
    icon: '📁',
    title: (p) => `Position Closed — ${p.symbol}`,
    body: (p) => {
      const pnlStr = p.pnl != null ? ` · P&L: ${p.pnl >= 0 ? '+' : ''}$${p.pnl.toFixed(2)}` : '';
      return `${p.symbol} position closed at $${(p.price || 0).toFixed(2)}${pnlStr}`;
    },
  },
  slTpModified: {
    icon: '✏️',
    title: (p) => `SL/TP Modified — ${p.symbol}`,
    body: (p) => `Stop-loss or take-profit levels updated for ${p.symbol}`,
  },
};

// ─── Public API ─────────────────────────────────────────────────

/**
 * Fire a trade notification through the notification router.
 */
export function notifyTradeEvent(
  eventType: TradeEventType,
  payload: TradeEventPayload,
): void {
  const template = EVENT_TEMPLATES[eventType];
  if (!template) return;

  const title = `${template.icon} ${template.title(payload)}`;
  const body = template.body(payload);

  notifyTradeActivity(title, body, {
    eventType,
    ...payload,
    ...payload.extra,
  });
}

// ─── Convenience Helpers ────────────────────────────────────────

export const tradeNotify = {
  orderFilled: (p: TradeEventPayload) => notifyTradeEvent('orderFilled', p),
  orderCanceled: (p: TradeEventPayload) => notifyTradeEvent('orderCanceled', p),
  stopLossHit: (p: TradeEventPayload) => notifyTradeEvent('stopLossHit', p),
  takeProfitHit: (p: TradeEventPayload) => notifyTradeEvent('takeProfitHit', p),
  positionOpened: (p: TradeEventPayload) => notifyTradeEvent('positionOpened', p),
  positionClosed: (p: TradeEventPayload) => notifyTradeEvent('positionClosed', p),
  slTpModified: (p: TradeEventPayload) => notifyTradeEvent('slTpModified', p),
};

/**
 * Wire into usePaperTradeStore event system.
 * Call once during app initialization.
 */
export function initTradeNotifications(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('charEdge:trade-event', ((event: CustomEvent) => {
    const { type, ...payload } = event.detail || {};
    if (type && EVENT_TEMPLATES[type as TradeEventType]) {
      notifyTradeEvent(type as TradeEventType, payload as TradeEventPayload);
    }
  }) as EventListener);
}

export default tradeNotify;
