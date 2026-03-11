import { useState, useEffect } from 'react';
import { C, F, M } from '../../../constants.js';
import { alpha } from '@/shared/colorUtils';

const MOCK_LIQUIDATIONS = [
  {
    id: 1,
    time: Date.now() - 120000,
    pair: 'BTCUSDT',
    side: 'long',
    amount: 2340000,
    price: 69420,
    exchange: 'Binance',
  },
  { id: 2, time: Date.now() - 300000, pair: 'ETHUSDT', side: 'short', amount: 890000, price: 3520, exchange: 'Bybit' },
  { id: 3, time: Date.now() - 420000, pair: 'SOLUSDT', side: 'long', amount: 1560000, price: 148.5, exchange: 'OKX' },
  {
    id: 4,
    time: Date.now() - 600000,
    pair: 'BTCUSDT',
    side: 'long',
    amount: 5200000,
    price: 69100,
    exchange: 'Binance',
  },
  {
    id: 5,
    time: Date.now() - 900000,
    pair: 'DOGEUSDT',
    side: 'short',
    amount: 420000,
    price: 0.182,
    exchange: 'Bybit',
  },
  {
    id: 6,
    time: Date.now() - 1200000,
    pair: 'XRPUSDT',
    side: 'long',
    amount: 780000,
    price: 2.14,
    exchange: 'Binance',
  },
  { id: 7, time: Date.now() - 1500000, pair: 'ETHUSDT', side: 'long', amount: 3100000, price: 3480, exchange: 'OKX' },
  {
    id: 8,
    time: Date.now() - 1800000,
    pair: 'AVAXUSDT',
    side: 'short',
    amount: 340000,
    price: 38.5,
    exchange: 'Bybit',
  },
];

function formatAmount(n) {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n}`;
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

export default function LiquidationTicker() {
  const [liqs, setLiqs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTimeout(() => {
      setLiqs(MOCK_LIQUIDATIONS);
      setLoading(false);
    }, 500);
  }, []);

  if (loading) {
    return (
      <div
        style={{
          height: 150,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: C.t3,
          fontSize: 13,
        }}
      >
        Loading liquidations...
      </div>
    );
  }

  // Stats
  const totalLongs = liqs.filter((l) => l.side === 'long').reduce((s, l) => s + l.amount, 0);
  const totalShorts = liqs.filter((l) => l.side === 'short').reduce((s, l) => s + l.amount, 0);
  const total = totalLongs + totalShorts;
  const longPct = total > 0 ? ((totalLongs / total) * 100).toFixed(0) : 50;

  return (
    <div
      style={{
        background: C.bg2,
        borderRadius: 16,
        border: `1px solid ${C.bd}`,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.t1, fontFamily: F }}>🔥 Liquidations</h3>
        <span style={{ fontSize: 10, color: C.t3, fontFamily: M }}>Last 1h</span>
      </div>

      {/* Long vs Short bar */}
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 11,
            fontFamily: M,
            fontWeight: 700,
            marginBottom: 6,
          }}
        >
          <span style={{ color: C.g }}>
            Longs {formatAmount(totalLongs)} ({longPct}%)
          </span>
          <span style={{ color: C.r }}>
            Shorts {formatAmount(totalShorts)} ({100 - longPct}%)
          </span>
        </div>
        <div style={{ height: 6, display: 'flex', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${longPct}%`, background: C.g, transition: 'width 0.5s' }} />
          <div style={{ flex: 1, background: C.r }} />
        </div>
      </div>

      {/* Recent liquidations feed */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 240, overflowY: 'auto' }}>
        {liqs.map((l) => {
          const isLong = l.side === 'long';
          const color = isLong ? C.g : C.r;
          const isBig = l.amount >= 1e6;

          return (
            <div
              key={l.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                borderRadius: 8,
                background: isBig ? alpha(color, 0.06) : 'transparent',
                border: isBig ? `1px solid ${alpha(color, 0.15)}` : '1px solid transparent',
                transition: 'background 0.15s',
              }}
            >
              {/* Side indicator */}
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: color,
                  boxShadow: isBig ? `0 0 8px ${color}` : 'none',
                }}
              />

              {/* Pair */}
              <span style={{ fontSize: 12, fontWeight: 700, color: C.t1, fontFamily: M, minWidth: 55 }}>
                {l.pair.replace('USDT', '')}
              </span>

              {/* Direction badge */}
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color,
                  fontFamily: M,
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: alpha(color, 0.12),
                  textTransform: 'uppercase',
                }}
              >
                {l.side}
              </span>

              {/* Amount */}
              <span
                style={{
                  flex: 1,
                  textAlign: 'right',
                  fontSize: isBig ? 13 : 12,
                  fontWeight: isBig ? 800 : 600,
                  fontFamily: M,
                  color: color,
                }}
              >
                {formatAmount(l.amount)}
              </span>

              {/* Time */}
              <span style={{ fontSize: 10, color: C.t3, fontFamily: M, minWidth: 50, textAlign: 'right' }}>
                {timeAgo(l.time)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
