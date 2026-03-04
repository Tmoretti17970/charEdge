// ═══════════════════════════════════════════════════════════════════
// charEdge — useSharedHistory (Sprint 2)
//
// Client-side hook that routes history page requests through
// DataSharedWorker for cross-tab dedup when available.
// Falls back to direct fetchOHLCPage when SharedWorker is unsupported.
//
// Usage:
//   import { fetchPageViaWorker } from './useSharedHistory.js';
//   const result = await fetchPageViaWorker(sym, tf, beforeTime);
// ═══════════════════════════════════════════════════════════════════

let _worker = null;
let _workerFailed = false;

/**
 * Lazy-connect to the DataSharedWorker.
 * @returns {SharedWorker|null}
 */
function _getWorker() {
  if (_workerFailed) return null;
  if (_worker) return _worker;
  try {
    if (typeof SharedWorker === 'undefined') { _workerFailed = true; return null; }
    _worker = new SharedWorker(
      new URL('./DataSharedWorker.js', import.meta.url),
      { name: 'charEdge-data', type: 'module' }
    );
    _worker.port.start();
    return _worker;
  } catch {
    _workerFailed = true;
    return null;
  }
}

/**
 * Pending fetch resolution map.
 * key → { resolve, reject, timer }
 * @type {Map<string, {resolve: Function, reject: Function, timer: number}>}
 */
const _pending = new Map();

/**
 * Fetch a history page via SharedWorker dedup.
 * If SharedWorker is unavailable, falls back to direct fetch.
 *
 * @param {string} sym      - Symbol (e.g., 'BTCUSDT')
 * @param {string} tfId     - Timeframe ID (e.g., '1h')
 * @param {number|string} beforeTime - Fetch bars before this timestamp
 * @returns {Promise<{ data: Array, hasMore: boolean }>}
 */
export async function fetchPageViaWorker(sym, tfId, beforeTime) {
  const worker = _getWorker();

  // Fallback to direct fetch if SharedWorker unavailable
  if (!worker) {
    const { fetchOHLCPage } = await import('../../FetchService.js');
    return fetchOHLCPage(sym, tfId, beforeTime);
  }

  const key = `page:${sym}:${tfId}:${beforeTime}`;

  // If already pending for this key, return existing promise
  if (_pending.has(key)) {
    return new Promise((resolve, reject) => {
      const existing = _pending.get(key);
      const origResolve = existing.resolve;
      existing.resolve = (val) => { origResolve(val); resolve(val); };
    });
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      // Timeout after 15s — fall back to direct fetch
      _pending.delete(key);
      import('../../FetchService.js').then(({ fetchOHLCPage }) => {
        fetchOHLCPage(sym, tfId, beforeTime).then(resolve).catch(reject);
      });
    }, 15000);

    _pending.set(key, { resolve, reject, timer });

    // Listen for worker responses
    const handler = (e) => {
      const msg = e.data;
      if (msg.type === 'fetch-proceed' && msg.key === key) {
        // We are the designated fetcher — do the actual fetch
        import('../../FetchService.js').then(({ fetchOHLCPage }) => {
          fetchOHLCPage(sym, tfId, beforeTime).then((result) => {
            // Tell the worker we're done (so other tabs get the result)
            worker.port.postMessage({
              type: 'fetch-response',
              key,
              data: result.data,
              source: 'fetched',
            });
            clearTimeout(timer);
            _pending.delete(key);
            worker.port.removeEventListener('message', handler);
            resolve(result);
          }).catch((err) => {
            clearTimeout(timer);
            _pending.delete(key);
            worker.port.removeEventListener('message', handler);
            reject(err);
          });
        });
      } else if (msg.type === 'fetch-result' && msg.key === key) {
        // Another tab fetched the data — use their result
        clearTimeout(timer);
        _pending.delete(key);
        worker.port.removeEventListener('message', handler);
        if (msg.data) {
          resolve({ data: msg.data, hasMore: msg.data.length >= 500 });
        } else {
          // Fallback to direct fetch on error
          import('../../FetchService.js').then(({ fetchOHLCPage }) => {
            fetchOHLCPage(sym, tfId, beforeTime).then(resolve).catch(reject);
          });
        }
      } else if (msg.type === 'fetch-wait' && msg.key === key) {
        // Another tab is fetching — just wait for the result
      }
    };

    worker.port.addEventListener('message', handler);
    worker.port.postMessage({ type: 'fetch-request', key });
  });
}

export default fetchPageViaWorker;
