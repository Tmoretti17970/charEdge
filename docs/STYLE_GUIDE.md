# charEdge — Component Style Guide

**Version:** 1.0 (Sprint 21)
**Source of truth:** [`theme/tokens.css`](../src/theme/tokens.css) + [`theme/tokens.js`](../src/theme/tokens.js)

---

## Rules

1. **Every visual property must map to a token.** No hardcoded colors, sizes, radii, or shadows.
2. **CSS Modules + `var(--tf-*)` for new/migrated components.** Inline `style={{}}` is prohibited for static visual properties.
3. **Dynamic values only for JS-computed styles** (e.g., animation progress, data-driven colors via `data-*` attributes).
4. **One canonical prefix:** `--tf-*`. Legacy `--c-*` / `--fs-*` / `--br-*` aliases exist temporarily.
5. **All three themes must be verified** — Dark (`:root`), Light (`.theme-light`), Deep Sea (`.theme-deep-sea`).

---

## Color Tokens

| Token | Dark | Light | Deep Sea | Usage |
|---|---|---|---|---|
| `--tf-bg` | `#08090a` | `#f8f8fa` | `#000000` | Page background |
| `--tf-bg2` | `#0e1013` | `#eef0f4` | `#050505` | Recessed surfaces, inputs |
| `--tf-sf` | `#16181d` | `#ffffff` | `#0a0a08` | Card surface |
| `--tf-sf2` | `#1d2027` | `#f2f3f6` | `#121210` | Hover/active surface |
| `--tf-bd` | `#2a2e3a` | `#d4d7e0` | `#1a1a16` | Primary border |
| `--tf-bd2` | `#363b4a` | `#bec3d0` | `#28281e` | Secondary border |
| `--tf-t1` | `#ececef` | `#111318` | `#f0e8d8` | Primary text |
| `--tf-t2` | `#8b8fa2` | `#4a5068` | `#a09880` | Secondary text |
| `--tf-t3` | `#7b84ad` | `#5a6380` | `#7a745e` | Tertiary / disabled |
| `--tf-accent` | `#e8642c` | `#d4551e` | `#d4881e` | Brand primary |
| `--tf-green` | `#31d158` | `#059669` | `#3dc78a` | Profit / success |
| `--tf-red` | `#ff453a` | `#e11d48` | `#e85c5c` | Loss / error |
| `--tf-yellow` | `#f0b64e` | `#d4930b` | `#e8b830` | Warning |

---

## Card Depth Tiers

Apply `.tf-depth-{tier}` for consistent glassmorphism per Z-level.

| Tier | Class | When to Use | Glass | Blur | Shadow |
|---|---|---|---|---|---|
| **Surface** | `.tf-depth-surface` | Flat content inside cards | `--tf-glass-1` (65%) | 8px | none |
| **Raised** | `.tf-depth-raised` | Cards, stat tiles | `--tf-glass-2` (78%) | 16px | `--tf-shadow-1` |
| **Floating** | `.tf-depth-floating` | Panels, slide-overs, dropdowns | `--tf-glass-3` (88%) | 24px | `--tf-shadow-2` |
| **Overlay** | `.tf-depth-overlay` | Modals, dialogs, command palette | `--tf-glass-4` (95%) | 40px | `--tf-shadow-3` |

---

## Border Radius

| Token | Value | Usage |
|---|---|---|
| `--tf-radius-xs` | `4px` | Tags, badges, small buttons |
| `--tf-radius-sm` | `8px` | Inputs, small cards, toolbar buttons |
| `--tf-radius-md` | `16px` | Cards, panels |
| `--tf-radius-lg` | `16px` | Modals, drawers |
| `--tf-radius-xl` | `20px` | Hero cards, dialogs |
| `--tf-radius-full` | `9999px` | Pills, avatars |

---

## Shadow Levels

| Token | Usage |
|---|---|
| `--tf-shadow-0` | Flat — no elevation |
| `--tf-shadow-1` | Raised cards (subtle) |
| `--tf-shadow-2` | Floating panels, dropdowns |
| `--tf-shadow-3` | Modals, overlays |
| `--tf-shadow-4` | Maximum elevation — command palette |

---

## Spacing (4px base grid)

| Token | Value | Usage |
|---|---|---|
| `--tf-space-1` | 4px | Tight gaps (icon-to-text) |
| `--tf-space-2` | 8px | Compact gaps (button groups) |
| `--tf-space-3` | 12px | Default component gap |
| `--tf-space-4` | 16px | Card padding, mobile page padding |
| `--tf-space-5` | 20px | Standard card body |
| `--tf-space-6` | 24px | Section gap |
| `--tf-space-8` | 32px | Desktop page padding |
| `--tf-space-10` | 40px | Large section separator |

