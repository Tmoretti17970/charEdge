// ═══════════════════════════════════════════════════════════════════
// charEdge — Top Tab Network/Asset Class Filters
//
// Horizontal filter chips: All, Crypto, Stocks, Futures, ETFs, Forex.
// ═══════════════════════════════════════════════════════════════════

import { memo } from 'react';
import { C, F, M } from '../../../constants.js';
import useTopMarketsStore from '../../../state/useTopMarketsStore.js';

const FILTERS = [
  { id: 'all', label: 'All Networks', dot: null },
  { id: 'crypto', label: 'Crypto', dot: '#F7931A' },
  { id: 'stock', label: 'Stocks', dot: '#4A90D9' },
  { id: 'futures', label: 'Futures', dot: '#8B5CF6' },
  { id: 'etf', label: 'ETFs', dot: '#10B981' },
  { id: 'forex', label: 'Forex', dot: '#06B6D4' },
];

export default memo(function TopNetworkFilters() {
  const assetClassFilter = useTopMarketsStore((s) => s.assetClassFilter);
  const setAssetClassFilter = useTopMarketsStore((s) => s.setAssetClassFilter);
  const markets = useTopMarketsStore((s) => s.markets);

  const getCount = (cls) => {
    if (cls === 'all') return markets.length;
    return markets.filter((m) => m.assetClass === cls).length;
  };

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
      {FILTERS.map((filter) => {
        const isActive = assetClassFilter === filter.id;
        const count = getCount(filter.id);
        return (
          <button
            key={filter.id}
            onClick={() => setAssetClassFilter(filter.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 14px',
              borderRadius: 20,
              border: `1px solid ${isActive ? (filter.dot || C.b) + '40' : C.bd}`,
              background: isActive ? (filter.dot || C.b) + '12' : 'transparent',
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
            {filter.dot && (
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: filter.dot,
                  opacity: isActive ? 1 : 0.5,
                  flexShrink: 0,
                }}
              />
            )}
            {filter.label}
            {count > 0 && (
              <span
                style={{
                  fontSize: 10,
                  fontFamily: M,
                  color: C.t3,
                  opacity: 0.7,
                }}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
});
