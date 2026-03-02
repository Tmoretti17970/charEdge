// ═══════════════════════════════════════════════════════════════════
// charEdge — Offline Cache Manager (Sprint 23)
//
// Provides instant load by caching dashboard computations.
// Stores pre-computed metrics in localStorage so the dashboard
// renders immediately with cached data while fresh data loads.
//
// Key features:
//   - Cache dashboard metrics (P&L, win rate, etc.)
//   - Stale-while-revalidate pattern
//   - Background refresh when data changes
//   - Cache invalidation on new trade
// ═══════════════════════════════════════════════════════════════════

const CACHE_PREFIX = 'tf-dash-cache-';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ─── Cache API ───────────────────────────────────────────────────

export function setCache(key, data) {
  try {
    const entry = {
      data,
      ts: Date.now(),
      version: 1,
    };
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // Storage full — clear old caches
    clearOldCaches();
  }
}

export function getCache(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    return {
      data: entry.data,
      ts: entry.ts,
      age: Date.now() - entry.ts,
      stale: Date.now() - entry.ts > CACHE_TTL,
    };
  } catch {
    return null;
  }
}

export function invalidateCache(key) {
  try {
    if (key) {
      localStorage.removeItem(CACHE_PREFIX + key);
    }
  } catch {}
}

export function invalidateAllCaches() {
  try {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(CACHE_PREFIX));
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {}
}

function clearOldCaches() {
  try {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(CACHE_PREFIX));
    const entries = keys
      .map((k) => {
        try { return { key: k, ts: JSON.parse(localStorage.getItem(k))?.ts || 0 }; }
        catch { return { key: k, ts: 0 }; }
      })
      .sort((a, b) => a.ts - b.ts);

    // Remove oldest half
    const toRemove = entries.slice(0, Math.ceil(entries.length / 2));
    toRemove.forEach((e) => localStorage.removeItem(e.key));
  } catch {}
}

// ─── Cached Computation Hook ─────────────────────────────────────

import { useState, useEffect, useRef, useMemo } from 'react';

/**
 * useCachedComputation — Stale-while-revalidate for expensive computations.
 *
 * Returns cached data immediately, then recomputes in background.
 *
 * @param {string} key        Cache key
 * @param {Function} computeFn  Function that returns the computed data
 * @param {Array} deps        Dependencies — recompute when these change
 * @returns {{ data: any, stale: boolean, loading: boolean }}
 */
export function useCachedComputation(key, computeFn, deps) {
  const cached = useMemo(() => getCache(key), [key]);
  const [data, setData] = useState(cached?.data ?? null);
  const [stale, setStale] = useState(cached?.stale ?? true);
  const computeRef = useRef(computeFn);
  computeRef.current = computeFn;

  useEffect(() => {
    // Always recompute fresh data
    try {
      const fresh = computeRef.current();
      setData(fresh);
      setStale(false);
      setCache(key, fresh);
    } catch {
      // Keep cached data on error
    }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, stale, loading: data === null };
}

// ─── Dashboard Metrics Cache ─────────────────────────────────────

export function cacheDashboardMetrics(trades) {
  if (!trades || trades.length === 0) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayTrades = trades.filter((t) => t.date && new Date(t.date) >= today);
  const todayPnl = todayTrades.reduce((s, t) => s + (t.pnl || 0), 0);
  const totalPnl = trades.reduce((s, t) => s + (t.pnl || 0), 0);
  const wins = trades.filter((t) => (t.pnl || 0) > 0).length;
  const winRate = trades.length > 0 ? Math.round((wins / trades.length) * 100) : 0;

  setCache('dashboard-metrics', {
    totalPnl,
    todayPnl,
    todayTradeCount: todayTrades.length,
    totalTradeCount: trades.length,
    winRate,
    wins,
    losses: trades.length - wins,
    lastUpdated: Date.now(),
  });
}

// ─── Service Worker Registration (Progressive) ──────────────────

export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    // Only register if a SW file exists
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // SW not available — that's fine, we have localStorage cache
    });
  }
}

export default {
  setCache,
  getCache,
  invalidateCache,
  invalidateAllCaches,
  useCachedComputation,
  cacheDashboardMetrics,
  registerServiceWorker,
};
