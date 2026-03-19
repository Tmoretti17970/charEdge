// ═══════════════════════════════════════════════════════════════════
// charEdge — Command Palette (Sprint 97)
//
// Cmd+K searchable command palette overlay.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef, useCallback } from 'react';

// ─── Styles ─────────────────────────────────────────────────────

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    background: 'rgba(0, 0, 0, 0.5)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: '15vh',
  },
  palette: {
    background: 'var(--bg-secondary, #1e1e2e)',
    border: '1px solid var(--border, rgba(255,255,255,0.1))',
    borderRadius: '12px',
    width: '560px',
    maxHeight: '420px',
    overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
    display: 'flex',
    flexDirection: 'column',
  },
  inputWrap: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid var(--border, rgba(255,255,255,0.1))',
    gap: '10px',
  },
  searchIcon: {
    fontSize: '18px',
    opacity: 0.5,
  },
  input: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: 'var(--text-primary, #e0e0e0)',
    fontSize: '15px',
    fontFamily: 'inherit',
  },
  shortcutBadge: {
    fontSize: '11px',
    padding: '2px 6px',
    borderRadius: '4px',
    background: 'rgba(255,255,255,0.08)',
    color: 'var(--text-secondary, #888)',
  },
  list: {
    overflowY: 'auto',
    flex: 1,
    padding: '4px 0',
  },
  category: {
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--text-secondary, #888)',
    padding: '8px 16px 4px',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 16px',
    cursor: 'pointer',
    gap: '10px',
    fontSize: '14px',
    color: 'var(--text-primary, #e0e0e0)',
    transition: 'background 0.1s',
  },
  itemActive: {
    background: 'var(--accent, #6366f1)',
    color: '#fff',
  },
  itemIcon: {
    width: '20px',
    textAlign: 'center',
    opacity: 0.7,
  },
  itemShortcut: {
    marginLeft: 'auto',
    fontSize: '11px',
    opacity: 0.5,
  },
  empty: {
    padding: '24px 16px',
    textAlign: 'center',
    color: 'var(--text-secondary, #888)',
    fontSize: '14px',
  },
};

// ─── Component ──────────────────────────────────────────────────

export default function CommandPalette({ isOpen, query, setQuery, search, execute, close }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const results = search(query);

  // Focus input on open
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setActiveIndex(0);
    }
  }, [isOpen]);

  // Reset active index on query change
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[activeIndex]) {
      e.preventDefault();
      execute(results[activeIndex].command.id);
    } else if (e.key === 'Escape') {
      close();
    }
  }, [results, activeIndex, execute, close]);

  // Scroll active item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const active = list.children[activeIndex];
    if (active) active.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (!isOpen) return null;

  // Group by category
  const grouped = new Map();
  for (const match of results) {
    const cat = match.command.category || 'General';
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat).push(match);
  }

  return React.createElement('div', {
    style: styles.overlay,
    onClick: (e) => { if (e.target === e.currentTarget) close(); },
    'aria-modal': true,
    role: 'dialog',
    'aria-label': 'Command palette',
  },
    React.createElement('div', { style: styles.palette },
      // Search input
      React.createElement('div', { style: styles.inputWrap },
        React.createElement('span', { style: styles.searchIcon }, '🔍'),
        React.createElement('input', {
          ref: inputRef,
          style: styles.input,
          type: 'text',
          placeholder: 'Type a command…',
          value: query,
          onChange: (e) => setQuery(e.target.value),
          onKeyDown: handleKeyDown,
          'aria-label': 'Search commands',
        }),
        React.createElement('span', { style: styles.shortcutBadge }, 'ESC'),
      ),

      // Results
      React.createElement('div', { style: styles.list, ref: listRef },
        results.length === 0
          ? React.createElement('div', { style: styles.empty }, 'No commands found')
          : (() => {
              let flatIdx = 0;
              const items = [];

              for (const [category, matches] of grouped) {
                items.push(
                  React.createElement('div', {
                    key: `cat-${category}`,
                    style: styles.category,
                  }, category)
                );

                for (const match of matches) {
                  const idx = flatIdx++;
                  items.push(
                    React.createElement('div', {
                      key: match.command.id,
                      style: {
                        ...styles.item,
                        ...(idx === activeIndex ? styles.itemActive : {}),
                      },
                      onClick: () => execute(match.command.id),
                      onMouseEnter: () => setActiveIndex(idx),
                      role: 'option',
                      'aria-selected': idx === activeIndex,
                    },
                      match.command.icon && React.createElement('span', { style: styles.itemIcon }, match.command.icon),
                      React.createElement('span', null, match.command.label),
                      match.command.shortcut && React.createElement('span', { style: styles.itemShortcut }, match.command.shortcut),
                    )
                  );
                }
              }
              return items;
            })()
      ),
    ),
  );
}
