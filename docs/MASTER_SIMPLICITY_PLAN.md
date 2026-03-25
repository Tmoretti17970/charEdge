# charEdge Master Simplicity Plan

## The Apple Design Audit — Complete Implementation Strategy

> "Simple can be harder than complex. You have to work hard to get your thinking clean
> to make it simple." — Steve Jobs

**Codebase audited**: ~195,000 LOC across ~1,000 files
**Components**: 443 React components, 39 Zustand stores, 43 custom hooks
**Data layer**: 54,369 LOC, 35+ adapters, 4-tier cache
**Verdict**: Feature-complete but complexity-heavy. The fix is not removing features —
it's showing 20% by default and letting the other 80% be discoverable.

---

## Phase 0: Zen Mode Default (Week 1)

**Goal**: New users see a calm, focused dashboard — not a Bloomberg terminal.

### 0.1 — Progressive Dashboard Unlock System

**Files**: `src/app/components/dashboard/DashboardNarrativeLayout.jsx`, `src/state/useUIStore.ts`

Create a `dashboardTier` system based on trade count:

| Trades | Dashboard Shows                                            | Unlocks                          |
| ------ | ---------------------------------------------------------- | -------------------------------- |
| 0      | Empty state + "Add Trade" CTA                              | —                                |
| 1-4    | Getting Started banner + Equity sparkline + Watchlist      | —                                |
| 5-9    | + Heatmap (12 weeks) + MetricsRow (2 stats: P&L, Win Rate) | Intraday, Strategy breakdown     |
| 10-19  | + Full MetricsRow (4 stats) + RiskDashboard                | MorningBriefing, SessionTimeline |
| 20+    | + AI InsightCard + Full heatmap (52 weeks)                 | MonteCarloWidget, WhatIfPanel    |
| 50+    | Everything visible                                         | TradeReplayPanel                 |

**Implementation**:

- Add `dashboardTier` computed property to `useUIStore` or `useAnalyticsStore`
- In `DashboardNarrativeLayout.jsx`, wrap each section with tier gate:
  ```jsx
  {
    tier >= 2 && (
      <Suspense fallback={null}>
        <RiskDashboard />
      </Suspense>
    );
  }
  ```
- Show subtle "unlock" hints: "Log 5 more trades to unlock Risk Dashboard"
- User can override with "Show All" toggle in settings

### 0.2 — Simplify Session Summary Bar

**File**: `src/app/components/dashboard/SessionSummaryBar.jsx`

