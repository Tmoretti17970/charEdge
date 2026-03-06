// ═══════════════════════════════════════════════════════════════════
// charEdge — TimeSeriesStore (Task 2.3.3 + 2.3.4 + 2.3.10)
//
// OPFS-backed block storage for OHLCV bar data with:
//   1. Per-block OPFS files (not monolithic) for efficient range I/O
//   2. B-tree index for O(log n) range queries over blocks
//   3. In-memory LRU cache with automatic eviction
//   4. Cross-key storage quota (200MB default, LRU eviction)
//   5. IndexedDB fallback when OPFS is unavailable
//
// Block architecture:
//   blocks/
//     BTCUSDT_1m_000.bin  (1000 bars × 48 bytes = 48KB)
//     BTCUSDT_1m_001.bin
//     BTCUSDT_1m.idx      (B-tree index: blockIdx → [minT, maxT, barCount])
//
// Usage:
//   import { timeSeriesStore } from './TimeSeriesStore.ts';
//   await timeSeriesStore.init();
//   await timeSeriesStore.write('BTCUSDT', '1m', bars);
//   const result = await timeSeriesStore.read('BTCUSDT', '1m', startT, endT);
// ═══════════════════════════════════════════════════════════════════

// @ts-expect-error — .ts imports resolved by Vite
import { logger } from '../../utils/logger.ts';

// ─── Types ──────────────────────────────────────────────────────

export interface Bar {
    t: number; // timestamp (ms)
    o: number; // open
    h: number; // high
    l: number; // low
    c: number; // close
    v: number; // volume
}

interface BlockMeta {
    blockIdx: number;
    minT: number;
    maxT: number;
    barCount: number;
    sizeBytes: number;
    lastAccess: number; // for cross-key LRU eviction
}

interface SeriesIndex {
    symbol: string;
    interval: string;
    blocks: BlockMeta[];
    totalBars: number;
    totalBytes: number;
    updatedAt: number;
}

interface StorageStats {
    totalBytes: number;
    totalBlocks: number;
    totalSeries: number;
    quotaBytes: number;
    usagePercent: number;
    series: Array<{ key: string; bytes: number; bars: number; blocks: number }>;
}

// ─── Constants ──────────────────────────────────────────────────

const BLOCK_SIZE = 1000;               // bars per block
const MAX_CACHED_BLOCKS = 50;          // in-memory LRU limit
const FIELDS_PER_BAR = 6;             // t, o, h, l, c, v
const BYTES_PER_BAR = FIELDS_PER_BAR * 8; // 48 bytes (Float64)
const CRC32_SIZE = 4;
const DIR_NAME = 'charEdge-ts-blocks'; // separate dir from legacy OPFSBarStore
const STORAGE_QUOTA = 200 * 1024 * 1024; // 200MB default

// ─── CRC32 ──────────────────────────────────────────────────────

