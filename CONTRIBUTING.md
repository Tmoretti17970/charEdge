# Contributing to charEdge

Thanks for your interest in contributing to **charEdge**! This guide will get you set up quickly.

## Dev Setup

```bash
# 1. Clone and install
git clone <repo-url>
cd trade-forge
npm install

# 2. Start dev server (Vite HMR)
npm run dev
# → http://localhost:5173

# 3. Run tests
npm test              # Single run
npm run test:watch    # Watch mode
npm run test:ui       # Vitest UI
```

## Code Style

- **ESLint + Prettier** — enforced via `npm run lint` and `npm run format`
- Run `npm run check` before submitting PRs (lint + format + test + audit)
- No `any` types without `// eslint-disable` justification

## Project Structure

```
src/
├── app/                    # React UI (components, layouts, pages)
├── charting_library/       # GPU charting engine (core, renderers, tools)
│   ├── core/               # ChartEngine, FrameState, Pipeline, Layers
│   ├── renderers/          # WebGL, WebGPU, Canvas2D renderers
│   ├── tools/              # Drawing tools, alerts
│   └── studies/            # Indicators, pattern detection
├── data/                   # Data layer (adapters, cache, pipeline)
│   ├── adapters/           # Exchange-specific WebSocket adapters
│   └── engine/             # DataPipeline, TickerPlant, workers
├── state/                  # Zustand stores (35+)
├── utils/                  # Shared utilities (logger, hotkeys, etc.)
└── __tests__/              # Test suites
```

## Testing

- **Vitest** for unit/integration tests
- **Playwright** for e2e (`npm run test:e2e`)
- Tests live in `src/__tests__/` organized by category:
  - `engine/` — chart engine, renderers, GPU, pipeline
  - `data/` — fetch, cache, pipeline, streaming
  - `ui/` — component interaction, accessibility
  - `stores/` — Zustand store tests
  - `integration/` — end-to-end, multi-system flows
  - `benchmarks/` — performance regression tests
  - `security/` — CSP, proxy, auth, encryption
  - `helpers/` — shared utilities + test factories
- Name tests descriptively: `validation.test.js`, not `sprint12.test.js`

## Pull Request Workflow

1. Create a feature branch: `git checkout -b feat/my-feature`
2. Make changes and add tests
3. Run full check: `npm run check`
4. Open a PR with a clear description
5. All CI checks must pass before merge

## Key Conventions

- **Inline styles**: Existing components use React `style={}` props. New components should prefer CSS modules or `global.css` utility classes (`tf-glass`, `tf-btn`, etc.)
- **Logging**: Use `import { logger } from '../utils/logger.js'` instead of `console.log`
- **Error handling**: Use `ChartError` for engine validation errors
- **Constants**: Colors, fonts, and spacing constants are in `src/constants.js` and `src/theme/global.css`
