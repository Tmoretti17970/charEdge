---
description: Dashboard Narrative Redesign — hero stats, narrative sections, metric tooltips, per-widget loading
---

# Agent 2: Dashboard Narrative Redesign

// turbo-all

## Overview
Implement Sprint 3 of the Design Overhaul from `DESIGN_OVERHAUL_SPRINTS.md`. Transform the dashboard from a flat widget grid into a narrative-driven layout that tells the trader's daily story.

## File Boundaries (ONLY modify these files)
- `src/pages/DashboardPage.jsx` — layout restructuring
- `src/app/components/dashboard/` — all existing dashboard widgets + new ones below
- **NEW** `src/app/components/dashboard/HeroStat.jsx`
- **NEW** `src/app/components/dashboard/SectionHeader.jsx`
- **NEW** `src/app/components/dashboard/MetricTooltip.jsx`
- **NEW** `src/hooks/useCountUp.js`
- **NEW** `src/utils/timeAgo.js`
- `src/app/components/ui/WidgetBoundary.jsx` — per-widget loading enhancement

**DO NOT modify any files outside this list.**

## Steps

### 1. Read the sprint doc for full context
```
Read DESIGN_OVERHAUL_SPRINTS.md — focus on Sprint 3 tasks 3.1 through 3.7
```

### 2. Create HeroStat component (Task 3.1)
Full-width hero area at top of dashboard showing:
- Today's P&L in `data-hero` size (32px font, JetBrains Mono)
- Today's trade count and win rate as supporting metrics
- Background uses subtle radial gradient glow behind the number
- Color: green when profitable, red when loss
- Use existing trade data from `useTradeStore` or `useAnalyticsStore`

### 3. Create SectionHeader component (Task 3.3)
Contextual headers for each dashboard section:
- "Today's Session" / "Your Trend (30d)" / "Patterns & Habits" / "Risk Check" / "Recent Activity"
- Uses h2 typography with a subtle left accent border in brand color (#e8642c)
- Compact, clean design

### 4. Restructure DashboardPage layout (Task 3.2)
Replace free-form widget grid as the DEFAULT with narrative layout:
1. **Hero stat** — Today's P&L (HeroStat component)
2. **Trend** — Equity curve + streak
3. **Patterns** — Calendar heatmap + insights
4. **Risk** — Risk metrics + alerts
5. **Activity** — Recent trades

Keep the existing widget customizer available as "Custom Layout" option.

### 5. Create StatCard tiers (Task 3.4)
Redesign `StatCard` with 3 variants via a `tier` prop:
- `hero` — large number, brand glow background, used for Today's P&L
- `primary` — medium number, card background, used for Total P&L / Profit Factor / Sharpe
- `secondary` — small number, inline, used for everything else

### 6. Add metric tooltips (Task 3.6)
Add `(i)` icon tooltips next to financial metrics:
- Profit Factor: "Your gross profits divided by gross losses. Above 1.5 is strong."
- Sharpe Ratio: "Risk-adjusted return. Above 1 is decent, above 2 is excellent."
- Kelly Criterion: "Optimal position size based on your win rate and average win/loss."
- Max Drawdown, Risk of Ruin, Sortino: plain-English explanations

### 7. Create useCountUp hook (Task 5.3)
Animate hero stat numbers from 0 to their actual value:
- ~300ms duration with ease-out curve
- Triggered once on mount, not on re-render
- Used by HeroStat and key dashboard numbers

### 8. Create timeAgo utility (Task 3.7)
Simple utility: `timeAgo(date)` returning "2h ago" / "yesterday" / "Mon" etc.
- Full date accessible via title attribute on hover
- Used in recent trades list

### 9. Per-widget skeleton loading (Task 3.5)
Update `WidgetBoundary.jsx` so each widget shows its own skeleton independently:
- Individual loading/error states per widget
- Not a single page-level skeleton

### 10. Verify
```
npx vitest run
```

Run the full test suite. Fix any failing tests. Ensure the dashboard tells a top-to-bottom story and new traders can understand metrics via tooltips.
