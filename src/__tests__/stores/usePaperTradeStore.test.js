// ═══════════════════════════════════════════════════════════════════
// charEdge — Paper Trading Store Unit Tests
//
// P1-7: Comprehensive tests for usePaperTradeStore covering
// order placement, position management, P&L, SL/TP, and stats.
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock crypto.randomUUID for deterministic IDs in tests
let uuidCounter = 0;
vi.stubGlobal('crypto', {
    randomUUID: () => `test-uuid-${++uuidCounter}`,
});

import usePaperTradeStore from '../../state/usePaperTradeStore.ts';

const store = usePaperTradeStore;

describe('Paper Trading Store', () => {
    beforeEach(() => {
        uuidCounter = 0;
        store.getState().resetAccount();
        // Ensure clean state
        store.setState({
            initialBalance: 10000,
            balance: 10000,
            equity: 10000,
            positions: [],
            orders: [],
            tradeHistory: [],
            equityCurve: [10000],
            slippageBps: 5,
            commissionPerTrade: 1.00,
            enabled: false,
        });
    });

    // ─── Account Controls ──────────────────────────────────────

    describe('Account Controls', () => {
        it('initializes with default $10,000 balance', () => {
            const s = store.getState();
            expect(s.balance).toBe(10000);
            expect(s.equity).toBe(10000);
            expect(s.initialBalance).toBe(10000);
        });

        it('enable() sets enabled=true', () => {
            store.getState().enable();
            expect(store.getState().enabled).toBe(true);
        });

        it('disable() sets enabled=false', () => {
            store.getState().enable();
            store.getState().disable();
            expect(store.getState().enabled).toBe(false);
        });

        it('toggle() flips enabled state', () => {
            store.getState().toggle();
            expect(store.getState().enabled).toBe(true);
            store.getState().toggle();
            expect(store.getState().enabled).toBe(false);
        });

        it('setBalance() resets equity curve', () => {
            store.getState().setBalance(50000);
            const s = store.getState();
            expect(s.balance).toBe(50000);
            expect(s.equity).toBe(50000);
            expect(s.initialBalance).toBe(50000);
            expect(s.equityCurve).toEqual([50000]);
        });

        it('resetAccount() restores to initial balance', () => {
            store.getState().placeOrder(
                { symbol: 'BTC', side: 'long', type: 'market', quantity: 1 },
                50000,
            );
            store.getState().resetAccount();
            const s = store.getState();
            expect(s.balance).toBe(10000);
            expect(s.positions).toHaveLength(0);
            expect(s.orders).toHaveLength(0);
            expect(s.tradeHistory).toHaveLength(0);
        });
    });

    // ─── Market Orders ─────────────────────────────────────────

    describe('Market Orders', () => {
        it('opens a long position with slippage', () => {
            const result = store.getState().placeOrder(
                { symbol: 'BTC', side: 'long', type: 'market', quantity: 0.1 },
                50000,
            );

            expect(result.filled).toBe(true);
            expect(result.position).toBeDefined();
            expect(result.position.side).toBe('long');
            // Slippage: 50000 * 5/10000 = 25, fill = 50025
            expect(result.position.entryPrice).toBe(50025);
            expect(result.position.quantity).toBe(0.1);

            const s = store.getState();
            expect(s.positions).toHaveLength(1);
            // Commission: 1.00
            expect(s.balance).toBe(9999);
        });

        it('opens a short position with slippage', () => {
            const result = store.getState().placeOrder(
                { symbol: 'ETH', side: 'short', type: 'market', quantity: 1 },
                3000,
            );

            expect(result.filled).toBe(true);
            // Slippage: 3000 * 5/10000 = 1.5, fill = 2998.5
            expect(result.position.entryPrice).toBe(2998.5);
            expect(store.getState().balance).toBe(9999);
        });

        it('attaches SL/TP to market order position', () => {
            const result = store.getState().placeOrder(
                { symbol: 'BTC', side: 'long', type: 'market', quantity: 0.1, stopLoss: 49000, takeProfit: 55000 },
                50000,
            );
            expect(result.position.stopLoss).toBe(49000);
            expect(result.position.takeProfit).toBe(55000);
        });
    });

    // ─── Limit Orders ──────────────────────────────────────────

    describe('Limit Orders', () => {
        it('creates a pending limit order', () => {
            const result = store.getState().placeOrder(
                { symbol: 'BTC', side: 'long', type: 'limit', quantity: 0.1, price: 48000 },
                50000,
            );

            expect(result.filled).toBe(false);
            expect(result.order.status).toBe('pending');
            expect(store.getState().orders).toHaveLength(1);
            // No commission charged yet
            expect(store.getState().balance).toBe(10000);
        });

        it('fills long limit order when price drops to limit', () => {
            store.getState().placeOrder(
                { symbol: 'BTC', side: 'long', type: 'limit', quantity: 0.1, price: 48000 },
                50000,
            );

            // Price drops to 47900 (at or below 48000 limit)
            store.getState().onPriceTick('BTC', 47900);

            const s = store.getState();
            expect(s.orders).toHaveLength(0);
            expect(s.positions).toHaveLength(1);
            expect(s.positions[0].entryPrice).toBe(48000); // Filled at limit price
        });

        it('fills short limit order when price rises to limit', () => {
            store.getState().placeOrder(
                { symbol: 'BTC', side: 'short', type: 'limit', quantity: 0.1, price: 52000 },
                50000,
            );

            store.getState().onPriceTick('BTC', 52100);

            const s = store.getState();
            expect(s.orders).toHaveLength(0);
            expect(s.positions).toHaveLength(1);
            expect(s.positions[0].entryPrice).toBe(52000);
        });

        it('does not fill limit order when price does not reach', () => {
            store.getState().placeOrder(
                { symbol: 'BTC', side: 'long', type: 'limit', quantity: 0.1, price: 48000 },
                50000,
            );

            store.getState().onPriceTick('BTC', 49000); // Not low enough
            expect(store.getState().orders).toHaveLength(1);
            expect(store.getState().positions).toHaveLength(0);
        });
    });

    // ─── Stop Orders ───────────────────────────────────────────

    describe('Stop Orders', () => {
        it('fills long stop order when price rises to stop', () => {
            store.getState().placeOrder(
                { symbol: 'BTC', side: 'long', type: 'stop', quantity: 0.1, price: 52000 },
                50000,
            );

            store.getState().onPriceTick('BTC', 52100);

            const s = store.getState();
            expect(s.orders).toHaveLength(0);
            expect(s.positions).toHaveLength(1);
            // Fill at market + slippage: 52100 + (52100 * 5/10000) = 52100 + 26.05 = 52126.05
            expect(s.positions[0].entryPrice).toBeCloseTo(52126.05, 1);
        });

        it('fills short stop order when price drops to stop', () => {
            store.getState().placeOrder(
                { symbol: 'BTC', side: 'short', type: 'stop', quantity: 0.1, price: 48000 },
                50000,
            );

            store.getState().onPriceTick('BTC', 47900);

            const s = store.getState();
            expect(s.orders).toHaveLength(0);
            expect(s.positions).toHaveLength(1);
            // Fill at market - slippage: 47900 - (47900 * 5/10000)
            expect(s.positions[0].entryPrice).toBeCloseTo(47876.05, 1);
        });
    });

    // ─── Position Close & P&L ──────────────────────────────────

    describe('Position Close & P&L', () => {
        it('closes a long position with profit', () => {
            store.getState().placeOrder(
                { symbol: 'BTC', side: 'long', type: 'market', quantity: 0.1 },
                50000,
            );
            const posId = store.getState().positions[0].id;

            store.getState().closePosition(posId, 55000);

            const s = store.getState();
            expect(s.positions).toHaveLength(0);
            expect(s.tradeHistory).toHaveLength(1);
            expect(s.tradeHistory[0].pnl).toBeGreaterThan(0);
            expect(s.tradeHistory[0].exitReason).toBe('manual');
        });

        it('closes a long position with loss', () => {
            store.getState().placeOrder(
                { symbol: 'BTC', side: 'long', type: 'market', quantity: 0.1 },
                50000,
            );
            const posId = store.getState().positions[0].id;

            store.getState().closePosition(posId, 45000);

            expect(store.getState().tradeHistory[0].pnl).toBeLessThan(0);
        });

        it('closes a short position with profit', () => {
            store.getState().placeOrder(
                { symbol: 'BTC', side: 'short', type: 'market', quantity: 0.1 },
                50000,
            );
            const posId = store.getState().positions[0].id;

            store.getState().closePosition(posId, 45000);

            expect(store.getState().tradeHistory[0].pnl).toBeGreaterThan(0);
        });

        it('cancelOrder removes pending order', () => {
            store.getState().placeOrder(
                { symbol: 'BTC', side: 'long', type: 'limit', quantity: 0.1, price: 48000 },
                50000,
            );
            const orderId = store.getState().orders[0].id;
            store.getState().cancelOrder(orderId);
            expect(store.getState().orders).toHaveLength(0);
        });
    });

    // ─── Stop Loss / Take Profit ───────────────────────────────

    describe('SL/TP Execution', () => {
        it('triggers stop loss on long position', () => {
            store.getState().placeOrder(
                { symbol: 'BTC', side: 'long', type: 'market', quantity: 0.1, stopLoss: 49000 },
                50000,
            );

            store.getState().onPriceTick('BTC', 48900); // Below SL

            const s = store.getState();
            expect(s.positions).toHaveLength(0);
            expect(s.tradeHistory).toHaveLength(1);
            expect(s.tradeHistory[0].exitReason).toBe('stop_loss');
            expect(s.tradeHistory[0].pnl).toBeLessThan(0);
        });

        it('triggers take profit on long position', () => {
            store.getState().placeOrder(
                { symbol: 'BTC', side: 'long', type: 'market', quantity: 0.1, takeProfit: 55000 },
                50000,
            );

            store.getState().onPriceTick('BTC', 55100); // Above TP

            const s = store.getState();
            expect(s.positions).toHaveLength(0);
            expect(s.tradeHistory).toHaveLength(1);
            expect(s.tradeHistory[0].exitReason).toBe('take_profit');
            expect(s.tradeHistory[0].pnl).toBeGreaterThan(0);
        });

        it('triggers stop loss on short position (price up)', () => {
            store.getState().placeOrder(
                { symbol: 'BTC', side: 'short', type: 'market', quantity: 0.1, stopLoss: 51000 },
                50000,
            );

            store.getState().onPriceTick('BTC', 51100); // Above SL for short

            const s = store.getState();
            expect(s.positions).toHaveLength(0);
            expect(s.tradeHistory[0].exitReason).toBe('stop_loss');
        });

        it('triggers take profit on short position (price down)', () => {
            store.getState().placeOrder(
                { symbol: 'BTC', side: 'short', type: 'market', quantity: 0.1, takeProfit: 48000 },
                50000,
            );

            store.getState().onPriceTick('BTC', 47500); // Below TP for short

            const s = store.getState();
            expect(s.positions).toHaveLength(0);
            expect(s.tradeHistory[0].exitReason).toBe('take_profit');
        });
    });

    // ─── Equity Tracking ───────────────────────────────────────

    describe('Equity Tracking', () => {
        it('updates unrealized P&L on price tick', () => {
            store.getState().placeOrder(
                { symbol: 'BTC', side: 'long', type: 'market', quantity: 0.1 },
                50000,
            );

            store.getState().onPriceTick('BTC', 51000);

            const pos = store.getState().positions[0];
            expect(pos.unrealizedPnL).toBeGreaterThan(0);
        });

        it('equity curve grows with ticks', () => {
            store.getState().placeOrder(
                { symbol: 'BTC', side: 'long', type: 'market', quantity: 0.1 },
                50000,
            );

            store.getState().onPriceTick('BTC', 51000);
            store.getState().onPriceTick('BTC', 52000);

            const curve = store.getState().equityCurve;
            expect(curve.length).toBeGreaterThan(1);
        });
    });

    // ─── Stats / Analytics ─────────────────────────────────────

    describe('Stats', () => {
        it('returns null with no trade history', () => {
            expect(store.getState().getStats()).toBeNull();
        });

        it('calculates correct stats after trades', () => {
            // Winning trade
            store.getState().placeOrder(
                { symbol: 'BTC', side: 'long', type: 'market', quantity: 0.1 },
                50000,
            );
            store.getState().closePosition(store.getState().positions[0].id, 55000);

            // Losing trade
            store.getState().placeOrder(
                { symbol: 'BTC', side: 'long', type: 'market', quantity: 0.1 },
                50000,
            );
            store.getState().closePosition(store.getState().positions[0].id, 45000);

            const stats = store.getState().getStats();
            expect(stats).not.toBeNull();
            expect(stats.totalTrades).toBe(2);
            expect(stats.wins).toBe(1);
            expect(stats.losses).toBe(1);
            expect(stats.winRate).toBe(50);
            expect(stats.profitFactor).toBeGreaterThan(0);
        });
    });

    // ─── Symbol Isolation ──────────────────────────────────────

    describe('Symbol Isolation', () => {
        it('does not trigger SL/TP for different symbol', () => {
            store.getState().placeOrder(
                { symbol: 'BTC', side: 'long', type: 'market', quantity: 0.1, stopLoss: 49000 },
                50000,
            );

            // ETH tick should not affect BTC position
            store.getState().onPriceTick('ETH', 1000);

            expect(store.getState().positions).toHaveLength(1);
        });
    });
});
