import { describe, it, expect, beforeEach, vi } from 'vitest';

// We need to import the module fresh for each test since it uses module-level state
let resolutionTracker;

beforeEach(async () => {
  // Reset module to clear the Map
  vi.resetModules();
  resolutionTracker = await import('../../data/services/ResolutionTracker.js');
});

describe('ResolutionTracker', () => {
  describe('recordResolution', () => {
    it('records a market resolution', () => {
      const market = {
        id: 'm1',
        question: 'Will BTC hit 100k?',
        source: 'kalshi',
        category: 'crypto',
        outcomes: [
          { label: 'Yes', probability: 70 },
          { label: 'No', probability: 30 },
        ],
      };
      resolutionTracker.recordResolution(market, 'Yes');

      const resolved = resolutionTracker.getResolvedMarkets();
      expect(resolved).toHaveLength(1);
      expect(resolved[0]).toMatchObject({
        marketId: 'm1',
        winningOutcome: 'Yes',
        wasLeadingCorrect: true,
      });
    });

    it('correctly detects when leading outcome was wrong', () => {
      const market = {
        id: 'm2',
        question: 'Test?',
        source: 'kalshi',
        category: 'finance',
        outcomes: [{ label: 'Yes', probability: 80 }],
      };
      resolutionTracker.recordResolution(market, 'No');

      const resolved = resolutionTracker.getResolvedMarkets();
      expect(resolved[0].wasLeadingCorrect).toBe(false);
    });
  });

  describe('checkResolutions', () => {
    it('detects newly resolved markets', () => {
      const currentMarkets = [
        { id: 'm1', status: 'resolved', resolvedOutcome: 'Yes', outcomes: [{ label: 'Yes', probability: 70 }] },
        { id: 'm2', status: 'open', resolvedOutcome: null },
      ];
      const newResolutions = resolutionTracker.checkResolutions(currentMarkets);
      expect(newResolutions).toHaveLength(1);
      expect(newResolutions[0].marketId).toBe('m1');
    });

    it('does not re-record already resolved markets', () => {
      const markets = [
        { id: 'm1', status: 'resolved', resolvedOutcome: 'Yes', outcomes: [{ label: 'Yes', probability: 70 }] },
      ];
      resolutionTracker.checkResolutions(markets);
      const second = resolutionTracker.checkResolutions(markets);
      expect(second).toHaveLength(0);
      expect(resolutionTracker.getResolutionCount()).toBe(1);
    });
  });

  describe('getResolutionCount', () => {
    it('returns count of resolved markets', () => {
      expect(resolutionTracker.getResolutionCount()).toBe(0);
      resolutionTracker.recordResolution({ id: 'm1', outcomes: [{ label: 'Yes', probability: 50 }] }, 'Yes');
      expect(resolutionTracker.getResolutionCount()).toBe(1);
    });
  });

  describe('computeAccuracyMetrics', () => {
    it('returns zeros for no resolutions', () => {
      const metrics = resolutionTracker.computeAccuracyMetrics();
      expect(metrics.count).toBe(0);
      expect(metrics.leadingAccuracy).toBe(0);
      expect(metrics.brierScore).toBeNull();
    });

    it('computes accuracy and Brier score', () => {
      resolutionTracker.recordResolution(
        { id: 'm1', category: 'crypto', outcomes: [{ label: 'Yes', probability: 80 }] },
        'Yes',
      );
      resolutionTracker.recordResolution(
        { id: 'm2', category: 'finance', outcomes: [{ label: 'Yes', probability: 70 }] },
        'No',
      );

      const metrics = resolutionTracker.computeAccuracyMetrics();
      expect(metrics.count).toBe(2);
      expect(metrics.leadingAccuracy).toBe(50); // 1 correct out of 2
      expect(metrics.brierScore).toBeDefined();
      expect(metrics.byCategory.crypto).toBeDefined();
      expect(metrics.byCategory.crypto.accuracy).toBe(100);
    });
  });

  describe('getResolutionRate', () => {
    it('returns 100 when no voided markets', () => {
      resolutionTracker.recordResolution({ id: 'm1', outcomes: [{ label: 'Yes', probability: 50 }] }, 'Yes');
      expect(resolutionTracker.getResolutionRate()).toBe(100);
    });

    it('excludes voided markets from rate', () => {
      resolutionTracker.recordResolution({ id: 'm1', outcomes: [{ label: 'Yes', probability: 50 }] }, 'Yes');
      resolutionTracker.recordResolution({ id: 'm2', outcomes: [{ label: 'Yes', probability: 50 }] }, 'voided');
      expect(resolutionTracker.getResolutionRate()).toBe(50);
    });
  });
});
