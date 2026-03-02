// ═══════════════════════════════════════════════════════════════════
// charEdge — App Boot Sequence
//
// Hydrates all Zustand stores from IndexedDB on first mount.
// Seeds demo data if the database is empty (first-time user).
// Subscribes to store changes for debounced auto-save.
//
// Boot phases (each individually testable):
//   1. loadFromStorage()  — legacy migration + IndexedDB reads
//   2. hydrateStores()    — push raw data into Zustand stores
//   3. postBoot()         — telemetry, auto-save, quota check
//
// Usage in App.jsx:
//   import { useAppBoot } from './AppBoot.js';
//   function App() {
//     const ready = useAppBoot();
//     if (!ready) return <LoadingScreen />;
//     return <AppMain />;
//   }
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react';
import { useJournalStore } from './state/useJournalStore.js';
import { useUserStore } from './state/useUserStore.js';
import { useScriptStore } from './state/useScriptStore.js';
import { useWorkspaceStore } from './state/useWorkspaceStore.js';
import { useWatchlistStore } from './state/useWatchlistStore.js';
import { useGamificationStore } from './state/useGamificationStore.js';
import { StorageService } from './data/StorageService.js';
import { migrateAllTrades } from './charting_library/model/Money.js';
import { useAnalyticsStore } from './state/useAnalyticsStore.js';
import { initTelemetry } from './utils/telemetry.js';
import { setupAutoSave } from './autoSave.js';

// ─── Phase 1: Load from storage ─────────────────────────────────

/**
 * Run legacy migration, then read all stores from IndexedDB in parallel.
 * Returns the raw result objects — no store mutation happens here.
 * @returns {Promise<Object>} Raw storage results keyed by store name.
 */
export async function loadFromStorage() {
  console.log('[AppBoot] Phase 1: Legacy migration...');
  await StorageService.migrateFromLegacy();

  console.log('[AppBoot] Phase 1: Loading from IndexedDB...');
  const [
    tradesResult,
    playbooksResult,
    notesResult,
    tradePlansResult,
    settingsResult,
    onboardingResult,
    scriptsResult,
    workspacesResult,
    watchlistResult,
    gamificationResult,
  ] = await Promise.all([
    StorageService.trades.getAll(),
    StorageService.playbooks.getAll(),
    StorageService.notes.getAll(),
    StorageService.tradePlans.getAll(),
    StorageService.settings.get('settings'),
    StorageService.settings.get('onboarding'),
    StorageService.settings.get('scripts'),
    StorageService.settings.get('workspaces'),
    StorageService.settings.get('watchlist'),
    StorageService.settings.get('gamification'),
  ]);
  console.log('[AppBoot] Phase 1 complete.');

  return {
    tradesResult,
    playbooksResult,
    notesResult,
    tradePlansResult,
    settingsResult,
    onboardingResult,
    scriptsResult,
    workspacesResult,
    watchlistResult,
    gamificationResult,
  };
}

// ─── Phase 2: Hydrate stores ─────────────────────────────────────

/**
 * Push raw storage data into all Zustand stores.
 * Seeds demo data if the database is empty (first-time user).
 * Returns the hydrated trades array (needed by postBoot for persona).
 * @param {Object} raw - Result object from loadFromStorage().
 * @returns {Promise<Array>} Hydrated trades array.
 */
