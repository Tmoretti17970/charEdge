// ═══════════════════════════════════════════════════════════════════
// charEdge — Bandwidth Monitor (Phase 6: Polish & Optimize)
//
// Tracks cumulative bytes in/out across P2P relay vs. direct WS.
// Computes compression ratio and bandwidth savings from using
// BinaryCodec (MessagePack) instead of JSON for P2P messages.
//
// Usage:
//   monitor.recordP2PSent(bytes);
//   monitor.recordP2PReceived(bytes);
//   monitor.recordWSSent(bytes);
//   monitor.recordWSReceived(bytes);
//   monitor.recordBinarySaved(jsonBytes, binaryBytes);
//   const report = monitor.getReport();
// ═══════════════════════════════════════════════════════════════════

// ─── Constants ──────────────────────────────────────────────────

const SNAPSHOT_INTERVAL = 60_000; // 1 minute snapshots for rate calc
const MAX_SNAPSHOTS     = 60;     // Keep 1 hour of history

// ═══════════════════════════════════════════════════════════════════
// BandwidthMonitor Class
// ═══════════════════════════════════════════════════════════════════

export class BandwidthMonitor extends EventTarget {
  constructor() {
    super();

    // Cumulative byte counters
    this._p2pSent = 0;
    this._p2pReceived = 0;
    this._wsSent = 0;
    this._wsReceived = 0;

    // Binary vs JSON savings tracking
    this._totalJsonBytes = 0;
    this._totalBinaryBytes = 0;

    // Message counters
    this._p2pMessagesSent = 0;
    this._p2pMessagesReceived = 0;
    this._wsMessagesSent = 0;
    this._wsMessagesReceived = 0;

    // Throughput snapshots (bytes per minute)
    this._snapshots = [];
    this._snapshotTimer = null;
    this._lastSnapshotP2P = { sent: 0, received: 0 };
    this._lastSnapshotWS = { sent: 0, received: 0 };

    this._startTime = Date.now();
    this._running = false;
  }

  // ─── Lifecycle ───────────────────────────────────────────────

  /**
   * Start monitoring. Begins periodic snapshots.
   */
  start() {
    if (this._running) return;
    this._running = true;
    this._startTime = Date.now();

    this._snapshotTimer = setInterval(() => {
      this._takeSnapshot();
    }, SNAPSHOT_INTERVAL);
  }

  /**
   * Stop monitoring. Clears timers.
   */
  stop() {
    if (!this._running) return;
    this._running = false;
    clearInterval(this._snapshotTimer);
    this._snapshotTimer = null;
  }

  // ─── Recording ──────────────────────────────────────────────

  /**
   * Record bytes sent via P2P relay.
   * @param {number} bytes
   */
  recordP2PSent(bytes) {
    this._p2pSent += bytes;
    this._p2pMessagesSent++;
  }

  /**
   * Record bytes received via P2P relay.
   * @param {number} bytes
   */
  recordP2PReceived(bytes) {
    this._p2pReceived += bytes;
    this._p2pMessagesReceived++;
  }

  /**
   * Record bytes sent via direct WebSocket.
   * @param {number} bytes
   */
  recordWSSent(bytes) {
    this._wsSent += bytes;
    this._wsMessagesSent++;
  }

  /**
   * Record bytes received via direct WebSocket.
   * @param {number} bytes
   */
  recordWSReceived(bytes) {
    this._wsReceived += bytes;
    this._wsMessagesReceived++;
  }

  /**
   * Record a binary vs JSON savings event.
   * Call this whenever a message is encoded with BinaryCodec
   * to track the compression benefit.
   *
   * @param {number} jsonBytes - Size if encoded as JSON
   * @param {number} binaryBytes - Size encoded as MessagePack
   */
  recordBinarySaved(jsonBytes, binaryBytes) {
    this._totalJsonBytes += jsonBytes;
    this._totalBinaryBytes += binaryBytes;
  }

  // ─── Reporting ──────────────────────────────────────────────

