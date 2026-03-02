// ═══════════════════════════════════════════════════════════════════
// TradeForge — Load Test Script (k6)
//
// Tests API and WebSocket endpoints under load.
// Install k6: https://k6.io/docs/get-started/installation/
//
// Usage:
//   k6 run infra/loadtest.js
//   k6 run --vus 100 --duration 60s infra/loadtest.js
// ═══════════════════════════════════════════════════════════════════

import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ─── Configuration ──────────────────────────────────────────────

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const WS_URL = __ENV.WS_URL || 'ws://localhost:3000';

export const options = {
  scenarios: {
    // Ramp up to 50 users over 30s, hold for 1m, ramp down
    api_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 },
        { duration: '1m', target: 50 },
        { duration: '10s', target: 0 },
      ],
      exec: 'apiTest',
    },
    // 10 concurrent WebSocket connections for 1m
    websocket_load: {
      executor: 'constant-vus',
      vus: 10,
      duration: '1m',
      exec: 'wsTest',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],   // 95th percentile under 500ms
    http_req_failed: ['rate<0.01'],     // Less than 1% failures
    ws_connecting: ['p(95)<1000'],      // WS connect under 1s
  },
};

// ─── Custom Metrics ─────────────────────────────────────────────

const apiLatency = new Trend('api_latency');
const wsMessages = new Rate('ws_message_rate');

// ─── API Test ───────────────────────────────────────────────────

export function apiTest() {
  // Health check
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    'health status 200': (r) => r.status === 200,
  });

  // Symbol search
  const searchRes = http.get(`${BASE_URL}/api/search?q=BTC`);
  check(searchRes, {
    'search status 200': (r) => r.status === 200,
    'search has results': (r) => {
      try { return JSON.parse(r.body).length > 0; }
      catch { return false; }
    },
  });
  apiLatency.add(searchRes.timings.duration);

  // OHLC data fetch
  const ohlcRes = http.get(`${BASE_URL}/api/ohlc?symbol=BTCUSDT&tf=1h`);
  check(ohlcRes, {
    'ohlc status 200': (r) => r.status === 200,
  });
  apiLatency.add(ohlcRes.timings.duration);

  // Binance proxy
  const priceRes = http.get(`${BASE_URL}/api/binance/v3/ticker/price?symbol=BTCUSDT`);
  check(priceRes, {
    'price status 200': (r) => r.status === 200,
  });

  sleep(1);
}

// ─── WebSocket Test ─────────────────────────────────────────────

export function wsTest() {
  const url = `${WS_URL}/ws/btcusdt@kline_1h`;

  const res = ws.connect(url, {}, function (socket) {
    let msgCount = 0;

    socket.on('message', (data) => {
      msgCount++;
      wsMessages.add(true);

      // Verify message is valid JSON
      try {
        const msg = JSON.parse(data);
        check(msg, {
          'ws message has data': (m) => m.e || m.type,
        });
      } catch {
        wsMessages.add(false);
      }
    });

    socket.on('error', () => {
      wsMessages.add(false);
    });

    // Stay connected for 30 seconds
    socket.setTimeout(() => {
      check(msgCount, {
        'received at least 1 ws message': (c) => c > 0,
      });
      socket.close();
    }, 30000);
  });

  check(res, {
    'ws status 101': (r) => r && r.status === 101,
  });
}

// ─── Summary Report ─────────────────────────────────────────────

export function handleSummary(data) {
  return {
    stdout: JSON.stringify({
      summary: 'TradeForge Load Test Results',
      api: {
        requests: data.metrics.http_reqs?.values?.count || 0,
        p95_latency: `${(data.metrics.http_req_duration?.values?.['p(95)'] || 0).toFixed(0)}ms`,
        failure_rate: `${((data.metrics.http_req_failed?.values?.rate || 0) * 100).toFixed(2)}%`,
      },
      websocket: {
        connections: data.metrics.ws_sessions?.values?.count || 0,
        message_rate: `${((data.metrics.ws_message_rate?.values?.rate || 0) * 100).toFixed(1)}%`,
      },
    }, null, 2),
  };
}
