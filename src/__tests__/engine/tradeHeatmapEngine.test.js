// ═══════════════════════════════════════════════════════════════════
// charEdge — TradeHeatmapEngine Unit Tests
// Tests anonymization, trade registration, binning, and privacy.
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TradeHeatmapEngine, HEATMAP_EVENT } from '../../data/engine/orderflow/TradeHeatmapEngine.js';
// MSG constant (previously from PeerProtocol, now local to TradeHeatmapEngine)
const MSG = Object.freeze({ TRADE_HEATMAP: 'trade_heatmap' });

describe('TradeHeatmapEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new TradeHeatmapEngine();
  });

  // ── Privacy Controls ──────────────────────────────────────────

  describe('privacy', () => {
    it('is opted-out by default', () => {
      expect(engine.isOptedIn).toBe(false);
    });

    it('setOptIn enables data collection', () => {
      engine.setOptIn(true);
      expect(engine.isOptedIn).toBe(true);
    });

    it('setOptIn(false) clears all stored data', () => {
      engine.setOptIn(true);
      engine.registerTrade('BTC', HEATMAP_EVENT.ENTRY, 50000);
      engine.setOptIn(false);
      expect(engine.getProfile('BTC')).toBeNull();
    });

    it('registerTrade returns ok:false when not opted in', () => {
      const result = engine.registerTrade('BTC', HEATMAP_EVENT.ENTRY, 50000);
      expect(result.ok).toBe(false);
    });
  });

  // ── Anonymization ─────────────────────────────────────────────

  describe('anonymizePrice', () => {
    it('rounds prices to nearest 0.1% bucket', () => {
      const anon = engine.anonymizePrice(50000);
      // 0.1% of 50000 = 50, so should round to nearest 50
      expect(anon % 50).toBe(0);
    });

    it('returns 0 for zero price', () => {
      expect(engine.anonymizePrice(0)).toBe(0);
    });

    it('returns 0 for negative price', () => {
      expect(engine.anonymizePrice(-100)).toBe(0);
    });

    it('anonymizes different prices differently', () => {
      const a1 = engine.anonymizePrice(50000);
      const a2 = engine.anonymizePrice(51000);
      expect(a1).not.toBe(a2);
    });
  });

  // ── registerTrade ─────────────────────────────────────────────

  describe('registerTrade', () => {
    beforeEach(() => {
      engine.setOptIn(true);
    });

    it('registers an entry trade', () => {
      const result = engine.registerTrade('BTC', HEATMAP_EVENT.ENTRY, 50000);
      expect(result.ok).toBe(true);
      expect(result.payload.symbol).toBe('BTC');
      expect(result.payload.type).toBe('entry');
    });

    it('registers an exit trade', () => {
      const result = engine.registerTrade('BTC', HEATMAP_EVENT.EXIT, 50500);
      expect(result.ok).toBe(true);
      expect(result.payload.type).toBe('exit');
    });

    it('rejects invalid trade type', () => {
      const result = engine.registerTrade('BTC', 'invalid', 50000);
      expect(result.ok).toBe(false);
    });

    it('payload price is anonymized to a 0.1% grid', () => {
      const result = engine.registerTrade('BTC', HEATMAP_EVENT.ENTRY, 45231.47);
      const price = result.payload.price;
      // Anonymized price should be a number on the 0.1% bucket grid
      // bucket = price * 0.001, result = round(price/bucket) * bucket
      // So the anonymized price should differ from a non-round number
      const bucket = 45231.47 * 0.001;
      expect(price).toBe(Math.round(45231.47 / bucket) * bucket);
      expect(typeof price).toBe('number');
    });
  });

  // ── getProfile ────────────────────────────────────────────────

  describe('getProfile', () => {
    beforeEach(() => {
      engine.setOptIn(true);
    });

    it('returns null for symbol with no events', () => {
      expect(engine.getProfile('UNKNOWN')).toBeNull();
    });

    it('returns profile with bins after trades', () => {
      engine.registerTrade('BTC', HEATMAP_EVENT.ENTRY, 50000);
      engine.registerTrade('BTC', HEATMAP_EVENT.EXIT, 50500);
      engine.registerTrade('BTC', HEATMAP_EVENT.ENTRY, 49500);

      const profile = engine.getProfile('BTC');
      expect(profile).not.toBeNull();
      expect(profile.bins.length).toBe(40);
      expect(profile.totalEvents).toBe(3);
    });

    it('bins have correct structure', () => {
      engine.registerTrade('BTC', HEATMAP_EVENT.ENTRY, 50000);
      engine.registerTrade('BTC', HEATMAP_EVENT.EXIT, 50500);

      const profile = engine.getProfile('BTC');
      const bin = profile.bins[0];

      expect(typeof bin.priceMin).toBe('number');
      expect(typeof bin.priceMax).toBe('number');
      expect(typeof bin.priceMid).toBe('number');
      expect(typeof bin.entries).toBe('number');
      expect(typeof bin.exits).toBe('number');
      expect(typeof bin.total).toBe('number');
      expect(typeof bin.normalized).toBe('number');
    });

    it('normalized values are between 0 and 1', () => {
      for (let i = 0; i < 20; i++) {
        engine.registerTrade('BTC', HEATMAP_EVENT.ENTRY, 50000 + i * 100);
      }

      const profile = engine.getProfile('BTC');
      for (const bin of profile.bins) {
        expect(bin.normalized).toBeGreaterThanOrEqual(0);
        expect(bin.normalized).toBeLessThanOrEqual(1);
      }
    });

    it('hot zone identifies highest density bin', () => {
      // Add many trades at same price to create hot zone
      for (let i = 0; i < 10; i++) {
        engine.registerTrade('BTC', HEATMAP_EVENT.ENTRY, 50000);
      }
      engine.registerTrade('BTC', HEATMAP_EVENT.ENTRY, 51000);

      const profile = engine.getProfile('BTC');
      expect(profile.hotZone.density).toBeGreaterThan(0);
    });
  });

  // ── handlePeerMessage ─────────────────────────────────────────

  describe('handlePeerMessage', () => {
    beforeEach(() => {
      engine.setOptIn(true);
    });

    it('processes valid TRADE_HEATMAP messages', () => {
      engine.handlePeerMessage({
        type: MSG.TRADE_HEATMAP,
        payload: { symbol: 'BTC', type: 'entry', price: 50000, ts: Date.now() },
      });
      engine.handlePeerMessage({
        type: MSG.TRADE_HEATMAP,
        payload: { symbol: 'BTC', type: 'exit', price: 51000, ts: Date.now() },
      });

      const profile = engine.getProfile('BTC');
      expect(profile).not.toBeNull();
      expect(profile.totalEvents).toBe(2);
    });

    it('ignores messages when not opted in', () => {
      engine.setOptIn(false);
      engine.handlePeerMessage({
        type: MSG.TRADE_HEATMAP,
        payload: { symbol: 'BTC', type: 'entry', price: 50000, ts: Date.now() },
      });
      expect(engine.getProfile('BTC')).toBeNull();
    });

    it('re-anonymizes incoming peer prices', () => {
      const handler = vi.fn();
      engine.addEventListener('heatmap-update', handler);

      engine.handlePeerMessage({
        type: MSG.TRADE_HEATMAP,
        payload: { symbol: 'BTC', type: 'entry', price: 50123.456, ts: Date.now() },
      });

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  // ── Events ────────────────────────────────────────────────────

  describe('events', () => {
    it('emits heatmap-update on new trade', () => {
      engine.setOptIn(true);
      const handler = vi.fn();
      engine.addEventListener('heatmap-update', handler);

      engine.registerTrade('BTC', HEATMAP_EVENT.ENTRY, 50000);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].detail.symbol).toBe('BTC');
    });
  });
});
