// ═══════════════════════════════════════════════════════════════════
// charEdge — Simplification Strategy Tests (Phase 5 Sprint 24)
//
// Validates cognitive load scoring, audit summaries, Phase 5 impact,
// and the simplification manifesto.
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import {
  SCREEN_AUDIT,
  getAuditSummary,
  getPlatformCLS,
  getPhase5Summary,
  SIMPLIFICATION_MANIFESTO,
} from '@/a11y/cognitiveLoadAudit.ts';

// ═══ SCREEN_AUDIT ══════════════════════════════════════════════════

describe('SCREEN_AUDIT', () => {
  it('contains all 6 major screens', () => {
    const keys = Object.keys(SCREEN_AUDIT);
    expect(keys).toContain('journal_dashboard');
    expect(keys).toContain('journal_strategies');
    expect(keys).toContain('charts');
    expect(keys).toContain('markets');
    expect(keys).toContain('social');
    expect(keys).toContain('settings');
    expect(keys.length).toBe(6);
  });

  it('each screen has current and target scores', () => {
    for (const [, audit] of Object.entries(SCREEN_AUDIT)) {
      expect(audit.current).toBeDefined();
      expect(audit.target).toBeDefined();
      expect(audit.current.score).toBeGreaterThan(0);
      expect(audit.target.score).toBeGreaterThan(0);
      expect(audit.current.score).toBeGreaterThanOrEqual(audit.target.score);
      expect(audit.name).toBeTruthy();
    }
  });

  it('scores are within 1-10 range', () => {
    for (const [, audit] of Object.entries(SCREEN_AUDIT)) {
      expect(audit.current.score).toBeGreaterThanOrEqual(1);
      expect(audit.current.score).toBeLessThanOrEqual(10);
      expect(audit.target.score).toBeGreaterThanOrEqual(1);
      expect(audit.target.score).toBeLessThanOrEqual(10);
    }
  });

  it('Charts has the highest current CLS', () => {
    const scores = Object.values(SCREEN_AUDIT).map((a) => a.current.score);
    const chartScore = SCREEN_AUDIT.charts.current.score;
    expect(chartScore).toBe(Math.max(...scores));
  });
});

// ═══ getAuditSummary ═══════════════════════════════════════════════

describe('getAuditSummary', () => {
  it('returns an array with 6 entries', () => {
    const summary = getAuditSummary();
    expect(Array.isArray(summary)).toBe(true);
    expect(summary.length).toBe(6);
  });

  it('each entry has id, name, scores, and reduction', () => {
    const summary = getAuditSummary();
    for (const entry of summary) {
      expect(entry.id).toBeTruthy();
      expect(entry.name).toBeTruthy();
      expect(typeof entry.currentScore).toBe('number');
      expect(typeof entry.targetScore).toBe('number');
      expect(typeof entry.reduction).toBe('number');
      expect(entry.reduction).toBeGreaterThan(0);
    }
  });
});

// ═══ getPlatformCLS ════════════════════════════════════════════════

describe('getPlatformCLS', () => {
  it('returns current, target, and reduction', () => {
    const cls = getPlatformCLS();
    expect(typeof cls.current).toBe('number');
    expect(typeof cls.target).toBe('number');
    expect(typeof cls.reduction).toBe('number');
    expect(cls.current).toBeGreaterThan(cls.target);
    expect(cls.reduction).toBeGreaterThan(0);
  });

  it('platform current CLS is in reasonable range (5-9)', () => {
    const cls = getPlatformCLS();
    expect(cls.current).toBeGreaterThanOrEqual(5);
    expect(cls.current).toBeLessThanOrEqual(9);
  });
});

// ═══ SIMPLIFICATION_MANIFESTO ══════════════════════════════════════

describe('SIMPLIFICATION_MANIFESTO', () => {
  it('has exactly 7 principles', () => {
    expect(SIMPLIFICATION_MANIFESTO.length).toBe(7);
  });

  it('each principle is a non-empty string', () => {
    for (const p of SIMPLIFICATION_MANIFESTO) {
      expect(typeof p).toBe('string');
      expect(p.length).toBeGreaterThan(10);
    }
  });

  it('manifesto includes key themes', () => {
    const joined = SIMPLIFICATION_MANIFESTO.join(' ').toLowerCase();
    expect(joined).toContain('feature');
    expect(joined).toContain('subtract');
    expect(joined).toContain('measure');
    expect(joined).toContain('pixel');
  });
});

// ═══ getPhase5Summary ══════════════════════════════════════════════

describe('getPhase5Summary', () => {
  it('returns before, after, target, and reduction', () => {
    const summary = getPhase5Summary();
    expect(typeof summary.before).toBe('number');
    expect(typeof summary.after).toBe('number');
    expect(typeof summary.target).toBe('number');
    expect(typeof summary.reduction).toBe('number');
  });

  it('Phase 5 after is lower than before', () => {
    const summary = getPhase5Summary();
    expect(summary.after).toBeLessThan(summary.before);
  });

  it('includes 4 completed sprints (21-24)', () => {
    const summary = getPhase5Summary();
    expect(summary.sprintsCompleted.length).toBe(4);
    expect(summary.sprintsCompleted[0].id).toBe(21);
    expect(summary.sprintsCompleted[3].id).toBe(24);
  });

  it('includes screen-level Phase 5 scores', () => {
    const summary = getPhase5Summary();
    expect(summary.screens.length).toBe(6);
    for (const screen of summary.screens) {
      expect(typeof screen.phase5Score).toBe('number');
      expect(screen.phase5Score).toBeLessThanOrEqual(screen.currentScore);
    }
  });

  it('includes the manifesto', () => {
    const summary = getPhase5Summary();
    expect(summary.manifesto).toEqual(SIMPLIFICATION_MANIFESTO);
  });
});
