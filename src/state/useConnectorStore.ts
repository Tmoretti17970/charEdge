// ═══════════════════════════════════════════════════════════════════
// charEdge — Connector Store (Phase 7 Sprint 7.1)
//
// Zustand store for broker connection state.
// Persists metadata (not credentials) to localStorage.
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';

const STORE_KEY = 'charEdge_connectors';

const useConnectorStore = create((set, get) => ({
  connections: [],
  loaded: false,

  // ─── Load from localStorage ───────────────────────────────────
  load: () => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      set({ connections: raw ? JSON.parse(raw) : [], loaded: true });
    } catch {
      set({ connections: [], loaded: true });
    }
  },

  // ─── Persist ──────────────────────────────────────────────────
  _persist: () => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(get().connections));
    } catch (e) {
      console.warn('[ConnectorStore] persist failed:', e);
    }
  },

  // ─── Add a new connection ─────────────────────────────────────
  addConnection: (connection) => {
    const entry = {
      id: connection.id,
      brokerId: connection.brokerId,
      brokerName: connection.brokerName,
      brokerLogo: connection.brokerLogo || '📊',
      status: 'connected',
      lastSync: null,
      tradeCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    set((s) => ({
      connections: [entry, ...s.connections.filter((c) => c.brokerId !== connection.brokerId)],
    }));
    get()._persist();
  },

  // ─── Remove a connection ──────────────────────────────────────
  removeConnection: (brokerId) => {
    set((s) => ({
      connections: s.connections.filter((c) => c.brokerId !== brokerId),
    }));
    get()._persist();
  },

  // ─── Update sync status ───────────────────────────────────────
  updateSyncStatus: (brokerId, updates) => {
    set((s) => ({
      connections: s.connections.map((c) =>
        c.brokerId === brokerId
          ? { ...c, ...updates, updatedAt: Date.now() }
          : c
      ),
    }));
    get()._persist();
  },

  // ─── Get all connections ──────────────────────────────────────
  getConnections: () => get().connections,

  // ─── Get specific connection ──────────────────────────────────
  getConnection: (brokerId) =>
    get().connections.find((c) => c.brokerId === brokerId),

  // ─── Get connected broker count ───────────────────────────────
  getConnectedCount: () =>
    get().connections.filter((c) => c.status === 'connected').length,

  // ─── Get total synced trade count ─────────────────────────────
  getTotalSyncedTrades: () =>
    get().connections.reduce((sum, c) => sum + (c.tradeCount || 0), 0),
}));

export { useConnectorStore };
export default useConnectorStore;
