// ═══════════════════════════════════════════════════════════════════
// charEdge — Adapter Circuit Breaker
//
// Circuit breaker pattern for data adapter resilience.
// Tracks success/failure per adapter and temporarily disables
// failing adapters to prevent cascading failures and wasted latency.
//
// Usage:
//   import { withCircuitBreaker, getCircuitState } from './AdapterCircuitBreaker.js';
//   const data = await withCircuitBreaker('binance', () => fetchBinance(sym, tfId));
// ═══════════════════════════════════════════════════════════════════

// ─── Configuration ──────────────────────────────────────────────
const WINDOW_SIZE = 10;          // Sliding window of calls to track
const FAILURE_THRESHOLD = 0.5;   // 50% failure rate triggers OPEN
const INITIAL_COOLDOWN_MS = 30_000;   // 30s initial cooldown
const MAX_COOLDOWN_MS = 300_000;      // 5min max cooldown

// ─── States ─────────────────────────────────────────────────────
const STATE = Object.freeze({
  CLOSED: 'CLOSED',       // Normal operation — all requests pass through
  OPEN: 'OPEN',           // Tripped — all requests short-circuit to null
  HALF_OPEN: 'HALF_OPEN', // Probing — one request allowed through
});

// ─── Per-adapter circuit state ──────────────────────────────────
const _circuits = new Map();

function _getCircuit(name) {
  if (!_circuits.has(name)) {
    _circuits.set(name, {
      state: STATE.CLOSED,
      results: [],           // sliding window: true = success, false = failure
      cooldownMs: INITIAL_COOLDOWN_MS,
      openedAt: 0,
      consecutiveTrips: 0,
      rateLimitUntil: 0,     // Timestamp until which this adapter is rate-limited
    });
  }
  return _circuits.get(name);
}

/**
 * Record a call result for the named adapter.
 * @param {string} name - Adapter name (e.g. 'binance', 'coingecko')
 * @param {boolean} success
 */
function _recordResult(name, success) {
  const circuit = _getCircuit(name);
  circuit.results.push(success);
  if (circuit.results.length > WINDOW_SIZE) {
    circuit.results.shift();
  }
}

/**
 * Calculate failure rate from the sliding window.
 * @param {string} name
 * @returns {number} 0..1
 */
function _failureRate(name) {
  const circuit = _getCircuit(name);
  if (circuit.results.length < 3) return 0; // Not enough data to judge
  const failures = circuit.results.filter((r) => !r).length;
  return failures / circuit.results.length;
}

/**
 * Wrap an async fetch function with a circuit breaker.
 *
 * @param {string} adapterName - e.g. 'binance', 'coingecko'
 * @param {Function} fetchFn - async () => data | null
 * @returns {Promise<any|null>} The fetch result, or null if circuit is open
 */
export async function withCircuitBreaker(adapterName, fetchFn) {
  const circuit = _getCircuit(adapterName);
  const now = Date.now();

  // ── OPEN state: check if cooldown has elapsed ──────────────────
  if (circuit.state === STATE.OPEN) {
    if (now - circuit.openedAt < circuit.cooldownMs) {
      // Still cooling down — skip this adapter
      return null;
    }
    // Cooldown elapsed → transition to HALF_OPEN (probe)
    circuit.state = STATE.HALF_OPEN;
  }

  // ── Rate limit check: skip if still within Retry-After window ─
  if (circuit.rateLimitUntil > now) {
    return null;
  }

  // ── Execute the fetch ─────────────────────────────────────────
  try {
    const result = await fetchFn();
    const success = result !== null && result !== undefined;
    _recordResult(adapterName, success);

    if (circuit.state === STATE.HALF_OPEN) {
      if (success) {
        // Probe succeeded → CLOSED
        circuit.state = STATE.CLOSED;
        circuit.cooldownMs = INITIAL_COOLDOWN_MS;
        circuit.consecutiveTrips = 0;
      } else {
        // Probe failed → OPEN again with doubled cooldown
        circuit.state = STATE.OPEN;
        circuit.openedAt = now;
        circuit.consecutiveTrips++;
        circuit.cooldownMs = Math.min(
          circuit.cooldownMs * 2,
          MAX_COOLDOWN_MS,
        );
      }
    } else if (circuit.state === STATE.CLOSED) {
      // Check if we should trip the breaker
      if (_failureRate(adapterName) >= FAILURE_THRESHOLD) {
        circuit.state = STATE.OPEN;
        circuit.openedAt = now;
        circuit.consecutiveTrips++;
        if (circuit.consecutiveTrips > 1) {
          circuit.cooldownMs = Math.min(
            circuit.cooldownMs * 2,
            MAX_COOLDOWN_MS,
          );
        }
      }
    }

    return result;
  } catch (err) {
    // Don't trip circuit on rate limits — respect Retry-After
    if (err?.status === 429) {
      const retryAfter = err.retryAfterMs || 60_000;
      circuit.rateLimitUntil = now + retryAfter;
      return null;
    }

    _recordResult(adapterName, false);

    if (circuit.state === STATE.HALF_OPEN) {
      circuit.state = STATE.OPEN;
      circuit.openedAt = now;
      circuit.consecutiveTrips++;
      circuit.cooldownMs = Math.min(circuit.cooldownMs * 2, MAX_COOLDOWN_MS);
    } else if (_failureRate(adapterName) >= FAILURE_THRESHOLD) {
      circuit.state = STATE.OPEN;
      circuit.openedAt = now;
      circuit.consecutiveTrips++;
      if (circuit.consecutiveTrips > 1) {
        circuit.cooldownMs = Math.min(circuit.cooldownMs * 2, MAX_COOLDOWN_MS);
      }
    }

    return null;
  }
}

/**
 * Get the current state of a circuit breaker.
 * @param {string} adapterName
 * @returns {{ state: string, failureRate: number, cooldownMs: number, consecutiveTrips: number }}
 */
export function getCircuitState(adapterName) {
  const circuit = _getCircuit(adapterName);
  return {
    state: circuit.state,
    failureRate: _failureRate(adapterName),
    cooldownMs: circuit.cooldownMs,
    consecutiveTrips: circuit.consecutiveTrips,
  };
}

/**
 * Get all circuit breaker states (for debugging / settings panel).
 * @returns {Object<string, { state, failureRate, cooldownMs, consecutiveTrips }>}
 */
export function getAllCircuitStates() {
  const result = {};
  for (const [name] of _circuits) {
    result[name] = getCircuitState(name);
  }
  return result;
}

/**
 * Reset a specific circuit breaker to CLOSED state.
 * @param {string} adapterName
 */
export function resetCircuit(adapterName) {
  _circuits.delete(adapterName);
}

/**
 * Reset all circuit breakers.
 */
export function resetAllCircuits() {
  _circuits.clear();
}

export { STATE };
export default { withCircuitBreaker, getCircuitState, getAllCircuitStates, resetCircuit, resetAllCircuits, STATE };
