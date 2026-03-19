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
import { getActiveAccountId } from './state/useAccountStore';
import { initTelemetry } from './observability/telemetry';
import { useAnalyticsStore } from './state/useAnalyticsStore';
import { useGamificationStore } from './state/useGamificationStore';
import { useJournalStore, initAccountSwitchListener, prewarmAccountCache } from './state/useJournalStore';
import { useScriptStore } from './state/useScriptStore.js';
import { useUserStore } from './state/useUserStore';
import { useWatchlistStore } from './state/useWatchlistStore.js';
import { useWorkspaceStore } from './state/useWorkspaceStore';
import { logger } from '@/observability/logger.js';
import { track } from '@/observability/telemetry';

// Sprint 4 Task 4.1: Collect boot performance metrics from performance entries
function _collectBootMetrics() {
  try {
    const p1 = performance.getEntriesByName('boot:phase1')[0];
    const p2 = performance.getEntriesByName('boot:phase2')[0];
    const p3 = performance.getEntriesByName('boot:phase3')[0];
    if (!p1 || !p2 || !p3) return null;
    const phase1 = Math.round(p1.duration);
    const phase2 = Math.round(p2.duration);
    const phase3 = Math.round(p3.duration);
    return {
      phase1,
      phase2,
      phase3,
      total: phase1 + phase2 + phase3,
      phases: [
        { name: 'Load from Storage', duration: phase1, color: '#4ecdc4' },
        { name: 'Hydrate Stores', duration: phase2, color: '#ffa726' },
        { name: 'Post-Boot Setup', duration: phase3, color: '#7c4dff' },
      ],
    };
  } catch (_) {
    return null;
  }
}

// ─── Phase 1: Load from storage ─────────────────────────────────

/**
 * Run legacy migration, then read all stores from IndexedDB in parallel.
 * Returns the raw result objects — no store mutation happens here.
 * @returns {Promise<Object>} Raw storage results keyed by store name.
 */
