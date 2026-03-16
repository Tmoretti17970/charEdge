// @ts-check
// ═══════════════════════════════════════════════════════════════════
// charEdge v11 — Watchlist Store (A++ Tier)
//
// Phase 2 upgrade:
//   - Folder hierarchy (Sprint 2A)
//   - Removed 50-item cap (Sprint 2B)
//   - Reorder stays (Sprint 2C will wire UI)
//   - Backward compatible with existing hydrate/persist
//
// Data model:
//   items: [{ symbol, name, assetClass, folderId?, addedAt }]
//   folders: [{ id, name, parentId, collapsed, sortOrder, color?, smart?, rules? }]
//
// Smart folder rules format:
//   rules: [{ field: 'changePercent'|'volume'|'assetClass'|'rsi', op: '>='|'<='|'=='|'!=', value: number|string }]
//   Logic: ALL rules must match (AND). Items matching auto-assign to the smart folder.
//
// Usage:
//   watchlist.add({ symbol: 'ES', folderId: 'tech' })
//   watchlist.addFolder('Tech Stocks')
//   watchlist.moveToFolder('ES', 'tech')
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';

// ─── Soft limits (no hard cap) ──────────────────────────────────

const SOFT_LIMIT = 200; // UX warning threshold, no enforcement
const MAX_WATCHLIST = 999; // Exported for backward compat, but not enforced

// ─── ID generator ───────────────────────────────────────────────

let _idCounter = 0;
function genId() {
  return `wf_${Date.now().toString(36)}_${(++_idCounter).toString(36)}`;
}

// ─── Defaults ───────────────────────────────────────────────────

const DEFAULT_WATCHLIST = [
  { symbol: 'ES', name: 'E-mini S&P 500', assetClass: 'futures', folderId: null },
  { symbol: 'NQ', name: 'E-mini Nasdaq', assetClass: 'futures', folderId: null },
  { symbol: 'BTC', name: 'Bitcoin', assetClass: 'crypto', folderId: null },
  { symbol: 'ETH', name: 'Ethereum', assetClass: 'crypto', folderId: null },
  { symbol: 'AAPL', name: 'Apple Inc.', assetClass: 'stocks', folderId: null },
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF', assetClass: 'etf', folderId: null },
];

// ─── Store ──────────────────────────────────────────────────────

