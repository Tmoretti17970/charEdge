# charEdge — Strategic Focus

> **Decision Date:** March 3, 2026
> **Decision:** GPU Charting Engine is the primary wedge.

## Primary Wedge: GPU Charting Engine

charEdge's competitive advantage is its **GPU-accelerated charting engine** — WebGL instanced rendering with WebGPU compute shaders, zero-idle-frame architecture, and sub-5ms frame times at 100K+ bars.

This is the core product. Every engineering decision should optimize for:

1. **Rendering performance** — frame time, throughput, memory efficiency
2. **Developer experience** — clean public API, plugin architecture, TypeScript types
3. **Feature parity** — match TradingView's charting capabilities, then exceed them

## Secondary: Journal & Gamification

The trade journal, AI coach (Char), and gamification features are **secondary priorities**. They will ship after the charting engine reaches production quality. They are not frozen — existing functionality remains — but no new development until the engine is hardened.

## Rationale

- 4 of 15 expert auditors flagged **strategic focus** as a critical gap (Musk, Kis, Gvozdev, Secunda)
- The GPU charting engine is the hardest-to-replicate moat
- Journal/gamification can be built on top of a stable engine; the reverse is not true
- The open-source charting engine (Tier 6.4) is the distribution strategy — it must be excellent standalone

## What This Means in Practice

| Area | Action |
|------|--------|
| Charting engine core | **Active development** — TypeScript migration, module decomposition, benchmarking |
| WebGL/WebGPU rendering | **Active development** — OffscreenCanvas decision, memory management |
| Public API & plugins | **Active development** — IChartEngine interface, event system, plugin registration |
| Data pipeline | **Active development** — pagination, streaming, caching |
| Trade journal | **Maintenance only** — fix bugs, no new features |
| AI Coach (Char) | **Maintenance only** — existing rule-based system stays, LLM integration deferred |
| Gamification | **Maintenance only** — existing XP/badge system stays, no new additions |
| P2P / Social | **Frozen** — already quarantined |
