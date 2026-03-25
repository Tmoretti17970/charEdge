// ═══════════════════════════════════════════════════════════════════
// charEdge — ModelQualityTracker Tests (Sprint 27)
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ModelQualityTracker } from '../../ai/ModelQualityTracker';

// Mock localStorage
const storage = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
  clear: () => storage.clear(),
});

describe('ModelQualityTracker', () => {
  let tracker: InstanceType<typeof ModelQualityTracker>;

  beforeEach(() => {
    storage.clear();
    // Create a fresh instance each test (reads from empty localStorage)
    tracker = new ModelQualityTracker();
  });

  describe('recordInteraction', () => {
    it('increments interaction count', () => {
      tracker.recordInteraction('Hello world response', 100, 'small');
      expect(tracker.getSummary().interactionCount).toBe(1);
    });

    it('tracks total response length', () => {
      tracker.recordInteraction('Short', 100, 'small');
      tracker.recordInteraction('Longer response text here', 150, 'small');
      const summary = tracker.getSummary();
      expect(summary.avgResponseLength).toBeGreaterThan(0);
    });

    it('counts short responses', () => {
      tracker.recordInteraction('Hi', 50, 'small'); // short (< 50 chars)
      tracker.recordInteraction('x'.repeat(100), 50, 'small'); // not short
      const summary = tracker.getSummary();
      expect(summary.shortResponseRate).toBe(0.5);
    });

    it('persists to localStorage', () => {
      tracker.recordInteraction('Test response', 100, 'small');
      expect(storage.has('charEdge-model-quality')).toBe(true);
    });
  });

  describe('shouldSuggestUpgrade', () => {
    it('does NOT suggest upgrade before 10 interactions', () => {
      for (let i = 0; i < 9; i++) {
        tracker.recordInteraction('Hi', 50, 'small'); // all short
      }
      expect(tracker.shouldSuggestUpgrade()).toBe(false);
    });

    it('suggests upgrade after 10+ interactions with >30% short responses on small model', () => {
      for (let i = 0; i < 10; i++) {
        tracker.recordInteraction('Hi', 50, 'small'); // all short (100% short rate)
      }
      expect(tracker.shouldSuggestUpgrade()).toBe(true);
    });

    it('does NOT suggest upgrade if short rate is low', () => {
      for (let i = 0; i < 10; i++) {
        // 10 long responses — 0% short rate
        tracker.recordInteraction('x'.repeat(200), 50, 'small');
      }
      expect(tracker.shouldSuggestUpgrade()).toBe(false);
    });

    it('does NOT suggest upgrade for non-small models', () => {
      for (let i = 0; i < 10; i++) {
        tracker.recordInteraction('Hi', 50, 'medium'); // all short, but medium model
      }
      expect(tracker.shouldSuggestUpgrade()).toBe(false);
    });
  });

  describe('getSummary', () => {
    it('returns zero values when no interactions', () => {
      const summary = tracker.getSummary();
      expect(summary.interactionCount).toBe(0);
      expect(summary.avgResponseLength).toBe(0);
      expect(summary.avgLatencyMs).toBe(0);
    });

    it('calculates average latency', () => {
      tracker.recordInteraction('Test', 100, 'small');
      tracker.recordInteraction('Test', 200, 'small');
      expect(tracker.getSummary().avgLatencyMs).toBe(150);
    });

    it('includes upgrade reason when upgrade is suggested', () => {
      for (let i = 0; i < 12; i++) {
        tracker.recordInteraction('Hi', 50, 'small');
      }
      const summary = tracker.getSummary();
      expect(summary.suggestUpgrade).toBe(true);
      expect(summary.upgradeReason).toContain('Qwen');
    });

    it('has null upgrade reason when not suggested', () => {
      tracker.recordInteraction('x'.repeat(200), 50, 'small');
      expect(tracker.getSummary().upgradeReason).toBeNull();
    });
  });

  describe('reset', () => {
    it('clears all metrics', () => {
      for (let i = 0; i < 5; i++) {
        tracker.recordInteraction('Test', 100, 'small');
      }
      tracker.reset();
      expect(tracker.getSummary().interactionCount).toBe(0);
    });
  });
});
