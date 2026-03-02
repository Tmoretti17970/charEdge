// ═══════════════════════════════════════════════════════════════════
// charEdge — DOM Ladder (Depth of Market on Chart)
// Mini depth-of-market overlay on the right side of the chart
// Shows bid/ask levels with size bars and cumulative delta
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef, useMemo } from 'react';

const ROWS = 20;
const MAX_DISPLAY_LEVELS = 10; // per side

const styles = {
  container: {
    position: 'absolute', right: 0, top: 0, bottom: 0,
    width: 110, background: 'rgba(19, 23, 34, 0.92)',
    backdropFilter: 'blur(4px)',
    borderLeft: '1px solid rgba(255,255,255,0.06)',
    display: 'flex', flexDirection: 'column',
    fontSize: 10, fontFamily: "'JetBrains Mono', monospace",
    zIndex: 10, overflow: 'hidden',
    userSelect: 'none',
  },
  header: {
    padding: '4px 6px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    background: 'rgba(255,255,255,0.02)',
  },
  title: { fontSize: 9, fontWeight: 700, color: '#787B86', letterSpacing: 1 },
  rows: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  row: {
    display: 'flex', alignItems: 'center',
    padding: '1px 4px', height: 18,
    position: 'relative',
  },
  price: {
    width: 48, textAlign: 'right',
    fontWeight: 600, fontSize: 9,
    zIndex: 1, paddingRight: 4,
  },
  size: {
    flex: 1, textAlign: 'right',
    fontSize: 9, zIndex: 1,
    paddingRight: 2,
  },
  bar: {
    position: 'absolute', right: 0, top: 1, bottom: 1,
    borderRadius: 2, opacity: 0.25,
  },
  spread: {
    padding: '2px 4px', textAlign: 'center',
    fontSize: 9, color: '#787B86',
    borderTop: '1px solid rgba(255,255,255,0.04)',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    background: 'rgba(255,255,255,0.02)',
  },
  closeBtn: {
    background: 'none', border: 'none', color: '#787B86',
    fontSize: 12, cursor: 'pointer', padding: 0, lineHeight: 1,
  },
};

/**
 * Generate simulated DOM data centered around current price.
 * In production this would come from a WebSocket orderbook feed.
 */
function simulateDOM(currentPrice, tick = 0.01) {
  const asks = [];
  const bids = [];
  const baseSize = 5 + Math.random() * 20;

  for (let i = 1; i <= MAX_DISPLAY_LEVELS; i++) {
    asks.push({
      price: currentPrice + i * tick,
      size: Math.round((baseSize + Math.random() * 50) * (1 + Math.random())),
    });
    bids.push({
      price: currentPrice - i * tick,
      size: Math.round((baseSize + Math.random() * 50) * (1 + Math.random())),
    });
  }

  return { asks, bids };
}

/**
 * DOM Ladder Component.
 * Renders a narrow depth-of-market panel alongside the chart.
 *
 * @param {Object} props
 * @param {number} props.currentPrice - Last traded price
 * @param {string} props.symbol
 * @param {Function} props.onClose - Toggle off
 * @param {Object} [props.orderbook] - { asks: [{price, size}], bids: [{price, size}] }
 */
export default function DOMLadder({ currentPrice, symbol, onClose, orderbook }) {
  const [domData, setDomData] = useState({ asks: [], bids: [] });
  const tickRef = useRef(null);

  // Determine tick size from symbol
  const tickSize = useMemo(() => {
    if (!symbol) return 0.01;
    const s = symbol.toUpperCase();
    if (s.includes('BTC')) return 1;
    if (s.includes('ETH')) return 0.1;
    if (s.includes('EUR') || s.includes('GBP') || s.includes('JPY')) return 0.0001;
    return 0.01;
  }, [symbol]);

  useEffect(() => {
    if (orderbook) {
      setDomData(orderbook);
      return;
    }
    // Simulate updates when no real orderbook connected
    const update = () => {
      setDomData(simulateDOM(currentPrice || 100, tickSize));
    };
    update();
    tickRef.current = setInterval(update, 500);
    return () => clearInterval(tickRef.current);
  }, [currentPrice, orderbook, tickSize]);

  const maxSize = useMemo(() => {
    const allSizes = [...domData.asks, ...domData.bids].map(l => l.size);
    return Math.max(...allSizes, 1);
  }, [domData]);

  const formatPrice = (p) => {
    if (tickSize >= 1) return p.toFixed(0);
    if (tickSize >= 0.01) return p.toFixed(2);
    return p.toFixed(4);
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.title}>DOM</span>
        <button style={styles.closeBtn} onClick={onClose} title="Close DOM">×</button>
      </div>

      <div style={styles.rows}>
        {/* Asks (reversed so lowest ask is at bottom, nearest to spread) */}
        {[...domData.asks].reverse().map((level, i) => (
          <div key={`ask-${i}`} style={styles.row}>
            <div
              style={{
                ...styles.bar,
                width: `${(level.size / maxSize) * 100}%`,
                background: '#EF5350',
              }}
            />
            <span style={{ ...styles.price, color: '#EF5350' }}>
              {formatPrice(level.price)}
            </span>
            <span style={{ ...styles.size, color: '#D1D4DC' }}>
              {level.size.toLocaleString()}
            </span>
          </div>
        ))}

        {/* Spread indicator */}
        <div style={styles.spread}>
          Spread: {formatPrice(
            (domData.asks[0]?.price || 0) - (domData.bids[0]?.price || 0)
          )}
        </div>

        {/* Bids */}
        {domData.bids.map((level, i) => (
          <div key={`bid-${i}`} style={styles.row}>
            <div
              style={{
                ...styles.bar,
                width: `${(level.size / maxSize) * 100}%`,
                background: '#26A69A',
              }}
            />
            <span style={{ ...styles.price, color: '#26A69A' }}>
              {formatPrice(level.price)}
            </span>
            <span style={{ ...styles.size, color: '#D1D4DC' }}>
              {level.size.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