export async function hydrateStores(raw) {
  console.log('[AppBoot] Phase 2: Hydrating stores...');

  // ─── Journal (trades, playbooks, notes, plans) ────────────
  let trades = raw.tradesResult.ok ? raw.tradesResult.data : [];
  const playbooks = raw.playbooksResult.ok ? raw.playbooksResult.data : [];
  const notes = raw.notesResult.ok ? raw.notesResult.data : [];
  const tradePlans = raw.tradePlansResult.ok ? raw.tradePlansResult.data : [];

  // Financial precision migration — auto-round monetary fields.
  // Idempotent: trades already migrated (_moneyV === 1) are skipped.
  trades = migrateAllTrades(trades);

  if (trades.length === 0 && playbooks.length === 0) {
    const { genDemoData } = await import('./data/demoData.js');
    const demo = genDemoData();
    useJournalStore.getState().hydrate({
      trades: demo.trades,
      playbooks: demo.playbooks,
      notes: [],
      tradePlans: [],
    });
  } else {
    useJournalStore.getState().hydrate({ trades, playbooks, notes, tradePlans });
  }

  // ─── Settings ─────────────────────────────────────────────
  const savedSettings = raw.settingsResult.ok ? raw.settingsResult.data : null;
  if (savedSettings && typeof savedSettings === 'object') {
    useUserStore.getState().hydrateSettings(savedSettings);
  }

  // ─── Onboarding ───────────────────────────────────────────
  const savedOnboarding = raw.onboardingResult.ok ? raw.onboardingResult.data : null;
  if (savedOnboarding && typeof savedOnboarding === 'object') {
    useUserStore.getState().hydrateOnboarding(savedOnboarding);
  }

  // ─── Scripts ──────────────────────────────────────────────
  const savedScripts = raw.scriptsResult.ok ? raw.scriptsResult.data : null;
  useScriptStore.getState().hydrate(Array.isArray(savedScripts) ? savedScripts : []);

  // ─── Workspaces ───────────────────────────────────────────
  const savedWorkspaces = raw.workspacesResult.ok ? raw.workspacesResult.data : null;
  useWorkspaceStore.getState().hydrate(Array.isArray(savedWorkspaces) ? savedWorkspaces : []);

  // ─── Watchlist ────────────────────────────────────────────
  const savedWatchlist = raw.watchlistResult.ok ? raw.watchlistResult.data : null;
  useWatchlistStore.getState().hydrate(Array.isArray(savedWatchlist) ? savedWatchlist : []);

  // ─── Gamification ─────────────────────────────────────────
  const savedGamification = raw.gamificationResult.ok ? raw.gamificationResult.data : null;
  if (savedGamification && typeof savedGamification === 'object') {
    useGamificationStore.getState().hydrate(savedGamification);
  }
  useGamificationStore.getState().generateDailyChallenge();

  console.log('[AppBoot] Phase 2 complete.');
  return trades;
}

// ─── Phase 3: Post-boot setup ────────────────────────────────────

/**
 * Initialize telemetry, persona, auto-save subscriptions, and check quota.
 * @param {Array} trades - Hydrated trades (for persona initialization).
 * @returns {Array<Function>} Unsubscribe functions from auto-save.
 */
export async function postBoot(trades) {
  console.log('[AppBoot] Phase 3: Post-boot setup...');

  // Telemetry
  initTelemetry(useAnalyticsStore);

  // Persona from trade count
  useUserStore.getState().updateFromTrades(trades);

  // Auto-save subscriptions
  const unsubs = setupAutoSave();

  // Start TickerPlant (activates DataSharedWorker for cross-tab WS dedup,
  // connects multi-source price aggregation, predictive prefetch)
  try {
    const { tickerPlant } = await import('./data/engine/streaming/TickerPlant.js');
    tickerPlant.start();
    console.log('[AppBoot] TickerPlant started with SharedWorker multiplexing');
  } catch (err) {
    console.warn('[AppBoot] TickerPlant startup failed (non-fatal):', err?.message);
  }

  // Storage quota check
  const quotaCheck = await StorageService.checkQuota();
  if (quotaCheck.ok && quotaCheck.data.percent > 85) {
    console.warn(`[AppBoot] Storage quota at ${quotaCheck.data.percent}% — consider cleanup`);
    if (quotaCheck.data.percent >= 95) {
      console.warn('[AppBoot] Critical quota — running auto-recovery');
      await StorageService.quotaRecovery(70);
    }
  }

  console.log('[AppBoot] Phase 3 complete.');
  return unsubs;
}

// ─── Hook ────────────────────────────────────────────────────────

/**
 * Hook that hydrates all stores from IndexedDB.
 * Returns true when boot is complete.
 */
export function useAppBoot() {
  const [ready, setReady] = useState(false);
  const unsubscribers = useRef([]);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        const raw = await loadFromStorage();
        if (cancelled) return;

        const trades = await hydrateStores(raw);
        if (cancelled) return;

        unsubscribers.current = await postBoot(trades);

        console.log('[AppBoot] ✅ Boot complete!');
        if (!cancelled) setReady(true);
      } catch (err) {
        console.error('[AppBoot] ❌ Hydration failed:', err);
        // Seed demo data so the app still works
        const { genDemoData } = await import('./data/demoData.js');
        const demo = genDemoData();
        useJournalStore.getState().hydrate({
          trades: demo.trades,
          playbooks: demo.playbooks,
          notes: [],
          tradePlans: [],
        });
        if (!cancelled) setReady(true);
      }
    }

    boot();

    return () => {
      cancelled = true;
      unsubscribers.current.forEach((unsub) => unsub());
    };
  }, []);

  return ready;
}

/**
 * Migrate data from old window.storage / localStorage into IndexedDB.
 * Called automatically during boot. Safe to call multiple times.
 */
export async function migrateFromV9() {
  return StorageService.migrateFromLegacy();
}
