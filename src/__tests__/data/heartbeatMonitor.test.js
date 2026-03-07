// ═══════════════════════════════════════════════════════════════════
// charEdge — HeartbeatMonitor Tests
//
// Note: MIN_STALENESS_MS = 10_000 (10s floor), so we use at least 11s
// gaps for staleness tests. Timestamps are injected directly into
// _lastData to avoid Date.now() mocking complexity.
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HeartbeatMonitor } from '../../data/HeartbeatMonitor.js';

// Staleness threshold: anything >= 10_000 (MIN_STALENESS_MS)
const TEST_THRESHOLD = 10_000;
const STALE_GAP = 11_000;    // Past threshold
const FRESH_GAP = 5_000;     // Under threshold

describe('HeartbeatMonitor', () => {
  let monitor;

  beforeEach(() => {
    monitor = new HeartbeatMonitor();
  });

  afterEach(() => {
    monitor.stop();
  });

  it('should track stream data timestamps via touch()', () => {
    monitor._running = true;
    monitor.touch('btcusdt@kline_1h');

    const status = monitor.getStatus();
    expect(status.trackedCount).toBe(1);
    expect(status.streams['btcusdt@kline_1h']).toBeDefined();
  });

  it('should detect staleness after threshold', () => {
    monitor.setStalenessThreshold(TEST_THRESHOLD);
    monitor._running = true;

    monitor._lastData.set('btcusdt@kline_1h', Date.now() - STALE_GAP);
    monitor._check();

    const status = monitor.getStatus();
    expect(status.streams['btcusdt@kline_1h'].stale).toBe(true);
    expect(status.staleCount).toBe(1);
  });

  it('should emit stale events', () => {
    monitor.setStalenessThreshold(TEST_THRESHOLD);
    monitor._running = true;

    const events = [];
    monitor.on(e => events.push(e));

    monitor._lastData.set('btcusdt@kline_1h', Date.now() - STALE_GAP);
    monitor._check();

    expect(events.length).toBe(1);
    expect(events[0].type).toBe('stale');
    expect(events[0].streamKey).toBe('btcusdt@kline_1h');
    expect(events[0].gapMs).toBeGreaterThanOrEqual(STALE_GAP);
  });

  it('should emit recovered event when data resumes', () => {
    monitor.setStalenessThreshold(TEST_THRESHOLD);
    monitor._running = true;

    const events = [];
    monitor.on(e => events.push(e));

    // Go stale
    monitor._lastData.set('btcusdt@kline_1h', Date.now() - STALE_GAP);
    monitor._check();

    // Data resumes
    monitor.touch('btcusdt@kline_1h');

    expect(events.length).toBe(2);
    expect(events[0].type).toBe('stale');
    expect(events[1].type).toBe('recovered');
  });

  it('should track multiple streams independently', () => {
    monitor.setStalenessThreshold(TEST_THRESHOLD);
    monitor._running = true;

    const now = Date.now();
    monitor._lastData.set('btcusdt@kline_1h', now - STALE_GAP); // stale
    monitor._lastData.set('ethusdt@kline_1h', now - FRESH_GAP); // fresh
    monitor._check();

    const status = monitor.getStatus();
    expect(status.streams['btcusdt@kline_1h'].stale).toBe(true);
    expect(status.streams['ethusdt@kline_1h'].stale).toBe(false);
    expect(status.staleCount).toBe(1);
  });

  it('should call reconnect function on staleness', () => {
    const reconnectFn = vi.fn();
    monitor.setStalenessThreshold(TEST_THRESHOLD);
    monitor._running = true;
    monitor._reconnectFn = reconnectFn;

    monitor._lastData.set('btcusdt@kline_1h', Date.now() - STALE_GAP);
    monitor._check();

    expect(reconnectFn).toHaveBeenCalledTimes(1);
  });

  it('should clean up on stop()', () => {
    monitor.start();
    monitor.touch('btcusdt@kline_1h');
    monitor.stop();

    const status = monitor.getStatus();
    expect(status.trackedCount).toBe(0);
  });

  it('should untrack specific streams', () => {
    monitor._running = true;
    monitor.touch('btcusdt@kline_1h');
    monitor.touch('ethusdt@kline_1h');
    monitor.untrack('btcusdt@kline_1h');

    const status = monitor.getStatus();
    expect(status.trackedCount).toBe(1);
    expect(status.streams['btcusdt@kline_1h']).toBeUndefined();
  });

  it('should not flag as stale if data is fresh', () => {
    monitor.setStalenessThreshold(TEST_THRESHOLD);
    monitor._running = true;

    monitor._lastData.set('btcusdt@kline_1h', Date.now() - FRESH_GAP);
    monitor._check();

    expect(monitor.hasStaleStreams()).toBe(false);
  });

  it('should respect minimum staleness threshold', () => {
    monitor.setStalenessThreshold(1); // Below minimum (10s)
    expect(monitor._stalenessMs).toBe(10_000);
  });

  it('should return unsubscribe from on()', () => {
    const events = [];
    const unsub = monitor.on(e => events.push(e));

    monitor.setStalenessThreshold(TEST_THRESHOLD);
    monitor._running = true;

    unsub();

    monitor._lastData.set('btcusdt@kline_1h', Date.now() - STALE_GAP);
    monitor._check();

    expect(events.length).toBe(0);
  });

  it('should not re-flag already stale streams', () => {
    monitor.setStalenessThreshold(TEST_THRESHOLD);
    monitor._running = true;

    const events = [];
    monitor.on(e => events.push(e));

    monitor._lastData.set('btcusdt@kline_1h', Date.now() - STALE_GAP);
    monitor._check();
    monitor._check(); // Second check

    expect(events.length).toBe(1);
  });
});
