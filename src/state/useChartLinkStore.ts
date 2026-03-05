// ═══════════════════════════════════════════════════════════════════
// charEdge — Chart Link Store
//
// Manages color-coded link groups for multi-chart symbol sync.
// Charts in the same link group follow each other's symbol changes.
//
// Usage:
//   const { setLinkGroup, getLinkGroup, broadcastSymbol } = useChartLinkStore();
//   setLinkGroup(paneId, 'red');
//   broadcastSymbol('red', 'ETH', sourcePaneId);
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';

export type LinkGroup = 'red' | 'green' | 'blue' | 'yellow' | 'none';

export const LINK_GROUP_COLORS: Record<LinkGroup, string> = {
  red:    '#EF5350',
  green:  '#26A69A',
  blue:   '#42A5F5',
  yellow: '#FFCA28',
  none:   'transparent',
};

export const LINK_GROUPS: LinkGroup[] = ['red', 'green', 'blue', 'yellow', 'none'];

interface SymbolCallback {
  (symbol: string, sourcePaneId: string): void;
}

interface ChartLinkState {
  /** Map of paneId → assigned link group */
  links: Record<string, LinkGroup>;

  /** Callbacks for symbol change per pane */
  _symbolListeners: Map<string, SymbolCallback>;

  /** Assign a pane to a link group (or 'none' for independent) */
  setLinkGroup: (paneId: string, group: LinkGroup) => void;

  /** Get the link group for a pane */
  getLinkGroup: (paneId: string) => LinkGroup;

  /** Get all pane IDs in a given link group */
  getLinkedPanes: (group: LinkGroup) => string[];

  /** Register a callback for symbol changes on a pane */
  subscribeSymbol: (paneId: string, callback: SymbolCallback) => () => void;

  /** Broadcast a symbol change to all panes in the same link group */
  broadcastSymbol: (group: LinkGroup, symbol: string, sourcePaneId: string) => void;

  /** Remove a pane from tracking (cleanup on unmount) */
  removePaneLink: (paneId: string) => void;
}

const useChartLinkStore = create<ChartLinkState>((set, get) => ({
  links: {},
  _symbolListeners: new Map(),

  setLinkGroup: (paneId, group) => {
    set((s) => ({
      links: { ...s.links, [paneId]: group },
    }));
  },

  getLinkGroup: (paneId) => {
    return get().links[paneId] || 'none';
  },

  getLinkedPanes: (group) => {
    if (group === 'none') return [];
    const { links } = get();
    return Object.entries(links)
      .filter(([, g]) => g === group)
      .map(([id]) => id);
  },

  subscribeSymbol: (paneId, callback) => {
    get()._symbolListeners.set(paneId, callback);
    return () => {
      get()._symbolListeners.delete(paneId);
    };
  },

  broadcastSymbol: (group, symbol, sourcePaneId) => {
    if (group === 'none') return;
    const { links, _symbolListeners } = get();
    for (const [paneId, g] of Object.entries(links)) {
      if (paneId !== sourcePaneId && g === group) {
        const cb = _symbolListeners.get(paneId);
        if (cb) cb(symbol, sourcePaneId);
      }
    }
  },

  removePaneLink: (paneId) => {
    set((s) => {
      const next = { ...s.links };
      delete next[paneId];
      return { links: next };
    });
    get()._symbolListeners.delete(paneId);
  },
}));

export { useChartLinkStore };
export default useChartLinkStore;
