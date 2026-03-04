// ═══════════════════════════════════════════════════════════════════
// Tier 6 — Trading Infrastructure Tests
//
// 6.2: AlpacaAdapter — API construction, endpoints, order payloads
// 6.3: OrderEntryOverlay — component exports and integration
// 6.4: PositionPanel — component exports
// 6.5: Bybit WSRouter registration
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';

// ═══════════════════════════════════════════════════════════════════
// 6.5 — Bybit WSRouter Registration
// ═══════════════════════════════════════════════════════════════════

describe('6.5 — Bybit WSRouter Registration', () => {
  let wsRouterSource;

  beforeEach(async () => {
    wsRouterSource = await fs.promises.readFile('src/data/providers/WSRouter.js', 'utf8');
  });

  // TODO: un-skip when WSRouter imports bybitAdapter (Task 4.4)
  it.skip('imports bybitAdapter', () => {
    expect(wsRouterSource).toContain("import { bybitAdapter } from '../../adapters/BybitAdapter.js'");
  });

  it('exports createBybitWSAdapter factory', () => {
    expect(wsRouterSource).toContain('export function createBybitWSAdapter()');
  });

  it('Bybit adapter has correct id', () => {
    expect(wsRouterSource).toContain("id: 'bybit-ws'");
  });

  it('Bybit adapter reports source as bybit in tick data', () => {
    expect(wsRouterSource).toContain("source: 'bybit'");
  });

  it('Bybit registered in singleton router', () => {
    expect(wsRouterSource).toContain('wsRouter.registerProvider(bybitWSAdapter)');
  });

  it('router has 4 providers: Pyth, Kraken, Bybit, Polygon', () => {
    const providers = wsRouterSource.match(/wsRouter\.registerProvider\(/g);
    expect(providers).not.toBeNull();
    expect(providers.length).toBe(4);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 6.2 — AlpacaAdapter
// ═══════════════════════════════════════════════════════════════════

describe('6.2 — AlpacaAdapter', () => {
  let alpacaSource;

  beforeEach(async () => {
    alpacaSource = await fs.promises.readFile('src/data/adapters/AlpacaAdapter.js', 'utf8');
  });

  // ── Class Structure ────────────────────────────────────────

  it('extends BaseAdapter', () => {
    expect(alpacaSource).toContain("extends BaseAdapter");
    expect(alpacaSource).toContain("super('alpaca')");
  });

  it('exports singleton alpacaAdapter', () => {
    expect(alpacaSource).toContain('export const alpacaAdapter = new AlpacaAdapter()');
    expect(alpacaSource).toContain('export default alpacaAdapter');
  });

  // ── Configuration ──────────────────────────────────────────

  it('has configure method with keyId, secretKey, isPaper', () => {
    expect(alpacaSource).toContain('configure(keyId, secretKey, isPaper');
    expect(alpacaSource).toContain('this._keyId = keyId');
    expect(alpacaSource).toContain('this._secretKey = secretKey');
    expect(alpacaSource).toContain('this._isPaper = isPaper');
  });

  it('isConfigured getter checks both key fields', () => {
    expect(alpacaSource).toContain('get isConfigured');
    expect(alpacaSource).toContain('this._keyId');
    expect(alpacaSource).toContain('this._secretKey');
  });

  it('uses paper-api.alpaca.markets for paper trading', () => {
    expect(alpacaSource).toContain('https://paper-api.alpaca.markets');
  });

  it('uses api.alpaca.markets for live trading', () => {
    expect(alpacaSource).toContain('https://api.alpaca.markets');
  });

  it('uses data.alpaca.markets for market data', () => {
    expect(alpacaSource).toContain('https://data.alpaca.markets');
  });

  // ── Auth Headers ───────────────────────────────────────────

  it('sets APCA-API-KEY-ID header', () => {
    expect(alpacaSource).toContain("'APCA-API-KEY-ID'");
  });

  it('sets APCA-API-SECRET-KEY header', () => {
    expect(alpacaSource).toContain("'APCA-API-SECRET-KEY'");
  });

  // ── BaseAdapter Interface ──────────────────────────────────

  it('implements supports() for US equities', () => {
    expect(alpacaSource).toContain('supports(symbol)');
    expect(alpacaSource).toContain('isUsEquity');
  });

  it('implements fetchOHLCV with Alpaca bars endpoint', () => {
    expect(alpacaSource).toContain('fetchOHLCV(symbol, interval');
    expect(alpacaSource).toContain('/stocks/');
    expect(alpacaSource).toContain('/bars');
  });

  it('implements fetchQuote using snapshot endpoint', () => {
    expect(alpacaSource).toContain('fetchQuote(symbol)');
    expect(alpacaSource).toContain('/snapshot');
  });

  it('implements subscribe with polling fallback', () => {
    expect(alpacaSource).toContain('subscribe(symbol, callback)');
    expect(alpacaSource).toContain('setInterval');
    expect(alpacaSource).toContain('5000'); // 5s poll interval
  });

  it('implements searchSymbols via assets endpoint', () => {
    expect(alpacaSource).toContain('searchSymbols(query');
    expect(alpacaSource).toContain('/v2/assets');
    expect(alpacaSource).toContain('us_equity');
  });

  // ── Trading API ────────────────────────────────────────────

  it('implements placeOrder with REST POST to /v2/orders', () => {
    expect(alpacaSource).toContain('async placeOrder(order)');
    expect(alpacaSource).toContain('/v2/orders');
    expect(alpacaSource).toContain("method: 'POST'");
    expect(alpacaSource).toContain('body: JSON.stringify(body)');
  });

  it('placeOrder supports all order fields', () => {
    expect(alpacaSource).toContain('order.symbol');
    expect(alpacaSource).toContain('order.qty');
    expect(alpacaSource).toContain('order.side');
    expect(alpacaSource).toContain('order.type');
    expect(alpacaSource).toContain('order.limitPrice');
    expect(alpacaSource).toContain('order.stopPrice');
    expect(alpacaSource).toContain('order.timeInForce');
  });

  it('placeOrder includes time_in_force', () => {
    expect(alpacaSource).toContain("time_in_force:");
    expect(alpacaSource).toContain("'day'");
  });

  it('implements getOrders', () => {
    expect(alpacaSource).toContain("async getOrders(status = 'open')");
    expect(alpacaSource).toContain('/v2/orders?status=');
  });

  it('implements cancelOrder with DELETE', () => {
    expect(alpacaSource).toContain('async cancelOrder(orderId)');
    expect(alpacaSource).toContain("method: 'DELETE'");
  });

  it('implements getPositions', () => {
    expect(alpacaSource).toContain('async getPositions()');
    expect(alpacaSource).toContain('/v2/positions');
  });

  it('getPositions normalizes response', () => {
    expect(alpacaSource).toContain('avg_entry_price');
    expect(alpacaSource).toContain('current_price');
    expect(alpacaSource).toContain('unrealized_pl');
    expect(alpacaSource).toContain('market_value');
  });

  it('implements closePosition', () => {
    expect(alpacaSource).toContain('async closePosition(symbol)');
    expect(alpacaSource).toContain('/v2/positions/');
  });

  it('implements getAccount', () => {
    expect(alpacaSource).toContain('async getAccount()');
    expect(alpacaSource).toContain('/v2/account');
    expect(alpacaSource).toContain('portfolio_value');
    expect(alpacaSource).toContain('buying_power');
    expect(alpacaSource).toContain('equity');
  });

  it('implements dispose to clean up poll timers', () => {
    expect(alpacaSource).toContain('dispose()');
    expect(alpacaSource).toContain('clearInterval');
    expect(alpacaSource).toContain('_pollTimers.clear()');
  });

  // ── Interval Mapping ───────────────────────────────────────

  it('maps charEdge intervals to Alpaca timeframes', () => {
    expect(alpacaSource).toContain("'1m': '1Min'");
    expect(alpacaSource).toContain("'1h': '1Hour'");
    expect(alpacaSource).toContain("'1d': '1Day'");
    expect(alpacaSource).toContain("'1w': '1Week'");
  });

  // ── supports() heuristic ───────────────────────────────────

  it('rejects crypto-style symbols', () => {
    expect(alpacaSource).toContain("!s.endsWith('USDT')");
    expect(alpacaSource).toContain("!s.endsWith('BUSD')");
  });
});

// ═══════════════════════════════════════════════════════════════════
// 6.3 — OrderEntryOverlay
// ═══════════════════════════════════════════════════════════════════

describe('6.3 — OrderEntryOverlay', () => {
  let overlaySource;

  beforeEach(async () => {
    overlaySource = await fs.promises.readFile(
      'src/app/components/chart/overlays/OrderEntryOverlay.jsx', 'utf8',
    );
  });

  it('exports a default React component', () => {
    expect(overlaySource).toContain('export default function OrderEntryOverlay');
  });

  it('accepts symbol, price, currentPrice, position, onClose props', () => {
    expect(overlaySource).toContain('symbol');
    expect(overlaySource).toContain('price');
    expect(overlaySource).toContain('currentPrice');
    expect(overlaySource).toContain('position');
    expect(overlaySource).toContain('onClose');
  });

  it('imports usePaperTradeStore for paper trading', () => {
    expect(overlaySource).toContain("import { usePaperTradeStore");
  });

  it('imports alpacaAdapter for live trading', () => {
    expect(overlaySource).toContain("import { alpacaAdapter }");
  });

  it('supports market, limit, stop, stop_limit order types', () => {
    expect(overlaySource).toContain("value=\"market\"");
    expect(overlaySource).toContain("value=\"limit\"");
    expect(overlaySource).toContain("value=\"stop\"");
    expect(overlaySource).toContain("value=\"stop_limit\"");
  });

  it('auto-detects buy/sell side based on price vs currentPrice', () => {
    expect(overlaySource).toContain("price >= currentPrice ? 'sell' : 'buy'");
  });

  it('has quick quantity buttons (25/50/75/100%)', () => {
    expect(overlaySource).toContain('[0.25, 0.5, 0.75, 1]');
  });

  it('has SL/TP inputs for paper trading', () => {
    expect(overlaySource).toContain('Stop Loss');
    expect(overlaySource).toContain('Take Profit');
    expect(overlaySource).toContain('stopLoss');
    expect(overlaySource).toContain('takeProfit');
  });

  it('displays estimated cost', () => {
    expect(overlaySource).toContain('Est. Cost');
  });

  it('uses placeOrder for both paper and live', () => {
    expect(overlaySource).toContain('paperStore.placeOrder');
    expect(overlaySource).toContain('alpacaAdapter.placeOrder');
  });

  it('shows Live vs Paper mode indicator', () => {
    expect(overlaySource).toContain('🟢 Live');
    expect(overlaySource).toContain('📝 Paper');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 6.4 — PositionPanel
// ═══════════════════════════════════════════════════════════════════

describe('6.4 — PositionPanel', () => {
  let panelSource;

  beforeEach(async () => {
    panelSource = await fs.promises.readFile(
      'src/app/components/chart/panels/PositionPanel.jsx', 'utf8',
    );
  });

  it('exports a default React component', () => {
    expect(panelSource).toContain('export default function PositionPanel');
  });

  it('imports usePaperTradeStore and alpacaAdapter', () => {
    expect(panelSource).toContain("import { usePaperTradeStore }");
    expect(panelSource).toContain("import { alpacaAdapter }");
  });

  it('has Positions and Orders tabs', () => {
    expect(panelSource).toContain("'positions'");
    expect(panelSource).toContain("'orders'");
    expect(panelSource).toContain('Positions (');
    expect(panelSource).toContain('Orders (');
  });

  it('displays account summary bar', () => {
    expect(panelSource).toContain('Balance');
    expect(panelSource).toContain('Equity');
    expect(panelSource).toContain('Buying Power');
    expect(panelSource).toContain('P&L');
  });

  it('position table has required columns', () => {
    expect(panelSource).toContain('>Symbol<');
    expect(panelSource).toContain('>Side<');
    expect(panelSource).toContain('>Qty<');
    expect(panelSource).toContain('>Entry<');
    expect(panelSource).toContain('>Current<');
  });

  it('has close and cancel buttons', () => {
    expect(panelSource).toContain('Close');
    expect(panelSource).toContain('Cancel');
    expect(panelSource).toContain('handleClose');
    expect(panelSource).toContain('handleCancel');
  });

  it('polls Alpaca every 10 seconds for live data', () => {
    expect(panelSource).toContain('10_000');
    expect(panelSource).toContain('setInterval(refreshLive');
  });

  it('uses alpacaAdapter for live close/cancel', () => {
    expect(panelSource).toContain('alpacaAdapter.closePosition');
    expect(panelSource).toContain('alpacaAdapter.cancelOrder');
  });

  it('uses paperStore for paper close/cancel', () => {
    expect(panelSource).toContain('paperStore.closePosition');
    expect(panelSource).toContain('paperStore.cancelOrder');
  });

  it('color-codes P&L (green positive, red negative)', () => {
    expect(panelSource).toContain('#10b981'); // Green
    expect(panelSource).toContain('#ef4444'); // Red
    expect(panelSource).toContain('plPositive');
    expect(panelSource).toContain('plNegative');
  });

  it('shows empty state messages', () => {
    expect(panelSource).toContain('No open positions');
    expect(panelSource).toContain('No pending orders');
  });
});
