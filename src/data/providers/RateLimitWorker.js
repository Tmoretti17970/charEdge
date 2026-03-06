// ═══════════════════════════════════════════════════════════════════
// charEdge — Cross-Tab Rate Limit Worker (Task 2.10.2.2)
//
// SharedWorker that maintains a cross-tab RateBudget registry.
// Prevents multi-tab rate exhaustion across Polygon/FMP/AV/Binance.
//
// Protocol:
//   Client → Worker: { type: 'REQUEST', providerId: string }
//   Worker → Client: { type: 'GRANTED' | 'DENIED', providerId: string, remaining: number }
//
// Falls back gracefully — if SharedWorker is unavailable (Safari < 16,
// some mobile browsers), per-tab rate budgets from CircuitBreaker
// continue to function independently.
// ═══════════════════════════════════════════════════════════════════

// ─── Budget Definitions (shared with ProviderOrchestrator) ──────

const BUDGETS = {
    polygon: { maxRequests: 5, windowMs: 60_000 },
    fmp: { maxRequests: 250, windowMs: 86_400_000 },
    alphavantage: { maxRequests: 25, windowMs: 86_400_000 },
    tiingo: { maxRequests: 50, windowMs: 3_600_000 },
    binance: { maxRequests: 1200, windowMs: 60_000 },
};

// ─── Per-Provider State ─────────────────────────────────────────

const state = {};
for (const [id, budget] of Object.entries(BUDGETS)) {
    state[id] = {
        currentCount: 0,
        windowStart: Date.now(),
        ...budget,
    };
}

// ─── Reset Window If Elapsed ────────────────────────────────────

function maybeResetWindow(providerId) {
    const s = state[providerId];
    if (!s) return;
    const now = Date.now();
    if (now - s.windowStart >= s.windowMs) {
        s.currentCount = 0;
        s.windowStart = now;
    }
}

// ─── Handle Client Messages ─────────────────────────────────────

function handleMessage(port, msg) {
    const { type, providerId } = msg;

    if (type === 'REQUEST') {
        maybeResetWindow(providerId);
        const s = state[providerId];

        if (!s) {
            // Unknown provider — allow (no budget tracking)
            port.postMessage({ type: 'GRANTED', providerId, remaining: Infinity });
            return;
        }

        if (s.currentCount >= s.maxRequests) {
            port.postMessage({
                type: 'DENIED',
                providerId,
                remaining: 0,
                retryAfterMs: s.windowMs - (Date.now() - s.windowStart),
            });
            return;
        }

        s.currentCount++;
        port.postMessage({
            type: 'GRANTED',
            providerId,
            remaining: Math.max(0, s.maxRequests - s.currentCount),
        });
        return;
    }

    if (type === 'QUERY') {
        maybeResetWindow(providerId);
        const s = state[providerId];
        port.postMessage({
            type: 'BUDGET_STATUS',
            providerId,
            remaining: s ? Math.max(0, s.maxRequests - s.currentCount) : Infinity,
            max: s?.maxRequests ?? 0,
            used: s?.currentCount ?? 0,
        });
        return;
    }

    if (type === 'QUERY_ALL') {
        const result = {};
        for (const id of Object.keys(state)) {
            maybeResetWindow(id);
            const s = state[id];
            result[id] = {
                remaining: Math.max(0, s.maxRequests - s.currentCount),
                max: s.maxRequests,
                used: s.currentCount,
            };
        }
        port.postMessage({ type: 'ALL_BUDGETS', budgets: result });
        return;
    }
}

// ─── SharedWorker Entry Point ───────────────────────────────────

// This file is loaded as a SharedWorker:
//   const worker = new SharedWorker(new URL('./RateLimitWorker.js', import.meta.url))
//   worker.port.postMessage({ type: 'REQUEST', providerId: 'polygon' })

// eslint-disable-next-line no-restricted-globals
self.onconnect = function (e) {
    const port = e.ports[0];
    port.onmessage = (event) => handleMessage(port, event.data);
    port.start();
};
