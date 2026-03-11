import { logger } from '@/observability/logger';
// ═══════════════════════════════════════════════════════════════════
// charEdge v14 — Data SharedWorker
//
// SharedWorker that consolidates data streams across multiple browser
// tabs, eliminating redundant WebSocket connections and API calls.
//
// Architecture:
//   Tab A ──┐
//   Tab B ──┤──→ SharedWorker ──→ Single WS per symbol
//   Tab C ──┘         ↓
//                  fan-out
//                ↙   ↓   ↘
//            Tab A  Tab B  Tab C
//
// Protocol:
//   PORT → WORKER:
//     { type: 'subscribe', symbol }
//     { type: 'unsubscribe', symbol }
//     { type: 'ingest', symbol, sourceId, price, timestamp }
//     { type: 'getStats' }
//
//   WORKER → PORT:
//     { type: 'update', symbol, data }
//     { type: 'stats', data }
//     { type: 'connected' }
//
// Fallback: If SharedWorker is not supported, the TickerPlant
// operates in direct mode (no cross-tab sharing).
// ═══════════════════════════════════════════════════════════════════

// Cross-tab data multiplexer via SharedWorker.
// Consolidates data streams so that N tabs don't open N WebSockets.
//
// Phase 9 Enhancement: Uses BinaryCodec (MessagePack) for compressed
// inter-tab messaging, reducing bandwidth by ~40-60%.
//
// Architecture:
//   - Each tab connects via port.start()
//   - Subscriptions are keyed by symbol
//   - Incoming data is cached (stale-while-revalidate)
//   - Updates are binary-encoded for efficient transfer
// ═══════════════════════════════════════════════════════════════════

// ─── Binary Codec (MessagePack) ────────────────────────────────
// Import BinaryCodec for compressed messaging between tabs
let BinaryCodec = null;
let binaryReady = false;
try {
  // Dynamic import in SharedWorker context
  import('./BinaryCodec.js').then(m => {
    BinaryCodec = m.BinaryCodec || m.default;
    binaryReady = true;
    logger.worker.info('[DataSharedWorker] BinaryCodec loaded — compressed messaging enabled');
  }).catch(() => {
    logger.worker.warn('[DataSharedWorker] BinaryCodec unavailable — using JSON fallback');
  });
// eslint-disable-next-line unused-imports/no-unused-vars
} catch (_) {
  // BinaryCodec not available, JSON fallback
}

// ─── Client Tracking ───────────────────────────────────────────

const clients = new Set();           // Set<MessagePort>
const subscriptions = new Map();      // symbol → Set<MessagePort>
const latestData = new Map();         // symbol → { price, timestamp, sourceId, ... }
let connectionCount = 0;

// ─── Cross-Tab Fetch Deduplication ─────────────────────────────
// key → { fetcher: MessagePort, waiters: Set<MessagePort> }
const inflightFetches = new Map();

// ─── Stats ─────────────────────────────────────────────────────

const stats = {
  totalClients: 0,
  totalSubscriptions: 0,
  totalUpdates: 0,
  savedConnections: 0,      // How many redundant WS connections we saved
  messagesRelayed: 0,
  bytesRelayed: 0,
  binaryBytesRelayed: 0,
  compressionEnabled: false,
  startTime: Date.now(),
};

// ─── Connection Handler ────────────────────────────────────────

