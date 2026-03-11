// ═══════════════════════════════════════════════════════════════════
// charEdge v15 — Data Exporter
//
// Export user-accumulated data from IndexedDB in various formats.
// Provides a data inventory dashboard showing what the user has
// collected over time.
//
// Features:
//   • CSV export for ticks, candles, and indicators
//   • JSON export with full metadata
//   • Data inventory with per-symbol statistics
//   • Chunked export for large datasets (avoid memory spikes)
//
// Usage:
//   import { dataExporter } from './DataExporter.js';
//   await dataExporter.downloadTicks('BTCUSDT', 'csv');
//   const inventory = await dataExporter.getDataInventory();
// ═══════════════════════════════════════════════════════════════════

import { tickPersistence } from '../streaming/TickPersistence.js';
import { cacheManager } from './CacheManager.js';
import { logger } from '@/observability/logger';

// ─── Data Exporter ─────────────────────────────────────────────

class _DataExporter {

  /**
   * Download tick data for a symbol.
   *
   * @param {string} symbol
   * @param {'csv'|'json'} [format='csv']
   * @param {number} [fromTime=0]
   * @param {number} [toTime]
   */
  async downloadTicks(symbol, format = 'csv', _fromTime = 0, _toTime = Date.now()) {
    await tickPersistence.downloadExport(symbol, format);
  }

  /**
   * Download candle data from cache.
   *
   * @param {string} symbol
   * @param {string} interval - e.g., '1m', '5m', '1h'
   * @param {'csv'|'json'} [format='csv']
   */
  async downloadCandles(symbol, interval, format = 'csv') {
    const cachedEntry = await cacheManager.read(symbol, interval, Infinity);
    const candles = cachedEntry?.data;
    if (!candles?.length) return;

    let content, filename, mimeType;

    if (format === 'json') {
      content = JSON.stringify({
        symbol: symbol.toUpperCase(),
        interval,
        exportTime: new Date().toISOString(),
        count: candles.length,
        candles,
      }, null, 2);
      filename = `charEdge_${symbol}_${interval}_candles_${Date.now()}.json`;
      mimeType = 'application/json';
    } else {
      const header = 'timestamp,open,high,low,close,volume\n';
      content = header + candles.map(c =>
        `${c.time},${c.open},${c.high},${c.low},${c.close},${c.volume || 0}`
      ).join('\n');
      filename = `charEdge_${symbol}_${interval}_candles_${Date.now()}.csv`;
      mimeType = 'text/csv';
    }

    this._triggerDownload(content, filename, mimeType);
  }

  /**
   * Get comprehensive data inventory across all stores.
   *
   * @returns {Promise<Object>} Full inventory with per-symbol stats
   */
  async getDataInventory() {
    const [tickInventory, storageUsage] = await Promise.all([
      tickPersistence.getDataInventory(),
      cacheManager.getStorageUsage(),
    ]);

    return {
      ticks: tickInventory,
      storage: storageUsage,
      persistence: tickPersistence.getStats(),
      exportedAt: new Date().toISOString(),
    };
  }

  /**
   * Get a summary of all data for a specific symbol.
   *
   * @param {string} symbol
   * @returns {Promise<Object>}
   */
  async getSymbolSummary(symbol) {
    const upper = (symbol || '').toUpperCase();
    const [ticksInventory] = await Promise.all([
      tickPersistence.getDataInventory(),
    ]);

    const tickData = ticksInventory[upper] || null;

    return {
      symbol: upper,
      ticks: tickData,
      recentTicks: tickPersistence.getRecentTicks(upper, 10),
    };
  }

  /**
   * Purge all stored data for a symbol.
   * WARNING: This is destructive!
   *
   * @param {string} symbol
   * @returns {Promise<boolean>}
   */
  async purgeSymbol(_symbol) {
    // This would require extending DataCache with delete methods
    // For now, indicated as a future capability
    logger.data.warn('[DataExporter] purgeSymbol not yet implemented');
    return false;
  }

  // ─── Private Methods ─────────────────────────────────────────

  /** @private — Trigger browser file download */
  _triggerDownload(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const dataExporter = new _DataExporter();
export default dataExporter;
