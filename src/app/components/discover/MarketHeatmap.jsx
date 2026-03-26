// ═══════════════════════════════════════════════════════════════════
// charEdge — Market Heatmap
//
// Interactive treemap visualization of S&P 500 sectors + crypto.
// Tile size = market cap weight, color = performance (green/red).
// Timeframe toggleable: 1D, 1W, 1M, 3M, YTD.
// ═══════════════════════════════════════════════════════════════════

import { LayoutGrid } from 'lucide-react';
import React, { useState, useMemo } from 'react';
import IntelCard from './IntelCard.jsx';
import s from './MarketHeatmap.module.css';

// ─── Sector Data (S&P 500 + Crypto) ──────────────────────────────

const SECTORS = [
  {
    id: 'tech',
    name: 'Technology',
    weight: 28.5,
    perf: { '1D': 1.42, '1W': 3.18, '1M': 5.64, '3M': 12.3, YTD: 8.9 },
    stocks: ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'META'],
  },
  {
    id: 'health',
    name: 'Healthcare',
    weight: 13.2,
    perf: { '1D': 0.31, '1W': 1.05, '1M': 2.1, '3M': 4.8, YTD: 3.2 },
    stocks: ['UNH', 'JNJ', 'LLY', 'PFE', 'ABBV'],
  },
  {
    id: 'finance',
    name: 'Financials',
    weight: 12.8,
    perf: { '1D': 0.68, '1W': 1.45, '1M': 3.82, '3M': 8.4, YTD: 6.2 },
    stocks: ['JPM', 'BAC', 'GS', 'WFC', 'MS'],
  },
  {
    id: 'disc',
    name: 'Cons. Disc.',
    weight: 10.5,
    perf: { '1D': 0.92, '1W': 2.1, '1M': 4.35, '3M': 6.8, YTD: 5.1 },
    stocks: ['AMZN', 'TSLA', 'HD', 'NKE', 'MCD'],
  },
  {
    id: 'comm',
    name: 'Communication',
    weight: 8.0,
    perf: { '1D': 1.15, '1W': 2.48, '1M': 6.2, '3M': 14.5, YTD: 10.2 },
    stocks: ['META', 'GOOGL', 'NFLX', 'DIS', 'T'],
  },
  {
    id: 'indust',
    name: 'Industrials',
    weight: 8.3,
    perf: { '1D': 0.45, '1W': 0.98, '1M': 2.56, '3M': 5.2, YTD: 4.1 },
    stocks: ['GE', 'CAT', 'BA', 'UPS', 'HON'],
  },
  {
    id: 'staples',
    name: 'Cons. Staples',
    weight: 6.5,
    perf: { '1D': -0.12, '1W': 0.34, '1M': 1.15, '3M': 2.1, YTD: 1.8 },
    stocks: ['PG', 'KO', 'PEP', 'COST', 'WMT'],
  },
  {
    id: 'energy',
    name: 'Energy',
    weight: 4.2,
    perf: { '1D': -0.85, '1W': -1.62, '1M': -3.4, '3M': -8.2, YTD: -5.4 },
    stocks: ['XOM', 'CVX', 'COP', 'SLB', 'EOG'],
  },
  {
    id: 'util',
    name: 'Utilities',
    weight: 2.8,
    perf: { '1D': 0.15, '1W': 0.42, '1M': 1.8, '3M': 3.5, YTD: 2.9 },
    stocks: ['NEE', 'DUK', 'SO', 'D', 'AEP'],
  },
  {
    id: 'realestate',
    name: 'Real Estate',
    weight: 2.5,
    perf: { '1D': -0.22, '1W': -0.68, '1M': 0.45, '3M': 1.2, YTD: 0.8 },
    stocks: ['PLD', 'AMT', 'EQIX', 'SPG', 'O'],
  },
  {
    id: 'materials',
    name: 'Materials',
    weight: 2.7,
    perf: { '1D': 0.35, '1W': 0.72, '1M': 1.95, '3M': 3.8, YTD: 2.5 },
    stocks: ['LIN', 'APD', 'FCX', 'NEM', 'DOW'],
  },
];

const CRYPTO = [
  { id: 'btc', name: 'Bitcoin', weight: 45, perf: { '1D': 2.34, '1W': 5.12, '1M': 12.8, '3M': 28.5, YTD: 15.2 } },
  { id: 'eth', name: 'Ethereum', weight: 18, perf: { '1D': 1.82, '1W': 4.65, '1M': 10.2, '3M': 22.1, YTD: 11.8 } },
  { id: 'sol', name: 'Solana', weight: 8, perf: { '1D': 3.45, '1W': 8.92, '1M': 18.5, '3M': 45.2, YTD: 25.1 } },
  { id: 'bnb', name: 'BNB', weight: 6, perf: { '1D': 0.92, '1W': 2.15, '1M': 5.8, '3M': 12.4, YTD: 7.5 } },
  { id: 'xrp', name: 'XRP', weight: 5, perf: { '1D': -1.23, '1W': -0.45, '1M': 3.2, '3M': 8.9, YTD: 4.2 } },
  { id: 'ada', name: 'Cardano', weight: 3, perf: { '1D': 1.56, '1W': 3.82, '1M': 8.5, '3M': 18.2, YTD: 9.8 } },
  { id: 'doge', name: 'Dogecoin', weight: 3, perf: { '1D': 4.21, '1W': 12.5, '1M': 22.1, '3M': 35.8, YTD: 18.4 } },
  { id: 'avax', name: 'Avalanche', weight: 2, perf: { '1D': 2.15, '1W': 5.45, '1M': 11.2, '3M': 25.6, YTD: 13.2 } },
];

