---
description: Code Cleanup — quarantine P2P modules, remove deprecated shims, kill dead code, prune unused imports
---

# Agent 10: Code Cleanup & Dead Code Sweep

// turbo-all

## Overview
Systematic cleanup pass: quarantine unused P2P/community modules into a `_quarantine/` folder, remove deprecated functions, eliminate dead imports, and reduce bundle bloat.

## File Boundaries
This agent touches many files but only for **removals and moves** — no new features.

**DO NOT modify:**
- `src/constants.js` (shared dependency)
- `src/theme/` (owned by Agent 1)
- `src/pages/DashboardPage.jsx` (owned by Agent 2)
- `src/pages/ChartsPage.jsx` (owned by Agent 3)
- `src/data/engine/CacheManager.js` or `server.js` (owned by Agent 4)

## Steps

### 1. Quarantine P2P modules (unused, no backend)

The P2P system (Phase 10) requires a signaling server that doesn't exist yet. These modules are dead code in production. Move them into `src/_quarantine/p2p/`:

**Files to move:**
- `src/data/engine/PeerMesh.js`
- `src/data/engine/PeerProtocol.js`
- `src/data/engine/DataRelayNode.js`
- `src/data/engine/SentimentVoting.js`
- `src/data/engine/TradeHeatmapEngine.js`
- `src/data/engine/CommunitySignalEngine.js`
- `src/app/hooks/usePeerMesh.js`
- `src/app/components/ui/PeerStatsPanel.jsx`
- `src/app/components/data/CommunitySignals.jsx`
- `src/app/components/social/SentimentRing.jsx`

**After moving, find all files that import these modules and:**
- Comment out the import with `// QUARANTINED: P2P (no signaling server)`
- Replace usage with null/no-op to prevent crashes
- Keep the test files (they validate the engine logic and should still pass)

### 2. Audit the Community page

`src/pages/CommunityPage.jsx` depends heavily on P2P. Check if it can function without:
- If yes, leave it but remove P2P imports
- If no, add a "Coming Soon" placeholder and skip the P2P imports

### 3. Remove deprecated `syncThemeColors`

In `src/constants.js`:
- `syncThemeColors()` is marked `@deprecated`
- Check if anything still calls it (found in `tokens.js` and `constants.js` itself)
- If only internal backward-compat, remove the function
- Update any remaining callers to use `refreshThemeCache()` instead

### 4. Clean up DataCache references

`src/data/DataCache.js` was supposed to be consolidated into `CacheManager`. Check:
- Is `DataCache` still imported directly anywhere outside `CacheManager`?
- If direct consumers exist, note them (Agent 4 handles the migration)
- If no direct consumers remain, mark `DataCache.js` as internal to CacheManager

### 5. Find unused exports

Run a quick scan for exports that have zero imports:
```
# For each .js/.jsx in src/, check if its exports are used anywhere
```
Focus on:
- Store files in `src/state/` — any stores with 0 consumers?
- Adapter files in `src/data/adapters/` — any adapters never imported?
- Components in `src/app/components/` — any components never rendered?

List findings but only remove things that are clearly dead (not just conditionally loaded).

### 6. Remove console.log debugging

Search for stray `console.log` statements that look like debugging (not intentional logging):
```
grep -r "console.log" src/ --include="*.js" --include="*.jsx"
```
- Remove any that log raw data, debug messages, or "TODO" markers
- Keep any that are part of intentional error handling or the pipeline logger

### 7. Prune unused npm dependencies

Check `package.json` for dependencies that aren't imported anywhere:
```
# For each dependency in package.json, search for imports in src/
```
List candidates for removal but **do not run npm uninstall** — just report findings.

### 8. Verify

```
npx vitest run
```

Run the full test suite. Quarantined module tests should still pass (they test pure logic, not browser APIs). No other tests should break from import removals.

## Deliverable

Create a cleanup report as a markdown file at the project root (`CLEANUP_REPORT.md`) listing:
- Files quarantined and why
- Deprecated code removed
- Dead exports found
- Unused dependencies flagged
- Any issues encountered
