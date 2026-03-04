// ═══════════════════════════════════════════════════════════════════
// WebSocket Incremental SUBSCRIBE / UNSUBSCRIBE — Test Suite
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// --------------- Mock WebSocket ---------------
// We need a lightweight mock that tracks sent messages and exposes
// open/close behavior so we can verify incremental subscribe logic.

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  constructor(url) {
    this.url = url;
    this.readyState = MockWebSocket.CONNECTING;
    this.sentMessages = [];
    this.onopen = null;
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;
    MockWebSocket.instances.push(this);
  }

  send(data) {
    this.sentMessages.push(JSON.parse(data));
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
  }

  // Test helper — simulate the socket opening
  _simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    if (this.onopen) this.onopen();
  }

  // Test helper — simulate the socket closing
  _simulateClose() {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) this.onclose();
  }
}
MockWebSocket.instances = [];

// Stub globals
vi.stubGlobal('WebSocket', MockWebSocket);

// Import after mocking
const { _WebSocketService, WS_STATUS } = await import(
  '../../data/WebSocketService.js'
).then((m) => ({
  _WebSocketService: m.WebSocketService,
  WS_STATUS: m.WS_STATUS,
}));

describe('WebSocketService — Incremental Subscribe', () => {
  /** @type {InstanceType<typeof _WebSocketService>} */
  let ws;

  beforeEach(() => {
    MockWebSocket.instances = [];
    ws = new _WebSocketService();
    vi.useFakeTimers();
  });

  afterEach(() => {
    ws.unsubscribe(); // clean up
    vi.useRealTimers();
  });

  // ─── Helpers ───────────────────────────────────────────────────

  /** Advance past the 50ms debounce and open the resulting WS */
  function flushDebounce() {
    vi.advanceTimersByTime(60);
  }

  function lastWs() {
    return MockWebSocket.instances[MockWebSocket.instances.length - 1];
  }

  // ─── Tests ─────────────────────────────────────────────────────

  it('first subscribe creates a new WS connection (full connect)', () => {
    ws.subscribe('BTC', '1h', {});
    flushDebounce();

    expect(MockWebSocket.instances.length).toBe(1);
    expect(lastWs().url).toContain('btcusdt@kline_1h');
    expect(ws.status).toBe(WS_STATUS.CONNECTING);
  });

  it('onopen sets status to CONNECTED and tracks _currentStreams', () => {
    ws.subscribe('BTC', '1h', {});
    flushDebounce();
    lastWs()._simulateOpen();

    expect(ws.status).toBe(WS_STATUS.CONNECTED);
    expect(ws._currentStreams.has('btcusdt@kline_1h')).toBe(true);
  });

  it('second subscribe sends SUBSCRIBE message (no new WS)', () => {
    // First sub → full connect
    ws.subscribe('BTC', '1h', {});
    flushDebounce();
    lastWs()._simulateOpen();
    const wsCount = MockWebSocket.instances.length;

    // Second sub → incremental
    ws.subscribe('ETH', '5m', {});
    flushDebounce();

    // Should NOT have created a new WS
    expect(MockWebSocket.instances.length).toBe(wsCount);

    // Should have sent a SUBSCRIBE message
    const msgs = lastWs().sentMessages;
    expect(msgs.length).toBe(1);
    expect(msgs[0].method).toBe('SUBSCRIBE');
    expect(msgs[0].params).toContain('ethusdt@kline_5m');
    expect(ws._currentStreams.has('ethusdt@kline_5m')).toBe(true);
  });

  it('unsubscribing one stream sends UNSUBSCRIBE (connection stays open)', () => {
    const id1 = ws.subscribe('BTC', '1h', {});
    ws.subscribe('ETH', '5m', {});
    flushDebounce();
    lastWs()._simulateOpen();

    // Unsubscribe BTC
    ws.unsubscribe(id1);
    flushDebounce();

    const msgs = lastWs().sentMessages;
    // First message was ADD for ETH (already tested above), but here
    // both were in the initial URL so no SUBSCRIBE needed. Only UNSUBSCRIBE for BTC.
    const unsubMsg = msgs.find((m) => m.method === 'UNSUBSCRIBE');
    expect(unsubMsg).toBeTruthy();
    expect(unsubMsg.params).toContain('btcusdt@kline_1h');
    expect(ws._currentStreams.has('btcusdt@kline_1h')).toBe(false);
    expect(ws._currentStreams.has('ethusdt@kline_5m')).toBe(true);
    // Connection still open
    expect(ws.status).toBe(WS_STATUS.CONNECTED);
  });

  it('unsubscribing last stream closes the connection', () => {
    const id1 = ws.subscribe('BTC', '1h', {});
    flushDebounce();
    lastWs()._simulateOpen();

    ws.unsubscribe(id1);
    // When subs.size === 0, it should close intentionally (no debounce needed here)
    expect(ws._currentStreams.size).toBe(0);
  });

  it('subscribe while WS is CONNECTING queues and sends on open', () => {
    // First sub → starts connecting
    ws.subscribe('BTC', '1h', {});
    flushDebounce();
    expect(ws.status).toBe(WS_STATUS.CONNECTING);

    // Second sub while still connecting
    ws.subscribe('SOL', '15m', {});
    flushDebounce();

    // Now simulate open — initial URL had BTC, SOL should be sent as incremental
    lastWs()._simulateOpen();

    // Check that SOL was subscribed via message
    const msgs = lastWs().sentMessages;
    const subMsg = msgs.find((m) => m.method === 'SUBSCRIBE');
    expect(subMsg).toBeTruthy();
    expect(subMsg.params).toContain('solusdt@kline_15m');
  });

  it('_currentStreams is cleared on close', () => {
    ws.subscribe('BTC', '1h', {});
    flushDebounce();
    lastWs()._simulateOpen();
    expect(ws._currentStreams.size).toBe(1);

    // Force close
    ws.unsubscribe();
    expect(ws._currentStreams.size).toBe(0);
  });

  it('no-op when desired streams match current streams', () => {
    ws.subscribe('BTC', '1h', {});
    flushDebounce();
    lastWs()._simulateOpen();

    // Subscribe to the same stream again (different subId but same streamKey)
    ws.subscribe('BTC', '1h', {});
    flushDebounce();

    // No messages should have been sent
    expect(lastWs().sentMessages.length).toBe(0);
  });

  it('reconnect after disconnect uses full connect', () => {
    ws.subscribe('BTC', '1h', {});
    flushDebounce();
    lastWs()._simulateOpen();
    const initialWsCount = MockWebSocket.instances.length;

    // Simulate disconnect
    lastWs()._simulateClose();

    // Reconnect timer fires — should do full connect
    vi.advanceTimersByTime(2000);

    expect(MockWebSocket.instances.length).toBe(initialWsCount + 1);
    expect(lastWs().url).toContain('btcusdt@kline_1h');
  });

  it('message IDs are monotonically increasing', () => {
    ws.subscribe('BTC', '1h', {});
    flushDebounce();
    lastWs()._simulateOpen();

    ws.subscribe('ETH', '5m', {});
    flushDebounce();

    ws.subscribe('SOL', '15m', {});
    flushDebounce();

    const msgs = lastWs().sentMessages;
    expect(msgs.length).toBe(2);
    expect(msgs[1].id).toBeGreaterThan(msgs[0].id);
  });
});
