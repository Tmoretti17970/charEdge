# charEdge Naming Conventions

> Enforced via ESLint `@typescript-eslint/naming-convention` (warn level).

## Rules

| Category | Convention | Example |
|----------|-----------|---------|
| **Components** | PascalCase | `DashboardPanel.jsx`, `ChartEngine.ts` |
| **Hooks** | camelCase with `use` prefix | `useChartStore.js` |
| **Utilities / Services** | camelCase | `formatPrice.js`, `safePersist.js` |
| **Constants** | SCREAMING_SNAKE_CASE | `MAX_EXCHANGES`, `RATE_LIMIT_MAX` |
| **Types / Interfaces** | PascalCase | `SourceAdapter`, `PriceUpdate` |
| **Enum members** | PascalCase | `ChartType.Candle` |
| **Private fields** | `_` prefix + camelCase | `_sources`, `_bandwidth` |
| **CSS modules** | PascalCase matching component | `Button.module.css` |
| **Test files** | camelCase matching subject | `chartEngine.test.js` |

## File Structure

```
src/
├── app/                    # React pages + components (PascalCase)
│   ├── components/         # Reusable UI components
│   ├── features/           # Feature-specific components
│   ├── layouts/            # Layout components
│   └── pages/              # Route pages
├── charting_library/       # Engine core (snake_case dirs, PascalCase files)
│   ├── core/               # ChartEngine, RenderPipeline
│   ├── renderers/          # WebGL, WebGPU
│   └── tools/              # Drawing tools
├── data/                   # Data layer
│   ├── adapters/           # Exchange adapters (PascalCase)
│   └── engine/             # Pipeline, TickerPlant
├── state/                  # Zustand stores (useXxxStore.js)
├── styles/                 # CSS modules
└── utils/                  # Utility functions (camelCase)
```
