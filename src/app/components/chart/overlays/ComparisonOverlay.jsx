// ═══════════════════════════════════════════════════════════════════
// charEdge — Comparison Overlay
// Renders a normalized comparison symbol overlay on the chart.
// Similar to TradingView's "Compare" feature.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useState, useCallback } from 'react';
import { useChartFeaturesStore } from '../../../../state/chart/useChartFeaturesStore';
import SymbolSearch from '../../ui/SymbolSearch.jsx';
import s from './ComparisonOverlay.module.css';

const COMPARE_COLORS = ['#FF6D00', '#AB47BC', '#00BCD4', '#4CAF50', '#F44336'];

function ComparisonOverlay({ onClose }) {
  const comparisonSymbol = useChartFeaturesStore((st) => st.comparisonSymbol);
  const setComparison = useChartFeaturesStore((st) => st.setComparison);
  const clearComparison = useChartFeaturesStore((st) => st.clearComparison);
  const [searchOpen, setSearchOpen] = useState(!comparisonSymbol);

  const handleSelect = useCallback(
    (sym) => {
      setComparison(sym, null);
      setSearchOpen(false);
    },
    [setComparison],
  );

  return (
    <div className={`tf-fade-in ${s.panel}`}>
      <div className={s.header}>
        <span className={s.headerTitle}>COMPARE SYMBOL</span>
        <button onClick={onClose} className={s.closeBtn}>
          ×
        </button>
      </div>

      {comparisonSymbol ? (
        <div className={s.activeRow}>
          <div className={s.colorDot} style={{ background: COMPARE_COLORS[0] }} />
          <span className={s.symbolName}>{comparisonSymbol}</span>
          <button onClick={clearComparison} className={s.removeBtn}>
            Remove
          </button>
        </div>
      ) : null}

      {searchOpen || !comparisonSymbol ? (
        <SymbolSearch
          onSelect={handleSelect}
          currentSymbol={comparisonSymbol || ''}
          width="100%"
          placeholder="Search symbol to compare..."
        />
      ) : (
        <button onClick={() => setSearchOpen(true)} className={s.changeBtn}>
          + Change Symbol
        </button>
      )}
    </div>
  );
}

export default React.memo(ComparisonOverlay);
