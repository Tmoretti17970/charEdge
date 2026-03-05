# charEdge — Brand Guidelines

## Identity
**charEdge** is a professional trading journal and chart analysis platform. The brand conveys precision, confidence, and calm under pressure.

### Logo
- **Full mark:** `public/logo.svg` — ascending candlestick pattern with trendline
- **Icon mark:** `public/logo-mark.svg` — compact 5-candle icon for favicon/small contexts
- **Clear space:** Minimum 1× the "c" width around all sides
- **Minimum size:** 16px for icon mark, 80px for full mark

### Color Palette
| Token | oklch | Usage |
|-------|-------|-------|
| Navy | `oklch(0.22 0.03 260)` | Primary backgrounds |
| Teal | `oklch(0.65 0.14 170)` | Bull candles, success, CTA |
| Coral | `oklch(0.60 0.19 25)` | Bear candles, errors, destructive |
| Blue | `oklch(0.62 0.19 255)` | Interactive elements, links, focus |
| Gold | `oklch(0.75 0.16 80)` | Alerts, premium features, warnings |
| Purple | `oklch(0.60 0.20 300)` | Gamification, achievements, XP |

### Typography
- **Primary font:** Inter (Google Fonts, weights 400-700)
- **Chart data:** System monospace for numeric precision
- **Scale:** See `tokens.css` — 8px (3xs) to 48px (5xl)

### Spacing
- 4px base unit. All spacing uses `--sp-*` tokens.
- Density modes: compact (4px), default (8px), comfortable (12px)

---

## Voice & Tone

| Context | Tone | Example |
|---------|------|---------|
| Chart UI | Precise, minimal | "BTC/USDT · 4h · +2.3%" |
| Journal | Supportive, reflective | "Great discipline today" |
| Alerts | Urgent, clear | "BTC hit $42,000 target" |
| Errors | Calm, actionable | "Connection lost — reconnecting" |
| Onboarding | Warm, encouraging | "Let's set up your first chart" |
| Settings | Neutral, factual | "Export data as CSV" |

---

## Product Tiers

| Tier | Target | Features |
|------|--------|----------|
| **Edge Free** | Everyone | Chart + journal + 3 indicators |
| **Edge Alpha** | Active traders | Full indicators + alerts + AI insights |
| **Edge Pro** | Professionals | Multi-chart + API access + priority data |

---

## Component Patterns

### Glass Surfaces
Use `tf-glass` classes for floating UI elements (panels, dropdowns, tooltips).

### Elevation
4-tier depth system: `tf-depth-1` → `tf-depth-4`

### Motion
All animations use `--dur-*` and `--ease-*` tokens. Respect `prefers-reduced-motion`.

### Corner Radii
- Small elements (badges, chips): `--br-sm` (4px)
- Cards, buttons: `--br-md` (8px)
- Panels, modals: `--br-lg` (12px)
- Hero containers: `--br-xl` (16px) to `--br-2xl` (24px)
