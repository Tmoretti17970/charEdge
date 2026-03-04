# charEdge v10.5 — Launch Guide

## Quick Start (3 commands)

```bash
# 1. Unzip and enter directory
unzip charEdge_v10.5_Complete.zip -d charedge
cd charedge

# 2. Install dependencies
npm install

# 3. Launch dev server
npm run dev
```

Opens at **http://localhost:5173** — browser auto-launches.

---

## Requirements

- **Node.js** 18+ (recommended: 20+)
- **npm** 9+ (comes with Node)

Check your versions:
```bash
node -v   # Should show v18+
npm -v    # Should show 9+
```

Don't have Node? Get it from https://nodejs.org (LTS version).

---

## What You'll See

### First Load
The app starts with an empty state. You'll see the **Dashboard** with a prompt to add trades.

### Adding Sample Data
1. Click **Journal** in the sidebar
2. Click **+ Add Trade**
3. Fill in: Symbol (e.g. AAPL), Side (Long/Short), Entry/Exit prices, Quantity, Date
4. Add several trades to see the dashboard come alive

### Key Features to Test

**Dashboard (Sprint 8 — new)**
- Click **✏️ Edit** to drag-rearrange widgets
- Click **⚙️ Customize** to add/remove widgets or apply presets (Scalper, Swing, Prop Firm, Intelligence)
- New widgets: 🔥 Streak Tracker, 📈 Rolling Metrics, 🎯 Goal Progress, ☀️ Daily Debrief

**Charts**
- Navigate to **Charts** tab
- Try drawing tools: press **T** (trendline), **H** (horizontal line), **F** (Fibonacci)
- Press **I** to toggle the **Intelligence Panel** (auto S/R levels, candlestick patterns, divergences)
- Click **🧠 Intel** in toolbar to toggle chart intelligence on/off
- Press **?** for all keyboard shortcuts

**Mobile**
- Resize browser to <480px width to see mobile mode
- Touch gestures, swipe navigation, bottom sheet tools

---

## Available Scripts

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Preview production build locally |
| `npm run test` | Run test suite (493 tests) |
| `npm run test:watch` | Tests in watch mode |
| `npm run test:coverage` | Tests with coverage report |
| `npm run lint` | ESLint check |
| `npm run format` | Prettier format all files |

---

## Troubleshooting

**"Module not found" errors**
→ Run `npm install` again. Make sure you're in the project root.

**Port 5173 in use**
→ Kill the other process or change port: `npm run dev -- --port 3000`

**Blank screen / white page**
→ Open browser console (F12) and check for errors. Usually a missing dependency.

**Charts show no data**
→ The app uses demo/sample data generators. If charts are empty, try switching symbols or timeframes in the chart toolbar.

---

## Architecture at a Glance

```
246 source files · 63,653 lines of code

src/
├── components/     # 40+ React components
├── engine/         # Analytics, patterns, rendering (pure functions)
├── state/          # Zustand stores (trade, chart, alert, dashboard, etc.)
├── pages/          # Dashboard, Journal, Charts, Analytics, Social, Settings
├── theme/          # Design tokens, global CSS
├── utils/          # Helpers, media queries, CSV parsing
└── data/           # Mock data services
```

**Sprint History:**
- S4: Keyboard shortcuts, screenshots, trade form
- S5: Chart dominance (30+ drawing tools, comparison overlay, scripts)
- S6: Mobile pro (touch gestures, swipe nav, haptic feedback)
- S7: Intelligence layer (auto S/R, 17 candlestick patterns, divergences, smart alerts)
- S8: Dashboard overhaul (widget grid, 6 new widgets, presets, customizer)
