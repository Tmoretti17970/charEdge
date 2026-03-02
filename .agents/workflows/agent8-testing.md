---
description: Bulk test coverage for recent features (psychology system, chart-journal link, gamification, observability)
---

# Agent 8 — Bulk Test Coverage

// turbo-all

## Steps

1. Run existing tests to establish baseline:
```bash
npx vitest run
```

2. Create new test files covering untested functions:

   **Psychology System** → `src/__tests__/psychology_ruleEngine.test.js`
   - Rule Engine CRUD: addRule, updateRule, removeRule, toggleRule, resetToDefaults
   - evaluate() with mixed enabled/disabled rules
   - `<=` and `>` operators
   - `navigateToTrade()` success/failure paths

   **Chart-Journal Link** → `src/__tests__/chartJournal_navigateToTrade.test.js`
   - navigateToTrade() option wiring (setSymbol, setTf, setPage)
   - navigateToTrade() event emission via setTimeout
   - useTradeNavigation factory: handleNavigate, clearHighlight

   **Gamification Edge Cases** → `src/__tests__/gamification_deep.test.js`
   - Quest completion flow → XP + completedQuests
   - Cosmetic equip with non-existent ID
   - Challenge completion awards XP
   - Weekly challenge expiry

   **Observability** → `src/__tests__/observability_deep.test.js`
   - CacheManager.write() + getLastUpdate() ageMs behavior
   - DataStalenessIndicator status thresholds in source
   - DataFallbackBanner dismiss + retry in source

3. Run all tests:
```bash
npx vitest run
```

4. Verify coverage thresholds still pass:
```bash
npx vitest run --coverage
```
