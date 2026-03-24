import { logger } from '@/observability/logger';
// ═══════════════════════════════════════════════════════════════════
// charEdge — OPFS Bar Store
//
// Persistent OHLCV candle storage using Origin Private File System.
// Bars are stored in binary format (Float64Array) for efficiency.
// Each candle = 6 Float64 values (time_ms, open, high, low, close, volume)
// = 48 bytes per candle. 10K candles ≈ 480KB vs ~1MB JSON.
//
// Falls back gracefully if OPFS is not available.
// Backwards-compatible: reads legacy .json files and migrates to .bin.
//
// Usage:
//   import { opfsBarStore } from './OPFSBarStore.js';
//   await opfsBarStore.putCandles('BTCUSDT', '1h', bars);
//   const bars = await opfsBarStore.getCandles('BTCUSDT', '1h');
// ═══════════════════════════════════════════════════════════════════

const MAX_BARS_PER_KEY = 10_000;
const DIR_NAME = 'charEdge-bars';
const FIELDS_PER_BAR = 6; // time_ms, open, high, low, close, volume
const CRC32_SIZE = 4;     // 4-byte CRC32 checksum appended to binary files
const MAX_BAR_AGE_MS = 365 * 24 * 60 * 60 * 1000; // 1 year default max age

// ─── CRC32 ──────────────────────────────────────────────────────

// Pre-computed CRC32 lookup table (IEEE polynomial)
const _crc32Table = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 1) ? (0xEDB88320 ^ (crc >>> 1)) : (crc >>> 1);
    }
    table[i] = crc;
  }
  return table;
})();

/**
 * Compute CRC32 checksum for an ArrayBuffer.
 * @param {ArrayBuffer} buffer
 * @returns {number} 32-bit unsigned CRC32
 */
function _crc32(buffer) {
  const bytes = new Uint8Array(buffer);
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) {
    crc = _crc32Table[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// ─── Helpers ────────────────────────────────────────────────────

/**
 * Get (or create) the charEdge bars directory inside OPFS.
 * @returns {Promise<FileSystemDirectoryHandle|null>}
 */
async function _getDir() {
  try {
    const root = await navigator.storage.getDirectory();
    return await root.getDirectoryHandle(DIR_NAME, { create: true });
  // eslint-disable-next-line unused-imports/no-unused-vars
  } catch (_) {
    return null;
  }
}

/**
 * Sanitize symbol + interval into a safe base name.
 * e.g. "BTCUSDT" + "1h" → "BTCUSDT_1h"
 */
function _baseName(symbol, interval) {
  return `${symbol}_${interval}`.replace(/[^a-zA-Z0-9_\-.]/g, '_');
}

/** Binary filename */
function _binFileName(symbol, interval) {
  return `${_baseName(symbol, interval)}.bin`;
}

/** Legacy JSON filename */
function _jsonFileName(symbol, interval) {
  return `${_baseName(symbol, interval)}.json`;
}

/**
 * Check if OPFS is available in this environment.
 * @returns {boolean}
 */
function _isAvailable() {
  return (
    typeof navigator !== 'undefined' &&
    navigator.storage &&
    typeof navigator.storage.getDirectory === 'function'
  );
}

/**
 * Compare two bar arrays for equality (content-addressed).
 * Returns true if both arrays have the same length and identical OHLCV values.
 * Used to skip redundant OPFS writes for sealed candles.
 * @param {Array} a
 * @param {Array} b
 * @returns {boolean}
 */
function _barsEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].time !== b[i].time ||
        a[i].open !== b[i].open ||
        a[i].high !== b[i].high ||
        a[i].low  !== b[i].low  ||
        a[i].close !== b[i].close ||
        (a[i].volume || 0) !== (b[i].volume || 0)) {
      return false;
    }
  }
  return true;
}

// ─── Binary Encode/Decode ───────────────────────────────────────

/**
 * Encode an array of OHLCV bars to a binary ArrayBuffer.
 * Layout: Float64Array with 6 values per bar: [time_ms, open, high, low, close, volume]
 * @param {Array} bars
 * @returns {ArrayBuffer}
 */
