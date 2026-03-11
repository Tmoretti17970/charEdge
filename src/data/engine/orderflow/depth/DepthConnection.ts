// ═══════════════════════════════════════════════════════════════════
// Per-Symbol Depth Connection
//
// Wraps a WebSocket connection + reconnection state for a single symbol.
// ═══════════════════════════════════════════════════════════════════

import { DepthState } from './DepthState.ts';
import { STATE } from './depthConstants.ts';

export class DepthConnection {
  symbol: string;
  ws: WebSocket | null;
  depthState: DepthState;
  subscribers: Set<Function>;
  lastEmit: number;
  active: boolean;
  state: string;

  reconnectAttempts: number;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  reconnectScheduled: boolean;

  lastMessageTime: number;
  heartbeatTimer: ReturnType<typeof setInterval> | null;

  levels: number;
  updateMs: number;
  exchange?: string;
  cleanSymbol?: string;

  totalErrors: number;
  parseErrors: number;

  constructor(symbol: string) {
    this.symbol = symbol;
    this.ws = null;
    this.depthState = new DepthState(symbol);
    this.subscribers = new Set();
    this.lastEmit = 0;
    this.active = true;
    this.state = STATE.DISCONNECTED;

    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.reconnectScheduled = false;

    this.lastMessageTime = 0;
    this.heartbeatTimer = null;

    this.levels = 20;
    this.updateMs = 1000;

    this.totalErrors = 0;
    this.parseErrors = 0;
  }

  dispose(): void {
    this.active = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}