**Current**: 7 stats visible (Today P&L, trades, WR, week, month, total, streak)
**Target**: 2 stats by default (Today's P&L + Win Rate), tap "..." to expand rest

- Keep the full computation, just hide Week/Month/Total/Streak behind an expand chevron
- Expanded state remembered in localStorage

### 0.3 — Header CTA Consolidation

**File**: `src/pages/journal/JournalHeader.jsx`

**Current**: 3 buttons (Logbook | Import | + Add Trade)
**Target**: 1 primary button ("+ Add Trade") + overflow menu (⋯) with Logbook + Import

- Replace segmented CTA with single primary + icon menu
- Saves ~200px of header real estate

### 0.4 — Gamification Off by Default

**File**: `src/state/useGamificationStore.ts`

- Set `enabled: false` as default in store initialization
- Add opt-in card in onboarding wizard (Step 2): "Enable XP & Streaks?"
- When disabled: no LevelUpModal, no MilestoneModal, no sidebar XP badge, no QuestWidget

**Estimated effort**: 5 days

---

## Phase 1: Design System Consolidation (Weeks 2-3)

**Goal**: One source of truth for every visual decision.

### 1.1 — Kill Dual Token System

**Delete**: `src/styles/tokens.css` (88 legacy tokens)
**Keep**: `src/theme/tokens.css` (278 canonical `--tf-*` tokens)

Migration steps:

1. Search all files for `var(--sp-`, `var(--fs-`, `var(--br-`, `var(--shadow-` (legacy prefixes)
2. Replace with canonical `--tf-space-*`, `--tf-fs-*`, `--tf-radius-*`, `--tf-shadow-*`
3. Delete `src/styles/tokens.css`
4. Remove legacy alias section at bottom of `src/theme/tokens.css` (the `--c-*`, `--fs-*`, `--br-*` mappings)

**Files to update** (grep for legacy tokens):

- All 7 CSS modules in `src/styles/*.module.css`
- `src/theme/strategy.css`
- `src/theme/chart-components.css`
- `src/theme/overlays.css`
- `src/theme/mobile.css`
- `src/theme/data.css`

### 1.2 — Fix Token Conflicts

**File**: `src/theme/tokens.css`

| Token            | Current              | Fix            |
| ---------------- | -------------------- | -------------- |
| `--tf-radius-md` | 16px                 | Change to 12px |
| `--tf-radius-lg` | 16px (duplicate!)    | Keep at 16px   |
| `--tf-z-toast`   | 400 (same as modal!) | Change to 600  |

### 1.3 — Color Reduction (147 → 30)

**Files**: All CSS and theme files

Audit every raw hex/rgba and replace with tokens:

- `#EF5350` → `var(--tf-red)` (11 occurrences)
- `#26A69A` → `var(--tf-green)` (7 occurrences)
- `#FFA726` → `var(--tf-accent)` or `var(--tf-orange)` (4 occurrences)
- `rgba(255,255,255,0.06)` → `var(--tf-bd)` (border color token)
- `rgba(20,20,30,0.6)` → `var(--tf-depth-raised-bg)` (depth tier token)

Target palette (30 colors):

- 4 backgrounds: `--tf-bg`, `--tf-bg2`, `--tf-sf`, `--tf-sf2`
- 3 text: `--tf-t1`, `--tf-t2`, `--tf-t3`
- 2 borders: `--tf-bd`, `--tf-bd2`
- 1 accent + 1 accent hover
- 9 semantic: green, red, yellow, purple, cyan, pink, orange, lime, info
- 4 glass tiers
- 4 depth tiers
- 2 special (bullish, bearish)

### 1.4 — Shadow System Enforcement

**Files**: All CSS files with `box-shadow`

Replace 31 ad-hoc shadows with canonical 5-tier system:

- `--tf-shadow-0` (none)
- `--tf-shadow-1` (subtle, 2px blur)
- `--tf-shadow-2` (medium, 4px/16px)
- `--tf-shadow-3` (elevated, 12px/40px)
- `--tf-shadow-4` (floating, 24px/80px)

Search: `box-shadow:` in all CSS files. Replace each with nearest `var(--tf-shadow-*)`.

### 1.5 — Border-Radius Standardization

**Files**: All CSS files with `border-radius`

Replace 25 unique values with 5 tokens:

- `--tf-radius-xs`: 4px (small buttons, badges)
- `--tf-radius-sm`: 8px (cards, inputs)
- `--tf-radius-md`: 12px (panels, dialogs)
- `--tf-radius-lg`: 16px (large cards, modals)
- `--tf-radius-full`: 9999px (pills, avatars)

Kill all raw values: `2px`, `3px`, `6px`, `7px`, `10px`, `14px`, `30px`, `50%` → map to nearest token.

### 1.6 — Font-Size Token Enforcement

**Files**: `src/theme/chart-components.css`, `src/theme/overlays.css`, `src/theme/data.css`, `src/theme/mobile.css`

Replace 17 hard-coded pixel font sizes with `--tf-fs-*` clamp() tokens:

- `8px`, `9px`, `10px` → `var(--tf-fs-xs)` (clamp 10-12px)
- `11px`, `11.5px`, `12px`, `12.5px` → `var(--tf-fs-sm)` (clamp 11-13px)
- `13px`, `14px` → `var(--tf-fs-md)` (clamp 13-15px)
- `18px` → `var(--tf-fs-lg)` (clamp 16-20px)
- `42px`, `48px` → `var(--tf-fs-3xl)` (clamp hero sizes)

### 1.7 — Animation Consolidation (46 → 20 keyframes)

**Files**: `src/theme/animations.css`, `src/theme/strategy.css`, `src/styles/animations.css`

Keep (essential):

- `fadeIn`, `fadeOut`, `fadeInUp`, `fadeInDown`
- `slideInLeft`, `slideInRight`, `slideOutLeft`, `slideOutRight`
- `scaleIn`, `scaleOut`, `popIn`
- `shimmer`, `pulse`, `spin`
- `tf-toast-in` (toast-specific)
- `tickFlashUp`, `tickFlashDown` (price ticks)
- `barCascade` (chart entrance)

Remove (redundant or unused):

- `tfSlideRight` (duplicate of slideInRight)
- `tfPageIn` (duplicate of fadeInUp)
- `tfModalIn` (use scaleIn instead)
- `tfSlideUp` (use fadeInUp)
- `tfSectionIn`, `tfDividerIn`, `tfMetricTipIn`, `tfTrendIn` (micro-animations with no perceived UX benefit)
- `tfDropdownIn`, `tfTooltipIn` (use fadeIn)
- `tfStatFlash` (use tickFlashUp)
- `easeOutBack`, `easeOutBounce` easings (jarring)

Standardize durations:

- `--motion-fast`: 120ms (tooltips, micro-interactions)
- `--motion-base`: 200ms (transitions, panels)
- `--motion-slow`: 350ms (modals, page transitions)
- Kill all hard-coded: `0.08s`, `0.12s`, `0.15s`, `0.22s`, `0.25s` → use tokens

### 1.8 — Transition Hard-Code Cleanup

**Files**: `src/theme/chart-components.css`, `src/theme/overlays.css`, `src/theme/utilities.css`

Replace all hard-coded transitions:

```css
/* Before */
transition: background 0.15s ease;
/* After */
transition: background var(--motion-fast) var(--ease-out);
```

**Estimated effort**: 8 days

---

## Phase 2: Progressive Disclosure (Weeks 3-5)

**Goal**: Hide complexity. Surface on demand. Never overwhelm.

### 2.1 — Markets: Reduce Default Columns

**File**: `src/state/useMarketsPrefsStore.ts` (line ~34)

**Current default**: `['symbol', 'sparkline', 'price', 'change', 'volume', 'pnl']` (6 columns)
**New default**: `['symbol', 'price', 'change', 'volume']` (4 columns)

Move sparkline + pnl to detail panel. Optional columns still available via column customizer.

### 2.2 — Markets: Increase Row Height

**File**: `src/app/components/markets/MarketsWatchlistGrid.jsx` (line ~357)

**Current**: 48px row height
**New**: 56px row height

### 2.3 — Markets: Simplify Symbol Cell

**File**: `src/app/components/markets/MarketsWatchlistGrid.jsx` (lines ~595-658)

**Current per cell**: color dot + symbol + alert bell + earnings badge + asset class badge + company name (6 elements)
**New per cell**: symbol + company name (2 elements). Move badges to detail panel.

### 2.4 — Markets: Enforce Max 2 Panels

**File**: `src/pages/MarketsPage.jsx`

Currently 6 overlays can open simultaneously (Detail, Compare, Alert, Folder, Screener, Analytics).
Add panel coordination:

```js
// In useUIStore or MarketsPage
const openPanel = (panel) => {
  if (openPanels.length >= 2) closeOldest();
  setOpenPanels((prev) => [...prev, panel]);
};
```

### 2.5 — Markets: Always-Visible Remove Button

**File**: `src/app/components/markets/MarketsWatchlistGrid.jsx` (lines ~904-930)

**Current**: Remove (×) only visible on hover
**New**: Always visible at opacity 0.3, brightens to 1.0 on hover

### 2.6 — Charts: Restructure "More" Menu (50 → 12 items)

**File**: `src/app/components/chart/toolbar/ToolbarMoreMenu.jsx`

**Current**: 50+ items across 7 sections
**New structure** (12 core items):

```
TRADING
  Position Sizer
  Quick Journal

ANALYSIS
  AI Copilot
  Strategy Tester
  AI Chart Analysis

TOOLS
  Object Tree
  Bar Replay
  Annotations

VIEW
  Compare Symbols
  Chart Settings
  Keyboard Shortcuts (?)

[Overlays →]  (submenu with search)
[Panels →]    (submenu with search)
```

Move overlays (11 items) → dedicated "Overlays" submenu with search
Move panels (8 items) → dedicated "Panels" submenu with search
Move layout modes → keyboard shortcuts only (1-6 keys) + workspace presets

### 2.7 — Charts: Move Position Sizer from Toolbar

**File**: `src/app/components/chart/UnifiedChartToolbar.jsx`

**Current**: 5 interactive elements (mode toggle, input, 2 steppers, label) taking 180px of toolbar
**New**: Compact pill showing current size (e.g. "0.05 BTC"). Click opens popover with full sizer.

### 2.8 — Charts: Merge ObjectTree into SlidePanel

**Files**: `src/app/components/panels/ObjectTreePanel.jsx`, `src/pages/charts/ChartPanelManager.jsx`

**Current**: ObjectTree is a separate sidebar that co-exists with SlidePanel (2 side panels)
**New**: ObjectTree becomes a tab within SlidePanel. Only 1 side panel ever.

### 2.9 — Charts: Simplify Replay Bar

**File**: `src/app/components/chart/panels/ReplayBar.jsx`

**Current**: 18 UI elements in one row (playback + speed + progress + ghost trades + stats + exit)
**New**: 2 rows:

- Row 1: Playback controls (back/play/forward) + progress slider + speed selector + exit
- Row 2: Ghost trade controls + backtest stats (collapsible)

### 2.10 — Charts: Drawing Context Menu (15 → 8)

**File**: `src/app/components/chart/DrawingContextMenu.jsx`

**Keep**: Edit, Duplicate, Lock/Unlock, Hide/Show, divider, Delete
**Remove**: Bring to Front, Send to Back, Group, Ungroup, Select All, Sync Across Timeframes
**Move**: Layer operations → Object Tree panel. Sync → Drawing Settings dialog.

### 2.11 — Charts: Indicator Default View (82 → 15 default)

**File**: Indicator registry/panel component

**Default visible** (Top 15):
SMA, EMA, RSI, MACD, Bollinger Bands, Stochastic, ATR, VWAP, OBV, Volume,
ADX, Ichimoku, CCI, Williams %R, DMI

Categorize: Trend | Momentum | Volatility | Volume
"Browse All (82)" button with search opens full list

### 2.12 — Home: Heatmap Default 12 Weeks

**File**: `src/app/components/widgets/TradeHeatmap.jsx`

**Current**: Full 52-week calendar
**New**: Last 12 weeks by default. "View Full Year" button expands.

### 2.13 — Settings: Notification Presets

**File**: `src/app/components/settings/NotificationsSection.jsx`

**Current**: 8+ categories with per-category toggles, channels, frequencies
**New**: 3 presets at top:

- **All**: Everything enabled
- **Important Only**: Alerts + errors only, no achievement/gamification toasts
- **Silent**: Everything off except critical errors

Per-category controls still available below presets for power users.

### 2.14 — Settings: Simplify Appearance

**File**: `src/app/components/settings/AppearanceSection.jsx`

- Reduce themes: Dark, Light, Auto (remove "Deep Sea" from default, move to Feature Lab)
- Keep accent color picker but reduce presets from 12+ to 6
- Remove separate font-size selector (use density setting instead)

### 2.15 — Import: Simplify Reconciliation UI

**File**: `src/app/components/dialogs/CSVImportModal.jsx`

**Current**: Expandable panel with error codes like `MISSING_SYMBOL_ROW_5`
**New**: Single-line summary: "Quality: 88% complete · 3 minor issues"

- Click "3 issues" to expand detail (keeps progressive disclosure)
- Replace error codes with plain English: "Row 5: missing symbol"
- Remove 4 "connection status" cards (always green, add no value)

**Estimated effort**: 12 days

---

## Phase 3: Discoverability & Safety (Weeks 5-7)

**Goal**: Hidden features are findable. Actions are reversible. Nothing gets lost.

### 3.1 — Command Palette: Single Mode

**File**: `src/hooks/useCommandPalette.ts`

**Current**: Two modes (Commands + Logbook) with `@sym` and `>cmd` prefix syntax
**New**: Single unified search. Auto-detect intent:

- Starts with ticker pattern (1-5 uppercase chars) → symbol results
- Matches command name → command results
- Otherwise → fuzzy search across both

Remove mode toggle pills. Remove prefix documentation. Just type.

### 3.2 — Sidebar: Pick One Width

**File**: `src/app/layouts/Sidebar.jsx`

**Current**: 60px collapsed → 220px on hover (200ms transition, hover dance)
**Options** (pick one):

**Option A — Always Expanded (Recommended for desktop)**:

- Fixed 200px sidebar with labels always visible
- Collapses to icon-only (60px) on Charts page for immersion
- No hover dance, no transition

**Option B — Always Collapsed**:

- Fixed 60px icon-only sidebar
- Tooltips on hover for labels
- Simplest option, most screen space

### 3.3 — Trade Form: Date Default to "Now"

**File**: `src/app/components/dialogs/TradeFormModal.jsx`

- Default date field to `new Date()` (current time)
- Add relative time shortcuts below date input: "Now", "-5m", "-1h", "Yesterday"
- Remove need to manually set time for most trades

### 3.4 — Trade Form: Group Expanded Fields by Category

**File**: `src/app/components/dialogs/trade-form/TradeDetailFields.jsx`

**Current**: All 9 optional fields in flat list
**New**: 3 collapsible groups:

```
▸ Execution (4 fields)
  Qty, Entry, Exit, Stop Loss

▸ Mindset (2 fields)
  Emotion picker, Playbook/Strategy

▸ Metadata (3 fields)
  Tags, Notes, Screenshots
```

### 3.5 — Post-Trade Review: Optional Sidebar

**File**: `src/app/components/dialogs/PostTradeReviewModal.jsx`

**Current**: Auto-opens full modal after every trade submission
**New**: After trade submission:

1. Toast: "Trade logged! Review it?" with "Review" action button
2. If clicked: Opens review as inline card below the trade in logbook (not modal)
3. If ignored: No interruption

Remove the mandatory modal chain entirely.

### 3.6 — Global Trade Form Shortcut

**File**: `src/App.jsx` (hotkey registration)

Add `Ctrl+N` (or `N` when not in input) to open TradeFormModal from any page.
Currently only accessible via header button or chart B/S keys.

### 3.7 — Watchlist Tab Reorder

**File**: `src/app/components/markets/MarketsWatchlistTabs.jsx`

Add drag-to-reorder for watchlist tabs. The `useDragReorder` hook already exists in
`src/hooks/useDragReorder.ts` — wire it up.

### 3.8 — Unified Empty State Component

**Files**: 15+ empty state variants across codebase

**Current**: `DashboardEmptyState`, `JournalEmptyState`, `InsightsEmptyState`,
`ChartsEmptyState`, `NotesEmptyState`, `EquityCurveEmptyState`, `HeatmapEmptyState`,
`CalendarEmptyState`, `StreakEmptyState`, `WatchlistEmptyState`, `AlertsEmptyState`,
`PropFirmEmptyState`, `ScreenerEmptyState`, `PlaybooksEmptyState` + more

**New**: Single `<EmptyState>` component in `src/app/components/design/EmptyState.jsx`:

```jsx
<EmptyState
  icon="📊"
  title="No trades yet"
  message="Log your first trade to see analytics"
  action={{ label: 'Add Trade', onClick: openTradeForm }}
  secondaryAction={{ label: 'Import CSV', onClick: openImport }}
/>
```

Replace all 15+ variants with this single component.

### 3.9 — Error States: Specific Messages

**File**: Error boundary components

**Current**: "Something went wrong."
**New**: Context-specific messages:

- Chart fails: "Chart couldn't load. Check your connection and try again."
- Trade save fails: "Trade couldn't be saved. Your data is safe — try again."
- Import fails: "Import failed on row 12. Fix and re-upload."
- Widget fails: "This widget encountered an error. [Retry] [Hide]"

### 3.10 — Auth: Account Safety Improvements

**Files**: `src/app/components/ui/AccountSwitcher.jsx`, `src/app/components/settings/TwoFactorSection.jsx`,
`src/app/components/settings/DangerZoneSection.jsx`

1. **Account switch confirmation**: "Switch to Demo account?" dialog before toggle
2. **Show account badge in trade entry**: Display "REAL" or "DEMO" badge in TradeFormModal header
3. **2FA disable requires password**: Add password prompt before allowing 2FA toggle off
4. **Backup codes mandatory**: Block 2FA enable until codes are downloaded
5. **Reset Preferences confirmation**: Add "Are you sure?" dialog
6. **Account deletion grace period**: 30-day soft delete before permanent wipe

### 3.11 — Mobile: Dedicated Markets View

**File**: New component `src/app/components/mobile/MobileMarkets.jsx`

**Current**: Markets page uses CSS media queries only (cramped table on mobile)
**New**: Card-based mobile view (like Apple Stocks):

- Each symbol = full-width card with price + change + mini sparkline
- Tap card → detail bottom sheet
- Swipe left → remove from watchlist

### 3.12 — Mobile: Pull-to-Refresh

**Files**: `src/app/components/mobile/MobileJournal.jsx`, new `MobileMarkets.jsx`

CSS spinner exists in `mobile.css` (`@keyframes pullSpin`) but isn't wired up.
Implement native pull-to-refresh on journal and markets pages.

### 3.13 — Mobile: Smooth Accordion Animations

**File**: `src/app/components/mobile/MobileSettings.jsx`, `MobileAnalytics.jsx`

**Current**: Section toggles are instant (no height animation)
**New**: Animate height with CSS `max-height` transition or Framer Motion `AnimatePresence`

**Estimated effort**: 12 days

---

## Phase 4: Reduce Noise (Weeks 7-9)

**Goal**: One notification at a time. Earn every interruption.

### 4.1 — Notification Priority System

**File**: `src/state/useNotificationStore.ts`, `src/app/components/ui/ToastContainer.jsx`

Implement global notification budget:

```
Priority: Modal > Toast > Badge
Rule: Only 1 modal OR 2 toasts visible at any time
Queue: Lower-priority notifications wait until current clears
```

When LevelUpModal fires + toast fires simultaneously:

- Modal takes screen → toast queues → shows after modal dismisses

### 4.2 — Gamification: Replace Modals with Subtle Feedback

**Files**: `src/app/components/ui/LevelUpModal.jsx`, `src/app/components/ui/MilestoneModal.jsx`

**LevelUpModal** (full-screen, 40 confetti particles, 5s duration):
→ Replace with: Sidebar XP badge glows gold for 3 seconds + single toast "Level 3 reached! 🎯"

**MilestoneModal** (full-screen, 30 confetti particles):
→ Replace with: Achievement toast with rarity-colored border

Delete confetti particle system entirely. Remove `LevelUpModal.jsx` and `MilestoneModal.jsx`.

### 4.3 — Achievement Toast Batching

**File**: Achievement notification logic in `useGamificationStore.ts`

**Current**: Up to 8 achievement toasts staggered 800ms apart
**New**: If 3+ achievements earned simultaneously, batch into single toast:
"3 achievements unlocked! View in Settings"

Max 2 simultaneous toasts at any time.

### 4.4 — Sidebar Badge: Remove Pulse Animation

**File**: Sidebar XP badge component

**Current**: `animation: 'tf-pulse 2s ease-in-out infinite'` on streak flame
**New**: Static 🔥 emoji. No animation. Badge updates number silently.

### 4.5 — Remove Cosmetic Theme Rewards

**File**: `src/state/useGamificationStore.ts` (cosmetic slice)

Remove the 6 XP-gated accent themes (Deep Ocean, Amethyst, Emerald, Crimson Fire, Aurora).
Keep accent color picker in Settings → Appearance as a free feature for all users.

### 4.6 — Consolidate Button Systems

**Files**: `src/app/components/design/Button.jsx`, `src/app/components/ui/UIKit.jsx`

**Current**: Two parallel systems (design/Button with 5 variants + UIKit Btn with 3 variants)
**New**: Single `Button` component in `design/`. Migrate all `<Btn>` usage to `<Button>`.

Remove `Btn` export from UIKit.jsx. Update all imports.

### 4.7 — Consolidate Badge Components

**Files**: `src/app/components/design/Badge.jsx`, `src/app/components/ui/DataSourceBadge.jsx`,
`src/app/components/chart/ui/DataSourceBadge.jsx`

**Current**: 2 DataSourceBadge implementations + generic Badge + 5 one-off badge wrappers
**New**: Single `Badge` component with presets:

```jsx
<Badge variant="live" />     // green pulse
<Badge variant="delayed" />  // yellow
<Badge variant="cached" />   // grey
<Badge variant="demo" />     // blue
```

Delete duplicate `chart/ui/DataSourceBadge.jsx`. Migrate `ui/DataSourceBadge.jsx` to use `design/Badge`.

### 4.8 — Create StatCard Abstraction

**File**: New `src/app/components/design/StatCard.jsx`

**Current**: 15+ card components all redefine identical inline styles:

```js
const CARD_STYLE = { background: 'rgba(20,20,30,0.6)', backdropFilter: 'blur(16px)...', ... };
const LABEL_STYLE = { fontSize: 11, fontWeight: 600, ... };
const VALUE_STYLE = { fontSize: 28, fontWeight: 700, ... };
```

**New**: Single `StatCard` component:

```jsx
<StatCard
  label="Expectancy"
  value={expectancy.value}
  format="R" // "R" | "$" | "%" | "ratio"
  trend="up" // colors value green
  subtext={`${sampleSize} trades`}
  warning={isNegative ? 'Negative expectancy' : null}
/>
```

Migrate: `ExpectancyCard`, `TruePnLCard`, `AIInsightCard`, `ModelBenchmarkCard`,
and all other inline-style stat cards.

### 4.9 — AI: Consolidate Copilot Panels

**Files**: `src/app/components/ai/CopilotPanel.jsx`, `CopilotChatPanel.jsx`, `CopilotChatInline.jsx`

**Current**: 3 separate implementations of the same chat interface
**New**: Single `CopilotPanel` with layout prop:

```jsx
<CopilotPanel layout="sidebar" />   // right panel on desktop
<CopilotPanel layout="sheet" />     // bottom sheet on mobile
<CopilotPanel layout="inline" />    // embedded in slide panel
```

Delete `CopilotChatPanel.jsx` and `CopilotChatInline.jsx`.

### 4.10 — AI: Remove Proactive Insights & Morning Brief Auto-Inject

**Files**: `src/ai/ProactiveInsightManager.ts`, `src/ai/AIBriefService.ts`

**Proactive Insights**: Fires on volume anomalies, regime shifts, patterns
→ Remove auto-fire. User can ask "What's happening?" in Copilot chat.

**Morning Brief**: Auto-injects message on first Copilot open
→ Remove auto-inject. Add "Morning Brief" as a preset chip in empty Copilot state.

### 4.11 — Loading Narratives: Simplify

**File**: `src/styles/ChartLoadingNarrative.module.css` and related component

**Current**: 4-step narrative (Connecting → History → Rendering → Ready) with 600ms delays
**New**: If load < 500ms, show nothing (instant). If load > 500ms, show single "Loading..." with spinner.
Remove multi-step narrative. Users don't need to know internal pipeline stages.

### 4.12 — Sidebar Transition Speed

**File**: `src/app/layouts/Sidebar.jsx`

**Current**: 300ms width transition
**New**: 150ms (or instant on Charts page via `transition: none`)

**Estimated effort**: 10 days

---

## Phase 5: Structural Refactor (Weeks 9-13)

**Goal**: Split god components. Consolidate duplicates. Fix performance.

### 5.1 — Split God Components

**ChartEngineWidget** (1,080 LOC → ~400 LOC):
**File**: `src/app/components/chart/core/ChartEngineWidget.jsx`

- Extract: `ChartOverlayLayer.jsx` (trade markers, levels, positions, alerts, zoom loupe)
- Extract: `ChartPanelSlots.jsx` (analysis, indicator settings, drawing editor)
- Extract: `ChartGestureLayer.jsx` (longpress crosshair, mobile drawing)
- Keep: Core engine mounting, history prefetch, crosshair sync

**MarketsWatchlistGrid** (935 LOC → ~500 LOC):
**File**: `src/app/components/markets/MarketsWatchlistGrid.jsx`

- Extract: `WatchlistFilters.jsx` (filter chips, group by, sort)
- Extract: `WatchlistColumnConfig.jsx` (column customizer, column rendering)
- Keep: Virtual table, row rendering, row interactions

**SpotlightLogbook** (918 LOC → ~500 LOC):
**File**: `src/app/components/ui/SpotlightLogbook.jsx`

- Extract: `LogbookFilters.jsx` (search, filter dimensions, sort)
- Extract: `LogbookBulkActions.jsx` (select, bulk edit, bulk delete)
- Extract: `LogbookRowDetail.jsx` (expanded row content)
- Keep: Virtual list, row rendering

**DrawingSettingsDialog** (929 LOC → ~400 LOC):
**File**: `src/app/components/chart/panels/DrawingSettingsDialog.jsx`

- Extract: Per-tool settings sub-components (line settings, shape settings, text settings, etc.)
- Keep: Dialog shell, tab navigation, tool-type dispatcher

### 5.2 — Migrate Inline Styles to CSS Modules

**Scope**: ~40% of components using inline style objects

Priority targets (highest duplication):

1. Dashboard stat cards → use new `StatCard` component (Phase 4.8)
2. Settings sections → create `Settings.module.css` with shared group/toggle/pill styles
3. Chart overlays → create `ChartOverlay.module.css`

### 5.3 — State: Add Selector Helpers

**Files**: Top 10 Zustand stores

**Problem**: Most stores lack granular selectors. Components subscribe to entire store objects.

Add selector helpers:

```ts
// useAlertStore.ts
export const selectAlertsBySymbol = (symbol: string) =>
  useAlertStore((s) => s.alerts.filter((a) => a.symbol === symbol));

export const selectActiveAlertCount = () => useAlertStore((s) => s.alerts.filter((a) => a.enabled).length);
```

Priority stores:

- `useAlertStore` (716 LOC, used by 8+ components)
- `useNotificationStore` (465 LOC, 14 subscriptions in NotificationPanel)
- `useJournalStore` (231 LOC, used everywhere)
- `useChartCoreStore` (used by 10+ chart components)
- `useWatchlistStore` (546 LOC)

### 5.4 — State: Split Gamification Store

**File**: `src/state/useGamificationStore.ts` (413 LOC, composes 6 slices)

**Current**: XP + achievements + challenges + quests + cosmetics + tournaments in one store
**New**: 3 focused stores:

- `useXPStore` — XP, levels, ranks, streaks (core)
- `useAchievementStore` — achievements, milestones, quests
- `useChallengeStore` — daily/weekly challenges, goals

### 5.5 — State: Consolidate Symbol Tracking

**Current**: Symbol tracked in 4 stores (PriceTracker, ChartLinkStore, AlertStore, CoreSlice)
**New**: Single `useMarketDataStore` namespace:

```ts
useMarketDataStore.getState().getSymbolData('BTCUSDT');
// Returns: { price, change, high52w, low52w, alerts, chartLink }
```

### 5.6 — State: Move useCopilotChat to State Directory

**File**: `src/hooks/useCopilotChat.ts` (676 LOC)
**Move to**: `src/state/useCopilotStore.ts`

It's a Zustand store, not a hook. Rename and relocate.

### 5.7 — Hooks: Merge Duplicate Position Hooks

**Files**: `src/hooks/useOpenPositions.js` + `src/hooks/useAllOpenPositions.js`

Merge into single hook:

```js
export function useOpenPositions(symbol?: string) {
  // If symbol provided, filter. Otherwise return all.
}
```

Delete `useAllOpenPositions.js`.

### 5.8 — Data: Delete Deprecated DataCache

**File**: `src/data/DataCache.ts` (643 LOC)

Fully deprecated, proxied by CacheManager. Find all imports → point to CacheManager → delete.

### 5.9 — Data: Consolidate Adapters (35 → 12)

**File**: `src/data/adapters/`

Create parameterized generic adapters:

- `CryptoExchangeAdapter` (config: { name, wsUrl, restUrl, parseBar, parseTrade })
  → Replaces: Binance, Kraken, OKX, Bybit, Coinbase (5 → 1)
- `EquitiesAdapter` (config: { name, apiKey, baseUrl, ... })
  → Replaces: Alpaca, Polygon, FMP, Tiingo, Yahoo (5 → 1)
- Keep specialized: `PythAdapter`, `EdgarAdapter`, `SentimentAdapter`, `DexScreenerAdapter`

### 5.10 — Data: Background IDB Cleanup

**File**: `src/data/engine/infra/CacheManager.js`

Add periodic cleanup:

```js
setInterval(
  () => {
    cacheManager.evictExpired(); // Delete records where (now - timestamp) > ttl
  },
  5 * 60 * 1000,
); // Every 5 minutes
```

### 5.11 — Data: OrderFlow Worker Offload

**File**: `src/data/engine/orderflow/OrderFlowEngine.ts` (1,034 LOC)

Move cluster detection + volume profile rebuild to dedicated Web Worker.
Keep tick ingestion synchronous on main thread for latency.

### 5.12 — Performance: Add useShallow to Heavy Subscribers

**Files**: Components with 8+ store subscriptions

Target components:

- `NotificationPanel` (14 subscriptions) — add `useShallow` to each store selector
- `ChartEngineWidget` (10 subscriptions)
- `AlertPanel` (8 subscriptions)
- `UnifiedChartToolbar` (8 subscriptions)

### 5.13 — Hooks: Add useErrorBoundary

**File**: New `src/hooks/useErrorBoundary.ts`

```ts
export function useErrorBoundary() {
  const [error, setError] = useState<Error | null>(null);
  const reset = () => setError(null);
  return { error, setError, reset, ErrorFallback };
}
```

Wrap critical widgets (EquityCurveChart, TradeHeatmap, MonteCarloWidget) with error boundaries
that show "Widget error. [Retry]" instead of crashing the page.

**Estimated effort**: 18 days

---

## Phase 6: Mobile Polish (Weeks 11-13, parallel with Phase 5)

**Goal**: 7.5/10 → 9/10 native feel.

### 6.1 — Dedicated Mobile Markets View

See Phase 3.11 above.

### 6.2 — Pull-to-Refresh

See Phase 3.12 above.

### 6.3 — Smooth Accordion Animations

See Phase 3.13 above.

### 6.4 — Keyboard Viewport Adjustment

**File**: `src/theme/mobile.css`

Add keyboard show/hide detection:

```js
const vh = window.visualViewport?.height ?? window.innerHeight;
document.documentElement.style.setProperty('--vh', `${vh * 0.01}px`);
window.visualViewport?.addEventListener('resize', updateVh);
```

Prevents input fields from being hidden behind mobile keyboard.

### 6.5 — Haptic Feedback Expansion

**File**: Mobile interaction handlers

Currently only on swipe-complete and drawing tool.
Add to: tab switches, account toggle, trade submission, toast appearance.
Use `navigator.vibrate(10)` for light, `(25)` for medium.

### 6.6 — Gesture Discovery Improvement

**File**: `src/app/components/ui/GestureGuide.jsx`

Add subtle persistent edge indicators (thin gradient bars) on chart edges
to hint at edge-swipe symbol navigation. Current: 3px bars that disappear.
New: 5px gradient with symbol name peek on slow drag approach.

**Estimated effort**: 5 days (parallel with Phase 5)

---

## Timeline Summary

| Phase       | Focus                    | Duration         | Dependencies                      |
| ----------- | ------------------------ | ---------------- | --------------------------------- |
| **Phase 0** | Zen Mode Default         | Week 1 (5d)      | None                              |
| **Phase 1** | Design System            | Weeks 2-3 (8d)   | None                              |
| **Phase 2** | Progressive Disclosure   | Weeks 3-5 (12d)  | Phase 1 (tokens)                  |
| **Phase 3** | Discoverability & Safety | Weeks 5-7 (12d)  | Phase 0 (dashboard tiers)         |
| **Phase 4** | Reduce Noise             | Weeks 7-9 (10d)  | Phase 1 (tokens), Phase 2 (menus) |
| **Phase 5** | Structural Refactor      | Weeks 9-13 (18d) | Phase 4 (consolidated components) |
| **Phase 6** | Mobile Polish            | Weeks 11-13 (5d) | Phase 3 (mobile markets)          |

**Total**: ~70 working days (~14 weeks / 3.5 months)

**If time-constrained, priority order**:

1. Phase 0 (Zen Mode) — Biggest UX impact, lowest risk, 1 week
2. Phase 2 (Progressive Disclosure) — Hides complexity, transforms experience
3. Phase 4 (Reduce Noise) — Calms the interface
4. Phase 1 (Design System) — Foundation for consistency
5. Phase 3 (Discoverability) — Safety and findability
6. Phase 5 + 6 (Refactor + Mobile) — Long-term maintainability

---

## Success Metrics

After implementation, measure:

| Metric                                  | Before      | Target |
| --------------------------------------- | ----------- | ------ |
| Visible UI elements on fresh dashboard  | 40-60       | 12-15  |
| Visible columns in Markets (default)    | 6           | 4      |
| Items in Charts "More" menu             | 50+         | 12     |
| Drawing context menu items              | 15          | 8      |
| Default visible indicators              | 82          | 15     |
| Full-screen interruption modals         | 2-3/session | 0      |
| Simultaneous toasts max                 | 8           | 2      |
| Design token systems                    | 2           | 1      |
| Unique colors in CSS                    | 147         | 30     |
| Unique border-radius values             | 25          | 5      |
| Unique shadow definitions               | 31          | 5      |
| Animation keyframes                     | 46          | 20     |
| Empty state component variants          | 15+         | 1      |
| Button component systems                | 2           | 1      |
| God components (900+ LOC)               | 5           | 0      |
| Store subscriptions (max per component) | 14          | 5      |
| Time to first meaningful dashboard      | ~3s         | ~1s    |
| Mobile native feel score                | 7.5/10      | 9/10   |

---

## The North Star

> Show 20% by default. Let the other 80% be discoverable.
> Every screen answers one question clearly.
> Every action has one obvious path.
> Every notification earns its interruption.
> The app grows with the trader, not against them.

The goal is not to build a simpler app. It's to build a powerful app that _feels_ simple.