function _encodeBinary(bars) {
  const buffer = new ArrayBuffer(bars.length * FIELDS_PER_BAR * 8);
  const view = new Float64Array(buffer);
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const offset = i * FIELDS_PER_BAR;
    const timeMs = typeof b.time === 'string' ? new Date(b.time).getTime() : b.time;
    view[offset] = timeMs;
    view[offset + 1] = b.open;
    view[offset + 2] = b.high;
    view[offset + 3] = b.low;
    view[offset + 4] = b.close;
    view[offset + 5] = b.volume || 0;
  }
  return buffer;
}

/**
 * Decode a binary ArrayBuffer back to an array of OHLCV bars.
 * @param {ArrayBuffer} buffer
 * @returns {Array}
 */
function _decodeBinary(buffer) {
  // Check for CRC32 checksum (last 4 bytes)
  if (buffer.byteLength > CRC32_SIZE) {
    const dataLen = buffer.byteLength - CRC32_SIZE;
    if (dataLen % (FIELDS_PER_BAR * 8) === 0) {
      // Has CRC32 suffix — verify integrity
      const dataBuffer = buffer.slice(0, dataLen);
      const storedCrc = new DataView(buffer, dataLen, CRC32_SIZE).getUint32(0, true);
      const computedCrc = _crc32(dataBuffer);
      if (storedCrc !== computedCrc) {
        logger.data.warn('[OPFSBarStore] CRC32 mismatch — corrupt data detected');
        return null; // signal corruption
      }
      buffer = dataBuffer;
    }
  }

  const view = new Float64Array(buffer);
  const count = view.length / FIELDS_PER_BAR;
  const bars = [];
  for (let i = 0; i < count; i++) {
    const offset = i * FIELDS_PER_BAR;
    bars.push({
      time: new Date(view[offset]).toISOString(),
      open: view[offset + 1],
      high: view[offset + 2],
      low: view[offset + 3],
      close: view[offset + 4],
      volume: view[offset + 5],
    });
  }
  return bars;
}

// Exported for testing
export { _encodeBinary, _decodeBinary, _crc32, _barsEqual };

// ─── OPFSBarStore Class ─────────────────────────────────────────

class OPFSBarStore {
  constructor() {
    this._available = _isAvailable();
    /** @type {Map<string, Promise>} Per-key write lock to prevent concurrent write races */
    this._locks = new Map();
    if (!this._available) {
      logger.data.info('[OPFSBarStore] OPFS not available, persistent bar storage disabled');
    }
  }

  /**
   * Serialize writes per key to prevent concurrent read-merge-write races.
   * @private
   * @param {string} key
   * @param {Function} fn - async function to run under the lock
   * @returns {Promise}
   */
  async _withLock(key, fn) {
    const prev = this._locks.get(key) || Promise.resolve();
    const next = prev.then(fn, fn);
    this._locks.set(key, next);
    try {
      return await next;
    } finally {
      if (this._locks.get(key) === next) this._locks.delete(key);
    }
  }

  /**
   * Read cached candle bars from OPFS.
   * Tries binary (.bin) first, falls back to legacy JSON (.json) and migrates.
   * @param {string} symbol
   * @param {string} interval - e.g. '1h', '1d'
   * @returns {Promise<Array>} OHLCV array or empty array if not found
   */
  async getCandles(symbol, interval) {
    if (!this._available) return [];
    try {
      const dir = await _getDir();
      if (!dir) return [];

      // Try binary file first
      try {
        const binName = _binFileName(symbol, interval);
        const fileHandle = await dir.getFileHandle(binName);
        const file = await fileHandle.getFile();
        const buffer = await file.arrayBuffer();
        if (buffer.byteLength > 0) {
          const bars = _decodeBinary(buffer);
          if (bars === null) {
            // CRC32 mismatch — corrupt file, auto-delete and signal for re-fetch
            logger.data.warn(`[OPFSBarStore] Corrupt file ${binName}, deleting`);
            // eslint-disable-next-line unused-imports/no-unused-vars
            try { await dir.removeEntry(binName); } catch (_) { /* storage may be blocked */ }
            // Emit warning so status bar can inform user and trigger network re-fetch
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('charEdge:data-warning', {
                detail: {
                  message: `Cache corrupted for ${symbol}:${interval}, reloading from network`,
                  symbol,
                  type: 'cache-corruption',
                },
              }));
            }
            return [];
          }
          return bars;
        }
      // eslint-disable-next-line unused-imports/no-unused-vars
      } catch (_) {
        // .bin not found — try legacy .json
      }

