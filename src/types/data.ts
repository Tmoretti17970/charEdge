// ═══════════════════════════════════════════════════════════════════
// charEdge — Data Type Definitions
//
// Phase 2 Task 2.1.2: Type ALL data boundaries.
// Canonical type definitions for all data flowing through the app.
// ═══════════════════════════════════════════════════════════════════

// ─── OHLC / Bar Data ─────────────────────────────────────────────

/** Single OHLCV bar (candlestick) */
export interface Bar {
  /** Unix timestamp in milliseconds */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** Real-time price tick from a market data adapter */
export interface Tick {
  time: number;
  price: number;
  size: number;
  side: 'buy' | 'sell' | 'unknown';
}

/** Individual market trade (order flow / tape) */
export interface MarketTrade {
  id: string;
  time: number;
  price: number;
  qty: number;
  isBuyer: boolean;
  /** Source adapter that produced this trade */
  source?: AdapterName;
}

/** Known data adapter names */
export type AdapterName = 'binance' | 'polygon' | 'itick' | 'dukascopy' | 'mock';

// ─── Runtime Validators (always-on for data integrity) ──────────

/** Validate a bar has all required numeric fields. */
export function validateBar(bar: unknown, source?: string): bar is Bar {
  if (!bar || typeof bar !== 'object') {
    console.warn(`[validateBar] Invalid bar from ${source || 'unknown'}:`, bar);
    return false;
  }
  const b = bar as Record<string, unknown>;
  const requiredFields = ['time', 'open', 'high', 'low', 'close', 'volume'];
  for (const f of requiredFields) {
    if (typeof b[f] !== 'number' || Number.isNaN(b[f])) {
      console.warn(`[validateBar] Missing/NaN field "${f}" from ${source || 'unknown'}:`, bar);
      return false;
    }
  }
  return true;
}

/** Validate a tick has required fields. */
export function validateTick(tick: unknown, _source?: string): tick is Tick {
  if (!tick || typeof tick !== 'object') return false;
  const t = tick as Record<string, unknown>;
  return typeof t.time === 'number' && typeof t.price === 'number' && typeof t.size === 'number';
}

/** Typed array representation for GPU/perf-critical paths */
export interface BarArrays {
  times: Float64Array;
  opens: Float64Array;
  highs: Float64Array;
  lows: Float64Array;
  closes: Float64Array;
  volumes: Float64Array;
  length: number;
}

/** Timeframe identifiers */
export type Timeframe =
  | '1s'
  | '5s'
  | '15s'
  | '30s'
  | '1m'
  | '3m'
  | '5m'
  | '15m'
  | '30m'
  | '1h'
  | '2h'
  | '4h'
  | '6h'
  | '8h'
  | '12h'
  | '1D'
  | '3D'
  | '1W'
  | '1M';

// ─── Trade Data ──────────────────────────────────────────────────

export type TradeSide = 'long' | 'short';
export type TradeStatus = 'open' | 'closed';

export interface Trade {
  id: string;
  symbol: string;
  side: TradeSide;
  status: TradeStatus;
  entryPrice: number;
  exitPrice?: number;
  quantity?: number;
  entryDate: string; // ISO 8601
  exitDate?: string;
  fees?: number;
  pnl?: number;
  notes?: string;
  tags?: string[];
  strategy?: string;
  emotion?: string;
  screenshots?: string[];
  createdAt: string;
  updatedAt: string;
  /** Money migration version (set by migrateAllTrades) */
  _moneyV?: number;
}

// ─── Playbook ────────────────────────────────────────────────────

export interface PlaybookRule {
  id: string;
  label: string;
  required?: boolean;
}

export interface Playbook {
  id: string;
  name: string;
  description?: string;
  rules?: PlaybookRule[];
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

// ─── Journal Note ────────────────────────────────────────────────

export interface Note {
  id: string;
  title: string;
  content: string;
  tags?: string[];
  mood?: string;
  date?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Trade Plan ──────────────────────────────────────────────────

export type PlanStatus = 'draft' | 'active' | 'completed' | 'cancelled';

export interface TradePlan {
  id: string;
  symbol: string;
  direction?: TradeSide;
  thesis?: string;
  entry?: {
    price?: number;
    condition?: string;
  };
  exit?: {
    target?: number;
    stopLoss?: number;
    condition?: string;
  };
  riskReward?: number;
  status: PlanStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Storage Results ─────────────────────────────────────────────

export interface StorageResult<T> {
  ok: boolean;
  data: T;
  error?: string;
}

// ─── Analytics ───────────────────────────────────────────────────

export interface AnalyticsResult {
  tradeCount: number;
  totalPnl: number;
  winRate: number;
  winCount: number;
  lossCount: number;
  pf: number; // profit factor
  maxDd: number; // max drawdown %
  avgWin: number;
  avgLoss: number;
  expectancy: number;
  sharpe?: number;
  sortino?: number;
  calmar?: number;
  bestTrade?: Trade;
  worstTrade?: Trade;
  streaks: {
    currentWin: number;
    currentLoss: number;
    maxWin: number;
    maxLoss: number;
  };
}

// ─── User Settings ───────────────────────────────────────────────

export interface UserSettings {
  theme: 'dark' | 'light' | 'system';
  density: 'compact' | 'comfortable' | 'spacious';
  defaultSymbol: string;
  defaultTimeframe: Timeframe;
  currency: string;
  locale: string;
  simpleMode: boolean;
  enabledFeatures: Record<string, boolean>;
}

// ─── API Response ────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  meta?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
    details?: Array<{ path: string; message: string; code: string }>;
  };
}
