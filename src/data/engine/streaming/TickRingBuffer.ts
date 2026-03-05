// ═══════════════════════════════════════════════════════════════════
// charEdge — TickRingBuffer
//
// Zero-allocation circular buffer for sub-second trade ticks.
// Struct-of-arrays layout: separate Float64Array columns for
// price, qty, time, side. No GC pressure on the hot path.
//
// Default capacity: 16,384 ticks/symbol (~512KB at 32 bytes/tick).
//
// Usage:
//   const buf = new TickRingBuffer(16384);
//   buf.push(42000.5, 0.01, Date.now(), 0); // buy
//   buf.push(41999.0, 0.05, Date.now(), 1); // sell
//   const last10 = buf.peekLast(10);
//   const avgPrice = buf.vwap(100);
// ═══════════════════════════════════════════════════════════════════

/** Side constants for readability. */
export const SIDE = {
    BUY: 0,
    SELL: 1,
} as const;

/** Snapshot of tick data returned by peekLast (subarray views, zero-copy). */
export interface TickSlice {
    price: Float64Array;
    qty: Float64Array;
    time: Float64Array;
    side: Float64Array;
    length: number;
}

/** Single tick data point. */
export interface Tick {
    price: number;
    qty: number;
    time: number;
    side: number;
}

/**
 * Zero-allocation circular buffer for trade ticks.
 *
 * Uses struct-of-arrays layout with Float64Array columns.
 * All mutations are O(1) with no heap allocations.
 * Reads via `peekLast()` return subarray views (zero-copy).
 */
export class TickRingBuffer {
    readonly capacity: number;

    private _price: Float64Array;
    private _qty: Float64Array;
    private _time: Float64Array;
    private _side: Float64Array;

    /** Write cursor — next slot to write into. */
    private _head: number = 0;

    /** Number of ticks currently stored (≤ capacity). */
    private _count: number = 0;

    /**
     * @param capacity Maximum number of ticks to store.
     *   When full, oldest ticks are silently overwritten.
     */
    constructor(capacity: number = 16384) {
        if (capacity <= 0 || !Number.isInteger(capacity)) {
            throw new RangeError(`TickRingBuffer capacity must be a positive integer, got ${capacity}`);
        }
        this.capacity = capacity;
        this._price = new Float64Array(capacity);
        this._qty = new Float64Array(capacity);
        this._time = new Float64Array(capacity);
        this._side = new Float64Array(capacity);
    }

    // ─── Writes ────────────────────────────────────────────────────

    /**
     * Push a single tick. O(1), zero allocations.
     *
     * @param price Trade price
     * @param qty   Trade quantity
     * @param time  Timestamp in ms (numeric, NOT ISO string)
     * @param side  0 = buy, 1 = sell (use SIDE.BUY / SIDE.SELL)
     */
    push(price: number, qty: number, time: number, side: number): void {
        const idx = this._head;
        this._price[idx] = price;
        this._qty[idx] = qty;
        this._time[idx] = time;
        this._side[idx] = side;

        this._head = (idx + 1) % this.capacity;
        if (this._count < this.capacity) this._count++;
    }

    // ─── Reads ─────────────────────────────────────────────────────

    /** Current number of stored ticks. */
    get length(): number {
        return this._count;
    }

    /** Whether the buffer is empty. */
    get isEmpty(): boolean {
        return this._count === 0;
    }

    /**
     * Get the most recent tick, or null if empty.
     * Returns a plain object (small allocation — use sparingly on hot path).
     */
    latest(): Tick | null {
        if (this._count === 0) return null;
        const idx = (this._head - 1 + this.capacity) % this.capacity;
        return {
            price: this._price[idx],
            qty: this._qty[idx],
            time: this._time[idx],
            side: this._side[idx],
        };
    }

