// ═══════════════════════════════════════════════════════════════════
// charEdge — TimeSeriesStore (Task 2.3.3 + 2.3.4 + 2.3.10)
//
// OPFS-backed block storage for OHLCV bar data with:
//   1. Per-block OPFS files (not monolithic) for efficient range I/O
//   2. B-tree index for O(log n) range queries over blocks
//   3. In-memory LRU cache with automatic eviction
//   4. Cross-key storage quota (200MB default, LRU eviction)
//   5. In-memory Map fallback for non-browser environments (tests/SSR)
//
// Sprint 9 #71: Internal classes extracted to storage/ directory:
//   - storage/types.ts      — Bar, BlockMeta, SeriesIndex, StorageStats
//   - storage/LRUCache.ts   — Generic LRU cache
//   - storage/BinaryCodec.ts — CRC32 + encode/decode
//   - storage/BTreeIndex.ts — Sorted-array block index
// ═══════════════════════════════════════════════════════════════════

// @ts-expect-error — .ts imports resolved by Vite
import { logger } from '@/observability/logger.ts';

// Sprint 9 #71: Import from extracted storage modules
import {
    type Bar, type BlockMeta, type SeriesIndex, type StorageStats,
    BLOCK_SIZE, MAX_CACHED_BLOCKS, STORAGE_QUOTA, DIR_NAME, INDEX_FILENAME
} from './storage/types.ts';
import { LRUCache } from './storage/LRUCache.ts';
import { sortedMergeBars } from './infra/sortedMerge.js';
import { encodeBlock, decodeBlock } from './storage/BinaryCodec.ts';
import { BTreeIndex } from './storage/BTreeIndex.ts';

// Sprint 18 #113: Time-partitioned keys
import {
    partitionKey as makePartitionKey,
    partitionsForRange,
    groupBarsByPartition,
    _isLegacyKey,
} from './storage/partitionKey.ts';

// Re-export types for backward compatibility
export type { Bar, BlockMeta, SeriesIndex, StorageStats };
export { LRUCache, encodeBlock, decodeBlock, BTreeIndex };

// ─── OPFS Helpers ───────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/naming-convention
async function _getBlockDir(): Promise<FileSystemDirectoryHandle | null> {
    try {
        const root = await navigator.storage.getDirectory();
        return await root.getDirectoryHandle(DIR_NAME, { create: true });
    } catch {
        return null;
    }
}

// eslint-disable-next-line @typescript-eslint/naming-convention
function _seriesDir(symbol: string, interval: string): string {
    return `${symbol}_${interval}`.replace(/[^a-zA-Z0-9_\-.]/g, '_');
}

// eslint-disable-next-line @typescript-eslint/naming-convention
function _blockFileName(blockIdx: number): string {
    return `blk_${String(blockIdx).padStart(5, '0')}.bin`;
}

// INDEX_FILENAME imported from storage/types.ts

// eslint-disable-next-line @typescript-eslint/naming-convention
function _isOPFSAvailable(): boolean {
    return (
        typeof navigator !== 'undefined' &&
        !!navigator.storage &&
        typeof navigator.storage.getDirectory === 'function'
    );
}

// Sprint 19 #126: IDBFallback removed — OPFS-only with in-memory fallback for tests/SSR

// ─── TimeSeriesStore ────────────────────────────────────────────

export class TimeSeriesStore {
    private _cache = new LRUCache<Bar[]>(MAX_CACHED_BLOCKS);
    private _indices = new Map<string, BTreeIndex>();
    private _locks = new Map<string, Promise<unknown>>();
    private _initialized = false;
    private _useOPFS: boolean;
    /** Sprint 19 #126: In-memory fallback for non-OPFS environments (tests/SSR). */
    private _memFallback = new Map<string, ArrayBuffer | string>();
    private _totalStorageBytes = 0;
    private _seriesAccess = new Map<string, number>(); // key → last access time

    constructor() {
        this._useOPFS = _isOPFSAvailable();
    }

    /**
     * Initialize the store. Loads indices from OPFS/IDB.
     * Call once before any read/write operations.
     */
    async init(): Promise<void> {
        if (this._initialized) return;

        if (this._useOPFS) {
            await this._loadAllIndices();
        }
        // Sprint 19 #126: Non-OPFS envs use in-memory Map (no IDB)

        this._initialized = true;
        logger.data.info(`[TimeSeriesStore] Initialized — ${this._useOPFS ? 'OPFS' : 'in-memory'} backend, ${this._indices.size} series loaded`);
    }

