// ═══════════════════════════════════════════════════════════════════
// charEdge — ApiKeyRoundRobin Tests
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiKeyRoundRobin } from '../../data/providers/ApiKeyRoundRobin.js';

describe('ApiKeyRoundRobin', () => {
  let rr;

  beforeEach(() => {
    rr = new ApiKeyRoundRobin();
  });

  describe('addProvider / getNextKey', () => {
    it('should register provider with keys', () => {
      rr.addProvider('polygon', ['key1', 'key2', 'key3']);
      expect(rr.hasProvider('polygon')).toBe(true);
    });

    it('should rotate keys in order', () => {
      rr.addProvider('polygon', ['A', 'B', 'C']);

      expect(rr.getNextKey('polygon').key).toBe('A');
      expect(rr.getNextKey('polygon').key).toBe('B');
      expect(rr.getNextKey('polygon').key).toBe('C');
      expect(rr.getNextKey('polygon').key).toBe('A'); // Wraps around
    });

    it('should return null for unknown provider', () => {
      expect(rr.getNextKey('unknown')).toBeNull();
    });
  });

  describe('cooldown', () => {
    it('should skip cooled-down keys', () => {
      vi.useFakeTimers();
      rr.addProvider('test', ['A', 'B', 'C']);

      // Cool down key 0 (A) for 5 seconds
      rr.markCooldown('test', 0, 5_000);

      // Should skip A
      expect(rr.getNextKey('test').key).toBe('B');
      expect(rr.getNextKey('test').key).toBe('C');
      expect(rr.getNextKey('test').key).toBe('B'); // Still skipping A

      vi.useRealTimers();
    });

    it('should auto-expire cooldowns', () => {
      vi.useFakeTimers();
      rr.addProvider('test', ['A', 'B']);

      rr.markCooldown('test', 0, 1_000);
      vi.advanceTimersByTime(1_100); // Past cooldown

      expect(rr.getNextKey('test').key).toBe('A'); // Available again

      vi.useRealTimers();
    });

    it('should use exponential backoff without retry-after', () => {
      vi.useFakeTimers();
      rr.addProvider('test', ['A']);

      // First failure: 1s backoff
      rr.markCooldown('test', 0);
      const status1 = rr.getStatus();
      expect(status1.test.keys[0].cooldownRemaining).toBeGreaterThan(0);
      expect(status1.test.keys[0].cooldownRemaining).toBeLessThanOrEqual(1000);

      vi.advanceTimersByTime(1_100);
      rr.markSuccess('test', 0); // Reset

      // After success, failures reset
      rr.markCooldown('test', 0);
      expect(rr.getStatus().test.keys[0].consecutiveFailures).toBe(1);

      vi.useRealTimers();
    });

    it('should return null when all keys are in cooldown', () => {
      vi.useFakeTimers();
      rr.addProvider('test', ['A', 'B']);
      rr.markCooldown('test', 0, 5_000);
      rr.markCooldown('test', 1, 5_000);

      expect(rr.getNextKey('test')).toBeNull();

      vi.useRealTimers();
    });
  });

  describe('markSuccess', () => {
    it('should reset consecutive failures on success', () => {
      rr.addProvider('test', ['A']);
      rr.markCooldown('test', 0, 100);
      rr.markSuccess('test', 0);

      const status = rr.getStatus();
      expect(status.test.keys[0].consecutiveFailures).toBe(0);
      expect(status.test.keys[0].inCooldown).toBe(false);
    });
  });

  describe('parseRetryAfter', () => {
    it('should parse numeric seconds', () => {
      expect(ApiKeyRoundRobin.parseRetryAfter('30')).toBe(30_000);
      expect(ApiKeyRoundRobin.parseRetryAfter(60)).toBe(60_000);
    });

    it('should return null for invalid values', () => {
      expect(ApiKeyRoundRobin.parseRetryAfter(null)).toBeNull();
      expect(ApiKeyRoundRobin.parseRetryAfter(undefined)).toBeNull();
    });

    it('should parse HTTP-date format', () => {
      vi.useFakeTimers();
      const future = new Date(Date.now() + 30_000).toUTCString();
      const result = ApiKeyRoundRobin.parseRetryAfter(future);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(30_500);
      vi.useRealTimers();
    });
  });

  describe('race', () => {
    it('should return result from first successful key', async () => {
      rr.addProvider('test', ['A']);

      const result = await rr.race('test', async (key) => {
        return { bars: [1, 2, 3], key };
      });

      expect(result).not.toBeNull();
      expect(result.data.key).toBe('A');
    });

    it('should return null for unknown provider', async () => {
      const result = await rr.race('unknown', async () => ({}));
      expect(result).toBeNull();
    });

    it('should handle fetch failures gracefully', async () => {
      rr.addProvider('test', ['A']);

      const result = await rr.race('test', async () => {
        throw new Error('Network error');
      });

      expect(result).toBeNull();
      // Key should be in cooldown
      expect(rr.getStatus().test.keys[0].consecutiveFailures).toBe(1);
    });

    it('should return available key count', () => {
      vi.useFakeTimers();
      rr.addProvider('test', ['A', 'B', 'C']);

      expect(rr.getAvailableKeyCount('test')).toBe(3);
      rr.markCooldown('test', 0, 5_000);
      expect(rr.getAvailableKeyCount('test')).toBe(2);

      vi.useRealTimers();
    });
  });

  describe('getStatus', () => {
    it('should return comprehensive status', () => {
      rr.addProvider('test', ['A', 'B']);

      const status = rr.getStatus();
      expect(status.test).toBeDefined();
      expect(status.test.totalKeys).toBe(2);
      expect(status.test.availableKeys).toBe(2);
      expect(status.test.keys.length).toBe(2);
    });
  });
});
