// ═══════════════════════════════════════════════════════════════════
// DepthEngine — Constants, Exchange Adapters, Utilities
// ═══════════════════════════════════════════════════════════════════

const BINANCE_WS = 'wss://data-stream.binance.vision/ws';
const BYBIT_WS = 'wss://stream.bybit.com/v5/public/spot';
const KRAKEN_WS = 'wss://ws.kraken.com';

export const MAX_LEVELS = 100;

export const EXCHANGE_ADAPTERS = {
  binance: {
    buildUrl: (symbol, levels, updateMs) =>
      `${BINANCE_WS}/${symbol.toLowerCase()}@depth${levels}@${updateMs}ms`,
    parseMessage: (data) => ({ bids: data.bids || [], asks: data.asks || [] }),
    subscribeMsg: null,
  },
  bybit: {
    buildUrl: () => BYBIT_WS,
    parseMessage: (data) => {
      const d = data.data || data;
      return {
        bids: (d.b || []).map(([p, q]) => [p, q]),
        asks: (d.a || []).map(([p, q]) => [p, q]),
      };
    },
    subscribeMsg: (symbol) => JSON.stringify({
      op: 'subscribe',
      args: [`orderbook.25.${symbol.toUpperCase()}`],
    }),
  },
  kraken: {
    buildUrl: () => KRAKEN_WS,
    parseMessage: (data) => {
      if (Array.isArray(data) && data.length >= 2) {
        const payload = data[1];
        return {
          bids: (payload.bs || payload.b || []).map(([p, v]) => [p, v]),
          asks: (payload.as || payload.a || []).map(([p, v]) => [p, v]),
        };
      }
      return { bids: [], asks: [] };
    },
    subscribeMsg: (symbol) => JSON.stringify({
      event: 'subscribe',
      pair: [symbol.toUpperCase().replace('USDT', '/USDT')],
      subscription: { name: 'book', depth: 25 },
    }),
  },
};

export function detectExchange(symbol) {
  const upper = (symbol || '').toUpperCase();
  if (upper.includes(':BYBIT') || upper.startsWith('BYBIT:')) return 'bybit';
  if (upper.includes(':KRAKEN') || upper.startsWith('KRAKEN:')) return 'kraken';
  return 'binance';
}

export function cleanSymbol(symbol) {
  return (symbol || '').replace(/^(BINANCE|BYBIT|KRAKEN):/i, '').toUpperCase();
}

// Reconnection config
export const RECONNECT_BASE_MS = 1000;
export const RECONNECT_MAX_MS = 30000;
export const MAX_RECONNECT_ATTEMPTS = 20;

// Heartbeat / silence detection
export const HEARTBEAT_INTERVAL_MS = 10000;
export const SILENCE_THRESHOLD_MS = 45000;

// Connection states
export const STATE = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
};
