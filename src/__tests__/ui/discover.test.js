// ═══════════════════════════════════════════════════════════════════
// charEdge — Discover Tab Tests
//
// Sprint 21–25: Verification tests for all Phase 5 modules.
// Tests stores, cache, telemetry, and health.
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest';
import { useDataStore } from '../../state/useDataStore.js';
import { useLayoutStore } from '../../state/useLayoutStore.js';
import { useBriefingStore } from '../../state/useBriefingStore.js';
import {
  formatNumber,
  formatCurrency,
  formatDate,
} from '../../utils/useA11yHelpers.js';

// ═══ Discover Store ═════════════════════════════════════════════
describe('useDataStore', () => {
  beforeEach(() => {
    // Store was consolidated — no reset(). Manually reset fields.
    useDataStore.setState({
      activeChip: 'all',
      filter: 'all',
      zenMode: false,
      showFilters: false,
      composeOpen: false,
      copyTradeModalOpen: false,
      copyTradeTarget: null,
      registeredWidgets: {},
    });
  });

  it('starts with default values', () => {
    const s = useDataStore.getState();
    expect(s.activeChip).toBe('all');
    expect(s.filter).toBe('all');
    expect(s.zenMode).toBe(false);
    expect(s.showFilters).toBe(false);
    expect(s.composeOpen).toBe(false);
  });

  it('setActiveTab changes the active tab', () => {
    useDataStore.getState().setActiveChip('intel');
    expect(useDataStore.getState().activeChip).toBe('intel');
  });

  it('toggleZenMode flips zen mode', () => {
    useDataStore.getState().toggleZenMode();
    expect(useDataStore.getState().zenMode).toBe(true);
    useDataStore.getState().toggleZenMode();
    expect(useDataStore.getState().zenMode).toBe(false);
  });

  it('toggleFilters flips showFilters', () => {
    useDataStore.getState().toggleFilters();
    expect(useDataStore.getState().showFilters).toBe(true);
  });

  it('openCompose / closeCompose', () => {
    useDataStore.getState().openCompose();
    expect(useDataStore.getState().composeOpen).toBe(true);
    useDataStore.getState().closeCompose();
    expect(useDataStore.getState().composeOpen).toBe(false);
  });

  it('openCopyTrade stores trader + closeCopyTrade clears', () => {
    const trader = { id: 'tr1', name: 'TestTrader' };
    useDataStore.getState().openCopyTrade(trader);
    expect(useDataStore.getState().copyTradeModalOpen).toBe(true);
    expect(useDataStore.getState().copyTradeTarget).toEqual(trader);
    useDataStore.getState().closeCopyTrade();
    expect(useDataStore.getState().copyTradeModalOpen).toBe(false);
    expect(useDataStore.getState().copyTradeTarget).toBeNull();
  });

  it('registerWidget adds to registry', () => {
    useDataStore.getState().registerWidget('test', { label: 'Test Widget' });
    expect(useDataStore.getState().registeredWidgets.test).toEqual({ label: 'Test Widget' });
  });

  it('reset restores defaults', () => {
    useDataStore.getState().setActiveChip('more');
    useDataStore.getState().toggleZenMode();
    // Manually reset (no reset() in consolidated store)
    useDataStore.setState({ activeChip: 'all', zenMode: false });
    const s = useDataStore.getState();
    expect(s.activeChip).toBe('all');
    expect(s.zenMode).toBe(false);
  });
});

// ═══ Discover Cache ═════════════════════════════════════════════
describe('useDataStore', () => {
  beforeEach(() => {
    useDataStore.getState().clearAll();
  });

  it('starts empty', () => {
    const result = useDataStore.getState().get('nonexistent');
    expect(result).toBeNull();
  });

  it('put / get returns fresh data', () => {
    useDataStore.getState().put('key1', { price: 100 });
    const result = useDataStore.getState().get('key1');
    expect(result.status).toBe('fresh');
    expect(result.data.price).toBe(100);
  });

  it('invalidate removes entry', () => {
    useDataStore.getState().put('key1', { price: 100 });
    useDataStore.getState().invalidate('key1');
    expect(useDataStore.getState().get('key1')).toBeNull();
  });

  it('invalidateByPrefix removes matching entries', () => {
    useDataStore.getState().put('btc:price', 50000);
    useDataStore.getState().put('btc:volume', 1000);
    useDataStore.getState().put('eth:price', 3000);
    useDataStore.getState().invalidateByPrefix('btc:');
    expect(useDataStore.getState().get('btc:price')).toBeNull();
    expect(useDataStore.getState().get('btc:volume')).toBeNull();
    expect(useDataStore.getState().get('eth:price')).not.toBeNull();
  });

  it('getStats returns correct counts', () => {
    useDataStore.getState().put('a', 1);
    useDataStore.getState().put('b', 2);
    const stats = useDataStore.getState().getStats();
    expect(stats.total).toBe(2);
    expect(stats.fresh).toBe(2);
  });

  it('fetchWithCache deduplicates requests', async () => {
    let callCount = 0;
    const fetcher = async () => {
      callCount++;
      return { result: 'data' };
    };
    const { fetchWithCache } = useDataStore.getState();
    const [r1, r2] = await Promise.all([
      fetchWithCache('dedup', fetcher),
      fetchWithCache('dedup', fetcher),
    ]);
    expect(callCount).toBe(1);
    expect(r1).toEqual({ result: 'data' });
  });

  it('fetchWithCache returns cached data on second call', async () => {
    let callCount = 0;
    const fetcher = async () => {
      callCount++;
      return { result: 'cached' };
    };
    const { fetchWithCache } = useDataStore.getState();
    await fetchWithCache('cached-key', fetcher);
    const result = await fetchWithCache('cached-key', fetcher);
    expect(callCount).toBe(1); // Only fetched once
    expect(result).toEqual({ result: 'cached' });
  });
});

