# TradeForge OS — Architecture Guide

## Overview

TradeForge is a comprehensive trading intelligence platform built with **React + Vite**, organized into a 10-phase Data Supremacy architecture. The application provides real-time charting, order flow analysis, institutional data, and a peer-to-peer community data network — all running client-side with zero server costs.

## Technology Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 (Vite 6, lazy loading via `React.lazy`) |
| **State** | Zustand stores (`useChartStore`, `useTradeStore`, etc.) |
| **Styling** | Vanilla CSS with design tokens (`constants.js` → `C`, `M`, `F`) |
| **Data** | REST + WebSocket + SSE + P2P (WebRTC) |
| **Testing** | Vitest (75+ tests across engine modules) |
| **Build** | Vite with rollup `manualChunks` code-splitting |

## Project Structure

```
src/
├── pages/               # Top-level route pages
│   ├── ChartsPage.jsx   # Main charting view (~1500 lines)
│   ├── CommunityPage.jsx
│   ├── SettingsPage.jsx
│   └── ...
├── app/
│   ├── components/      # UI components by domain
│   │   ├── chart/       # Toolbar, canvas, overlays
│   │   ├── data/        # SentimentOverlay, TradeHeatmap, CommunitySignals
│   │   ├── dashboard/   # Home tab widgets
│   │   └── mobile/      # Mobile-optimized sheets
│   ├── hooks/           # React hooks (usePeerMesh, useOrderFlowConnection)
│   └── layouts/         # Workspace layout engine
├── data/
│   ├── DataProvider.js  # Central data hub (imports all adapters/engines)
│   ├── adapters/        # External API adapters
│   │   ├── PythAdapter.js        # Pyth Network (SSE streaming)
│   │   ├── KrakenAdapter.js      # Kraken WebSocket
│   │   ├── BinanceFuturesAdapter.js
│   │   ├── EdgarAdapter.js       # SEC EDGAR filings
│   │   ├── FredAdapter.js        # Federal Reserve data
│   │   ├── FMPAdapter.js         # Financial Modeling Prep
│   │   └── ...
│   └── engine/          # Data processing engines
│       ├── OrderFlowEngine.js
│       ├── VolumeProfileEngine.js
│       ├── DepthEngine.js
│       ├── PeerProtocol.js       # P2P message framing
│       ├── PeerMesh.js           # WebRTC mesh manager
│       ├── SentimentVoting.js    # Community sentiment
│       ├── TradeHeatmapEngine.js # Anonymized trade heatmap
│       ├── CommunitySignalEngine.js # Convergent signals
│       └── DataRelayNode.js      # WS data relay via P2P
├── state/               # Zustand stores
├── constants.js         # Design tokens, chart types, timeframes
└── __tests__/           # Vitest test suite
```

## Data Supremacy — 10 Phases

### Phase 1: Order Flow Engine
Core order flow processing: delta/CVD calculation, footprint chart bucketing, volume profile aggregation, and large trade detection.

**Key modules:** `OrderFlowEngine.js`, `VolumeProfileEngine.js`, `OrderFlowBridge.js`

---

### Phase 2: Crypto Derivatives
Binance Futures integration for open interest, funding rates, liquidation streams, and long/short ratio via WebSocket.

**Key modules:** `BinanceFuturesAdapter.js`, `DerivativesDashboard.jsx`

---

### Phase 3: Order Book Depth
Real-time order book depth visualization with bid/ask imbalance detection and DOM ladder.

**Key modules:** `DepthEngine.js`, `DepthPanel.jsx`, `DOMLadder.jsx`

---

### Phase 4: Data Redundancy
Multi-provider data pipeline: Pyth SSE, Kraken WS, Polygon REST, Alpha Vantage, FMP. `WSRouter` selects the best provider per asset class.

**Key modules:** `DataProvider.js`, `WSRouter`, `DataCache.js`

---

### Phase 5: Institutional Data
SEC EDGAR 13F parsing, FRED economic data, social sentiment (Reddit/Fear & Greed), whale alerts, and news aggregation.

**Key modules:** `EdgarAdapter.js`, `FredAdapter.js`, `SentimentAdapter.js`, `InstitutionalPanel.jsx`

---

### Phase 6: Enhanced Indicators
Extended indicator library: Ichimoku, Supertrend, VWAP Bands, OBV, MFI, ADX, CMF, Anchored VWAP.

**Key modules:** `IndicatorLibrary.js`

---

### Phase 7: Derived Data Engine
Computed metrics from raw data: momentum scoring, volatility regime detection, cross-asset correlation.

**Key modules:** `DerivedDataEngine.js`

---

### Phase 8: Options Intelligence
CBOE-style options analysis scaffolding for IV surface, put/call ratio, unusual activity.

**Key modules:** `OptionsPanel.jsx`

---

### Phase 9: Smart Multiplexing
`BinaryCodec` for efficient inter-tab communication, `TickerPlant` predictive prefetching, smart symbol registry.

**Key modules:** `BinaryCodec.js`, `TickerPlant.js`, `SymbolRegistry.js`

---

### Phase 10: P2P Community Data Network
Zero-server-cost peer-to-peer data sharing via WebRTC.

| Component | Module | Purpose |
|-----------|--------|---------|
| Protocol | `PeerProtocol.js` | Message framing, rate limiting (10/s), dedup (60s nonce), handshake |
| Mesh | `PeerMesh.js` | WebRTC connections, BroadcastChannel discovery, max 8 peers, 30s heartbeat |
| Hook | `usePeerMesh.js` | React lifecycle, reactive peer count, send/broadcast/onMessage |
| Sentiment | `SentimentVoting.js` | Bullish/bearish voting with exponential decay (1hr half-life), 5min cooldown |
| Heatmap | `TradeHeatmapEngine.js` | Anonymized trade density (0.1% buckets), 40-bin histogram, opt-in |
| Signals | `CommunitySignalEngine.js` | Fires when ≥3 peers trigger same indicator within 60s |
| Relay | `DataRelayNode.js` | Shares WS data via token-bucket (5 msg/s) to reduce API load |

## Build & Code Splitting

The production bundle uses `rollup manualChunks` to split into:

| Chunk | Contents |
|-------|----------|
| `vendor-react` | React, ReactDOM, Scheduler |
| `vendor` | All other node_modules |
| `data-engines` | P2P, order flow, depth engines |
| `data-adapters` | External API adapters |
| `chart-tools` | Backtester, strategy builder, analysis |
| Page chunks | ChartsPage, CommunityPage, SettingsPage (lazy) |

## Testing

```bash
npx vitest run           # Run all tests
npx vitest run --watch   # Watch mode
```

Engine modules have dedicated test files in `src/__tests__/`:
- `peerProtocol.test.js` — 19 tests (envelope, rate limiter, dedup)
- `sentimentVoting.test.js` — 18 tests (voting, cooldown, aggregation)
- `tradeHeatmapEngine.test.js` — 21 tests (anonymization, binning, privacy)
- `communitySignalEngine.test.js` — 17 tests (quorum, dedup, history)
