// ═══════════════════════════════════════════════════════════════════
// charEdge — Psychology: Rule Engine Deep Tests
//
// Covers: CRUD operations, evaluate(), operator coverage,
//         navigateToTrade() success/failure paths
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useRuleEngine, DEFAULT_RULES, evaluateCondition } from '../../state/useRuleEngine.ts';
import { navigateToTrade, tradeNav } from '@/trading/navigateToTrade';

// Reset store to defaults before each test
const resetStore = () => useRuleEngine.setState({ rules: [...DEFAULT_RULES] });

// ═══ Operator Coverage ══════════════════════════════════════════

describe('evaluateCondition — extended operators', () => {
  it('evaluates <= correctly', () => {
    const rule = { field: 'dailyPnl', operator: '<=', value: 100 };
    expect(evaluateCondition(rule, { dailyPnl: 100 })).toBe(true);
    expect(evaluateCondition(rule, { dailyPnl: 50 })).toBe(true);
    expect(evaluateCondition(rule, { dailyPnl: 101 })).toBe(false);
  });

  it('evaluates > correctly', () => {
    const rule = { field: 'tradeCount', operator: '>', value: 5 };
    expect(evaluateCondition(rule, { tradeCount: 6 })).toBe(true);
    expect(evaluateCondition(rule, { tradeCount: 5 })).toBe(false);
    expect(evaluateCondition(rule, { tradeCount: 4 })).toBe(false);
  });

  it('handles null field value gracefully', () => {
    const rule = { field: 'consecLosses', operator: '>=', value: 1 };
    expect(evaluateCondition(rule, { consecLosses: null })).toBe(false);
  });

  it('handles undefined context values', () => {
    const rule = { field: 'someField', operator: '>=', value: 1 };
    expect(evaluateCondition(rule, {})).toBe(false);
  });
});

// ═══ Rule Engine Store — evaluate() ═════════════════════════════

describe('Rule Engine — evaluate()', () => {
  beforeEach(resetStore);

  it('returns only triggered enabled rules', () => {
    const ctx = { consecLosses: 3, dailyPnl: -600, sessionWinRate: 50, tradeCount: 10 };
    const triggered = useRuleEngine.getState().evaluate(ctx);
    // consec_loss_3 (>=3) → triggered
    // daily_pnl_limit (<-500) → triggered
    // low_win_rate (<30, 5+ trades, but winRate 50) → NOT triggered
    // max_trades (>=10) → disabled by default → NOT triggered
    expect(triggered.length).toBe(2);
    expect(triggered.map(t => t.rule.id)).toContain('consec_loss_3');
    expect(triggered.map(t => t.rule.id)).toContain('daily_pnl_limit');
  });

  it('skips disabled rules entirely', () => {
    const ctx = { tradeCount: 15 };
    const triggered = useRuleEngine.getState().evaluate(ctx);
    // max_trades is disabled by default
    expect(triggered.find(t => t.rule.id === 'max_trades')).toBeUndefined();
  });

  it('returns empty array when nothing triggers', () => {
    const ctx = { consecLosses: 0, dailyPnl: 500, sessionWinRate: 80, tradeCount: 3 };
    const triggered = useRuleEngine.getState().evaluate(ctx);
    expect(triggered).toEqual([]);
  });

  it('includes action from rule', () => {
    const ctx = { consecLosses: 5 };
    const triggered = useRuleEngine.getState().evaluate(ctx);
    const consec = triggered.find(t => t.rule.id === 'consec_loss_3');
    expect(consec.action).toBe('cooldown');
  });
});

// ═══ Rule Engine Store — CRUD ═══════════════════════════════════

describe('Rule Engine — addRule()', () => {
  beforeEach(resetStore);

  it('appends a new rule with generated ID', () => {
    const before = useRuleEngine.getState().rules.length;
    useRuleEngine.getState().addRule({
      name: 'Test Rule',
      field: 'tradeCount',
      operator: '>=',
      value: 20,
      action: 'warning',
    });
    const after = useRuleEngine.getState().rules;
    expect(after.length).toBe(before + 1);
    const newRule = after[after.length - 1];
    expect(newRule.id).toMatch(/^custom_/);
    expect(newRule.enabled).toBe(true);
    expect(newRule.icon).toBe('📋');
    expect(newRule.name).toBe('Test Rule');
  });

  it('user-provided fields override defaults', () => {
    useRuleEngine.getState().addRule({
      name: 'Custom',
      field: 'dailyPnl',
      operator: '<',
      value: -1000,
      action: 'stop',
      icon: '🔥',
      enabled: false,
    });
    const rule = useRuleEngine.getState().rules.at(-1);
    expect(rule.icon).toBe('🔥');
    expect(rule.enabled).toBe(false);
  });
});