export async function loadFromStorage() {
  performance.mark('boot:phase1:start');
  logger.boot.info('Phase 1: Legacy migration...');
  await StorageService.migrateFromLegacy();

  // Sprint 2 Task 2.1: Encrypt existing unencrypted trade data (one-time migration)
  try {
    const { getDeviceKey, isEncryptionSupported, isEncryptionEnabled, migrateStore } = await import('./data/StorageEncryption');
    if (isEncryptionSupported() && isEncryptionEnabled()) {
      await getDeviceKey(); // Ensure device key exists before reads
      const { openUnifiedDB } = await import('./data/UnifiedDB.js');
      const migrationDb = await openUnifiedDB();
      const stores = ['trades', 'trades_real', 'trades_demo', 'playbooks', 'playbooks_real', 'playbooks_demo', 'notes', 'notes_real', 'notes_demo'];
      let totalMigrated = 0;
      for (const store of stores) {
        try {
          totalMigrated += await migrateStore(migrationDb, store);
        } catch { /* store may not exist yet */ }
      }
      if (totalMigrated > 0) logger.boot.info(`Encrypted ${totalMigrated} previously-unencrypted records`);
      migrationDb.close();
    }
  } catch (err) {
    logger.boot.warn('Encryption migration skipped (non-fatal):', err?.message);
  }

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
    encryptedStore.init().catch((e) => logger.boot.warn('EncryptedStore init failed (non-fatal):', e?.message)),
    initApiKeys().catch((e) => logger.boot.warn('ApiKeyStore init failed (non-fatal):', e?.message)),
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
  performance.mark('boot:phase1:end');
  try { performance.measure('boot:phase1', 'boot:phase1:start', 'boot:phase1:end'); } catch (_) { /* */ }

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
  performance.mark('boot:phase2:start');
  logger.boot.info('Phase 2: Hydrating stores...');

  // ─── Journal (trades, playbooks, notes, plans) ────────────
  let trades = raw.tradesResult.ok ? raw.tradesResult.data : [];
  const playbooks = raw.playbooksResult.ok ? raw.playbooksResult.data : [];
  const notes = raw.notesResult.ok ? raw.notesResult.data : [];
  const tradePlans = raw.tradePlansResult.ok ? raw.tradePlansResult.data : [];

  // Financial precision migration — auto-round monetary fields.
  // Idempotent: trades already migrated (_moneyV === 1) are skipped.
  trades = migrateAllTrades(trades);

  const bootAccount = getActiveAccountId();
  if (trades.length === 0 && playbooks.length === 0 && bootAccount === 'demo') {
    logger.boot.info('Demo account is empty — seeding demo data...');
    const { genDemoData } = await import('./data/demoData.js');
    const demo = genDemoData();
    const seedData = {
      trades: demo.trades,
      playbooks: demo.playbooks,
      notes: [],
      tradePlans: [],
    };
    useJournalStore.getState().hydrate(seedData);
    logger.boot.info(`Seeded ${demo.trades.length} demo trades`);

    // Persist to demo IDB so it's there on next reload
    try {
      if (demo.trades.length > 0) await StorageService.trades.bulkPut(demo.trades);
      for (const pb of demo.playbooks) await StorageService.playbooks.put(pb);
    } catch (e) {
      logger.boot.warn('Demo data IDB persist failed (non-fatal):', e?.message);
    }
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
  // Only generate challenge if one doesn't exist for today
  const gamState = useGamificationStore.getState();
  const today = new Date().toISOString().slice(0, 10);
  if (!gamState.dailyChallenge || gamState.dailyChallenge.date !== today) {
    gamState.generateDailyChallenge();
  }

  logger.boot.info('Phase 2 complete.');
  performance.mark('boot:phase2:end');
  try { performance.measure('boot:phase2', 'boot:phase2:start', 'boot:phase2:end'); } catch (_) { /* */ }
  return trades;
}

// ─── Phase 3: Post-boot setup ────────────────────────────────────

/**
 * Initialize telemetry, persona, auto-save subscriptions, and check quota.
 * @param {Array} trades - Hydrated trades (for persona initialization).
 * @returns {Array<Function>} Unsubscribe functions from auto-save.
 */
export async function postBoot(trades) {
  performance.mark('boot:phase3:start');
  logger.boot.info('Phase 3: Post-boot setup...');

  // Telemetry (gated behind consent — Phase 1 GDPR compliance)
  const { useConsentStore } = await import('./state/useConsentStore.js');
  const consent = useConsentStore.getState().analytics;

  if (consent === true) {
    initTelemetry(useAnalyticsStore);

    // Product analytics (PostHog — consent-gated, lazy, env-gated)
    import('./observability/posthog')
      .then(({ trackEvent }) => trackEvent('app_booted', { tradeCount: trades?.length || 0 }))
      .catch(() => {}); // non-fatal
  } else {
    logger.boot.info('Analytics consent not granted — telemetry skipped');
  }

  // Persona from trade count
  useUserStore.getState().updateFromTrades(trades);

  // AI Copilot: Rebuild user profile intelligence from trade history
  try {
    const { userProfileStore } = await import('./ai/UserProfileStore');
    await userProfileStore.rebuild(trades || []);
    logger.boot.info('UserProfileStore rebuilt from trade history');
  } catch (err) {
    logger.boot.warn('UserProfileStore init failed (non-fatal): ' + err?.message);
  }

  // Auto-save subscriptions
  const unsubs = setupAutoSave();

  // Trade close capture — auto-screenshots + journal entries on trade close
  try {
    const { initTradeCloseCapture } = await import('./trading/TradeCloseCapture');
    const unsubCapture = initTradeCloseCapture();
    unsubs.push(unsubCapture);
    logger.boot.info('TradeCloseCapture service initialized');
  } catch (err) {
    logger.boot.warn('TradeCloseCapture init failed (non-fatal): ' + err?.message);
  }

  // v5: Initialize account switch listener — auto-rehydrates journal on switch
  initAccountSwitchListener();

  // v6: Pre-warm the opposite account's cache so first switch is instant
  {
    const { getActiveAccountId } = await import('./state/useAccountStore');
    const current = getActiveAccountId();
    const opposite = current === 'real' ? 'demo' : 'real';
    prewarmAccountCache(opposite); // fire-and-forget — never blocks boot
  }

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
  performance.mark('boot:phase3:end');
  try { performance.measure('boot:phase3', 'boot:phase3:start', 'boot:phase3:end'); } catch (_) { /* */ }
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

        // Sprint 4 Task 4.1: Collect boot phase metrics
        const bootMetrics = _collectBootMetrics();
        if (bootMetrics) {
          logger.boot.info(
            `Phase 1: ${bootMetrics.phase1}ms | Phase 2: ${bootMetrics.phase2}ms | Phase 3: ${bootMetrics.phase3}ms | Total: ${bootMetrics.total}ms`
          );
          if (typeof window !== 'undefined') window.__charEdge_bootMetrics = bootMetrics;
          try { track('boot_complete', bootMetrics); } catch (_) { /* telemetry best-effort */ }
        }

        if (!cancelled) {
          setPhase('ready');
          setReady(true);
        }
      } catch (err) {
        logger.boot.error('❌ Hydration failed', err);
        // Only seed demo data if on demo account — protect real trades
        const activeAccount = getActiveAccountId();
        if (activeAccount === 'demo') {
          const { genDemoData } = await import('./data/demoData.js');
          const demo = genDemoData();
          useJournalStore.getState().hydrate({
            trades: demo.trades,
            playbooks: demo.playbooks,
            notes: [],
            tradePlans: [],
          });
        } else {
          logger.boot.warn('Boot failed on real account — starting with empty journal to protect data');
          useJournalStore.getState().hydrate({ trades: [], playbooks: [], notes: [], tradePlans: [] });
        }
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

  return { ready, phase, bootMetrics: typeof window !== 'undefined' ? window.__charEdge_bootMetrics : null };
}

/**
 * Migrate data from old window.storage / localStorage into IndexedDB.
 * Called automatically during boot. Safe to call multiple times.
 */
export async function migrateFromV9() {
  return StorageService.migrateFromLegacy();
}
