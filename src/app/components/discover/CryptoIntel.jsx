// ═══════════════════════════════════════════════════════════════════
// charEdge — Crypto Intelligence
//
// Tabbed section for crypto-specific intelligence:
// Funding Rates, Whale Alerts, and Liquidation Tracker.
// ═══════════════════════════════════════════════════════════════════

import { Coins } from 'lucide-react';
import React, { useState } from 'react';
import s from './CryptoIntel.module.css';
import IntelCard from './IntelCard.jsx';

const TABS = [
  { id: 'funding', label: 'Funding Rates' },
  { id: 'whales', label: 'Whale Alerts' },
  { id: 'liquidations', label: 'Liquidations' },
];

// ─── Mock Funding Rates ──────────────────────────────────────────
const FUNDING_RATES = [
  { symbol: 'BTC', binance: 0.01, bybit: 0.0095, okx: 0.0105, predicted: 0.011 },
  { symbol: 'ETH', binance: 0.0082, bybit: 0.0078, okx: 0.0085, predicted: 0.009 },
  { symbol: 'SOL', binance: 0.015, bybit: 0.0145, okx: 0.0155, predicted: 0.016 },
  { symbol: 'DOGE', binance: 0.02, bybit: 0.0195, okx: 0.021, predicted: 0.018 },
  { symbol: 'XRP', binance: -0.005, bybit: -0.0045, okx: -0.0055, predicted: -0.003 },
  { symbol: 'AVAX', binance: 0.012, bybit: 0.0115, okx: 0.0125, predicted: 0.013 },
];

// ─── Mock Whale Alerts ───────────────────────────────────────────
const WHALE_ALERTS = [
  {
    time: '2m ago',
    asset: 'BTC',
    amount: 1250,
    amountUSD: 89125000,
    from: 'Unknown',
    to: 'Coinbase',
    type: 'exchange_deposit',
  },
  {
    time: '8m ago',
    asset: 'ETH',
    amount: 45000,
    amountUSD: 97650000,
    from: 'Binance',
    to: 'Unknown',
    type: 'exchange_withdrawal',
  },
  { time: '15m ago', asset: 'BTC', amount: 800, amountUSD: 57040000, from: 'Unknown', to: 'Unknown', type: 'transfer' },
  {
    time: '22m ago',
    asset: 'USDT',
    amount: 150000000,
    amountUSD: 150000000,
    from: 'Tether Treasury',
    to: 'Binance',
    type: 'mint',
  },
  {
    time: '31m ago',
    asset: 'SOL',
    amount: 2500000,
    amountUSD: 412500000,
    from: 'Unknown',
    to: 'Kraken',
    type: 'exchange_deposit',
  },
];

// ─── Mock Liquidations ───────────────────────────────────────────
const LIQUIDATIONS = {
  total24h: 245000000,
  longPct: 62,
  shortPct: 38,
  recent: [
    { time: '1m ago', symbol: 'BTC', side: 'long', amount: 2450000, exchange: 'Binance', price: 71250 },
    { time: '3m ago', symbol: 'ETH', side: 'short', amount: 1820000, exchange: 'OKX', price: 2175 },
    { time: '5m ago', symbol: 'SOL', side: 'long', amount: 950000, exchange: 'Bybit', price: 165 },
    { time: '8m ago', symbol: 'BTC', side: 'long', amount: 3200000, exchange: 'Bybit', price: 71100 },
    { time: '12m ago', symbol: 'DOGE', side: 'short', amount: 680000, exchange: 'Binance', price: 0.182 },
  ],
};

