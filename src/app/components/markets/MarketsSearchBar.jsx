// ═══════════════════════════════════════════════════════════════════
// charEdge — Markets Search Bar (Sprint 5)
//
// Fuzzy symbol search with dropdown results for the Markets page.
// Uses fetchSymbolSearch (local SymbolRegistry + Binance exchangeInfo)
// with debounced input, keyboard navigation, and instant add-to-watchlist.
//
// Features:
//   - Debounced fuzzy search (300ms)
//   - Dropdown results: symbol, name, exchange, asset class
//   - Keyboard nav: ↑/↓ arrows, Enter to select, Esc to close
//   - Hotkey: / focuses the search bar
//   - Click result → adds to watchlist
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback, memo, forwardRef, useImperativeHandle } from 'react';
import { C, F, M } from '../../../constants.js';
import { useWatchlistStore } from '../../../state/useWatchlistStore.js';
import { radii, transition, zIndex } from '../../../theme/tokens.js';

// ─── Asset class colors ────────────────────────────────────────

const ASSET_COLORS = {
  crypto: '#F7931A',
  stock: '#4A90D9',
  stocks: '#4A90D9',
  futures: '#8B5CF6',
  etf: '#10B981',
  forex: '#06B6D4',
  options: '#EC4899',
  other: '#6B7280',
};

// ═══════════════════════════════════════════════════════════════════
// MarketsSearchBar — Main Component (forwardRef for keyboard nav)
// ═══════════════════════════════════════════════════════════════════

const MarketsSearchBar = forwardRef(function MarketsSearchBar(_props, ref) {
  const addSymbol = useWatchlistStore((s) => s.add);
  const hasSymbol = useWatchlistStore((s) => s.has);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);

  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const debounceRef = useRef(null);

  // Expose input ref to parent via forwardRef
  useImperativeHandle(ref, () => inputRef.current, []);

  // ─── Debounced search ───────────────────────────────────────
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setLoading(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const { fetchSymbolSearch } = await import('../../../data/SymbolSearch.js');
        const hits = await fetchSymbolSearch(query);
        setResults(hits || []);
        setIsOpen(true);
        setHighlightIdx(0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  // ─── Global / hotkey to focus ───────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '/') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ─── Click outside to close ─────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ─── Add symbol handler ─────────────────────────────────────
  const handleSelect = useCallback((item) => {
    addSymbol({
      symbol: item.name || item.pair,
      name: item.description || item.name,
      assetClass: item.assetClass || 'crypto',
    });
    setQuery('');
    setResults([]);
    setIsOpen(false);
    inputRef.current?.blur();
  }, [addSymbol]);

  // ─── Keyboard navigation ───────────────────────────────────
  const handleKeyDown = useCallback((e) => {
    if (!isOpen || results.length === 0) {
      if (e.key === 'Escape') {
        setIsOpen(false);
        inputRef.current?.blur();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightIdx((prev) => Math.min(prev + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIdx((prev) => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (results[highlightIdx]) handleSelect(results[highlightIdx]);
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  }, [isOpen, results, highlightIdx, handleSelect]);

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* ─── Search Input ────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 14px',
          borderRadius: 8,
          border: `1px solid ${isOpen ? C.b : C.bd}`,
          background: C.sf,
          transition: `border-color ${transition.base}, box-shadow ${transition.base}`,
          boxShadow: isOpen ? `0 0 0 2px ${C.b}15` : 'none',
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke={isOpen ? C.b : C.t3}
          strokeWidth="2"
          strokeLinecap="round"
          style={{ flexShrink: 0, transition: `stroke ${transition.base}` }}
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (results.length > 0) setIsOpen(true); }}
          placeholder="Search symbols..."
          aria-label="Search and add symbols to watchlist"
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: C.t1,
            fontSize: 12,
            fontFamily: F,
            width: 160,
          }}
        />
        {loading && (
          <div
            style={{
              width: 12,
              height: 12,
              border: `2px solid ${C.bd}`,
              borderTopColor: C.b,
              borderRadius: '50%',
              animation: 'spin 0.6s linear infinite',
            }}
          />
        )}
        {!loading && !query && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: C.t3,
              background: `${C.bd}80`,
              borderRadius: 4,
              padding: '1px 5px',
              fontFamily: M,
            }}
          >
            /
          </span>
        )}
      </div>

      {/* ─── Dropdown Results ────────────────────────────── */}
      {isOpen && results.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 4,
            width: 320,
            maxHeight: 360,
            overflowY: 'auto',
            background: C.sf,
            border: `1px solid ${C.bd}`,
            borderRadius: radii.md,
            boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
            zIndex: zIndex.dropdown,
            padding: '4px 0',
          }}
        >
          {results.map((item, idx) => {
            const sym = item.name || item.pair;
            const alreadyAdded = hasSymbol(sym);
            const isHighlighted = idx === highlightIdx;
            const acColor = ASSET_COLORS[item.assetClass] || ASSET_COLORS.other;

            return (
              <div
                key={`${sym}-${idx}`}
                onClick={() => !alreadyAdded && handleSelect(item)}
                onMouseEnter={() => setHighlightIdx(idx)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  cursor: alreadyAdded ? 'default' : 'pointer',
                  background: isHighlighted ? `${C.b}08` : 'transparent',
                  transition: `background ${transition.fast}`,
                  opacity: alreadyAdded ? 0.5 : 1,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  {/* Color dot */}
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: acColor,
                      flexShrink: 0,
                      boxShadow: `0 0 6px ${acColor}40`,
                    }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: M }}>
                        {sym}
                      </span>
                      {item.exchange && (
                        <span style={{ fontSize: 9, color: C.t3, fontFamily: M }}>
                          {item.exchange}
                        </span>
                      )}
                    </div>
                    {item.description && item.description !== sym && (
                      <div
                        style={{
                          fontSize: 10,
                          color: C.t3,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.description}
                      </div>
                    )}
                  </div>
                </div>

                {/* Add / Already added badge */}
                {alreadyAdded ? (
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 600,
                      color: C.t3,
                      fontFamily: M,
                      flexShrink: 0,
                    }}
                  >
                    ✓ Added
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: C.b,
                      background: `${C.b}12`,
                      padding: '2px 8px',
                      borderRadius: radii.xs,
                      fontFamily: M,
                      flexShrink: 0,
                    }}
                  >
                    + Add
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── No results state ────────────────────────────── */}
      {isOpen && query.trim() && results.length === 0 && !loading && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 4,
            width: 280,
            padding: '16px',
            background: C.sf,
            border: `1px solid ${C.bd}`,
            borderRadius: radii.md,
            boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
            zIndex: zIndex.dropdown,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 12, color: C.t3, fontFamily: F }}>
            No results for "<strong style={{ color: C.t1 }}>{query}</strong>"
          </div>
          <button
            onClick={() => {
              addSymbol({ symbol: query.trim().toUpperCase() });
              setQuery('');
              setIsOpen(false);
            }}
            style={{
              marginTop: 8,
              padding: '6px 14px',
              borderRadius: radii.sm,
              fontSize: 11,
              fontWeight: 700,
              fontFamily: M,
              background: `${C.b}12`,
              color: C.b,
              border: `1px solid ${C.b}25`,
              cursor: 'pointer',
            }}
          >
            + Add "{query.trim().toUpperCase()}" anyway
          </button>
        </div>
      )}

      {/* Spinner keyframe */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
});

export { MarketsSearchBar };
export default memo(MarketsSearchBar);
