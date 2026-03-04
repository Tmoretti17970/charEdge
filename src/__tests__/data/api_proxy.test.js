// ═══════════════════════════════════════════════════════════════════
// charEdge — Task 2.1.1 API Proxy Tests
//
// Verifies that API keys are server-side only:
//   1. Vercel serverless functions exist
//   2. Adapters call /api/proxy/ not upstream URLs
//   3. No API key params in client adapter code
//   4. .env.example has correct env var names
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const SRC = resolve('src');
const ROOT = resolve('.');

// ─── Vercel Serverless Functions ──────────────────────────────────

describe('Vercel proxy functions — exist and export handler', () => {
  const providers = ['fmp', 'fred', 'finnhub'];

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

describe('server.js — proxy routes for FMP/FRED/Finnhub', () => {
  const serverSrc = readFileSync(resolve(ROOT, 'server.js'), 'utf8');

  it('has _PROXY_CONFIGS with fmp, fred, finnhub', () => {
    expect(serverSrc).toContain('_PROXY_CONFIGS');
    expect(serverSrc).toContain("fmp:");
    expect(serverSrc).toContain("fred:");
    expect(serverSrc).toContain("finnhub:");
  });

  it('has catch-all proxy route', () => {
    expect(serverSrc).toContain("/api/proxy/:provider/*");
  });

  it('reads API keys from process.env', () => {
    expect(serverSrc).toContain('FMP_API_KEY');
    expect(serverSrc).toContain('FRED_API_KEY');
    expect(serverSrc).toContain('FINNHUB_API_KEY');
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
    // The _request method should not add apikey
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
    // Should not have the REST base URL
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

  it('does NOT have VITE_FMP or VITE_FRED or VITE_FINNHUB', () => {
    expect(envSrc).not.toContain('VITE_FMP');
    expect(envSrc).not.toContain('VITE_FRED');
    expect(envSrc).not.toContain('VITE_FINNHUB');
  });
});
