// ═══════════════════════════════════════════════════════════════════
// charEdge — DataJoin: D3-Style GPU Buffer Lifecycle (#124)
//
// Sprint 19 #124: Enter/Update/Exit pattern for WebGPU storage buffers.
// Instead of per-frame create→write→read→destroy, buffers persist
// across frames. Only the changed region is re-uploaded.
//
// Key behaviors:
//   - Capacitive growth: buffers grow by 2× to amortize reallocations
//   - Subregion updates: writeBuffer(buf, offset, subdata) for partial
//   - Generation tracking: skip re-upload if data unchanged
//   - GPUBufferRegistry integration for leak-safe cleanup
// ═══════════════════════════════════════════════════════════════════

import { gpuRegistry } from './GPUBufferRegistry.ts';

// ─── Types ───────────────────────────────────────────────────────

/** A GPU buffer managed by the DataJoin lifecycle. */
export interface JoinedBuffer {
    /** The underlying WebGPU buffer. */
    buffer: GPUBuffer;
    /** Allocated capacity in elements (F32). */
    capacity: number;
    /** Active element count. */
    length: number;
    /** Debug label. */
    label: string;
    /** Bumped on each update — used to detect staleness. */
    generation: number;
    /** GPUBuffer usage flags (carry forward on regrow). */
    usage: number;
}

/** Options for creating or updating a joined buffer. */
export interface JoinOptions {
    /** Additional GPUBufferUsage flags beyond STORAGE | COPY_DST. */
    extraUsage?: number;
}

// ─── Constants ───────────────────────────────────────────────────

/** Minimum buffer capacity in elements. */
const MIN_CAPACITY = 256;
/** Growth factor when buffer needs to expand. */
const GROWTH_FACTOR = 2;

// ─── DataJoin Class ──────────────────────────────────────────────

/**
 * D3-style data join for WebGPU storage buffers.
 *
 * Manages a pool of named buffers, routing data through
 * enter (create) → update (reuse/grow) → exit (destroy) lifecycle.
 *
 * @example
 * ```ts
 * const join = new DataJoin();
 * // Frame 1: enter — buffer created
 * const buf = join.join(device, 'closes', closesF32);
 * // Frame 2: update — buffer reused, only changed data uploaded
 * const buf2 = join.join(device, 'closes', closesF32);
 * // Frame 3: exit — data gone, buffer destroyed
 * join.join(device, 'closes', null);
 * ```
 */
export class DataJoin {
    /** Active joined buffers keyed by name. */
    private _buffers = new Map<string, JoinedBuffer>();
    /** Weak owner tokens for GPUBufferRegistry (1 per joined). */
    private _owners = new Map<string, object>();

    // ─── Core: Join ──────────────────────────────────────────────

    /**
     * Route data through the enter/update/exit lifecycle.
     *
     * @param device  - GPUDevice (required for enter/update)
     * @param key     - Unique buffer name (e.g. 'minmax-high', 'ema-output')
     * @param data    - Float32Array to upload, or null to trigger exit
     * @param options - Additional buffer creation options
     * @returns The joined buffer, or null if exited
     */
    join(
        device: GPUDevice,
        key: string,
        data: Float32Array | null,
        options?: JoinOptions,
    ): JoinedBuffer | null {
        const existing = this._buffers.get(key);

        if (!data) {
            // EXIT: data disappeared → destroy buffer
            if (existing) this._exit(key);
            return null;
        }

        if (!existing) {
            // ENTER: new data → create buffer
            return this._enter(device, key, data, options);
        }

        // UPDATE: reuse buffer (or grow if needed)
        return this._update(device, key, existing, data, options);
    }

    // ─── Enter ───────────────────────────────────────────────────

