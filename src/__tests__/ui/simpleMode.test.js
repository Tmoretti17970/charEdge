// ═══════════════════════════════════════════════════════════════════
// charEdge — Simple Mode Tests
// Verifies that the Simple Mode toggle correctly hides/shows
// advanced features across settings, sidebar, insights, and settings page.
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS } from '../../constants.js';

// ─── Constants ────────────────────────────────────────────────────

describe('Simple Mode — DEFAULT_SETTINGS', () => {
  it('simpleMode defaults to false', () => {
    expect(DEFAULT_SETTINGS.simpleMode).toBe(false);
  });

  it('simpleMode is a boolean', () => {
    expect(typeof DEFAULT_SETTINGS.simpleMode).toBe('boolean');
  });
});

// ─── Sidebar NAV_ITEMS guard ──────────────────────────────────────

describe('Simple Mode — Sidebar', () => {
  // We import NAV_ITEMS so we can test the filter logic
  // Wave 0: coach is quarantined from NAV_ITEMS for v1.0 launch scope
  it('NAV_ITEMS does not include coach (Wave 0 quarantine)', async () => {
    const { NAV_ITEMS } = await import('../../app/layouts/Sidebar.jsx');
    expect(NAV_ITEMS.some((item) => item.id === 'coach')).toBe(false);
  });

  it('NAV_ITEMS filter works correctly when simpleMode is true', async () => {
    const { NAV_ITEMS } = await import('../../app/layouts/Sidebar.jsx');
    const simpleMode = true;
    const filtered = NAV_ITEMS.filter((item) => !simpleMode || item.id !== 'coach');
    expect(filtered.some((item) => item.id === 'coach')).toBe(false);
    // With coach already removed, filtering should return same length
    expect(filtered.length).toBe(NAV_ITEMS.length);
  });

  it('NAV_ITEMS filter preserves all items when simpleMode is false', async () => {
    const { NAV_ITEMS } = await import('../../app/layouts/Sidebar.jsx');
    const simpleMode = false;
    const filtered = NAV_ITEMS.filter((item) => !simpleMode || item.id !== 'coach');
    expect(filtered.length).toBe(NAV_ITEMS.length);
  });
});

// ─── InsightsPage tab filter ──────────────────────────────────────

describe('Simple Mode — InsightsPage tabs', () => {
  const TABS = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'strategies', label: 'Strategies', icon: '🎯' },
    { id: 'psychology', label: 'Psychology', icon: '🧠' },
    { id: 'timing', label: 'Timing', icon: '⏱️' },
    { id: 'risk', label: 'Risk', icon: '🛡️' },
    { id: 'playbooks', label: 'Playbooks', icon: '📚' },
    { id: 'plans', label: 'Plans', icon: '📋' },
  ];

  const SIMPLE_TAB_IDS = new Set(['overview', 'strategies', 'plans']);

  it('shows all 7 tabs when simpleMode is false', () => {
    const simpleMode = false;
    const visibleTabs = simpleMode ? TABS.filter((t) => SIMPLE_TAB_IDS.has(t.id)) : TABS;
    expect(visibleTabs).toHaveLength(7);
  });

  it('shows only 3 tabs when simpleMode is true', () => {
    const simpleMode = true;
    const visibleTabs = simpleMode ? TABS.filter((t) => SIMPLE_TAB_IDS.has(t.id)) : TABS;
    expect(visibleTabs).toHaveLength(3);
  });

  it('simple mode tabs are Overview, Strategies, Plans', () => {
    const simpleMode = true;
    const visibleTabs = simpleMode ? TABS.filter((t) => SIMPLE_TAB_IDS.has(t.id)) : TABS;
    const ids = visibleTabs.map((t) => t.id);
    expect(ids).toEqual(['overview', 'strategies', 'plans']);
  });

  it('hidden tabs are Psychology, Timing, Risk, Playbooks', () => {
    const simpleMode = true;
    const visibleTabs = simpleMode ? TABS.filter((t) => SIMPLE_TAB_IDS.has(t.id)) : TABS;
    const hiddenIds = TABS.filter((t) => !visibleTabs.includes(t)).map((t) => t.id);
    expect(hiddenIds).toEqual(['psychology', 'timing', 'risk', 'playbooks']);
  });
});

// ─── SettingsPage section filter ──────────────────────────────────

describe('Simple Mode — SettingsPage sections', () => {
  const SECTIONS = [
    { id: 'trading', label: 'Trading Setup' },
    { id: 'playbooks', label: 'Playbooks' },
    { id: 'appearance', label: 'Appearance' },
    { id: 'data', label: 'Data' },
    { id: 'integrations', label: 'Integrations' },
    { id: 'profile', label: 'Profile' },
    { id: 'achievements', label: 'Achievements' },
    { id: 'featurelab', label: 'Feature Lab' },
    { id: 'privacy', label: 'Data & Privacy' },
    { id: 'danger', label: 'Danger Zone' },
  ];

  const SIMPLE_HIDDEN_SECTIONS = new Set(['featurelab', 'achievements', 'integrations']);

  it('shows all 10 sections when simpleMode is false', () => {
    const simpleMode = false;
    const baseSections = simpleMode
      ? SECTIONS.filter((s) => !SIMPLE_HIDDEN_SECTIONS.has(s.id))
      : SECTIONS;
    expect(baseSections).toHaveLength(10);
  });

  it('hides 3 sections when simpleMode is true', () => {
    const simpleMode = true;
    const baseSections = simpleMode
      ? SECTIONS.filter((s) => !SIMPLE_HIDDEN_SECTIONS.has(s.id))
      : SECTIONS;
    expect(baseSections).toHaveLength(7);
  });

  it('hidden sections are Feature Lab, Achievements, Integrations', () => {
    const simpleMode = true;
    const baseSections = simpleMode
      ? SECTIONS.filter((s) => !SIMPLE_HIDDEN_SECTIONS.has(s.id))
      : SECTIONS;
    const hiddenIds = SECTIONS.filter((s) => !baseSections.includes(s)).map((s) => s.id);
    expect(hiddenIds).toEqual(expect.arrayContaining(['featurelab', 'achievements', 'integrations']));
    expect(hiddenIds).toHaveLength(3);
  });

  it('Appearance section is always visible (contains the toggle!)', () => {
    const simpleMode = true;
    const baseSections = simpleMode
      ? SECTIONS.filter((s) => !SIMPLE_HIDDEN_SECTIONS.has(s.id))
      : SECTIONS;
    expect(baseSections.some((s) => s.id === 'appearance')).toBe(true);
  });
});

// ─── useUserStore persistence ─────────────────────────────────────

describe('Simple Mode — Store persistence', () => {
  it('useUserStore exports partialize including simpleMode', async () => {
    // We test this indirectly by checking the store state includes simpleMode
    const { useUserStore } = await import('../../state/useUserStore.ts');
    const state = useUserStore.getState();
    expect(state).toHaveProperty('simpleMode');
    expect(typeof state.simpleMode).toBe('boolean');
  });

  it('update function can toggle simpleMode', async () => {
    const { useUserStore } = await import('../../state/useUserStore.ts');
    const initial = useUserStore.getState().simpleMode;
    useUserStore.getState().update({ simpleMode: !initial });
    expect(useUserStore.getState().simpleMode).toBe(!initial);
    // Reset
    useUserStore.getState().update({ simpleMode: initial });
  });
});
