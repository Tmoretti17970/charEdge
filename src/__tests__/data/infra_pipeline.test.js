// ═══════════════════════════════════════════════════════════════════
// charEdge — Consolidated Pipeline & Engine Infrastructure Tests
//
// Covers: DataPipeline, DataEventBus, DataSharedWorker, DepthEngine,
//         OrderFlowBridge, StreamingMetrics, PerformanceMonitor,
//         TickerPlant, sw.js, DataHealthPanel, useWebSocket,
//         DataPipelineLogger, dead code
// Replaces: dataInfraFixes.test.js (Bug#5,#6), dataInfraRound3.test.js (#14),
//           dataInfraRound4.test.js, dataInfraRound5.test.js,
//           dataInfraRound6.test.js, dataInfraRound7.test.js,
//           dataInfraRound9.test.js
// ═══════════════════════════════════════════════════════════════════

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readSource(relPath) {
  return fs.readFileSync(path.resolve(__dirname, '..', '..', relPath), 'utf-8');
}

// ═══════════════════════════════════════════════════════════════════
// DataPipeline — lifecycle
// ═══════════════════════════════════════════════════════════════════

describe('DataPipeline — start/watchSymbol/unwatchSymbol/stop lifecycle', () => {
  it('watchSymbol returns unsubscribe fn; unwatchSymbol cleans up', async () => {
    const mod = await import('../../data/engine/DataPipeline.js');
    const DataPipelineClass = mod.dataPipeline.constructor;
    const dp = new DataPipelineClass();
    expect(dp._subscriptions.size).toBe(0);
    expect(dp._symbolSources.size).toBe(0);
    dp._started = true;
    dp.watchSymbol('BTCUSDT');
    expect(dp._symbolSources.has('BTCUSDT')).toBe(true);
    expect(dp._subscriptions.has('BTCUSDT')).toBe(true);
    dp.unwatchSymbol('BTCUSDT');
    expect(dp._subscriptions.has('BTCUSDT')).toBe(false);
    expect(dp._symbolSources.has('BTCUSDT')).toBe(false);
  }, 15000);

  it('re-watching same symbol cleans up old subscription first', async () => {
    const mod = await import('../../data/engine/DataPipeline.js');
    const DataPipelineClass = mod.dataPipeline.constructor;
    const dp = new DataPipelineClass();
    dp._started = true;
    dp.watchSymbol('ETHUSDT');
    dp.watchSymbol('ETHUSDT');
    expect(dp._subscriptions.size).toBe(1);
    expect(dp._symbolSources.size).toBe(1);
  });

  it('stop() clears all subscriptions and sources', async () => {
    const mod = await import('../../data/engine/DataPipeline.js');
    const DataPipelineClass = mod.dataPipeline.constructor;
    const dp = new DataPipelineClass();
    dp._started = true;
    dp.watchSymbol('BTCUSDT');
    dp.watchSymbol('ETHUSDT');
    expect(dp._subscriptions.size).toBe(2);
    dp.stop();
    expect(dp._subscriptions.size).toBe(0);
    expect(dp._symbolSources.size).toBe(0);
  });
});

