# charEdge

> **Institutional-grade charting + behavioral intelligence at retail pricing.**

[![CI](https://github.com/Tmoretti17970/charEdge/actions/workflows/ci.yml/badge.svg)](https://github.com/Tmoretti17970/charEdge/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A WebGPU/Canvas hybrid charting engine with an integrated AI trading coach, journal system, and behavioral analytics — built for traders who want to understand *why* they trade, not just *what* they trade.

---

## ✨ Features

| Feature | What It Does |
|---------|-------------|
| **WebGPU/Canvas Hybrid Engine** | Renders 100K+ candles in <5ms with 120fps ProMotion support |
| **AI Co-Pilot** | Real-time pattern detection, voice-to-chart, and trading bias analysis |
| **Journal ↔ Chart Link** | Ghost boxes overlay your trade entries directly on the chart |
| **Behavioral Intelligence** | Tilt detection, mistake heatmaps, decision trees, session cards |
| **Quant Dashboard** | Sharpe, Sortino, Kelly Criterion, drawdown tracking, equity curves |
| **Zero Idle Burn** | 0% rAF usage when not interacting — battery-friendly |
| **Liquid Glass UI** | Apple-grade design with adaptive themes (Dark, Light, Deep Sea, Clear) |

## 🚀 Quick Start

```bash
# Clone the repo
git clone https://github.com/Tmoretti17970/charEdge.git
cd charEdge

# Install dependencies
npm install

# Copy environment config
cp .env.example .env.local
# Edit .env.local with your API keys (Binance, etc.)

# Start development server
npm run dev
# → Open http://localhost:5173
```

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | React 18 + Vite 6 |
| **State** | Zustand 5 (35+ domain stores) |
| **Rendering** | WebGPU + Canvas 2D (OffscreenCanvas workers) |
| **Data** | Binance, AlphaVantage, Polygon adapters + IndexedDB/OPFS cache |
| **Styling** | Vanilla CSS with design tokens + CSS custom properties |
| **Testing** | Vitest (2,400+ tests) + Playwright (17 E2E specs) |
| **Auth** | Supabase |
| **Monitoring** | Sentry + Vercel Analytics + PostHog |
| **Deployment** | Vercel (Edge) + Docker + Fly.io |

## 📁 Project Structure

```
src/
├── app/           # React components (pages, panels, widgets)
├── charting_library/  # WebGL/Canvas rendering engine
├── data/          # Data adapters, fetch services, streaming
├── state/         # Zustand stores (35+ domain stores)
├── utils/         # Shared utilities, color, math, format
└── __tests__/     # Unit + integration tests
e2e/               # Playwright E2E specs (accessibility, perf, visual)
docs/              # Architecture, guides, sprint reports
api/               # Serverless API routes
server/            # Express SSR server
```

## 📖 Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/ARCHITECTURE.md) | System layers, data flow, performance |
| [State Architecture](docs/STATE_ARCHITECTURE.md) | Zustand store diagram and domain groups |
| [Getting Started](docs/getting-started.md) | Full setup guide with API key configuration |
| [Component Map](docs/COMPONENT_MAP.md) | React component tree and boundaries |
| [Theme Guide](docs/THEME_GUIDE.md) | Color tokens, design system reference |
| [Deploy Guide](docs/DEPLOY.md) | Vercel, Docker, Fly.io deployment |

## 🧪 Commands

```bash
npm run dev           # Vite dev server with HMR
npm test              # Run vitest suite
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
npm run test:e2e      # Playwright E2E tests
npm run lint          # ESLint
npm run lint:css      # Stylelint
npm run build         # Production build (client + server)
npm run analyze       # Bundle size visualization
```

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for community standards.

## 📄 License

[MIT](LICENSE) © charEdge Contributors
