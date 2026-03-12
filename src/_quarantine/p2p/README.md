# 🚫 Quarantined — P2P / Social Modules

**Quarantined:** 2026-03-11
**Reason:** No signaling server or backend exists for P2P features.
These modules (copy trading, live rooms, tournaments, leaderboards, chart ideas feed, etc.)
are fully built UI but have no backing infrastructure.

**When to revisit:** Post-launch, if user demand signals interest in social features.

## Contents
- `components/` — 31 UI components (panels, modals, widgets)
- `state/` — 6 Zustand slices (copyTrade, feed, follow, liveRoom, poll, signal)

## To restore
1. Move files back to `src/app/components/social/` and `src/state/social/`
2. Re-add slice imports in `src/state/useSocialStore.ts`
3. Re-add component imports in `MoreTab.jsx`, `IntelSection.jsx`, `DiscoverHeader.jsx`