const TIMEFRAMES = ['1D', '1W', '1M', '3M', 'YTD'];

function getColor(perf) {
  if (perf > 5) return '#16a34a';
  if (perf > 2) return '#22c55e';
  if (perf > 0.5) return '#4ade80';
  if (perf > -0.5) return '#6b7280';
  if (perf > -2) return '#f87171';
  if (perf > -5) return '#ef4444';
  return '#dc2626';
}

function getTextColor(perf) {
  return Math.abs(perf) > 2 ? '#fff' : 'var(--tf-t2)';
}

function MarketHeatmap() {
  const [tf, setTF] = useState('1D');
  const [mode, setMode] = useState('equities'); // 'equities' | 'crypto'

  const data = mode === 'equities' ? SECTORS : CRYPTO;
  const totalWeight = useMemo(() => data.reduce((sum, d) => sum + d.weight, 0), [data]);

  return (
    <IntelCard
      icon={<LayoutGrid size={18} />}
      title="Market Heatmap"
      badge={mode === 'equities' ? '11 sectors' : '8 assets'}
      collapsible
    >
      {/* Controls */}
      <div className={s.controls}>
        <div className={s.modeToggle}>
          <button
            className={s.modeBtn}
            style={{
              background: mode === 'equities' ? 'rgba(92, 156, 245, 0.1)' : 'transparent',
              color: mode === 'equities' ? '#5c9cf5' : 'var(--tf-t3)',
              border: `1px solid ${mode === 'equities' ? 'rgba(92, 156, 245, 0.2)' : 'transparent'}`,
            }}
            onClick={() => setMode('equities')}
          >
            Equities
          </button>
          <button
            className={s.modeBtn}
            style={{
              background: mode === 'crypto' ? 'rgba(247, 147, 26, 0.1)' : 'transparent',
              color: mode === 'crypto' ? '#f7931a' : 'var(--tf-t3)',
              border: `1px solid ${mode === 'crypto' ? 'rgba(247, 147, 26, 0.2)' : 'transparent'}`,
            }}
            onClick={() => setMode('crypto')}
          >
            Crypto
          </button>
        </div>
        <div className={s.tfRow}>
          {TIMEFRAMES.map((t) => (
            <button
              key={t}
              className={s.tfBtn}
              style={{
                background: tf === t ? 'rgba(92, 156, 245, 0.1)' : 'transparent',
                color: tf === t ? '#5c9cf5' : 'var(--tf-t3)',
                border: `1px solid ${tf === t ? 'rgba(92, 156, 245, 0.2)' : 'transparent'}`,
              }}
              onClick={() => setTF(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Treemap Grid */}
      <div className={s.treemap}>
        {data.map((item) => {
          const perf = item.perf[tf];
          const widthPct = (item.weight / totalWeight) * 100;
          const isLarge = widthPct > 10;

          return (
            <div
              key={item.id}
              className={s.tile}
              style={{
                flexBasis: `${Math.max(widthPct, 8)}%`,
                flexGrow: widthPct > 15 ? 2 : 1,
                background: getColor(perf),
                minHeight: isLarge ? 80 : 60,
              }}
              title={`${item.name}: ${perf > 0 ? '+' : ''}${perf.toFixed(2)}%`}
            >
              <span className={s.tileName} style={{ color: getTextColor(perf) }}>
                {item.name}
              </span>
              <span className={s.tilePerf} style={{ color: getTextColor(perf) }}>
                {perf > 0 ? '+' : ''}
                {perf.toFixed(2)}%
              </span>
              {isLarge && item.stocks && (
                <span className={s.tileStocks} style={{ color: getTextColor(perf) }}>
                  {item.stocks.slice(0, 3).join(' · ')}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className={s.legend}>
        <span className={s.legendDot} style={{ background: '#dc2626' }} />
        <span className={s.legendLabel}>-5%+</span>
        <span className={s.legendDot} style={{ background: '#ef4444' }} />
        <span className={s.legendLabel}>-2%</span>
        <span className={s.legendDot} style={{ background: '#6b7280' }} />
        <span className={s.legendLabel}>~0%</span>
        <span className={s.legendDot} style={{ background: '#22c55e' }} />
        <span className={s.legendLabel}>+2%</span>
        <span className={s.legendDot} style={{ background: '#16a34a' }} />
        <span className={s.legendLabel}>+5%+</span>
      </div>
    </IntelCard>
  );
}

export default React.memo(MarketHeatmap);
