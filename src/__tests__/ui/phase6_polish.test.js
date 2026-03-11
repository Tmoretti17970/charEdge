// ═══════════════════════════════════════════════════════════════════
// charEdge — Phase 6 Polish & Optimize Unit Tests
//
// Tests for BandwidthMonitor, BatteryThrottle, ConnectionPool,
// PeerProtocol binary messaging, and DataPipeline integration.
// ═══════════════════════════════════════════════════════════════════

// eslint-disable-next-line import/order
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ── BandwidthMonitor ─────────────────────────────────────────────

// eslint-disable-next-line import/order
import { BandwidthMonitor } from '../../data/engine/infra/BandwidthMonitor.js';

describe('BandwidthMonitor', () => {
  let monitor;

  beforeEach(() => {
    monitor = new BandwidthMonitor();
  });

  afterEach(() => {
    monitor.destroy();
  });

  it('initializes with zero counters', () => {
    const report = monitor.getReport();
    expect(report.p2p.sent).toBe(0);
    expect(report.p2p.received).toBe(0);
    expect(report.ws.sent).toBe(0);
    expect(report.ws.received).toBe(0);
    expect(report.totalBytes).toBe(0);
  });

  it('records P2P bytes sent', () => {
    monitor.recordP2PSent(1024);
    monitor.recordP2PSent(512);
    const report = monitor.getReport();
    expect(report.p2p.sent).toBe(1536);
    expect(report.p2p.messagesSent).toBe(2);
  });

  it('records P2P bytes received', () => {
    monitor.recordP2PReceived(2048);
    const report = monitor.getReport();
    expect(report.p2p.received).toBe(2048);
    expect(report.p2p.messagesReceived).toBe(1);
  });

  it('records WS bytes sent and received', () => {
    monitor.recordWSSent(1000);
    monitor.recordWSReceived(5000);
    const report = monitor.getReport();
    expect(report.ws.sent).toBe(1000);
    expect(report.ws.received).toBe(5000);
    expect(report.ws.messagesSent).toBe(1);
    expect(report.ws.messagesReceived).toBe(1);
  });

  it('calculates total bytes', () => {
    monitor.recordP2PSent(100);
    monitor.recordP2PReceived(200);
    monitor.recordWSSent(300);
    monitor.recordWSReceived(400);
    const report = monitor.getReport();
    expect(report.totalBytes).toBe(1000);
  });

  it('calculates compression ratio from binary savings', () => {
    monitor.recordBinarySaved(1000, 600); // JSON: 1000, Binary: 600
    const report = monitor.getReport();
    expect(report.compression.jsonBytes).toBe(1000);
    expect(report.compression.binaryBytes).toBe(600);
    expect(report.compression.ratio).toBe(0.6);
    expect(report.compression.bytesSaved).toBe(400);
    expect(report.compression.savingsPercent).toBe('40.0');
  });

  it('returns 1.0 compression ratio when no binary data recorded', () => {
    const report = monitor.getReport();
    expect(report.compression.ratio).toBe(1.0);
    expect(report.compression.savingsPercent).toBe('0.0');
  });

  it('accumulates multiple binary savings', () => {
    monitor.recordBinarySaved(500, 300);
    monitor.recordBinarySaved(500, 350);
    const report = monitor.getReport();
    expect(report.compression.jsonBytes).toBe(1000);
    expect(report.compression.binaryBytes).toBe(650);
    expect(report.compression.bytesSaved).toBe(350);
  });

  it('calculates rates', () => {
    monitor.recordP2PSent(10000);
    monitor.recordWSReceived(50000);
    const report = monitor.getReport();
    expect(report.rates.p2pSentPerSec).toBeGreaterThan(0);
    expect(report.rates.wsReceivedPerSec).toBeGreaterThan(0);
  });

  it('getReport includes uptime', () => {
    const report = monitor.getReport();
    expect(report.uptimeMs).toBeGreaterThanOrEqual(0);
  });

  it('getSummary returns a formatted string', () => {
    monitor.recordP2PSent(1024);
    monitor.recordWSReceived(2048);
    const summary = monitor.getSummary();
    expect(typeof summary).toBe('string');
    expect(summary).toContain('P2P:');
    expect(summary).toContain('WS:');
    expect(summary).toContain('Saved:');
  });

  it('reset clears all counters', () => {
    monitor.recordP2PSent(1000);
    monitor.recordWSReceived(2000);
    monitor.recordBinarySaved(500, 300);
    monitor.reset();
    const report = monitor.getReport();
    expect(report.p2p.sent).toBe(0);
    expect(report.ws.received).toBe(0);
    expect(report.compression.jsonBytes).toBe(0);
  });

  it('start/stop controls snapshot timer', () => {
    monitor.start();
    expect(monitor._running).toBe(true);
    monitor.stop();
    expect(monitor._running).toBe(false);
  });

  it('snapshots have expected shape', () => {
    monitor.start();
    monitor.recordP2PSent(100);
    // Manually trigger a snapshot
    monitor._takeSnapshot();
    const report = monitor.getReport();
    expect(report.snapshots.length).toBe(1);
    expect(report.snapshots[0]).toHaveProperty('ts');
    expect(report.snapshots[0]).toHaveProperty('p2pSentDelta');
    expect(report.snapshots[0].p2pSentDelta).toBe(100);
  });
});