  /**
   * Get a comprehensive bandwidth report.
   * @returns {Object}
   */
  getReport() {
    const uptimeMs = Date.now() - this._startTime;
    const uptimeSec = Math.max(1, uptimeMs / 1000);

    const totalP2P = this._p2pSent + this._p2pReceived;
    const totalWS = this._wsSent + this._wsReceived;
    const totalAll = totalP2P + totalWS;

    // Compression ratio (1.0 = no savings, 0.5 = 50% smaller)
    const compressionRatio = this._totalJsonBytes > 0
      ? this._totalBinaryBytes / this._totalJsonBytes
      : 1.0;

    const bytesSaved = this._totalJsonBytes - this._totalBinaryBytes;

    return {
      // Cumulative bytes
      p2p: {
        sent: this._p2pSent,
        received: this._p2pReceived,
        total: totalP2P,
        messagesSent: this._p2pMessagesSent,
        messagesReceived: this._p2pMessagesReceived,
      },
      ws: {
        sent: this._wsSent,
        received: this._wsReceived,
        total: totalWS,
        messagesSent: this._wsMessagesSent,
        messagesReceived: this._wsMessagesReceived,
      },

      // Aggregated
      totalBytes: totalAll,

      // Compression stats
      compression: {
        jsonBytes: this._totalJsonBytes,
        binaryBytes: this._totalBinaryBytes,
        bytesSaved,
        ratio: compressionRatio,
        savingsPercent: this._totalJsonBytes > 0
          ? ((1 - compressionRatio) * 100).toFixed(1)
          : '0.0',
      },

      // Rates (bytes/sec)
      rates: {
        p2pSentPerSec: Math.round(this._p2pSent / uptimeSec),
        p2pReceivedPerSec: Math.round(this._p2pReceived / uptimeSec),
        wsSentPerSec: Math.round(this._wsSent / uptimeSec),
        wsReceivedPerSec: Math.round(this._wsReceived / uptimeSec),
      },

      // Throughput history
      snapshots: [...this._snapshots],

      // Uptime
      uptimeMs,
    };
  }

  /**
   * Get a human-readable summary string.
   * @returns {string}
   */
  getSummary() {
    const r = this.getReport();
    const fmt = (b) => {
      if (b > 1_048_576) return `${(b / 1_048_576).toFixed(1)} MB`;
      if (b > 1024) return `${(b / 1024).toFixed(1)} KB`;
      return `${b} B`;
    };

    return [
      `P2P: ↑${fmt(r.p2p.sent)} ↓${fmt(r.p2p.received)}`,
      `WS:  ↑${fmt(r.ws.sent)} ↓${fmt(r.ws.received)}`,
      `Saved: ${fmt(r.compression.bytesSaved)} (${r.compression.savingsPercent}% compression)`,
      `Uptime: ${Math.round(r.uptimeMs / 1000)}s`,
    ].join(' | ');
  }

  // ─── Reset ──────────────────────────────────────────────────

  /**
   * Reset all counters.
   */
  reset() {
    this._p2pSent = 0;
    this._p2pReceived = 0;
    this._wsSent = 0;
    this._wsReceived = 0;
    this._totalJsonBytes = 0;
    this._totalBinaryBytes = 0;
    this._p2pMessagesSent = 0;
    this._p2pMessagesReceived = 0;
    this._wsMessagesSent = 0;
    this._wsMessagesReceived = 0;
    this._snapshots = [];
    this._startTime = Date.now();
  }

  /**
   * Destroy the monitor. Stops timers and clears state.
   */
  destroy() {
    this.stop();
    this.reset();
  }

  // ─── Internal ───────────────────────────────────────────────

  /** @private */
  _takeSnapshot() {
    const now = Date.now();
    const snap = {
      ts: now,
      p2pSentDelta: this._p2pSent - this._lastSnapshotP2P.sent,
      p2pReceivedDelta: this._p2pReceived - this._lastSnapshotP2P.received,
      wsSentDelta: this._wsSent - this._lastSnapshotWS.sent,
      wsReceivedDelta: this._wsReceived - this._lastSnapshotWS.received,
    };

    this._snapshots.push(snap);
    if (this._snapshots.length > MAX_SNAPSHOTS) {
      this._snapshots.shift();
    }

    this._lastSnapshotP2P = { sent: this._p2pSent, received: this._p2pReceived };
    this._lastSnapshotWS = { sent: this._wsSent, received: this._wsReceived };

    this.dispatchEvent(new CustomEvent('snapshot', { detail: snap }));
  }
}

// ─── Singleton ────────────────────────────────────────────────

let _instance = null;

/**
 * Get (or create) the global BandwidthMonitor singleton.
 * @returns {BandwidthMonitor}
 */
export function getBandwidthMonitor() {
  if (!_instance) _instance = new BandwidthMonitor();
  return _instance;
}

export default BandwidthMonitor;
