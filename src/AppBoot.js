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
import { setupAutoSave } from './autoSave.js';
import { migrateAllTrades } from './charting_library/model/Money.js';
import { encryptedStore } from './data/EncryptedStore.js';
import { initApiKeys } from './data/providers/ApiKeyStore.js';
import { StorageService } from './data/StorageService';
import { initTelemetry } from './observability/telemetry';
import { useAnalyticsStore } from './state/useAnalyticsStore';
import { useGamificationStore } from './state/useGamificationStore';
import { useJournalStore } from './state/useJournalStore';
import { useScriptStore } from './state/useScriptStore.js';
import { useUserStore } from './state/useUserStore';
import { useWatchlistStore } from './state/useWatchlistStore.js';
import { useWorkspaceStore } from './state/useWorkspaceStore';
import { logger } from '@/observability/logger.js';

// ─── Phase 1: Load from storage ─────────────────────────────────

/**
 * Run legacy migration, then read all stores from IndexedDB in parallel.
 * Returns the raw result objects — no store mutation happens here.
 * @returns {Promise<Object>} Raw storage results keyed by store name.
 */
export async function loadFromStorage() {
  logger.boot.info('Phase 1: Legacy migration...');
  await StorageService.migrateFromLegacy();

  // Initialize encrypted stores in parallel with IDB reads (Batch 16: 4.5.1)
  logger.boot.info('Phase 1: Initializing encrypted stores + loading from IndexedDB...');
  const [
    _encryptedStoreReady,
    _apiKeysReady,
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
    encryptedStore.init().catch(e => logger.boot.warn('EncryptedStore init failed (non-fatal):', e?.message)),
    initApiKeys().catch(e => logger.boot.warn('ApiKeyStore init failed (non-fatal):', e?.message)),
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
  logger.boot.info('Phase 1 complete.');

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
  logger.boot.info('Phase 2: Hydrating stores...');

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

  logger.boot.info('Phase 2 complete.');
  return trades;
}

// ─── Phase 3: Post-boot setup ────────────────────────────────────

/**
 * Initialize telemetry, persona, auto-save subscriptions, and check quota.
 * @param {Array} trades - Hydrated trades (for persona initialization).
 * @returns {Array<Function>} Unsubscribe functions from auto-save.
 */
export async function postBoot(trades) {
  logger.boot.info('Phase 3: Post-boot setup...');

  // Telemetry (gated behind consent — Phase 1 GDPR compliance)
  const { useConsentStore } = await import('./state/useConsentStore.js');
  const consent = useConsentStore.getState().analytics;

  if (consent === true) {
    initTelemetry(useAnalyticsStore);

    // Product analytics (PostHog — consent-gated, lazy, env-gated)
    import('./observability/posthog')
      .then(({ trackEvent }) => trackEvent('app_booted', { tradeCount: trades?.length || 0 }))
      .catch(() => { }); // non-fatal
  } else {
    logger.boot.info('Analytics consent not granted — telemetry skipped');
  }

  // Persona from trade count
  useUserStore.getState().updateFromTrades(trades);

  // Auto-save subscriptions
  const unsubs = setupAutoSave();

  // Start TickerPlant (activates DataSharedWorker for cross-tab WS dedup,
  // connects multi-source price aggregation, predictive prefetch)
  try {
    const { tickerPlant } = await import('./data/engine/streaming/TickerPlant.js');
    tickerPlant.start();
    logger.boot.info('TickerPlant started with SharedWorker multiplexing');
  } catch (err) {
    logger.boot.warn('TickerPlant startup failed (non-fatal): ' + err?.message);
  }

  // Storage quota check
  const quotaCheck = await StorageService.checkQuota();
  if (quotaCheck.ok && quotaCheck.data.percent > 85) {
    logger.boot.warn(`Storage quota at ${quotaCheck.data.percent}% — consider cleanup`);
    if (quotaCheck.data.percent >= 95) {
      logger.boot.warn('Critical quota — running auto-recovery');
      await StorageService.quotaRecovery(70);
    }
  }

  logger.boot.info('Phase 3 complete.');
  return unsubs;
}

// ─── Hook ────────────────────────────────────────────────────────

/**
 * Hook that hydrates all stores from IndexedDB.
 * Returns { ready, phase } where phase tracks boot progress.
 */
export function useAppBoot() {
  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState('connecting');
  const unsubscribers = useRef([]);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        setPhase('loading');
        const raw = await loadFromStorage();
        if (cancelled) return;

        setPhase('computing');
        const trades = await hydrateStores(raw);
        if (cancelled) return;

        unsubscribers.current = await postBoot(trades);

        logger.boot.info('✅ Boot complete!');
        if (!cancelled) {
          setPhase('ready');
          setReady(true);
        }
      } catch (err) {
        logger.boot.error('❌ Hydration failed', err);
        // Seed demo data so the app still works
        const { genDemoData } = await import('./data/demoData.js');
        const demo = genDemoData();
        useJournalStore.getState().hydrate({
          trades: demo.trades,
          playbooks: demo.playbooks,
          notes: [],
          tradePlans: [],
        });
        if (!cancelled) {
          setPhase('ready');
          setReady(true);
        }
      }
    }

    boot();

    return () => {
      cancelled = true;
      unsubscribers.current.forEach((unsub) => unsub());
    };
  }, []);

  return { ready, phase };
}

/**
 * Migrate data from old window.storage / localStorage into IndexedDB.
 * Called automatically during boot. Safe to call multiple times.
 */
export async function migrateFromV9() {
  return StorageService.migrateFromLegacy();
}