// ── BatteryThrottle ──────────────────────────────────────────────

// eslint-disable-next-line import/order
import { BatteryThrottle } from '../../data/engine/infra/BatteryThrottle.js';

describe('BatteryThrottle', () => {
  let throttle;

  beforeEach(() => {
    throttle = new BatteryThrottle();
  });

  afterEach(() => {
    throttle.destroy();
  });

  it('defaults to no throttling', () => {
    expect(throttle.shouldThrottle()).toBe(false);
    expect(throttle.getMultiplier()).toBe(1.0);
    expect(throttle.getTier()).toBe('none');
  });

  it('getState returns expected shape', () => {
    const state = throttle.getState();
    expect(state).toHaveProperty('available');
    expect(state).toHaveProperty('charging');
    expect(state).toHaveProperty('level');
    expect(state).toHaveProperty('multiplier');
    expect(state).toHaveProperty('tier');
  });

  it('allowRelay returns true when no throttle', () => {
    expect(throttle.allowRelay()).toBe(true);
  });

  it('isAvailable reflects API availability', () => {
    // In Node.js test env, Battery API is not available
    expect(throttle.isAvailable).toBe(false);
  });

  it('simulates throttle tiers via internal state', () => {
    // Simulate unplugged at 40% battery
    throttle._charging = false;
    throttle._level = 0.40;
    throttle._recalculate();
    expect(throttle.getMultiplier()).toBe(0.5);
    expect(throttle.getTier()).toBe('light');
    expect(throttle.shouldThrottle()).toBe(true);

    // Simulate unplugged at 20% battery
    throttle._level = 0.20;
    throttle._recalculate();
    expect(throttle.getMultiplier()).toBe(0.25);
    expect(throttle.getTier()).toBe('moderate');

    // Simulate unplugged at 5% battery
    throttle._level = 0.05;
    throttle._recalculate();
    expect(throttle.getMultiplier()).toBe(0.0);
    expect(throttle.getTier()).toBe('severe');

    // allowRelay should always return false at 0x
    expect(throttle.allowRelay()).toBe(false);
  });

  it('charging cancels throttle regardless of level', () => {
    throttle._charging = false;
    throttle._level = 0.05;
    throttle._recalculate();
    expect(throttle.getMultiplier()).toBe(0.0);

    // Plug in charger
    throttle._charging = true;
    throttle._recalculate();
    expect(throttle.getMultiplier()).toBe(1.0);
    expect(throttle.getTier()).toBe('none');
  });

  it('emits throttle-change event on multiplier change', () => {
    const handler = vi.fn();
    throttle.addEventListener('throttle-change', handler);

    throttle._charging = false;
    throttle._level = 0.20;
    throttle._recalculate();
    expect(handler).toHaveBeenCalledTimes(1);

    const detail = handler.mock.calls[0][0].detail;
    expect(detail.multiplier).toBe(0.25);
    expect(detail.tier).toBe('moderate');
  });

  it('does not emit event if multiplier unchanged', () => {
    const handler = vi.fn();
    throttle.addEventListener('throttle-change', handler);

    // Both calls should keep multiplier at 1.0 (charging)
    throttle._charging = true;
    throttle._level = 0.80;
    throttle._recalculate();
    expect(handler).not.toHaveBeenCalled();
  });

  it('init gracefully handles no Battery API', async () => {
    await throttle.init();
    expect(throttle.getMultiplier()).toBe(1.0);
    expect(throttle.isAvailable).toBe(false);
  });

  it('destroy resets state', () => {
    throttle._initialized = true;
    throttle.destroy();
    expect(throttle._initialized).toBe(false);
  });
});