    // ─── Locking ────────────────────────────────────────────────

    private async _withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
        const prev = this._locks.get(key) || Promise.resolve();
        const next = prev.then(fn, fn);
        this._locks.set(key, next);
        try {
            return await next;
        } finally {
            if (this._locks.get(key) === next) this._locks.delete(key);
        }
    }

    // ─── Keys ───────────────────────────────────────────────────

    /** Legacy flat key format (used for index iteration only). */
    private _seriesKey(symbol: string, interval: string): string {
        return `${symbol}:${interval}`;
    }

    /** Sprint 18 #113: Partitioned key for a specific timestamp. */
    private _partitionedKey(symbol: string, interval: string, timestamp: number): string {
        return makePartitionKey(symbol, interval, timestamp);
    }

    /** Get all partition keys for a symbol+interval that are currently loaded. */
    private _getPartitionKeys(symbol: string, interval: string): string[] {
        const prefix = `${symbol}:${interval}:`;
        return [...this._indices.keys()].filter(k => k.startsWith(prefix));
    }

    private _cacheKey(symbol: string, interval: string, blockIdx: number): string {
        return `${symbol}:${interval}:${blockIdx}`;
    }

    // ─── Write ──────────────────────────────────────────────────

    /**
     * Write bars to the store. Bars are grouped by quarterly partition,
     * then each partition is written independently.
     *
     * Sprint 18 #113: Bars are partitioned by quarter.
     */
    async write(symbol: string, interval: string, bars: Bar[]): Promise<void> {
        if (!bars.length) return;
        const lockKey = this._seriesKey(symbol, interval);

        return this._withLock(lockKey, async () => {
            // Sprint 18 #113: Group incoming bars by quarterly partition
            const partitions = groupBarsByPartition(symbol, interval, bars);

            for (const [partKey, partBars] of partitions) {
                // Sort by timestamp
                const sorted = [...partBars].sort((a, b) => a.t - b.t);

                // Get or create index for this partition
                let index = this._indices.get(partKey);
                if (!index) {
                    index = new BTreeIndex();
                    this._indices.set(partKey, index);
                }

                // Read existing bars to merge
                const existingBars = await this._readAllBarsForKey(partKey, symbol, interval, index);

                // Merge: deduplicate by timestamp, prefer new data
                const merged = this._mergeBars(existingBars, sorted);

                // Split into blocks and write each
                const blocks: BlockMeta[] = [];
                for (let i = 0; i < merged.length; i += BLOCK_SIZE) {
                    const block = merged.slice(i, i + BLOCK_SIZE);
                    const blockIdx = Math.floor(i / BLOCK_SIZE);
                    const encoded = encodeBlock(block);
                    const sizeBytes = encoded.byteLength;

                    // Persist to OPFS or IDB
                    await this._writeBlock(symbol, interval, blockIdx, encoded);

                    // Cache in memory
                    this._cache.set(this._cacheKey(symbol, interval, blockIdx), block);

                    // Record metadata
                    const firstBar = block[0];
                    const lastBar = block[block.length - 1];
                    if (firstBar && lastBar) {
                        blocks.push({
                            blockIdx,
                            minT: firstBar.t,
                            maxT: lastBar.t,
                            barCount: block.length,
                            sizeBytes,
                            lastAccess: Date.now(),
                        });
                    }
                }

                // Update index for this partition
                index.load(blocks);
                this._seriesAccess.set(partKey, Date.now());
                await this._saveIndex(symbol, interval, index);
            }

            // Update total storage tracking
            this._recalcTotalStorage();

            // Enforce quota
            await this._enforceQuota();
        });
    }

    // ─── Read ───────────────────────────────────────────────────

    /**
     * Read bars within a time range.
     *
     * Sprint 18 #113: Scans only the quarterly partitions that overlap
     * the requested range, rather than loading all blocks.
     */
    async read(symbol: string, interval: string, startTime: number, endTime: number): Promise<Bar[]> {
        // Sprint 18 #113: Determine which partitions to scan
        const partKeys = partitionsForRange(symbol, interval, startTime, endTime);

        // Also check for legacy flat key and auto-migrate
        const legacyKey = this._seriesKey(symbol, interval);
        if (this._indices.has(legacyKey)) {
            await this._migrateLegacyKey(symbol, interval);
        }

        const result: Bar[] = [];

        for (const partKey of partKeys) {
            const index = this._indices.get(partKey);
            if (!index || index.blockCount === 0) continue;

            // B-tree range query: find overlapping blocks
            const overlapping = index.findOverlapping(startTime, endTime);
            if (overlapping.length === 0) continue;

            // Track access time for quota management
            this._seriesAccess.set(partKey, Date.now());

            for (const meta of overlapping) {
                meta.lastAccess = Date.now();

                // Try memory cache first
                const cacheKey = this._cacheKey(symbol, interval, meta.blockIdx);
                let block = this._cache.get(cacheKey);

                // Cache miss: load from OPFS/IDB
                if (!block) {
                    const buffer = await this._readBlock(symbol, interval, meta.blockIdx);
                    if (buffer) {
                        const decoded = decodeBlock(buffer);
                        if (decoded) {
                            block = decoded;
                            this._cache.set(cacheKey, decoded);
                        }
                    }
                }

                if (!block) continue;

                // Filter to requested range
                for (const bar of block) {
                    if (bar.t >= startTime && bar.t <= endTime) {
                        result.push(bar);
                    }
                    if (bar.t > endTime) break;
                }
            }
        }

        return result;
    }

    /**
     * Sprint 18 #113: Migrate a legacy flat key to partitioned keys.
     * Reads all bars under the old key, groups them by quarter,
     * writes to new partition keys, then removes the old key.
     */
    private async _migrateLegacyKey(symbol: string, interval: string): Promise<void> {
        const legacyKey = this._seriesKey(symbol, interval);
        const legacyIndex = this._indices.get(legacyKey);
        if (!legacyIndex) return;

        logger.data.info(`[TimeSeriesStore] Migrating legacy key: ${legacyKey}`);

        // Read all bars under the old key
        const allBars = await this._readAllBarsForKey(legacyKey, symbol, interval, legacyIndex);
        if (allBars.length === 0) {
            this._indices.delete(legacyKey);
            this._seriesAccess.delete(legacyKey);
            return;
        }

        // Remove legacy key first
        this._indices.delete(legacyKey);
        this._seriesAccess.delete(legacyKey);

        // Re-write under partitioned keys (write() handles grouping)
        // We bypass the lock since we're already inside one
        const partitions = groupBarsByPartition(symbol, interval, allBars);
        for (const [partKey, partBars] of partitions) {
            const sorted = [...partBars].sort((a, b) => a.t - b.t);
            const index = new BTreeIndex();
            this._indices.set(partKey, index);

            const blocks: BlockMeta[] = [];
            for (let i = 0; i < sorted.length; i += BLOCK_SIZE) {
                const block = sorted.slice(i, i + BLOCK_SIZE);
                const blockIdx = Math.floor(i / BLOCK_SIZE);
                const encoded = encodeBlock(block);
                await this._writeBlock(symbol, interval, blockIdx, encoded);
                this._cache.set(this._cacheKey(symbol, interval, blockIdx), block);

                const firstBar = block[0];
                const lastBar = block[block.length - 1];
                if (firstBar && lastBar) {
                    blocks.push({
                        blockIdx, minT: firstBar.t, maxT: lastBar.t,
                        barCount: block.length, sizeBytes: encoded.byteLength,
                        lastAccess: Date.now(),
                    });
                }
            }
            index.load(blocks);
            this._seriesAccess.set(partKey, Date.now());
            await this._saveIndex(symbol, interval, index);
        }

        logger.data.info(`[TimeSeriesStore] Migrated ${legacyKey} → ${partitions.size} partitions (${allBars.length} bars)`);
    }

    /**
     * Read ALL bars for a symbol+interval (for migration/export).
     */
    async readAll(symbol: string, interval: string): Promise<Bar[]> {
        // Sprint 18 #113: Collect from all partitions
        const allBars: Bar[] = [];

        // Check legacy key first
        const legacyKey = this._seriesKey(symbol, interval);
        if (this._indices.has(legacyKey)) {
            await this._migrateLegacyKey(symbol, interval);
        }

        // Read from all partition keys
        const partKeys = this._getPartitionKeys(symbol, interval);
        for (const partKey of partKeys) {
            const index = this._indices.get(partKey);
            if (index && index.blockCount > 0) {
                const bars = await this._readAllBarsForKey(partKey, symbol, interval, index);
                allBars.push(...bars);
            }
        }

        return allBars.sort((a, b) => a.t - b.t);
    }

    // ─── Metadata ─────────────────────────────────────────────

    /**
     * Get metadata about stored data for a series.
     */
    getMetadata(symbol: string, interval: string): {
        blockCount: number;
        totalBars: number;
        totalBytes: number;
        cachedBlocks: number;
    } {
        // Sprint 18 #113: Aggregate metadata across all partitions
        const partKeys = this._getPartitionKeys(symbol, interval);
        if (partKeys.length === 0) return { blockCount: 0, totalBars: 0, totalBytes: 0, cachedBlocks: 0 };

        let totalBlocks = 0, totalBars = 0, totalBytes = 0, cachedBlocks = 0;
        for (const partKey of partKeys) {
            const index = this._indices.get(partKey);
            if (!index) continue;
            totalBlocks += index.blockCount;
            totalBars += index.totalBars;
            totalBytes += index.totalBytes;
            for (const meta of index.getAll()) {
                if (this._cache.has(this._cacheKey(symbol, interval, meta.blockIdx))) {
                    cachedBlocks++;
                }
            }
        }

        return { blockCount: totalBlocks, totalBars, totalBytes, cachedBlocks };
    }

    /**
     * Get storage statistics across all series.
     */
    getStats(): StorageStats {
        const series: StorageStats['series'] = [];
        for (const [key, index] of this._indices) {
            series.push({
                key,
                bytes: index.totalBytes,
                bars: index.totalBars,
                blocks: index.blockCount,
            });
        }

        return {
            totalBytes: this._totalStorageBytes,
            totalBlocks: series.reduce((sum, s) => sum + s.blocks, 0),
            totalSeries: this._indices.size,
            quotaBytes: STORAGE_QUOTA,
            usagePercent: Math.round((this._totalStorageBytes / STORAGE_QUOTA) * 100),
            series,
        };
    }

    // ─── Clear / Remove ──────────────────────────────────────

    /** Clear all cached and persisted data. */
    async clear(): Promise<void> {
        this._cache.clear();
        this._indices.clear();
        this._seriesAccess.clear();
        this._totalStorageBytes = 0;

        if (this._useOPFS) {
            try {
                const root = await navigator.storage.getDirectory();
                await root.removeEntry(DIR_NAME, { recursive: true });
            } catch { /* directory might not exist */ }
        } else {
            this._memFallback.clear();
        }

        logger.data.info('[TimeSeriesStore] Cleared all data');
    }

    /** Remove a specific series (both legacy and partitioned keys). */
    async removeSeries(symbol: string, interval: string): Promise<void> {
        // Remove legacy flat key
        const seriesKey = this._seriesKey(symbol, interval);
        const legacyIndex = this._indices.get(seriesKey);

        if (legacyIndex) {
            for (const meta of legacyIndex.getAll()) {
                this._cache.delete(this._cacheKey(symbol, interval, meta.blockIdx));
                await this._deleteBlock(symbol, interval, meta.blockIdx);
            }
            await this._deleteIndex(symbol, interval);
            this._indices.delete(seriesKey);
            this._seriesAccess.delete(seriesKey);
        }

        // Sprint 18 #113: Also remove all partitioned keys
        const partKeys = this._getPartitionKeys(symbol, interval);
        for (const partKey of partKeys) {
            const partIndex = this._indices.get(partKey);
            if (partIndex) {
                for (const meta of partIndex.getAll()) {
                    this._cache.delete(this._cacheKey(symbol, interval, meta.blockIdx));
                    await this._deleteBlock(symbol, interval, meta.blockIdx);
                }
                await this._deleteIndex(symbol, interval);
            }
            this._indices.delete(partKey);
            this._seriesAccess.delete(partKey);
        }

        this._recalcTotalStorage();
    }

    /** Check if OPFS persistence is available. */
    get isOPFS(): boolean {
        return this._useOPFS;
    }

    // ─── Private: Block I/O ───────────────────────────────────

    private async _writeBlock(symbol: string, interval: string, blockIdx: number, data: ArrayBuffer): Promise<void> {
        if (this._useOPFS) {
            try {
                const dir = await this._getSeriesDir(symbol, interval);
                if (!dir) return;
                const fileHandle = await dir.getFileHandle(_blockFileName(blockIdx), { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(data);
                await writable.close();
            } catch (e) {
                logger.data.warn(`[TimeSeriesStore] OPFS write failed for block ${blockIdx}:`, (e as Error)?.message);
            }
        } else {
            // Sprint 19 #126: In-memory fallback
            const key = `${_seriesDir(symbol, interval)}/${_blockFileName(blockIdx)}`;
            this._memFallback.set(key, data);
        }
    }

    private async _readBlock(symbol: string, interval: string, blockIdx: number): Promise<ArrayBuffer | null> {
        if (this._useOPFS) {
            try {
                const dir = await this._getSeriesDir(symbol, interval);
                if (!dir) return null;
                const fileHandle = await dir.getFileHandle(_blockFileName(blockIdx));
                const file = await fileHandle.getFile();
                return await file.arrayBuffer();
            } catch {
                return null;
            }
        } else {
            const key = `${_seriesDir(symbol, interval)}/${_blockFileName(blockIdx)}`;
            return (this._memFallback.get(key) as ArrayBuffer) ?? null;
        }
    }

    private async _deleteBlock(symbol: string, interval: string, blockIdx: number): Promise<void> {
        if (this._useOPFS) {
            try {
                const dir = await this._getSeriesDir(symbol, interval);
                if (!dir) return;
                await dir.removeEntry(_blockFileName(blockIdx));
            } catch { /* ok */ }
        } else {
            const key = `${_seriesDir(symbol, interval)}/${_blockFileName(blockIdx)}`;
            this._memFallback.delete(key);
        }
    }

    // ─── Private: Index I/O ───────────────────────────────────

    private async _saveIndex(symbol: string, interval: string, index: BTreeIndex): Promise<void> {
        const data: SeriesIndex = {
            symbol,
            interval,
            blocks: index.getAll(),
            totalBars: index.totalBars,
            totalBytes: index.totalBytes,
            updatedAt: Date.now(),
        };
        const json = JSON.stringify(data);

        if (this._useOPFS) {
            try {
                const dir = await this._getSeriesDir(symbol, interval);
                if (!dir) return;
                const fileHandle = await dir.getFileHandle(INDEX_FILENAME, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(json);
                await writable.close();
            } catch (e) {
                logger.data.warn('[TimeSeriesStore] Index save failed:', (e as Error)?.message);
            }
        } else {
            const key = `${_seriesDir(symbol, interval)}/${INDEX_FILENAME}`;
            this._memFallback.set(key, json);
        }
    }

    private async _loadIndex(symbol: string, interval: string): Promise<BTreeIndex | null> {
        let json: string | null = null;

        if (this._useOPFS) {
            try {
                const dir = await this._getSeriesDir(symbol, interval);
                if (!dir) return null;
                const fileHandle = await dir.getFileHandle(INDEX_FILENAME);
                const file = await fileHandle.getFile();
                json = await file.text();
            } catch {
                return null;
            }
        } else {
            const key = `${_seriesDir(symbol, interval)}/${INDEX_FILENAME}`;
            const entry = this._memFallback.get(key);
            if (typeof entry === 'string') {
                json = entry;
            }
        }

        if (!json) return null;

        try {
            const data: SeriesIndex = JSON.parse(json);
            const index = new BTreeIndex();
            index.load(data.blocks);
            return index;
        } catch {
            return null;
        }
    }

    private async _deleteIndex(symbol: string, interval: string): Promise<void> {
        if (this._useOPFS) {
            try {
                const dir = await this._getSeriesDir(symbol, interval);
                if (!dir) return;
                await dir.removeEntry(INDEX_FILENAME);
            } catch { /* ok */ }
        } else {
            const key = `${_seriesDir(symbol, interval)}/${INDEX_FILENAME}`;
            this._memFallback.delete(key);
        }
    }

    // ─── Private: OPFS Directory Management ───────────────────

    private async _getSeriesDir(symbol: string, interval: string): Promise<FileSystemDirectoryHandle | null> {
        try {
            const blockDir = await _getBlockDir();
            if (!blockDir) return null;
            return await blockDir.getDirectoryHandle(_seriesDir(symbol, interval), { create: true });
        } catch {
            return null;
        }
    }

    // ─── Private: Load All Indices ────────────────────────────

    private async _loadAllIndices(): Promise<void> {
        try {
            const blockDir = await _getBlockDir();
            if (!blockDir) return;

            for await (const [name, handle] of blockDir.entries()) {
                if (handle.kind !== 'directory') continue;

                // Parse series key from directory name: "BTCUSDT_1m" → symbol=BTCUSDT, interval=1m
                const parts = name.split('_');
                if (parts.length < 2) continue;
                const interval = parts[parts.length - 1] ?? '';
                const symbol = parts.slice(0, -1).join('_');

                const index = await this._loadIndex(symbol, interval);
                if (index && index.blockCount > 0) {
                    const seriesKey = this._seriesKey(symbol, interval);
                    this._indices.set(seriesKey, index);
                    this._seriesAccess.set(seriesKey, Date.now());
                }
            }

            this._recalcTotalStorage();
        } catch (e) {
            logger.data.warn('[TimeSeriesStore] Failed to load indices:', (e as Error)?.message);
        }
    }

    // Sprint 19 #126: _loadAllIndicesFromIDB() removed — no more IDB backend

    // ─── Private: Merge ──────────────────────────────────────

    private _mergeBars(existing: Bar[], incoming: Bar[]): Bar[] {
        // O(n) two-pointer merge — both arrays are pre-sorted ascending by .t
        // Prefer incoming data on duplicate timestamps
        return sortedMergeBars(existing, incoming, b => b.t, 'b');
    }

    /** Read all bars for a given key (may be legacy or partitioned). */
    private async _readAllBarsForKey(_key: string, symbol: string, interval: string, index: BTreeIndex): Promise<Bar[]> {
        const allBars: Bar[] = [];
        const allMeta = index.getAll();

        for (const meta of allMeta) {
            const cacheKey = this._cacheKey(symbol, interval, meta.blockIdx);
            let block = this._cache.get(cacheKey);

            if (!block) {
                // Sprint 19 #126: Unified read path (OPFS or in-memory)
                const buffer = await this._readBlock(symbol, interval, meta.blockIdx);
                if (buffer) {
                    const decoded = decodeBlock(buffer);
                    if (decoded) {
                        block = decoded;
                        this._cache.set(cacheKey, decoded);
                    }
                }
            }

            if (block) allBars.push(...block);
        }

        return allBars.sort((a, b) => a.t - b.t);
    }

    /**
     * Legacy compat: read all bars using the old non-partitioned approach.
     * @deprecated Use _readAllBarsForKey instead.
     */
    private async _readAllBars(symbol: string, interval: string, index: BTreeIndex): Promise<Bar[]> {
        return this._readAllBarsForKey(this._seriesKey(symbol, interval), symbol, interval, index);
    }

    // ─── Private: Quota Management (Task 2.3.10) ─────────────

    private _recalcTotalStorage(): void {
        let total = 0;
        for (const index of this._indices.values()) {
            total += index.totalBytes;
        }
        this._totalStorageBytes = total;
    }

    /**
     * Enforce storage quota by evicting least-recently-accessed series.
     * Removes entire series (all blocks) until under quota.
     */
    private async _enforceQuota(): Promise<void> {
        if (this._totalStorageBytes <= STORAGE_QUOTA) return;

        // Sort series by last access time (oldest first)
        const seriesByAccess = Array.from(this._seriesAccess.entries())
            .sort((a, b) => a[1] - b[1]);

        for (const [seriesKey] of seriesByAccess) {
            if (this._totalStorageBytes <= STORAGE_QUOTA * 0.8) break; // Evict to 80%

            const parts = seriesKey.split(':');
            const symbol = parts[0] ?? '';
            const interval = parts[1] ?? '';

            // Sprint 18 #113: For partitioned keys, only remove that partition
            if (parts.length === 3) {
                logger.data.info(`[TimeSeriesStore] Quota eviction: removing partition ${seriesKey} (${this._indices.get(seriesKey)?.totalBytes ?? 0} bytes)`);
                this._indices.delete(seriesKey);
                this._seriesAccess.delete(seriesKey);
                this._recalcTotalStorage();
            } else {
                logger.data.info(`[TimeSeriesStore] Quota eviction: removing ${seriesKey} (${this._indices.get(seriesKey)?.totalBytes ?? 0} bytes)`);
                await this.removeSeries(symbol, interval);
            }
        }
    }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const timeSeriesStore = new TimeSeriesStore();
export { BLOCK_SIZE, MAX_CACHED_BLOCKS, STORAGE_QUOTA };
export default timeSeriesStore;
