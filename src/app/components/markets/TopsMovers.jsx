// ═══════════════════════════════════════════════════════════════════
// charEdge — Tops Movers (Gainers / Losers / Most Active)
//
// Apple-style horizontal scrolling cards showing top movers.
// Surfaces existing MarketsPerformancePanel logic for the Tops tab.
// ═══════════════════════════════════════════════════════════════════

import { memo, useMemo, useState } from 'react';
import { C } from '../../../constants.js';
import useTopMarketsStore from '../../../state/useTopMarketsStore.js';
import styles from './TopsMovers.module.css';

const TABS = [
  { id: 'gainers', label: 'Top Gainers', icon: '▲' },
  { id: 'losers', label: 'Top Losers', icon: '▼' },
  { id: 'active', label: 'Most Active', icon: '◉' },
];

function fmtPrice(val) {
  if (val == null) return '—';
  if (val >= 1000) return `$${val.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (val >= 1) return `$${val.toFixed(2)}`;
  return `$${val.toFixed(4)}`;
}

function fmtChange(val) {
  if (val == null) return '—';
  const sign = val >= 0 ? '+' : '';
  return `${sign}${val.toFixed(2)}%`;
}

function fmtVolume(val) {
  if (val == null) return '—';
  if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
  if (val >= 1e3) return `$${(val / 1e3).toFixed(0)}K`;
  return `$${val.toFixed(0)}`;
}

const ASSET_CLASS_COLORS = {
  crypto: '#F7931A',
  stock: '#4A90D9',
  futures: '#8B5CF6',
  etf: '#10B981',
  forex: '#06B6D4',
};

const MoverCard = memo(function MoverCard({ item, rank, mode }) {
  const isUp = (item.change24h || 0) >= 0;
  const changeColor = isUp ? 'var(--tf-green, #34C759)' : 'var(--tf-red, #FF3B30)';
  const medal = rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : null;

  return (
    <div className={styles.moverCard}>
      <div className={styles.moverHeader}>
        <div className={styles.moverIdentity}>
          {item.image ? (
            <img src={item.image} alt="" className={styles.moverIcon} loading="lazy" />
          ) : (
            <span
              className={styles.moverIcon}
              style={{
                background: ASSET_CLASS_COLORS[item.assetClass] || C.bd,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 9,
                fontWeight: 700,
                color: '#fff',
              }}
            >
              {item.symbol?.charAt(0)}
            </span>
          )}
          <div>
            <span className={styles.moverSymbol}>{item.symbol}</span>
            <span className={styles.moverName}>{item.name}</span>
          </div>
        </div>
        {medal && <span className={styles.medal}>{medal}</span>}
      </div>
      <div className={styles.moverStats}>
        <span className={styles.moverPrice}>{fmtPrice(item.price)}</span>
        {mode === 'active' ? (
          <span className={styles.moverVolume}>Vol {fmtVolume(item.volume24h)}</span>
        ) : (
          <span className={styles.moverChange} style={{ color: changeColor }}>
            {isUp ? '▲' : '▼'} {fmtChange(item.change24h)}
          </span>
        )}
      </div>
    </div>
  );
});

export default memo(function TopsMovers() {
  const [activeTab, setActiveTab] = useState('gainers');
  const markets = useTopMarketsStore((s) => s.markets);

  const movers = useMemo(() => {
    if (!markets.length) return [];
    const withChange = markets.filter(m => m.change24h != null);

    switch (activeTab) {
      case 'gainers':
        return [...withChange].sort((a, b) => (b.change24h || 0) - (a.change24h || 0)).slice(0, 8);
      case 'losers':
        return [...withChange].sort((a, b) => (a.change24h || 0) - (b.change24h || 0)).slice(0, 8);
      case 'active':
        return [...markets].sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0)).slice(0, 8);
      default:
        return [];
    }
  }, [markets, activeTab]);

  if (!markets.length) return null;

  return (
    <div className={styles.container}>
      {/* Tab switcher */}
      <div className={styles.tabRow}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
          >
            <span className={styles.tabIcon}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Scrollable cards */}
      <div className={styles.scroll}>
        {movers.map((item, i) => (
          <MoverCard key={item.id} item={item} rank={i} mode={activeTab} />
        ))}
      </div>
    </div>
  );
});
