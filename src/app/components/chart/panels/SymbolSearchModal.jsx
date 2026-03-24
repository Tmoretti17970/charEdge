// ═══════════════════════════════════════════════════════════════════
// charEdge — Symbol Search Modal
// Spotlight-style frosted glass search overlay (Ctrl+K)
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import s from './SymbolSearchModal.module.css';

const RECENT_KEY = 'tf_recent_symbols';
const MAX_RECENT = 8;

const TRENDING = ['BTC', 'ETH', 'SOL', 'AAPL', 'NVDA', 'TSLA', 'SPY', 'ES'];

function getRecent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]').slice(0, MAX_RECENT); }
  // eslint-disable-next-line unused-imports/no-unused-vars
  catch (_) { return []; }
}

function addRecent(sym) {
  const arr = getRecent().filter(x => x !== sym);
  arr.unshift(sym);
  localStorage.setItem(RECENT_KEY, JSON.stringify(arr.slice(0, MAX_RECENT)));
}

export default function SymbolSearchModal({ isOpen, onClose, onSelect, onSearch, currentSymbol }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const searchTimer = useRef(null);

  // Recent symbols
  const recent = useMemo(() => getRecent(), [isOpen]); // eslint-disable-line

  // Display list
  const displayItems = useMemo(() => {
    if (query.length > 0 && results.length > 0) return results.map(r => ({ symbol: r.symbol || r.name || r.pair || String(r), name: r.description || r.displayName || r.name || '' }));
    if (query.length > 0) return [];
    const items = [];
    if (recent.length > 0) {
      items.push({ header: 'RECENT' });
      recent.forEach(x => items.push({ symbol: x, name: '' }));
    }
    items.push({ header: 'TRENDING' });
    TRENDING.filter(x => !recent.includes(x)).forEach(x => items.push({ symbol: x, name: '' }));
    return items;
  }, [query, results, recent]);

  const selectableItems = displayItems.filter(i => !i.header);

  // Auto-focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    if (!query || query.length < 1 || !onSearch) return;
    clearTimeout(searchTimer.current);
    setLoading(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const r = await onSearch(query);
        setResults(Array.isArray(r) ? r.slice(0, 12) : []);
      // eslint-disable-next-line unused-imports/no-unused-vars
      } catch (_) { setResults([]); }
      setLoading(false);
    }, 200);
    return () => clearTimeout(searchTimer.current);
  }, [query, onSearch]);

  const handleSelect = useCallback((sym) => {
    addRecent(sym);
    onSelect(sym);
    onClose();
  }, [onSelect, onClose]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, selectableItems.length - 1)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (selectableItems[selectedIdx]) handleSelect(selectableItems[selectedIdx].symbol);
      else if (query.trim()) handleSelect(query.trim().toUpperCase());
      return;
    }
  }, [selectableItems, selectedIdx, handleSelect, query, onClose]);

  if (!isOpen) return null;

  return (
    <div onClick={onClose} className={s.backdrop}>
      <div onClick={e => e.stopPropagation()} className={s.dialog}>
        {/* Search Input */}
        <div className={s.searchRow}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className={s.searchIcon}>
            <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
            <line x1="12" y1="12" x2="16" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value.toUpperCase()); setSelectedIdx(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Search symbol…"
            className={s.searchInput}
          />
          <kbd className={s.escBadge}>ESC</kbd>
        </div>

        {/* Results */}
        <div className={s.results}>
          {loading && <div className={s.loadingMsg}>Searching…</div>}
          {!loading && displayItems.length === 0 && query.length > 0 && (
            <div className={s.emptyMsg}>
              No results. Press Enter to use "{query}"
            </div>
          )}
          {displayItems.map((item, _i) => {
            if (item.header) {
              return (
                <div key={`h-${item.header}`} className={s.sectionHeader}>
                  {item.header}
                </div>
              );
            }
            const selectableIdx = selectableItems.indexOf(item);
            const isSelected = selectableIdx === selectedIdx;
            const isActive = item.symbol === currentSymbol;
            return (
              <button
                key={item.symbol}
                onClick={() => handleSelect(item.symbol)}
                onMouseEnter={() => setSelectedIdx(selectableIdx)}
                className={s.resultItem}
                data-selected={isSelected || undefined}
                data-active={isActive || undefined}
              >
                <span className={s.resultSymbol}>{item.symbol}</span>
                {item.name && <span className={s.resultName}>{item.name}</span>}
                {isActive && <span className={s.activeDot}>●</span>}
              </button>
            );
          })}
        </div>

        {/* Footer hint */}
        <div className={s.footer}>
          <span>↑↓ Navigate</span>
          <span>↵ Select</span>
          <span>ESC Close</span>
        </div>
      </div>
    </div>
  );
}
