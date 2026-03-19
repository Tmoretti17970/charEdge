// ═══════════════════════════════════════════════════════════════════
// charEdge — Background Data Worker (Sprint 66)
//
// Web Worker for off-main-thread data refresh:
//   - Sparkline data (60s interval)
//   - Fundamental data (300s interval)
//   - News feeds (600s interval)
//
// Avoids blocking UI during heavy data fetches.
// ═══════════════════════════════════════════════════════════════════

const SPARKLINE_INTERVAL = 60_000;     // 1 min
const FUNDAMENTALS_INTERVAL = 300_000; // 5 min
const NEWS_INTERVAL = 600_000;         // 10 min

let sparklineTimer = null;
let fundamentalsTimer = null;
let newsTimer = null;
let watchlistSymbols = [];

// ─── Message Handler ────────────────────────────────────────────

self.onmessage = function (e) {
  const { type, payload } = e.data;

  switch (type) {
    case 'init':
      watchlistSymbols = payload.symbols || [];
      startTimers();
      break;

    case 'updateSymbols':
      watchlistSymbols = payload.symbols || [];
      break;

    case 'stop':
      stopTimers();
      break;

    case 'refreshNow':
      if (payload.target === 'sparklines') fetchSparklines();
      else if (payload.target === 'fundamentals') fetchFundamentals();
      else if (payload.target === 'news') fetchNews();
      break;
  }
};

// ─── Timer Management ───────────────────────────────────────────

function startTimers() {
  stopTimers();

  // Stagger initial fetches to avoid burst
  setTimeout(fetchSparklines, 500);
  setTimeout(fetchFundamentals, 2000);
  setTimeout(fetchNews, 5000);

  sparklineTimer = setInterval(fetchSparklines, SPARKLINE_INTERVAL);
  fundamentalsTimer = setInterval(fetchFundamentals, FUNDAMENTALS_INTERVAL);
  newsTimer = setInterval(fetchNews, NEWS_INTERVAL);

  self.postMessage({ type: 'status', status: 'running' });
}

function stopTimers() {
  if (sparklineTimer) clearInterval(sparklineTimer);
  if (fundamentalsTimer) clearInterval(fundamentalsTimer);
  if (newsTimer) clearInterval(newsTimer);
  sparklineTimer = null;
  fundamentalsTimer = null;
  newsTimer = null;

  self.postMessage({ type: 'status', status: 'stopped' });
}

// ─── Data Fetchers ──────────────────────────────────────────────

async function fetchSparklines() {
  if (!watchlistSymbols.length) return;

  // Request sparkline data from main thread (uses QuoteService unified cache)
  // This avoids N+1 direct CoinGecko fetches that bypass all caching layers.
  // The main thread handler should call batchGetQuotes() and post results back.
  self.postMessage({
    type: 'requestSparklines',
    symbols: watchlistSymbols,
  });
}

async function fetchFundamentals() {
  if (!watchlistSymbols.length) return;

  try {
    // Sprint 1 Task 1.3.1: Batch all symbols into a single CoinGecko /simple/price call
    // instead of N individual /coins/{id} requests.
    const coinIdMap = {};
    const CRYPTO_IDS = {
      BTC: 'bitcoin', ETH: 'ethereum', BNB: 'binancecoin', SOL: 'solana',
      DOGE: 'dogecoin', ADA: 'cardano', XRP: 'ripple', DOT: 'polkadot',
      AVAX: 'avalanche-2', MATIC: 'matic-network', LINK: 'chainlink',
      UNI: 'uniswap', ATOM: 'cosmos', LTC: 'litecoin', NEAR: 'near',
      APT: 'aptos', ARB: 'arbitrum', OP: 'optimism', SUI: 'sui',
    };

    for (const sym of watchlistSymbols.slice(0, 25)) {
      const base = sym.toUpperCase().replace(/(USDT|BUSD|USDC|USD)$/, '');
      const coinId = CRYPTO_IDS[base];
      if (coinId) coinIdMap[coinId] = sym;
    }

    const coinIds = Object.keys(coinIdMap);
    if (coinIds.length === 0) return;

    // Single batched request → 1 API call instead of N
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds.join(',')}&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });

    if (!res.ok) return;
    const data = await res.json();

    const results = {};
    for (const [coinId, info] of Object.entries(data)) {
      const originalSymbol = coinIdMap[coinId];
      if (!originalSymbol || !info) continue;
      results[originalSymbol] = {
        marketCap: info.usd_market_cap,
        volume24h: info.usd_24h_vol,
        change24h: info.usd_24h_change,
        price: info.usd,
        timestamp: Date.now(),
      };
    }

    if (Object.keys(results).length > 0) {
      self.postMessage({ type: 'fundamentals', data: results });
    }
  } catch (err) {
    self.postMessage({ type: 'error', target: 'fundamentals', error: err.message });
  }
}

async function fetchNews() {
  try {
    // Crypto news from free RSS proxy
    const res = await fetch(
      'https://min-api.cryptocompare.com/data/v2/news/?lang=EN&sortOrder=popular',
      { signal: AbortSignal.timeout(8000) }
    );

    if (res.ok) {
      const data = await res.json();
      const articles = (data.Data || []).slice(0, 20).map(a => ({
        title: a.title,
        source: a.source,
        url: a.url,
        imageUrl: a.imageurl,
        publishedAt: a.published_on * 1000,
        categories: a.categories,
      }));

      self.postMessage({ type: 'news', data: articles });
    }
  } catch (err) {
    self.postMessage({ type: 'error', target: 'news', error: err.message });
  }
}
