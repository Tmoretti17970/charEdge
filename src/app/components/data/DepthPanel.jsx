// ═══════════════════════════════════════════════════════════════════
// charEdge v13 — Depth Panel (Level 2 Order Book)
//
// Real-time order book visualization with:
//   • Bid/Ask depth ladder
//   • Cumulative depth bars
//   • Spread indicator
//   • Depth imbalance gauge
//   • Spoof detection alerts
//
// Usage:
//   <DepthPanel symbol="BTCUSDT" />
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react';
import { C, F, M } from '../../../constants.js';
import { depthEngine } from '../../../data/engine/orderflow/DepthEngine';

function fmtNum(n) {
  if (n == null) return '—';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(2) + 'K';
  return n.toFixed(4);
}

function fmtPrice(n) {
  if (n == null) return '—';
  if (n >= 1000) return n.toFixed(2);
  if (n >= 1) return n.toFixed(4);
  return n.toFixed(6);
}

// ─── Depth Row ─────────────────────────────────────────────────

function DepthRow({ level, maxCumQty, side, isWall }) {
  const pct = maxCumQty > 0 ? (level.cumQty / maxCumQty) * 100 : 0;
  const isBid = side === 'bid';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      position: 'relative',
      padding: '2px 8px',
      fontSize: 11,
      fontFamily: M,
      minHeight: 22,
    }}>
      {/* Background fill */}
      <div style={{
        position: 'absolute',
        [isBid ? 'right' : 'left']: 0,
        top: 0,
        bottom: 0,
        width: `${Math.min(pct, 100)}%`,
        background: isBid ? `${C.g}12` : `${C.r}12`,
        transition: 'width 0.2s ease',
      }} />

      {isBid ? (
        <>
          <span style={{ flex: 1, color: C.t2, zIndex: 1 }}>{fmtNum(level.qty)}</span>
          <span style={{ fontWeight: isWall ? 800 : 500, color: C.g, zIndex: 1 }}>{fmtPrice(level.price)}</span>
        </>
      ) : (
        <>
          <span style={{ fontWeight: isWall ? 800 : 500, color: C.r, zIndex: 1 }}>{fmtPrice(level.price)}</span>
          <span style={{ flex: 1, textAlign: 'right', color: C.t2, zIndex: 1 }}>{fmtNum(level.qty)}</span>
        </>
      )}
    </div>
  );
}

// ─── Main Panel ────────────────────────────────────────────────

