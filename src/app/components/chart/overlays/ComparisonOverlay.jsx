// ═══════════════════════════════════════════════════════════════════
// charEdge — Comparison Overlay
// Renders a normalized comparison symbol overlay on the chart.
// Similar to TradingView's "Compare" feature.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useCallback } from 'react';
import { C, F } from '../../../../constants.js';
import { useChartStore } from '../../../../state/useChartStore.js';
import SymbolSearch from '../../ui/SymbolSearch.jsx';

const COMPARE_COLORS = ['#FF6D00', '#AB47BC', '#00BCD4', '#4CAF50', '#F44336'];

export default function ComparisonOverlay({ onClose }) {
  const comparisonSymbol = useChartStore((s) => s.comparisonSymbol);
  const setComparison = useChartStore((s) => s.setComparison);
  const clearComparison = useChartStore((s) => s.clearComparison);
  const [searchOpen, setSearchOpen] = useState(!comparisonSymbol);

  const handleSelect = useCallback((sym) => {
    setComparison(sym, null); // Data will be fetched by ChartsPage effect
    setSearchOpen(false);
  }, [setComparison]);

  return (
    <div
      className="tf-fade-in"
      style={{
        position: 'absolute',
        top: 52,
        right: 80,
        zIndex: 500,
        background: `${C.sf2}F5`,
        backdropFilter: 'blur(16px)',
        border: `1px solid ${C.bd}`,
        borderRadius: 12,
        padding: 14,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        fontFamily: F,
        minWidth: 240,
        animation: 'tfDropdownIn 0.15s ease-out',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: C.t2, letterSpacing: '0.5px' }}>COMPARE SYMBOL</span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: C.t3, cursor: 'pointer', fontSize: 16 }}
        >×</button>
      </div>

      {comparisonSymbol ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div style={{ width: 10, height: 10, borderRadius: 3, background: COMPARE_COLORS[0] }} />
          <span style={{ color: C.t1, fontSize: 13, fontWeight: 600 }}>{comparisonSymbol}</span>
          <button
            onClick={clearComparison}
            style={{
              marginLeft: 'auto', padding: '3px 8px',
              background: `${C.r || '#EF5350'}20`, border: 'none',
              borderRadius: 6, color: C.r || '#EF5350',
              fontSize: 11, cursor: 'pointer', fontFamily: F,
            }}
          >
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
        <button
          onClick={() => setSearchOpen(true)}
          style={{
            width: '100%', padding: '8px 12px',
            background: `${C.b}15`, border: `1px solid ${C.b}30`,
            borderRadius: 8, color: C.b,
            fontSize: 12, cursor: 'pointer', fontFamily: F,
            fontWeight: 600,
          }}
        >
          + Change Symbol
        </button>
      )}
    </div>
  );
}
