// ═══════════════════════════════════════════════════════════════════
// charEdge — Real-Time Chart Collaboration Engine (Sprint 17)
// Enables shared chart sessions where multiple users can draw,
// annotate, and discuss in real-time.
// Uses BroadcastChannel for same-device tabs and event-based
// architecture ready for WebSocket upgrade.
// ═══════════════════════════════════════════════════════════════════

const CHANNEL_PREFIX = 'charEdge-collab-';

export class CollabSession {
  constructor(sessionId, options = {}) {
    this.sessionId = sessionId;
    this.userId = options.userId || `user_${Math.random().toString(36).slice(2, 8)}`;
    this.userName = options.userName || 'Anonymous';
    this.userColor = options.userColor || this._randomColor();
    this.peers = new Map(); // peerId → { name, color, cursor, lastSeen }
    this.listeners = new Map();
    this.channel = null;
    this._activityLog = [];
  }

  /**
   * Connect to the collaboration session.
   * Uses BroadcastChannel for cross-tab communication.
   */
  connect() {
    try {
      this.channel = new BroadcastChannel(CHANNEL_PREFIX + this.sessionId);
      this.channel.onmessage = (e) => this._handleMessage(e.data);

      // Announce presence
      this._send({ type: 'join', userId: this.userId, userName: this.userName, userColor: this.userColor });

      // Heartbeat
      this._heartbeat = setInterval(() => {
        this._send({ type: 'heartbeat', userId: this.userId });
        // Clean stale peers (no heartbeat for >10s)
        const now = Date.now();
        for (const [peerId, peer] of this.peers) {
          if (now - peer.lastSeen > 10000) {
            this.peers.delete(peerId);
            this._emit('peer-left', { userId: peerId });
          }
        }
      }, 3000);

      return true;
    } catch {
      return false;
    }
  }

  disconnect() {
    if (this._heartbeat) clearInterval(this._heartbeat);
    this._send({ type: 'leave', userId: this.userId });
    this.channel?.close();
    this.channel = null;
    this.peers.clear();
  }

  // Share cursor position
  shareCursor(x, y, timestamp, price) {
    this._send({
      type: 'cursor',
      userId: this.userId,
      x, y, timestamp, price,
      color: this.userColor,
      name: this.userName,
    });
  }

  // Share a drawing action
  shareDrawing(action, drawing) {
    this._send({
      type: 'drawing',
      userId: this.userId,
      action, // 'add' | 'update' | 'delete'
      drawing: { ...drawing, author: this.userId, authorColor: this.userColor },
    });
  }

  // Share a text annotation
  shareAnnotation(text, position) {
    this._send({
      type: 'annotation',
      userId: this.userId,
      text,
      position,
      color: this.userColor,
      name: this.userName,
      timestamp: Date.now(),
    });
  }

  // Share symbol/tf change
  shareViewChange(symbol, tf) {
    this._send({
      type: 'view-change',
      userId: this.userId,
      symbol,
      tf,
    });
  }

  // Event listener
  on(event, callback) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(callback);
    return () => {
      const cbs = this.listeners.get(event) || [];
      this.listeners.set(event, cbs.filter(cb => cb !== callback));
    };
  }

  getPeers() {
    return Array.from(this.peers.values());
  }

  getActivityLog() {
    return this._activityLog.slice(-50);
  }

  // ─── Private ──────────────────────────────────────────────

  _send(data) {
    try { this.channel?.postMessage(data); } catch {}
  }

  _handleMessage(data) {
    if (data.userId === this.userId) return; // Ignore own messages

    switch (data.type) {
      case 'join':
        this.peers.set(data.userId, { name: data.userName, color: data.userColor, lastSeen: Date.now() });
        this._activityLog.push({ type: 'join', user: data.userName, time: Date.now() });
        this._emit('peer-joined', data);
        // Respond with own info
        this._send({ type: 'presence', userId: this.userId, userName: this.userName, userColor: this.userColor });
        break;

      case 'presence':
        this.peers.set(data.userId, { name: data.userName, color: data.userColor, lastSeen: Date.now() });
        break;

      case 'heartbeat':
        if (this.peers.has(data.userId)) {
          this.peers.get(data.userId).lastSeen = Date.now();
        }
        break;

      case 'leave':
        this.peers.delete(data.userId);
        this._emit('peer-left', data);
        break;

      case 'cursor':
        if (this.peers.has(data.userId)) {
          this.peers.get(data.userId).cursor = { x: data.x, y: data.y, timestamp: data.timestamp, price: data.price };
          this.peers.get(data.userId).lastSeen = Date.now();
        }
        this._emit('cursor', data);
        break;

      case 'drawing':
        this._activityLog.push({ type: 'drawing', user: data.userId, action: data.action, time: Date.now() });
        this._emit('drawing', data);
        break;

      case 'annotation':
        this._activityLog.push({ type: 'annotation', user: data.name, text: data.text, time: Date.now() });
        this._emit('annotation', data);
        break;

      case 'view-change':
        this._emit('view-change', data);
        break;
    }
  }

  _emit(event, data) {
    const cbs = this.listeners.get(event) || [];
    for (const cb of cbs) {
      try { cb(data); } catch {}
    }
  }

  _randomColor() {
    const colors = ['#2962FF', '#EF5350', '#26A69A', '#FF9800', '#AB47BC', '#42A5F5', '#66BB6A', '#EC407A'];
    return colors[Math.floor(Math.random() * colors.length)];
  }
}

/**
 * Generate a session invite link.
 */
export function generateCollabInvite(sessionId) {
  return `${window.location.origin}?collab=${sessionId}`;
}
