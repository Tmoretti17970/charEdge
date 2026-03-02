// ═══════════════════════════════════════════════════════════════════
// charEdge — Command Palette v2.0 (Ctrl+K / ⌘K)
// Phase 0.1 refactor: ~250 lines (was 628)
// Logic extracted into: command/commandRegistry, command/useCommandSearch
// UI extracted into: command/CommandItem
// ═══════════════════════════════════════════════════════════════════

import { useUserStore } from '../../../state/useUserStore.js';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { C, F, M } from '../../../constants.js';
import { useUIStore } from '../../../state/useUIStore.js';
import { useJournalStore } from '../../../state/useJournalStore.js';
import { useChartStore } from '../../../state/useChartStore.js';
import { exportCSV } from '../../../charting_library/datafeed/csv.js';

import { getCommands } from './command/commandRegistry.js';
import useCommandSearch from './command/useCommandSearch.js';
import CommandItem from './command/CommandItem.jsx';

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
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
    }),
    [setPage],
  );

  const commands = useMemo(() => getCommands(actions), [actions]);
  const { filtered, grouped } = useCommandSearch(commands, query, actions);

  // ─── Keyboard Shortcuts ───────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault(); e.stopPropagation();
        setOpen((o) => !o); setQuery(''); setSelectedIdx(0);
        return;
      }
      if (e.key === 'Escape' && open) { e.preventDefault(); setOpen(false); return; }
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      if (!open && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const pages = { 1: 'dashboard', 2: 'journal', 3: 'charts', 4: 'insights', 5: 'settings' };
        if (pages[e.key]) { e.preventDefault(); setPage(pages[e.key]); return; }
        if (e.key === 'n' || e.key === 'N') { e.preventDefault(); actions.addTrade(); return; }
        if (e.key === 't' || e.key === 'T') { e.preventDefault(); actions.toggleTheme(); return; }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, setPage, actions]);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50); }, [open]);

  const handlePaletteKeys = useCallback(
    (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, 0)); }
      else if (e.key === 'Enter') { e.preventDefault(); if (filtered[selectedIdx]) filtered[selectedIdx].action(); }
    },
    [filtered, selectedIdx],
  );

  useEffect(() => setSelectedIdx(0), [query]);

  if (!open) return null;

  let flatIdx = 0;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 5000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '12vh', animation: 'cmdPaletteIn 0.15s ease-out' }}>
      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(12px) saturate(1.8)', WebkitBackdropFilter: 'blur(12px) saturate(1.8)' }}
      />

      {/* Palette */}
      <div style={{
        position: 'relative', width: 560, maxWidth: '92vw',
        background: `rgba(${parseInt(C.sf.slice(1,3),16)||30},${parseInt(C.sf.slice(3,5),16)||30},${parseInt(C.sf.slice(5,7),16)||34},0.85)`,
        backdropFilter: 'blur(20px) saturate(1.5)', WebkitBackdropFilter: 'blur(20px) saturate(1.5)',
        border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, overflow: 'hidden',
        boxShadow: '0 24px 80px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,0.04) inset',
        animation: 'cmdSlideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      }}>
        {/* Search Input */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
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
        <div style={{ padding: '10px 18px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 16, fontSize: 10, color: C.t3, fontFamily: M }}>
          <span><kbd style={{ padding: '1px 4px', borderRadius: 3, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', fontSize: 9, fontFamily: M }}>↑↓</kbd> navigate</span>
          <span><kbd style={{ padding: '1px 4px', borderRadius: 3, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', fontSize: 9, fontFamily: M }}>↵</kbd> select</span>
          <span><kbd style={{ padding: '1px 4px', borderRadius: 3, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', fontSize: 9, fontFamily: M }}>esc</kbd> close</span>
          <span style={{ marginLeft: 'auto', opacity: 0.7 }}>@sym for symbols &middot; &gt;cmd for commands</span>
        </div>
      </div>

      <style>{`
        @keyframes cmdPaletteIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes cmdSlideUp { from { opacity: 0; transform: translateY(12px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>
    </div>
  );
}

export { CommandPalette };