const _crc32Table: Uint32Array = (() => {
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

function _crc32(buffer: ArrayBuffer): number {
    const bytes = new Uint8Array(buffer);
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) {
        const byteVal = bytes[i] ?? 0;
        const idx = (crc ^ byteVal) & 0xFF;
        crc = (_crc32Table[idx] ?? 0) ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

// ─── LRU Cache ──────────────────────────────────────────────────

export class LRUCache<V> {
    private _map = new Map<string, V>();
    private _maxSize: number;

    constructor(maxSize: number) {
        this._maxSize = maxSize;
    }

    get(key: string): V | undefined {
        if (!this._map.has(key)) return undefined;
        const value = this._map.get(key)!;
        this._map.delete(key);
        this._map.set(key, value);
        return value;
    }

    set(key: string, value: V): void {
        if (this._map.has(key)) this._map.delete(key);
        this._map.set(key, value);
        while (this._map.size > this._maxSize) {
            const firstKey = this._map.keys().next().value;
            if (firstKey != null) this._map.delete(firstKey);
        }
    }

    has(key: string): boolean {
        return this._map.has(key);
    }

    delete(key: string): boolean {
        return this._map.delete(key);
    }

    clear(): void {
        this._map.clear();
    }

    get size(): number {
        return this._map.size;
    }

    /** Get all keys for iteration */
    keys(): IterableIterator<string> {
        return this._map.keys();
    }
}

// ─── Binary Encode/Decode ───────────────────────────────────────

function encodeBlock(bars: Bar[]): ArrayBuffer {
    const dataBuffer = new ArrayBuffer(bars.length * BYTES_PER_BAR);
    const view = new Float64Array(dataBuffer);
    for (let i = 0; i < bars.length; i++) {
        const bar = bars[i];
        if (!bar) continue;
        const offset = i * FIELDS_PER_BAR;
        view[offset] = bar.t;
        view[offset + 1] = bar.o;
        view[offset + 2] = bar.h;
        view[offset + 3] = bar.l;
        view[offset + 4] = bar.c;
        view[offset + 5] = bar.v;
    }
    // Append CRC32
    const crc = _crc32(dataBuffer);
    const result = new Uint8Array(dataBuffer.byteLength + CRC32_SIZE);
    result.set(new Uint8Array(dataBuffer));
    new DataView(result.buffer, dataBuffer.byteLength, CRC32_SIZE).setUint32(0, crc, true);
    return result.buffer;
}

function decodeBlock(buffer: ArrayBuffer): Bar[] | null {
    if (buffer.byteLength <= CRC32_SIZE) return null;

    const dataLen = buffer.byteLength - CRC32_SIZE;
    if (dataLen % BYTES_PER_BAR !== 0) return null;

    // Verify CRC32
    const dataBuffer = buffer.slice(0, dataLen);
    const storedCrc = new DataView(buffer, dataLen, CRC32_SIZE).getUint32(0, true);
    const computedCrc = _crc32(dataBuffer);
    if (storedCrc !== computedCrc) {
        logger.data.warn('[TimeSeriesStore] CRC32 mismatch — corrupt block');
        return null;
    }

    const view = new Float64Array(dataBuffer);
    const count = view.length / FIELDS_PER_BAR;
    const bars: Bar[] = new Array(count);
    for (let i = 0; i < count; i++) {
        const offset = i * FIELDS_PER_BAR;
        bars[i] = {
            t: view[offset] ?? 0,
            o: view[offset + 1] ?? 0,
            h: view[offset + 2] ?? 0,
            l: view[offset + 3] ?? 0,
            c: view[offset + 4] ?? 0,
            v: view[offset + 5] ?? 0,
        };
    }
    return bars;
}

// ─── B-Tree Index ───────────────────────────────────────────────
// Lightweight sorted array index over block metadata.
// Blocks are sorted by minT — binary search for range queries.

class BTreeIndex {
    private _blocks: BlockMeta[] = [];

    /** Replace the entire index from serialized data */
    load(blocks: BlockMeta[]): void {
        this._blocks = blocks.sort((a, b) => a.minT - b.minT);
    }

    /** Insert or update a block's metadata */
    upsert(meta: BlockMeta): void {
        const idx = this._blocks.findIndex(b => b.blockIdx === meta.blockIdx);
        if (idx >= 0) {
            this._blocks[idx] = meta;
        } else {
            this._blocks.push(meta);
        }
        this._blocks.sort((a, b) => a.minT - b.minT);
    }

    /** Remove a block from the index */
    remove(blockIdx: number): void {
        this._blocks = this._blocks.filter(b => b.blockIdx !== blockIdx);
    }

    /**
     * Find all block indices that overlap [startT, endT].
     * Uses binary search for the start position, then scans forward.
     */
    findOverlapping(startT: number, endT: number): BlockMeta[] {
        if (this._blocks.length === 0) return [];

        // Binary search: find first block where maxT >= startT
        let lo = 0;
        let hi = this._blocks.length - 1;
        while (lo < hi) {
            const mid = (lo + hi) >>> 1;
            const midBlock = this._blocks[mid];
            if (midBlock && midBlock.maxT < startT) {
                lo = mid + 1;
            } else {
                hi = mid;
            }
        }

        // Scan forward to collect all overlapping blocks
        const result: BlockMeta[] = [];
        for (let i = lo; i < this._blocks.length; i++) {
            const block = this._blocks[i];
            if (!block) continue;
            if (block.minT > endT) break;
            if (block.maxT >= startT && block.minT <= endT) {
                result.push(block);
            }
        }
        return result;
    }

    /** Get all block metadata for serialization */
    getAll(): BlockMeta[] {
        return [...this._blocks];
    }

    /** Get total bars across all blocks */
    get totalBars(): number {
        return this._blocks.reduce((sum, b) => sum + b.barCount, 0);
    }

    /** Get total storage size */
    get totalBytes(): number {
        return this._blocks.reduce((sum, b) => sum + b.sizeBytes, 0);
    }

    /** Get the next available block index */
    get nextBlockIdx(): number {
        if (this._blocks.length === 0) return 0;
        return Math.max(...this._blocks.map(b => b.blockIdx)) + 1;
    }

    /** Get block count */
    get blockCount(): number {
        return this._blocks.length;
    }

    /** Find the least-recently-accessed block for eviction */
    getLRUBlock(): BlockMeta | null {
        if (this._blocks.length === 0) return null;
        return this._blocks.reduce((oldest, b) =>
            b.lastAccess < oldest.lastAccess ? b : oldest
        );
    }
}

// ─── OPFS Helpers ───────────────────────────────────────────────

async function _getBlockDir(): Promise<FileSystemDirectoryHandle | null> {
    try {
        const root = await navigator.storage.getDirectory();
        return await root.getDirectoryHandle(DIR_NAME, { create: true });
    } catch {
        return null;
    }
}

function _seriesDir(symbol: string, interval: string): string {
    return `${symbol}_${interval}`.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
}

function _blockFileName(blockIdx: number): string {
    return `blk_${String(blockIdx).padStart(5, '0')}.bin`;
}

const INDEX_FILENAME = '_index.json';

function _isOPFSAvailable(): boolean {
    return (
        typeof navigator !== 'undefined' &&
        !!navigator.storage &&
        typeof navigator.storage.getDirectory === 'function'
    );
}

// ─── IndexedDB Fallback ─────────────────────────────────────────

class IDBFallback {
    private _dbName = 'charEdge-ts-blocks';
    private _storeName = 'blocks';
    private _db: IDBDatabase | null = null;

    async open(): Promise<void> {
        if (this._db) return;
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(this._dbName, 1);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(this._storeName)) {
                    db.createObjectStore(this._storeName);
                }
            };
            req.onsuccess = () => { this._db = req.result; resolve(); };
            req.onerror = () => reject(req.error);
        });
    }

    async get(key: string): Promise<ArrayBuffer | null> {
        if (!this._db) return null;
        return new Promise((resolve) => {
            const tx = this._db!.transaction(this._storeName, 'readonly');
            const store = tx.objectStore(this._storeName);
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result ?? null);
            req.onerror = () => resolve(null);
        });
    }

    async put(key: string, value: ArrayBuffer | string): Promise<void> {
        if (!this._db) return;
        return new Promise((resolve, reject) => {
            const tx = this._db!.transaction(this._storeName, 'readwrite');
            const store = tx.objectStore(this._storeName);
            store.put(value, key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async delete(key: string): Promise<void> {
        if (!this._db) return;
        return new Promise((resolve) => {
            const tx = this._db!.transaction(this._storeName, 'readwrite');
            const store = tx.objectStore(this._storeName);
            store.delete(key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
        });
    }

    async clear(): Promise<void> {
        if (!this._db) return;
        return new Promise((resolve) => {
            const tx = this._db!.transaction(this._storeName, 'readwrite');
            tx.objectStore(this._storeName).clear();
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
        });
    }
}

// ─── TimeSeriesStore ────────────────────────────────────────────

export class TimeSeriesStore {
    private _cache = new LRUCache<Bar[]>(MAX_CACHED_BLOCKS);
    private _indices = new Map<string, BTreeIndex>();
    private _locks = new Map<string, Promise<unknown>>();
    private _initialized = false;
    private _useOPFS: boolean;
    private _idbFallback: IDBFallback | null = null;
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
        } else {
            this._idbFallback = new IDBFallback();
            try {
                await this._idbFallback.open();
                await this._loadAllIndicesFromIDB();
            } catch {
                logger.data.warn('[TimeSeriesStore] IndexedDB fallback init failed');
            }
        }

        this._initialized = true;
        logger.data.info(`[TimeSeriesStore] Initialized — ${this._useOPFS ? 'OPFS' : 'IndexedDB'} backend, ${this._indices.size} series loaded`);
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

    private _seriesKey(symbol: string, interval: string): string {
        return `${symbol}:${interval}`;
    }

    private _cacheKey(symbol: string, interval: string, blockIdx: number): string {
        return `${symbol}:${interval}:${blockIdx}`;
    }

    // ─── Write ──────────────────────────────────────────────────

    /**
     * Write bars to the store. Bars are split into blocks of BLOCK_SIZE
     * and persisted independently to OPFS/IDB.
     */
    async write(symbol: string, interval: string, bars: Bar[]): Promise<void> {
        if (!bars.length) return;
        const seriesKey = this._seriesKey(symbol, interval);

        return this._withLock(seriesKey, async () => {
            // Sort by timestamp
            const sorted = [...bars].sort((a, b) => a.t - b.t);

            // Get or create index
            let index = this._indices.get(seriesKey);
            if (!index) {
                index = new BTreeIndex();
                this._indices.set(seriesKey, index);
            }

            // Read existing bars to merge
            const existingBars = await this._readAllBars(symbol, interval, index);

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

            // Update index
            index.load(blocks);
            this._seriesAccess.set(seriesKey, Date.now());
            await this._saveIndex(symbol, interval, index);

            // Update total storage tracking
            this._recalcTotalStorage();

            // Enforce quota
            await this._enforceQuota();
        });
    }

    // ─── Read ───────────────────────────────────────────────────

    /**
     * Read bars within a time range using B-tree index for O(log n) lookup.
     */
    async read(symbol: string, interval: string, startTime: number, endTime: number): Promise<Bar[]> {
        const seriesKey = this._seriesKey(symbol, interval);
        const index = this._indices.get(seriesKey);

        if (!index || index.blockCount === 0) {
            return [];
        }

        // B-tree range query: find overlapping blocks
        const overlapping = index.findOverlapping(startTime, endTime);
        if (overlapping.length === 0) return [];

        // Track access time for quota management
        this._seriesAccess.set(seriesKey, Date.now());

        const result: Bar[] = [];
        for (const meta of overlapping) {
            // Update lastAccess
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

        return result;
    }

    /**
     * Read ALL bars for a symbol+interval (for migration/export).
     */
    async readAll(symbol: string, interval: string): Promise<Bar[]> {
        const index = this._indices.get(this._seriesKey(symbol, interval));
        if (!index || index.blockCount === 0) return [];
        return this._readAllBars(symbol, interval, index);
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
        const index = this._indices.get(this._seriesKey(symbol, interval));
        if (!index) return { blockCount: 0, totalBars: 0, totalBytes: 0, cachedBlocks: 0 };

        let cachedBlocks = 0;
        for (const meta of index.getAll()) {
            if (this._cache.has(this._cacheKey(symbol, interval, meta.blockIdx))) {
                cachedBlocks++;
            }
        }

        return {
            blockCount: index.blockCount,
            totalBars: index.totalBars,
            totalBytes: index.totalBytes,
            cachedBlocks,
        };
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
        } else if (this._idbFallback) {
            await this._idbFallback.clear();
        }

        logger.data.info('[TimeSeriesStore] Cleared all data');
    }

    /** Remove a specific series. */
    async removeSeries(symbol: string, interval: string): Promise<void> {
        const seriesKey = this._seriesKey(symbol, interval);
        const index = this._indices.get(seriesKey);

        if (index) {
            // Remove all block files
            for (const meta of index.getAll()) {
                this._cache.delete(this._cacheKey(symbol, interval, meta.blockIdx));
                await this._deleteBlock(symbol, interval, meta.blockIdx);
            }
            // Remove index file
            await this._deleteIndex(symbol, interval);
        }

        this._indices.delete(seriesKey);
        this._seriesAccess.delete(seriesKey);
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
        } else if (this._idbFallback) {
            const key = `${_seriesDir(symbol, interval)}/${_blockFileName(blockIdx)}`;
            await this._idbFallback.put(key, data);
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
        } else if (this._idbFallback) {
            const key = `${_seriesDir(symbol, interval)}/${_blockFileName(blockIdx)}`;
            return await this._idbFallback.get(key);
        }
        return null;
    }

    private async _deleteBlock(symbol: string, interval: string, blockIdx: number): Promise<void> {
        if (this._useOPFS) {
            try {
                const dir = await this._getSeriesDir(symbol, interval);
                if (!dir) return;
                await dir.removeEntry(_blockFileName(blockIdx));
            } catch { /* ok */ }
        } else if (this._idbFallback) {
            const key = `${_seriesDir(symbol, interval)}/${_blockFileName(blockIdx)}`;
            await this._idbFallback.delete(key);
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
        } else if (this._idbFallback) {
            const key = `${_seriesDir(symbol, interval)}/${INDEX_FILENAME}`;
            await this._idbFallback.put(key, json);
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
        } else if (this._idbFallback) {
            const key = `${_seriesDir(symbol, interval)}/${INDEX_FILENAME}`;
            const result = await this._idbFallback.get(key);
            if (result && typeof result === 'string') {
                json = result;
            } else if (result instanceof ArrayBuffer) {
                json = new TextDecoder().decode(result);
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
        } else if (this._idbFallback) {
            const key = `${_seriesDir(symbol, interval)}/${INDEX_FILENAME}`;
            await this._idbFallback.delete(key);
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

    private async _loadAllIndicesFromIDB(): Promise<void> {
        // IDB doesn't have directory listing, so we rely on stored index keys
        // This is a simplified approach — indices are loaded on-demand for IDB
    }

    // ─── Private: Merge ──────────────────────────────────────

    private _mergeBars(existing: Bar[], incoming: Bar[]): Bar[] {
        if (existing.length === 0) return incoming;
        if (incoming.length === 0) return existing;

        // Build a map by timestamp, prefer incoming data
        const map = new Map<number, Bar>();
        for (const bar of existing) map.set(bar.t, bar);
        for (const bar of incoming) map.set(bar.t, bar);

        // Sort by timestamp
        return Array.from(map.values()).sort((a, b) => a.t - b.t);
    }

    private async _readAllBars(symbol: string, interval: string, index: BTreeIndex): Promise<Bar[]> {
        const allBars: Bar[] = [];
        for (const meta of index.getAll()) {
            const cacheKey = this._cacheKey(symbol, interval, meta.blockIdx);
            let block = this._cache.get(cacheKey);
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
            if (block) allBars.push(...block);
        }
        return allBars.sort((a, b) => a.t - b.t);
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
            logger.data.info(`[TimeSeriesStore] Quota eviction: removing ${seriesKey} (${this._indices.get(seriesKey)?.totalBytes ?? 0} bytes)`);
            await this.removeSeries(symbol, interval);
        }
    }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const timeSeriesStore = new TimeSeriesStore();
export { BLOCK_SIZE, MAX_CACHED_BLOCKS, STORAGE_QUOTA, encodeBlock, decodeBlock };
export default timeSeriesStore;
