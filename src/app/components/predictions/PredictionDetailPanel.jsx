// ═══════════════════════════════════════════════════════════════════
// charEdge — Prediction Detail Panel (Apple Sheet-Style)
//
// Slide-in panel from right showing full market detail:
// Overview, Chart, Order Book, Trades, Related Markets.
// ═══════════════════════════════════════════════════════════════════

import { memo, useCallback, useMemo } from 'react';
import {
  formatVolume,
  formatMultiplier,
  timeToClose,
  CATEGORY_CONFIG,
  SOURCE_CONFIG,
} from '../../../data/schemas/PredictionMarketSchema.js';
import { generateMarketSummary } from '../../../data/services/AIMarketSummarizer.js';
import usePredictionDetailStore from '../../../state/usePredictionDetailStore.js';
import PredictionAlertSetup from './PredictionAlertSetup.jsx';
import styles from './PredictionDetailPanel.module.css';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'chart', label: 'Chart' },
  { id: 'book', label: 'Book' },
  { id: 'compare', label: 'Compare' },
  { id: 'related', label: 'Related' },
];

export default memo(function PredictionDetailPanel() {
  const isOpen = usePredictionDetailStore((s) => s.isOpen);
  const market = usePredictionDetailStore((s) => s.marketData);
  const activeTab = usePredictionDetailStore((s) => s.activeTab);
  const setTab = usePredictionDetailStore((s) => s.setTab);
  const closeMarket = usePredictionDetailStore((s) => s.closeMarket);
  const orderBook = usePredictionDetailStore((s) => s.orderBook);
  const relatedMarkets = usePredictionDetailStore((s) => s.relatedMarkets);
  const loading = usePredictionDetailStore((s) => s.loading);

  const handleClose = useCallback(() => closeMarket(), [closeMarket]);

  if (!isOpen || !market) return null;

  const catConfig = CATEGORY_CONFIG[market.category] || CATEGORY_CONFIG.other;
  const sourceConfig = SOURCE_CONFIG[market.source] || {};
  const remaining = timeToClose(market.closeDate);

  return (
    <>
      {/* Backdrop */}
      <div className={styles.backdrop} onClick={handleClose} />

      {/* Panel */}
      <div className={styles.panel}>
        {/* Drag handle */}
        <div className={styles.dragHandle} />

        {/* Close button */}
        <button className={styles.closeBtn} onClick={handleClose}>
          ✕
        </button>

        {/* Header */}
        <div className={styles.header}>
          {market.imageUrl && <img className={styles.eventImage} src={market.imageUrl} alt="" />}
          <div className={styles.headerText}>
            <div className={styles.catRow}>
              <span className={styles.catDot} style={{ background: catConfig.color }} />
              <span className={styles.catLabel}>{market.subcategory || catConfig.label}</span>
              <span className={styles.sourceBadge} style={{ color: sourceConfig.color }}>
                {sourceConfig.label}
              </span>
            </div>
            <h2 className={styles.title}>{market.question}</h2>
            {remaining && <span className={styles.countdown}>Closes in {remaining}</span>}
          </div>
        </div>

        {/* Stats row */}
        <div className={styles.statsRow}>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>VOLUME 24H</span>
            <span className={styles.statValue}>{formatVolume(market.volume24h)}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>OPEN INTEREST</span>
            <span className={styles.statValue}>{formatVolume(market.openInterest || 0)}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>LIQUIDITY</span>
            <span className={styles.statValue}>{formatVolume(market.liquidity || 0)}</span>
          </div>
        </div>

        {/* Tab bar — segmented control */}
        <div className={styles.tabBar}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
              onClick={() => setTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className={styles.tabContent}>
          {activeTab === 'overview' && <OverviewTab market={market} />}
          {activeTab === 'chart' && <ChartTab />}
          {activeTab === 'book' && <BookTab orderBook={orderBook} loading={loading} />}
          {activeTab === 'compare' && <CompareTab market={market} />}
          {activeTab === 'related' && <RelatedTab markets={relatedMarkets} />}
        </div>

        {/* External link */}
        <a className={styles.externalLink} href={market.url} target="_blank" rel="noopener noreferrer">
          View on {sourceConfig.label} ↗
        </a>
      </div>
    </>
  );
});

// ─── Tab Components ────────────────────────────────────────────

function OverviewTab({ market }) {
  const outcomes = market.outcomes || [];
  const aiSummary = useMemo(() => generateMarketSummary(market), [market]);

  return (
    <div className={styles.overviewTab}>
      {/* AI Summary */}
      {aiSummary && (
        <div className={styles.aiSummary}>
          <div className={styles.aiHeader}>
            <span className={styles.aiIcon}>✦</span>
            <span className={styles.aiLabel}>AI Summary</span>
          </div>
          <p className={styles.aiText}>{aiSummary}</p>
        </div>
      )}

      {/* Description */}
      {market.description && <p className={styles.description}>{market.description}</p>}

      {/* All outcomes */}
      <div className={styles.outcomesSection}>
        <h4 className={styles.sectionTitle}>Outcomes</h4>
        {outcomes.map((outcome, i) => {
          const delta = outcome.probability - outcome.previousProbability;
          const multiplierStr = formatMultiplier(outcome.payoutMultiplier);
          return (
            <div key={i} className={styles.outcomeDetail}>
              <div className={styles.outcomeTop}>
                <span className={styles.outcomeName}>{outcome.label}</span>
                <span className={styles.outcomeProbPill}>{outcome.probability}%</span>
              </div>
              <div className={styles.outcomeBar}>
                <div className={styles.outcomeBarFill} style={{ width: `${outcome.probability}%` }} />
              </div>
              <div className={styles.outcomeMeta}>
                <span
                  className={styles.outcomeDelta}
                  style={{ color: delta > 0 ? '#22c55e' : delta < 0 ? '#ef4444' : 'var(--tf-tx-2)' }}
                >
                  {delta > 0 ? '+' : ''}
                  {delta}% 24h
                </span>
                {multiplierStr && <span className={styles.outcomeMultiplier}>{multiplierStr}</span>}
                <span className={styles.outcomeVolume}>{formatVolume(outcome.volume)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tags */}
      {market.tags?.length > 0 && (
        <div className={styles.tagsSection}>
          <h4 className={styles.sectionTitle}>Tags</h4>
          <div className={styles.tagsList}>
            {market.tags.map((tag) => (
              <span key={tag} className={styles.tag}>
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Resolution info */}
      <div className={styles.resolutionSection}>
        <h4 className={styles.sectionTitle}>Resolution</h4>
        <div className={styles.resolutionRow}>
          <span className={styles.resLabel}>Source</span>
          <span className={styles.resValue}>{market.resolutionSource || 'Platform'}</span>
        </div>
        <div className={styles.resolutionRow}>
          <span className={styles.resLabel}>Close Date</span>
          <span className={styles.resValue}>
            {market.closeDate ? new Date(market.closeDate).toLocaleString() : '—'}
          </span>
        </div>
        <div className={styles.resolutionRow}>
          <span className={styles.resLabel}>Status</span>
          <span className={styles.resValue}>{market.status || 'Open'}</span>
        </div>
      </div>

      {/* Price Alerts */}
      <PredictionAlertSetup market={market} />
    </div>
  );
}

function ChartTab() {
  return (
    <div className={styles.placeholderTab}>
      <span className={styles.placeholderIcon}>📈</span>
      <p className={styles.placeholderText}>Probability chart coming soon</p>
      <p className={styles.placeholderSub}>Historical probability data will be charted here</p>
    </div>
  );
}

function BookTab({ orderBook, loading }) {
  if (loading)
    return (
      <div className={styles.placeholderTab}>
        <p className={styles.placeholderText}>Loading order book...</p>
      </div>
    );

  const hasBids = orderBook.bids?.length > 0;
  const hasAsks = orderBook.asks?.length > 0;

  if (!hasBids && !hasAsks) {
    return (
      <div className={styles.placeholderTab}>
        <span className={styles.placeholderIcon}>📊</span>
        <p className={styles.placeholderText}>Order book unavailable</p>
        <p className={styles.placeholderSub}>This market doesn't expose depth data</p>
      </div>
    );
  }

  return (
    <div className={styles.bookTab}>
      {orderBook.spread > 0 && <div className={styles.spreadIndicator}>Spread: {orderBook.spread.toFixed(1)}%</div>}
      <div className={styles.bookColumns}>
        <div className={styles.bookColumn}>
          <div className={styles.bookHeader}>BIDS (YES)</div>
          {orderBook.bids.slice(0, 10).map((bid, i) => (
            <div key={i} className={styles.bookRow}>
              <span className={styles.bookPrice} style={{ color: '#22c55e' }}>
                {bid.price.toFixed(1)}¢
              </span>
              <span className={styles.bookQty}>{bid.quantity}</span>
            </div>
          ))}
        </div>
        <div className={styles.bookColumn}>
          <div className={styles.bookHeader}>ASKS (NO)</div>
          {orderBook.asks.slice(0, 10).map((ask, i) => (
            <div key={i} className={styles.bookRow}>
              <span className={styles.bookPrice} style={{ color: '#ef4444' }}>
                {ask.price.toFixed(1)}¢
              </span>
              <span className={styles.bookQty}>{ask.quantity}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CompareTab({ market }) {
  const variants = market.sourceVariants || [];

  if (variants.length === 0) {
    return (
      <div className={styles.placeholderTab}>
        <span className={styles.placeholderIcon}>⚖️</span>
        <p className={styles.placeholderText}>Single-source market</p>
        <p className={styles.placeholderSub}>
          Cross-platform comparison available when the same market exists on multiple platforms
        </p>
      </div>
    );
  }

  const allVersions = [market, ...variants];

  return (
    <div className={styles.compareTab}>
      <h4 className={styles.sectionTitle}>Cross-Platform Prices</h4>
      <div className={styles.compareTable}>
        <div className={styles.compareHeader}>
          <span className={styles.compareCell}>Platform</span>
          <span className={styles.compareCell}>Yes</span>
          <span className={styles.compareCell}>No</span>
          <span className={styles.compareCell}>Volume</span>
          <span className={styles.compareCell}>Spread</span>
        </div>
        {allVersions.map((v) => {
          const yesProb = v.outcomes?.[0]?.probability || 0;
          const noProb = v.outcomes?.[1]?.probability || 100 - yesProb;
          const srcCfg = SOURCE_CONFIG[v.source] || {};
          return (
            <div key={v.id} className={styles.compareRow}>
              <span className={styles.compareCell}>
                <span className={styles.compareDot} style={{ background: srcCfg.color }} />
                {srcCfg.label || v.source}
              </span>
              <span className={`${styles.compareCell} ${styles.compareYes}`}>{yesProb}%</span>
              <span className={`${styles.compareCell} ${styles.compareNo}`}>{noProb}%</span>
              <span className={styles.compareCell}>{formatVolume(v.volume24h)}</span>
              <span className={styles.compareCell}>
                {Math.abs(yesProb - (market.outcomes?.[0]?.probability || 0))}%
              </span>
            </div>
          );
        })}
      </div>

      {/* Arbitrage alert */}
      {(() => {
        const probs = allVersions.map((v) => v.outcomes?.[0]?.probability || 0);
        const spread = Math.max(...probs) - Math.min(...probs);
        if (spread >= 5) {
          return (
            <div className={styles.arbitrageAlert}>
              <span className={styles.arbitrageIcon}>⚡</span>
              <span>{spread}% spread detected — potential arbitrage opportunity</span>
            </div>
          );
        }
        return null;
      })()}
    </div>
  );
}

function RelatedTab({ markets }) {
  if (!markets?.length) {
    return (
      <div className={styles.placeholderTab}>
        <span className={styles.placeholderIcon}>🔗</span>
        <p className={styles.placeholderText}>No related markets found</p>
      </div>
    );
  }

  return (
    <div className={styles.relatedTab}>
      {markets.map((m) => {
        const leadProb = m.outcomes?.[0]?.probability || 0;
        return (
          <div key={m.id} className={styles.relatedCard}>
            <span className={styles.relatedTitle}>{m.question}</span>
            <span className={styles.relatedProb}>{leadProb}%</span>
          </div>
        );
      })}
    </div>
  );
}
