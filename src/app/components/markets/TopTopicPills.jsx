// ═══════════════════════════════════════════════════════════════════
// charEdge — Top Tab Topic Pills (Enhanced)
//
// Context-aware narrative/topic filters for the Top tab.
// Shows crypto topics when viewing crypto, stock sector topics
// when viewing stocks, and all topics for "All Markets" view.
// ═══════════════════════════════════════════════════════════════════

import { memo } from 'react';
import { C, F } from '../../../constants.js';
import useTopMarketsStore from '../../../state/useTopMarketsStore.js';

const CRYPTO_TOPICS = [
  { id: null, label: 'All' },
  { id: 'ai', label: 'AI' },
  { id: 'defi', label: 'DeFi' },
  { id: 'rwa', label: 'RWA' },
  { id: 'memes', label: 'Memes' },
  { id: 'layer2', label: 'Layer 2' },
  { id: 'gaming', label: 'Gaming' },
  { id: 'infrastructure', label: 'Infra' },
];

const STOCK_TOPICS = [
  { id: null, label: 'All' },
  { id: 'mag7', label: 'Mag 7' },
  { id: 'semis', label: 'Semis' },
  { id: 'ev', label: 'EV' },
  { id: 'banks', label: 'Banks' },
  { id: 'biotech', label: 'Biotech' },
  { id: 'defense', label: 'Defense' },
  { id: 'energy', label: 'Energy' },
  { id: 'saas', label: 'SaaS' },
  { id: 'retail', label: 'Retail' },
  { id: 'china', label: 'China' },
];

export default memo(function TopTopicPills() {
  const topicFilter = useTopMarketsStore((s) => s.topicFilter);
  const setTopicFilter = useTopMarketsStore((s) => s.setTopicFilter);
  const assetClassFilter = useTopMarketsStore((s) => s.assetClassFilter);

  // Choose topics based on asset class
  let topics;
  if (assetClassFilter === 'stock') {
    topics = STOCK_TOPICS;
  } else if (assetClassFilter === 'crypto' || assetClassFilter === 'all') {
    topics = CRYPTO_TOPICS;
  } else {
    // No topic pills for futures, forex, ETFs, indices
    return null;
  }

  return (
    <div
      style={{
        display: 'flex',
        gap: 6,
        padding: '0 24px',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        flexShrink: 0,
      }}
    >
      {topics.map((topic) => {
        const isActive = topicFilter === topic.id;
        return (
          <button
            key={topic.id || 'all'}
            onClick={() => setTopicFilter(topic.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '5px 12px',
              borderRadius: 8,
              border: `1px solid ${isActive ? C.b + '40' : C.bd}`,
              background: isActive ? C.b + '12' : 'transparent',
              color: isActive ? C.t1 : C.t3,
              fontSize: 12,
              fontWeight: 600,
              fontFamily: F,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
              flexShrink: 0,
            }}
          >
            {topic.label}
          </button>
        );
      })}
    </div>
  );
});
