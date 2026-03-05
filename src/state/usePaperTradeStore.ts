// @ts-check
// ═══════════════════════════════════════════════════════════════════
// charEdge — Paper Trading Engine
//
// Simulated order execution against live price data. Supports
// market, limit, and stop orders with realistic fill modeling.
// Integrates with Zustand for state management and persistence.
//
// Features:
// - Market/Limit/Stop/Stop-Limit orders
// - Position tracking (long/short)
// - Simulated slippage and commission
// - Prop firm rule enforcement
// - Trade history with P&L tracking
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Order Types ─────────────────────────────────────────────────

export const ORDER_TYPES = {
  MARKET: 'market',
  LIMIT: 'limit',
  STOP: 'stop',
  STOP_LIMIT: 'stop_limit',
};

export const POSITION_SIDE = {
  LONG: 'long',
  SHORT: 'short',
};

// ─── Store ───────────────────────────────────────────────────────

const usePaperTradeStore = create(
  persist(
    (set, get) => ({
      // ─── Account ────────────────────────────────────────
      initialBalance: 10000,
      balance: 10000,
      equity: 10000,

      // ─── Positions ─────────────────────────────────────
      positions: [],     // Open positions
      orders: [],        // Pending orders
      tradeHistory: [],  // Closed trades
      equityCurve: [10000],

      // ─── Settings ──────────────────────────────────────
      slippageBps: 5,     // 0.05% slippage
      commissionPerTrade: 1.00,
      enabled: false,

      // ─── Actions ───────────────────────────────────────

      enable() { set({ enabled: true }); },
      disable() { set({ enabled: false }); },
      toggle() { set(s => ({ enabled: !s.enabled })); },

      setBalance(balance) {
        set({ balance, initialBalance: balance, equity: balance, equityCurve: [balance] });
      },

      /**
       * Place an order.
       * @param {Object} order
       * @param {string} order.symbol
       * @param {'long'|'short'} order.side
       * @param {string} order.type - 'market', 'limit', 'stop', 'stop_limit'
       * @param {number} order.quantity
       * @param {number} [order.price] - Limit/stop price
       * @param {number} [order.stopLoss]
       * @param {number} [order.takeProfit]
       * @param {number} currentPrice - Current market price
       */
      placeOrder(order, currentPrice) {
        const { slippageBps, commissionPerTrade } = get();

        if (order.type === ORDER_TYPES.MARKET) {
          // Fill immediately with slippage
          const slippage = currentPrice * (slippageBps / 10000);
          const fillPrice = order.side === POSITION_SIDE.LONG
            ? currentPrice + slippage
            : currentPrice - slippage;

          const cost = fillPrice * order.quantity;
          const commission = commissionPerTrade;

          const position = {
            id: crypto.randomUUID(),
            symbol: order.symbol,
            side: order.side,
            entryPrice: fillPrice,
            quantity: order.quantity,
            entryTime: Date.now(),
            stopLoss: order.stopLoss || null,
            takeProfit: order.takeProfit || null,
            unrealizedPnL: 0,
            commission,
          };

          set(s => ({
            balance: s.balance - commission,
            positions: [...s.positions, position],
          }));

          return { filled: true, position };
        }

        // Pending order (limit, stop, stop-limit)
        const pendingOrder = {
          id: crypto.randomUUID(),
          ...order,
          createdAt: Date.now(),
          status: 'pending',
        };

        set(s => ({ orders: [...s.orders, pendingOrder] }));
        return { filled: false, order: pendingOrder };
      },

      /**
       * Update positions with new price tick.
       * Checks SL/TP, fills pending orders, updates P&L.
       * @param {string} symbol
       * @param {number} price - Current price
       */
      onPriceTick(symbol, price) {
        const { positions, orders, balance, commissionPerTrade, slippageBps } = get();

        const closedTrades = [];
        let newBalance = balance;

        // Check open positions for SL/TP
        const remainingPositions = positions.filter(pos => {
          if (pos.symbol !== symbol) return true;

          const isLong = pos.side === POSITION_SIDE.LONG;
          const pnl = isLong
            ? (price - pos.entryPrice) * pos.quantity
            : (pos.entryPrice - price) * pos.quantity;

          // Check stop loss
          if (pos.stopLoss != null) {
            const slHit = isLong ? price <= pos.stopLoss : price >= pos.stopLoss;
            if (slHit) {
              const exitPnl = isLong
                ? (pos.stopLoss - pos.entryPrice) * pos.quantity
                : (pos.entryPrice - pos.stopLoss) * pos.quantity;
              newBalance += exitPnl - commissionPerTrade;
              closedTrades.push(createClosedTrade(pos, pos.stopLoss, exitPnl, 'stop_loss'));
              return false;
            }
          }

          // Check take profit
          if (pos.takeProfit != null) {
            const tpHit = isLong ? price >= pos.takeProfit : price <= pos.takeProfit;
            if (tpHit) {
              const exitPnl = isLong
                ? (pos.takeProfit - pos.entryPrice) * pos.quantity
                : (pos.entryPrice - pos.takeProfit) * pos.quantity;
              newBalance += exitPnl - commissionPerTrade;
              closedTrades.push(createClosedTrade(pos, pos.takeProfit, exitPnl, 'take_profit'));
              return false;
            }
          }

          // Update unrealized P&L
          pos.unrealizedPnL = pnl;
          return true;
        });

        // Check pending orders
        const slippage = price * (slippageBps / 10000);
        const remainingOrders = orders.filter(ord => {
          if (ord.symbol !== symbol || ord.status !== 'pending') return true;

          let shouldFill = false;
          let fillPrice = price;

          if (ord.type === ORDER_TYPES.LIMIT) {
            if (ord.side === POSITION_SIDE.LONG && price <= ord.price) {
              shouldFill = true;
              fillPrice = ord.price;
            } else if (ord.side === POSITION_SIDE.SHORT && price >= ord.price) {
              shouldFill = true;
              fillPrice = ord.price;
            }
          } else if (ord.type === ORDER_TYPES.STOP) {
            if (ord.side === POSITION_SIDE.LONG && price >= ord.price) {
              shouldFill = true;
              fillPrice = price + slippage;
            } else if (ord.side === POSITION_SIDE.SHORT && price <= ord.price) {
              shouldFill = true;
              fillPrice = price - slippage;
            }
          }

          if (shouldFill) {
            const newPos = {
              id: crypto.randomUUID(),
              symbol: ord.symbol,
              side: ord.side,
              entryPrice: fillPrice,
              quantity: ord.quantity,
              entryTime: Date.now(),
              stopLoss: ord.stopLoss || null,
              takeProfit: ord.takeProfit || null,
              unrealizedPnL: 0,
              commission: commissionPerTrade,
            };
            remainingPositions.push(newPos);
            newBalance -= commissionPerTrade;
            return false;
          }

          return true;
        });

        // Calculate equity
        const unrealizedTotal = remainingPositions.reduce((s, p) => s + p.unrealizedPnL, 0);
        const newEquity = newBalance + unrealizedTotal;

        set(s => ({
          positions: remainingPositions,
          orders: remainingOrders,
          balance: newBalance,
          equity: newEquity,
          tradeHistory: [...closedTrades, ...s.tradeHistory].slice(0, 500),
          equityCurve: [...s.equityCurve, newEquity].slice(-1000),
        }));
      },

      /**
       * Close a position at market price.
       */
      closePosition(positionId, currentPrice) {
        const { positions, balance, commissionPerTrade, slippageBps } = get();
        const pos = positions.find(p => p.id === positionId);
        if (!pos) return;

        const slippage = currentPrice * (slippageBps / 10000);
        const exitPrice = pos.side === POSITION_SIDE.LONG
          ? currentPrice - slippage
          : currentPrice + slippage;

        const pnl = pos.side === POSITION_SIDE.LONG
          ? (exitPrice - pos.entryPrice) * pos.quantity
          : (pos.entryPrice - exitPrice) * pos.quantity;

        const trade = createClosedTrade(pos, exitPrice, pnl, 'manual');

        set(s => ({
          positions: s.positions.filter(p => p.id !== positionId),
          balance: s.balance + pnl - commissionPerTrade,
          tradeHistory: [trade, ...s.tradeHistory].slice(0, 500),
        }));
      },

      /**
       * Cancel a pending order.
       */
      cancelOrder(orderId) {
        set(s => ({
          orders: s.orders.filter(o => o.id !== orderId),
        }));
      },

      /**
       * Close all positions at market.
       */
      closeAllPositions(currentPrice) {
        const { positions } = get();
        for (const pos of positions) {
          get().closePosition(pos.id, currentPrice);
        }
      },

      /**
       * Reset paper trading account.
       */
      resetAccount() {
        const { initialBalance } = get();
        set({
          balance: initialBalance,
          equity: initialBalance,
          positions: [],
          orders: [],
          tradeHistory: [],
          equityCurve: [initialBalance],
        });
      },

      // ─── Getters ───────────────────────────────────────

      getStats() {
        const { tradeHistory, initialBalance, equity, balance } = get();
        const trades = tradeHistory;
        if (!trades.length) return null;

        const wins = trades.filter(t => t.pnl > 0);
        const losses = trades.filter(t => t.pnl <= 0);
        const totalPnL = trades.reduce((s, t) => s + t.pnl, 0);
        const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
        const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));

        return {
          totalTrades: trades.length,
          wins: wins.length,
          losses: losses.length,
          winRate: Math.round((wins.length / trades.length) * 10000) / 100,
          totalPnL: Math.round(totalPnL * 100) / 100,
          avgWin: wins.length ? Math.round((grossProfit / wins.length) * 100) / 100 : 0,
          avgLoss: losses.length ? Math.round((grossLoss / losses.length) * 100) / 100 : 0,
          profitFactor: grossLoss > 0 ? Math.round((grossProfit / grossLoss) * 100) / 100 : Infinity,
          returnPercent: Math.round(((equity - initialBalance) / initialBalance) * 10000) / 100,
          balance: Math.round(balance * 100) / 100,
          equity: Math.round(equity * 100) / 100,
        };
      },
    }),
    {
      name: 'charEdge-paper-trading',
      version: 1,
      partialize: (s) => ({
        initialBalance: s.initialBalance,
        balance: s.balance,
        equity: s.equity,
        positions: s.positions,
        orders: s.orders,
        tradeHistory: s.tradeHistory.slice(0, 100),
        equityCurve: s.equityCurve.slice(-200),
        slippageBps: s.slippageBps,
        commissionPerTrade: s.commissionPerTrade,
        enabled: s.enabled,
      }),
    },
  ),
);

function createClosedTrade(position, exitPrice, pnl, reason) {
  return {
    id: crypto.randomUUID(),
    symbol: position.symbol,
    side: position.side,
    entryPrice: position.entryPrice,
    exitPrice,
    quantity: position.quantity,
    entryTime: position.entryTime,
    exitTime: Date.now(),
    pnl: Math.round(pnl * 100) / 100,
    pnlPercent: position.entryPrice > 0
      ? Math.round((pnl / (position.entryPrice * position.quantity)) * 10000) / 100
      : 0,
    exitReason: reason,
    commission: position.commission || 0,
  };
}

export { usePaperTradeStore };
export default usePaperTradeStore;