const useWatchlistStore = create((set, get) => ({
  items: [],
  folders: [],
  loaded: false,
  notes: {},  // Sprint 37: Record<symbol, { text: string, updatedAt: string }>

  // ─── Notes Actions (Sprint 37) ─────────────────────────────────

  setNote: (symbol, text) => {
    const upper = (symbol || '').toUpperCase();
    set((s) => ({
      notes: {
        ...s.notes,
        [upper]: { text, updatedAt: new Date().toISOString() },
      },
    }));
  },

  getNote: (symbol) => {
    const upper = (symbol || '').toUpperCase();
    return get().notes[upper] || null;
  },

  // ─── Symbol Actions ─────────────────────────────────────────

  /**
   * Add a symbol to the watchlist.
   * @param {Object} item - { symbol, name?, assetClass?, folderId? }
   * @returns {boolean} true if added
   */
  add: (item) => {
    const s = get();
    const symbol = (item.symbol || '').toUpperCase().trim();
    if (!symbol) return false;
    if (s.items.some((i) => i.symbol === symbol)) return false;

    set({
      items: [
        ...s.items,
        {
          symbol,
          name: item.name || symbol,
          assetClass: item.assetClass || 'other',
          folderId: item.folderId || null,
          addedAt: Date.now(),
        },
      ],
    });
    return true;
  },

  /**
   * Remove a symbol from the watchlist.
   * @param {string} symbol
   */
  remove: (symbol) => {
    const upper = (symbol || '').toUpperCase();
    set((s) => ({
      items: s.items.filter((i) => i.symbol !== upper),
    }));
  },

  /**
   * Move a symbol to a new position (for drag-and-drop reorder).
   * @param {number} fromIdx
   * @param {number} toIdx
   */
  reorder: (fromIdx, toIdx) => {
    set((s) => {
      const items = [...s.items];
      const [moved] = items.splice(fromIdx, 1);
      items.splice(toIdx, 0, moved);
      return { items };
    });
  },

  /**
   * Update metadata for a symbol.
   * @param {string} symbol
   * @param {Object} updates - { name?, assetClass?, folderId? }
   */
  update: (symbol, updates) => {
    const upper = (symbol || '').toUpperCase();
    set((s) => ({
      items: s.items.map((i) => (i.symbol === upper ? { ...i, ...updates } : i)),
    }));
  },

  /**
   * Check if a symbol is in the watchlist.
   * @param {string} symbol
   * @returns {boolean}
   */
  has: (symbol) => {
    return get().items.some((i) => i.symbol === (symbol || '').toUpperCase());
  },

  /**
   * Move a symbol to a folder (or root if null).
   * @param {string} symbol
   * @param {string|null} folderId
   */
  moveToFolder: (symbol, folderId) => {
    const upper = (symbol || '').toUpperCase();
    set((s) => ({
      items: s.items.map((i) => (i.symbol === upper ? { ...i, folderId } : i)),
    }));
  },

  // ─── Folder Actions ─────────────────────────────────────────

  /**
   * Add a new folder.
   * @param {string} name
   * @param {string|null} parentId - null = root level
   * @param {string} [color] - optional accent color
   * @returns {string} folder ID
   */
  addFolder: (name, parentId = null, color = null) => {
    const id = genId();
    set((s) => ({
      folders: [
        ...s.folders,
        {
          id,
          name: name || 'New Folder',
          parentId,
          collapsed: false,
          sortOrder: s.folders.length,
          color,
        },
      ],
    }));
    return id;
  },

  /**
   * Add a smart folder with rules for auto-population.
   * @param {string} name
   * @param {Array} rules - [{ field, op, value }]
   * @param {string} [color]
   * @returns {string} folder ID
   */
  addSmartFolder: (name, rules = [], color = null) => {
    const id = genId();
    set((s) => ({
      folders: [
        ...s.folders,
        {
          id,
          name: name || 'Smart Folder',
          parentId: null,
          collapsed: false,
          sortOrder: s.folders.length,
          color,
          smart: true,
          rules: rules || [],
        },
      ],
    }));
    return id;
  },

  /**
   * Remove a folder and move its items to root.
   * @param {string} folderId
   */
  removeFolder: (folderId) => {
    set((s) => {
      // Get all descendant folder IDs (recursive)
      const allFolderIds = new Set([folderId]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const f of s.folders) {
          if (f.parentId && allFolderIds.has(f.parentId) && !allFolderIds.has(f.id)) {
            allFolderIds.add(f.id);
            changed = true;
          }
        }
      }

      return {
        folders: s.folders.filter((f) => !allFolderIds.has(f.id)),
        items: s.items.map((i) =>
          i.folderId && allFolderIds.has(i.folderId) ? { ...i, folderId: null } : i,
        ),
      };
    });
  },

  /**
   * Rename a folder.
   * @param {string} folderId
   * @param {string} newName
   */
  renameFolder: (folderId, newName) => {
    set((s) => ({
      folders: s.folders.map((f) => (f.id === folderId ? { ...f, name: newName } : f)),
    }));
  },

  /**
   * Toggle folder collapsed state.
   * @param {string} folderId
   */
  toggleFolderCollapse: (folderId) => {
    set((s) => ({
      folders: s.folders.map((f) =>
        f.id === folderId ? { ...f, collapsed: !f.collapsed } : f,
      ),
    }));
  },

  /**
   * Move a folder to a new parent (or root).
   * @param {string} folderId
   * @param {string|null} newParentId
   */
  moveFolder: (folderId, newParentId) => {
    // Prevent circular references
    if (folderId === newParentId) return;
    const s = get();
    // Check if newParentId is a descendant of folderId
    let current = newParentId;
    while (current) {
      if (current === folderId) return; // circular!
      const parent = s.folders.find((f) => f.id === current);
      current = parent?.parentId || null;
    }
    set((s) => ({
      folders: s.folders.map((f) =>
        f.id === folderId ? { ...f, parentId: newParentId } : f,
      ),
    }));
  },

  /**
   * Reorder folders within the same parent.
   * @param {number} fromIdx
   * @param {number} toIdx
   */
  reorderFolders: (fromIdx, toIdx) => {
    set((s) => {
      const folders = [...s.folders];
      const [moved] = folders.splice(fromIdx, 1);
      folders.splice(toIdx, 0, moved);
      return { folders: folders.map((f, i) => ({ ...f, sortOrder: i })) };
    });
  },

  /**
   * Get folder by ID.
   * @param {string} folderId
   * @returns {Object|null}
   */
  getFolder: (folderId) => {
    return get().folders.find((f) => f.id === folderId) || null;
  },

  /**
   * Get items in a specific folder (or root if null).
   * @param {string|null} folderId
   * @returns {Array}
   */
  getItemsInFolder: (folderId) => {
    return get().items.filter((i) => (i.folderId || null) === folderId);
  },

  /**
   * Get child folders of a parent (or root if null).
   * @param {string|null} parentId
   * @returns {Array}
   */
  getChildFolders: (parentId) => {
    return get()
      .folders.filter((f) => (f.parentId || null) === parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  },

  // ─── Bulk / Utility Actions ────────────────────────────────

  /** Clear the watchlist. */
  clear: () => set({ items: [], folders: [] }),

  /** Reset to default watchlist. */
  resetDefaults: () => set({ items: [...DEFAULT_WATCHLIST], folders: [] }),

  /**
   * How many more items can be added before soft limit.
   * @returns {number}
   */
  remainingCapacity: () => Math.max(0, SOFT_LIMIT - get().items.length),

  /**
   * Hydrate from IndexedDB.
   * Backward compatible: accepts either { items, folders } or just items[].
   * @param {Array|Object} data
   */
  hydrate: (data) => {
    if (data && typeof data === 'object' && !Array.isArray(data) && data.items) {
      // New format: { items, folders }
      set({
        items: Array.isArray(data.items) && data.items.length > 0
          ? data.items.map((i) => ({ ...i, folderId: i.folderId || null }))
          : [...DEFAULT_WATCHLIST],
        folders: Array.isArray(data.folders) ? data.folders : [],
        loaded: true,
      });
    } else {
      // Legacy format: just items array
      set({
        items: Array.isArray(data) && data.length > 0
          ? data.map((i) => ({ ...i, folderId: i.folderId || null }))
          : [...DEFAULT_WATCHLIST],
        folders: [],
        loaded: true,
      });
    }
  },
}));

