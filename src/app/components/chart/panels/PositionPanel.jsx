// ═══════════════════════════════════════════════════════════════════
// charEdge — Position Management Panel
//
// Bottom chart panel showing open positions, pending orders,
// and account summary. Works with both paper trading and Alpaca live.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo, useCallback } from 'react';
import { alpacaAdapter } from '../../../../data/adapters/AlpacaAdapter.js';
import { usePaperTradeStore } from '../../../../state/usePaperTradeStore';
import s from './PositionPanel.module.css';

// ─── Component ──────────────────────────────────────────────────

export default function PositionPanel({ currentPrice, symbol }) {
  const [activeTab, setActiveTab] = useState('positions');
  const [livePositions, setLivePositions] = useState([]);
  const [liveOrders, setLiveOrders] = useState([]);
  const [liveAccount, setLiveAccount] = useState(null);
  const [loading, setLoading] = useState(false);

  const paperStore = usePaperTradeStore();
  const isLive = alpacaAdapter.isConfigured;

  // ─── Data Loading ───────────────────────────────────────────

  const refreshLive = useCallback(async () => {
    if (!isLive) return;
    setLoading(true);
    try {
      const [pos, ord, acc] = await Promise.all([
        alpacaAdapter.getPositions(),
        alpacaAdapter.getOrders('open'),
        alpacaAdapter.getAccount(),
      ]);
      setLivePositions(pos || []);
      setLiveOrders(ord || []);
      setLiveAccount(acc);
    // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (_) {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [isLive]);

  useEffect(() => {
    refreshLive();
    // Poll every 10 seconds for live data
    if (isLive) {
      const timer = setInterval(refreshLive, 10_000);
      return () => clearInterval(timer);
    }
  }, [isLive, refreshLive]);

  // ─── Paper Data ─────────────────────────────────────────────

  const paperPositions = useMemo(() =>
    (paperStore.positions || []).map((p) => ({
      id: p.id,
      symbol: p.symbol,
      side: p.side,
      qty: p.quantity,
      entryPrice: p.entryPrice,
      currentPrice: p.symbol === symbol ? currentPrice : p.entryPrice,
      unrealizedPl: p.side === 'long'
        ? (currentPrice - p.entryPrice) * p.quantity
        : (p.entryPrice - currentPrice) * p.quantity,
      unrealizedPlPct: p.side === 'long'
        ? ((currentPrice - p.entryPrice) / p.entryPrice) * 100
        : ((p.entryPrice - currentPrice) / p.entryPrice) * 100,
    })),
  [paperStore.positions, currentPrice, symbol]);

  const paperOrders = useMemo(() =>
    (paperStore.orders || []).filter((o) => o.status === 'pending'),
  [paperStore.orders]);

  const positions = isLive ? livePositions : paperPositions;
  const orders = isLive ? liveOrders : paperOrders;

  // ─── Account Summary ───────────────────────────────────────

  const account = useMemo(() => {
    if (isLive && liveAccount) {
      return {
        balance: liveAccount.cash,
        equity: liveAccount.equity,
        buyingPower: liveAccount.buyingPower,
      };
    }
    const stats = paperStore.getStats?.() || {};
    return {
      balance: paperStore.balance || 10000,
      equity: (paperStore.balance || 10000) + (stats.unrealizedPl || 0),
      buyingPower: paperStore.balance || 10000,
    };
  }, [isLive, liveAccount, paperStore]);

  const totalPl = positions.reduce((sum, p) => sum + (p.unrealizedPl || 0), 0);

  // ─── Actions ────────────────────────────────────────────────

  const handleClose = useCallback(async (pos) => {
    if (isLive) {
      await alpacaAdapter.closePosition(pos.symbol);
      refreshLive();
    } else {
      paperStore.closePosition(pos.id, currentPrice);
    }
  }, [isLive, paperStore, currentPrice, refreshLive]);

  const handleCancel = useCallback(async (order) => {
    if (isLive) {
      await alpacaAdapter.cancelOrder(order.id);
      refreshLive();
    } else {
      paperStore.cancelOrder(order.id);
    }
  }, [isLive, paperStore, refreshLive]);

  // ─── Render ─────────────────────────────────────────────────

  return (
    <div className={s.container}>
      {/* Account Summary Bar */}
      <div className={s.summaryBar}>
        <div className={s.summaryItem}>
          <span className={s.summaryLabel}>{isLive ? '🟢 Live' : '📝 Paper'}</span>
        </div>
        <div className={s.summaryItem}>
          <span className={s.summaryLabel}>Balance</span>
          <span className={s.summaryValue}>${account.balance?.toFixed(2)}</span>
        </div>
        <div className={s.summaryItem}>
          <span className={s.summaryLabel}>Equity</span>
          <span className={s.summaryValue}>${account.equity?.toFixed(2)}</span>
        </div>
        <div className={s.summaryItem}>
          <span className={s.summaryLabel}>P&L</span>
          <span className={totalPl >= 0 ? s.plPositive : s.plNegative}>
            {totalPl >= 0 ? '+' : ''}{totalPl.toFixed(2)}
          </span>
        </div>
        <div className={s.summaryItem}>
          <span className={s.summaryLabel}>Buying Power</span>
          <span className={s.summaryValue}>${account.buyingPower?.toFixed(2)}</span>
        </div>
        {loading && <span style={{ color: 'var(--color-primary, #818cf8)' }}>⟳</span>}
      </div>

      {/* Tabs */}
      <div className={s.tabs}>
        <button
          className={`${s.tab} ${activeTab === 'positions' ? s.tabActive : ''}`}
          onClick={() => setActiveTab('positions')}
        >
          Positions ({positions.length})
        </button>
        <button
          className={`${s.tab} ${activeTab === 'orders' ? s.tabActive : ''}`}
          onClick={() => setActiveTab('orders')}
        >
          Orders ({orders.length})
        </button>
      </div>

      {/* Positions Tab */}
      {activeTab === 'positions' && (
        positions.length === 0 ? (
          <div className={s.empty}>No open positions</div>
        ) : (
          <table className={s.table}>
            <thead>
              <tr>
                <th className={s.th}>Symbol</th>
                <th className={s.th}>Side</th>
                <th className={s.th}>Qty</th>
                <th className={s.th}>Entry</th>
                <th className={s.th}>Current</th>
                <th className={s.thRight}>P&L</th>
                <th className={s.thRight}>P&L %</th>
                <th className={s.th} />
              </tr>
            </thead>
            <tbody>
              {positions.map((p, i) => {
                const pl = p.unrealizedPl || 0;
                const plPct = p.unrealizedPlPct || 0;
                return (
                  <tr key={p.id || p.symbol || i}>
                    <td className={s.tdBold}>{p.symbol}</td>
                    <td className={`${s.td} ${p.side === 'long' || p.side === 'buy' ? s.sideLong : s.sideShort}`}>
                      {p.side}
                    </td>
                    <td className={s.td}>{p.qty}</td>
                    <td className={s.td}>${p.entryPrice?.toFixed(2)}</td>
                    <td className={s.td}>${p.currentPrice?.toFixed(2)}</td>
                    <td className={`${s.tdRight} ${pl >= 0 ? s.plPositive : s.plNegative}`}>
                      {pl >= 0 ? '+' : ''}{pl.toFixed(2)}
                    </td>
                    <td className={`${s.tdRight} ${plPct >= 0 ? s.plPositive : s.plNegative}`}>
                      {plPct >= 0 ? '+' : ''}{plPct.toFixed(2)}%
                    </td>
                    <td className={s.td}>
                      <button className={s.closeBtn} onClick={() => handleClose(p)}>
                        Close
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )
      )}

      {/* Orders Tab */}
      {activeTab === 'orders' && (
        orders.length === 0 ? (
          <div className={s.empty}>No pending orders</div>
        ) : (
          <table className={s.table}>
            <thead>
              <tr>
                <th className={s.th}>Symbol</th>
                <th className={s.th}>Side</th>
                <th className={s.th}>Type</th>
                <th className={s.th}>Qty</th>
                <th className={s.th}>Price</th>
                <th className={s.th}>Status</th>
                <th className={s.th} />
              </tr>
            </thead>
            <tbody>
              {orders.map((o, i) => (
                <tr key={o.id || i}>
                  <td className={s.tdBold}>{o.symbol}</td>
                  <td className={`${s.td} ${o.side === 'buy' || o.side === 'long' ? s.sideLong : s.sideShort}`}>
                    {o.side}
                  </td>
                  <td className={s.td}>{o.type}</td>
                  <td className={s.td}>{o.qty || o.quantity}</td>
                  <td className={s.td}>${(o.limit_price || o.price || 0).toFixed?.(2) || o.limit_price || o.price || '—'}</td>
                  <td className={s.td}>{o.status}</td>
                  <td className={s.td}>
                    <button className={s.cancelBtn} onClick={() => handleCancel(o)}>
                      Cancel
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}
    </div>
  );
}