### Card Padding Presets

| Token | Value | Usage |
|---|---|---|
| `--tf-card-pad-compact` | `10px 14px` | Stat card (secondary tier) |
| `--tf-card-pad-standard` | `14px 16px` | Stat card (primary), info cards |
| `--tf-card-pad-hero` | `20px 22px` | Hero stat card |
| `--tf-card-pad-form` | `20px 24px` | Settings, forms |
| `--tf-card-pad-section` | `24px 28px` | Top-level settings sections |

---

## Typography Hierarchy

### Display / Data Numbers (JS: `text.dataHero`, `text.dataLg`, etc.)

| Preset | Size | Weight | Font | Use for |
|---|---|---|---|---|
| `dataHero` | 32px | 700 | Mono | Today's P&L (single dominant stat) |
| `dataLg` | 20px | 700 | Mono | Widget headline numbers |
| `dataMd` | 14px | 600 | Mono | Inline metric values |
| `dataSm` | 12px | 500 | Mono | Supporting data points |

### Text (JS: `text.h1`, `text.body`, etc.)

| Preset | Size | Weight | Use for |
|---|---|---|---|
| `h1` | 26px | 700 | Page titles |
| `h2` | 18px | 650 | Section titles |
| `h3` | 14px | 700 | Widget headers |
| `body` | 14px | 400 | Paragraph text |
| `bodySm` | 13px | 400 | Secondary text |
| `label` | 11px | 600 | Uppercase labels (with `letter-spacing: 0.05em`) |
| `caption` | 11px | 400 | Footnotes, timestamps |

### CSS Type Scale (responsive `clamp()`)

| Token | Range | Use for |
|---|---|---|
| `--tf-fs-xs` | 10–12px | Compact labels |
| `--tf-fs-sm` | 12–14px | Small body |
| `--tf-fs-base` | 13–16px | Default body |
| `--tf-fs-lg` | 16–20px | Section headers |
| `--tf-fs-xl` | 18–24px | Page titles |

---

## Transitions

| Token | Duration | Curve | Use for |
|---|---|---|---|
| `--tf-transition-micro` | 80ms | ease | Hover feedback |
| `--tf-transition-fast` | 100ms | ease | Quick state changes |
| `--tf-transition-base` | 150ms | ease | Default transitions |
| `--tf-transition-slow` | 250ms | ease | Theme toggle, page fade |
| `--tf-transition-enter` | 200ms | ease-out expo | Elements appearing |
| `--tf-transition-exit` | 150ms | ease-in | Elements disappearing |
| `--tf-transition-spring` | 300ms | spring | Playful bounce (active indicator) |

---

## Z-Index Scale

| Token | Value | Usage |
|---|---|---|
| `--tf-z-base` | 0 | Default stacking |
| `--tf-z-sticky` | 10 | Sticky headers |
| `--tf-z-dropdown` | 50 | Dropdown menus |
| `--tf-z-sidebar` | 100 | Sidebar |
| `--tf-z-overlay` | 200 | Panel overlays |
| `--tf-z-modal` | 400 | Modals, dialogs |
| `--tf-z-toast` | 400 | Toast notifications |
| `--tf-z-tooltip` | 500 | Tooltips |
| `--tf-z-popover` | 1000 | Popovers, command palette |
| `--tf-z-max` | 9999 | Absolute top (dev tools) |

---

## Glassmorphism Tiers

| Tier | Background | Blur | When to Use |
|---|---|---|---|
| Glass 1 | 65% opacity | 8px | Subtle tinting on content |
| Glass 2 | 78% opacity | 16px | Cards and panels |
| Glass 3 | 88% opacity | 24px | Floating panels and sheets |
| Glass 4 | 95% opacity | 40px | Modals and overlays |

**Border:** Use `--tf-glass-border` (6% white opacity), upgrading to `--tf-glass-border-hover` on hover (12%).

**Light mode:** Glass surfaces swap to white-based rgba. Borders swap to black-based.

**Deep Sea:** Glass surfaces use pure black rgba. Borders at 4% cream opacity for minimal visibility on OLED.

---

## Density Modes

Three density presets via `data-density` attribute on `<body>`:

| Density | Control Height | Base Font | Radius | Spacing |
|---|---|---|---|---|
| **Default** | 34px | 13px | 8px | Normal scale |
| **Comfortable** | 40px | 14px | 10px | Relaxed (+25%) |
| **Compact** | 28px | 12px | 6px | Tight (−25%) |
