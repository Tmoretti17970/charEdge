// ═══════════════════════════════════════════════════════════════════
// charEdge — TickerPlant Type Definitions
// Shared interfaces and types used by the TickerPlant subsystem.
// ═══════════════════════════════════════════════════════════════════

/** Incoming price data from a source adapter callback. */
export interface PriceUpdate {
    price: number;
    timestamp: number;
    confidence: number;
    volume: number;
}

/** Callback type for price update subscriptions. */
export type PriceCallback = (data: PriceUpdate) => void;

/** Contract for external data source adapters. */
export interface SourceAdapter {
    id: string;
    name: string;
    assetClasses: string[];
    available: boolean;
    subscribe: ((symbol: string, callback: PriceCallback) => unknown) | null;
    fetchQuote?: ((symbol: string) => Promise<QuoteResult | null>) | null;
    supports?: (symbol: string) => boolean;
}

/** Result of a single-quote fetch. */
export interface QuoteResult {
    price: number;
    confidence: number;
    source?: string;
}

/** Tracked watch entry for a symbol. */
export interface WatchEntry {
    unsubs: (() => void)[];
    active: boolean;
}

/** Per-source health tracking data. */
export interface AdapterHealthData {
    lastUpdate: number;
    errors: number;
    successes: number;
    lastPrice: number;
    consecutiveStale: number;
    avgLatencyMs: number;
}

/** Bandwidth tracking counters. */
export interface BandwidthCounters {
    jsonBytesIn: number;
    binaryBytesOut: number;
    messagesProcessed: number;
    startTime: number;
}

/** Bandwidth metrics returned by getBandwidthMetrics(). */
export interface BandwidthMetrics {
    jsonBytesIn: number;
    binaryBytesOut: number;
    messagesProcessed: number;
    uptimeSeconds: number;
    avgMessageRate: string;
    savings: string;
}

/** Per-source health status with computed score. */
export interface SourceHealthStatus {
    score: number;
    level: 'healthy' | 'degraded' | 'unhealthy';
    lastUpdate: number | null;
    freshness: number | null;
    errors: number;
    successes: number;
    errorRate: number;
    consecutiveStale: number;
    avgLatencyMs: number;
}

/** Full source status entry. */
export interface SourceStatus {
    name: string;
    available: boolean;
    assetClasses: string[];
    hasStreaming: boolean;
    hasRest: boolean;
    health: SourceHealthStatus;
}

/** Overall health status of the ticker plant. */
export interface HealthStatus {
    running: boolean;
    sources: Record<string, SourceStatus>;
    watchedSymbols: string[];
    aggregator: unknown;
    bandwidth: BandwidthMetrics;
}

/** Bandwidth benchmark result per message type. */
export interface BenchmarkResult {
    candle: unknown;
    tick: unknown;
    quote: unknown;
    candleBatch200: unknown;
}

/** SharedWorker message envelope. */
export interface SharedWorkerMessage {
    type: string;
    clientId?: number;
    totalClients?: number;
    symbol?: string;
    sourceId?: string;
    price?: number;
    timestamp?: number;
    data?: {
        sourceId: string;
        price: number;
        timestamp: number;
        confidence: number;
    };
}
