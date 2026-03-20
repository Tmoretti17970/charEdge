// ═══════════════════════════════════════════════════════════════════
// charEdge — Order Entry Overlay
//
// Shows a compact order form when Shift+Click on the chart.
// Pre-fills price from click position, auto-detects buy/sell side.
// Integrates with usePaperTradeStore (paper) and AlpacaAdapter (live).
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useState, useCallback, useMemo } from 'react';
import { alpacaAdapter } from '../../../../data/adapters/AlpacaAdapter.js';
import { usePaperTradeStore, ORDER_TYPES, POSITION_SIDE } from '../../../../state/usePaperTradeStore';
import s from './OrderEntryOverlay.module.css';

const SIDE_COLORS = {
  buy: { bg: 'rgba(16, 185, 129, 0.15)', border: '#10b981', text: '#34d399' },
  sell: { bg: 'rgba(239, 68, 68, 0.15)', border: '#ef4444', text: '#f87171' },
};

function OrderEntryOverlay({
  symbol,
  price,
  currentPrice,
  position,  // { x, y } screen position for the overlay
  onClose,
  onOrderPlaced,
}) {
  const paperStore = usePaperTradeStore();

  // Auto-detect side: above current → sell, below → buy
  const defaultSide = price >= currentPrice ? 'sell' : 'buy';

  const [side, setSide] = useState(defaultSide);
  const [orderType, setOrderType] = useState('limit');
  const [quantity, setQuantity] = useState('1');
  const [limitPrice, setLimitPrice] = useState(price.toFixed(2));
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isLive = alpacaAdapter.isConfigured;
  const colors = SIDE_COLORS[side];

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    const qty = parseFloat(quantity);
    const lp = parseFloat(limitPrice);

    if (!qty || qty <= 0) {
      setError('Invalid quantity');
      setSubmitting(false);
      return;
    }

    try {
      if (isLive) {
        // Live trading via Alpaca
        await alpacaAdapter.placeOrder({
          symbol,
          qty,
          side,
          type: orderType,
          limitPrice: orderType === 'limit' || orderType === 'stop_limit' ? lp : undefined,
          stopPrice: orderType === 'stop' || orderType === 'stop_limit' ? lp : undefined,
          timeInForce: 'day',
        });
      } else {
        // Paper trading
        paperStore.placeOrder({
          symbol,
          side: side === 'buy' ? POSITION_SIDE.LONG : POSITION_SIDE.SHORT,
          type: orderType === 'market' ? ORDER_TYPES.MARKET : ORDER_TYPES.LIMIT,
          quantity: qty,
          price: orderType !== 'market' ? lp : undefined,
          stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
          takeProfit: takeProfit ? parseFloat(takeProfit) : undefined,
          exactFill: true, // Chart-click = exact price, no slippage
        }, currentPrice);
      }

      onOrderPlaced?.({ side, type: orderType, qty, price: lp });
      onClose();
    } catch (err) {
      setError(err.message || 'Order failed');
    } finally {
      setSubmitting(false);
    }
  }, [side, orderType, quantity, limitPrice, stopLoss, takeProfit, symbol, currentPrice, isLive, paperStore, onOrderPlaced, onClose]);

  // Quick quantity buttons
  const balance = paperStore.balance || 10000;
  const setQtyPercent = useCallback((pct) => {
    const maxQty = Math.floor((balance * pct) / (parseFloat(limitPrice) || currentPrice));
    setQuantity(String(Math.max(1, maxQty)));
  }, [balance, limitPrice, currentPrice]);

  // Position the overlay near the click, clamped to viewport
  const overlayStyle = useMemo(() => {
    const x = Math.min((position?.x || 200), window.innerWidth - 320);
    const y = Math.min((position?.y || 200), window.innerHeight - 450);
    return {
      position: 'fixed',
      left: x,
      top: y,
      zIndex: 10000,
      width: 280,
    };
  }, [position]);

  return (
    <div style={overlayStyle}>
      {/* Backdrop click to close */}
      <div className={s.backdrop} onClick={onClose} />

      <form
        onSubmit={handleSubmit}
        className={s.form}
        style={{ border: `1px solid ${colors.border}` }}
      >
        {/* Header */}
        <div className={s.header}>
          <span className={s.headerTitle}>
            {isLive ? '🟢 Live' : '📝 Paper'} Order
          </span>
          <span className={s.headerSymbol}>
            {symbol}
          </span>
          <button type="button" onClick={onClose} className={s.closeBtn}>
            ×
          </button>
        </div>

        {/* Side Toggle */}
        <div className={s.sideRow}>
          {['buy', 'sell'].map((sd) => (
            <button
              key={sd}
              type="button"
              onClick={() => setSide(sd)}
              className={s.sideBtn}
              style={{
                border: `1px solid ${sd === side ? SIDE_COLORS[sd].border : 'var(--color-border, #334155)'}`,
                background: sd === side ? SIDE_COLORS[sd].bg : 'transparent',
                color: sd === side ? SIDE_COLORS[sd].text : 'var(--color-text-muted, #94a3b8)',
              }}
            >
              {sd}
            </button>
          ))}
        </div>

        {/* Order Type */}
        <div className={s.fieldGroup}>
          <label className={s.fieldLabel}>Type</label>
          <select value={orderType} onChange={(e) => setOrderType(e.target.value)} className={s.selectInput}>
            <option value="market">Market</option>
            <option value="limit">Limit</option>
            <option value="stop">Stop</option>
            <option value="stop_limit">Stop Limit</option>
          </select>
        </div>

        {/* Price (for limit/stop orders) */}
        {orderType !== 'market' && (
          <div className={s.fieldGroup}>
            <label className={s.fieldLabel}>
              {orderType === 'stop' ? 'Stop Price' : 'Limit Price'}
            </label>
            <input
              type="number"
              step="0.01"
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value)}
              className={s.textInput}
              style={{ border: `1px solid ${colors.border}`, color: colors.text, fontWeight: 600, fontSize: 14 }}
            />
          </div>
        )}

        {/* Quantity */}
        <div className={s.fieldGroup}>
          <label className={s.fieldLabel}>Quantity</label>
          <input
            type="number" min="1" step="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className={s.textInput}
          />
          <div className={s.qtyRow}>
            {[0.25, 0.5, 0.75, 1].map((pct) => (
              <button key={pct} type="button" onClick={() => setQtyPercent(pct)} className={s.qtyBtn}>
                {pct * 100}%
              </button>
            ))}
          </div>
        </div>

        {/* SL/TP (paper only) */}
        {!isLive && (
          <div className={s.slTpRow}>
            <div className={s.slTpCol}>
              <label className={s.fieldLabelSL}>Stop Loss</label>
              <input
                type="number" step="0.01" value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                placeholder="—"
                className={s.smallInput}
              />
            </div>
            <div className={s.slTpCol}>
              <label className={s.fieldLabelTP}>Take Profit</label>
              <input
                type="number" step="0.01" value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
                placeholder="—"
                className={s.smallInput}
              />
            </div>
          </div>
        )}

        {/* Estimated cost */}
        <div className={s.costBox}>
          <span>Est. Cost</span>
          <span className={s.costValue}>
            ${((parseFloat(quantity) || 0) * (orderType === 'market' ? currentPrice : (parseFloat(limitPrice) || 0))).toFixed(2)}
          </span>
        </div>

        {error && (
          <div className={s.errorBox}>
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className={s.submitBtn}
          data-side={side}
        >
          {submitting
            ? 'Placing...'
            : `${side.toUpperCase()} ${quantity} ${symbol} @ ${orderType === 'market' ? 'MKT' : `$${limitPrice}`}`}
        </button>
      </form>
    </div>
  );
}

export default React.memo(OrderEntryOverlay);
