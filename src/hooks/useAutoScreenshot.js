// ═══════════════════════════════════════════════════════════════════
// charEdge — useAutoScreenshot (P1-B #14)
// React hook that automatically captures a chart screenshot when
// a trade is executed or closed. Stores to IndexedDB for journal.
// ═══════════════════════════════════════════════════════════════════

import { useRef, useCallback } from 'react';
import { logger } from '@/observability/logger';

/**
 * @typedef {Object} ScreenshotEntry
 * @property {string} tradeId  - ID of the associated trade
 * @property {string} type     - 'entry' | 'exit'
 * @property {Blob} blob       - PNG image blob
 * @property {number} timestamp
 * @property {string} symbol
 * @property {string} timeframe
 */

const DB_NAME = 'charEdge_screenshots';
const DB_VERSION = 1;
const STORE_NAME = 'screenshots';

// ─── IndexedDB Helpers ──────────────────────────────────────────

function _openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('tradeId', 'tradeId', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function _storeScreenshot(entry) {
  const db = await _openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Retrieve screenshot blobs for a specific trade.
 * @param {string} tradeId
 * @returns {Promise<ScreenshotEntry[]>}
 */
export async function getScreenshotsForTrade(tradeId) {
  const db = await _openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const idx = tx.objectStore(STORE_NAME).index('tradeId');
    const req = idx.getAll(tradeId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ─── Hook ───────────────────────────────────────────────────────

/**
 * Auto-screenshot hook. Attach to a chart component.
 *
 * @param {Object} opts
 * @param {Function} opts.getCanvas - Returns the chart's composite canvas element
 * @param {string} opts.symbol
 * @param {string} opts.timeframe
 * @param {boolean} [opts.enabled=true]
 * @returns {{ captureScreenshot: (tradeId, type) => Promise<void> }}
 */
export default function useAutoScreenshot({ getCanvas, symbol, timeframe, enabled = true }) {
  const pendingRef = useRef(false);

  const captureScreenshot = useCallback(
    async (tradeId, type = 'entry') => {
      if (!enabled || pendingRef.current) return;
      const canvas = typeof getCanvas === 'function' ? getCanvas() : null;
      if (!canvas) return;

      pendingRef.current = true;
      try {
        // Small delay to let the trade marker render
        await new Promise((r) => setTimeout(r, 100));

        const blob = await new Promise((resolve) =>
          canvas.toBlob(resolve, 'image/png'),
        );

        if (blob) {
          await _storeScreenshot({
            tradeId,
            type,
            blob,
            timestamp: Date.now(),
            symbol: symbol || 'UNKNOWN',
            timeframe: timeframe || '?',
          });
        }
      } catch (err) {
        logger.ui.warn('[AutoScreenshot] Failed to capture:', err);
      } finally {
        pendingRef.current = false;
      }
    },
    [getCanvas, symbol, timeframe, enabled],
  );

  return { captureScreenshot };
}
