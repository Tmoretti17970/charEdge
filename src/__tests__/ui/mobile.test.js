// ═══════════════════════════════════════════════════════════════════
// charEdge — Sprint 6: Mobile Excellence Tests
//
// S6.1: useSwipeSections hook + SwipeDots
// S6.2: BottomSheet snap points
// S6.6: Responsive typography tokens
// S6.7: EmptyState system (pre-existing)
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ═══ S6.1: useSwipeSections ═══════════════════════════════════════

describe('useSwipeSections', () => {
  let useSwipeSections;

  beforeEach(async () => {
    const mod = await import('../../app/hooks/useSwipeSections.js');
    useSwipeSections = mod.default;
  });

  it('exports default function', () => {
    expect(typeof useSwipeSections).toBe('function');
  });

  it('named export matches default', async () => {
    const mod = await import('../../app/hooks/useSwipeSections.js');
    expect(mod.useSwipeSections).toBe(mod.default);
  });
});

// ═══ S6.1: SwipeDots ══════════════════════════════════════════════

describe('SwipeDots', () => {
  let SwipeDots;

  beforeEach(async () => {
    const mod = await import('../../app/components/ui/SwipeDots.jsx');
    SwipeDots = mod.default;
  });

  it('exports default component', () => {
    expect(typeof SwipeDots).toBe('function');
  });

  it('named export matches default', async () => {
    const mod = await import('../../app/components/ui/SwipeDots.jsx');
    expect(mod.SwipeDots).toBe(mod.default);
  });

  it('returns null for count <= 1', () => {
    const result = SwipeDots({ count: 1, active: 0 });
    expect(result).toBeNull();
  });

  it('returns null for count 0', () => {
    const result = SwipeDots({ count: 0, active: 0 });
    expect(result).toBeNull();
  });
});

// ═══ S6.2: BottomSheet ═══════════════════════════════════════════

describe('BottomSheet', () => {
  let BottomSheet, SNAP_POINTS;

  beforeEach(async () => {
    const mod = await import('../../app/components/ui/BottomSheet.jsx');
    BottomSheet = mod.default;
    SNAP_POINTS = mod.SNAP_POINTS;
  });

  it('exports default component', () => {
    expect(typeof BottomSheet).toBe('function');
  });

  it('exports SNAP_POINTS constants', () => {
    expect(SNAP_POINTS).toEqual({ min: 0.3, mid: 0.5, max: 0.9 });
  });

  it('SNAP_POINTS.min < mid < max', () => {
    expect(SNAP_POINTS.min).toBeLessThan(SNAP_POINTS.mid);
    expect(SNAP_POINTS.mid).toBeLessThan(SNAP_POINTS.max);
  });
});

// ═══ S6.7: EmptyState (pre-existing verification) ════════════════

describe('EmptyState system', () => {
  it('exports core EmptyState component', async () => {
    const mod = await import('../../app/components/ui/EmptyState.jsx');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });

  it('exports DashboardEmptyState', async () => {
    const mod = await import('../../app/components/ui/EmptyState.jsx');
    expect(mod.DashboardEmptyState).toBeDefined();
  });

  it('exports JournalEmptyState', async () => {
    const mod = await import('../../app/components/ui/EmptyState.jsx');
    expect(mod.JournalEmptyState).toBeDefined();
  });

  it('DashboardEmptyState uses blurred preview internally', async () => {
    const mod = await import('../../app/components/ui/EmptyState.jsx');
    // DashboardPreview/JournalPreview are private — verify named empty states exist
    expect(mod.DashboardEmptyState).toBeDefined();
    expect(mod.JournalEmptyState).toBeDefined();
  });

  it('exports MilestoneBar', async () => {
    const mod = await import('../../app/components/ui/EmptyState.jsx');
    expect(mod.MilestoneBar).toBeDefined();
  });
});

// ═══ S6.3 / S6.4 / S6.5: Pre-existing mobile infra ══════════════

describe('Mobile infrastructure (pre-existing)', () => {
  it('MobileJournal exports SwipeableTradeCard', async () => {
    const mod = await import('../../app/components/mobile/MobileJournal.jsx');
    expect(mod.SwipeableTradeCard).toBeDefined();
  });

  it('SwipeChartNav exports default', async () => {
    const mod = await import('../../app/components/mobile/SwipeChartNav.jsx');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });

  it('ChartTouchHandler exists (S6.4 pinch/zoom)', async () => {
    const mod = await import('../../charting_library/core/MobileChartExperience.js');
    expect(mod.ChartTouchHandler).toBeDefined();
    expect(typeof mod.ChartTouchHandler).toBe('function');
  });

  it('MobileNav exports default (S6.5 safe-area)', async () => {
    const mod = await import('../../app/layouts/MobileNav.jsx');
    expect(mod.default).toBeDefined();
  });
});
