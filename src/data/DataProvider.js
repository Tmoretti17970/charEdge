// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — DataProvider (Barrel Index)
//
// Re-exports from focused provider modules. All existing consumers
// continue importing from './DataProvider.js' with zero changes.
//
// Architecture (post-H1.3 cleanup):
//   providers/ApiKeyStore.js      — API key CRUD
//   providers/PolygonProvider.js   — Polygon REST + WS adapter
//   providers/AlphaVantageProvider.js — Alpha Vantage REST
//   providers/WSRouter.js          — Multi-provider WS routing
//   providers/ProviderRegistry.js  — Provider chain + status
// ═══════════════════════════════════════════════════════════════════

// ─── Provider modules ───────────────────────────────────────────
export { getApiKey, setApiKey, hasApiKey, initApiKeys } from './providers/ApiKeyStore.js';
export { fetchAlpaca } from './providers/AlpacaProvider.js';
export { fetchPolygon, createPolygonWSAdapter } from './providers/PolygonProvider.js';
export { fetchAlphaVantage } from './providers/AlphaVantageProvider.js';
export { WSRouter, wsRouter, createPythWSAdapter, createKrakenWSAdapter } from './providers/WSRouter.js';
export { fetchEquityPremium, fetchPythQuote, getProviderStatus } from './providers/ProviderRegistry.js';

// ─── Adapter re-exports ─────────────────────────────────────────
export { pythAdapter } from './adapters/PythAdapter.js';
export { krakenAdapter } from './adapters/KrakenAdapter.js';
export { edgarAdapter } from './adapters/EdgarAdapter.js';
export { fredAdapter } from './adapters/FredAdapter.js';
export { sentimentAdapter } from './adapters/SentimentAdapter.js';
export { frankfurterAdapter } from './adapters/FrankfurterAdapter.js';
export { fmpAdapter } from './adapters/FMPAdapter.js';
export { tiingoAdapter } from './adapters/TiingoAdapter.js';
export { whaleAlertAdapter } from './adapters/WhaleAlertAdapter.js';
export { newsAggregator } from './NewsAggregator.js';
export { derivedEngine } from './DerivedDataEngine.js';
export { dataCache } from './DataCache.ts';
export { cacheManager } from './engine/infra/CacheManager.js';

// ─── Engine re-exports ──────────────────────────────────────────
export { orderFlowEngine } from './engine/orderflow/OrderFlowEngine.ts';
export { volumeProfileEngine } from './engine/orderflow/VolumeProfileEngine.js';
export { orderFlowBridge } from './engine/orderflow/OrderFlowBridge.js';
export { indicators } from './engine/indicators/IndicatorLibrary.js';
export { binanceFuturesAdapter } from './adapters/BinanceFuturesAdapter.js';
export { depthEngine } from './engine/orderflow/DepthEngine.ts';

// ─── Orderflow ──────────────────────────────────────────────────
export { getTradeHeatmapEngine } from './engine/orderflow/TradeHeatmapEngine.js';