// ── ConnectionPool ───────────────────────────────────────────────

import { ConnectionPool } from '../../data/engine/infra/ConnectionPool.js';

describe('ConnectionPool', () => {
  let pool;

  // Mock RTCPeerConnection and RTCDataChannel
  const mockPC = () => ({
    close: vi.fn(),
    connectionState: 'connected',
  });
  const mockDC = () => ({
    close: vi.fn(),
    readyState: 'open',
    binaryType: 'arraybuffer',
  });

  beforeEach(() => {
    pool = new ConnectionPool({ maxPool: 4, idleTimeout: 1000 });
  });

  afterEach(() => {
    pool.destroy();
  });

  it('starts empty', () => {
    expect(pool.size).toBe(0);
    expect(pool.getActive()).toEqual([]);
    expect(pool.getIdle()).toEqual([]);
  });

  it('acquires a new connection', () => {
    const entry = pool.acquire('peer-1', mockPC(), mockDC(), 'local');
    expect(entry).not.toBeNull();
    expect(entry.peerId).toBe('peer-1');
    expect(entry.acquired).toBe(true);
    expect(pool.size).toBe(1);
    expect(pool.has('peer-1')).toBe(true);
  });

  it('reuses an existing connection', () => {
    pool.acquire('peer-1', mockPC(), mockDC());
    pool.release('peer-1');
    const entry = pool.acquire('peer-1');
    expect(entry).not.toBeNull();
    expect(entry.acquired).toBe(true);
    expect(pool.size).toBe(1); // No new connection
  });

  it('tracks reuse count', () => {
    pool.acquire('peer-1', mockPC(), mockDC());
    pool.release('peer-1');
    pool.acquire('peer-1');
    const stats = pool.getStats();
    expect(stats.reuseCount).toBe(1);
    expect(stats.totalAcquires).toBe(2);
  });

  it('release marks connection as idle', () => {
    pool.acquire('peer-1', mockPC(), mockDC());
    expect(pool.getActive().length).toBe(1);
    pool.release('peer-1');
    expect(pool.getIdle().length).toBe(1);
    expect(pool.getActive().length).toBe(0);
  });

  it('respects max pool size', () => {
    pool.acquire('p1', mockPC(), mockDC());
    pool.acquire('p2', mockPC(), mockDC());
    pool.acquire('p3', mockPC(), mockDC());
    pool.acquire('p4', mockPC(), mockDC());
    expect(pool.size).toBe(4);

    // Release one so eviction can work
    pool.release('p1');

    // Fifth acquire should evict idle p1
    const entry = pool.acquire('p5', mockPC(), mockDC());
    expect(entry).not.toBeNull();
    expect(pool.size).toBe(4);
    expect(pool.has('p1')).toBe(false);
  });

  it('returns null when pool full and no idle to evict', () => {
    pool.acquire('p1', mockPC(), mockDC());
    pool.acquire('p2', mockPC(), mockDC());
    pool.acquire('p3', mockPC(), mockDC());
    pool.acquire('p4', mockPC(), mockDC());
    // All are acquired, no idle to evict
    const entry = pool.acquire('p5', mockPC(), mockDC());
    expect(entry).toBeNull();
  });

  it('returns null when acquiring without pc/dc for new peer', () => {
    const entry = pool.acquire('peer-new');
    expect(entry).toBeNull();
  });

  it('removes a specific connection', () => {
    const pc = mockPC();
    const dc = mockDC();
    pool.acquire('peer-1', pc, dc);
    pool.remove('peer-1');
    expect(pool.size).toBe(0);
    expect(pool.has('peer-1')).toBe(false);
    expect(dc.close).toHaveBeenCalled();
    expect(pc.close).toHaveBeenCalled();
  });

  it('manages symbols on connections', () => {
    pool.acquire('peer-1', mockPC(), mockDC());
    pool.addSymbol('peer-1', 'BTCUSDT');
    pool.addSymbol('peer-1', 'ETHUSDT');
    const entry = pool.get('peer-1');
    expect(entry.symbols.has('BTCUSDT')).toBe(true);
    expect(entry.symbols.has('ETHUSDT')).toBe(true);

    pool.removeSymbol('peer-1', 'BTCUSDT');
    expect(entry.symbols.has('BTCUSDT')).toBe(false);
  });

  it('reaps idle connections', () => {
    pool.acquire('peer-1', mockPC(), mockDC());
    pool.release('peer-1');
    // Simulate age
    pool._pool.get('peer-1').lastUsed = Date.now() - 5000;
    pool._reapIdle();
    expect(pool.size).toBe(0);
  });

  it('getStats returns expected shape', () => {
    pool.acquire('p1', mockPC(), mockDC());
    pool.acquire('p2', mockPC(), mockDC());
    pool.release('p1');
    const stats = pool.getStats();
    expect(stats.poolSize).toBe(2);
    expect(stats.maxPool).toBe(4);
    expect(stats.active).toBe(1);
    expect(stats.idle).toBe(1);
    expect(stats.totalAcquires).toBe(2);
    expect(stats).toHaveProperty('reuseRate');
  });

  it('destroy closes all connections and clears state', () => {
    const pc = mockPC();
    const dc = mockDC();
    pool.acquire('peer-1', pc, dc);
    pool.destroy();
    expect(pool.size).toBe(0);
    expect(dc.close).toHaveBeenCalled();
    expect(pc.close).toHaveBeenCalled();
  });

  it('start/stop controls health timer', () => {
    pool.start();
    expect(pool._running).toBe(true);
    pool.stop();
    expect(pool._running).toBe(false);
  });
});



// ── DataPipeline Phase 6 Integration ─────────────────────────────


describe('DataPipeline - Phase 6 Integration', () => {
  it('dataPipeline exports getBandwidthReport method', async () => {
    const { dataPipeline } = await import('../../data/engine/DataPipeline.js');
    expect(typeof dataPipeline.getBandwidthReport).toBe('function');
  });

  it('getBandwidthReport returns expected shape', async () => {
    const { dataPipeline } = await import('../../data/engine/DataPipeline.js');
    const report = dataPipeline.getBandwidthReport();
    expect(report).toHaveProperty('p2p');
    expect(report).toHaveProperty('ws');
    expect(report).toHaveProperty('totalBytes');
    expect(report).toHaveProperty('compression');
    expect(report).toHaveProperty('rates');
    expect(report).toHaveProperty('uptimeMs');
    expect(report.compression).toHaveProperty('ratio');
    expect(report.compression).toHaveProperty('savingsPercent');
  });

  it('dataPipeline no longer exposes getP2PStats after P2P removal', async () => {
    const { dataPipeline } = await import('../../data/engine/DataPipeline.js');
    expect(typeof dataPipeline.getP2PStats).toBe('undefined');
  });
});
