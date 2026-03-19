// ═══════════════════════════════════════════════════════════════════
// charEdge — Broker Connector Base Class (Phase 7 Sprint 7.1)
//
// Abstract base for all broker API connectors.
// Provides: lifecycle management, rate limiting, auto-retry,
// error classification, and standard sync interface.
// ═══════════════════════════════════════════════════════════════════

import { logger } from '@/observability/logger';

// ─── Status Enum ────────────────────────────────────────────────

export const CONNECTOR_STATUS = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  SYNCING: 'syncing',
  ERROR: 'error',
};

// ─── Error Classification ───────────────────────────────────────

export const CONNECTOR_ERROR = {
  AUTH_FAILED: 'auth_failed',
  RATE_LIMITED: 'rate_limited',
  NETWORK_ERROR: 'network_error',
  API_ERROR: 'api_error',
  INVALID_RESPONSE: 'invalid_response',
  CORS_BLOCKED: 'cors_blocked',
};

// ─── Base Connector ─────────────────────────────────────────────

export class BrokerConnector {
  /**
   * @param {Object} config
   * @param {string} config.id - Unique connector ID (e.g., 'coinbase')
   * @param {string} config.name - Display name
   * @param {string} config.logo - Emoji logo
   * @param {string[]} config.requiredFields - Credential fields (e.g., ['apiKey', 'secret'])
   * @param {number} [config.rateLimit] - Max requests per minute (default: 60)
   * @param {number} [config.syncIntervalMs] - Auto-sync interval (default: 15 min)
   * @param {number} [config.maxRetries] - Max retry attempts (default: 3)
   */
  constructor(config) {
    this.id = config.id;
    this.name = config.name;
    this.logo = config.logo || '📊';
    this.requiredFields = config.requiredFields || ['apiKey', 'secret'];
    this.rateLimit = config.rateLimit || 60;
    this.syncIntervalMs = config.syncIntervalMs || 15 * 60 * 1000;
    this.maxRetries = config.maxRetries || 3;

    // Internal state
    this._status = CONNECTOR_STATUS.DISCONNECTED;
    this._credentials = null;
    this._lastSync = null;
    this._lastError = null;
    this._requestTimestamps = [];
    this._syncTimer = null;
    this._listeners = new Set();
  }

  // ─── Lifecycle ──────────────────────────────────────────────

  get status() { return this._status; }
  get lastSync() { return this._lastSync; }
  get lastError() { return this._lastError; }
  get isConnected() { return this._status === CONNECTOR_STATUS.CONNECTED || this._status === CONNECTOR_STATUS.SYNCING; }

  /**
   * Connect with credentials.
   * @param {Object} credentials - Broker-specific credentials
   * @returns {Promise<{ ok: boolean, error?: string }>}
   */
  async connect(credentials) {
    this._setStatus(CONNECTOR_STATUS.CONNECTING);
    this._credentials = credentials;

    try {
      const result = await this.testConnection(credentials);
      if (result.ok) {
        this._setStatus(CONNECTOR_STATUS.CONNECTED);
        this._lastError = null;
        logger.data.info(`[${this.id}] Connected successfully`);
        return { ok: true };
      } else {
        this._setStatus(CONNECTOR_STATUS.ERROR);
        this._lastError = { type: CONNECTOR_ERROR.AUTH_FAILED, message: result.error || 'Authentication failed' };
        return { ok: false, error: this._lastError.message };
      }
    } catch (err) {
      const classified = this._classifyError(err);
      this._setStatus(CONNECTOR_STATUS.ERROR);
      this._lastError = classified;
      return { ok: false, error: classified.message };
    }
  }

  /**
   * Disconnect and clean up.
   */
  disconnect() {
    this._credentials = null;
    this._lastError = null;
    this._stopAutoSync();
    this._setStatus(CONNECTOR_STATUS.DISCONNECTED);
    logger.data.info(`[${this.id}] Disconnected`);
  }

  /**
   * Sync trades from broker.
   * @param {Object} [options]
   * @param {Date} [options.since] - Fetch trades since this date
   * @returns {Promise<{ ok: boolean, trades: Object[], error?: string }>}
   */
  async sync(options = {}) {
    if (!this._credentials) {
      return { ok: false, trades: [], error: 'Not connected' };
    }

    this._setStatus(CONNECTOR_STATUS.SYNCING);

    try {
      const trades = await this._fetchWithRetry(() => this.fetchTrades(this._credentials, options));
      this._lastSync = Date.now();
      this._setStatus(CONNECTOR_STATUS.CONNECTED);
      this._lastError = null;
      logger.data.info(`[${this.id}] Synced ${trades.length} trades`);
      return { ok: true, trades };
    } catch (err) {
      const classified = this._classifyError(err);
      this._setStatus(CONNECTOR_STATUS.ERROR);
      this._lastError = classified;
      return { ok: false, trades: [], error: classified.message };
    }
  }

