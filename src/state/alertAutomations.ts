// ═══════════════════════════════════════════════════════════════════
// charEdge — Alert Automations (Sprint 19)
//
// When an alert fires, optionally trigger an action:
//   - Auto-close position
//   - Auto-create trailing alert (opposite direction)
//   - Log journal entry
//   - Switch chart to symbol
//
// This is a competitive differentiator — neither Coinbase nor
// TradingView offers alert-triggered automations.
//
// Usage:
//   import { alertAutomations } from './alertAutomations';
//   alertAutomations.addRule({ alertId, action: 'closePosition' });
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Types ──────────────────────────────────────────────────────

export type AutomationAction =
  | 'closePosition'       // Close the related position
  | 'trailingAlert'       // Create a new alert X% in the opposite direction
  | 'logJournal'          // Create a journal entry with timestamp
  | 'switchChart'         // Navigate chart to the alert symbol
  | 'mute1h'              // Mute the symbol's alerts for 1 hour
  | 'playCustomSound';    // Play a specific sound

export interface AutomationRule {
  id: string;
  /** Alert ID or pattern this rule applies to */
  alertId?: string;
  /** Or apply to all alerts matching conditions */
  symbolPattern?: string;  // '*' for all, or specific symbol
  conditionType?: string;  // 'stopLossHit', 'takeProfitHit', etc.
  
  /** Action to perform */
  action: AutomationAction;
  /** Action parameters */
  params?: Record<string, unknown>;
  
  /** Whether this rule is active */
  enabled: boolean;
  /** Human-readable description */
  label: string;
  /** Times this rule has fired */
  executionCount: number;
  /** Last execution timestamp */
  lastExecuted: number;
}

// ─── Store ──────────────────────────────────────────────────────

interface AutomationState {
  rules: AutomationRule[];
  addRule: (rule: Omit<AutomationRule, 'id' | 'executionCount' | 'lastExecuted'>) => string;
  removeRule: (id: string) => void;
  toggleRule: (id: string) => void;
  updateRule: (id: string, updates: Partial<AutomationRule>) => void;
  /** Get rules matching an alert */
  getRulesForAlert: (alertId: string, symbol: string, condition?: string) => AutomationRule[];
}

let _ruleId = 0;

export const useAlertAutomations = create<AutomationState>()(
  persist(
    (set, get) => ({
      rules: [],

      addRule: (rule) => {
        const id = `auto-${Date.now()}-${++_ruleId}`;
        set((s) => ({
          rules: [...s.rules, { ...rule, id, executionCount: 0, lastExecuted: 0 }],
        }));
        return id;
      },

      removeRule: (id) => set((s) => ({
        rules: s.rules.filter((r) => r.id !== id),
      })),

      toggleRule: (id) => set((s) => ({
        rules: s.rules.map((r) => r.id === id ? { ...r, enabled: !r.enabled } : r),
      })),

      updateRule: (id, updates) => set((s) => ({
        rules: s.rules.map((r) => r.id === id ? { ...r, ...updates } : r),
      })),

      getRulesForAlert: (alertId, symbol, condition) => {
        return get().rules.filter((rule) => {
          if (!rule.enabled) return false;
          // Match by specific alertId
          if (rule.alertId && rule.alertId === alertId) return true;
          // Match by symbol pattern
          if (rule.symbolPattern === '*') return true;
          if (rule.symbolPattern && rule.symbolPattern === symbol) {
            if (!rule.conditionType || rule.conditionType === condition) return true;
          }
          return false;
        });
      },
    }),
    { name: 'charEdge-alert-automations' },
  ),
);

// ─── Action Executors ───────────────────────────────────────────

type ActionExecutor = (rule: AutomationRule, context: ExecutionContext) => void;

interface ExecutionContext {
  symbol: string;
  price: number;
  alertId: string;
  condition?: string;
}

const executors: Record<AutomationAction, ActionExecutor> = {
  closePosition: (_rule, ctx) => {
    window.dispatchEvent(new CustomEvent('charEdge:automation', {
      detail: { action: 'closePosition', symbol: ctx.symbol, price: ctx.price },
    }));
  },

  trailingAlert: (rule, ctx) => {
    const offsetPct = (rule.params?.offsetPercent as number) || 0.02;
    const isAbove = ctx.condition?.includes('above') || ctx.condition?.includes('high');
    const newPrice = isAbove
      ? ctx.price * (1 - offsetPct)  // trailing below
      : ctx.price * (1 + offsetPct); // trailing above
    
    window.dispatchEvent(new CustomEvent('charEdge:automation', {
      detail: {
        action: 'createAlert',
        symbol: ctx.symbol,
        price: Math.round(newPrice * 100) / 100,
        condition: isAbove ? 'below' : 'above',
        source: 'trailing-automation',
      },
    }));
  },

  logJournal: (_rule, ctx) => {
    window.dispatchEvent(new CustomEvent('charEdge:automation', {
      detail: {
        action: 'logJournal',
        symbol: ctx.symbol,
        entry: `Alert triggered: ${ctx.symbol} at $${ctx.price} (${ctx.condition})`,
        timestamp: Date.now(),
      },
    }));
  },

  switchChart: (_rule, ctx) => {
    window.dispatchEvent(new CustomEvent('charEdge:automation', {
      detail: { action: 'switchChart', symbol: ctx.symbol },
    }));
  },

  mute1h: (_rule, ctx) => {
    window.dispatchEvent(new CustomEvent('charEdge:automation', {
      detail: { action: 'muteSymbol', symbol: ctx.symbol, durationMs: 3600000 },
    }));
  },

  playCustomSound: (rule, _ctx) => {
    const soundName = (rule.params?.soundName as string) || 'price';
    window.dispatchEvent(new CustomEvent('charEdge:automation', {
      detail: { action: 'playSound', sound: soundName },
    }));
  },
};

// ─── Execution Engine ───────────────────────────────────────────

/**
 * Execute all matching automation rules when an alert fires.
 */
export function executeAutomations(
  alertId: string,
  symbol: string,
  price: number,
  condition?: string,
): void {
  const store = useAlertAutomations.getState();
  const rules = store.getRulesForAlert(alertId, symbol, condition);
  const context: ExecutionContext = { symbol, price, alertId, condition };

  for (const rule of rules) {
    const executor = executors[rule.action];
    if (executor) {
      try {
        executor(rule, context);
        // Record execution
        useAlertAutomations.setState((s) => ({
          rules: s.rules.map((r) =>
            r.id === rule.id
              ? { ...r, executionCount: r.executionCount + 1, lastExecuted: Date.now() }
              : r,
          ),
        }));
      } catch (err) {
        console.warn(`[alertAutomations] Rule ${rule.id} failed:`, err);
      }
    }
  }
}

export default useAlertAutomations;
