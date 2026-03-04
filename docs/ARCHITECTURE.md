# charEdge Architecture Overview

> End-to-end data flow from market data sources to rendered chart pixels.

## System Architecture

```mermaid
graph TD
    subgraph Sources["Data Sources"]
        BIN[Binance WS]
        PYT[Pyth SSE]
        KRA[Kraken WS]
        BYB[Bybit WS]
        OKX[OKX WS]
        COI[Coinbase WS]
        FIN[Finnhub WS]
        FRX[Forex Multi]
    end

    subgraph DataLayer["Data Layer"]
        TP["TickerPlant\n(streaming/TickerPlant.ts)"]
        PA["PriceAggregator\n(confidence-weighted)"]
        DP["DataPipeline\n(data/engine/)"]
        SW["SharedWorker\n(cross-tab dedup)"]
        BC["BinaryCodec\n(MessagePack)"]
        AP["AdaptivePoller\n(REST fallback)"]
    end

    subgraph Engine["Chart Engine"]
        CE["ChartEngine\n(core/ChartEngine.ts)"]
        FS["FrameState\n(immutable snapshot)"]
        RP["RenderPipeline\n(7-stage)"]
        IM["InputManager\n(mouse/touch/keys)"]
        DE["DrawingEngine\n(tools/DrawingEngine.ts)"]
        SG["SceneGraph\n(spatial index)"]
    end

    subgraph Pipeline["Render Pipeline Stages"]
        S1["1. GridStage"]
        S2["2. DataStage"]
        S3["3. GPUComputeStage"]
        S4["4. IndicatorStage"]
        S5["5. DrawingStage"]
        S6["6. OverlayStage"]
        S7["7. AxesStage + UIStage"]
    end

    subgraph GPU["GPU Acceleration"]
        WGL["WebGLRenderer\n(candles/volume/lines)"]
        WGC["WebGPUCompute\n(EMA/RSI/MACD/BB/LTTB)"]
        WB["WorkerBridge\n(indicator offload)"]
    end

    subgraph Display["Display"]
        LM["LayerManager\n(5-layer compositing)"]
        L1["Layer 1: Grid"]
        L2["Layer 2: Data"]
        L3["Layer 3: Indicators"]
        L4["Layer 4: Drawings"]
        L5["Layer 5: UI/Crosshair"]
        GL["WebGL Canvas\n(z-index 6)"]
    end

    BIN & PYT & KRA & BYB & OKX & COI & FIN & FRX --> TP
    TP --> PA
    TP <--> SW
    TP --> BC
    TP --> AP
    PA --> DP
    DP --> CE

    CE --> FS
    FS --> RP
    IM --> CE
    CE --> DE
    DE --> SG

    RP --> S1 --> S2 --> S3 --> S4 --> S5 --> S6 --> S7

    S2 --> WGL
    S3 --> WGC
    S4 --> WB

    S1 --> L1
    S2 --> L2
    S4 --> L3
    S5 --> L4
    S7 --> L5
    WGL --> GL
    LM --> L1 & L2 & L3 & L4 & L5

    style Sources fill:#1a1a2e,stroke:#e94560,color:#fff
    style DataLayer fill:#16213e,stroke:#0f3460,color:#fff
    style Engine fill:#0f3460,stroke:#533483,color:#fff
    style Pipeline fill:#533483,stroke:#e94560,color:#fff
    style GPU fill:#e94560,stroke:#fff,color:#fff
    style Display fill:#1a1a2e,stroke:#0f3460,color:#fff
```

## Key Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| **Demand-driven rendering** | 0% CPU when idle — only renders when data changes |
| **5-layer compositing** | Independent dirty tracking per layer avoids full repaints |
| **WebGPU compute** | 50-150x speedup for EMA/RSI/LTTB on GPU cores |
| **SharedWorker dedup** | Single WebSocket connection shared across browser tabs |
| **Binary wire format** | 3x bandwidth savings via MessagePack encoding |
| **7-stage pipeline** | Each stage can skip if its layer is clean |

## File Map

| Component | Path | Lines | Language |
|-----------|------|-------|----------|
| ChartEngine | `src/charting_library/core/ChartEngine.ts` | 750 | TypeScript |
| WebGPUCompute | `src/charting_library/renderers/WebGPUCompute.ts` | 678 | TypeScript |
| WebGLRenderer | `src/charting_library/renderers/WebGLRenderer.ts` | ~800 | TypeScript |
| TickerPlant | `src/data/engine/streaming/TickerPlant.ts` | 920 | TypeScript |
| DrawingEngine | `src/charting_library/tools/DrawingEngine.ts` | ~600 | TypeScript |
| RenderPipeline | `src/charting_library/core/RenderPipeline.ts` | ~200 | TypeScript |
| LayerManager | `src/charting_library/core/LayerManager.js` | ~150 | JavaScript |
| WorkerBridge | `src/charting_library/core/WorkerBridge.js` | ~130 | JavaScript |
