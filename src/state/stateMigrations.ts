// ═══════════════════════════════════════════════════════════════════
// charEdge — State Migration Utilities (Sprint 3 — Task 3.3)
//
// Helpers for versioned Zustand persist migrations.
// All persisted stores should use `version` + `migrate` in their
// persist config to enable safe schema evolution.
//
// Usage:
//   import { createMigration } from './stateMigrations';
//
//   persist(storeCreator, {
//     name: 'my-store',
//     version: 2,
//     migrate: createMigration({
//       1: (state) => ({ ...state, newField: 'default' }),
//       2: (state) => {
//         const { deprecated, ...rest } = state;
//         return rest;
//       },
//     }),
//   })
// ═══════════════════════════════════════════════════════════════════

/**
 * Migration function type: takes old state, returns new state.
 */
type MigrateFn = (state: any) => any;

/**
 * Creates a sequential migration function for Zustand persist.
 *
 * Zustand's `migrate(persistedState, version)` is called when the
 * stored version < current version. This helper runs all migration
 * steps in order from (storedVersion + 1) to currentVersion.
 *
 * @param migrations - Object mapping version numbers to migration functions.
 *                     Each function transforms state FROM the previous version.
 *
 * @example
 * ```ts
 * migrate: createMigration({
 *   // Version 1 → 2: add riskTolerance field
 *   2: (state) => ({ ...state, riskTolerance: 'medium' }),
 *   // Version 2 → 3: rename darkMode → theme
 *   3: (state) => {
 *     const { darkMode, ...rest } = state;
 *     return { ...rest, theme: darkMode ? 'dark' : 'light' };
 *   },
 * })
 * ```
 */
export function createMigration(migrations: Record<number, MigrateFn>) {
  return (persisted: any, version: number): any => {
    let state = persisted || {};

    // Get all migration versions sorted ascending
    const versions = Object.keys(migrations)
      .map(Number)
      .sort((a, b) => a - b);

    // Run each migration step from storedVersion+1 onward
    for (const v of versions) {
      if (v > version) {
        try {
          state = migrations[v](state);
        } catch (err) {
          // Migration errors are non-fatal — return state as-is
          console.warn(`[StateMigration] Migration to v${v} failed:`, err);
        }
      }
    }

    return state;
  };
}

/**
 * Simple version bump — adds `_schemaVersion` field to any store
 * that doesn't use Zustand's built-in versioning.
 *
 * For stores that already use Zustand `persist({ version })`,
 * this is redundant — use `createMigration` instead.
 */
export function withSchemaVersion<T extends Record<string, any>>(
  version: number,
  defaults: Partial<T> = {},
): (persisted: any) => T {
  return (persisted: any): T => {
    const state = (persisted || {}) as T;
    const pv = (state as any)._schemaVersion ?? 0;
    if (pv < version) {
      return { ...defaults, ...state, _schemaVersion: version } as T;
    }
    return state;
  };
}

export default createMigration;