describe('Rule Engine — updateRule()', () => {
  beforeEach(resetStore);

  it('updates an existing rule by ID', () => {
    useRuleEngine.getState().updateRule('consec_loss_3', { value: 5 });
    const rule = useRuleEngine.getState().rules.find(r => r.id === 'consec_loss_3');
    expect(rule.value).toBe(5);
    expect(rule.name).toBe('3 consecutive losses → Cool down'); // unchanged
  });

  it('no-ops for unknown ID', () => {
    const before = JSON.stringify(useRuleEngine.getState().rules);
    useRuleEngine.getState().updateRule('nonexistent_id', { value: 999 });
    const after = JSON.stringify(useRuleEngine.getState().rules);
    expect(after).toBe(before);
  });
});

describe('Rule Engine — removeRule()', () => {
  beforeEach(resetStore);

  it('removes a rule by ID', () => {
    const before = useRuleEngine.getState().rules.length;
    useRuleEngine.getState().removeRule('daily_pnl_limit');
    const after = useRuleEngine.getState().rules;
    expect(after.length).toBe(before - 1);
    expect(after.find(r => r.id === 'daily_pnl_limit')).toBeUndefined();
  });

  it('no-ops for unknown ID', () => {
    const before = useRuleEngine.getState().rules.length;
    useRuleEngine.getState().removeRule('nonexistent');
    expect(useRuleEngine.getState().rules.length).toBe(before);
  });
});

describe('Rule Engine — toggleRule()', () => {
  beforeEach(resetStore);

  it('flips enabled from true to false', () => {
    expect(useRuleEngine.getState().rules.find(r => r.id === 'consec_loss_3').enabled).toBe(true);
    useRuleEngine.getState().toggleRule('consec_loss_3');
    expect(useRuleEngine.getState().rules.find(r => r.id === 'consec_loss_3').enabled).toBe(false);
  });

  it('flips enabled from false to true', () => {
    expect(useRuleEngine.getState().rules.find(r => r.id === 'max_trades').enabled).toBe(false);
    useRuleEngine.getState().toggleRule('max_trades');
    expect(useRuleEngine.getState().rules.find(r => r.id === 'max_trades').enabled).toBe(true);
  });

  it('double toggle returns to original state', () => {
    const original = useRuleEngine.getState().rules.find(r => r.id === 'consec_loss_3').enabled;
    useRuleEngine.getState().toggleRule('consec_loss_3');
    useRuleEngine.getState().toggleRule('consec_loss_3');
    expect(useRuleEngine.getState().rules.find(r => r.id === 'consec_loss_3').enabled).toBe(original);
  });
});

describe('Rule Engine — resetToDefaults()', () => {
  beforeEach(resetStore);

  it('restores all 4 default rules after mutations', () => {
    useRuleEngine.getState().removeRule('consec_loss_3');
    useRuleEngine.getState().removeRule('daily_pnl_limit');
    useRuleEngine.getState().addRule({ name: 'X', field: 'tradeCount', operator: '>=', value: 1, action: 'warning' });
    expect(useRuleEngine.getState().rules.length).toBe(3); // 2 defaults + 1 custom

    useRuleEngine.getState().resetToDefaults();
    const rules = useRuleEngine.getState().rules;
    expect(rules.length).toBe(4);
    expect(rules.map(r => r.id)).toEqual(['consec_loss_3', 'daily_pnl_limit', 'low_win_rate', 'max_trades']);
  });
});

// ═══ navigateToTrade() ══════════════════════════════════════════

