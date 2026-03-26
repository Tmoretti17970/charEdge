# Prediction Markets — Developer Guide

## Architecture Overview

The prediction markets feature is a full-stack aggregation platform that pulls data from 5 sources, normalizes it into a canonical schema, and presents it through an Apple-caliber UI.

### Data Flow

```
Adapters (5 sources)
  → PredictionAggregator (parallel fetch, error isolation)
    → PredictionDeduplicator (TF-IDF similarity)
      → TimeClassifier + TopicTagGenerator + StatsService
        → usePredictionStore (Zustand)
          → UI Components (Grid/List/Detail/Heatmap)
```

## Data Sources

| Source     | Type                 | API                                     | Auth          |
| ---------- | -------------------- | --------------------------------------- | ------------- |
| Kalshi     | CFTC-regulated       | `api.elections.kalshi.com/trade-api/v2` | None (public) |
| Polymarket | Largest by volume    | `gamma-api.polymarket.com`              | None (public) |
| Metaculus  | Calibrated forecasts | `metaculus.com/api2`                    | None (public) |
| Manifold   | Play-money, diverse  | `api.manifold.markets/v0`               | None (public) |
| Drift      | Solana on-chain      | `mainnet-beta.api.drift.trade`          | None (public) |

### Adapter Pattern

Each adapter exports: `fetchXMarkets({ category?, limit? })` → `PredictionMarket[]`

Adapters normalize to the canonical schema via `createMarket()` from `PredictionMarketSchema.js`.

## Canonical Schema

See `src/data/schemas/PredictionMarketSchema.js` for full type definitions.

Key fields: `id, source, question, category, subcategory, outcomes[], marketType, volume24h, change24h, closeDate, tags[], url`

## State Management

| Store                           | Purpose                      | Persistence  |
| ------------------------------- | ---------------------------- | ------------ |
| `usePredictionStore`            | Core markets, filters, stats | Memory only  |
| `usePredictionDetailStore`      | Detail panel state           | Memory only  |
| `usePredictionWatchlistStore`   | Bookmarked markets           | localStorage |
| `usePredictionAlertStore`       | Price threshold alerts       | Memory only  |
| `usePredictionLeaderboardStore` | Prediction accuracy tracking | localStorage |

## Component Map

```
PredictionsPage
├── PredictionStatsBar (aggregate metrics)
├── PredictionCategoryTabs (15 categories + subcategory pills)
├── PredictionSidebar (time filters + topic tags)
├── PredictionToolbar (search + sort + platform filter + view toggle)
├── PredictionGrid / PredictionListRow (grid/list views)
│   └── PredictionMarketCard (multi-outcome cards)
├── PredictionHeatmap (treemap visualization, lazy-loaded)
├── PredictionDetailPanel (slide-in, lazy-loaded)
│   ├── OverviewTab (AI summary, outcomes, tags, resolution, alerts)
│   ├── ChartTab (placeholder for probability chart)
│   ├── BookTab (order book visualization)
│   ├── CompareTab (cross-platform prices)
│   └── RelatedTab (related markets by tags/tickers)
├── PredictionCalendar (resolution date calendar)
├── PredictionLeaderboard (accuracy tracker)
├── AdvancedFilter (power-user query builder)
├── EmbedWidget (shareable embed generator)
├── ShareMarketCard (social sharing modal)
└── PredictionErrorBoundary (granular error isolation)
```

## Hooks

- `usePredictionURLSync` — Syncs filter state to URL hash params for deep-linking
- `usePredictionKeyboard` — Keyboard shortcuts (/, Esc, G, 1-9)

## Services

| Service                  | Purpose                         |
| ------------------------ | ------------------------------- |
| `PredictionAggregator`   | Multi-source orchestration      |
| `PredictionDeduplicator` | TF-IDF + entity-based dedup     |
| `TopicTagGenerator`      | Auto-extract 35+ topics         |
| `PredictionStatsService` | Aggregate stats                 |
| `TimeClassifier`         | 10 time buckets                 |
| `TrendingAlgorithm`      | Weighted trending score         |
| `AIMarketSummarizer`     | Template-based market summaries |

## Key Design Decisions

1. **Fallback data**: Every adapter provides fallback markets for offline/demo mode
2. **Error isolation**: `Promise.allSettled` ensures one adapter failure doesn't block UI
3. **Deduplication**: Markets from multiple sources are merged by semantic similarity
4. **Lazy loading**: Heatmap and detail panel are React.lazy for performance
5. **Error boundaries**: Each section wrapped independently so failures are contained
6. **View modes**: Grid (3-column) and list (dense table) with keyboard toggle

## Adding a New Data Source

1. Create `src/data/adapters/NewSourceAdapter.js`
2. Export `fetchNewSourceMarkets({ category?, limit? })` returning `PredictionMarket[]`
3. Use `createMarket()` from schema to normalize data
4. Register in `PredictionAggregator.js` source registry
5. Add to `SOURCE_CONFIG` in `PredictionMarketSchema.js`

## Keyboard Shortcuts

| Key      | Action                                     |
| -------- | ------------------------------------------ |
| `/`      | Focus search                               |
| `Escape` | Close panel / clear search / clear filters |
| `G`      | Toggle grid/list view                      |
| `1-9`    | Switch category tabs                       |

## Route

`/predictions` — registered in `PageRouter.jsx` and `NavigationConfig.ts`

Deep-linkable with URL params: `#/predictions?category=crypto&sort=trending&q=bitcoin`
