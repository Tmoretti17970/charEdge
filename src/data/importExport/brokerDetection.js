// ═══════════════════════════════════════════════════════════════════
// charEdge — Broker Detection + Routing
// ═══════════════════════════════════════════════════════════════════

import { parseTradovate } from './parsers/tradovate.js';
import { parseNinjaTrader } from './parsers/ninjatrader.js';
import { parseThinkorSwim } from './parsers/thinkorswim.js';
import { parseTradeStation } from './parsers/tradestation.js';
import { parseIBKR } from './parsers/ibkr.js';
import { parseRobinhood } from './parsers/robinhood.js';
import { parseWebull } from './parsers/webull.js';
import { parseMT5 } from './parsers/mt5.js';
import { parsecharEdgeCSV } from './parsers/tradeforge.js';
import { parseGenericCSV } from './parsers/generic.js';

// H2.1: Crypto + Fidelity parsers
import { parseBinance } from './parsers/binance.js';
import { parseCoinbase } from './parsers/coinbase.js';
import { parseKraken } from './parsers/kraken.js';
import { parseBybit } from './parsers/bybit.js';
import { parseFidelity } from './parsers/fidelity.js';

/**
 * Auto-detect broker from CSV headers.
 * @param {string[]} headers - CSV column headers
 * @returns {string} Broker ID or 'generic'
 */
export function detectBroker(headers) {
  const h = headers.map((s) => (s || '').toLowerCase().trim());
  const joined = h.join('|');

  if ((h.includes('b/s') || h.includes('buy/sell')) && h.includes('instrument')) return 'tradovate';
  if (h.includes('entry price') && h.includes('exit price') && h.includes('instrument')) return 'ninjatrader';
  if (h.includes('exec time') && (h.includes('spread') || h.includes('pos effect'))) return 'thinkorswim';
  if (h.includes('close price') && h.includes('entry price') && h.includes('symbol')) return 'tradestation';
  if (h.includes('datadiscriminator') || h.includes('clientaccountid') || joined.includes('tradeid')) return 'ibkr';
  if (h.includes('trans code') && h.includes('instrument')) return 'robinhood';
  if ((h.includes('avg price') || h.includes('filled qty')) && h.includes('side') && h.includes('status')) return 'webull';
  if (h.includes('volume') && h.includes('profit') && (h.includes('close time') || h.includes('close price'))) {
    if (h.includes('swap') || h.includes('commission') || h.includes('ticket')) return 'mt5';
  }
  if (h.includes('direction') && h.includes('deal') && h.includes('profit')) return 'mt5';
  if (h.includes('id') && h.includes('playbook') && h.includes('rmultiple')) return 'charEdge';

  // H2.1: Crypto exchange + Fidelity detection
  if (h.includes('pair') && (h.includes('fee coin') || h.includes('date(utc)'))) return 'binance';
  if (h.includes('transaction type') && (h.includes('quantity transacted') || h.includes('spot price at transaction'))) return 'coinbase';
  if ((h.includes('txid') || h.includes('ordertxid')) && h.includes('pair') && h.includes('vol')) return 'kraken';
  if (h.includes('fill price') && h.includes('symbol') && (h.includes('exec time') || h.includes('order id'))) return 'bybit';
  if (h.includes('run date') && h.includes('action') && h.includes('symbol') && (joined.includes('price ($)') || joined.includes('amount ($)'))) return 'fidelity';

  return 'generic';
}

export const BROKER_PARSERS = {
  tradovate: parseTradovate,
  ninjatrader: parseNinjaTrader,
  thinkorswim: parseThinkorSwim,
  tradestation: parseTradeStation,
  ibkr: parseIBKR,
  robinhood: parseRobinhood,
  webull: parseWebull,
  mt5: parseMT5,
  charEdge: parsecharEdgeCSV,
  generic: parseGenericCSV,
  // H2.1: Crypto + Fidelity
  binance: parseBinance,
  coinbase: parseCoinbase,
  kraken: parseKraken,
  bybit: parseBybit,
  fidelity: parseFidelity,
};

export const BROKER_LABELS = {
  tradovate: 'Tradovate',
  ninjatrader: 'NinjaTrader',
  thinkorswim: 'ThinkorSwim',
  tradestation: 'TradeStation',
  ibkr: 'Interactive Brokers',
  robinhood: 'Robinhood',
  webull: 'Webull',
  mt5: 'MetaTrader 5',
  charEdge: 'charEdge',
  generic: 'Generic CSV',
  // H2.1: Crypto + Fidelity
  binance: 'Binance',
  coinbase: 'Coinbase',
  kraken: 'Kraken',
  bybit: 'Bybit',
  fidelity: 'Fidelity',
};