describe('navigateToTrade()', () => {
  beforeEach(() => tradeNav.clear());

  it('returns failure for missing trade', () => {
    expect(navigateToTrade(null)).toEqual({ success: false, symbol: '', timestamp: 0 });
    expect(navigateToTrade(undefined)).toEqual({ success: false, symbol: '', timestamp: 0 });
  });

  it('returns failure for trade without date', () => {
    expect(navigateToTrade({ symbol: 'BTC' })).toEqual({ success: false, symbol: '', timestamp: 0 });
  });

  it('returns failure for empty symbol', () => {
    const result = navigateToTrade({ date: '2025-01-15T10:00:00Z', symbol: '' });
    expect(result.success).toBe(false);
  });

  it('returns failure for invalid date', () => {
    const result = navigateToTrade({ date: 'not-a-date', symbol: 'BTC' });
    expect(result.success).toBe(false);
  });

  it('returns success with uppercase symbol and timestamp', () => {
    const result = navigateToTrade({
      date: '2025-01-15T10:00:00Z',
      symbol: 'btc',
      id: 'trade_1',
    });
    expect(result.success).toBe(true);
    expect(result.symbol).toBe('BTC');
    expect(result.timestamp).toBe(new Date('2025-01-15T10:00:00Z').getTime());
  });

  it('calls setSymbol when provided', () => {
    const setSymbol = vi.fn();
    navigateToTrade({ date: '2025-01-15T10:00:00Z', symbol: 'ETH', id: 't1' }, { setSymbol });
    expect(setSymbol).toHaveBeenCalledWith('ETH');
  });

  it('calls setTf when tf option provided', () => {
    const setTf = vi.fn();
    navigateToTrade(
      { date: '2025-01-15T10:00:00Z', symbol: 'BTC', id: 't1' },
      { tf: '1h', setTf },
    );
    expect(setTf).toHaveBeenCalledWith('1h');
  });

  it('calls setPage to switch to charts', () => {
    const setPage = vi.fn();
    navigateToTrade(
      { date: '2025-01-15T10:00:00Z', symbol: 'BTC', id: 't1' },
      { setPage },
    );
    expect(setPage).toHaveBeenCalledWith('charts');
  });

  it('emits navigate event after delay', async () => {
    let received = null;
    tradeNav.on('navigate', (payload) => { received = payload; });

    navigateToTrade({
      date: '2025-01-15T10:00:00Z',
      symbol: 'BTC',
      id: 'trade_1',
      entry: 42000,
      exit: 43000,
      side: 'long',
      pnl: 1000,
    });

    // Event is emitted asynchronously via setTimeout(50ms)
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(received).not.toBeNull();
    expect(received.tradeId).toBe('trade_1');
    expect(received.symbol).toBe('BTC');
    expect(received.entry).toBe(42000);
    expect(received.exit).toBe(43000);
    expect(received.side).toBe('long');
    expect(received.pnl).toBe(1000);
  });

  it('does not call setTf when no tf option', () => {
    const setTf = vi.fn();
    navigateToTrade(
      { date: '2025-01-15T10:00:00Z', symbol: 'BTC', id: 't1' },
      { setTf }, // setTf provided but no tf value
    );
    expect(setTf).not.toHaveBeenCalled();
  });
});

// ═══ #47 Gap-Fill: Edge Cases ═══════════════════════════════════

describe('Rule Engine — edge cases (#47)', () => {
  beforeEach(resetStore);

  it('evaluate returns empty for empty ruleset', () => {
    useRuleEngine.setState({ rules: [] });
    const triggered = useRuleEngine.getState().evaluate({
      consecLosses: 10, dailyPnl: -9999, tradeCount: 999,
    });
    expect(triggered).toEqual([]);
  });

  it('conflicting rules both fire independently', () => {
    useRuleEngine.setState({
      rules: [
        { id: 'r1', name: 'High PnL', field: 'dailyPnl', operator: '>', value: 100, action: 'warning', enabled: true },
        { id: 'r2', name: 'Any PnL', field: 'dailyPnl', operator: '>=', value: 0, action: 'info', enabled: true },
      ],
    });
    const triggered = useRuleEngine.getState().evaluate({ dailyPnl: 200 });
    expect(triggered.length).toBe(2);
    expect(triggered.map(t => t.rule.id)).toContain('r1');
    expect(triggered.map(t => t.rule.id)).toContain('r2');
  });

  it('handles NaN in context gracefully', () => {
    const rule = { field: 'pnl', operator: '>', value: 0 };
    expect(evaluateCondition(rule, { pnl: NaN })).toBe(false);
  });

  it('boundary: operator >= with exact match', () => {
    const rule = { field: 'count', operator: '>=', value: 10 };
    expect(evaluateCondition(rule, { count: 10 })).toBe(true);
    expect(evaluateCondition(rule, { count: 9 })).toBe(false);
  });

  it('boundary: operator < with exact match', () => {
    const rule = { field: 'pnl', operator: '<', value: -500 };
    expect(evaluateCondition(rule, { pnl: -500 })).toBe(false);
    expect(evaluateCondition(rule, { pnl: -501 })).toBe(true);
  });
});