self.onconnect = function(event) {
  const port = event.ports[0];
  clients.add(port);
  connectionCount++;
  stats.totalClients = clients.size;

  // Calculate saved connections (every client after the first = 1 saved)
  if (clients.size > 1) {
    stats.savedConnections = (clients.size - 1) * subscriptions.size;
  }

  port.onmessage = function(e) {
    const msg = e.data;

    switch (msg.type) {
      case 'subscribe': {
        const symbol = (msg.symbol || '').toUpperCase();
        if (!symbol) break;

        if (!subscriptions.has(symbol)) {
          subscriptions.set(symbol, new Set());
        }
        subscriptions.get(symbol).add(port);
        stats.totalSubscriptions++;

        // Send latest cached data immediately (stale-while-revalidate)
        const cached = latestData.get(symbol);
        if (cached) {
          port.postMessage({ type: 'update', symbol, data: cached });
        }

        port.postMessage({ type: 'subscribed', symbol });
        break;
      }

      case 'unsubscribe': {
        const symbol = (msg.symbol || '').toUpperCase();
        const subs = subscriptions.get(symbol);
        if (subs) {
          subs.delete(port);
          if (subs.size === 0) {
            subscriptions.delete(symbol);
            latestData.delete(symbol);
          }
        }
        break;
      }

      case 'ingest': {
        // A tab is sending us price data to fan out
        const symbol = (msg.symbol || '').toUpperCase();
        if (!symbol || !msg.price) break;

        const data = {
          price: msg.price,
          sourceId: msg.sourceId || 'unknown',
          timestamp: msg.timestamp || Date.now(),
          confidence: msg.confidence || 0,
          sourceCount: msg.sourceCount || 1,
          spread: msg.spread || 0,
        };

        latestData.set(symbol, data);
        stats.totalUpdates++;

        // Encode with BinaryCodec if available
        let encodedMsg;
        if (binaryReady && BinaryCodec) {
          try {
            const binaryPayload = BinaryCodec.encode({ type: 'update', symbol, data });
            encodedMsg = { type: 'binary_update', payload: binaryPayload };
            stats.binaryBytesRelayed += binaryPayload.byteLength || binaryPayload.length || 0;
            stats.compressionEnabled = true;
          } catch (error) {
            logger.worker.warn(`[DataSharedWorker] BinaryCodec encoding failed for ${symbol}:`, error, '— using JSON fallback');
            // Fallback to JSON
            encodedMsg = { type: 'update', symbol, data };
          }
        } else {
          encodedMsg = { type: 'update', symbol, data };
        }

        // Broadcast to all subscribers of this symbol (except sender)
        const subscribers = subscriptions.get(symbol);
        if (subscribers) {
          for (const subPort of subscribers) {
            if (subPort !== port) {
              try {
                subPort.postMessage(encodedMsg);
                stats.messagesRelayed++;
                // Approximate JSON size if not binary, otherwise binaryBytesRelayed tracks it
                if (!stats.compressionEnabled) {
                  stats.bytesRelayed += JSON.stringify(encodedMsg).length;
                }
              // eslint-disable-next-line unused-imports/no-unused-vars
              } catch (_) {
                // Port might be closed
                subscribers.delete(subPort);
                clients.delete(subPort);
              }
            }
          }
        }
        break;
      }

      case 'getStats': {
        port.postMessage({
          type: 'stats',
          data: {
            ...stats,
            uptime: Math.round((Date.now() - stats.startTime) / 1000),
            activeSymbols: subscriptions.size,
            clientCount: clients.size,
            subscriberCounts: Object.fromEntries(
              Array.from(subscriptions.entries()).map(([sym, subs]) => [sym, subs.size])
            ),
          },
        });
        break;
      }

      case 'ping': {
        port.postMessage({ type: 'pong', timestamp: Date.now() });
        break;
      }

      // ─── Cross-Tab Fetch Deduplication ───────────────────────
      case 'fetch-request': {
        // A tab wants to fetch OHLC data for a key (e.g. "BTC_1d")
        const key = msg.key;
        if (!key) break;

        const existing = inflightFetches.get(key);
        if (existing) {
          // Another tab is already fetching → queue this tab to wait
          existing.waiters.add(port);
          port.postMessage({ type: 'fetch-wait', key });
        } else {
          // No one is fetching → tell this tab to proceed
          inflightFetches.set(key, { fetcher: port, waiters: new Set() });
          port.postMessage({ type: 'fetch-proceed', key });
        }
        break;
      }

      case 'fetch-response': {
        // A tab has completed a fetch — relay result to all waiters
        const key = msg.key;
        if (!key) break;

        const entry = inflightFetches.get(key);
        if (entry) {
          for (const waiterPort of entry.waiters) {
            try {
              waiterPort.postMessage({
                type: 'fetch-result',
                key,
                data: msg.data,
                source: msg.source,
              });
              stats.messagesRelayed++;
            // eslint-disable-next-line unused-imports/no-unused-vars
            } catch (_) {
              // Port closed
              clients.delete(waiterPort);
            }
          }
          inflightFetches.delete(key);
        }
        break;
      }
    }
  };

  // Handle port disconnection
  port.onclose = function() {
    cleanup(port);
  };

  // Send connected confirmation
  port.postMessage({
    type: 'connected',
    clientId: connectionCount,
    totalClients: clients.size,
  });

  port.start();
};

// ─── Cleanup ───────────────────────────────────────────────────

function cleanup(port) {
  clients.delete(port);
  stats.totalClients = clients.size;

  // Remove from all subscriptions
  for (const [symbol, subs] of subscriptions) {
    subs.delete(port);
    if (subs.size === 0) {
      subscriptions.delete(symbol);
    }
  }

  // Clean up inflight fetch dedup entries
  for (const [key, entry] of inflightFetches) {
    entry.waiters.delete(port);
    if (entry.fetcher === port) {
      // The fetcher disconnected — notify waiters of failure
      for (const waiter of entry.waiters) {
        // eslint-disable-next-line unused-imports/no-unused-vars
        try { waiter.postMessage({ type: 'fetch-result', key, data: null, source: 'error' }); } catch (_) { /* storage may be blocked */ }
      }
      inflightFetches.delete(key);
    }
  }
}
