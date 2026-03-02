import { useState, useEffect } from 'react';
import { C, F, M } from '../../../constants.js';
import { alpha } from '../../../utils/colorUtils.js';

const MOCK_WHALE_TX = [
  {
    id: 1,
    time: Date.now() - 180000,
    token: 'BTC',
    amount: 500,
    usdValue: 34720000,
    from: 'Unknown Wallet',
    to: 'Coinbase',
    type: 'exchange_deposit',
  },
  {
    id: 2,
    time: Date.now() - 420000,
    token: 'ETH',
    amount: 15000,
    usdValue: 52800000,
    from: 'Binance',
    to: 'Unknown Wallet',
    type: 'exchange_withdrawal',
  },
  {
    id: 3,
    time: Date.now() - 600000,
    token: 'USDT',
    amount: 80000000,
    usdValue: 80000000,
    from: 'Treasury',
    to: 'Binance',
    type: 'mint',
  },
  {
    id: 4,
    time: Date.now() - 900000,
    token: 'BTC',
    amount: 1200,
    usdValue: 83280000,
    from: 'Unknown Wallet',
    to: 'Unknown Wallet',
    type: 'transfer',
  },
  {
    id: 5,
    time: Date.now() - 1200000,
    token: 'SOL',
    amount: 250000,
    usdValue: 37000000,
    from: 'Kraken',
    to: 'Unknown Wallet',
    type: 'exchange_withdrawal',
  },
  {
    id: 6,
    time: Date.now() - 1500000,
    token: 'ETH',
    amount: 8000,
    usdValue: 28160000,
    from: 'Unknown Wallet',
    to: 'OKX',
    type: 'exchange_deposit',
  },
];

function formatUSD(n) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${(n / 1e3).toFixed(0)}K`;
}

function formatAmount(amount, token) {
  if (amount >= 1e6) return `${(amount / 1e6).toFixed(1)}M ${token}`;
  if (amount >= 1e3) return `${(amount / 1e3).toFixed(1)}K ${token}`;
  return `${amount.toLocaleString()} ${token}`;
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

function getTypeInfo(type) {
  switch (type) {
    case 'exchange_deposit':
      return { icon: '🏦', label: '→ Exchange', sentiment: 'bearish' };
    case 'exchange_withdrawal':
      return { icon: '🔓', label: '← Exchange', sentiment: 'bullish' };
    case 'mint':
      return { icon: '🖨️', label: 'Mint', sentiment: 'neutral' };
    case 'transfer':
      return { icon: '↔️', label: 'Transfer', sentiment: 'neutral' };
    default:
      return { icon: '📤', label: 'Tx', sentiment: 'neutral' };
  }
}

export default function WhaleAlertWidget() {
  const [txs, setTxs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTimeout(() => {
      setTxs(MOCK_WHALE_TX);
      setLoading(false);
    }, 600);
  }, []);

  if (loading) {
    return (
      <div
        style={{
          height: 180,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: C.t3,
          fontSize: 13,
        }}
      >
        Loading whale alerts...
      </div>
    );
  }

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
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.t1, fontFamily: F }}>🐋 Whale Alerts</h3>
        <span style={{ fontSize: 10, color: C.t3, fontFamily: M }}>Live • $1M+</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
        {txs.map((tx) => {
          const typeInfo = getTypeInfo(tx.type);
          const sentimentColor = typeInfo.sentiment === 'bullish' ? C.g : typeInfo.sentiment === 'bearish' ? C.r : C.t2;
          const isMassive = tx.usdValue >= 50e6;

          return (
            <div
              key={tx.id}
              style={{
                padding: '12px 14px',
                borderRadius: 10,
                background: isMassive ? alpha(C.y, 0.05) : C.sf,
                border: `1px solid ${isMassive ? alpha(C.y, 0.2) : C.bd}`,
                transition: 'all 0.2s',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = C.b)}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = isMassive ? alpha(C.y, 0.2) : C.bd)}
            >
              {/* Row 1: Token, Amount, Value */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 16 }}>{typeInfo.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: M }}>{tx.token}</span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: sentimentColor,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: alpha(sentimentColor, 0.12),
                    fontFamily: F,
                  }}
                >
                  {typeInfo.label}
                </span>
                <div style={{ flex: 1 }} />
                <span
                  style={{
                    fontSize: isMassive ? 15 : 13,
                    fontWeight: 800,
                    color: C.t1,
                    fontFamily: M,
                  }}
                >
                  {formatUSD(tx.usdValue)}
                </span>
              </div>

              {/* Row 2: From → To + time */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.t3, fontFamily: F }}>
                <span style={{ fontWeight: 600, color: C.t2 }}>{tx.from}</span>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={C.t3}
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
                <span style={{ fontWeight: 600, color: C.t2 }}>{tx.to}</span>
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 10, fontFamily: M }}>{formatAmount(tx.amount, tx.token)}</span>
                <span style={{ fontSize: 10, fontFamily: M }}>• {timeAgo(tx.time)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
