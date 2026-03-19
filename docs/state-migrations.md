# State Migrations Guide

## Overview

All persisted Zustand stores in charEdge use **schema versioning** to safely evolve their shape over time. When adding, removing, or renaming fields, bump the version and add a migration function.

## How It Works

Zustand's `persist()` middleware stores a `version` alongside state in localStorage/IDB. On hydration, if the stored version is less than the current version, the `migrate()` function runs to transform old state into the new shape.

## Adding a New Field

```ts
// Before: version 1
persist(storeCreator, { name: 'my-store', version: 1 })

// After: version 2 — adding riskTolerance
import { createMigration } from './stateMigrations';

persist(storeCreator, {
  name: 'my-store',
  version: 2,
  migrate: createMigration({
    2: (state) => ({ ...state, riskTolerance: 'medium' }),
  }),
})
```

## Removing a Field

```ts
// Version 3 — removing deprecated 'legacyMode'
migrate: createMigration({
  2: (state) => ({ ...state, riskTolerance: 'medium' }),
  3: (state) => {
    const { legacyMode, ...rest } = state;
    return rest;
  },
})
```

## Renaming a Field

```ts
// Version 4 — rename 'darkMode' → 'theme'
migrate: createMigration({
  // ...previous migrations
  4: (state) => {
    const { darkMode, ...rest } = state;
    return { ...rest, theme: darkMode ? 'dark' : 'light' };
  },
})
```

## Rules

1. **Never remove old migrations** — users may be on any version
2. **Migrations run sequentially** — v1→v2→v3→v4
3. **Migrations are non-fatal** — errors are caught and logged
4. **Always provide defaults** — use `??` or `||` for safety
5. **Test with fresh + existing data** — clear localStorage to test fresh, keep it to test migration

## Current Store Versions

| Store | Version |
|---|:---:|
| useNotificationStore | 2 |
| useUserStore | 2 |
| useAICoachStore | 2 |
| useMarketsPrefsStore | 3 |
| All others | 1 |
