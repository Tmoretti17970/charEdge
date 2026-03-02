// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — Rule Engine Store (Sprint 3: B.3)
//
// Configurable "if X then Y" trading rules. Evaluates after each
// trade is logged and fires alerts when conditions are met.
//
// Conditions are evaluated against a session context object:
//   { consecLosses, dailyPnl, sessionWinRate, tradeCount, totalLosses }
//
// Actions: 'cooldown' (trigger cooldown), 'warning' (toast), 'stop' (red alert)
//
// Usage:
//   const rules = useRuleEngine(s => s.rules);
//   const evaluate = useRuleEngine(s => s.evaluate);
//   const triggered = evaluate(ctx); // returns { rule, action }[]
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Default Rules ──────────────────────────────────────────────

const DEFAULT_RULES = [
  {
    id: 'consec_loss_3',
    name: '3 consecutive losses → Cool down',
    field: 'consecLosses',
    operator: '>=',
    value: 3,
    action: 'cooldown',
    enabled: true,
    icon: '🧊',
  },
  {
    id: 'daily_pnl_limit',
    name: 'Daily P&L limit breached',
    field: 'dailyPnl',
    operator: '<',
    value: -500,
    action: 'warning',
    enabled: true,
    icon: '⚠️',
  },
  {
    id: 'low_win_rate',
    name: 'Win rate below 30% (5+ trades)',
    field: 'sessionWinRate',
    operator: '<',
    value: 30,
    minTrades: 5,
    action: 'warning',
    enabled: true,
    icon: '📉',
  },
  {
    id: 'max_trades',
    name: 'Max 10 trades per day',
    field: 'tradeCount',
    operator: '>=',
    value: 10,
    action: 'stop',
    enabled: false,
    icon: '🛑',
  },
];

// ─── Condition Evaluator ────────────────────────────────────────

function evaluateCondition(rule, ctx) {
  const fieldVal = ctx[rule.field];
  if (fieldVal == null) return false;

  // MinTrades guard: some rules should only fire after N trades
  if (rule.minTrades && (ctx.tradeCount || 0) < rule.minTrades) return false;

  switch (rule.operator) {
    case '>=': return fieldVal >= rule.value;
    case '<=': return fieldVal <= rule.value;
    case '>':  return fieldVal > rule.value;
    case '<':  return fieldVal < rule.value;
    case '==': return fieldVal === rule.value;
    case '!=': return fieldVal !== rule.value;
    default: return false;
  }
}

// ─── Store ──────────────────────────────────────────────────────

const useRuleEngine = create(
  persist(
    (set, get) => ({
      rules: [...DEFAULT_RULES],

      // Evaluate all enabled rules against context, return triggered rules
      evaluate: (ctx) => {
        const { rules } = get();
        const triggered = [];
        for (const rule of rules) {
          if (!rule.enabled) continue;
          if (evaluateCondition(rule, ctx)) {
            triggered.push({ rule, action: rule.action });
          }
        }
        return triggered;
      },

      // ─── CRUD ─────────────────────────────────────────
      addRule: (rule) =>
        set((s) => ({
          rules: [...s.rules, {
            id: 'custom_' + Date.now().toString(36),
            enabled: true,
            icon: '📋',
            ...rule,
          }],
        })),

      updateRule: (id, updates) =>
        set((s) => ({
          rules: s.rules.map((r) => (r.id === id ? { ...r, ...updates } : r)),
        })),

      removeRule: (id) =>
        set((s) => ({
          rules: s.rules.filter((r) => r.id !== id),
        })),

      toggleRule: (id) =>
        set((s) => ({
          rules: s.rules.map((r) =>
            r.id === id ? { ...r, enabled: !r.enabled } : r,
          ),
        })),

      resetToDefaults: () =>
        set({ rules: [...DEFAULT_RULES] }),
    }),
    {
      name: 'charEdge-rule-engine',
      partialize: (state) => ({ rules: state.rules }),
    },
  ),
);

export { useRuleEngine, DEFAULT_RULES, evaluateCondition };
export default useRuleEngine;
