// ═══════════════════════════════════════════════════════════════════
// charEdge — Markets Screener Panel (Sprint 29)
//
// Slide-over panel with scan preset cards, results list,
// and add-to-watchlist functionality.
// Powered by screenerService.js.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { C } from '../../../constants.js';
import { radii, transition } from '../../../theme/tokens.js';
import { fetchScreenerResults, SCAN_PRESETS } from '../../../services/screenerService.js';
import { useWatchlistStore } from '../../../state/useWatchlistStore';
import st from './MarketsScreenerPanel.module.css';

// ─── Result Row ──────────────────────────────────────────────────

function ResultRow({ item, onAdd, added }) {
  const signal = item.signal || {};
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 12px', borderRadius: radii.md,
      background: C.bg2, marginBottom: 6,
      transition: transition.fast,
    }}>
      {/* Symbol */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.t1, fontFamily: 'var(--tf-font)' }}>
            {item.symbol}
          </span>
          <span style={{
            fontSize: 9, fontFamily: 'var(--tf-mono)', color: C.t3,
            padding: '1px 5px', borderRadius: 4,
            background: C.bg, textTransform: 'uppercase',
          }}>
            {item.assetClass}
          </span>
        </div>
        <div style={{ fontSize: 10, color: C.t3, fontFamily: 'var(--tf-font)', marginTop: 1 }}>
          {item.name}
        </div>
      </div>

      {/* Price & Change */}
      <div style={{ textAlign: 'right', minWidth: 60 }}>
        <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--tf-mono)', color: C.t1 }}>
          ${typeof item.price === 'number' ? item.price.toLocaleString() : item.price}
        </div>
        <div style={{
          fontSize: 10, fontWeight: 600, fontFamily: 'var(--tf-mono)',
          color: item.change >= 0 ? C.g : C.r,
        }}>
          {item.change >= 0 ? '+' : ''}{item.change?.toFixed(1)}%
        </div>
      </div>

      {/* Signal */}
      {signal.label && (
        <span style={{
          fontSize: 9, fontWeight: 700, fontFamily: 'var(--tf-mono)',
          padding: '2px 6px', borderRadius: 8,
          background: (signal.color || C.t3) + '18',
          color: signal.color || C.t3,
          whiteSpace: 'nowrap',
        }}>
          {signal.label}
        </span>
      )}

      {/* RSI */}
      <div style={{ textAlign: 'center', minWidth: 32 }}>
        <div style={{ fontSize: 9, color: C.t3, fontFamily: 'var(--tf-mono)' }}>RSI</div>
        <div style={{
          fontSize: 11, fontWeight: 700, fontFamily: 'var(--tf-mono)',
          color: item.rsi > 70 ? C.r : item.rsi < 30 ? C.g : C.t1,
        }}>
          {item.rsi}
        </div>
      </div>

      {/* Vol Ratio */}
      <div style={{ textAlign: 'center', minWidth: 32 }}>
        <div style={{ fontSize: 9, color: C.t3, fontFamily: 'var(--tf-mono)' }}>VOL</div>
        <div style={{
          fontSize: 11, fontWeight: 700, fontFamily: 'var(--tf-mono)',
          color: parseFloat(item.volumeRatio) > 1.5 ? C.y : C.t1,
        }}>
          {item.volumeRatio}×
        </div>
      </div>

      {/* Add Button */}
      <button
        onClick={() => onAdd(item)}
        disabled={added}
        style={{
          padding: '4px 10px', borderRadius: radii.sm,
          background: added ? C.g + '18' : `${C.b}12`,
          border: `1px solid ${added ? C.g : C.b}`,
          color: added ? C.g : C.b,
          fontSize: 10, fontWeight: 700, fontFamily: 'var(--tf-mono)',
          cursor: added ? 'default' : 'pointer',
          transition: transition.fast, whiteSpace: 'nowrap',
        }}
      >
        {added ? '✓' : '+ Add'}
      </button>
    </div>
  );
}

// ─── Preset Card ─────────────────────────────────────────────────

function PresetCard({ preset, active, count, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '10px 12px', borderRadius: radii.md,
        background: active ? (preset.color || C.b) + '18' : C.bg2,
        border: `1px solid ${active ? (preset.color || C.b) : C.bd}`,
        color: C.t1, textAlign: 'left', cursor: 'pointer',
        transition: transition.fast, fontFamily: 'var(--tf-font)',
        width: '100%',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>
          {preset.icon} {preset.label}
        </span>
        {count !== undefined && (
          <span style={{
            fontSize: 10, fontWeight: 700, fontFamily: 'var(--tf-mono)',
            color: preset.color || C.b,
            padding: '2px 6px', borderRadius: 8,
            background: (preset.color || C.b) + '15',
          }}>
            {count}
          </span>
        )}
      </div>
      <div style={{ fontSize: 10, color: C.t3, marginTop: 3 }}>
        {preset.description}
      </div>
    </button>
  );
}

