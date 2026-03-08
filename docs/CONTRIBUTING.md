# Contributing to charEdge

Welcome! This guide covers the workflow for making changes to charEdge.

## Quick Reference

| Action | Command |
|--------|---------|
| Dev server | `npm run dev` → `localhost:5173` |
| Run tests | `npm test` |
| Watch tests | `npm run test:watch` |
| E2E tests | `npx playwright test` |
| Lint | `npm run lint:fix` |
| Full check | `npm run check` |
| Production build | `npm run build && npm start` |

For detailed setup, see [getting-started.md](./getting-started.md) and [DEV_WORKFLOW.md](./DEV_WORKFLOW.md).

## Environment Variables

Copy `.env.example` → `.env.local`. Required for live data:

```env
VITE_BINANCE_API_KEY=       # Crypto OHLCV + WebSocket
```

Optional keys unlock more features — see `.env.example` for the full list. AI keys (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`) are **server-only** and should never have the `VITE_` prefix.

## Branch Naming

```
feat/short-description       # New feature
fix/issue-description        # Bug fix
refactor/scope               # Code cleanup
docs/topic                   # Documentation
perf/optimization-area       # Performance
test/what-is-tested          # Test additions
```

## PR Conventions

1. **Title**: `[scope] Short imperative description` (e.g., `[chart] Add Fib level color config`)
2. **Description**: What changed and why. Link to task ID if applicable (e.g., `Task 3A.7`)
3. **Self-review**: Run `npm run check` before pushing
4. **Screenshots**: Include for any UI changes (before/after)
5. **Breaking changes**: Call out in PR description with `⚠️ BREAKING:`

## Architecture Decisions

Significant design decisions are recorded as ADRs in `docs/adr/`. Use the [ADR template](./adr/000-template.md) when:
- Choosing one approach over another (e.g., "why Zustand over Redux")
- Changing a core pattern (e.g., store consolidation)
- Adding a major dependency

## Key Patterns

| Pattern | Location | Purpose |
|---------|----------|---------|
| `Result<T, E>` | `src/utils/errors.ts` | Recoverable error handling |
| Branded types | `src/types/` | Compile-time domain safety |
| Feature flags | `useFeatureFlag.js` | Gate experimental features |
| Design tokens | `constants.js` (`C`, `F`, `M`) | Consistent theming |
| Encrypted storage | `encryptedPersistStorage.js` | Sensitive data persistence |

## File Organization

```
src/
├── app/              # React UI layer
│   ├── components/   # Reusable components
│   ├── features/     # Feature modules (journal, sharing)
│   ├── layouts/      # Page layouts + routing
│   └── hooks/        # Custom React hooks
├── charting_library/ # Chart engine (canvas/WebGPU)
├── data/             # Data fetching, adapters, pipeline
├── intelligence/     # AI/LLM integration
├── state/            # Zustand stores
├── services/         # Business logic services
└── utils/            # Shared utilities
```

## Questions?

Check [ARCHITECTURE.md](./ARCHITECTURE.md), [STATE_ARCHITECTURE.md](./STATE_ARCHITECTURE.md), or the [runbooks](./runbooks.md).
