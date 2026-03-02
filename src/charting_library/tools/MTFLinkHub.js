// ═══════════════════════════════════════════════════════════════════
// charEdge — Multi-Timeframe Linking Hub (Sprint 14)
// Synchronizes crosshair, symbol, and drawings across MTF panels.
// ═══════════════════════════════════════════════════════════════════

/**
 * MTF Link Group — links multiple chart panes so they move together.
 */
export class MTFLinkGroup {
  constructor(id) {
    this.id = id;
    this.panes = new Map(); // paneId → { symbol, tf, syncDrawings, syncCursor }
    this.listeners = new Map();
  }

  addPane(paneId, config = {}) {
    this.panes.set(paneId, {
      symbol: config.symbol || 'BTC',
      tf: config.tf || '1h',
      syncDrawings: config.syncDrawings ?? true,
      syncCursor: config.syncCursor ?? true,
      syncSymbol: config.syncSymbol ?? true,
    });
  }

  removePane(paneId) {
    this.panes.delete(paneId);
    this.listeners.delete(paneId);
  }

  onUpdate(paneId, callback) {
    this.listeners.set(paneId, callback);
  }

  // When one pane changes symbol, update all linked panes
  broadcastSymbolChange(fromPaneId, newSymbol) {
    for (const [paneId, config] of this.panes) {
      if (paneId === fromPaneId || !config.syncSymbol) continue;
      config.symbol = newSymbol;
      this.listeners.get(paneId)?.({ type: 'symbol', symbol: newSymbol });
    }
  }

  // Broadcast crosshair position
  broadcastCursor(fromPaneId, timestamp, price) {
    for (const [paneId, config] of this.panes) {
      if (paneId === fromPaneId || !config.syncCursor) continue;
      this.listeners.get(paneId)?.({ type: 'cursor', timestamp, price });
    }
  }

  // Broadcast drawing created
  broadcastDrawing(fromPaneId, drawing) {
    for (const [paneId, config] of this.panes) {
      if (paneId === fromPaneId || !config.syncDrawings) continue;
      // Only sync horizontal drawings (they're timeframe-independent)
      if (['hline', 'hray', 'rect', 'alertzone'].includes(drawing.type)) {
        this.listeners.get(paneId)?.({ type: 'drawing', drawing: { ...drawing, synced: true } });
      }
    }
  }

  getLinkedPanes() {
    return Array.from(this.panes.entries()).map(([id, config]) => ({ id, ...config }));
  }
}

/**
 * Global MTF link manager.
 */
const _linkGroups = new Map();

export function createLinkGroup(id) {
  const group = new MTFLinkGroup(id);
  _linkGroups.set(id, group);
  return group;
}

export function getLinkGroup(id) {
  return _linkGroups.get(id);
}

export function removeLinkGroup(id) {
  const group = _linkGroups.get(id);
  if (group) {
    group.panes.clear();
    group.listeners.clear();
    _linkGroups.delete(id);
  }
}

export function getAllLinkGroups() {
  return Array.from(_linkGroups.values());
}

/**
 * Pre-configured MTF layout templates.
 */
export const MTF_TEMPLATES = [
  {
    id: 'standard_3',
    label: '3-Panel MTF',
    desc: 'Higher TF context → Primary → Lower TF entry',
    panes: [
      { tf: '4h', role: 'context' },
      { tf: '1h', role: 'primary' },
      { tf: '15m', role: 'entry' },
    ],
  },
  {
    id: 'standard_4',
    label: '4-Panel MTF',
    desc: 'Daily → 4H → 1H → 15m',
    panes: [
      { tf: '1D', role: 'macro' },
      { tf: '4h', role: 'context' },
      { tf: '1h', role: 'primary' },
      { tf: '15m', role: 'entry' },
    ],
  },
  {
    id: 'scalper',
    label: 'Scalper Setup',
    desc: '1H context → 5m → 1m execution',
    panes: [
      { tf: '1h', role: 'context' },
      { tf: '5m', role: 'primary' },
      { tf: '1m', role: 'entry' },
    ],
  },
  {
    id: 'swing',
    label: 'Swing Trader',
    desc: 'Weekly → Daily → 4H',
    panes: [
      { tf: '1W', role: 'macro' },
      { tf: '1D', role: 'primary' },
      { tf: '4h', role: 'entry' },
    ],
  },
];
