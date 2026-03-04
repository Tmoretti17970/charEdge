# charEdge — Developer Workflow

## Development Modes

### 1. Vite HMR (default — fastest)

```bash
npm run dev
```

Starts the Vite dev server with hot module replacement on `http://localhost:5173`.
Use this for day-to-day frontend development.

### 2. Express + SSR

```bash
npm run dev:ssr
```

Starts the Express server with Vite SSR middleware on `http://localhost:3000`.
Use this when testing server-side rendering, API proxy routes, or SSR-specific bugs.

### 3. Production

```bash
npm run build && npm start
```

Builds client + server bundles, then starts the production Express server.
Use this for final pre-deploy verification.

---

## Test Commands

| Command | Purpose |
|---|---|
| `npm test` | Run all tests once (`vitest run`) |
| `npm run test:watch` | Watch mode — re-runs on file change |
| `npm run test:ui` | Vitest UI dashboard in browser |
| `npm run test:coverage` | Coverage report via `@vitest/coverage-v8` |
| `npm run test:e2e` | Playwright end-to-end tests |

### Test Directory Structure

```
src/__tests__/
├── engine/       ← Chart engine, renderers, pipeline, GPU
├── data/         ← Fetch, cache, pipeline, streaming
├── stores/       ← Zustand store tests
├── ui/           ← Component interaction, UX, a11y
├── integration/  ← E2E flows, multi-system tests
├── security/     ← CSP, proxy, auth, encryption
├── benchmarks/   ← Performance regression tests
├── helpers/      ← Utility/math tests + shared factories
```

### Shared Test Factories

Import from `src/__tests__/helpers/factories.js`:

```js
import { createMockBars, createMockEngine, createMockCanvas, createMockStore } from '../helpers/factories.js';
```

---

## Lint & Format

| Command | Purpose |
|---|---|
| `npm run lint` | ESLint check |
| `npm run lint:fix` | Auto-fix lint issues |
| `npm run format` | Prettier format all source |
| `npm run format:check` | Check formatting without writing |

## Full Quality Check

```bash
npm run check
```

Runs lint → format check → tests → npm audit in sequence.
