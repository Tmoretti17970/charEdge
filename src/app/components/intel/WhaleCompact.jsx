// ═══════════════════════════════════════════════════════════════════
// charEdge — Whale Compact
//
// Compact whale alert widget for the Intel Signals section.
// Shows top 6 large crypto transactions with sentiment badges.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import { C, F } from '../../../constants.js';
import { alpha } from '@/shared/colorUtils';

// WhaleAlertAdapter integration — dynamic import with fallback
let _fetchWhaleAlerts = null;
import('../../../data/adapters/WhaleAlertAdapter.js')
  .then((mod) => {
    _fetchWhaleAlerts = mod.fetchWhaleAlerts;
  })
  .catch(() => {
    /* adapter not available, use mock data */
  });

// ─── Mock Data ──────────────────────────────────────────────────
const MOCK_WHALE_TX = [
  {
    id: 1,
    time: '14:29',
    token: 'BTC',
    amount: 500,
    usdValue: 34720000,
    from: 'Unknown Wallet',
    to: 'Coinbase',
    type: 'exchange_deposit',
  },
  {
    id: 2,
    time: '14:25',
    token: 'ETH',
    amount: 15000,
    usdValue: 52800000,
    from: 'Binance',
    to: 'Unknown Wallet',
    type: 'exchange_withdrawal',
  },
  {
    id: 3,
    time: '14:22',
    token: 'USDT',
    amount: 80000000,
    usdValue: 80000000,
    from: 'Treasury',
    to: 'Binance',
    type: 'mint',
  },
  {
    id: 4,
    time: '14:17',
    token: 'BTC',
    amount: 1200,
    usdValue: 83280000,
    from: 'Unknown Wallet',
    to: 'Unknown Wallet',
    type: 'transfer',
  },
  {
    id: 5,
    time: '14:12',
    token: 'SOL',
    amount: 250000,
    usdValue: 37000000,
    from: 'Kraken',
    to: 'Unknown Wallet',
    type: 'exchange_withdrawal',
  },
  {
    id: 6,
    time: '14:08',
    token: 'ETH',
    amount: 8000,
    usdValue: 28160000,
    from: 'Unknown Wallet',
    to: 'OKX',
    type: 'exchange_deposit',
  },
];

// ─── Helpers ────────────────────────────────────────────────────
function fmtUSD(n) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${(n / 1e3).toFixed(0)}K`;
}

function fmtAmount(amount, token) {
  if (amount >= 1e6) return `${(amount / 1e6).toFixed(1)}M ${token}`;
  if (amount >= 1e3) return `${(amount / 1e3).toFixed(1)}K ${token}`;
  return `${amount.toLocaleString()} ${token}`;
}

function getTypeInfo(type) {
  switch (type) {
    case 'exchange_deposit':
      return { label: 'Exchange', sentiment: 'bearish' };
    case 'exchange_withdrawal':
      return { label: 'Withdraw', sentiment: 'bullish' };
    case 'mint':
      return { label: 'Mint', sentiment: 'neutral' };
    case 'transfer':
      return { label: 'Transfer', sentiment: 'neutral' };
    default:
      return { label: 'Tx', sentiment: 'neutral' };
  }
}

function sentimentTint(sentiment) {
  if (sentiment === 'bullish') return C.g;
  if (sentiment === 'bearish') return C.r;
  return C.t3;
}

function shortenAddr(addr) {
  if (addr.length <= 12) return addr;
  return addr.slice(0, 8) + '...';
}

// ─── Component ──────────────────────────────────────────────────
function WhaleCompact() {
  const [txs, setTxs] = useState(MOCK_WHALE_TX);

  useEffect(() => {
    if (!_fetchWhaleAlerts) return;
    let cancelled = false;
    Promise.resolve(_fetchWhaleAlerts())
      .then((data) => {
        if (!cancelled && Array.isArray(data) && data.length > 0) setTxs(data.slice(0, 6));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {txs.map((tx) => {
        const info = getTypeInfo(tx.type);
        const tint = sentimentTint(info.sentiment);

        return (
          <div
            key={tx.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              height: 36,
              padding: '0 10px',
              borderRadius: 8,
              background: alpha(tint, 0.04),
              borderLeft: `2px solid ${alpha(tint, 0.4)}`,
              fontFamily: F,
              fontSize: 12,
              color: C.t1,
              transition: 'background 0.15s ease',
            }}
          >
            {/* Time */}
            <span style={{ color: C.t3, fontSize: 11, minWidth: 36, flexShrink: 0 }}>{tx.time}</span>

            {/* Token */}
            <span style={{ fontWeight: 700, minWidth: 36, color: C.t1, flexShrink: 0 }}>{tx.token}</span>

            {/* Amount */}
            <span style={{ color: C.t2, fontSize: 11, minWidth: 60, flexShrink: 0 }}>
              {fmtAmount(tx.amount, tx.token)}
            </span>

            {/* From → To */}
            <span
              style={{
                flex: 1,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: 11,
                color: C.t3,
              }}
            >
              {shortenAddr(tx.from)} → {shortenAddr(tx.to)}
            </span>

            {/* USD Value */}
            <span style={{ fontWeight: 600, minWidth: 52, textAlign: 'right', flexShrink: 0 }}>
              {fmtUSD(tx.usdValue)}
            </span>

            {/* Sentiment badge */}
            <span
              style={{
                padding: '1px 6px',
                borderRadius: 8,
                background: alpha(tint, 0.12),
                color: tint,
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 0.5,
                lineHeight: '16px',
                flexShrink: 0,
                textTransform: 'uppercase',
              }}
            >
              {info.sentiment === 'bullish' ? 'BULL' : info.sentiment === 'bearish' ? 'BEAR' : 'NTRL'}
            </span>
          </div>
        );
      })}

      {/* Footer link */}
      <div style={{ textAlign: 'right', paddingTop: 6 }}>
        <span
          style={{
            fontSize: 11,
            fontFamily: F,
            fontWeight: 600,
            color: C.b,
            cursor: 'pointer',
            opacity: 0.85,
          }}
        >
          View all whale alerts &rarr;
        </span>
      </div>
    </div>
  );
}

export default React.memo(WhaleCompact);