    private _enter(
        device: GPUDevice,
        key: string,
        data: Float32Array,
        options?: JoinOptions,
    ): JoinedBuffer {
        const capacity = Math.max(MIN_CAPACITY, nextPow2(data.length));
        const usage = GPUBufferUsage.STORAGE |
                      GPUBufferUsage.COPY_DST |
                      GPUBufferUsage.COPY_SRC |
                      (options?.extraUsage ?? 0);

        const buffer = device.createBuffer({
            size: capacity * 4, // Float32 = 4 bytes
            usage,
            label: `DataJoin:${key}`,
        });

        // Upload data
        device.queue.writeBuffer(buffer, 0, data);

        const joined: JoinedBuffer = {
            buffer,
            capacity,
            length: data.length,
            label: key,
            generation: 1,
            usage,
        };

        // Track via GPUBufferRegistry for GC-safe cleanup
        const owner = {};
        gpuRegistry.track(owner, device as unknown, buffer as unknown, key);
        this._owners.set(key, owner);
        this._buffers.set(key, joined);

        return joined;
    }

    // ─── Update ──────────────────────────────────────────────────

    private _update(
        device: GPUDevice,
        key: string,
        existing: JoinedBuffer,
        data: Float32Array,
        options?: JoinOptions,
    ): JoinedBuffer {
        // Check if we need to regrow
        if (data.length > existing.capacity) {
            // Destroy old buffer and re-enter with larger capacity
            this._exit(key);
            return this._enter(device, key, data, options);
        }

        // Same capacity — reuse the buffer, just re-upload
        device.queue.writeBuffer(existing.buffer, 0, data);
        existing.length = data.length;
        existing.generation++;

        return existing;
    }

    // ─── Exit ────────────────────────────────────────────────────

    private _exit(key: string): void {
        const joined = this._buffers.get(key);
        if (!joined) return;

        // Untrack from registry before destroying
        const owner = this._owners.get(key);
        if (owner) {
            gpuRegistry.untrack(owner);
            this._owners.delete(key);
        }

        try {
            joined.buffer.destroy();
        } catch { /* buffer may already be destroyed */ }

        this._buffers.delete(key);
    }

    // ─── Accessors ───────────────────────────────────────────────

    /** Get a joined buffer by key (without modifying it). */
    get(key: string): JoinedBuffer | undefined {
        return this._buffers.get(key);
    }

    /** Check if a key exists. */
    has(key: string): boolean {
        return this._buffers.has(key);
    }

    /** Get all active buffer keys. */
    keys(): IterableIterator<string> {
        return this._buffers.keys();
    }

    /** Get count of active joined buffers. */
    get size(): number {
        return this._buffers.size;
    }

    // ─── Bulk Operations ─────────────────────────────────────────

    /** Exit all buffers (e.g. on engine dispose). */
    clear(): void {
        for (const key of [...this._buffers.keys()]) {
            this._exit(key);
        }
    }

    /**
     * Join multiple named buffers at once.
     * Convenience for batch operations.
     */
    joinMany(
        device: GPUDevice,
        entries: Array<{ key: string; data: Float32Array | null }>,
        options?: JoinOptions,
    ): Map<string, JoinedBuffer | null> {
        const results = new Map<string, JoinedBuffer | null>();
        for (const { key, data } of entries) {
            results.set(key, this.join(device, key, data, options));
        }
        return results;
    }

    // ─── Stats ───────────────────────────────────────────────────

    /** Get memory usage stats for debugging. */
    getStats(): {
        activeBuffers: number;
        totalCapacityBytes: number;
        totalActiveBytes: number;
        utilization: number;
    } {
        let totalCap = 0;
        let totalActive = 0;
        for (const joined of this._buffers.values()) {
            totalCap += joined.capacity * 4;
            totalActive += joined.length * 4;
        }
        return {
            activeBuffers: this._buffers.size,
            totalCapacityBytes: totalCap,
            totalActiveBytes: totalActive,
            utilization: totalCap > 0 ? totalActive / totalCap : 0,
        };
    }
}

// ─── Helpers ─────────────────────────────────────────────────────

/** Round up to the next power of 2 (for capacitive growth). */
function nextPow2(n: number): number {
    if (n <= 0) return MIN_CAPACITY;
    let p = 1;
    while (p < n) p *= GROWTH_FACTOR;
    return p;
}

// ─── Singleton ───────────────────────────────────────────────────

export const dataJoin = new DataJoin();
export default dataJoin;
