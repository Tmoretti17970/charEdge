// @vitest-environment jsdom
// ═══════════════════════════════════════════════════════════════════
// charEdge — HomeWatchlist Tests (Phase 2, Sprints 6–16)
//
// Source-verification tests for the Coinbase-style watchlist on the
// home dashboard.
// ═══════════════════════════════════════════════════════════════════

import fs from 'node:fs';
import { describe, it, expect } from 'vitest';

const src = fs.readFileSync('src/app/components/dashboard/HomeWatchlist.jsx', 'utf8');
const layoutSrc = fs.readFileSync('src/app/components/dashboard/DashboardNarrativeLayout.jsx', 'utf8');

describe('HomeWatchlist — Data Wiring (Sprints 6–8)', () => {
  it('imports useWatchlistStore', () => {
    expect(src).toContain('useWatchlistStore');
  });

  it('imports useWatchlistStreaming for live prices (Sprint 7)', () => {
    expect(src).toContain('useWatchlistStreaming');
  });

  it('imports Sparkline component', () => {
    expect(src).toContain("from '../ui/Sparkline.jsx'");
  });

  it('uses enrichWithTradeStats for trade P&L (Sprint 8)', () => {
    expect(src).toContain('enrichWithTradeStats');
  });

  it('uses SparklineService for sparkline data', () => {
    expect(src).toContain('SparklineService');
    expect(src).toContain('fetchSparkline');
  });
});

describe('HomeWatchlist — Top Movers (Sprint 9)', () => {
  it('has Top Movers section', () => {
    expect(src).toContain('Top Movers');
  });

  it('sorts by absolute change percent', () => {
    expect(src).toContain('Math.abs');
    expect(src).toContain('changePercent');
  });

  it('limits to 3 top movers', () => {
    expect(src).toContain('.slice(0, 3)');
  });
});

describe('HomeWatchlist — Quick Add (Sprint 10)', () => {
  it('has quick-add input', () => {
    expect(src).toContain('Add symbol');
    expect(src).toContain('addSymbol');
  });

  it('handles Enter key for adding', () => {
    expect(src).toContain("e.key === 'Enter'");
    expect(src).toContain('handleAdd');
  });
});

describe('HomeWatchlist — Portfolio Header (Sprint 11)', () => {
  it('computes aggregate portfolio P&L', () => {
    expect(src).toContain('portfolioPnl');
    expect(src).toContain('total');
    expect(src).toContain('count');
  });
});

describe('HomeWatchlist — Empty State (Sprint 12)', () => {
  it('shows empty state with popular suggestions', () => {
    expect(src).toContain('Start tracking your assets');
    expect(src).toContain('POPULAR');
  });

  it('includes popular symbols', () => {
    expect(src).toContain("symbol: 'BTC'");
    expect(src).toContain("symbol: 'ETH'");
    expect(src).toContain("symbol: 'SPY'");
    expect(src).toContain("symbol: 'AAPL'");
    expect(src).toContain("symbol: 'TSLA'");
  });
});

describe('HomeWatchlist — Layout Integration (Sprints 13–14)', () => {
  it('is imported in DashboardNarrativeLayout', () => {
    expect(layoutSrc).toContain("import HomeWatchlist from './HomeWatchlist.jsx'");
  });

  it('is rendered in the layout', () => {
    expect(layoutSrc).toContain('<HomeWatchlist');
  });

  it('heatmap moved to Show More section (Sprint 14)', () => {
    // Heatmap should appear AFTER the Show More button logic
    const showMoreIdx = layoutSrc.indexOf('Show More');
    const heatmapIdx = layoutSrc.indexOf('Activity Heatmap');
    expect(heatmapIdx).toBeGreaterThan(showMoreIdx);
  });

  it('Show More badge shows +5', () => {
    expect(layoutSrc).toContain('+5');
  });
});

describe('HomeWatchlist — Row Features', () => {
  it('renders asset class badges', () => {
    expect(src).toContain('assetClass');
  });

  it('formats prices', () => {
    expect(src).toContain('fmtPrice');
    expect(src).toContain('toLocaleString');
  });

  it('has remove button on hover', () => {
    expect(src).toContain('Remove from watchlist');
    expect(src).toContain('onRemove');
  });

  it('navigates to chart on click', () => {
    expect(src).toContain('setChartSymbol');
    expect(src).toContain("setPage('charts')");
  });

  it('uses tabular-nums for price alignment', () => {
    expect(src).toContain('tabular-nums');
  });
});
