// ═══════════════════════════════════════════════════════════════════
// charEdge — Position Management Panel
//
// Bottom chart panel showing open positions, pending orders,
// and account summary. Works with both paper trading and Alpaca live.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { usePaperTradeStore } from '../../../../state/usePaperTradeStore.js';
import { alpacaAdapter } from '../../../../data/adapters/AlpacaAdapter.js';

// ─── Styles ─────────────────────────────────────────────────────

const styles = {
  container: {
    background: 'var(--color-surface, #1a1a2e)',
    borderTop: '1px solid var(--color-border, #334155)',
    fontFamily: "'Inter', sans-serif",
    fontSize: 12,
    color: 'var(--color-text, #e2e8f0)',
    maxHeight: 240,
    overflowY: 'auto',
  },
  tabs: {
    display: 'flex',
    gap: 0,
    borderBottom: '1px solid var(--color-border, #334155)',
  },
  tab: (active) => ({
    padding: '8px 16px',
    cursor: 'pointer',
    fontWeight: active ? 700 : 400,
    color: active ? 'var(--color-primary, #818cf8)' : 'var(--color-text-muted, #94a3b8)',
    borderBottom: active ? '2px solid var(--color-primary, #818cf8)' : '2px solid transparent',
    background: 'transparent',
    border: 'none',
    fontSize: 12,
  }),
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    padding: '6px 10px',
    textAlign: 'left',
    color: 'var(--color-text-muted, #94a3b8)',
    fontWeight: 600,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    borderBottom: '1px solid var(--color-border, #334155)',
  },
  td: {
    padding: '6px 10px',
    borderBottom: '1px solid rgba(51, 65, 85, 0.3)',
  },
  plPositive: { color: '#10b981', fontWeight: 600 },
  plNegative: { color: '#ef4444', fontWeight: 600 },
  closeBtn: {
    padding: '3px 10px',
    borderRadius: 4,
    border: '1px solid #ef4444',
    background: 'rgba(239, 68, 68, 0.1)',
    color: '#f87171',
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 600,
  },
  cancelBtn: {
    padding: '3px 10px',
    borderRadius: 4,
    border: '1px solid var(--color-border, #334155)',
    background: 'transparent',
    color: 'var(--color-text-muted, #94a3b8)',
    cursor: 'pointer',
    fontSize: 11,
  },
  summaryBar: {
    display: 'flex',
    gap: 24,
    padding: '6px 12px',
    background: 'var(--color-surface-alt, #16213e)',
    borderBottom: '1px solid var(--color-border, #334155)',
    fontSize: 11,
  },
  summaryItem: {
    display: 'flex',
    gap: 6,
    alignItems: 'center',
  },
  summaryLabel: {
    color: 'var(--color-text-muted, #94a3b8)',
  },
  summaryValue: {
    fontWeight: 600,
  },
  empty: {
    padding: '20px 0',
    textAlign: 'center',
    color: 'var(--color-text-muted, #94a3b8)',
    fontSize: 12,
  },
};

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
    } catch {
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
    <div style={styles.container}>
      {/* Account Summary Bar */}
      <div style={styles.summaryBar}>
        <div style={styles.summaryItem}>
          <span style={styles.summaryLabel}>{isLive ? '🟢 Live' : '📝 Paper'}</span>
        </div>
        <div style={styles.summaryItem}>
          <span style={styles.summaryLabel}>Balance</span>
          <span style={styles.summaryValue}>${account.balance?.toFixed(2)}</span>
        </div>
        <div style={styles.summaryItem}>
          <span style={styles.summaryLabel}>Equity</span>
          <span style={styles.summaryValue}>${account.equity?.toFixed(2)}</span>
        </div>
        <div style={styles.summaryItem}>
          <span style={styles.summaryLabel}>P&L</span>
          <span style={totalPl >= 0 ? styles.plPositive : styles.plNegative}>
            {totalPl >= 0 ? '+' : ''}{totalPl.toFixed(2)}
          </span>
        </div>
        <div style={styles.summaryItem}>
          <span style={styles.summaryLabel}>Buying Power</span>
          <span style={styles.summaryValue}>${account.buyingPower?.toFixed(2)}</span>
        </div>
        {loading && <span style={{ color: 'var(--color-primary, #818cf8)' }}>⟳</span>}
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        <button
          style={styles.tab(activeTab === 'positions')}
          onClick={() => setActiveTab('positions')}
        >
          Positions ({positions.length})
        </button>
        <button
          style={styles.tab(activeTab === 'orders')}
          onClick={() => setActiveTab('orders')}
        >
          Orders ({orders.length})
        </button>
      </div>

      {/* Positions Tab */}
      {activeTab === 'positions' && (
        positions.length === 0 ? (
          <div style={styles.empty}>No open positions</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Symbol</th>
                <th style={styles.th}>Side</th>
                <th style={styles.th}>Qty</th>
                <th style={styles.th}>Entry</th>
                <th style={styles.th}>Current</th>
                <th style={{...styles.th, textAlign: 'right'}}>P&L</th>
                <th style={{...styles.th, textAlign: 'right'}}>P&L %</th>
                <th style={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p, i) => {
                const pl = p.unrealizedPl || 0;
                const plPct = p.unrealizedPlPct || 0;
                return (
                  <tr key={p.id || p.symbol || i}>
                    <td style={{...styles.td, fontWeight: 600}}>{p.symbol}</td>
                    <td style={{
                      ...styles.td,
                      color: p.side === 'long' || p.side === 'buy' ? '#10b981' : '#ef4444',
                      fontWeight: 600, textTransform: 'uppercase',
                    }}>
                      {p.side}
                    </td>
                    <td style={styles.td}>{p.qty}</td>
                    <td style={styles.td}>${p.entryPrice?.toFixed(2)}</td>
                    <td style={styles.td}>${p.currentPrice?.toFixed(2)}</td>
                    <td style={{
                      ...styles.td, textAlign: 'right',
                      ...(pl >= 0 ? styles.plPositive : styles.plNegative),
                    }}>
                      {pl >= 0 ? '+' : ''}{pl.toFixed(2)}
                    </td>
                    <td style={{
                      ...styles.td, textAlign: 'right',
                      ...(plPct >= 0 ? styles.plPositive : styles.plNegative),
                    }}>
                      {plPct >= 0 ? '+' : ''}{plPct.toFixed(2)}%
                    </td>
                    <td style={styles.td}>
                      <button style={styles.closeBtn} onClick={() => handleClose(p)}>
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
          <div style={styles.empty}>No pending orders</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Symbol</th>
                <th style={styles.th}>Side</th>
                <th style={styles.th}>Type</th>
                <th style={styles.th}>Qty</th>
                <th style={styles.th}>Price</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o, i) => (
                <tr key={o.id || i}>
                  <td style={{...styles.td, fontWeight: 600}}>{o.symbol}</td>
                  <td style={{
                    ...styles.td,
                    color: o.side === 'buy' || o.side === 'long' ? '#10b981' : '#ef4444',
                    fontWeight: 600, textTransform: 'uppercase',
                  }}>
                    {o.side}
                  </td>
                  <td style={styles.td}>{o.type}</td>
                  <td style={styles.td}>{o.qty || o.quantity}</td>
                  <td style={styles.td}>${(o.limit_price || o.price || 0).toFixed?.(2) || o.limit_price || o.price || '—'}</td>
                  <td style={styles.td}>{o.status}</td>
                  <td style={styles.td}>
                    <button style={styles.cancelBtn} onClick={() => handleCancel(o)}>
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
