// ═══════════════════════════════════════════════════════════════════
// charEdge — Command Search Hook
// Extracted from CommandPalette (Phase 0.1): fuzzy search, symbol
// matching, filtering, and grouping logic.
// ═══════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { useJournalStore } from '../../../../state/useJournalStore';
import { POPULAR_SYMBOLS } from './commandRegistry.js';
import { useChartCoreStore } from '../../../../state/chart/useChartCoreStore';

// ─── Fuzzy Match ────────────────────────────────────────────────

function fuzzyMatch(query, text) {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t.includes(q)) return true;
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

/**
 * @param {Array} commands - Command objects from getCommands()
 * @param {string} query - Current search query
 * @param {Object} actions - Actions object for symbol navigation
 * @returns {{ filtered: Array, grouped: Object }}
 */
export default function useCommandSearch(commands, query, actions) {
  // Build symbol search results from trades + popular symbols
  const symbolResults = useMemo(() => {
    const trades = useJournalStore.getState().trades;
    const tradeSymbols = [];
    const seen = new Set();
    for (let i = trades.length - 1; i >= 0; i--) {
      const s = trades[i].symbol?.toUpperCase();
      if (s && !seen.has(s)) {
        seen.add(s);
        tradeSymbols.push(s);
      }
    }
    const recent = tradeSymbols.slice(0, 5).map((sym) => ({
      id: `sym-recent-${sym}`, label: sym, sublabel: 'Recent',
      group: 'Recent Symbols', icon: '🕐',
      action: () => { useChartCoreStore.getState().setSymbol(sym); actions.setPage('charts'); },
    }));
    const popular = POPULAR_SYMBOLS
      .filter((p) => !seen.has(p.sym))
      .slice(0, 8)
      .map((p) => ({
        id: `sym-${p.sym}`, label: p.sym, sublabel: p.name,
        group: 'Symbols', icon: p.icon,
        action: () => { useChartCoreStore.getState().setSymbol(p.sym); actions.setPage('charts'); },
      }));
    return { recent, popular };
  }, [actions]);

  // Filter commands by query
  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return commands;

    // @ prefix: symbol search only
    if (q.startsWith('@')) {
      const symQ = q.slice(1).toLowerCase();
      if (!symQ) return [...symbolResults.recent, ...symbolResults.popular];
      return [...symbolResults.recent, ...symbolResults.popular].filter(
        (s) => s.label.toLowerCase().includes(symQ) || s.sublabel?.toLowerCase().includes(symQ)
      );
    }

    // > prefix: commands only
    if (q.startsWith('>')) {
      const cmdQ = q.slice(1).trim();
      if (!cmdQ) return commands;
      return commands.filter((c) => fuzzyMatch(cmdQ, c.label) || fuzzyMatch(cmdQ, c.group));
    }

    // Default: search commands + symbols
    const matchedCmds = commands.filter((c) => fuzzyMatch(q, c.label) || fuzzyMatch(q, c.group));
    const matchedSyms = [...symbolResults.recent, ...symbolResults.popular].filter(
      (s) => s.label.toLowerCase().includes(q.toLowerCase()) || s.sublabel?.toLowerCase().includes(q.toLowerCase())
    );

    // If query looks like a ticker, prioritize symbols
    if (/^[A-Z]{1,5}$/.test(q)) {
      const arbitraryCmd = {
        id: `sym-open-${q}`, label: q, sublabel: 'Open chart',
        group: 'Symbols', icon: '📈',
        action: () => { useChartCoreStore.getState().setSymbol(q); actions.setPage('charts'); },
      };
      const existsAlready = matchedSyms.some((s) => s.label === q);
      return existsAlready ? [...matchedSyms, ...matchedCmds] : [arbitraryCmd, ...matchedSyms, ...matchedCmds];
    }

    return [...matchedCmds, ...matchedSyms];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commands, query, symbolResults]);

  // Group filtered commands
  const grouped = useMemo(() => {
    const groups = {};
    for (const cmd of filtered) {
      if (!groups[cmd.group]) groups[cmd.group] = [];
      groups[cmd.group].push(cmd);
    }
    return groups;
  }, [filtered]);

  return { filtered, grouped };
}
