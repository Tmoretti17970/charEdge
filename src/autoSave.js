// ═══════════════════════════════════════════════════════════════════
// charEdge — Auto-Save Subscriptions
//
// Subscribes to Zustand store changes and debounces writes to
// IndexedDB. Returns an array of unsubscribe functions for cleanup.
//
// Usage:
//   const unsubs = setupAutoSave();
//   // Later:
//   unsubs.forEach(fn => fn());
// ═══════════════════════════════════════════════════════════════════

import { storageAdapter } from './data/StorageAdapter.js';
import { StorageService } from './data/StorageService';
import { useAnalyticsStore } from './state/useAnalyticsStore';
import { useGamificationStore } from './state/useGamificationStore';
import { useJournalStore } from './state/useJournalStore';
import { useScriptStore } from './state/useScriptStore.js';
import { useUserStore } from './state/useUserStore';
import { useWatchlistStore } from './state/useWatchlistStore.js';
import { useWorkspaceStore } from './state/useWorkspaceStore';
import { logger } from '@/observability/logger';

const AUTOSAVE_DELAY = 1500; // ms — debounce window for auto-save

/**
 * Set up debounced auto-save subscriptions.
 * Returns array of unsubscribe functions.
 */
export function setupAutoSave() {
  const unsubs = [];
  let tradeTimer = null;
  let settingsTimer = null;

  // Auto-save trades/playbooks/notes/tradePlans
  unsubs.push(
    useJournalStore.subscribe((state, prevState) => {
      // Skip the initial hydration write-back
      if (!prevState.loaded) return;

      clearTimeout(tradeTimer);
      tradeTimer = setTimeout(async () => {
        try {
          // Clear + rewrite ensures deletes persist correctly
          await Promise.all([
            storageAdapter.trades.replaceAll(state.trades),
            storageAdapter.playbooks.replaceAll(state.playbooks),
            storageAdapter.notes.replaceAll(state.notes),
            storageAdapter.tradePlans.replaceAll(state.tradePlans),
          ]);
        } catch (err) {
          logger.ui.warn('[AutoSave] Trades auto-save failed:', err);
        }
      }, AUTOSAVE_DELAY);
    }),
  );

  // Auto-save settings
  unsubs.push(
    useUserStore.subscribe((state) => {
      clearTimeout(settingsTimer);
      settingsTimer = setTimeout(async () => {
        try {
          // Strip out functions, save only data
          const { _update, _hydrate, _reset, ...data } = state;
          await StorageService.settings.set('settings', data);
        } catch (err) {
          logger.ui.warn('[AutoSave] Settings auto-save failed:', err);
        }
      }, AUTOSAVE_DELAY);
    }),
  );

  // Auto-save onboarding state
  let onboardingTimer = null;
  unsubs.push(
    useUserStore.subscribe((_state) => {
      clearTimeout(onboardingTimer);
      onboardingTimer = setTimeout(async () => {
        try {
          const data = useUserStore.getState().onboardingToJSON();
          await StorageService.settings.set('onboarding', data);
        } catch (err) {
          logger.ui.warn('[AutoSave] Onboarding auto-save failed:', err);
        }
      }, AUTOSAVE_DELAY);
    }),
  );

  // Auto-save scripts
  let scriptsTimer = null;
  unsubs.push(
    useScriptStore.subscribe((state) => {
      if (!state.loaded) return;
      clearTimeout(scriptsTimer);
      scriptsTimer = setTimeout(async () => {
        try {
          const data = useScriptStore.getState().toJSON();
          await StorageService.settings.set('scripts', data);
        } catch (err) {
          logger.ui.warn('[AutoSave] Scripts auto-save failed:', err);
        }
      }, AUTOSAVE_DELAY);
    }),
  );

  // Auto-save workspaces
  let workspacesTimer = null;
  unsubs.push(
    useWorkspaceStore.subscribe((state) => {
      clearTimeout(workspacesTimer);
      workspacesTimer = setTimeout(async () => {
        try {
          await StorageService.settings.set('workspaces', state.workspaces);
        } catch (err) {
          logger.ui.warn('[AutoSave] Workspaces auto-save failed:', err);
        }
      }, AUTOSAVE_DELAY);
    }),
  );

  // Auto-save watchlist
  let watchlistTimer = null;
  unsubs.push(
    useWatchlistStore.subscribe((state) => {
      if (!state.loaded) return;
      clearTimeout(watchlistTimer);
      watchlistTimer = setTimeout(async () => {
        try {
          await StorageService.settings.set('watchlist', state.items);
        } catch (err) {
          logger.ui.warn('[AutoSave] Watchlist auto-save failed:', err);
        }
      }, AUTOSAVE_DELAY);
    }),
  );

  // Auto-save gamification
  let gamificationTimer = null;
  unsubs.push(
    useGamificationStore.subscribe(() => {
      clearTimeout(gamificationTimer);
      gamificationTimer = setTimeout(async () => {
        try {
          const data = useGamificationStore.getState().toJSON();
          await StorageService.settings.set('gamification', data);
        } catch (err) {
          logger.ui.warn('[AutoSave] Gamification auto-save failed:', err);
        }
      }, AUTOSAVE_DELAY);
    }),
  );

  // Auto-save telemetry
  let telemetryTimer = null;
  unsubs.push(
    useAnalyticsStore.subscribe(() => {
      clearTimeout(telemetryTimer);
      telemetryTimer = setTimeout(async () => {
        try {
          const data = useAnalyticsStore.getState().toJSON();
          await StorageService.settings.set('telemetry', data);
        } catch (err) {
          logger.ui.warn('[AutoSave] Telemetry auto-save failed:', err);
        }
      }, AUTOSAVE_DELAY * 2); // less frequent than other stores
    }),
  );

  // Auto-update persona when trades change
  unsubs.push(
    useJournalStore.subscribe((state, prevState) => {
      if (!state.loaded) return;
      if (state.trades.length !== prevState.trades.length) {
        useUserStore.getState().updateFromTrades(state.trades);
      }
    }),
  );

  // Timer cleanup: clear all pending debounce timers on teardown.
  // Without this, pending setTimeout callbacks fire after unmount on stale state.
  unsubs.unshift(() => {
    clearTimeout(tradeTimer);
    clearTimeout(settingsTimer);
    clearTimeout(onboardingTimer);
    clearTimeout(scriptsTimer);
    clearTimeout(workspacesTimer);
    clearTimeout(watchlistTimer);
    clearTimeout(gamificationTimer);
    clearTimeout(telemetryTimer);
  });

  return unsubs;
}
