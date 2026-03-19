// ═══════════════════════════════════════════════════════════════════
// charEdge — Connector Registry (Phase 7 Sprint 7.1)
//
// Singleton registry for all broker connectors.
// Handles registration, lookup, and lazy instantiation.
// ═══════════════════════════════════════════════════════════════════

import { logger } from '@/observability/logger';

// ─── Registry ───────────────────────────────────────────────────

const _registry = new Map(); // id → { ConnectorClass, instance }

/**
 * Register a broker connector class.
 * @param {string} id - Unique broker ID (e.g., 'coinbase')
 * @param {Function} ConnectorClass - Class extending BrokerConnector
 */
export function registerConnector(id, ConnectorClass) {
  if (_registry.has(id)) {
    logger.data.warn(`[ConnectorRegistry] Overwriting connector: ${id}`);
  }
  _registry.set(id, { ConnectorClass, instance: null });
}

/**
 * Get a connector instance (lazy-created on first access).
 * @param {string} id
 * @returns {import('./BrokerConnector.js').BrokerConnector | null}
 */
export function getConnector(id) {
  const entry = _registry.get(id);
  if (!entry) return null;

  if (!entry.instance) {
    entry.instance = new entry.ConnectorClass();
    logger.data.info(`[ConnectorRegistry] Created instance: ${id}`);
  }

  return entry.instance;
}

/**
 * Check if a connector is registered.
 * @param {string} id
 * @returns {boolean}
 */
export function hasConnector(id) {
  return _registry.has(id);
}

/**
 * List all registered connector IDs and their metadata.
 * @returns {Array<{ id: string, name: string, logo: string, status: string, hasInstance: boolean }>}
 */
export function listConnectors() {
  const result = [];
  for (const [id, entry] of _registry) {
    if (entry.instance) {
      result.push({
        id,
        name: entry.instance.name,
        logo: entry.instance.logo,
        status: entry.instance.status,
        hasInstance: true,
      });
    } else {
      // Create temp instance just to read metadata, then discard
      const temp = new entry.ConnectorClass();
      result.push({
        id,
        name: temp.name,
        logo: temp.logo,
        status: 'disconnected',
        hasInstance: false,
      });
    }
  }
  return result;
}

/**
 * Get all active (connected) connector instances.
 * @returns {Array<import('./BrokerConnector.js').BrokerConnector>}
 */
export function getActiveConnectors() {
  const active = [];
  for (const [, entry] of _registry) {
    if (entry.instance && entry.instance.isConnected) {
      active.push(entry.instance);
    }
  }
  return active;
}

/**
 * Disconnect and destroy a connector instance.
 * @param {string} id
 */
export function destroyConnector(id) {
  const entry = _registry.get(id);
  if (entry?.instance) {
    entry.instance.disconnect();
    entry.instance = null;
    logger.data.info(`[ConnectorRegistry] Destroyed instance: ${id}`);
  }
}

/**
 * Disconnect and destroy all connector instances.
 */
export function destroyAll() {
  for (const [id] of _registry) {
    destroyConnector(id);
  }
}

export default {
  registerConnector,
  getConnector,
  hasConnector,
  listConnectors,
  getActiveConnectors,
  destroyConnector,
  destroyAll,
};
