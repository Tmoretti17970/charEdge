// ═══════════════════════════════════════════════════════════════════
// charEdge — Sync Engine (Phase 7 Sprint 7.1)
//
// Orchestrates periodic trade sync across all connected brokers.
// Handles: scheduling, dedup, batch stamping, visibility pause.
// ═══════════════════════════════════════════════════════════════════

import { getActiveConnectors } from './ConnectorRegistry.js';
import { importFile } from '../importExport/importFile.js';
import { generateBatchId } from '../../state/useImportHistoryStore.js';
import { useImportHistoryStore } from '../../state/useImportHistoryStore.js';
import { useJournalStore } from '../../state/useJournalStore.js';
import { logger } from '@/observability/logger';

let _syncInterval = null;
let _isRunning = false;
const _syncListeners = new Set();

// ─── Public API ─────────────────────────────────────────────────

/**
 * Start the global sync engine.
 * @param {Object} [options]
 * @param {number} [options.intervalMs] - Default: 5 minutes
 */
export function startSyncEngine(options = {}) {
  const intervalMs = options.intervalMs || 5 * 60 * 1000;

  stopSyncEngine();

  // Initial sync on start
  syncAll();

  _syncInterval = setInterval(() => {
    if (document.visibilityState !== 'hidden') {
      syncAll();
    }
  }, intervalMs);

  // Pause/resume with tab visibility
  document.addEventListener('visibilitychange', _onVisibilityChange);

  logger.data.info(`[SyncEngine] Started with ${intervalMs / 1000}s interval`);
}

/**
 * Stop the global sync engine.
 */
export function stopSyncEngine() {
  if (_syncInterval) {
    clearInterval(_syncInterval);
    _syncInterval = null;
  }
  document.removeEventListener('visibilitychange', _onVisibilityChange);
  logger.data.info('[SyncEngine] Stopped');
}

/**
 * Sync all connected brokers now.
 * @returns {Promise<{ results: Array<{ id: string, ok: boolean, tradeCount: number, error?: string }> }>}
 */
export async function syncAll() {
  if (_isRunning) {
    logger.data.info('[SyncEngine] Sync already in progress, skipping');
    return { results: [] };
  }

  _isRunning = true;
  _emit('sync_start');

  const connectors = getActiveConnectors();
  if (connectors.length === 0) {
    _isRunning = false;
    return { results: [] };
  }

  const results = [];

  for (const connector of connectors) {
    try {
      const syncResult = await connector.sync({
        since: connector.lastSync ? new Date(connector.lastSync) : undefined,
      });

      if (syncResult.ok && syncResult.trades.length > 0) {
        // Dedup and import trades via existing pipeline
        const batchId = generateBatchId();
        const existingTrades = useJournalStore.getState().trades;

        // Stamp batch IDs
        syncResult.trades.forEach((t) => {
          t._batchId = batchId;
          t._source = connector.id;
        });

        // Dedup against existing
        const existingHashes = new Set(
          existingTrades
            .filter((t) => t.date && t.symbol)
            .map((t) => `${t.date}|${t.symbol}|${t.side}|${t.quantity}|${t.price}`)
        );

        const unique = syncResult.trades.filter((t) => {
          const hash = `${t.date}|${t.symbol}|${t.side}|${t.quantity}|${t.price}`;
          return !existingHashes.has(hash);
        });

        if (unique.length > 0) {
          // Add to journal
          useJournalStore.getState().addTrades(unique);

          // Record in import history
          useImportHistoryStore.getState().addBatch({
            id: batchId,
            broker: connector.id,
            brokerLabel: connector.name,
            fileName: `API Sync — ${connector.name}`,
            tradeCount: unique.length,
            duplicatesSkipped: syncResult.trades.length - unique.length,
            timestamp: Date.now(),
            status: 'active',
            totalPnl: unique.reduce((sum, t) => sum + (parseFloat(t.pnl) || 0), 0),
          });
        }

        results.push({ id: connector.id, ok: true, tradeCount: unique.length });
      } else {
        results.push({ id: connector.id, ok: syncResult.ok, tradeCount: 0, error: syncResult.error });
      }
    } catch (err) {
      results.push({ id: connector.id, ok: false, tradeCount: 0, error: err.message });
    }
  }

  _isRunning = false;
  _emit('sync_complete', results);
  logger.data.info(`[SyncEngine] Sync complete: ${results.length} connectors, ${results.reduce((s, r) => s + r.tradeCount, 0)} new trades`);

  return { results };
}

/**
 * Sync a single connector by ID.
 * @param {string} connectorId
 * @returns {Promise<{ ok: boolean, tradeCount: number, error?: string }>}
 */
export async function syncOne(connectorId) {
  const connectors = getActiveConnectors();
  const connector = connectors.find((c) => c.id === connectorId);
  if (!connector) return { ok: false, tradeCount: 0, error: 'Connector not found or not connected' };

  const all = await syncAll(); // reuse full pipeline for consistency
  const result = all.results.find((r) => r.id === connectorId);
  return result || { ok: false, tradeCount: 0, error: 'Sync skipped' };
}

// ─── Event System ───────────────────────────────────────────────

export function onSyncEvent(fn) {
  _syncListeners.add(fn);
  return () => _syncListeners.delete(fn);
}

function _emit(event, data) {
  for (const fn of _syncListeners) {
    try { fn(event, data); } catch { /* ignore */ }
  }
}

function _onVisibilityChange() {
  if (document.visibilityState === 'visible' && _syncInterval) {
    // Sync when tab becomes visible again
    syncAll();
  }
}

export default { startSyncEngine, stopSyncEngine, syncAll, syncOne, onSyncEvent };
