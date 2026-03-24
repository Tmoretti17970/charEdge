# Data Pipeline Audit

Date: 2026-03-24
Focus: Transport -> normalization -> cache -> chart runtime -> UI status

## End-to-End Pipeline (Observed)

- Transport: `src/data/WebSocketService.ts`, provider adapters under `src/data/providers/*`
- Stream orchestration: `src/data/engine/streaming/TickerPlant.ts`, `PriceAggregator.js`, `PriceBus.ts`
- Historical fetch: `src/data/FetchService.ts`, `BinanceClient.js`
- Caching tiers: `CacheManager.js`, `DataCache.ts`, `TimeSeriesStore.ts`
- Chart bridge: `src/charting_library/datafeed/DatafeedService.js`, `TickChannel.ts`
- UI status surfaces: staleness/fallback indicators under `src/app/components/chart/ui/*`

## Key Findings

### Critical
- Abort propagation appears incomplete from loader hooks through fetch services.
- Dual live/fetch orchestration paths can diverge state and source signals.

### High
- Freshness semantics may overstate recency when persisted cache is promoted.
- Source labeling can be hardcoded on success paths, reducing operator trust.
- Timeframe mapping contracts are inconsistent for non-crypto flows.
- Health/failover tracking lacks per symbol+source granularity.

### Medium
- Retry taxonomy does not clearly separate unsupported-symbol vs transient failure.
- Event fabric for data quality is partially centralized but inconsistently consumed.
- Multiple persistence pathways increase coherence/debug complexity.

## TradingView-Grade Upgrades

- Canonical `DataEnvelope` contract with timestamps and quality metadata:
  - `symbol`, `tf`, `source`, `seq`, `t_source`, `t_ingest`, `t_publish`, `ageMs`, `quality`
- Single authority ingestion for chart runtime.
- Per symbol+source health scoring for failover.
- One freshness state machine (`FRESH/WARM/STALE/DEAD`) consumed by all UI status components.
- Deterministic capture/replay harness for transport and render regressions.

## Concrete Plan

### P0 (0-2 weeks)
- Thread `AbortSignal` through all fetch/fallback paths.
- Remove duplicate stream ownership in chart path.
- Correct source metadata propagation to UI and store.

### P1 (2-6 weeks)
- Normalize timeframe contracts.
- Introduce retry classes:
  - transient network
  - rate-limited
  - unsupported/invalid symbol (negative cache)
- Add bounded queues with drop/sampling policy per consumer type.

### P2 (6-12 weeks)
- Add full observability pipeline:
  - tick-to-render latency p50/p95/p99
  - stale transition counters
  - failover causes
  - queue depth and drop rate

## Debug Metrics to Track

- Tick ingest rate by symbol/timeframe
- Cache hit by tier (memory/IDB/OPFS)
- Source-of-truth convergence time to UI
- Staleness transition frequency and duration
