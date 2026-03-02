import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import BrokerSyncService from '../services/BrokerSync.js';
import { useJournalStore } from './useJournalStore.js';

let syncerInstance = null;
let _statusInterval = null;

export const useBrokerStore = create(
  persist(
    (set, get) => ({
      tokens: { schwab: '', ibkr: '', tradovate: '' },
      status: {},
      isSyncing: false,

      setToken: (brokerId, token) => {
        set((state) => ({
          tokens: { ...state.tokens, [brokerId]: token },
        }));
        get().initSyncer();
      },

      disconnect: (brokerId) => {
        set((state) => {
          const newTokens = { ...state.tokens, [brokerId]: '' };
          return { tokens: newTokens };
        });
        get().initSyncer();
      },

      initSyncer: () => {
        const { tokens } = get();
        if (syncerInstance) syncerInstance.stop();

        const tradeStore = useJournalStore.getState();
        const getTokenFn = (_, brokerId) => get().tokens[brokerId] || null;

        syncerInstance = new BrokerSyncService(getTokenFn, tradeStore, 'local_user');

        // Start polling for endpoints that have tokens
        if (tokens.schwab || tokens.ibkr || tokens.tradovate) {
          syncerInstance.start();
        }

        // Clear previous interval to prevent memory leak
        if (_statusInterval) clearInterval(_statusInterval);

        // Periodically update sync status so UI can react
        _statusInterval = setInterval(() => {
          if (syncerInstance) {
            set({ status: syncerInstance.getStatus() });
          }
        }, 5000);
      },

      syncNow: async (brokerId) => {
        if (!syncerInstance) get().initSyncer();
        set({ isSyncing: true });
        try {
          await syncerInstance.syncBroker(brokerId);
          set({ status: syncerInstance.getStatus() });
        } finally {
          set({ isSyncing: false });
        }
      },
    }),
    {
      name: 'charEdge-brokers',
    },
  ),
);