  // ─── Auto-Sync ──────────────────────────────────────────────

  startAutoSync() {
    this._stopAutoSync();
    this._syncTimer = setInterval(() => {
      if (this.isConnected && document.visibilityState !== 'hidden') {
        this.sync({ since: new Date(this._lastSync || Date.now() - 24 * 60 * 60 * 1000) });
      }
    }, this.syncIntervalMs);
  }

  _stopAutoSync() {
    if (this._syncTimer) {
      clearInterval(this._syncTimer);
      this._syncTimer = null;
    }
  }

  // ─── Status Change Listeners ────────────────────────────────

  onStatusChange(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  _setStatus(status) {
    const prev = this._status;
    this._status = status;
    if (prev !== status) {
      for (const fn of this._listeners) {
        try { fn(status, prev); } catch { /* ignore listener errors */ }
      }
    }
  }

  // ─── Rate Limiting ──────────────────────────────────────────

  async _waitForRateLimit() {
    const now = Date.now();
    const windowMs = 60_000;
    this._requestTimestamps = this._requestTimestamps.filter((t) => now - t < windowMs);

    if (this._requestTimestamps.length >= this.rateLimit) {
      const oldest = this._requestTimestamps[0];
      const waitMs = oldest + windowMs - now + 50; // small buffer
      await new Promise((r) => setTimeout(r, waitMs));
    }

    this._requestTimestamps.push(Date.now());
  }

  // ─── Retry Logic ────────────────────────────────────────────

  async _fetchWithRetry(fn, attempt = 0) {
    try {
      await this._waitForRateLimit();
      return await fn();
    } catch (err) {
      const classified = this._classifyError(err);

      // Don't retry auth failures
      if (classified.type === CONNECTOR_ERROR.AUTH_FAILED) throw err;

      // Retry with exponential backoff + jitter
      if (attempt < this.maxRetries) {
        const baseDelay = Math.pow(2, attempt) * 1000;
        const jitter = Math.random() * 500;
        const delay = baseDelay + jitter;
        logger.data.warn(`[${this.id}] Retry ${attempt + 1}/${this.maxRetries} in ${Math.round(delay)}ms`);
        await new Promise((r) => setTimeout(r, delay));
        return this._fetchWithRetry(fn, attempt + 1);
      }

      throw err;
    }
  }

  // ─── Error Classification ──────────────────────────────────

  _classifyError(err) {
    const msg = (err?.message || '').toLowerCase();
    const status = err?.status || err?.response?.status;

    if (status === 401 || status === 403 || msg.includes('unauthorized') || msg.includes('invalid api')) {
      return { type: CONNECTOR_ERROR.AUTH_FAILED, message: 'Authentication failed — check your API credentials', status };
    }
    if (status === 429 || msg.includes('rate limit') || msg.includes('too many')) {
      return { type: CONNECTOR_ERROR.RATE_LIMITED, message: 'Rate limited — will retry automatically', status };
    }
    if (msg.includes('cors') || msg.includes('access-control') || msg.includes('blocked by cors')) {
      return { type: CONNECTOR_ERROR.CORS_BLOCKED, message: 'CORS blocked — a proxy server is required for this broker', status };
    }
    if (msg.includes('network') || msg.includes('fetch') || msg.includes('failed to fetch') || msg.includes('timeout')) {
      return { type: CONNECTOR_ERROR.NETWORK_ERROR, message: 'Network error — check your internet connection', status };
    }
    if (status && status >= 400) {
      return { type: CONNECTOR_ERROR.API_ERROR, message: `API error (${status}): ${err?.message || 'Unknown'}`, status };
    }

    return { type: CONNECTOR_ERROR.API_ERROR, message: err?.message || 'Unknown error' };
  }

  // ─── Abstract Methods (must be overridden) ──────────────────

  /**
   * Test if credentials are valid.
   * @param {Object} credentials
   * @returns {Promise<{ ok: boolean, error?: string, accountInfo?: Object }>}
   */
  async testConnection(/* credentials */) {
    throw new Error(`${this.id}: testConnection() not implemented`);
  }

  /**
   * Fetch trades from broker API.
   * @param {Object} credentials
   * @param {Object} options
   * @returns {Promise<Object[]>} Normalized trade objects
   */
  async fetchTrades(/* credentials, options */) {
    throw new Error(`${this.id}: fetchTrades() not implemented`);
  }

  /**
   * Get broker-specific setup instructions.
   * @returns {{ steps: string[], tips: string[], url?: string }}
   */
  getSetupGuide() {
    return {
      steps: ['Enter your API credentials', 'Click "Test Connection"', 'Start syncing'],
      tips: [],
      url: null,
    };
  }

  // ─── Serialization ──────────────────────────────────────────

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      logo: this.logo,
      status: this._status,
      lastSync: this._lastSync,
      lastError: this._lastError,
      requiredFields: this.requiredFields,
    };
  }
}

export default BrokerConnector;