// ─── Main Panel ──────────────────────────────────────────────────

function MarketsScreenerPanel({ open, onClose }) {
  const [activePreset, setActivePreset] = useState(null);
  const [assetClass, setAssetClass] = useState('all');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [addedSymbols, setAddedSymbols] = useState(new Set());

  const addItem = useWatchlistStore((s) => s.add);
  const watchlistItems = useWatchlistStore((s) => s.items);
  const existingSymbols = useMemo(() => new Set((watchlistItems || []).map(i => i.symbol)), [watchlistItems]);

  // Fetch results when preset or asset class changes
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchScreenerResults({ presetId: activePreset, assetClass, sortBy: 'change', sortDir: 'desc' })
      .then(setResults)
      .finally(() => setLoading(false));
  }, [activePreset, assetClass, open]);

  const handleAdd = useCallback((item) => {
    if (addItem) {
      addItem({ symbol: item.symbol, name: item.name, assetClass: item.assetClass });
    }
    setAddedSymbols(prev => new Set([...prev, item.symbol]));
  }, [addItem]);

  const handleAddAll = useCallback(() => {
    results.forEach(item => {
      if (!existingSymbols.has(item.symbol) && !addedSymbols.has(item.symbol)) {
        handleAdd(item);
      }
    });
  }, [results, existingSymbols, addedSymbols, handleAdd]);

  // Preset result counts
  const presetCounts = useMemo(() => {
    const counts = {};
    SCAN_PRESETS.forEach(p => {
      counts[p.id] = results.length; // simplified — real count would need full universe
    });
    return counts;
  }, [results]);

  if (!open) return null;

  const assetTabs = ['all', 'crypto', 'stock', 'futures'];

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0,
      width: 420, zIndex: 1200,
      background: C.bg,
      borderLeft: `1px solid ${C.bd}`,
      boxShadow: '-8px 0 32px rgba(0,0,0,0.3)',
      display: 'flex', flexDirection: 'column',
      animation: 'tf-slide-left 0.25s ease-out',
      fontFamily: 'var(--tf-font)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 18px', borderBottom: `1px solid ${C.bd}`,
      }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.t1 }}>
          🔍 Screener
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: C.t3,
          fontSize: 18, cursor: 'pointer', padding: 4,
          borderRadius: radii.sm, transition: transition.fast,
        }}>✕</button>
      </div>

      {/* Asset Class Tabs */}
      <div style={{
        display: 'flex', gap: 4, padding: '10px 18px',
        borderBottom: `1px solid ${C.bd}`,
      }}>
        {assetTabs.map(ac => (
          <button
            key={ac}
            onClick={() => setAssetClass(ac)}
            style={{
              padding: '4px 12px', borderRadius: radii.sm,
              background: assetClass === ac ? `${C.b}18` : 'transparent',
              border: `1px solid ${assetClass === ac ? C.b : C.bd}`,
              color: assetClass === ac ? C.b : C.t3,
              fontSize: 11, fontWeight: 600, fontFamily: 'var(--tf-mono)',
              cursor: 'pointer', textTransform: 'capitalize',
              transition: transition.fast,
            }}
          >
            {ac === 'all' ? 'All' : ac}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
        {/* Scan Presets */}
        <div style={{
          fontSize: 10, fontWeight: 700, color: C.t3,
          fontFamily: 'var(--tf-mono)', textTransform: 'uppercase', marginBottom: 8,
        }}>
          Scan Presets
        </div>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 6, marginBottom: 16,
        }}>
          {SCAN_PRESETS.map(preset => (
            <PresetCard
              key={preset.id}
              preset={preset}
              active={activePreset === preset.id}
              onClick={() => setActivePreset(prev => prev === preset.id ? null : preset.id)}
            />
          ))}
        </div>

        {/* Results */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 8,
        }}>
          <span style={{
            fontSize: 10, fontWeight: 700, color: C.t3,
            fontFamily: 'var(--tf-mono)', textTransform: 'uppercase',
          }}>
            Results ({results.length})
          </span>
          {results.length > 0 && (
            <button
              onClick={handleAddAll}
              style={{
                fontSize: 10, color: C.b, background: `${C.b}12`,
                border: `1px solid ${C.b}`, borderRadius: radii.sm,
                padding: '3px 10px', cursor: 'pointer', fontFamily: 'var(--tf-mono)',
                fontWeight: 700, transition: transition.fast,
              }}
            >
              + Add All ({results.length})
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', color: C.t3, fontSize: 12, padding: 20 }}>
            Scanning…
          </div>
        ) : results.length === 0 ? (
          <div style={{ textAlign: 'center', color: C.t3, fontSize: 12, padding: 20 }}>
            No results match current filters.
          </div>
        ) : (
          results.map(item => (
            <ResultRow
              key={item.symbol}
              item={item}
              onAdd={handleAdd}
              added={existingSymbols.has(item.symbol) || addedSymbols.has(item.symbol)}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default memo(MarketsScreenerPanel);
