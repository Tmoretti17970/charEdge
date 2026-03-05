# Store Consolidation Blueprint

## Current State
31 independent Zustand stores in `src/state/`. Each is a standalone file with its own state, actions, and subscriptions.

## Target State
~10 domain stores using the Zustand **slice pattern**, where each domain store composes multiple slices.

## Consolidation Map

### 1. `useChartDomainStore` (4 stores → 1)
| Current | Slice |
|---------|-------|
| `useChartStore` | `chartSlice` — symbols, timeframes, chart type |
| `useAnnotationStore` | `annotationSlice` — drawings, labels |
| `usePanelStore` | `panelSlice` — visible panels, sizes |
| `useFocusStore` | `focusSlice` — focused element, crosshair mode |

### 2. `useTradingDomainStore` (4 stores → 1)
| Current | Slice |
|---------|-------|
| `usePaperTradeStore` | `paperTradeSlice` — simulated positions |
| `useBacktestStore` | `backtestSlice` — backtest config, results |
| `useSignalStore` | `signalSlice` — signals, alerts |
| `useAlertStore` | `alertSlice` — price/indicator alerts |

### 3. `useJournalDomainStore` (4 stores → 1)
| Current | Slice |
|---------|-------|
| `useJournalStore` | `journalSlice` — entries, filters |
| `useChecklistStore` | `checklistSlice` — pre-trade checks |
| `useTemplateStore` | `templateSlice` — journal templates |
| `useTradeTemplateStore` | `tradeTemplateSlice` — trade entry templates |

### 4. `useUserDomainStore` (3 stores → 1)
| Current | Slice |
|---------|-------|
| `useUserStore` | `userSlice` — auth, profile, preferences |
| `useSubscriptionStore` | `subscriptionSlice` — plan, billing |
| `useConsentStore` | `consentSlice` — cookie/privacy consent |

### 5. `useUIDomainStore` (3 stores → 1)
| Current | Slice |
|---------|-------|
| `useUIStore` | `uiSlice` — theme, modals, sidebar |
| `useLayoutStore` | `layoutSlice` — dashboard grid config |
| `useWorkspaceStore` | `workspaceSlice` — saved workspace presets |

### 6. `useAIDomainStore` (3 stores → 1)
| Current | Slice |
|---------|-------|
| `useAICoachStore` | `coachSlice` — AI conversations |
| `useScriptStore` | `scriptSlice` — Pine-like scripts |
| `useStrategyBuilderStore` | `strategySlice` — strategy config |

### 7. `useDataDomainStore` (3 stores → 1)
| Current | Slice |
|---------|-------|
| `useDataStore` | `dataSlice` — market data, connection status |
| `useWatchlistStore` | `watchlistSlice` — saved watchlists |
| `useSyncStore` | `syncSlice` — cross-tab sync state |

### 8. `useAnalyticsDomainStore` (2 stores → 1)
| Current | Slice |
|---------|-------|
| `useAnalyticsStore` | `analyticsSlice` — performance metrics |
| `useGamificationStore` | `gamificationSlice` — XP, levels, streaks |

### 9. `useNotificationStore` (kept standalone)
Already cohesive — handles toasts, push, and notification history.

### 10. Remaining (3 stores — keep or merge)
| Store | Decision |
|-------|----------|
| `useBriefingStore` | → merge into `useAIDomainStore` |
| `useDailyGuardStore` | → merge into `useTradingDomainStore` |
| `usePropFirmStore` | → merge into `useTradingDomainStore` |
| `useSocialStore` | → keep standalone (feature-flagged) |

## Migration Strategy
1. Create domain store with slices composing existing state shapes
2. Re-export individual hooks as thin wrappers: `useChartStore = () => useChartDomainStore(s => s.chart)`
3. Gradually migrate consumers to domain-level selectors
4. Delete wrapper hooks once all consumers migrated

## Benefits
- **Fewer subscriptions**: 31 → 10 store instances
- **Atomic updates**: related state changes in single `set()` call
- **DevTools clarity**: 10 named stores vs 31
- **`useShallow`**: apply once per domain store, not per micro-store
