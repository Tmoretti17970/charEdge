// ═══════════════════════════════════════════════════════════════════
// charEdge — AdaptiveCoach Tests (AI Copilot Sprint 4)
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest';

// Shim localStorage for vitest (not available in Node)
if (typeof globalThis.localStorage === 'undefined') {
  const store: Record<string, string> = {};
  (globalThis as unknown as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
  };
}

import { AdaptiveCoach } from '../ai/AdaptiveCoach';

describe('AdaptiveCoach', () => {
  let coach: AdaptiveCoach;

  beforeEach(() => {
    localStorage.clear();
    coach = new AdaptiveCoach();
  });

  it('starts with default preferences', () => {
    const prefs = coach.getPreferences();
    expect(prefs.tone).toBe('supportive');
    expect(prefs.verbosity).toBe('normal');
    expect(prefs.frequency).toBe('medium');
  });

  it('records interactions and increments count', () => {
    expect(coach.totalInteractions).toBe(0);
    coach.recordInteraction('risk', 'acknowledged');
    expect(coach.totalInteractions).toBe(1);
    coach.recordInteraction('risk', 'dismissed');
    expect(coach.totalInteractions).toBe(2);
  });

  it('adjusts tone for frequently dismissed categories', () => {
    // Dismiss risk coaching many times
    for (let i = 0; i < 5; i++) {
      coach.recordInteraction('risk', 'dismissed');
    }
    // Should switch to analytical for low engagement
    const tone = coach.getToneForCategory('risk');
    expect(tone).toBe('analytical');
  });

  it('keeps direct tone for highly engaged + acted categories', () => {
    for (let i = 0; i < 5; i++) {
      coach.recordInteraction('timing', 'acted');
    }
    const tone = coach.getToneForCategory('timing');
    expect(tone).toBe('direct');
  });

  it('formatMessage applies tone prefix', () => {
    const msg = coach.formatMessage('Tighten your stop losses', 'risk');
    expect(msg.length).toBeGreaterThan(0);
    expect(msg).toContain('Tighten your stop losses');
  });

  it('shouldShowMessage respects frequency cooldown', () => {
    // First time — should show
    expect(coach.shouldShowMessage('risk')).toBe(true);

    // Record interaction, then check cooldown
    coach.recordInteraction('risk', 'acknowledged');
    // Immediately after — should be on cooldown (medium = 30min)
    expect(coach.shouldShowMessage('risk')).toBe(false);
  });

  it('shouldShowMessage suppresses heavily dismissed categories', () => {
    for (let i = 0; i < 4; i++) {
      coach.recordInteraction('psychology', 'dismissed');
    }
    // 4 dismissals, 0 acknowledges — should suppress
    expect(coach.shouldShowMessage('psychology')).toBe(false);
  });

  it('effectiveness report shows correct engagement rates', () => {
    coach.recordInteraction('risk', 'acknowledged');
    coach.recordInteraction('risk', 'acknowledged');
    coach.recordInteraction('risk', 'dismissed');

    const report = coach.getEffectivenessReport();
    expect(report.risk.total).toBe(3);
    expect(report.risk.engagementRate).toBeCloseTo(2 / 3, 2);
  });

  it('getCoachingSummaryForAI returns string', () => {
    const summary = coach.getCoachingSummaryForAI();
    expect(typeof summary).toBe('string');
    expect(summary).toContain('supportive');
  });

  it('adapts global preferences after many interactions', () => {
    // Create a pattern: user loves expanding details
    const categories = ['risk', 'psychology', 'timing', 'performance', 'improvement'] as const;
    for (const cat of categories) {
      coach.recordInteraction(cat, 'expanded');
    }
    const prefs = coach.getPreferences();
    expect(prefs.verbosity).toBe('detailed');
  });

  it('reset clears all data', () => {
    coach.recordInteraction('risk', 'acknowledged');
    expect(coach.totalInteractions).toBe(1);
    coach.reset();
    expect(coach.totalInteractions).toBe(0);
    expect(coach.getPreferences().tone).toBe('supportive');
  });
});
