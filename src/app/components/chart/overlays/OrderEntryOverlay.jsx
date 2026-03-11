// ═══════════════════════════════════════════════════════════════════
// charEdge — Order Entry Overlay
//
// Shows a compact order form when Shift+Click on the chart.
// Pre-fills price from click position, auto-detects buy/sell side.
// Integrates with usePaperTradeStore (paper) and AlpacaAdapter (live).
// ═══════════════════════════════════════════════════════════════════

import { useState, useCallback, useMemo } from 'react';
import { alpacaAdapter } from '../../../../data/adapters/AlpacaAdapter.js';
import { usePaperTradeStore, ORDER_TYPES, POSITION_SIDE } from '../../../../state/usePaperTradeStore';

const SIDE_COLORS = {
  buy: { bg: 'rgba(16, 185, 129, 0.15)', border: '#10b981', text: '#34d399' },
  sell: { bg: 'rgba(239, 68, 68, 0.15)', border: '#ef4444', text: '#f87171' },
};

export default function OrderEntryOverlay({
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
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: -1,
          background: 'transparent',
        }}
        onClick={onClose}
      />

      <form
        onSubmit={handleSubmit}
        style={{
          background: 'var(--color-surface, #1a1a2e)',
          border: `1px solid ${colors.border}`,
          borderRadius: 12,
          padding: 16,
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          fontFamily: "'Inter', sans-serif",
          color: 'var(--color-text, #e2e8f0)',
          fontSize: 13,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>
            {isLive ? '🟢 Live' : '📝 Paper'} Order
          </span>
          <span style={{ fontWeight: 600, color: 'var(--color-text-muted, #94a3b8)' }}>
            {symbol}
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: 'var(--color-text-muted, #94a3b8)',
              cursor: 'pointer', fontSize: 18, lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Side Toggle */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {['buy', 'sell'].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSide(s)}
              style={{
                flex: 1,
                padding: '6px 0',
                borderRadius: 6,
                border: `1px solid ${s === side ? SIDE_COLORS[s].border : 'var(--color-border, #334155)'}`,
                background: s === side ? SIDE_COLORS[s].bg : 'transparent',
                color: s === side ? SIDE_COLORS[s].text : 'var(--color-text-muted, #94a3b8)',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
                textTransform: 'uppercase',
              }}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Order Type */}
        <div style={{ marginBottom: 10 }}>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--color-text-muted, #94a3b8)', marginBottom: 3 }}>
            Type
          </label>
          <select
            value={orderType}
            onChange={(e) => setOrderType(e.target.value)}
            style={{
              width: '100%', padding: '6px 8px', borderRadius: 6,
              background: 'var(--color-surface-alt, #16213e)',
              border: '1px solid var(--color-border, #334155)',
              color: 'var(--color-text, #e2e8f0)', fontSize: 13,
            }}
          >
            <option value="market">Market</option>
            <option value="limit">Limit</option>
            <option value="stop">Stop</option>
            <option value="stop_limit">Stop Limit</option>
          </select>
        </div>

        {/* Price (for limit/stop orders) */}
        {orderType !== 'market' && (
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--color-text-muted, #94a3b8)', marginBottom: 3 }}>
              {orderType === 'stop' ? 'Stop Price' : 'Limit Price'}
            </label>
            <input
              type="number"
              step="0.01"
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value)}
              style={{
                width: '100%', padding: '6px 8px', borderRadius: 6,
                background: 'var(--color-surface-alt, #16213e)',
                border: `1px solid ${colors.border}`,
                color: colors.text, fontSize: 14, fontWeight: 600,
                boxSizing: 'border-box',
              }}
            />
          </div>
        )}

        {/* Quantity */}
        <div style={{ marginBottom: 10 }}>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--color-text-muted, #94a3b8)', marginBottom: 3 }}>
            Quantity
          </label>
          <input
            type="number"
            min="1"
            step="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            style={{
              width: '100%', padding: '6px 8px', borderRadius: 6,
              background: 'var(--color-surface-alt, #16213e)',
              border: '1px solid var(--color-border, #334155)',
              color: 'var(--color-text, #e2e8f0)', fontSize: 13,
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            {[0.25, 0.5, 0.75, 1].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => setQtyPercent(pct)}
                style={{
                  flex: 1, padding: '3px 0', borderRadius: 4,
                  background: 'var(--color-surface-alt, #16213e)',
                  border: '1px solid var(--color-border, #334155)',
                  color: 'var(--color-text-muted, #94a3b8)', fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                {pct * 100}%
              </button>
            ))}
          </div>
        </div>

        {/* SL/TP (paper only) */}
        {!isLive && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 11, color: '#ef4444', marginBottom: 3 }}>
                Stop Loss
              </label>
              <input
                type="number"
                step="0.01"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                placeholder="—"
                style={{
                  width: '100%', padding: '5px 6px', borderRadius: 6,
                  background: 'var(--color-surface-alt, #16213e)',
                  border: '1px solid var(--color-border, #334155)',
                  color: 'var(--color-text, #e2e8f0)', fontSize: 12,
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 11, color: '#10b981', marginBottom: 3 }}>
                Take Profit
              </label>
              <input
                type="number"
                step="0.01"
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
                placeholder="—"
                style={{
                  width: '100%', padding: '5px 6px', borderRadius: 6,
                  background: 'var(--color-surface-alt, #16213e)',
                  border: '1px solid var(--color-border, #334155)',
                  color: 'var(--color-text, #e2e8f0)', fontSize: 12,
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>
        )}

        {/* Estimated cost */}
        <div style={{
          padding: '6px 8px', borderRadius: 6, marginBottom: 10,
          background: 'var(--color-surface-alt, #16213e)',
          fontSize: 11, color: 'var(--color-text-muted, #94a3b8)',
          display: 'flex', justifyContent: 'space-between',
        }}>
          <span>Est. Cost</span>
          <span style={{ color: 'var(--color-text, #e2e8f0)', fontWeight: 600 }}>
            ${((parseFloat(quantity) || 0) * (orderType === 'market' ? currentPrice : (parseFloat(limitPrice) || 0))).toFixed(2)}
          </span>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            padding: '6px 8px', borderRadius: 6, marginBottom: 10,
            background: 'rgba(239, 68, 68, 0.15)', color: '#f87171',
            fontSize: 12,
          }}>
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          style={{
            width: '100%',
            padding: '10px 0',
            borderRadius: 8,
            border: 'none',
            background: side === 'buy'
              ? 'linear-gradient(135deg, #10b981, #059669)'
              : 'linear-gradient(135deg, #ef4444, #dc2626)',
            color: '#fff',
            fontWeight: 700,
            fontSize: 14,
            cursor: submitting ? 'wait' : 'pointer',
            opacity: submitting ? 0.6 : 1,
            transition: 'opacity 0.15s',
          }}
        >
          {submitting
            ? 'Placing...'
            : `${side.toUpperCase()} ${quantity} ${symbol} @ ${orderType === 'market' ? 'MKT' : `$${limitPrice}`}`}
        </button>
      </form>
    </div>
  );
}
