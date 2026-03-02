// ═══════════════════════════════════════════════════════════════════
// charEdge — Symbol Search Modal
// Spotlight-style frosted glass search overlay (Ctrl+K)
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { C, F } from '../../../../constants.js';

const RECENT_KEY = 'tf_recent_symbols';
const MAX_RECENT = 8;

const TRENDING = ['BTC', 'ETH', 'SOL', 'AAPL', 'NVDA', 'TSLA', 'SPY', 'ES'];

function getRecent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]').slice(0, MAX_RECENT); }
  catch { return []; }
}

function addRecent(sym) {
  const arr = getRecent().filter(s => s !== sym);
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
    // Show recent + trending when no query
    const items = [];
    if (recent.length > 0) {
      items.push({ header: 'RECENT' });
      recent.forEach(s => items.push({ symbol: s, name: '' }));
    }
    items.push({ header: 'TRENDING' });
    TRENDING.filter(s => !recent.includes(s)).forEach(s => items.push({ symbol: s, name: '' }));
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
      } catch { setResults([]); }
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
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '12vh',
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        animation: 'tfFadeIn 0.15s ease',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 480,
          background: 'rgba(18, 20, 28, 0.92)',
          backdropFilter: 'saturate(180%) blur(24px)',
          WebkitBackdropFilter: 'saturate(180%) blur(24px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          boxShadow: '0 24px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)',
          overflow: 'hidden',
          animation: 'tfModalIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Search Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 18px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0, opacity: 0.5 }}>
            <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
            <line x1="12" y1="12" x2="16" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value.toUpperCase()); setSelectedIdx(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Search symbol…"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: C.t1,
              fontFamily: F,
              fontSize: 16,
              fontWeight: 500,
              letterSpacing: '0.5px',
            }}
          />
          <kbd style={{
            padding: '2px 6px', borderRadius: 5,
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            fontSize: 10, color: C.t3, fontFamily: F,
          }}>ESC</kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 360, overflowY: 'auto', padding: '6px 0' }}>
          {loading && <div style={{ padding: '12px 18px', fontSize: 12, color: C.t3, fontFamily: F }}>Searching…</div>}
          {!loading && displayItems.length === 0 && query.length > 0 && (
            <div style={{ padding: '16px 18px', fontSize: 12, color: C.t3, fontFamily: F, textAlign: 'center' }}>
              No results. Press Enter to use "{query}"
            </div>
          )}
          {displayItems.map((item, i) => {
            if (item.header) {
              return (
                <div key={`h-${item.header}`} style={{
                  padding: '8px 18px 4px',
                  fontSize: 9, fontWeight: 700, color: C.t3,
                  letterSpacing: '0.8px', fontFamily: F,
                }}>{item.header}</div>
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
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '8px 18px',
                  background: isSelected ? 'rgba(255,255,255,0.06)' : 'transparent',
                  border: 'none',
                  borderRadius: 0,
                  color: isActive ? C.b : C.t1,
                  fontFamily: F,
                  fontSize: 13,
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.1s ease',
                }}
              >
                <span style={{ fontWeight: 700, letterSpacing: '0.3px', minWidth: 50 }}>{item.symbol}</span>
                {item.name && <span style={{ fontSize: 11, color: C.t3, flex: 1 }}>{item.name}</span>}
                {isActive && <span style={{ fontSize: 10, color: C.b, opacity: 0.7 }}>●</span>}
              </button>
            );
          })}
        </div>

        {/* Footer hint */}
        <div style={{
          display: 'flex', gap: 12, padding: '8px 18px',
          borderTop: '1px solid rgba(255,255,255,0.04)',
          fontSize: 10, color: C.t3, fontFamily: F,
        }}>
          <span>↑↓ Navigate</span>
          <span>↵ Select</span>
          <span>ESC Close</span>
        </div>
      </div>
    </div>
  );
}
