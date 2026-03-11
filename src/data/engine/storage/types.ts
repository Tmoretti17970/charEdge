// ═══════════════════════════════════════════════════════════════════
// charEdge — TimeSeriesStore Types
//
// Sprint 9 #71: Extracted from TimeSeriesStore.ts.
// Shared interfaces for the block storage system.
// ═══════════════════════════════════════════════════════════════════

/** OHLCV bar record. */
export interface Bar {
    t: number; // timestamp (ms)
    o: number; // open
    h: number; // high
    l: number; // low
    c: number; // close
    v: number; // volume
}

/**
 * Columnar bar storage — cache-friendly for batch indicator computation.
 *
 * Uses Float64Array for timestamps and closes (precision-critical),
 * Float32Array for OHLV fields (50% memory savings, sufficient for display).
 *
 * Sprint 18 #112: Enables zero-copy WASM handoff.
 */
export interface BarColumns {
    t: Float64Array;   // timestamps (ms)
    o: Float32Array;   // opens
    h: Float32Array;   // highs
    l: Float32Array;   // lows
    c: Float64Array;   // closes (Float64 for indicator precision)
    v: Float32Array;   // volumes
    length: number;
}

/** Metadata for a single block in the store. */
export interface BlockMeta {
    blockIdx: number;
    minT: number;
    maxT: number;
    barCount: number;
    sizeBytes: number;
    lastAccess: number; // for cross-key LRU eviction
}

/** Serialized index for a symbol+interval series. */
export interface SeriesIndex {
    symbol: string;
    interval: string;
    blocks: BlockMeta[];
    totalBars: number;
    totalBytes: number;
    updatedAt: number;
}

/** Aggregated storage statistics across all series. */
export interface StorageStats {
    totalBytes: number;
    totalBlocks: number;
    totalSeries: number;
    quotaBytes: number;
    usagePercent: number;
    series: Array<{ key: string; bytes: number; bars: number; blocks: number }>;
}

// ─── Constants ──────────────────────────────────────────────────

export const BLOCK_SIZE = 1000;               // bars per block
export const MAX_CACHED_BLOCKS = 50;          // in-memory LRU limit
export const FIELDS_PER_BAR = 6;              // t, o, h, l, c, v
export const BYTES_PER_BAR = FIELDS_PER_BAR * 8; // 48 bytes (Float64)
export const CRC32_SIZE = 4;
export const DIR_NAME = 'charEdge-ts-blocks'; // separate dir from legacy OPFSBarStore
export const STORAGE_QUOTA = 200 * 1024 * 1024; // 200MB default
export const INDEX_FILENAME = '_index.json';
