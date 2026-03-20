// ═══════════════════════════════════════════════════════════════════
// charEdge — Hash Router (Sprint 6)
//
// Lightweight hash-based routing that syncs URL ↔ Zustand stores.
// Supports deep links like:
//   #/charts/BTC/1h   → Charts page, symbol=BTC, timeframe=1h
//   #/dashboard        → Dashboard page
//   #/journal          → Journal page
//
// Features:
//   - Browser back/forward button support
//   - Shareable URLs
//   - Deep link to specific chart configurations
//   - Updates URL silently on page/symbol/tf changes
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useRef } from 'react';
import { useUIStore } from '../state/useUIStore';
import { useChartCoreStore } from '../state/chart/useChartCoreStore';

// Valid page keys (must match PageRouter PAGES map)
const VALID_PAGES = new Set([
  'dashboard', 'journal', 'charts', 'markets', 'charolette',
  'settings', 'telemetry', 'changelog', 'privacy', 'terms',
  'landing', 'speedtest', 'import',
]);

/**
 * Parse the current hash into { page, symbol?, tf? }
 */
function parseHash() {
  const hash = window.location.hash.replace(/^#\/?/, '');
  if (!hash) return { page: null, symbol: null, tf: null };

  const parts = hash.split('/').filter(Boolean);
  const page = parts[0]?.toLowerCase() || null;

  if (page && !VALID_PAGES.has(page)) {
    return { page: null, symbol: null, tf: null };
  }

  return {
    page,
    symbol: parts[1] || null,
    tf: parts[2] || null,
  };
}

/**
 * Build a hash string from page + optional chart state.
 */
function buildHash(page, symbol, tf) {
  if (!page) return '';
  if (page === 'charts' && symbol) {
    return `#/${page}/${symbol.toUpperCase()}/${tf || '1h'}`;
  }
  return `#/${page}`;
}

/**
 * Hook: Syncs URL hash ↔ Zustand page/chart stores.
 * Mount this once in App.jsx.
 */
export function useHashRouter() {
  const suppressRef = useRef(false);
  const initializedRef = useRef(false);

  // ─── On mount: read hash → set initial state ───────────────
  useEffect(() => {
    const { page, symbol, tf } = parseHash();

    if (page) {
      useUIStore.getState().setPage(page);
      if (page === 'charts' && symbol) {
        const core = useChartCoreStore.getState();
        if (core.setSymbol) core.setSymbol(symbol.toUpperCase());
        if (tf && core.setTf) core.setTf(tf);
      }
    } else {
      // No hash present — set hash from current store state
      suppressRef.current = true;
      const currentPage = useUIStore.getState().page || 'dashboard';
      const sym = useChartCoreStore.getState().symbol;
      const currentTf = useChartCoreStore.getState().tf;
      const hash = buildHash(currentPage, sym, currentTf);
      if (hash) window.history.replaceState(null, '', hash);
      suppressRef.current = false;
    }

    initializedRef.current = true;
  }, []);

  // ─── Listen for back/forward button (popstate) ─────────────
  useEffect(() => {
    const onPopState = () => {
      if (suppressRef.current) return;
      const { page, symbol, tf } = parseHash();
      if (!page) return;

      suppressRef.current = true;
      useUIStore.getState().setPage(page);
      if (page === 'charts' && symbol) {
        const core = useChartCoreStore.getState();
        if (core.setSymbol) core.setSymbol(symbol.toUpperCase());
        if (tf && core.setTf) core.setTf(tf);
      }
      suppressRef.current = false;
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // ─── Sync page changes → URL ──────────────────────────────
  useEffect(() => {
    const unsub = useUIStore.subscribe((state) => {
      if (suppressRef.current || !initializedRef.current) return;

      const page = state.page;
      const sym = useChartCoreStore.getState().symbol;
      const tf = useChartCoreStore.getState().tf;
      const newHash = buildHash(page, sym, tf);
      if (newHash && window.location.hash !== newHash) {
        suppressRef.current = true;
        window.history.pushState(null, '', newHash);
        suppressRef.current = false;
      }
    });
    return unsub;
  }, []);

  // ─── Sync chart symbol/tf changes → URL ───────────────────
  useEffect(() => {
    const unsub = useChartCoreStore.subscribe((state) => {
      if (suppressRef.current || !initializedRef.current) return;

      const page = useUIStore.getState().page;
      if (page !== 'charts') return;

      const newHash = buildHash('charts', state.symbol, state.tf);
      if (newHash && window.location.hash !== newHash) {
        suppressRef.current = true;
        // replaceState for symbol/tf — don't pollute back history
        window.history.replaceState(null, '', newHash);
        suppressRef.current = false;
      }
    });
    return unsub;
  }, []);
}