      // Fallback: try legacy JSON file
      try {
        const jsonName = _jsonFileName(symbol, interval);
        const fileHandle = await dir.getFileHandle(jsonName);
        const file = await fileHandle.getFile();
        const text = await file.text();
        if (!text) return [];

        const parsed = JSON.parse(text);
        const bars = Array.isArray(parsed) ? parsed : [];

        // Migrate: write binary, delete JSON (fire-and-forget)
        if (bars.length > 0) {
          this._migrateToBinary(dir, symbol, interval, bars).catch(() => {}); // intentional: migration is best-effort
        }

        return bars;
      } catch (e) {
        if (e?.name !== 'NotFoundError') {
          logger.data.warn('[OPFSBarStore] getCandles error:', e?.message);
        }
        return [];
      }
    } catch (e) {
      logger.data.warn('[OPFSBarStore] getCandles error:', e?.message);
      return [];
    }
  }

  /**
   * Migrate a legacy JSON file to binary format.
   * @private
   */
  async _migrateToBinary(dir, symbol, interval, bars) {
    try {
      // Write binary
      const binName = _binFileName(symbol, interval);
      const binHandle = await dir.getFileHandle(binName, { create: true });
      const writable = await binHandle.createWritable();
      await writable.write(_encodeBinary(bars));
      await writable.close();

      // Delete legacy JSON
      const jsonName = _jsonFileName(symbol, interval);
      await dir.removeEntry(jsonName);
    // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (_) {
      // Migration failed — that's OK, will try again next read
    }
  }

  /**
   * Write/merge candle bars to OPFS in binary format.
   * Merges new bars with existing data, capped at MAX_BARS_PER_KEY.
   * @param {string} symbol
   * @param {string} interval
   * @param {Array} bars - OHLCV bars with `.time` property
   */
  async putCandles(symbol, interval, bars) {
    if (!this._available || !bars?.length) return;
    const lockKey = _baseName(symbol, interval);
    return this._withLock(lockKey, async () => {
      try {
        const dir = await _getDir();
        if (!dir) return;

        // Read existing bars for merging
        const existing = await this.getCandles(symbol, interval);

        // Merge: append only bars newer than existing
        let merged;
        if (existing.length > 0) {
          const lastExistingTime = existing[existing.length - 1].time;
          const newBars = bars.filter(b => b.time > lastExistingTime);
          if (newBars.length > 0) {
            merged = [...existing, ...newBars];
          } else {
            // Nothing new — update the last bar in case it's a live candle update
            const lastNew = bars[bars.length - 1];
            const lastIdx = existing.findIndex(b => b.time === lastNew.time);
            if (lastIdx >= 0) {
              existing[lastIdx] = lastNew;
            }
            merged = existing;
          }
        } else {
          merged = [...bars];
        }

        // Cap to prevent unbounded growth
        if (merged.length > MAX_BARS_PER_KEY) {
          merged = merged.slice(-MAX_BARS_PER_KEY);
        }

        // Time-based eviction: trim bars older than MAX_BAR_AGE_MS
        const cutoffTime = new Date(Date.now() - MAX_BAR_AGE_MS).toISOString();
        const firstValidIdx = merged.findIndex(b => b.time >= cutoffTime);
        if (firstValidIdx > 0) {
          merged = merged.slice(firstValidIdx);
        }

        // Content-addressed check: skip write if merged data is identical to existing
        if (existing.length > 0 && _barsEqual(merged, existing)) {
          return; // Nothing changed — skip disk I/O
        }

        // Write binary to OPFS with CRC32 checksum
        const binName = _binFileName(symbol, interval);
        const fileHandle = await dir.getFileHandle(binName, { create: true });
        const writable = await fileHandle.createWritable();
        const dataBuffer = _encodeBinary(merged);
        const crc = _crc32(dataBuffer);
        // Append CRC32 as 4 trailing bytes (little-endian)
        const withChecksum = new Uint8Array(dataBuffer.byteLength + CRC32_SIZE);
        withChecksum.set(new Uint8Array(dataBuffer));
        new DataView(withChecksum.buffer, dataBuffer.byteLength, CRC32_SIZE).setUint32(0, crc, true);
        await writable.write(withChecksum.buffer);
        await writable.close();
      } catch (e) {
        logger.data.warn('[OPFSBarStore] putCandles error:', e?.message);
      }
    });
  }

  /**
   * Get the timestamp of the last cached candle for delta-only fetching.
   * Optimized: reads only the last bar (48 bytes) from the binary file
   * instead of decoding all bars from disk.
   * @param {string} symbol
   * @param {string} interval
   * @returns {Promise<number|string|null>} Timestamp or null
   */
  async getLastCandleTime(symbol, interval) {
    if (!this._available) return null;
    try {
      const dir = await _getDir();
      if (!dir) return null;

      // Try binary file — read only the last bar (fast path)
      try {
        const binName = _binFileName(symbol, interval);
        const fileHandle = await dir.getFileHandle(binName);
        const file = await fileHandle.getFile();
        const size = file.size;
        if (size === 0) return null;

        // Each bar = 6 × 8 = 48 bytes. With CRC32 suffix = +4 bytes.
        const barBytes = FIELDS_PER_BAR * 8; // 48
        const hasCrc = (size - CRC32_SIZE) % barBytes === 0 && size > CRC32_SIZE;
        const dataSize = hasCrc ? size - CRC32_SIZE : size;
        if (dataSize < barBytes || dataSize % barBytes !== 0) return null;

        // Read only the last 48-byte bar (the most recent timestamp)
        const lastBarOffset = dataSize - barBytes;
        const slice = file.slice(lastBarOffset, lastBarOffset + barBytes);
        const buffer = await slice.arrayBuffer();
        const view = new Float64Array(buffer);
        // First field is time_ms
        return new Date(view[0]).toISOString();
      // eslint-disable-next-line unused-imports/no-unused-vars
      } catch (_) {
        // .bin not found — fall back to full decode of legacy JSON
      }

      // Fallback: legacy JSON (must decode all)
      const bars = await this.getCandles(symbol, interval);
      if (!bars.length) return null;
      return bars[bars.length - 1].time;
    // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (_) {
      return null;
    }
  }

  /**
   * Remove cached bars for a specific symbol + interval.
   * Removes both binary and legacy JSON files.
   * @param {string} symbol
   * @param {string} interval
   */
  async remove(symbol, interval) {
    if (!this._available) return;
    try {
      const dir = await _getDir();
      if (!dir) return;
      // Remove binary
      // eslint-disable-next-line unused-imports/no-unused-vars
      try { await dir.removeEntry(_binFileName(symbol, interval)); } catch (_) { /* ok */ }
      // Remove legacy JSON
      // eslint-disable-next-line unused-imports/no-unused-vars
      try { await dir.removeEntry(_jsonFileName(symbol, interval)); } catch (_) { /* ok */ }
    // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (_) {
      // Directory might not exist — that's fine
    }
  }

  /**
   * Clear all cached bar data from OPFS.
   */
  async clear() {
    if (!this._available) return;
    try {
      const root = await navigator.storage.getDirectory();
      await root.removeEntry(DIR_NAME, { recursive: true });
      logger.data.info('[OPFSBarStore] Cleared all bar cache');
    // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (_) {
      // Directory might not exist
    }
  }

  /**
   * Get storage statistics: number of files and total size.
   * @returns {Promise<{ fileCount: number, totalSizeKB: number, symbols: string[] }>}
   */
  async getStats() {
    if (!this._available) return { fileCount: 0, totalSizeKB: 0, symbols: [] };
    try {
      const dir = await _getDir();
      if (!dir) return { fileCount: 0, totalSizeKB: 0, symbols: [] };

      let fileCount = 0;
      let totalSize = 0;
      const symbols = [];

      for await (const [name, handle] of dir.entries()) {
        if (handle.kind === 'file') {
          fileCount++;
          const file = await handle.getFile();
          totalSize += file.size;
          // Extract symbol from filename: "BTCUSDT_1h.bin" or "BTCUSDT_1h.json" → "BTCUSDT"
          const sym = name.replace(/\.(bin|json)$/, '').replace(/_[^_]+$/, '');
          if (!symbols.includes(sym)) symbols.push(sym);
        }
      }

      return {
        fileCount,
        totalSizeKB: Math.round(totalSize / 1024 * 10) / 10,
        symbols,
      };
    // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (_) {
      return { fileCount: 0, totalSizeKB: 0, symbols: [] };
    }
  }

  /**
   * Check if OPFS is available.
   * @returns {boolean}
   */
  isAvailable() {
    return this._available;
  }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const opfsBarStore = new OPFSBarStore();
export default opfsBarStore;
