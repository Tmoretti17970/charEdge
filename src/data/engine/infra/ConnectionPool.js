// ═══════════════════════════════════════════════════════════════════
// charEdge — Connection Pool (Phase 6: Polish & Optimize)
//
// Manages a pool of WebRTC peer connections that persist across
// symbol switches. Instead of tearing down and recreating
// connections when the user changes symbols, the pool keeps
// live connections and only changes which symbols are relayed.
//
// Benefits:
//   - Eliminates 2-3s ICE renegotiation on symbol switch
//   - Keeps peers "warm" — no reconnect delays
//   - Max pool size prevents resource exhaustion
//   - Idle connections are reaped after timeout
// ═══════════════════════════════════════════════════════════════════

// ─── Constants ──────────────────────────────────────────────────

const DEFAULT_MAX_POOL  = 12;         // Maximum connections to keep
const IDLE_TIMEOUT      = 5 * 60_000; // 5 minutes before reaping idle
const HEALTH_CHECK_MS   = 30_000;     // Check connection health every 30s

// ═══════════════════════════════════════════════════════════════════
// ConnectionPool Class
// ═══════════════════════════════════════════════════════════════════

export class ConnectionPool extends EventTarget {
  /**
   * @param {Object} [opts]
   * @param {number} [opts.maxPool] - Maximum pool size
   * @param {number} [opts.idleTimeout] - Idle timeout in ms
   */
  constructor(opts = {}) {
    super();

    this._maxPool = opts.maxPool || DEFAULT_MAX_POOL;
    this._idleTimeout = opts.idleTimeout || IDLE_TIMEOUT;

    /**
     * Pool entries keyed by peerId.
     * @type {Map<string, PoolEntry>}
     *
     * PoolEntry: {
     *   peerId: string,
     *   pc: RTCPeerConnection,
     *   dc: RTCDataChannel,
     *   symbols: Set<string>,    // currently relayed symbols
     *   lastUsed: number,        // timestamp of last activity
     *   acquired: boolean,       // whether actively in use
     *   peerType: 'local'|'remote',
     *   createdAt: number,
     * }
     */
    this._pool = new Map();

    this._healthTimer = null;
    this._running = false;

    // Stats
    this._totalAcquires = 0;
    this._totalReleases = 0;
    this._totalReaped = 0;
    this._reuseCount = 0;
  }

  // ─── Lifecycle ───────────────────────────────────────────────

  /**
   * Start the pool health monitor.
   */
  start() {
    if (this._running) return;
    this._running = true;

    this._healthTimer = setInterval(() => {
      this._reapIdle();
    }, HEALTH_CHECK_MS);
  }

  /**
   * Stop the pool. Does NOT close connections — call destroy() for that.
   */
  stop() {
    if (!this._running) return;
    this._running = false;
    clearInterval(this._healthTimer);
    this._healthTimer = null;
  }

  // ─── Acquire / Release ──────────────────────────────────────

  /**
   * Acquire a connection from the pool.
   * If the peer already has a pooled connection, reuse it.
   * If not, a new entry is created with the provided pc/dc.
   *
   * @param {string} peerId
   * @param {RTCPeerConnection} [pc] - Provide for new connections
   * @param {RTCDataChannel} [dc] - Provide for new connections
   * @param {string} [peerType='local']
   * @returns {PoolEntry|null} The pool entry, or null if pool is full
   */
  acquire(peerId, pc, dc, peerType = 'local') {
    // Reuse existing connection
    if (this._pool.has(peerId)) {
      const entry = this._pool.get(peerId);
      entry.acquired = true;
      entry.lastUsed = Date.now();
      this._totalAcquires++;
      this._reuseCount++;
      return entry;
    }

    // Pool is full — try to evict an idle connection
    if (this._pool.size >= this._maxPool) {
      const evicted = this._evictOne();
      if (!evicted) return null; // All connections actively in use
    }

    // Create new entry (pc and dc must be provided for new connections)
    if (!pc || !dc) return null;

    const entry = {
      peerId,
      pc,
      dc,
      symbols: new Set(),
      lastUsed: Date.now(),
      acquired: true,
      peerType,
      createdAt: Date.now(),
    };

    this._pool.set(peerId, entry);
    this._totalAcquires++;
    return entry;
  }

  /**
   * Release a connection back to the pool (but keep it alive).
   * The connection stays pooled for reuse on the next symbol switch.
   *
   * @param {string} peerId
   */
  release(peerId) {
    const entry = this._pool.get(peerId);
    if (!entry) return;

    entry.acquired = false;
    entry.lastUsed = Date.now();
    this._totalReleases++;
  }

