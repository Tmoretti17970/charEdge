// ═══════════════════════════════════════════════════════════════════
// charEdge — BarDataBuffer
//
// Columnar typed-array storage for OHLCV bar data.
// Replaces Array<Object> with Float64Arrays for:
//   • 10-50x faster iteration (cache-friendly memory layout)
//   • Zero garbage collection pressure
//   • Direct Transferable to Web Workers (Phase 2)
//   • SIMD-ready for WebAssembly (Phase 4)
//
// Data layout (columnar, not row-based):
//   time[]   open[]   high[]   low[]   close[]   volume[]
//   ─────    ─────    ─────    ────    ──────    ───────
//   [t0]     [o0]     [h0]     [l0]   [c0]      [v0]
//   [t1]     [o1]     [h1]     [l1]   [c1]      [v1]
//   ...      ...      ...      ...    ...       ...
// ═══════════════════════════════════════════════════════════════════

const INITIAL_CAPACITY = 2048;
const COLUMNS = ['time', 'open', 'high', 'low', 'close', 'volume'];

export class BarDataBuffer {
  /**
   * @param {number} [capacity=2048] - Initial pre-allocated capacity
   */
  constructor(capacity = INITIAL_CAPACITY) {
    this._capacity = capacity;
    this._length = 0;

    // Allocate columnar typed arrays
    this.time   = new Float64Array(capacity);
    this.open   = new Float64Array(capacity);
    this.high   = new Float64Array(capacity);
    this.low    = new Float64Array(capacity);
    this.close  = new Float64Array(capacity);
    this.volume = new Float64Array(capacity);
  }

  /** Current number of bars */
  get length() {
    return this._length;
  }

  /** Current allocated capacity */
  get capacity() {
    return this._capacity;
  }

  // ─── Growth ──────────────────────────────────────────────────

  /**
   * Ensure capacity for at least `n` bars.
   * Grows by 2x each time (amortized O(1) append).
   * @param {number} n
   */
  _ensureCapacity(n) {
    if (n <= this._capacity) return;

    let newCap = this._capacity;
    while (newCap < n) newCap *= 2;

    for (const col of COLUMNS) {
      const old = this[col];
      const buf = new Float64Array(newCap);
      buf.set(old, 0);
      this[col] = buf;
    }
    this._capacity = newCap;
  }

  // ─── Bulk Load ───────────────────────────────────────────────

  /**
   * Load from an array of bar objects.
   * This is the primary way to populate from existing data.
   *
   * @param {Array<{time:number, open:number, high:number, low:number, close:number, volume?:number}>} bars
   */
  fromArray(bars) {
    const n = bars.length;
    this._ensureCapacity(n);
    this._length = n;

    const t = this.time, o = this.open, h = this.high;
    const l = this.low, c = this.close, v = this.volume;

    for (let i = 0; i < n; i++) {
      const b = bars[i];
      t[i] = b.time || 0;
      o[i] = b.open || 0;
      h[i] = b.high || 0;
      l[i] = b.low  || 0;
      c[i] = b.close || 0;
      v[i] = b.volume || 0;
    }
  }

  /**
   * Convert back to array of objects (backward compatibility).
   * Allocates new objects — use sparingly, prefer typed array access.
   *
   * @param {number} [start=0]
   * @param {number} [end=this._length]
   * @returns {Array<Object>}
   */
  toArray(start = 0, end = this._length) {
    const result = new Array(end - start);
    for (let i = start; i < end; i++) {
      result[i - start] = {
        time:   this.time[i],
        open:   this.open[i],
        high:   this.high[i],
        low:    this.low[i],
        close:  this.close[i],
        volume: this.volume[i],
      };
    }
    return result;
  }

  // ─── Append ──────────────────────────────────────────────────

  /**
   * Append a single bar. Used for streaming tick updates.
   * @param {{time:number, open:number, high:number, low:number, close:number, volume?:number}} bar
   */
  append(bar) {
    this._ensureCapacity(this._length + 1);
    const i = this._length;
    this.time[i]   = bar.time || 0;
    this.open[i]   = bar.open || 0;
    this.high[i]   = bar.high || 0;
    this.low[i]    = bar.low  || 0;
    this.close[i]  = bar.close || 0;
    this.volume[i] = bar.volume || 0;
    this._length++;
  }

  /**
   * Update the last bar in-place (streaming tick update).
   * @param {{open?:number, high?:number, low?:number, close?:number, volume?:number}} fields
   */
  updateLast(fields) {
    if (this._length === 0) return;
    const i = this._length - 1;
    if (fields.open   !== undefined) this.open[i]   = fields.open;
    if (fields.high   !== undefined) this.high[i]   = fields.high;
    if (fields.low    !== undefined) this.low[i]    = fields.low;
    if (fields.close  !== undefined) this.close[i]  = fields.close;
    if (fields.volume !== undefined) this.volume[i] = fields.volume;
  }

