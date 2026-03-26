// ═══════════════════════════════════════════════════════════════════
// charEdge — Prediction Markets Section
//
// Aggregated live prediction market data from Kalshi + Polymarket.
// Shows the most relevant predictions for traders with category
// filtering and links to source platforms.
// ═══════════════════════════════════════════════════════════════════

import { TrendingUp } from 'lucide-react';
import React, { useEffect } from 'react';
import usePredictionStore from '../../../state/usePredictionStore.js';
import IntelCard from './IntelCard.jsx';
import { PredictionsSkeleton } from './IntelSkeleton.jsx';
import PredictionCard from './PredictionCard.jsx';
import s from './PredictionMarkets.module.css';

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'economics', label: 'Economics' },
  { id: 'markets', label: 'Markets' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'politics', label: 'Politics' },
];

function PredictionMarkets() {
  const markets = usePredictionStore((s) => s.markets);
  const loading = usePredictionStore((s) => s.loading);
  const activeCategory = usePredictionStore((s) => s.activeCategory);
  const setCategory = usePredictionStore((s) => s.setCategory);
  const getFilteredMarkets = usePredictionStore((s) => s.getFilteredMarkets);
  const startAutoRefresh = usePredictionStore((s) => s.startAutoRefresh);
  const stopAutoRefresh = usePredictionStore((s) => s.stopAutoRefresh);

  useEffect(() => {
    startAutoRefresh();
    return () => stopAutoRefresh();
  }, [startAutoRefresh, stopAutoRefresh]);

  const filtered = getFilteredMarkets();
  const displayMarkets = filtered.slice(0, 8);

  const badge = markets.length > 0 ? `${markets.length} live` : loading ? 'loading...' : 'offline';
  const badgeColor = markets.length > 0 ? '#22c55e' : undefined;

  return (
    <IntelCard
      icon={<TrendingUp size={18} />}
      title="Prediction Markets"
      badge={badge}
      badgeColor={badgeColor}
      collapsible
    >
      {/* Category filter pills */}
      <div className={s.filterRow}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            className={s.filterBtn}
            style={{
              background: activeCategory === cat.id ? 'rgba(92, 156, 245, 0.1)' : 'transparent',
              color: activeCategory === cat.id ? '#5c9cf5' : 'var(--tf-t3)',
              border: `1px solid ${activeCategory === cat.id ? 'rgba(92, 156, 245, 0.2)' : 'transparent'}`,
            }}
            onClick={() => setCategory(cat.id)}
          >
            {cat.label}
          </button>
        ))}
        <span className={s.sourceLabel}>Kalshi + Polymarket</span>
      </div>

      {/* Market cards */}
      <div className={s.cardList}>
        {displayMarkets.length > 0 ? (
          displayMarkets.map((market) => <PredictionCard key={market.id} market={market} />)
        ) : loading ? (
          <PredictionsSkeleton />
        ) : (
          <div className={s.empty}>No prediction markets available for this category</div>
        )}
      </div>
    </IntelCard>
  );
}

export default React.memo(PredictionMarkets);
