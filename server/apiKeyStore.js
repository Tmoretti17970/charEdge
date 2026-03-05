// ═══════════════════════════════════════════════════════════════════
// charEdge — In-Memory API Key Store
//
// Simple key store for development. In production, replace with
// database-backed KeyVault (src/api/KeyVault.js).
// ═══════════════════════════════════════════════════════════════════

import { randomUUID } from 'node:crypto';

const _keys = new Map();

/**
 * Validate an API key and return its metadata, or null.
 * @param {string} key
 * @returns {{ id: string, userId: string, createdAt: number } | null}
 */
export function validate(key) {
    return _keys.get(key) || null;
}

/**
 * Create a new API key for a user.
 * @param {string} userId
 * @returns {{ id: string, userId: string, createdAt: number }}
 */
export function create(userId) {
    const key = `ce_${randomUUID()}`;
    const data = { id: key, userId, createdAt: Date.now() };
    _keys.set(key, data);
    return data;
}

export default { validate, create };
