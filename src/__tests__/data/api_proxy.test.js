// ═══════════════════════════════════════════════════════════════════
// charEdge — API Proxy Tests
//
// Verifies that API keys are server-side only:
//   1. Vercel serverless functions exist
//   2. Adapters call /api/proxy/ not upstream URLs
//   3. No API key params in client adapter code
//   4. .env.example has correct env var names
// ═══════════════════════════════════════════════════════════════════

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect } from 'vitest';

const SRC = resolve('src');
const ROOT = resolve('.');

// ─── Vercel Serverless Functions ──────────────────────────────────

describe('Vercel proxy functions — exist and export handler', () => {
  const providers = ['fmp', 'fred', 'finnhub', 'polygon', 'tiingo', 'alphavantage', 'alpaca'];

  for (const p of providers) {
    it(`api/proxy/${p}.js exists`, () => {
      expect(existsSync(resolve(ROOT, `api/proxy/${p}.js`))).toBe(true);
    });

    it(`api/proxy/${p}.js exports default handler`, () => {
      const src = readFileSync(resolve(ROOT, `api/proxy/${p}.js`), 'utf8');
      expect(src).toContain('export default async function handler');
    });

    it(`api/proxy/${p}.js does NOT embed the API key`, () => {
      const src = readFileSync(resolve(ROOT, `api/proxy/${p}.js`), 'utf8');
      expect(src).not.toMatch(/['"]pk_[a-zA-Z0-9]+['"]/); // No literal keys
      expect(src).toContain('process.env'); // Uses env vars
    });
  }
});

// ─── Server.js Proxy Routes ──────────────────────────────────────

describe('server.js — proxy routes for all providers', () => {
  const serverSrc = [
      'server.js',
      'server/middleware/security.js',
      'server/middleware/rateLimiter.js',
      'server/middleware/requestId.js',
      'server/routes/rss.js',
      'server/routes/proxy.js',
      'server/ssr.js',
    ].map(f => readFileSync(resolve(ROOT, f), 'utf8')).join('\n');

  it('has PROXY_CONFIGS with all providers', () => {
    expect(serverSrc).toContain('PROXY_CONFIGS');
    expect(serverSrc).toContain("fmp:");
    expect(serverSrc).toContain("fred:");
    expect(serverSrc).toContain("finnhub:");
    expect(serverSrc).toContain("polygon:");
    expect(serverSrc).toContain("tiingo:");
    expect(serverSrc).toContain("alphavantage:");
    expect(serverSrc).toContain("alpaca:");
  });

  it('has catch-all proxy route', () => {
    expect(serverSrc).toContain("/api/proxy/:provider/*");
  });

  it('reads API keys from process.env', () => {
    expect(serverSrc).toContain('FMP_API_KEY');
    expect(serverSrc).toContain('FRED_API_KEY');
    expect(serverSrc).toContain('FINNHUB_API_KEY');
    expect(serverSrc).toContain('POLYGON_API_KEY');
    expect(serverSrc).toContain('TIINGO_API_TOKEN');
    expect(serverSrc).toContain('ALPHAVANTAGE_API_KEY');
    expect(serverSrc).toContain('ALPACA_KEY_ID');
    expect(serverSrc).toContain('ALPACA_SECRET');
  });
});

// ─── FMPAdapter — uses proxy, no client-side API key ──────────────

describe('FMPAdapter — proxied (no client-side key)', () => {
  const src = readFileSync(resolve(SRC, 'data/adapters/FMPAdapter.js'), 'utf8');

  it('calls /api/proxy/fmp/', () => {
    expect(src).toContain('/api/proxy/fmp');
  });

  it('does NOT call financialmodelingprep.com directly', () => {
    expect(src).not.toContain('https://financialmodelingprep.com');
  });

  it('does NOT inject apikey param in requests', () => {
    const requestMethod = src.slice(src.indexOf('async _request('));
    expect(requestMethod).not.toContain("'apikey'");
    expect(requestMethod).not.toContain('apikey:');
  });

  it('isConfigured always returns true', () => {
    expect(src).toContain('get isConfigured() { return true; }');
  });
});

// ─── FredAdapter — uses proxy, no client-side API key ─────────────

describe('FredAdapter — proxied (no client-side key)', () => {
  const src = readFileSync(resolve(SRC, 'data/adapters/FredAdapter.js'), 'utf8');

  it('calls /api/proxy/fred/', () => {
    expect(src).toContain('/api/proxy/fred');
  });

  it('does NOT call api.stlouisfed.org directly', () => {
    expect(src).not.toContain('https://api.stlouisfed.org');
  });

  it('does NOT inject api_key param in requests', () => {
    expect(src).not.toContain("api_key: this._apiKey");
    expect(src).not.toContain("api_key:");
  });

  it('isConfigured always returns true', () => {
    expect(src).toContain('get isConfigured() { return true; }');
  });
});

// ─── FinnhubAdapter — uses proxy, no client-side key (REST) ──────

describe('FinnhubAdapter — proxied REST (no client-side key)', () => {
  const src = readFileSync(resolve(SRC, 'data/adapters/FinnhubAdapter.js'), 'utf8');

  it('calls /api/proxy/finnhub/ for REST', () => {
    expect(src).toContain('/api/proxy/finnhub');
  });

  it('does NOT call finnhub.io directly for REST', () => {
    expect(src).not.toContain("'https://finnhub.io/api/v1'");
  });

  it('_request() does NOT inject token param', () => {
    const requestMethod = src.slice(src.indexOf('async _request('));
    expect(requestMethod).not.toContain("'token', this._apiKey");
    expect(requestMethod).not.toContain("set('token'");
  });

  it('isConfigured always returns true', () => {
    expect(src).toContain('get isConfigured() { return true; }');
  });

  it('WebSocket still has token support (expected — WS needs client-side key)', () => {
    expect(src).toContain('_wsToken');
    expect(src).toContain('wss://ws.finnhub.io');
  });
});

// ─── PolygonProvider — uses proxy, no direct API calls ────────────

describe('PolygonProvider — proxied (no client-side key)', () => {
  const src = readFileSync(resolve(SRC, 'data/providers/PolygonProvider.js'), 'utf8');

  it('calls /api/proxy/polygon', () => {
    expect(src).toContain('/api/proxy/polygon');
  });

  it('does NOT call api.polygon.io directly', () => {
    expect(src).not.toContain("'https://api.polygon.io'");
  });
});

// ─── TiingoAdapter — uses proxy, no direct API calls ──────────────

describe('TiingoAdapter — proxied (no client-side key)', () => {
  const src = readFileSync(resolve(SRC, 'data/adapters/TiingoAdapter.js'), 'utf8');

  it('calls /api/proxy/tiingo', () => {
    expect(src).toContain('/api/proxy/tiingo');
  });

  it('does NOT call api.tiingo.com directly', () => {
    expect(src).not.toContain("'https://api.tiingo.com'");
  });

  it('isConfigured always returns true', () => {
    expect(src).toContain('get isConfigured() { return true; }');
  });
});

// ─── AlphaVantageProvider — uses proxy, no direct API calls ───────

describe('AlphaVantageProvider — proxied (no client-side key)', () => {
  const src = readFileSync(resolve(SRC, 'data/providers/AlphaVantageProvider.js'), 'utf8');

  it('calls /api/proxy/alphavantage', () => {
    expect(src).toContain('/api/proxy/alphavantage');
  });

  it('does NOT call www.alphavantage.co directly', () => {
    expect(src).not.toContain("'https://www.alphavantage.co'");
  });
});

// ─── AlpacaProvider — uses proxy, no client-side keys ─────────────

describe('AlpacaProvider — proxied (no client-side key)', () => {
  const src = readFileSync(resolve(SRC, 'data/providers/AlpacaProvider.js'), 'utf8');

  it('calls /api/proxy/alpaca', () => {
    expect(src).toContain('/api/proxy/alpaca');
  });

  it('does NOT call data.alpaca.markets directly', () => {
    expect(src).not.toContain("'https://data.alpaca.markets'");
  });

  it('does NOT contain APCA- headers (server-side only)', () => {
    expect(src).not.toContain('APCA-API-KEY-ID');
    expect(src).not.toContain('APCA-API-SECRET-KEY');
  });
});

// ─── ProviderRegistry — Alpaca is first in equity chain ───────────

describe('ProviderRegistry — equity provider ordering', () => {
  const src = readFileSync(resolve(SRC, 'data/providers/ProviderRegistry.js'), 'utf8');

  it('has alpaca as a provider', () => {
    expect(src).toContain("id: 'alpaca'");
  });

  it('alpaca appears before polygon in EQUITY_PROVIDERS', () => {
    const alpacaPos = src.indexOf("id: 'alpaca'");
    const polygonPos = src.indexOf("id: 'polygon'");
    expect(alpacaPos).toBeLessThan(polygonPos);
  });
});

// ─── .env.example — has server-only env vars ──────────────────────

describe('.env.example — API key env vars', () => {
  const envSrc = readFileSync(resolve(ROOT, '.env.example'), 'utf8');

  it('has FMP_API_KEY', () => {
    expect(envSrc).toContain('FMP_API_KEY');
  });

  it('has FRED_API_KEY', () => {
    expect(envSrc).toContain('FRED_API_KEY');
  });

  it('has FINNHUB_API_KEY', () => {
    expect(envSrc).toContain('FINNHUB_API_KEY');
  });

  it('has POLYGON_API_KEY', () => {
    expect(envSrc).toContain('POLYGON_API_KEY');
  });

  it('has ALPACA_KEY_ID and ALPACA_SECRET', () => {
    expect(envSrc).toContain('ALPACA_KEY_ID');
    expect(envSrc).toContain('ALPACA_SECRET');
  });

  it('has TIINGO_API_TOKEN', () => {
    expect(envSrc).toContain('TIINGO_API_TOKEN');
  });

  it('has ALPHAVANTAGE_API_KEY', () => {
    expect(envSrc).toContain('ALPHAVANTAGE_API_KEY');
  });

  it('does NOT have VITE_FMP or VITE_FRED or VITE_FINNHUB', () => {
    expect(envSrc).not.toContain('VITE_FMP');
    expect(envSrc).not.toContain('VITE_FRED');
    expect(envSrc).not.toContain('VITE_FINNHUB');
  });
});
