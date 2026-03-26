// ═══════════════════════════════════════════════════════════════════
// charEdge — Prediction Markets Mini Widget
//
// Compact 4-card preview of prediction markets for the Intel page.
// Links to the full /predictions page for the complete experience.
// ═══════════════════════════════════════════════════════════════════

import { TrendingUp, ArrowRight } from 'lucide-react';
import React, { useEffect, useMemo } from 'react';
import usePredictionStore from '../../../state/usePredictionStore.js';
import { useUIStore } from '../../../state/useUIStore';
import IntelCard from './IntelCard.jsx';
import { PredictionsSkeleton } from './IntelSkeleton.jsx';
import PredictionCard from './PredictionCard.jsx';
import s from './PredictionMarkets.module.css';

function PredictionMarkets() {
  const markets = usePredictionStore((s) => s.markets);
  const loading = usePredictionStore((s) => s.loading);
  const startAutoRefresh = usePredictionStore((s) => s.startAutoRefresh);
  const stopAutoRefresh = usePredictionStore((s) => s.stopAutoRefresh);
  const totalCount = usePredictionStore((s) => s.totalCount);
  const setPage = useUIStore((s) => s.setPage);

  useEffect(() => {
    startAutoRefresh();
    return () => stopAutoRefresh();
  }, [startAutoRefresh, stopAutoRefresh]);

  // Show top 4 by volume
  const displayMarkets = useMemo(() => {
    return [...markets].sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0)).slice(0, 4);
  }, [markets]);

  const badge = markets.length > 0 ? `${markets.length} live` : loading ? 'loading...' : 'offline';
  const badgeColor = markets.length > 0 ? '#22c55e' : undefined;

  return (
    <IntelCard
      icon={<TrendingUp size={18} />}
      title="Prediction Markets"
      badge={badge}
      badgeColor={badgeColor}
      collapsible
      actions={
        <button className={s.viewAllBtn} onClick={() => setPage('predictions')}>
          View {totalCount > 0 ? totalCount.toLocaleString() : 'all'} markets
          <ArrowRight size={12} />
        </button>
      }
    >
      {/* Market cards */}
      <div className={s.cardList}>
        {displayMarkets.length > 0 ? (
          displayMarkets.map((market) => <PredictionCard key={market.id} market={market} />)
        ) : loading ? (
          <PredictionsSkeleton />
        ) : (
          <div className={s.empty}>No prediction markets available</div>
        )}
      </div>

      {/* View All CTA */}
      {displayMarkets.length > 0 && (
        <button className={s.viewAllCta} onClick={() => setPage('predictions')}>
          Explore all prediction markets →
        </button>
      )}
    </IntelCard>
  );
}

export default React.memo(PredictionMarkets);
