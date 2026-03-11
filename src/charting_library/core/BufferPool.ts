// ═══════════════════════════════════════════════════════════════════
// charEdge — BufferPool
//
// Pre-allocate and recycle Float32Array / Float64Array buffers to
// avoid GC pressure during hot render loops.
//
// Pattern: request a buffer of at least N elements → get one from pool
// or allocate fresh. When done, release it back. Buffers are bucketed
// by power-of-2 sizes for efficient reuse.
//
// Usage:
//   import { bufferPool } from './BufferPool';
//   const buf = bufferPool.acquire(Float32Array, 1024);
//   // ... use buf ...
//   bufferPool.release(buf);
// ═══════════════════════════════════════════════════════════════════

// ─── Types ─────────────────────────────────────────────────────

type TypedArrayConstructor =
    | Float32ArrayConstructor
    | Float64ArrayConstructor
    | Int32ArrayConstructor
    | Uint8ArrayConstructor
    | Uint16ArrayConstructor
    | Uint32ArrayConstructor;

type TypedArray =
    | Float32Array
    | Float64Array
    | Int32Array
    | Uint8Array
    | Uint16Array
    | Uint32Array;

interface PoolBucket {
    /** Available buffers of this size */
    free: TypedArray[];
    /** Number of buffers currently checked out */
    active: number;
}

interface PoolStats {
    /** Total number of buffers currently pooled (free) */
    pooled: number;
    /** Number of buffers currently checked out */
    active: number;
    /** Total pool memory in bytes (free buffers only) */
    memoryBytes: number;
    /** Number of distinct bucket sizes */
    buckets: number;
    /** Breakdown by bucket size */
    bucketSizes: Record<number, { free: number; active: number }>;
}

// ─── Helpers ───────────────────────────────────────────────────

/** Round up to next power of 2 (minimum 64). */
function nextPow2(n: number): number {
    let v = Math.max(64, n);
    v--;
    v |= v >> 1;
    v |= v >> 2;
    v |= v >> 4;
    v |= v >> 8;
    v |= v >> 16;
    return v + 1;
}

/** Composite key for pool bucket: "F32:1024" */
// eslint-disable-next-line @typescript-eslint/naming-convention
function bucketKey(Ctor: TypedArrayConstructor, size: number): string {
    const name = Ctor === Float32Array ? 'F32'
        : Ctor === Float64Array ? 'F64'
            : Ctor === Int32Array ? 'I32'
                : Ctor === Uint8Array ? 'U8'
                    : Ctor === Uint16Array ? 'U16'
                        : 'U32';
    return `${name}:${size}`;
}

// ─── BufferPool ────────────────────────────────────────────────

/** Maximum free buffers per bucket to prevent unbounded memory growth. */
const MAX_FREE_PER_BUCKET = 8;

/** Maximum total pool memory (128MB). Beyond this, don't pool released buffers. */
const MAX_POOL_MEMORY = 128 * 1024 * 1024;

// eslint-disable-next-line @typescript-eslint/naming-convention
class _BufferPool {
    private _buckets = new Map<string, PoolBucket>();
    private _totalFreeBytes = 0;

    /**
     * Acquire a typed array of at least `minLength` elements.
     * Returns a recycled buffer or allocates a new one.
     * The returned buffer's length will be >= minLength (rounded to power of 2).
     *
     * @param Ctor      Typed array constructor (e.g., Float32Array)
     * @param minLength Minimum number of elements needed
     * @returns         A typed array of length >= minLength
     */
    acquire<T extends TypedArray>(
        // eslint-disable-next-line @typescript-eslint/naming-convention
        Ctor: { new(length: number): T; BYTES_PER_ELEMENT: number },
        minLength: number,
    ): T {
        const size = nextPow2(minLength);
        const key = bucketKey(Ctor as unknown as TypedArrayConstructor, size);
        const bucket = this._buckets.get(key);

        if (bucket && bucket.free.length > 0) {
            bucket.active++;
            const buf = bucket.free.pop()!;
            this._totalFreeBytes -= buf.byteLength;
            return buf as T;
        }

        // Allocate new
        if (bucket) {
            bucket.active++;
        } else {
            this._buckets.set(key, { free: [], active: 1 });
        }
        return new Ctor(size);
    }

    /**
     * Release a buffer back to the pool for reuse.
     * If the pool is at capacity for this bucket size, the buffer is dropped (GC'd).
     *
     * @param buf The typed array to return to the pool
     */
    release(buf: TypedArray): void {
        if (!buf || buf.byteLength === 0) return;

        const Ctor = buf.constructor as TypedArrayConstructor;
        const key = bucketKey(Ctor, buf.length);
        const bucket = this._buckets.get(key);

        if (!bucket) return; // Was never acquired from us

        bucket.active = Math.max(0, bucket.active - 1);

        // Don't pool if over memory budget or bucket is full
        if (bucket.free.length >= MAX_FREE_PER_BUCKET) return;
        if (this._totalFreeBytes + buf.byteLength > MAX_POOL_MEMORY) return;

        bucket.free.push(buf);
        this._totalFreeBytes += buf.byteLength;
    }

    /**
     * Acquire a Float32Array (shorthand).
     */
    f32(minLength: number): Float32Array {
        return this.acquire(Float32Array, minLength);
    }

    /**
     * Acquire a Float64Array (shorthand).
     */
    f64(minLength: number): Float64Array {
        return this.acquire(Float64Array, minLength);
    }

    /**
     * Clear all pooled buffers. Doesn't affect checked-out buffers.
     */
    clear(): void {
        this._buckets.clear();
        this._totalFreeBytes = 0;
    }

    /**
     * Trim the pool — release buffers that haven't been used recently.
     * Keeps at most 2 free buffers per bucket.
     */
    trim(): void {
        for (const [, bucket] of this._buckets) {
            while (bucket.free.length > 2) {
                const dropped = bucket.free.pop()!;
                this._totalFreeBytes -= dropped.byteLength;
            }
        }
    }

    /**
     * Get pool statistics for the perf dashboard.
     */
    getStats(): PoolStats {
        let pooled = 0;
        let active = 0;
        const bucketSizes: Record<number, { free: number; active: number }> = {};

        for (const [key, bucket] of this._buckets) {
            const size = parseInt(key.split(':')[1], 10);
            pooled += bucket.free.length;
            active += bucket.active;
            bucketSizes[size] = { free: bucket.free.length, active: bucket.active };
        }

        return {
            pooled,
            active,
            memoryBytes: this._totalFreeBytes,
            buckets: this._buckets.size,
            bucketSizes,
        };
    }
}

// ─── Singleton ─────────────────────────────────────────────────

export const bufferPool = new _BufferPool();
export { _BufferPool as BufferPool };
export default bufferPool;
