---
description: Design Foundation — new Forge brand palette, Inter font, typography scale, spacing tokens, gradients, and UIKit updates
---

# Agent 1: Design Foundation & Brand System

// turbo-all

## Overview
Implement Sprint 1 of the Design Overhaul from `DESIGN_OVERHAUL_SPRINTS.md`. This establishes the new "Forge" brand identity — ember orange accent, Inter font, expanded typography, and updated UIKit components.

## File Boundaries (ONLY modify these files)
- `src/constants.js` — color tokens, `GLASS`, `DEPTH`
- `src/theme/tokens.js` — typography presets, spacing scale, gradients
- `src/theme/global.css` — CSS custom properties, font imports
- `src/theme/components.css` — hover/active/focus CSS rules
- `index.html` — Google Fonts `<link>` tag
- `src/app/components/ui/UIKit.jsx` — Card, Btn, StatCard, Badge updates
- `src/app/components/ui/Toast.jsx` — toast redesign (accent border, slide-in)

**DO NOT modify any files outside this list.**

## Steps

### 1. Read the sprint doc for full context
```
Read DESIGN_OVERHAUL_SPRINTS.md — focus on Sprint 1 tasks 1.1 through 1.7
```

### 2. Update color tokens in constants.js
The palette is ALREADY partially migrated (ember orange `#e8642c` is already the accent `b` key). Verify and ensure all tokens match the Sprint 1 spec:
- `DARK_COLORS` and `LIGHT_COLORS` objects
- `GLASS` object border colors reference brand accent
- No hardcoded blue (`#3b82f6`) remaining anywhere

### 3. Update typography in constants.js + tokens.js
- Font `F` is already Inter — verify it's correct
- Add `data-hero`, `data-lg`, `data-md`, `data-sm` typography presets to tokens.js
- Add spacing tokens `space[7]: 28` and `space[9]: 36`
- Update `layout.page` padding to 32, `layout.pageMobile` to 16

### 4. Update Google Fonts in index.html
- Ensure Inter is loaded (weights 400, 500, 600, 700)
- Keep JetBrains Mono for monospace

### 5. Add brand gradient tokens to tokens.js
```
gradient.brand: linear-gradient(135deg, #e8642c, #f0b64e)
gradient.glow: radial-gradient(ellipse, #e8642c15, transparent)
gradient.subtle: linear-gradient(135deg, #e8642c08, transparent)
```

### 6. Add light-theme shadow helpers to tokens.js
- `shadows.light` variants with opacity `0.04–0.12`
- `shadow()` helper that returns right shadow per theme

### 7. Create CSS transition layer in components.css
- `:hover`, `:active`, `:focus-visible` rules for buttons, cards, inputs
- Replace inline `onMouseEnter/Leave` patterns in UIKit components
- Transition tokens: `micro: 0.08s ease`, `enter: 0.2s cubic-bezier(0.16, 1, 0.3, 1)`, `exit: 0.15s ease-in`

### 8. Update UIKit components
- `Card`, `Btn`, `StatCard`, `Badge` — reference token values, not hardcoded colors
- Remove inline hover handlers where CSS classes now handle it

### 9. Verify
```
npx vitest run
```

Run the full test suite. Fix any failing tests. The app should render with the updated palette and fonts with no visual regressions.
