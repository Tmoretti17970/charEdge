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

  // Auto-save trades/playbooks/notes/tradePlans (Phase 3 Task #42: delta writes)
  unsubs.push(
    useJournalStore.subscribe((state, prevState) => {
      // Skip the initial hydration write-back
      if (!prevState.loaded) return;

      clearTimeout(tradeTimer);
      tradeTimer = setTimeout(async () => {
        try {
          // Delta writes for trades — compare by reference to find changes
          if (state.trades !== prevState.trades) {
            const prevIds = new Set(prevState.trades.map(t => t.id));
            const currIds = new Set(state.trades.map(t => t.id));

            // Upsert new/changed trades
            const toWrite = state.trades.filter(
              t => !prevIds.has(t.id) || prevState.trades.find(p => p.id === t.id) !== t
            );
            if (toWrite.length > 0) {
              await Promise.all(toWrite.map(t => storageAdapter.trades.put(t)));
            }

            // Delete removed trades
            for (const prev of prevState.trades) {
              if (!currIds.has(prev.id)) {
                await storageAdapter.trades.delete(prev.id);
              }
            }
          }

          // Playbooks/notes/tradePlans are small — replaceAll is fine
          if (state.playbooks !== prevState.playbooks) {
            await storageAdapter.playbooks.replaceAll(state.playbooks);
          }
          if (state.notes !== prevState.notes) {
            await storageAdapter.notes.replaceAll(state.notes);
          }
          if (state.tradePlans !== prevState.tradePlans) {
            await storageAdapter.tradePlans.replaceAll(state.tradePlans);
          }
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

  // ─── Visibility flush guard ─────────────────────────────────────
  // Immediately persist all dirty stores when the tab becomes hidden
  // or the page is about to unload. Prevents data loss within the
  // 1.5s debounce window.
  const flushAll = async () => {
    clearTimeout(tradeTimer);
    clearTimeout(settingsTimer);
    clearTimeout(onboardingTimer);
    clearTimeout(scriptsTimer);
    clearTimeout(workspacesTimer);
    clearTimeout(watchlistTimer);
    clearTimeout(gamificationTimer);
    clearTimeout(telemetryTimer);
    try {
      const journalState = useJournalStore.getState();
      if (journalState.loaded) {
        await Promise.all([
          storageAdapter.trades.replaceAll(journalState.trades),
          storageAdapter.playbooks.replaceAll(journalState.playbooks),
          storageAdapter.notes.replaceAll(journalState.notes),
          storageAdapter.tradePlans.replaceAll(journalState.tradePlans),
        ]);
      }
      const { _update, _hydrate, _reset, ...userData } = useUserStore.getState();
      await StorageService.settings.set('settings', userData);

      const scriptState = useScriptStore.getState();
      if (scriptState.loaded) await StorageService.settings.set('scripts', scriptState.toJSON());

      await StorageService.settings.set('workspaces', useWorkspaceStore.getState().workspaces);

      const wlState = useWatchlistStore.getState();
      if (wlState.loaded) await StorageService.settings.set('watchlist', wlState.items);

      await StorageService.settings.set('gamification', useGamificationStore.getState().toJSON());
    } catch (err) {
      logger.ui.warn('[AutoSave] Visibility flush failed:', err);
    }
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') flushAll();
  };
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('beforeunload', flushAll);

  unsubs.push(
    () => document.removeEventListener('visibilitychange', onVisibilityChange),
    () => window.removeEventListener('beforeunload', flushAll),
  );

  return unsubs;
}