function formatUSD(n) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n}`;
}

function formatRate(rate) {
  const pct = (rate * 100).toFixed(4);
  return `${rate >= 0 ? '+' : ''}${pct}%`;
}

function rateColor(rate) {
  return rate >= 0 ? '#22c55e' : '#ef4444';
}

function CryptoIntel() {
  const [activeTab, setActiveTab] = useState('funding');

  return (
    <IntelCard
      icon={<Coins size={18} />}
      title="Crypto Intelligence"
      badge="live"
      badgeColor="#f7931a"
      collapsible
      actions={
        <div className={s.tabBar}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={s.tabBtn}
              style={{
                background: activeTab === tab.id ? 'rgba(247, 147, 26, 0.1)' : 'transparent',
                color: activeTab === tab.id ? '#f7931a' : 'var(--tf-t3)',
                borderBottom: activeTab === tab.id ? '2px solid #f7931a' : '2px solid transparent',
              }}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      }
    >
      <div className={s.content}>
        {activeTab === 'funding' && <FundingRatesView />}
        {activeTab === 'whales' && <WhaleAlertsView />}
        {activeTab === 'liquidations' && <LiquidationsView />}
      </div>
    </IntelCard>
  );
}

// ─── Funding Rates Tab ───────────────────────────────────────────
function FundingRatesView() {
  return (
    <div className={s.tableWrap}>
      <div className={s.tableHeader}>
        <span className={s.thSymbol}>Symbol</span>
        <span className={s.th}>Binance</span>
        <span className={s.th}>Bybit</span>
        <span className={s.th}>OKX</span>
        <span className={s.th}>Predicted</span>
      </div>
      {FUNDING_RATES.map((r) => (
        <div key={r.symbol} className={s.tableRow}>
          <span className={s.tdSymbol}>{r.symbol}</span>
          <span className={s.td} style={{ color: rateColor(r.binance) }}>
            {formatRate(r.binance)}
          </span>
          <span className={s.td} style={{ color: rateColor(r.bybit) }}>
            {formatRate(r.bybit)}
          </span>
          <span className={s.td} style={{ color: rateColor(r.okx) }}>
            {formatRate(r.okx)}
          </span>
          <span className={s.td} style={{ color: rateColor(r.predicted) }}>
            {formatRate(r.predicted)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Whale Alerts Tab ────────────────────────────────────────────
function WhaleAlertsView() {
  return (
    <div className={s.feedList}>
      {WHALE_ALERTS.map((alert, i) => (
        <div key={i} className={s.feedRow}>
          <span className={s.feedTime}>{alert.time}</span>
          <span className={s.feedAsset}>{alert.asset}</span>
          <span className={s.feedAmount}>{formatUSD(alert.amountUSD)}</span>
          <span className={s.feedPath}>
            {alert.from} → {alert.to}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Liquidations Tab ────────────────────────────────────────────
function LiquidationsView() {
  return (
    <div>
      {/* Summary */}
      <div className={s.liqSummary}>
        <div className={s.liqTotal}>
          <span className={s.liqLabel}>24h Liquidations</span>
          <span className={s.liqValue}>{formatUSD(LIQUIDATIONS.total24h)}</span>
        </div>
        <div className={s.liqBar}>
          <div className={s.liqLong} style={{ width: `${LIQUIDATIONS.longPct}%` }}>
            {LIQUIDATIONS.longPct}% Long
          </div>
          <div className={s.liqShort} style={{ width: `${LIQUIDATIONS.shortPct}%` }}>
            {LIQUIDATIONS.shortPct}% Short
          </div>
        </div>
      </div>
      {/* Recent */}
      <div className={s.feedList}>
        {LIQUIDATIONS.recent.map((liq, i) => (
          <div key={i} className={s.feedRow}>
            <span className={s.feedTime}>{liq.time}</span>
            <span className={s.feedAsset}>{liq.symbol}</span>
            <span className={s.liqSide} style={{ color: liq.side === 'long' ? '#22c55e' : '#ef4444' }}>
              {liq.side.toUpperCase()}
            </span>
            <span className={s.feedAmount}>{formatUSD(liq.amount)}</span>
            <span className={s.feedPath}>{liq.exchange}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default React.memo(CryptoIntel);