    /**
     * Peek at the last N ticks as typed array subviews.
     *
     * ⚠️  When the requested range wraps around the ring, this copies
     * into a new contiguous array. For non-wrapped ranges, it returns
     * zero-copy subarray views.
     *
     * @param n Number of recent ticks to retrieve (clamped to count)
     */
    peekLast(n: number): TickSlice {
        const count = Math.min(n, this._count);
        if (count === 0) {
            return {
                price: new Float64Array(0),
                qty: new Float64Array(0),
                time: new Float64Array(0),
                side: new Float64Array(0),
                length: 0,
            };
        }

        // Start index in the ring for the oldest of the N requested ticks
        const start = (this._head - count + this.capacity) % this.capacity;

        if (start + count <= this.capacity) {
            // Contiguous region — zero-copy subarray views
            return {
                price: this._price.subarray(start, start + count),
                qty: this._qty.subarray(start, start + count),
                time: this._time.subarray(start, start + count),
                side: this._side.subarray(start, start + count),
                length: count,
            };
        }

        // Wrapped — must copy into contiguous arrays
        const price = new Float64Array(count);
        const qty = new Float64Array(count);
        const time = new Float64Array(count);
        const side = new Float64Array(count);

        const tailLen = this.capacity - start;
        price.set(this._price.subarray(start), 0);
        price.set(this._price.subarray(0, count - tailLen), tailLen);
        qty.set(this._qty.subarray(start), 0);
        qty.set(this._qty.subarray(0, count - tailLen), tailLen);
        time.set(this._time.subarray(start), 0);
        time.set(this._time.subarray(0, count - tailLen), tailLen);
        side.set(this._side.subarray(start), 0);
        side.set(this._side.subarray(0, count - tailLen), tailLen);

        return { price, qty, time, side, length: count };
    }

    // ─── Aggregations ──────────────────────────────────────────────

    /**
     * Volume-Weighted Average Price over the last N ticks.
     * Returns NaN if no ticks or total volume is zero.
     */
    vwap(n: number): number {
        const count = Math.min(n, this._count);
        if (count === 0) return NaN;

        let sumPQ = 0;
        let sumQ = 0;

        for (let i = 0; i < count; i++) {
            const idx = (this._head - 1 - i + this.capacity) % this.capacity;
            const p = this._price[idx];
            const q = this._qty[idx];
            sumPQ += p * q;
            sumQ += q;
        }

        return sumQ === 0 ? NaN : sumPQ / sumQ;
    }

    /**
     * Count buys vs sells in the last N ticks.
     * Useful for order flow imbalance calculations.
     */
    buySellCount(n: number): { buys: number; sells: number } {
        const count = Math.min(n, this._count);
        let buys = 0;
        let sells = 0;

        for (let i = 0; i < count; i++) {
            const idx = (this._head - 1 - i + this.capacity) % this.capacity;
            if (this._side[idx] === SIDE.SELL) {
                sells++;
            } else {
                buys++;
            }
        }

        return { buys, sells };
    }

    /**
     * Total volume over the last N ticks, split by side.
     */
    volumeBySize(n: number): { buyVolume: number; sellVolume: number } {
        const count = Math.min(n, this._count);
        let buyVolume = 0;
        let sellVolume = 0;

        for (let i = 0; i < count; i++) {
            const idx = (this._head - 1 - i + this.capacity) % this.capacity;
            if (this._side[idx] === SIDE.SELL) {
                sellVolume += this._qty[idx];
            } else {
                buyVolume += this._qty[idx];
            }
        }

        return { buyVolume, sellVolume };
    }

    // ─── Lifecycle ─────────────────────────────────────────────────

    /** Clear all data without deallocating memory. */
    clear(): void {
        this._head = 0;
        this._count = 0;
        // No need to zero the arrays — head/count guard all reads
    }

    /** Estimated memory usage in bytes. */
    memoryBytes(): number {
        return this.capacity * 4 * 8; // 4 Float64Arrays × 8 bytes each
    }

    /**
     * Create a transferable snapshot for Web Worker messaging.
     * After calling this, the original buffer is still usable
     * (this copies, it does not transfer ownership).
     */
    snapshot(): {
        price: Float64Array;
        qty: Float64Array;
        time: Float64Array;
        side: Float64Array;
        count: number;
    } {
        const count = this._count;
        const slice = this.peekLast(count);
        return {
            price: new Float64Array(slice.price),
            qty: new Float64Array(slice.qty),
            time: new Float64Array(slice.time),
            side: new Float64Array(slice.side),
            count,
        };
    }
}