// ─── Utility: group by asset class ──────────────────────────────

/**
 * Group watchlist items by asset class.
 * @param {Array} items
 * @returns {Map<string, Array>}
 */
function groupByAssetClass(items) {
  const groups = new Map();
  const order = ['futures', 'stocks', 'crypto', 'etf', 'forex', 'options', 'other'];

  for (const cl of order) groups.set(cl, []);
  for (const item of items) {
    const cl = item.assetClass || 'other';
    if (!groups.has(cl)) groups.set(cl, []);
    groups.get(cl).push(item);
  }

  // Remove empty groups
  for (const [key, val] of groups) {
    if (val.length === 0) groups.delete(key);
  }

  return groups;
}

/**
 * Build a folder tree structure for rendering.
 * Returns array of { folder, items, children: [ { folder, items, children } ] }
 * @param {Array} items - all watchlist items
 * @param {Array} folders - all folders
 * @param {string|null} parentId - root parent
 * @returns {Array}
 */
function buildFolderTree(items, folders, parentId = null) {
  const childFolders = folders
    .filter((f) => (f.parentId || null) === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return childFolders.map((folder) => ({
    folder,
    items: items.filter((i) => i.folderId === folder.id),
    children: buildFolderTree(items, folders, folder.id),
  }));
}

/**
 * Get items not in any folder (root level).
 * @param {Array} items
 * @returns {Array}
 */
function getRootItems(items) {
  return items.filter((i) => !i.folderId);
}

/**
 * Enrich watchlist items with trade stats from the journal.
 * @param {Array} watchlistItems
 * @param {Array} trades
 * @returns {Array} Items with { totalPnl, tradeCount, lastTraded }
 */
function enrichWithTradeStats(watchlistItems, trades) {
  // Build symbol → stats map once
  const statsMap = new Map();
  for (const t of trades) {
    if (!t.symbol) continue;
    const sym = t.symbol.toUpperCase();
    const stats = statsMap.get(sym) || { totalPnl: 0, tradeCount: 0, lastTraded: null };
    stats.totalPnl += t.pnl || 0;
    stats.tradeCount += 1;
    if (!stats.lastTraded || t.date > stats.lastTraded) stats.lastTraded = t.date;
    statsMap.set(sym, stats);
  }

  return watchlistItems.map((item) => ({
    ...item,
    ...(statsMap.get(item.symbol) || { totalPnl: 0, tradeCount: 0, lastTraded: null }),
  }));
}

/**
 * Evaluate smart folder rules and auto-assign matching items.
 * This is a pure function — call it whenever ticker data updates.
 * @param {Array} items - watchlist items
 * @param {Array} folders - all folders
 * @param {Object} tickerMap - { [symbol]: { lastPrice, priceChangePercent, volume, ... } }
 * @param {Object} [indicatorMap] - { [symbol]: { rsi, atr, bbWidth, ... } }
 * @returns {Array} Updated items with smart folder assignments
 */
function evaluateSmartFolders(items, folders, tickerMap = {}, indicatorMap = {}) {
  const smartFolders = folders.filter((f) => f.smart && f.rules?.length > 0);
  if (smartFolders.length === 0) return items;

  return items.map((item) => {
    // Check each smart folder
    for (const sf of smartFolders) {
      const matches = sf.rules.every((rule) => {
        const val = _resolveField(item, rule.field, tickerMap, indicatorMap);
        if (val === null || val === undefined) return false;
        return _evalOp(val, rule.op, rule.value);
      });
      if (matches) return { ...item, folderId: sf.id };
    }
    // Not matched by any smart folder — keep original (or root)
    const isInSmartFolder = smartFolders.some((sf) => sf.id === item.folderId);
    return isInSmartFolder ? { ...item, folderId: null } : item;
  });
}

/**
 * Resolve a field value from item, ticker, or indicator data.
 */
function _resolveField(item, field, tickerMap, indicatorMap) {
  const ticker = tickerMap[item.symbol] || {};
  const indicators = indicatorMap[item.symbol] || {};

  switch (field) {
    case 'assetClass': return item.assetClass;
    case 'symbol': return item.symbol;
    case 'changePercent': return ticker.priceChangePercent ? parseFloat(ticker.priceChangePercent) : null;
    case 'volume': return ticker.volume ? parseFloat(ticker.volume) : null;
    case 'price': return ticker.lastPrice ? parseFloat(ticker.lastPrice) : null;
    case 'rsi': return indicators.rsi ?? null;
    case 'atr': return indicators.atr ?? null;
    case 'bbWidth': return indicators.bbWidth ?? null;
    case 'sentiment': return indicators.sentiment ?? null;
    default: return null;
  }
}

/**
 * Evaluate a single rule operation.
 */
function _evalOp(val, op, target) {
  switch (op) {
    case '>=': return Number(val) >= Number(target);
    case '<=': return Number(val) <= Number(target);
    case '>': return Number(val) > Number(target);
    case '<': return Number(val) < Number(target);
    case '==': return String(val).toLowerCase() === String(target).toLowerCase();
    case '!=': return String(val).toLowerCase() !== String(target).toLowerCase();
    default: return false;
  }
}

// ─── Public API ─────────────────────────────────────────────────

const watchlist = {
  add: (item) => useWatchlistStore.getState().add(item),
  remove: (sym) => useWatchlistStore.getState().remove(sym),
  has: (sym) => useWatchlistStore.getState().has(sym),
  list: () => useWatchlistStore.getState().items,
  clear: () => useWatchlistStore.getState().clear(),
  addFolder: (name, parentId) => useWatchlistStore.getState().addFolder(name, parentId),
  removeFolder: (id) => useWatchlistStore.getState().removeFolder(id),
  moveToFolder: (sym, folderId) => useWatchlistStore.getState().moveToFolder(sym, folderId),
};

// ─── Exports ────────────────────────────────────────────────────

export {
  useWatchlistStore,
  watchlist,
  groupByAssetClass,
  buildFolderTree,
  getRootItems,
  enrichWithTradeStats,
  evaluateSmartFolders,
  DEFAULT_WATCHLIST,
  MAX_WATCHLIST,
  SOFT_LIMIT,
};
export default watchlist;
