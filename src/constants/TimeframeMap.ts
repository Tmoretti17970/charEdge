// ═══════════════════════════════════════════════════════════════════
// charEdge — Canonical Timeframe Map
//
// Central registry for all supported timeframes. Replaces the
// hardcoded BINANCE_TF_MAP in ChartEngineWidget.
//
// Each entry maps a canonical key to:
//   - seconds:  duration in seconds
//   - label:    human-readable display label
//   - group:    intraday | daily | weekly | monthly
//   - adapters: per-exchange format (binance, polygon, etc.)
//
// Usage:
//   import { CANONICAL_TIMEFRAMES, resolveAdapterTimeframe } from './TimeframeMap';
//   const binanceTf = resolveAdapterTimeframe('1h', 'binance'); // '1h'
//   const info = CANONICAL_TIMEFRAMES['4h']; // { seconds: 14400, label: '4 hour', ... }
// ═══════════════════════════════════════════════════════════════════

export interface TimeframeInfo {
  seconds: number;
  label: string;
  group: 'intraday' | 'daily' | 'weekly' | 'monthly';
  adapters: {
    binance: string;
    polygon?: string;
  };
}

export const CANONICAL_TIMEFRAMES: Record<string, TimeframeInfo> = {
  '1m':  { seconds: 60,       label: '1 min',    group: 'intraday', adapters: { binance: '1m',  polygon: '1/minute'  } },
  '3m':  { seconds: 180,      label: '3 min',    group: 'intraday', adapters: { binance: '3m',  polygon: '3/minute'  } },
  '5m':  { seconds: 300,      label: '5 min',    group: 'intraday', adapters: { binance: '5m',  polygon: '5/minute'  } },
  '15m': { seconds: 900,      label: '15 min',   group: 'intraday', adapters: { binance: '15m', polygon: '15/minute' } },
  '30m': { seconds: 1800,     label: '30 min',   group: 'intraday', adapters: { binance: '30m', polygon: '30/minute' } },
  '1h':  { seconds: 3600,     label: '1 hour',   group: 'intraday', adapters: { binance: '1h',  polygon: '1/hour'    } },
  '2h':  { seconds: 7200,     label: '2 hour',   group: 'intraday', adapters: { binance: '2h',  polygon: '2/hour'    } },
  '4h':  { seconds: 14400,    label: '4 hour',   group: 'intraday', adapters: { binance: '4h',  polygon: '4/hour'    } },
  '6h':  { seconds: 21600,    label: '6 hour',   group: 'intraday', adapters: { binance: '6h'  } },
  '8h':  { seconds: 28800,    label: '8 hour',   group: 'intraday', adapters: { binance: '8h'  } },
  '12h': { seconds: 43200,    label: '12 hour',  group: 'intraday', adapters: { binance: '12h' } },
  '1D':  { seconds: 86400,    label: '1 day',    group: 'daily',    adapters: { binance: '1d',  polygon: '1/day'     } },
  '1d':  { seconds: 86400,    label: '1 day',    group: 'daily',    adapters: { binance: '1d',  polygon: '1/day'     } },
  '3D':  { seconds: 259200,   label: '3 day',    group: 'daily',    adapters: { binance: '3d',  polygon: '3/day'     } },
  '3d':  { seconds: 259200,   label: '3 day',    group: 'daily',    adapters: { binance: '3d',  polygon: '3/day'     } },
  '1W':  { seconds: 604800,   label: '1 week',   group: 'weekly',   adapters: { binance: '1w',  polygon: '1/week'    } },
  '1w':  { seconds: 604800,   label: '1 week',   group: 'weekly',   adapters: { binance: '1w',  polygon: '1/week'    } },
  '1M':  { seconds: 2592000,  label: '1 month',  group: 'monthly',  adapters: { binance: '1M',  polygon: '1/month'   } },
};

export type CanonicalTimeframe = keyof typeof CANONICAL_TIMEFRAMES;
export type AdapterType = 'binance' | 'polygon';

/**
 * Resolve a canonical timeframe to a specific adapter format.
 * Falls back to the canonical key if no adapter mapping exists.
 */
export function resolveAdapterTimeframe(canonical: string, adapter: AdapterType): string {
  const info = CANONICAL_TIMEFRAMES[canonical];
  if (!info) return canonical;
  return info.adapters[adapter] || canonical;
}

/**
 * Get timeframe info by canonical key.
 */
export function getTimeframeInfo(canonical: string): TimeframeInfo | null {
  return CANONICAL_TIMEFRAMES[canonical] || null;
}

/**
 * Get all timeframes in a given group.
 */
export function getTimeframesByGroup(group: TimeframeInfo['group']): string[] {
  return Object.entries(CANONICAL_TIMEFRAMES)
    .filter(([, info]) => info.group === group)
    .map(([key]) => key);
}
