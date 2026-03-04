# charEdge — Developer Documentation

**192 files · 53,197 lines · React 18 + Zustand + Canvas**

---

| Document | Contents |
|----------|----------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System layers, data flow, routing, performance architecture, file organization, key conventions |
| [COMPONENT_MAP.md](./COMPONENT_MAP.md) | Full component tree, React.memo boundaries (15), lazy loading (30), ARIA coverage, shared components |
| [FILE_MANIFEST.md](./FILE_MANIFEST.md) | Every source file with line count and description, organized by layer (pages, components, engine, state, data, utils) |
| [THEME_GUIDE.md](./THEME_GUIDE.md) | Color token reference (C object), dark/light palettes, usage patterns, design tokens (spacing, radii, shadows, z-index), remaining hardcoded colors |

## Quick Stats

| Metric | Value |
|--------|-------|
| Source files | 200+ |
| Source lines | 55,000+ |
| Test files | 103 |
| Test cases | 2,940 |
| React.memo boundaries | 15 |
| Lazy-loaded components | 30 |
| Zustand stores | 35 |
| ARIA attributes | 64 |
| tf-btn classes | 166 |
| Hardcoded colors (pages) | 0 |
| Hardcoded colors (components) | 9 (intentional) |
| Dead code quarantined | 48 files / 9,951 lines |

## Dev Workflow

```bash
# Development (recommended)
npm run dev          # Vite dev server with HMR

# Run tests
npm test             # vitest run
npm run test:watch   # vitest in watch mode

# Build for production
npm run build        # client + server bundles
npm run preview      # preview production build
```