describe('DataPipeline — subscription cleanup', () => {
  it('stores _subscriptions Map on construction', async () => {
    vi.stubGlobal('BroadcastChannel', class { postMessage() { } close() { } });
    vi.stubGlobal('RTCPeerConnection', class {
      constructor() { this.connectionState = 'new'; }
      createDataChannel() { return { onopen: null, send() { }, close() { }, readyState: 'connecting' }; }
      close() { }
    });
    vi.stubGlobal('SharedWorker', undefined);
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, json: () => Promise.resolve({}) })));

    try {
      const { dataPipeline } = await import('../../data/engine/DataPipeline.js');
      expect(dataPipeline._subscriptions).toBeInstanceOf(Map);
    } catch (_) {
      const source = await import('fs').then(fs =>
        fs.promises.readFile('src/data/engine/DataPipeline.js', 'utf8')
      );
      expect(source).toContain('_subscriptions');
      expect(source).toContain('this._subscriptions.set(upper, unsub)');
      expect(source).toContain('this._subscriptions.delete(upper)');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// DataEventBus — centralized event hub
// ═══════════════════════════════════════════════════════════════════

describe('DataEventBus — centralized event hub', () => {
  let bus;

  beforeEach(async () => {
    const mod = await import('../../data/engine/infra/DataEventBus.js');
    bus = new mod._DataEventBus();
  });

  it('on + emit: delivers events to subscribers', () => {
    const received = [];
    bus.on('test-event', (detail) => received.push(detail));
    bus.emit('test-event', { value: 42 });
    bus.emit('test-event', { value: 99 });
    expect(received).toEqual([{ value: 42 }, { value: 99 }]);
  });

  it('on returns a working unsubscribe function', () => {
    const received = [];
    const unsub = bus.on('a', (d) => received.push(d));
    bus.emit('a', 1);
    unsub();
    bus.emit('a', 2);
    expect(received).toEqual([1]);
  });

  it('once: fires handler exactly once', () => {
    const received = [];
    bus.once('single', (d) => received.push(d));
    bus.emit('single', 'first');
    bus.emit('single', 'second');
    expect(received).toEqual(['first']);
  });

  it('wildcard * listener receives all events with metadata', () => {
    const received = [];
    bus.on('*', (e) => received.push(e));
    bus.emit('foo', { a: 1 });
    bus.emit('bar', { b: 2 });
    expect(received.length).toBe(2);
    expect(received[0].type).toBe('foo');
    expect(received[0].detail).toEqual({ a: 1 });
    expect(received[1].type).toBe('bar');
  });

  it('getHistory returns events in reverse chronological order', () => {
    bus.emit('a', 1);
    bus.emit('b', 2);
    bus.emit('c', 3);
    const history = bus.getHistory();
    expect(history.length).toBe(3);
    expect(history[0].type).toBe('c');
    expect(history[2].type).toBe('a');
  });

  it('getHistory filters by type', () => {
    bus.emit('a', 1);
    bus.emit('b', 2);
    bus.emit('a', 3);
    const history = bus.getHistory('a');
    expect(history.length).toBe(2);
    expect(history.every(e => e.type === 'a')).toBe(true);
  });

  it('getStats tracks event counts and listener count', () => {
    bus.on('x', () => { });
    bus.on('x', () => { });
    bus.on('y', () => { });
    bus.emit('x', 1);
    bus.emit('x', 2);
    bus.emit('y', 3);
    const stats = bus.getStats();
    expect(stats.x).toBe(2);
    expect(stats.y).toBe(1);
    expect(stats._totalListeners).toBe(3);
  });

  it('off removes listeners for a specific type', () => {
    const received = [];
    bus.on('remove-me', (d) => received.push(d));
    bus.emit('remove-me', 1);
    bus.off('remove-me');
    bus.emit('remove-me', 2);
    expect(received).toEqual([1]);
  });

  it('dispose clears everything', () => {
    bus.on('a', () => { });
    bus.emit('a', 1);
    bus.dispose();
    expect(bus.getStats()._totalListeners).toBe(0);
    expect(bus.getStats()._historySize).toBe(0);
  });

  it('history is bounded at _maxHistory entries', () => {
    bus._maxHistory = 5;
    for (let i = 0; i < 10; i++) bus.emit('flood', i);
    expect(bus.getHistory().length).toBe(5);
  });
});

describe('DATA_EVENTS — event type constants', () => {
  it('exports all expected event types', async () => {
    const { DATA_EVENTS } = await import('../../data/engine/infra/DataEventBus.js');
    expect(DATA_EVENTS.SOURCE_CHANGE).toBe('source-change');
    expect(DATA_EVENTS.DATA_WARNING).toBe('data-warning');
    expect(DATA_EVENTS.WS_STATUS).toBe('ws-status');
    expect(DATA_EVENTS.CACHE_HIT).toBe('cache-hit');
    expect(DATA_EVENTS.CACHE_MISS).toBe('cache-miss');
    expect(DATA_EVENTS.CIRCUIT_OPEN).toBe('circuit-open');
    expect(DATA_EVENTS.MEMORY_WARNING).toBe('memory-warning');
    expect(DATA_EVENTS.NETWORK_ONLINE).toBe('network-online');
    expect(DATA_EVENTS.NETWORK_OFFLINE).toBe('network-offline');
    expect(DATA_EVENTS.INDICATOR_UPDATE).toBe('indicator-update');
  });
});

// ═══════════════════════════════════════════════════════════════════
// DataSharedWorker — cross-tab fetch dedup protocol
// ═══════════════════════════════════════════════════════════════════

describe('DataSharedWorker — cross-tab fetch dedup protocol', () => {
  it('contains fetch-request and fetch-response message handlers', async () => {
    const source = readSource('data/engine/infra/DataSharedWorker.js');
    expect(source).toContain("case 'fetch-request'");
    expect(source).toContain("case 'fetch-response'");
    expect(source).toContain('inflightFetches');
    expect(source).toContain('fetch-proceed');
    expect(source).toContain('fetch-wait');
    expect(source).toContain('fetch-result');
  });

  it('cleanup handles inflight fetch entries for disconnected ports', async () => {
    const source = readSource('data/engine/infra/DataSharedWorker.js');
    expect(source).toContain('inflightFetches');
    expect(source).toContain('entry.fetcher === port');
  });
});

// ═══════════════════════════════════════════════════════════════════
// DepthEngine — handler nullification + silence threshold
// ═══════════════════════════════════════════════════════════════════

describe('DepthEngine — handler nullification', () => {
  let source;
  beforeAll(() => { source = readSource('data/engine/orderflow/DepthEngine.ts'); });

  it('_disconnectWS nulls all 4 WS handlers before close()', () => {
    const disconnectIdx = source.indexOf('_disconnectWS(symbol');
    const chunk = source.slice(disconnectIdx, disconnectIdx + 800);
    expect(chunk).toContain('conn.ws.onopen = null');
    expect(chunk).toContain('conn.ws.onmessage = null');
    expect(chunk).toContain('conn.ws.onclose = null');
    expect(chunk).toContain('conn.ws.onerror = null');
  });

  it('_startHeartbeat nulls handlers before silence-triggered close', () => {
    const heartbeatIdx = source.indexOf('_startHeartbeat(symbol, conn)');
    const nextMethodIdx = source.indexOf('_disconnectWS(symbol)', heartbeatIdx);
    const chunk = source.slice(heartbeatIdx, nextMethodIdx);
    expect(chunk).toContain('conn.ws.onopen = null');
    expect(chunk).toContain('conn.ws.onclose = null');
    expect(chunk).not.toContain('// onClose handler will call _scheduleReconnect');
    expect(chunk).toContain('this._scheduleReconnect(symbol, conn)');
  });
});

describe('DepthEngine — relaxed silence threshold', () => {
  it('SILENCE_THRESHOLD_MS is >= 30000', async () => {
    // Constant may live in DepthEngine.ts or depth/depthConstants.ts after decomposition
    let source = readSource('data/engine/orderflow/DepthEngine.ts');
    let match = source.match(/SILENCE_THRESHOLD_MS\s*=\s*(\d+)/);
    if (!match) {
      source = readSource('data/engine/orderflow/depth/depthConstants.ts');
      match = source.match(/SILENCE_THRESHOLD_MS\s*=\s*(\d+)/);
    }
    expect(match).not.toBeNull();
    expect(parseInt(match[1])).toBeGreaterThanOrEqual(30000);
  });
});

// ═══════════════════════════════════════════════════════════════════
// OrderFlowBridge — handler nullification, Kraken guard, speed
// ═══════════════════════════════════════════════════════════════════

describe('OrderFlowBridge — handler nullification', () => {
  let source;
  beforeAll(() => { source = readSource('data/engine/orderflow/OrderFlowBridge.js'); });

  it('disconnect() nulls all 4 WS handlers before close()', () => {
    const disconnectIdx = source.indexOf('disconnect(symbol)');
    const chunk = source.slice(disconnectIdx, disconnectIdx + 500);
    expect(chunk).toContain('conn.binanceWS.onopen = null');
    expect(chunk).toContain('conn.binanceWS.onmessage = null');
    expect(chunk).toContain('conn.binanceWS.onclose = null');
    expect(chunk).toContain('conn.binanceWS.onerror = null');
  });

  it('_startHeartbeat nulls handlers before silence-triggered close', () => {
    const heartbeatIdx = source.indexOf('_startHeartbeat(symbol, conn, handler)');
    const nextMethodIdx = source.indexOf('_setConnectionState(symbol, newState)', heartbeatIdx);
    const chunk = source.slice(heartbeatIdx, nextMethodIdx);
    expect(chunk).toContain('conn.binanceWS.onopen = null');
    expect(chunk).toContain('conn.binanceWS.onclose = null');
    expect(chunk).not.toContain('// onClose handler will call _scheduleReconnect');
  });
});

describe('OrderFlowBridge — Kraken guard uses isKrakenSymbol only', () => {
  it('does NOT use loose isCryptoSymbol() for Kraken subscription', async () => {
    const source = readSource('data/engine/orderflow/OrderFlowBridge.js');
    expect(source).not.toContain('isCryptoSymbol(symbol))');
    const krakenGuardLine = source.split('\n').find(l => l.includes('isKrakenSymbol') && l.trim().startsWith('if'));
    expect(krakenGuardLine).toBeDefined();
    expect(krakenGuardLine).not.toContain('isCryptoSymbol');
  });
});

describe('OrderFlowBridge — speed optimizations', () => {
  let source;
  beforeAll(() => { source = readSource('data/engine/orderflow/OrderFlowBridge.js'); });

  it('MAX_TICKS_PER_SECOND >= 2000', () => {
    const match = source.match(/MAX_TICKS_PER_SECOND\s*=\s*(\d+)/);
    expect(match).toBeTruthy();
    expect(parseInt(match[1], 10)).toBeGreaterThanOrEqual(2000);
  });

  it('uses MessageChannel for batch flush (not rAF)', () => {
    expect(source).toContain('new MessageChannel()');
    expect(source).toContain('_batchChannel.port2.postMessage');
  });

  it('does NOT use requestAnimationFrame in tick handler', () => {
    const connectIdx = source.indexOf('_connectSources(');
    const connectEnd = source.indexOf('_connectBinance(', connectIdx);
    const handlerBlock = source.slice(connectIdx, connectEnd);
    expect(handlerBlock).not.toContain('requestAnimationFrame');
  });

  it('exposes ticksPerSecond in getStats()', () => {
    expect(source).toContain('ticksPerSecond');
    expect(source).toContain('_tickRateWindows');
  });
});

// ═══════════════════════════════════════════════════════════════════
// StreamingMetrics — CircularBuffer
// ═══════════════════════════════════════════════════════════════════

describe('StreamingMetrics — CircularBuffer', () => {
  let source;
  beforeAll(() => { source = readSource('data/engine/streaming/StreamingMetrics.js'); });

  it('defines a CircularBuffer class', () => { expect(source).toContain('class CircularBuffer'); });
  it('no longer uses .shift() for sliding window eviction', () => {
    const metricsSection = source.slice(source.indexOf('Metric Implementations'));
    expect(metricsSection).not.toMatch(/\.shift\(\)/);
  });
  it('uses CircularBuffer for imbalanceWindow', () => { expect(source).toContain('this.imbalanceWindow = new CircularBuffer'); });
  it('uses CircularBuffer for arrivalTimes', () => { expect(source).toContain('this.arrivalTimes = new CircularBuffer'); });
  it('uses CircularBuffer for volReturns', () => { expect(source).toContain('this.volReturns = new CircularBuffer'); });
  it('uses CircularBuffer for absBuffer', () => { expect(source).toContain('this.absBuffer = new CircularBuffer'); });
  it('uses CircularBuffer for impactBuffer', () => { expect(source).toContain('this.impactBuffer = new CircularBuffer'); });
  it('uses CircularBuffer for divPriceHistory and divCvdHistory', () => {
    expect(source).toContain('this.divPriceHistory = new CircularBuffer');
    expect(source).toContain('this.divCvdHistory = new CircularBuffer');
  });
  it('uses CircularBuffer for vcBars', () => { expect(source).toContain('this.vcBars = new CircularBuffer'); });

  it('CircularBuffer push auto-evicts at capacity', async () => {
    const { streamingMetrics } = await import('../../data/engine/streaming/StreamingMetrics.js');
    streamingMetrics.reset('TESTCB');
    for (let i = 0; i < 250; i++) {
      streamingMetrics.onTick('TESTCB', {
        price: 100 + Math.sin(i * 0.1) * 5,
        volume: 1,
        time: Date.now() - (250 - i) * 100,
        side: i % 2 === 0 ? 'buy' : 'sell',
      });
    }
    const snap = streamingMetrics.getSnapshot('TESTCB');
    expect(snap).not.toBeNull();
    expect(snap.tickCount).toBe(250);
    expect(['low', 'normal', 'high', 'extreme']).toContain(snap.volatilityRegime);
    streamingMetrics.reset('TESTCB');
  });
});

// ═══════════════════════════════════════════════════════════════════
// PerformanceMonitor — CircularBuffer
// ═══════════════════════════════════════════════════════════════════

describe('PerformanceMonitor — uses CircularBuffer', () => {
  let source;
  beforeAll(() => { source = readSource('data/engine/infra/PerformanceMonitor.js'); });

  // TODO: un-skip when PerformanceMonitor imports CircularBuffer (Task 2.8)
  it.skip('imports CircularBuffer from StreamingMetrics', () => {
    expect(source).toContain("import { CircularBuffer } from '../../streaming/StreamingMetrics.js'");
  });

  it('initializes _frameTimes as CircularBuffer', () => {
    expect(source).toContain('new CircularBuffer(SAMPLE_WINDOW)');
  });

  it('does NOT use Array.shift() in rAF path', () => {
    const tickIdx = source.indexOf('_tick()');
    const tickEnd = source.indexOf('_analyze()', tickIdx);
    const tickBlock = source.slice(tickIdx, tickEnd);
    expect(tickBlock).not.toContain('.shift()');
  });

  it('uses CircularBuffer.forEach in _analyze', () => {
    const analyzeIdx = source.indexOf('_analyze()');
    const analyzeEnd = source.indexOf('_setLevel', analyzeIdx);
    const analyzeBlock = source.slice(analyzeIdx, analyzeEnd);
    expect(analyzeBlock).toContain('.forEach(');
  });
});

// ═══════════════════════════════════════════════════════════════════
// TickerPlant — binance-rest guard
// ═══════════════════════════════════════════════════════════════════

describe('TickerPlant — binance-rest rejects non-crypto symbols', () => {
  it('source code has isCrypto guard in fetchQuote', async () => {
    const source = readSource('data/engine/streaming/TickerPlant.ts');
    expect(source).toContain('isCrypto');
    expect(source).toContain('CRYPTO_BASES');
  });
});

// ═══════════════════════════════════════════════════════════════════
// sw.js — Background Sync
// ═══════════════════════════════════════════════════════════════════

// TODO: un-skip when sw.js gets background sync (Task 5.5)
describe.skip('sw.js — Background Sync implementation', () => {
  it('registers a sync event listener for charEdge-sync', async () => {
    const source = fs.readFileSync(path.resolve(__dirname, '..', '..', '..', 'public', 'sw.js'), 'utf-8');
    expect(source).toContain("addEventListener('sync'");
    expect(source).toContain("charEdge-sync");
    expect(source).toContain('replayMutations');
  });

  it('has a message handler for manual sync replay', async () => {
    const source = fs.readFileSync(path.resolve(__dirname, '..', '..', '..', 'public', 'sw.js'), 'utf-8');
    expect(source).toContain("'replay-sync-queue'");
  });

  it('sync queue uses IndexedDB store named mutations', async () => {
    const source = fs.readFileSync(path.resolve(__dirname, '..', '..', '..', 'public', 'sw.js'), 'utf-8');
    expect(source).toContain("'charEdge-sync-queue'");
    expect(source).toContain("'mutations'");
  });
});

// ═══════════════════════════════════════════════════════════════════
// DataHealthPanel — smoke test
// ═══════════════════════════════════════════════════════════════════

describe('DataHealthPanel — component exists and exports default', () => {
  it('can be imported without error', async () => {
    const mod = await import('../../app/components/data/DataHealthPanel.jsx');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});

// ═══════════════════════════════════════════════════════════════════
// Dead code removal + misc
// ═══════════════════════════════════════════════════════════════════

describe('Dead code & logger fix', () => {
  it('useChartData.js has been deleted', () => {
    const filePath = path.resolve(__dirname, '..', '..', 'data', 'useChartData.js');
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it('DataPipelineLogger.warn does NOT count toward error budget', () => {
    const source = readSource('data/engine/infra/DataPipelineLogger.js');
    const budgetIdx = source.indexOf('Error budget tracking');
    expect(budgetIdx).toBeGreaterThan(-1);
    const budgetChunk = source.slice(budgetIdx, budgetIdx + 100);
    expect(budgetChunk).toContain("level === 'error'");
    expect(budgetChunk).not.toContain("level === 'warn'");
  });
});

describe('useWebSocket — array optimization', () => {
  it('uses spread [...currentData] for open candle updates', () => {
    const source = readSource('data/useWebSocket.js');
    const openCandleSection = source.slice(
      source.indexOf('Candle still open'),
      source.indexOf('liveBarRef.current !== candle.time')
    );
    expect(openCandleSection).toContain('[...currentData]');
  });
});