  // ─── Accessors ───────────────────────────────────────────────

  /**
   * Get a single bar as an object (convenience, not for hot paths).
   * @param {number} idx
   * @returns {{time:number, open:number, high:number, low:number, close:number, volume:number} | null}
   */
  at(idx) {
    if (idx < 0 || idx >= this._length) return null;
    return {
      time:   this.time[idx],
      open:   this.open[idx],
      high:   this.high[idx],
      low:    this.low[idx],
      close:  this.close[idx],
      volume: this.volume[idx],
    };
  }

  /**
   * Get the last bar as an object.
   * @returns {Object|null}
   */
  last() {
    return this.at(this._length - 1);
  }

  /**
   * Create a lightweight slice view (returns new BarDataBuffer sharing subarray).
   * This does NOT copy data — it creates typed array views into the same memory.
   *
   * @param {number} start
   * @param {number} end
   * @returns {BarDataBufferView}
   */
  slice(start, end) {
    const s = Math.max(0, start);
    const e = Math.min(this._length, end);
    return new BarDataBufferView(this, s, e);
  }

  // ─── Scans (hot path operations on typed arrays) ─────────────

  /**
   * Find the min/max high/low within a range.
   * Operates directly on typed arrays for maximum speed.
   *
   * @param {number} start
   * @param {number} end
   * @returns {{lo: number, hi: number}}
   */
  minMaxRange(start, end) {
    let lo = Infinity, hi = -Infinity;
    const h = this.high, l = this.low;
    const s = Math.max(0, start);
    const e = Math.min(this._length, end);
    for (let i = s; i < e; i++) {
      if (l[i] < lo) lo = l[i];
      if (h[i] > hi) hi = h[i];
    }
    return { lo, hi };
  }

  /**
   * Find the maximum volume in a range.
   * @param {number} start
   * @param {number} end
   * @returns {number}
   */
  maxVolume(start, end) {
    let mx = 0;
    const v = this.volume;
    const s = Math.max(0, start);
    const e = Math.min(this._length, end);
    for (let i = s; i < e; i++) {
      if (v[i] > mx) mx = v[i];
    }
    return mx;
  }

  /**
   * Reset buffer to empty (keeps allocated memory).
   */
  clear() {
    this._length = 0;
  }

  /**
   * Get the typed arrays as a Transferable list for Web Workers.
   * After transfer, this buffer becomes detached.
   * @returns {ArrayBuffer[]}
   */
  getTransferables() {
    return COLUMNS.map(col => this[col].buffer);
  }
}

// ─── Slice View (zero-copy) ────────────────────────────────────

/**
 * Lightweight view into a BarDataBuffer range.
 * Exposes the same column properties but as subarray views.
 * No data is copied — reads/writes go to the parent buffer.
 */
export class BarDataBufferView {
  constructor(parent, start, end) {
    this._parent = parent;
    this._start = start;
    this._length = end - start;

    // Create typed array views (no copy, same underlying ArrayBuffer)
    this.time   = parent.time.subarray(start, end);
    this.open   = parent.open.subarray(start, end);
    this.high   = parent.high.subarray(start, end);
    this.low    = parent.low.subarray(start, end);
    this.close  = parent.close.subarray(start, end);
    this.volume = parent.volume.subarray(start, end);
  }

  get length() {
    return this._length;
  }

  /** Convert to array of objects (backward compat). */
  toArray() {
    const result = new Array(this._length);
    for (let i = 0; i < this._length; i++) {
      result[i] = {
        time:   this.time[i],
        open:   this.open[i],
        high:   this.high[i],
        low:    this.low[i],
        close:  this.close[i],
        volume: this.volume[i],
      };
    }
    return result;
  }

  /** Get single bar as object. */
  at(idx) {
    if (idx < 0 || idx >= this._length) return null;
    return {
      time:   this.time[idx],
      open:   this.open[idx],
      high:   this.high[idx],
      low:    this.low[idx],
      close:  this.close[idx],
      volume: this.volume[idx],
    };
  }

  /** Get last bar. */
  last() {
    return this.at(this._length - 1);
  }

  /** Min/max in this view. */
  minMaxRange(start = 0, end = this._length) {
    let lo = Infinity, hi = -Infinity;
    for (let i = start; i < end; i++) {
      if (this.low[i] < lo)  lo = this.low[i];
      if (this.high[i] > hi) hi = this.high[i];
    }
    return { lo, hi };
  }

  /** Max volume in this view. */
  maxVolume(start = 0, end = this._length) {
    let mx = 0;
    for (let i = start; i < end; i++) {
      if (this.volume[i] > mx) mx = this.volume[i];
    }
    return mx;
  }
}