  /**
   * Close and remove a specific peer connection from the pool.
   * @param {string} peerId
   */
  remove(peerId) {
    const entry = this._pool.get(peerId);
    if (!entry) return;

    this._closeEntry(entry);
    this._pool.delete(peerId);
  }

  /**
   * Add a symbol to a pooled connection's relay set.
   * @param {string} peerId
   * @param {string} symbol
   */
  addSymbol(peerId, symbol) {
    const entry = this._pool.get(peerId);
    if (entry) {
      entry.symbols.add(symbol);
      entry.lastUsed = Date.now();
    }
  }

  /**
   * Remove a symbol from a pooled connection's relay set.
   * @param {string} peerId
   * @param {string} symbol
   */
  removeSymbol(peerId, symbol) {
    const entry = this._pool.get(peerId);
    if (entry) {
      entry.symbols.delete(symbol);
    }
  }

  // ─── Queries ────────────────────────────────────────────────

  /**
   * Check if a peer has a pooled connection.
   * @param {string} peerId
   * @returns {boolean}
   */
  has(peerId) {
    return this._pool.has(peerId);
  }

  /**
   * Get a pooled connection entry.
   * @param {string} peerId
   * @returns {PoolEntry|undefined}
   */
  get(peerId) {
    return this._pool.get(peerId);
  }

  /**
   * Get all active (acquired) connections.
   * @returns {PoolEntry[]}
   */
  getActive() {
    return [...this._pool.values()].filter(e => e.acquired);
  }

  /**
   * Get all idle (released) connections.
   * @returns {PoolEntry[]}
   */
  getIdle() {
    return [...this._pool.values()].filter(e => !e.acquired);
  }

  /**
   * Get the current pool size.
   * @returns {number}
   */
  get size() {
    return this._pool.size;
  }

  /**
   * Get pool statistics.
   * @returns {Object}
   */
  getStats() {
    const active = this.getActive().length;
    const idle = this.getIdle().length;

    return {
      poolSize: this._pool.size,
      maxPool: this._maxPool,
      active,
      idle,
      totalAcquires: this._totalAcquires,
      totalReleases: this._totalReleases,
      totalReaped: this._totalReaped,
      reuseCount: this._reuseCount,
      reuseRate: this._totalAcquires > 0
        ? (this._reuseCount / this._totalAcquires * 100).toFixed(1) + '%'
        : '0.0%',
    };
  }

  // ─── Cleanup ────────────────────────────────────────────────

  /**
   * Destroy the pool. Closes all connections and clears state.
   */
  destroy() {
    this.stop();

    for (const [, entry] of this._pool) {
      this._closeEntry(entry);
    }
    this._pool.clear();

    this._totalAcquires = 0;
    this._totalReleases = 0;
    this._totalReaped = 0;
    this._reuseCount = 0;
  }

  // ─── Internal ───────────────────────────────────────────────

  /**
   * Reap connections that have been idle longer than the timeout.
   * @private
   */
  _reapIdle() {
    const cutoff = Date.now() - this._idleTimeout;
    const toReap = [];

    for (const [id, entry] of this._pool) {
      if (!entry.acquired && entry.lastUsed < cutoff) {
        toReap.push(id);
      }
    }

    for (const id of toReap) {
      const entry = this._pool.get(id);
      this._closeEntry(entry);
      this._pool.delete(id);
      this._totalReaped++;

      this.dispatchEvent(new CustomEvent('connection-reaped', {
        detail: { peerId: id },
      }));
    }
  }

  /**
   * Evict the oldest idle connection to make room.
   * @private
   * @returns {boolean} true if a connection was evicted
   */
  _evictOne() {
    let oldest = null;
    let oldestId = null;

    for (const [id, entry] of this._pool) {
      if (!entry.acquired) {
        if (!oldest || entry.lastUsed < oldest.lastUsed) {
          oldest = entry;
          oldestId = id;
        }
      }
    }

    if (oldestId) {
      this._closeEntry(oldest);
      this._pool.delete(oldestId);
      this._totalReaped++;
      return true;
    }

    return false;
  }

  /**
   * Close a pool entry's WebRTC resources.
   * @private
   */
  _closeEntry(entry) {
    try { entry.dc?.close(); } catch { /* */ }
    try { entry.pc?.close(); } catch { /* */ }
    entry.symbols.clear();
  }
}

// ─── Singleton ────────────────────────────────────────────────

let _instance = null;

/**
 * Get (or create) the global ConnectionPool singleton.
 * @param {Object} [opts]
 * @returns {ConnectionPool}
 */
export function getConnectionPool(opts) {
  if (!_instance) _instance = new ConnectionPool(opts);
  return _instance;
}

export default ConnectionPool;