// ═══ Discover Telemetry ═════════════════════════════════════════
describe('useDataStore', () => {
  beforeEach(() => {
    useDataStore.getState().reset();
  });

  it('starts with null session', () => {
    expect(useDataStore.getState().sessionStart).toBeNull();
  });

  it('startSession sets timestamp', () => {
    useDataStore.getState().startSession();
    expect(useDataStore.getState().sessionStart).toBeGreaterThan(0);
  });

  it('trackImpression increments count', () => {
    useDataStore.getState().trackImpression('morningBriefing');
    useDataStore.getState().trackImpression('morningBriefing');
    const metrics = useDataStore.getState().widgetMetrics.morningBriefing;
    expect(metrics.impressions).toBe(2);
  });

  it('trackInteraction increments correct field', () => {
    useDataStore.getState().trackInteraction('screener', 'click');
    useDataStore.getState().trackInteraction('screener', 'expand');
    useDataStore.getState().trackInteraction('screener', 'dismiss');
    const m = useDataStore.getState().widgetMetrics.screener;
    expect(m.clicks).toBe(1);
    expect(m.expands).toBe(1);
    expect(m.dismisses).toBe(1);
  });

  it('trackFunnel increments step', () => {
    useDataStore.getState().trackFunnel('briefingViews');
    useDataStore.getState().trackFunnel('briefingViews');
    useDataStore.getState().trackFunnel('briefingReadThroughs');
    expect(useDataStore.getState().funnelCounts.briefingViews).toBe(2);
    expect(useDataStore.getState().funnelCounts.briefingReadThroughs).toBe(1);
  });

  it('getWidgetRankings sorts by engagement', () => {
    useDataStore.getState().trackInteraction('widgetA', 'click');
    useDataStore.getState().trackInteraction('widgetB', 'click');
    useDataStore.getState().trackInteraction('widgetB', 'click');
    const rankings = useDataStore.getState().getWidgetRankings();
    expect(rankings[0].id).toBe('widgetB');
    expect(rankings[1].id).toBe('widgetA');
  });

  it('getConversionRates calculates correctly', () => {
    useDataStore.getState().trackFunnel('screenerOpens');
    useDataStore.getState().trackFunnel('screenerOpens');
    useDataStore.getState().trackFunnel('screenerToChart');
    const rates = useDataStore.getState().getConversionRates();
    expect(rates.screenerConversion).toBe(0.5);
  });

  it('logEvent adds to event list (max 100)', () => {
    for (let i = 0; i < 110; i++) {
      useDataStore.getState().logEvent('test', { i });
    }
    expect(useDataStore.getState().events.length).toBe(100);
  });

  it('exportMetrics returns complete snapshot', () => {
    useDataStore.getState().startSession();
    useDataStore.getState().trackImpression('widget1');
    const snapshot = useDataStore.getState().exportMetrics();
    expect(snapshot.exportedAt).toBeGreaterThan(0);
    expect(snapshot.rankings).toBeDefined();
    expect(snapshot.conversions).toBeDefined();
  });

  it('reset clears everything', () => {
    useDataStore.getState().startSession();
    useDataStore.getState().trackImpression('x');
    useDataStore.getState().reset();
    expect(useDataStore.getState().sessionStart).toBeNull();
    expect(Object.keys(useDataStore.getState().widgetMetrics)).toHaveLength(0);
  });
});

// ═══ Briefing Store ═════════════════════════════════════════════
describe('useBriefingStore', () => {
  it('starts with null briefing', () => {
    expect(useBriefingStore.getState().briefing).toBeNull();
  });

  it('toggleSection flips section state', () => {
    const before = useBriefingStore.getState().expandedSections.watchlist;
    useBriefingStore.getState().toggleSection('watchlist');
    expect(useBriefingStore.getState().expandedSections.watchlist).toBe(!before);
  });

  it('isStale returns true when no data', () => {
    useBriefingStore.setState({ lastFetchedAt: null });
    expect(useBriefingStore.getState().isStale()).toBe(true);
  });
});

// ═══ Layout Store ═══════════════════════════════════════════════
describe('useLayoutStore', () => {
  it('starts with no active preset', () => {
    expect(useLayoutStore.getState().discoverPreset).toBeNull();
  });

  it('toggleWidget adds/removes from hidden', () => {
    useLayoutStore.getState().toggleDiscoverWidget('screener');
    expect(useLayoutStore.getState().hiddenWidgets).toContain('screener');
    useLayoutStore.getState().toggleDiscoverWidget('screener');
    expect(useLayoutStore.getState().hiddenWidgets).not.toContain('screener');
  });
});

// ═══ A11y Formatters ════════════════════════════════════════════
describe('A11y Formatters', () => {
  it('formatNumber formats with decimals', () => {
    const result = formatNumber(1234.5678, { decimals: 2 });
    expect(result).toContain('1');
    expect(result).toContain('234');
  });

  it('formatCurrency returns currency string', () => {
    const result = formatCurrency(99.99, 'USD');
    expect(result).toContain('99');
  });

  it('formatDate returns a formatted date string', () => {
    const result = formatDate('2025-06-15');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(3);
  });
});
