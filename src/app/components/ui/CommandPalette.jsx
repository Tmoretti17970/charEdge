// ═══════════════════════════════════════════════════════════════════
// charEdge — Command Palette v3.0 (Ctrl+K / ⌘K)
//
// Two modes:
//   1. Commands — search & execute app commands (navigate, theme, etc.)
//   2. Logbook  — Spotlight trade browser with search, sparklines, etc.
//
// External triggers:
//   - ⌘K keyboard shortcut toggles the palette
//   - 'charEdge:open-logbook' custom event opens directly in Logbook mode
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { exportCSV } from '../../../charting_library/datafeed/csv.js';
import { C, F, M, GLASS, DEPTH } from '../../../constants.js';
import { useChartStore } from '../../../state/useChartStore';
import { useJournalStore } from '../../../state/useJournalStore';
import { useUIStore } from '../../../state/useUIStore';
import { useUserStore } from '../../../state/useUserStore';
import CommandItem from './command/CommandItem.jsx';
import { getCommands } from './command/commandRegistry.js';
import useCommandSearch from './command/useCommandSearch.js';
import SpotlightLogbook from './SpotlightLogbook.jsx';
import { useHotkeys } from '@/hooks/useHotkeys';

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('commands'); // 'commands' | 'logbook'
  const [filterDate, setFilterDate] = useState(null);
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef(null);
  const setPage = useUIStore((s) => s.setPage);

  // Actions object — passed to command registry
  const actions = useMemo(
    () => ({
      close: () => setOpen(false),
      setPage: (page) => { setPage(page); setOpen(false); },
      addTrade: () => { setOpen(false); window.dispatchEvent(new CustomEvent('charEdge:global-quick-add')); },
      importCSV: () => { setPage('journal'); setOpen(false); window.dispatchEvent(new CustomEvent('charEdge:import-csv')); },
      exportCSV: () => {
        const trades = useJournalStore.getState().trades;
        if (!trades.length) return;
        const csv = exportCSV(trades);
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url;
        a.download = `charEdge-export-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click(); URL.revokeObjectURL(url); setOpen(false);
      },
      setChartType: (type) => { useChartStore.getState().setChartType(type); setPage('charts'); setOpen(false); },
      setDrawingTool: (toolId) => {
        useChartStore.getState().setActiveTool(toolId);
        if (useUIStore.getState().page !== 'charts') setPage('charts');
        setOpen(false);
      },
      toggleTheme: () => { useUserStore.getState().toggleTheme(); setOpen(false); },
      toggleZen: () => { useUIStore.getState().toggleZen(); setOpen(false); },
      openLogbook: () => { setMode('logbook'); if (!open) setOpen(true); },
    }),
    [setPage, open],
  );

  const commands = useMemo(() => getCommands(actions), [actions]);
  const { filtered, grouped } = useCommandSearch(commands, query, actions);

  // ─── Keyboard Shortcuts (P2 4.3: migrated to useHotkeys) ────
  useHotkeys([
    // Ctrl+K toggle
    {
      key: 'ctrl+k', handler: (e) => {
        e.preventDefault(); e.stopPropagation();
        setOpen((o) => {
          if (!o) { setMode('commands'); setFilterDate(null); }
          return !o;
        });
        setQuery(''); setSelectedIdx(0);
      }
    },
    // Escape to close
    {
      key: 'Escape', handler: (e) => {
        if (open) { e.preventDefault(); setOpen(false); }
      }
    },
  ], { scope: 'global', enabled: true });

  // Page navigation + quick actions (only when palette is closed)
  useHotkeys([
    { key: '1', handler: (e) => { e.preventDefault(); setPage('dashboard'); } },
    { key: '2', handler: (e) => { e.preventDefault(); setPage('journal'); } },
    { key: '3', handler: (e) => { e.preventDefault(); setPage('charts'); } },
    { key: '4', handler: (e) => { e.preventDefault(); setPage('insights'); } },
    { key: '5', handler: (e) => { e.preventDefault(); setPage('settings'); } },
    { key: 'n', handler: (e) => { e.preventDefault(); actions.addTrade(); } },
    { key: 't', handler: (e) => { e.preventDefault(); actions.toggleTheme(); } },
  ], { scope: 'global', enabled: !open });

  // ─── External Logbook trigger (from heatmap, nav pill, etc.) ─
  useEffect(() => {
    const handler = (e) => {
      setMode('logbook');
      setFilterDate(e.detail?.date || null);
      setOpen(true);
    };
    window.addEventListener('charEdge:open-logbook', handler);
    return () => window.removeEventListener('charEdge:open-logbook', handler);
  }, []);

  useEffect(() => {
    if (open && mode === 'commands') setTimeout(() => inputRef.current?.focus(), 50);
  }, [open, mode]);

  const handlePaletteKeys = useCallback(
    (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, 0)); }
      else if (e.key === 'Enter') { e.preventDefault(); if (filtered[selectedIdx]) filtered[selectedIdx].action(); }
    },
    [filtered, selectedIdx],
  );

  useEffect(() => setSelectedIdx(0), [query]);

  // ─── Logbook Mode ─────────────────────────────────────────
  if (open && mode === 'logbook') {
    return (
      <SpotlightLogbook
        isOpen={true}
        onClose={() => setOpen(false)}
        filterDate={filterDate}
      />
    );
  }

  if (!open) return null;

  let flatIdx = 0;

  // ─── Mode pill styles ─────────────────────────────────────
  const pillBase = { padding: '4px 10px', borderRadius: 8, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer', border: 'none', transition: 'all 0.15s', flexShrink: 0 };
  const pillActive = { ...pillBase, background: C.b, color: '#fff' };
  const pillInactive = { ...pillBase, background: C.sf2, color: C.t3 };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 5000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '12vh', animation: 'fadeIn 0.15s ease-out' }}>
      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(12px) saturate(1.8)', WebkitBackdropFilter: 'blur(12px) saturate(1.8)' }}
      />

      {/* Palette */}
      <div style={{
        position: 'relative', width: 560, maxWidth: '92vw',
        background: GLASS.heavy,
        backdropFilter: GLASS.blurXl, WebkitBackdropFilter: GLASS.blurXl,
        border: GLASS.border, borderRadius: 16, overflow: 'hidden',
        boxShadow: DEPTH[4],
        animation: 'slideUpScale 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      }}>
        {/* Search Input */}
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.bd}30`, display: 'flex', alignItems: 'center', gap: 12 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.b} strokeWidth="2" strokeLinecap="round" style={{ opacity: 0.8, flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef} value={query}
            onChange={(e) => setQuery(e.target.value)} onKeyDown={handlePaletteKeys}
            placeholder="Search commands, symbols, or trades..."
            style={{ flex: 1, padding: '8px 0', border: 'none', background: 'transparent', color: C.t1, fontSize: 15, fontFamily: F, fontWeight: 500, outline: 'none', letterSpacing: '-0.01em' }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', color: C.t3, cursor: 'pointer', fontSize: 14, padding: 0 }}>✕</button>
          )}
          {/* Mode pills */}
          <button style={pillActive} onClick={() => setMode('commands')}>⌘ Commands</button>
          <button style={pillInactive} onClick={() => { setMode('logbook'); setFilterDate(null); }}>📋 Logbook</button>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 400, overflowY: 'auto', padding: '4px 0', scrollbarWidth: 'thin' }}>
          {Object.entries(grouped).map(([group, cmds]) => (
            <div key={group}>
              <div style={{ padding: '10px 18px 4px', fontSize: 9, fontWeight: 700, color: C.b, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: M, opacity: 0.8 }}>
                {group}
              </div>
              {cmds.map((cmd) => {
                const thisIdx = flatIdx++;
                return (
                  <CommandItem
                    key={cmd.id} cmd={cmd} isSelected={thisIdx === selectedIdx}
                    onSelect={() => setSelectedIdx(thisIdx)} onExecute={() => cmd.action()}
                  />
                );
              })}
            </div>
          ))}

          {filtered.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: C.t3, fontSize: 13 }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>🔍</div>
              No matching commands for "{query}"
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 18px', borderTop: `1px solid ${C.bd}30`, display: 'flex', gap: 16, fontSize: 10, color: C.t3, fontFamily: M }}>
          <span><kbd style={{ padding: '1px 4px', borderRadius: 3, background: C.sf2, border: `1px solid ${C.bd}`, fontSize: 9, fontFamily: M }}>↑↓</kbd> navigate</span>
          <span><kbd style={{ padding: '1px 4px', borderRadius: 3, background: C.sf2, border: `1px solid ${C.bd}`, fontSize: 9, fontFamily: M }}>↵</kbd> select</span>
          <span><kbd style={{ padding: '1px 4px', borderRadius: 3, background: C.sf2, border: `1px solid ${C.bd}`, fontSize: 9, fontFamily: M }}>esc</kbd> close</span>
          <span style={{ marginLeft: 'auto', opacity: 0.7 }}>@sym for symbols &middot; &gt;cmd for commands</span>
        </div>
      </div>

    </div>
  );
}

export { CommandPalette };
