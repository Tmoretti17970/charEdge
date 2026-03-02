// ═══════════════════════════════════════════════════════════════════
// charEdge — Paper Trade Widget
// A compact floating widget for paper trading: place orders,
// view open positions, and track performance.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useMemo } from 'react';
import { usePaperTradeStore, ORDER_TYPES, POSITION_SIDE } from '../../../../state/usePaperTradeStore.js';

export default function PaperTradeWidget({ symbol, currentPrice, onClose }) {
  const store = usePaperTradeStore();
  const { enabled, positions, orders, balance, equity, tradeHistory } = store;
  const [tab, setTab] = useState('trade');
  const [side, setSide] = useState('long');
  const [orderType, setOrderType] = useState('market');
  const [quantity, setQuantity] = useState(0.01);
  const [limitPrice, setLimitPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');

  const stats = useMemo(() => store.getStats(), [tradeHistory, equity]);
  const pnlColor = (equity - store.initialBalance) >= 0 ? '#26A69A' : '#EF5350';

  const handlePlace = () => {
    if (!currentPrice || !quantity) return;
    store.placeOrder({
      symbol: symbol || 'BTC',
      side,
      type: orderType,
      quantity: parseFloat(quantity),
      price: limitPrice ? parseFloat(limitPrice) : undefined,
      stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
      takeProfit: takeProfit ? parseFloat(takeProfit) : undefined,
    }, currentPrice);
  };

  if (!enabled) {
    return (
      <div className="tf-paper-widget tf-fade-scale">
        <div className="tf-paper-header">
          <span>📋 Paper Trading</span>
          <button className="tf-paper-close" onClick={onClose}>✕</button>
        </div>
        <div className="tf-paper-disabled">
          <p>Simulated trading with virtual money</p>
          <button className="tf-paper-enable-btn" onClick={store.enable}>Enable Paper Trading</button>
        </div>
      </div>
    );
  }

  return (
    <div className="tf-paper-widget tf-fade-scale">
      {/* Header */}
      <div className="tf-paper-header">
        <div className="tf-paper-header__left">
          <span className="tf-paper-badge">PAPER</span>
          <span className="tf-paper-balance">${equity.toFixed(2)}</span>
          <span style={{ color: pnlColor, fontSize: 10, fontWeight: 600 }}>
            {(equity - store.initialBalance) >= 0 ? '+' : ''}
            ${(equity - store.initialBalance).toFixed(2)}
          </span>
        </div>
        <button className="tf-paper-close" onClick={onClose}>✕</button>
      </div>

      {/* Tabs */}
      <div className="tf-paper-tabs">
        {['trade', 'positions', 'history'].map(t => (
          <button
            key={t}
            className={`tf-paper-tab ${tab === t ? 'tf-paper-tab--active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'trade' ? '📝 Trade' : t === 'positions' ? `📊 Open (${positions.length})` : `📜 History`}
          </button>
        ))}
      </div>

      {/* Trade Form */}
      {tab === 'trade' && (
        <div className="tf-paper-form">
          <div className="tf-paper-side-toggle">
            <button
              className={`tf-paper-side-btn ${side === 'long' ? 'tf-paper-side-btn--long' : ''}`}
              onClick={() => setSide('long')}
            >▲ Long</button>
            <button
              className={`tf-paper-side-btn ${side === 'short' ? 'tf-paper-side-btn--short' : ''}`}
              onClick={() => setSide('short')}
            >▼ Short</button>
          </div>

          <div className="tf-paper-field">
            <label>Type</label>
            <select value={orderType} onChange={e => setOrderType(e.target.value)}>
              <option value="market">Market</option>
              <option value="limit">Limit</option>
              <option value="stop">Stop</option>
            </select>
          </div>

          <div className="tf-paper-field">
            <label>Quantity</label>
            <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} step="0.01" min="0.001" />
          </div>

          {orderType !== 'market' && (
            <div className="tf-paper-field">
              <label>Price</label>
              <input type="number" value={limitPrice} onChange={e => setLimitPrice(e.target.value)} placeholder={currentPrice?.toFixed(2)} />
            </div>
          )}

          <div className="tf-paper-sltp">
            <div className="tf-paper-field tf-paper-field--half">
              <label>Stop Loss</label>
              <input type="number" value={stopLoss} onChange={e => setStopLoss(e.target.value)} placeholder="—" />
            </div>
            <div className="tf-paper-field tf-paper-field--half">
              <label>Take Profit</label>
              <input type="number" value={takeProfit} onChange={e => setTakeProfit(e.target.value)} placeholder="—" />
            </div>
          </div>

          <button
            className={`tf-paper-place-btn tf-paper-place-btn--${side}`}
            onClick={handlePlace}
          >
            {side === 'long' ? '▲ Buy' : '▼ Sell'} {orderType === 'market' ? 'Market' : orderType}
          </button>
        </div>
      )}

      {/* Positions */}
      {tab === 'positions' && (
        <div className="tf-paper-positions">
          {positions.length === 0 && <div className="tf-paper-empty">No open positions</div>}
          {positions.map(pos => (
            <div key={pos.id} className="tf-paper-position">
              <div className="tf-paper-position__info">
                <span className={`tf-paper-position__side tf-paper-position__side--${pos.side}`}>
                  {pos.side === 'long' ? '▲' : '▼'} {pos.symbol}
                </span>
                <span className="tf-paper-position__qty">{pos.quantity}</span>
              </div>
              <div className="tf-paper-position__meta">
                <span>Entry: ${pos.entryPrice.toFixed(2)}</span>
                <span style={{ color: pos.unrealizedPnL >= 0 ? '#26A69A' : '#EF5350' }}>
                  P&L: {pos.unrealizedPnL >= 0 ? '+' : ''}${pos.unrealizedPnL.toFixed(2)}
                </span>
              </div>
              <button
                className="tf-paper-position__close"
                onClick={() => store.closePosition(pos.id, currentPrice)}
              >Close</button>
            </div>
          ))}
          {positions.length > 0 && (
            <button
              className="tf-paper-close-all"
              onClick={() => store.closeAllPositions(currentPrice)}
            >Close All Positions</button>
          )}
        </div>
      )}

      {/* History */}
      {tab === 'history' && (
        <div className="tf-paper-history">
          {stats && (
            <div className="tf-paper-stats">
              <div className="tf-paper-stat">
                <span>Win Rate</span><span>{stats.winRate}%</span>
              </div>
              <div className="tf-paper-stat">
                <span>Profit Factor</span><span>{stats.profitFactor === Infinity ? '∞' : stats.profitFactor}</span>
              </div>
              <div className="tf-paper-stat">
                <span>Avg Win</span><span style={{ color: '#26A69A' }}>${stats.avgWin}</span>
              </div>
              <div className="tf-paper-stat">
                <span>Avg Loss</span><span style={{ color: '#EF5350' }}>-${stats.avgLoss}</span>
              </div>
            </div>
          )}
          {tradeHistory.length === 0 && <div className="tf-paper-empty">No trades yet</div>}
          {tradeHistory.slice(0, 20).map(t => (
            <div key={t.id} className="tf-paper-trade-row">
              <span className={t.side === 'long' ? 'tf-paper-trade-row--long' : 'tf-paper-trade-row--short'}>
                {t.side === 'long' ? '▲' : '▼'}
              </span>
              <span>{t.symbol}</span>
              <span style={{ color: t.pnl >= 0 ? '#26A69A' : '#EF5350' }}>
                {t.pnl >= 0 ? '+' : ''}${t.pnl}
              </span>
              <span className="tf-paper-trade-row__reason">{t.exitReason}</span>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="tf-paper-footer">
        <button className="tf-paper-reset-btn" onClick={store.resetAccount}>Reset Account</button>
        <button className="tf-paper-disable-btn" onClick={store.disable}>Disable</button>
      </div>
    </div>
  );
}
