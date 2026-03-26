// ═══════════════════════════════════════════════════════════════════
// charEdge — Intel Section
//
// Market Intelligence hub — Apple-caliber redesign.
// Narrative flow: Pulse → Predictions → Calendar/Earnings →
// Heatmap → Sentiment → Smart Money → Crypto Intel → Go Deeper.
// ═══════════════════════════════════════════════════════════════════

import React, { Suspense } from 'react';
import { useDataStore } from '../../../state/useDataStore.js';
import s from './IntelSection.module.css';
import PredictionMarkets from './PredictionMarkets.jsx';
import PulseHero from './PulseHero.jsx';
// ─── Below-the-fold (lazy) ──────────────────────────────────
const EconomicCalendarPro = React.lazy(() => import('./EconomicCalendarPro.jsx'));
const EarningsIntelligence = React.lazy(() => import('./EarningsIntelligence.jsx'));
const MarketHeatmap = React.lazy(() => import('./MarketHeatmap.jsx'));
const SocialSentiment = React.lazy(() => import('./SocialSentiment.jsx'));
const SmartMoney = React.lazy(() => import('./SmartMoney.jsx'));
const SectorRotationMap = React.lazy(() => import('./SectorRotationMap.jsx'));
const CryptoIntel = React.lazy(() => import('./CryptoIntel.jsx'));
const GoDeeper = React.lazy(() => import('./GoDeeper.jsx'));

function LazySection({ children }) {
  return <Suspense fallback={<div className={s.lazyFallback} />}>{children}</Suspense>;
}

// ═════════════════════════════════════════════════════════════════
// Market Intel Content — Full narrative layout
// ═════════════════════════════════════════════════════════════════
function MarketIntelContent() {
  return (
    <div className={s.contentStack}>
      {/* Act 1: The Pulse — glanceable market status */}
      <PulseHero />

      {/* Act 2: Prediction Markets — crowdsourced probabilities */}
      <PredictionMarkets />

      {/* Act 3: Today's Calendar + Earnings */}
      <LazySection>
        <div className={`${s.grid2} tf-discover-grid-2`}>
          <EconomicCalendarPro />
          <EarningsIntelligence />
        </div>
      </LazySection>

      {/* Act 4: Market Heatmap — visual sector/crypto performance */}
      <LazySection>
        <MarketHeatmap />
      </LazySection>

      {/* Act 5: Social Sentiment — trending tickers */}
      <LazySection>
        <SocialSentiment />
      </LazySection>

      {/* Act 6: Smart Money — options flow + insider activity */}
      <LazySection>
        <SmartMoney />
      </LazySection>

      {/* Act 7: Sector Rotation — money flow analysis */}
      <LazySection>
        <SectorRotationMap />
      </LazySection>

      {/* Act 8: Crypto Intelligence — funding, whales, liquidations */}
      <LazySection>
        <CryptoIntel />
      </LazySection>

      {/* Act 9: Go Deeper — progressive disclosure */}
      <LazySection>
        <GoDeeper />
      </LazySection>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// Combined Intel Section
// inline=true → compact preview for unified feed
// ═════════════════════════════════════════════════════════════════
function IntelSection({ inline = false }) {
  const setActiveChip = useDataStore((st) => st.setActiveChip);

  // Inline mode: show condensed preview
  if (inline) {
    return (
      <div role="region" aria-label="Market Intelligence Preview" className={s.inlinePreview}>
        <div className={s.inlineHeader}>
          <SectionHeader title="Market Intelligence" />
          <button className={s.viewAllBtn} onClick={() => setActiveChip('intel')}>
            View All →
          </button>
        </div>
        <PulseHero />
      </div>
    );
  }

  // Full mode: complete intelligence briefing
  return (
    <div role="tabpanel" aria-label="Market Intelligence" className={s.intelPanel}>
      <MarketIntelContent />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// Shared Components
// ═════════════════════════════════════════════════════════════════

function SectionHeader({ title, count, icon }) {
  return (
    <div className={s.sectionHeaderWrap}>
      {icon && <span className={s.sectionIcon}>{icon}</span>}
      <h2 className={s.sectionTitle}>{title}</h2>
      {count !== undefined && <span className={s.sectionCount}>{count}</span>}
    </div>
  );
}

function EmptyState({ text, icon, cta, onCta }) {
  return (
    <div className={s.emptyState}>
      {icon && <div className={`${s.emptyIcon} tf-empty-float`}>{icon}</div>}
      <div className={s.emptyText} style={{ marginBottom: cta ? 16 : 0 }}>
        {text}
      </div>
      {cta && onCta && (
        <button className={s.emptyCta} onClick={onCta}>
          {cta}
        </button>
      )}
    </div>
  );
}

export { IntelSection, SectionHeader, EmptyState };

export default React.memo(IntelSection);