export default function DepthPanel({ symbol = 'BTCUSDT', levels = 15 }) {
  const [depth, setDepth] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const upper = symbol.toUpperCase();
    const unsub = depthEngine.subscribe(upper, (snapshot) => {
      setDepth(snapshot);
    }, { levels: 20, updateMs: 500 });

    return unsub;
  }, [symbol]);

  if (!depth) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: C.t3, fontFamily: F, fontSize: 12 }}>
        Connecting to order book…
      </div>
    );
  }

  const askLevels = depth.asks.slice(0, levels).reverse(); // Show highest ask at top
  const bidLevels = depth.bids.slice(0, levels);
  const maxCum = Math.max(
    askLevels.length > 0 ? askLevels[0].cumQty : 0,
    bidLevels.length > 0 ? bidLevels[bidLevels.length - 1]?.cumQty || 0 : 0,
    1
  );

  const imbalance = depth.imbalanceRatio;
  const buyPct = Math.round(imbalance * 100);
  const spreadColor = depth.spreadPct < 0.01 ? C.g : depth.spreadPct < 0.05 ? C.y : C.r;

  return (
    <div ref={containerRef} style={{
      fontFamily: F,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 12px',
        borderBottom: `1px solid ${C.bd}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.t1 }}>
            📖 Order Book — {symbol.replace('USDT', '')}
          </div>
          <div style={{ fontSize: 10, color: C.t3, marginTop: 1 }}>
            Binance L2 · {levels} levels
          </div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 10, fontFamily: M, color: spreadColor }}>
            Spread: {depth.spread.toFixed(2)} ({depth.spreadPct.toFixed(4)}%)
          </span>
        </div>
      </div>

      {/* Imbalance Bar */}
      <div style={{ padding: '6px 12px', borderBottom: `1px solid ${C.bd}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, fontFamily: M, color: C.g, fontWeight: 700, width: 40 }}>
            {buyPct}% B
          </span>
          <div style={{
            flex: 1, height: 5, borderRadius: 3, background: C.r, overflow: 'hidden',
          }}>
            <div style={{
              width: `${buyPct}%`, height: '100%', borderRadius: 3,
              background: `linear-gradient(90deg, ${C.g}, ${C.g}80)`,
              transition: 'width 0.3s ease',
            }} />
          </div>
          <span style={{ fontSize: 10, fontFamily: M, color: C.r, fontWeight: 700, width: 40, textAlign: 'right' }}>
            {100 - buyPct}% S
          </span>
        </div>
        <div style={{ fontSize: 9, color: C.t3, textAlign: 'center', marginTop: 2 }}>
          {depth.imbalanceLabel === 'buy_pressure' ? '🟢 Buy Pressure' :
           depth.imbalanceLabel === 'sell_pressure' ? '🔴 Sell Pressure' : '⚪ Balanced'}
        </div>
      </div>

      {/* Order Book Ladder */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Column Header */}
        <div style={{
          display: 'flex', padding: '4px 8px', fontSize: 9,
          color: C.t3, fontFamily: M, textTransform: 'uppercase',
          borderBottom: `1px solid ${C.bd}`,
        }}>
          <span style={{ flex: 1 }}>Size</span>
          <span style={{ textAlign: 'center' }}>Price</span>
          <span style={{ flex: 1, textAlign: 'right' }}>Size</span>
        </div>

        {/* Asks (top, reversed so lowest ask is at the bottom) */}
        <div style={{ borderBottom: `2px solid ${C.r}30` }}>
          {askLevels.map((level, _i) => (
            <DepthRow
              key={'a-' + level.price}
              level={level}
              maxCumQty={maxCum}
              side="ask"
              isWall={level.price === depth.askWallPrice}
            />
          ))}
        </div>

        {/* Spread Divider */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '6px', borderBottom: `2px solid ${C.g}30`,
          background: `${C.bd}15`,
        }}>
          <span style={{
            fontSize: 13, fontFamily: M, fontWeight: 800,
            color: C.t1,
          }}>
            ${fmtPrice(depth.midPrice)}
          </span>
        </div>

        {/* Bids */}
        <div>
          {bidLevels.map((level) => (
            <DepthRow
              key={'b-' + level.price}
              level={level}
              maxCumQty={maxCum}
              side="bid"
              isWall={level.price === depth.bidWallPrice}
            />
          ))}
        </div>
      </div>

      {/* Spoof Alerts */}
      {depth.spoofAlerts?.length > 0 && (
        <div style={{
          padding: '8px 12px', borderTop: `1px solid ${C.bd}`,
          background: `${C.y}08`,
        }}>
          <div style={{ fontSize: 9, color: C.y, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
            ⚠️ Spoofing Detector
          </div>
          {depth.spoofAlerts.slice(-3).map((alert, i) => (
            <div key={alert.time + '-' + i} style={{
              fontSize: 10, fontFamily: M, color: C.t2, marginBottom: 2,
            }}>
              Large {alert.side} removed @ ${fmtPrice(alert.price)} ({fmtNum(alert.quantity)})
            </div>
          ))}
        </div>
      )}

      {/* Footer Stats */}
      <div style={{
        padding: '6px 12px', borderTop: `1px solid ${C.bd}`,
        display: 'flex', justifyContent: 'space-between',
        fontSize: 9, fontFamily: M, color: C.t3,
      }}>
        <span>Bid wall: ${fmtPrice(depth.bidWallPrice)}</span>
        <span>Ask wall: ${fmtPrice(depth.askWallPrice)}</span>
      </div>
    </div>
  );
}
