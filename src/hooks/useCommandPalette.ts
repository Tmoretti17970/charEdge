// ═══════════════════════════════════════════════════════════════════
// charEdge — useCommandPalette Hook (Sprint 97)
//
// Command registry + fuzzy search engine + keyboard listener.
//
// Usage:
//   const { isOpen, toggle, register, search } = useCommandPalette();
//   register('nav-home', 'Go to Home', () => navigate('/'), 'Navigation');
// ═══════════════════════════════════════════════════════════════════

import { useState, useCallback, useEffect, useRef } from 'react';

// ─── Types ───────────────────────────────────────────────────────

export interface Command {
  id: string;
  label: string;
  action: () => void;
  category: string;
  icon?: string;
  shortcut?: string;
  keywords?: string[];
}

export interface CommandMatch {
  command: Command;
  score: number;
  highlights: number[];
}

// ─── Constants ──────────────────────────────────────────────────

const RECENT_KEY = 'charEdge-recent-commands';
const MAX_RECENT = 5;

// ─── Hook ───────────────────────────────────────────────────────

export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const registryRef = useRef<Map<string, Command>>(new Map());

  // ─── Toggle ──────────────────────────────────────────────────

  const toggle = useCallback(() => setIsOpen(prev => !prev), []);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => { setIsOpen(false); setQuery(''); }, []);

  // ─── Registry ────────────────────────────────────────────────

  const register = useCallback((
    id: string,
    label: string,
    action: () => void,
    category = 'General',
    opts?: { icon?: string; shortcut?: string; keywords?: string[] },
  ) => {
    registryRef.current.set(id, {
      id, label, action, category,
      icon: opts?.icon,
      shortcut: opts?.shortcut,
      keywords: opts?.keywords,
    });
  }, []);

  const unregister = useCallback((id: string) => {
    registryRef.current.delete(id);
  }, []);

  // ─── Search ──────────────────────────────────────────────────

  const search = useCallback((q: string): CommandMatch[] => {
    const commands = [...registryRef.current.values()];
    if (!q.trim()) {
      // Return recent + all commands
      const recent = _getRecent();
      const recentSet = new Set(recent);
      const recentCmds = recent
        .map(id => registryRef.current.get(id))
        .filter(Boolean) as Command[];
      const rest = commands.filter(c => !recentSet.has(c.id));

      return [
        ...recentCmds.map(c => ({ command: c, score: 100, highlights: [] })),
        ...rest.map(c => ({ command: c, score: 50, highlights: [] })),
      ];
    }

    return commands
      .map(cmd => {
        const { score, highlights } = _fuzzyMatch(q, cmd.label, cmd.keywords);
        return { command: cmd, score, highlights };
      })
      .filter(m => m.score > 0)
      .sort((a, b) => b.score - a.score);
  }, []);

  // ─── Execute ─────────────────────────────────────────────────

  const execute = useCallback((id: string) => {
    const cmd = registryRef.current.get(id);
    if (cmd) {
      cmd.action();
      _addRecent(id);
      close();
    }
  }, [close]);

  // ─── Keyboard Shortcut ───────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        toggle();
      }
      if (e.key === 'Escape' && isOpen) {
        close();
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [toggle, close, isOpen]);

  return {
    isOpen,
    query,
    setQuery,
    toggle,
    open,
    close,
    register,
    unregister,
    search,
    execute,
  };
}

// ─── Fuzzy Match ────────────────────────────────────────────────

function _fuzzyMatch(
  query: string,
  label: string,
  keywords?: string[],
): { score: number; highlights: number[] } {
  const q = query.toLowerCase();
  const l = label.toLowerCase();
  const highlights: number[] = [];
  let score = 0;

  // Exact substring match
  if (l.includes(q)) {
    const idx = l.indexOf(q);
    for (let i = idx; i < idx + q.length; i++) highlights.push(i);
    score = 80 + (q.length / l.length) * 20;
    return { score, highlights };
  }

  // Fuzzy character match
  let qi = 0;
  for (let li = 0; li < l.length && qi < q.length; li++) {
    if (l[li] === q[qi]) {
      highlights.push(li);
      qi++;
    }
  }

  if (qi === q.length) {
    // All query chars found in order
    score = 40 + (q.length / l.length) * 30;

    // Bonus for consecutive matches
    let consecutive = 0;
    for (let i = 1; i < highlights.length; i++) {
      if (highlights[i] === highlights[i - 1] + 1) consecutive++;
    }
    score += consecutive * 5;
  }

  // Check keywords
  if (keywords && score === 0) {
    for (const kw of keywords) {
      if (kw.toLowerCase().includes(q)) {
        score = 30;
        break;
      }
    }
  }

  return { score: Math.min(100, score), highlights };
}

// ─── Recent Commands ────────────────────────────────────────────

function _getRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch { return []; }
}

function _addRecent(id: string): void {
  try {
    const recent = _getRecent().filter(r => r !== id);
    recent.unshift(id);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
  } catch { /* */ }
}

export default useCommandPalette;
