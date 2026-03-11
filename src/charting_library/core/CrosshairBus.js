import { logger } from '@/observability/logger';

// ═══════════════════════════════════════════════════════════════════
// charEdge — Crosshair Sync Bus
//
// Lightweight event bus that synchronises crosshair position
// across multiple chart panes (QuadChart, MTF panel, etc.).
// Uses BroadcastChannel where available, falls back to CustomEvent.
//
// Usage (producer):
//   CrosshairBus.emit({ barIdx, price, time, sourceId });
//
// Usage (consumer):
//   const unsub = CrosshairBus.on((data) => drawCrosshair(data));
//   // later …
//   unsub();
// ═══════════════════════════════════════════════════════════════════

const EVENT_NAME = 'charEdge:crosshair-sync';

let bc; // BroadcastChannel (if available)
try {
  if (typeof BroadcastChannel !== 'undefined') {
    bc = new BroadcastChannel('charEdge-crosshair');
  }
// eslint-disable-next-line unused-imports/no-unused-vars
} catch (_) {
  bc = null;
}

const listeners = new Set();

/** Subscribe to crosshair updates. Returns unsubscribe function. */
function on(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/** Emit crosshair update. Will propagate to all listeners. */
function emit(data) {
  // Notify local listeners
  for (const cb of listeners) {
    try { cb(data); } catch (e) { logger.engine.warn('Operation failed', e); }
  }

  // Notify other tabs / windows via BroadcastChannel
  if (bc) {
    // eslint-disable-next-line unused-imports/no-unused-vars
    try { bc.postMessage(data); } catch (_) { /* noop */ }
  }

  // Also dispatch a CustomEvent for legacy consumers
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: data }));
  }
}

/** Clear crosshair (mouse left chart). */
function clear(sourceId) {
  emit({ barIdx: -1, price: -1, time: null, sourceId, cleared: true });
}

// ─── Auto-receive from BroadcastChannel ──────────────────────────
if (bc) {
  bc.onmessage = (e) => {
    for (const cb of listeners) {
      try { cb(e.data); } catch (e) { logger.engine.warn('Operation failed', e); }
    }
  };
}

export const CrosshairBus = { on, emit, clear, EVENT_NAME };
export default CrosshairBus;
