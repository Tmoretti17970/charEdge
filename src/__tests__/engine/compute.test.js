// ═══════════════════════════════════════════════════════════════════
// charEdge — Phase 1 Compute & Data Pipeline Tests
//
// Covers: 1.2.1 ComputeWorkerPool wiring, 1.2.2 GPUComputeStage,
//         1.3.1 DataSharedWorker in boot, 1.3.2 BinaryCodec WS
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readSource(relPath) {
  return fs.readFileSync(path.resolve(__dirname, '..', '..', relPath), 'utf-8');
}

// ═══════════════════════════════════════════════════════════════════
// 1.2.1 — ComputeWorkerPool wired into chart engine
// ═══════════════════════════════════════════════════════════════════

describe('1.2.1 — ComputeWorkerPool wired into indicator computation', () => {
  let widgetSource, bridgeSource;

  beforeAll(() => {
    widgetSource = readSource('app/components/chart/core/ChartEngineWidget.jsx');
    bridgeSource = readSource('data/engine/indicators/IndicatorWorkerBridge.js');
  });

  it('ChartEngineWidget imports indicatorBridge', () => {
    expect(widgetSource).toContain("import { indicatorBridge }");
    expect(widgetSource).toContain("IndicatorWorkerBridge");
  });

  it('ChartEngineWidget calls indicatorBridge.computeBatch() for full recompute', () => {
    expect(widgetSource).toContain('indicatorBridge.computeBatch(batchTasks, bars)');
  });

  it('ChartEngineWidget keeps synchronous update() for tick updates', () => {
    expect(widgetSource).toContain('inst.update(bars)');
  });

  it('IndicatorWorkerBridge does NOT check for non-existent this._worker', () => {
    // The bug was: if (!this._fallback && this._ready && this._worker)
    // Fixed to: if (!this._fallback && this._ready)
    const computeSection = bridgeSource.slice(
      bridgeSource.indexOf('async compute(indicator'),
      bridgeSource.indexOf('async computeBatch')
    );
    expect(computeSection).not.toContain('this._worker');
  });

  // TODO: un-skip when IndicatorWorkerBridge routes through ComputeWorkerPool (Task 1.2)
  it.skip('IndicatorWorkerBridge routes through ComputeWorkerPool', () => {
    expect(bridgeSource).toContain("import { computePool } from '../../infra/ComputeWorkerPool.js'");
    expect(bridgeSource).toContain('computePool.submit(');
  });

  it('IndicatorWorkerBridge.computeBatch dispatches to pool with priorities', () => {
    expect(bridgeSource).toContain("priority: 'high'");
    expect(bridgeSource).toContain('computePool.submit(');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 1.2.2 — WebGPU Compute connected to render pipeline
// ═══════════════════════════════════════════════════════════════════

describe('1.2.2 — WebGPU Compute connected to render pipeline', () => {
  let gpuStageSource, pipelineSource, engineSource;

  beforeAll(() => {
    gpuStageSource = readSource('charting_library/core/stages/GPUComputeStage.ts');
    pipelineSource = readSource('charting_library/core/RenderPipeline.ts');
    engineSource = readSource('charting_library/core/ChartEngine.ts');
  });

  it('GPUComputeStage.ts exists and exports executeGPUComputeStage', () => {
    expect(gpuStageSource).toContain('export function executeGPUComputeStage');
  });

  it('GPUComputeStage checks engine._gpuCompute.available', () => {
    expect(gpuStageSource).toContain('engine._gpuCompute');
    expect(gpuStageSource).toContain('gpuCompute?.available');
  });

  it('GPUComputeStage has GPU dispatch for ema, rsi, macd, bb', () => {
    expect(gpuStageSource).toContain("ema:");
    expect(gpuStageSource).toContain("rsi:");
    expect(gpuStageSource).toContain("macd:");
    expect(gpuStageSource).toContain("bb:");
    expect(gpuStageSource).toContain('gpu.computeEMA');
    expect(gpuStageSource).toContain('gpu.computeRSI');
    expect(gpuStageSource).toContain('gpu.computeMACD');
    expect(gpuStageSource).toContain('gpu.computeBollinger');
  });

  it('GPUComputeStage falls back gracefully when WebGPU unavailable', () => {
    // First line of the function checks availability
    expect(gpuStageSource).toContain("if (!gpuCompute?.available) return");
  });

  it('RenderPipeline registers gpuCompute stage before indicators', () => {
    expect(pipelineSource).toContain("import { executeGPUComputeStage }");
    const gpuIdx = pipelineSource.indexOf("'gpuCompute'");
    const indIdx = pipelineSource.indexOf("'indicators'");
    expect(gpuIdx).toBeGreaterThan(-1);
    expect(indIdx).toBeGreaterThan(gpuIdx);
  });

  it('ChartEngine imports WebGPUCompute and instantiates _gpuCompute', () => {
    expect(engineSource).toContain("import { WebGPUCompute }");
    expect(engineSource).toContain("this._gpuCompute = new WebGPUCompute()");
  });
});

// ═══════════════════════════════════════════════════════════════════
// 1.3.1 — DataSharedWorker wired for cross-tab WS
// ═══════════════════════════════════════════════════════════════════

describe('1.3.1 — DataSharedWorker wired for cross-tab WS dedup', () => {
  let bootSource, tickerSource;

  beforeAll(() => {
    bootSource = readSource('AppBoot.js');
    tickerSource = readSource('data/engine/streaming/TickerPlant.ts');
  });

  it('AppBoot.postBoot starts TickerPlant', () => {
    expect(bootSource).toContain("tickerPlant.start()");
    expect(bootSource).toContain("TickerPlant.js");
  });

  it('TickerPlant constructor calls _initSharedWorker()', () => {
    // _initSharedWorker is called in the constructor (after _registerBuiltInSources)
    expect(tickerSource).toContain('this._initSharedWorker()');
  });

  it('TickerPlant._initSharedWorker creates SharedWorker', () => {
    expect(tickerSource).toContain("new SharedWorker(workerUrl");
    expect(tickerSource).toContain("charEdge-data");
    expect(tickerSource).toContain("_sharedWorkerPort.onmessage");
    expect(tickerSource).toContain("_sharedWorkerPort.start()");
  });

  it('TickerPlant broadcasts price updates to SharedWorker', () => {
    expect(tickerSource).toContain("_broadcastToSharedWorker");
    expect(tickerSource).toContain("type: 'ingest'");
    expect(tickerSource).toContain('_sharedWorkerPort.postMessage(msg)');
  });

  it('TickerPlant uses BinaryCodec for bandwidth savings', () => {
    expect(tickerSource).toContain("import { BinaryCodec");
    expect(tickerSource).toContain("BinaryCodec.encode(msg)");
  });
});

// ═══════════════════════════════════════════════════════════════════
// 1.3.2 — Binary WebSocket wire format
// ═══════════════════════════════════════════════════════════════════

describe('1.3.2 — Binary WebSocket wire format', () => {
  let wsSource;

  beforeAll(() => {
    wsSource = readSource('data/WebSocketService.js');
  });

  it('WebSocketService has lazy BinaryCodec import', () => {
    expect(wsSource).toContain("import('./engine/infra/BinaryCodec.js')");
    expect(wsSource).toContain('_getBinaryCodec');
  });

  it('WebSocketService detects binary messages (ArrayBuffer/Blob)', () => {
    expect(wsSource).toContain('evt.data instanceof ArrayBuffer');
    expect(wsSource).toContain('evt.data instanceof Blob');
  });

  it('WebSocketService decodes binary messages via BinaryCodec', () => {
    const onmessageSection = wsSource.slice(
      wsSource.indexOf('onmessage = (evt)'),
      wsSource.indexOf('onclose')
    );
    expect(onmessageSection).toContain('codec.decodeAuto');
    expect(onmessageSection).toContain('codec.decode');
  });

  it('WebSocketService falls back to JSON.parse for text messages', () => {
    expect(wsSource).toContain('JSON.parse(evt.data)');
  });
});
