// ═══════════════════════════════════════════════════════════════════
// charEdge — Strategy Builder Store
// State management for the no-code visual strategy builder.
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Block Types ─────────────────────────────────────────────────

export const CONDITION_SOURCES = [
  { id: 'close', label: 'Close Price', type: 'price' },
  { id: 'open', label: 'Open Price', type: 'price' },
  { id: 'high', label: 'High Price', type: 'price' },
  { id: 'low', label: 'Low Price', type: 'price' },
  { id: 'volume', label: 'Volume', type: 'price' },
  { id: 'sma', label: 'SMA', type: 'indicator', params: [{ name: 'period', default: 20, min: 2, max: 500 }] },
  { id: 'ema', label: 'EMA', type: 'indicator', params: [{ name: 'period', default: 20, min: 2, max: 500 }] },
  { id: 'rsi', label: 'RSI', type: 'indicator', params: [{ name: 'period', default: 14, min: 2, max: 100 }] },
  { id: 'macd_line', label: 'MACD Line', type: 'indicator', params: [] },
  { id: 'macd_signal', label: 'MACD Signal', type: 'indicator', params: [] },
  { id: 'macd_histogram', label: 'MACD Histogram', type: 'indicator', params: [] },
  { id: 'atr', label: 'ATR', type: 'indicator', params: [{ name: 'period', default: 14, min: 2, max: 100 }] },
  { id: 'bollinger_upper', label: 'Bollinger Upper', type: 'indicator', params: [{ name: 'period', default: 20 }] },
  { id: 'bollinger_lower', label: 'Bollinger Lower', type: 'indicator', params: [{ name: 'period', default: 20 }] },
  { id: 'vwap', label: 'VWAP', type: 'indicator', params: [] },
  { id: 'number', label: 'Fixed Value', type: 'constant', params: [{ name: 'value', default: 0 }] },
];

export const COMPARISONS = [
  { id: 'crosses_above', label: 'Crosses Above' },
  { id: 'crosses_below', label: 'Crosses Below' },
  { id: 'greater_than', label: 'Greater Than' },
  { id: 'less_than', label: 'Less Than' },
  { id: 'equals', label: 'Equals' },
];

export const EXIT_TYPES = [
  { id: 'opposite_signal', label: 'Opposite Signal' },
  { id: 'stop_loss', label: 'Stop Loss (ATR)', params: [{ name: 'atrMult', default: 2 }] },
  { id: 'take_profit', label: 'Take Profit (ATR)', params: [{ name: 'atrMult', default: 3 }] },
  { id: 'trailing_stop', label: 'Trailing Stop (ATR)', params: [{ name: 'atrMult', default: 2 }] },
  { id: 'bars_held', label: 'Exit After N Bars', params: [{ name: 'bars', default: 10 }] },
];

// ─── Default Condition Block ─────────────────────────────────────

function createCondition() {
  return {
    id: crypto.randomUUID(),
    left: { source: 'sma', params: { period: 10 } },
    comparison: 'crosses_above',
    right: { source: 'sma', params: { period: 50 } },
  };
}

// ─── Store ───────────────────────────────────────────────────────

const useStrategyBuilderStore = create(
  persist(
    (set, get) => ({
      // ─── UI ──────────────────────────────────────────────
      panelOpen: false,

      // ─── Strategy Definition ─────────────────────────────
      name: 'My Strategy',
      entryLong: [createCondition()],     // AND conditions for long entry
      entryShort: [],                      // AND conditions for short entry
      exitRules: [{ type: 'opposite_signal', params: {} }],
      logicMode: 'AND',  // AND / OR for combining conditions

      // ─── Actions ─────────────────────────────────────────

      togglePanel() { set(s => ({ panelOpen: !s.panelOpen })); },

      setName(name) { set({ name }); },

      addCondition(side = 'long') {
        set(s => {
          const key = side === 'long' ? 'entryLong' : 'entryShort';
          return { [key]: [...s[key], createCondition()] };
        });
      },

      removeCondition(side, id) {
        set(s => {
          const key = side === 'long' ? 'entryLong' : 'entryShort';
          return { [key]: s[key].filter(c => c.id !== id) };
        });
      },

      updateCondition(side, id, updates) {
        set(s => {
          const key = side === 'long' ? 'entryLong' : 'entryShort';
          return {
            [key]: s[key].map(c => c.id === id ? { ...c, ...updates } : c),
          };
        });
      },

      setExitRules(rules) { set({ exitRules: rules }); },
      setLogicMode(mode) { set({ logicMode: mode }); },

      // ─── Code Generation ─────────────────────────────────

      /**
       * Convert the visual strategy into executable ForgeScript-compatible
       * code that BacktestEngine can run.
       */
      generateStrategy() {
        const { name, entryLong, entryShort, exitRules, logicMode } = get();

        const getLookup = (src) => {
          switch (src.source) {
            case 'close': return 'close[i]';
            case 'open': return 'open[i]';
            case 'high': return 'high[i]';
            case 'low': return 'low[i]';
            case 'volume': return 'volume[i]';
            case 'sma': return `_sma${src.params.period || 20}[i]`;
            case 'ema': return `_ema${src.params.period || 20}[i]`;
            case 'rsi': return `_rsi${src.params.period || 14}[i]`;
            case 'atr': return `_atr${src.params.period || 14}[i]`;
            case 'macd_line': return '_macd[i]?.macd';
            case 'macd_signal': return '_macd[i]?.signal';
            case 'macd_histogram': return '_macd[i]?.histogram';
            case 'bollinger_upper': return `_bb${src.params.period || 20}[i]?.upper`;
            case 'bollinger_lower': return `_bb${src.params.period || 20}[i]?.lower`;
            case 'vwap': return '_vwap[i]';
            case 'number': return String(src.params.value || 0);
            default: return '0';
          }
        };

        const getPrev = (src) => getLookup(src).replace('[i]', '[i-1]');

        const buildComparison = (c) => {
          const l = getLookup(c.left);
          const r = getLookup(c.right);
          const lp = getPrev(c.left);
          const rp = getPrev(c.right);
          switch (c.comparison) {
            case 'crosses_above': return `(${lp} <= ${rp} && ${l} > ${r})`;
            case 'crosses_below': return `(${lp} >= ${rp} && ${l} < ${r})`;
            case 'greater_than': return `(${l} > ${r})`;
            case 'less_than': return `(${l} < ${r})`;
            case 'equals': return `(Math.abs(${l} - ${r}) < 0.0001)`;
            default: return 'false';
          }
        };

        const joiner = logicMode === 'OR' ? ' || ' : ' && ';
        const longCond = entryLong.length > 0
          ? entryLong.map(buildComparison).join(joiner)
          : 'false';
        const shortCond = entryShort.length > 0
          ? entryShort.map(buildComparison).join(joiner)
          : 'false';

        // Build the strategy object compatible with BacktestEngine
        return {
          name,
          description: `Visual strategy: ${entryLong.length} long conditions, ${entryShort.length} short conditions`,
          _longCondition: longCond,
          _shortCondition: shortCond,
          _exitRules: exitRules,

          // Setup — compute indicators once
          setup(bars) {
            const ctx = {};
            const closes = bars.map(b => b.close);

            // Collect all needed indicator calls
            const needsSma = new Set();
            const needsEma = new Set();
            const needsRsi = new Set();
            const needsAtr = new Set();
            const needsBB = new Set();
            let needsMacd = false;
            let needsVwap = false;

            for (const c of [...entryLong, ...entryShort]) {
              for (const side of [c.left, c.right]) {
                if (side.source === 'sma') needsSma.add(side.params.period || 20);
                if (side.source === 'ema') needsEma.add(side.params.period || 20);
                if (side.source === 'rsi') needsRsi.add(side.params.period || 14);
                if (side.source === 'atr') needsAtr.add(side.params.period || 14);
                if (side.source.startsWith('bollinger')) needsBB.add(side.params.period || 20);
                if (side.source.startsWith('macd')) needsMacd = true;
                if (side.source === 'vwap') needsVwap = true;
              }
            }

            // Always compute ATR for exits
            needsAtr.add(14);

            // Import Calc dynamically (it's in the scope)
            const Calc = window.__tfCalc;
            if (!Calc) return ctx;

            for (const p of needsSma) ctx[`_sma${p}`] = Calc.sma(closes, p);
            for (const p of needsEma) ctx[`_ema${p}`] = Calc.ema(closes, p);
            for (const p of needsRsi) ctx[`_rsi${p}`] = Calc.rsi(closes, p);
            for (const p of needsAtr) ctx[`_atr${p}`] = Calc.atr(bars, p);
            for (const p of needsBB) ctx[`_bb${p}`] = Calc.bollinger(closes, p);
            if (needsMacd) ctx._macd = Calc.macd(closes);
            if (needsVwap) ctx._vwap = Calc.vwap(bars);

            ctx.close = closes;
            ctx.open = bars.map(b => b.open);
            ctx.high = bars.map(b => b.high);
            ctx.low = bars.map(b => b.low);
            ctx.volume = bars.map(b => b.volume || 0);

            return ctx;
          },

          // Signal function — returns 1 (long), -1 (short), 0 (no signal)
          signal(i, bars, ctx) {
            // Evaluate using compiled conditions
            try {
              const evalInCtx = (condition) => {
                // Build scope variables
                const scope = { ...ctx, i, Math };
                return new Function(...Object.keys(scope), `return ${condition};`)(...Object.values(scope));
              };

              if (evalInCtx(longCond)) return 1;
              if (evalInCtx(shortCond)) return -1;
            } catch {
              // Evaluation error — no signal
            }
            return 0;
          },
        };
      },

      // Reset to defaults
      reset() {
        set({
          name: 'My Strategy',
          entryLong: [createCondition()],
          entryShort: [],
          exitRules: [{ type: 'opposite_signal', params: {} }],
          logicMode: 'AND',
        });
      },
    }),
    {
      name: 'charEdge-strategy-builder',
      version: 1,
      partialize: (s) => ({
        name: s.name,
        entryLong: s.entryLong,
        entryShort: s.entryShort,
        exitRules: s.exitRules,
        logicMode: s.logicMode,
      }),
    },
  ),
);

export { useStrategyBuilderStore };
export default useStrategyBuilderStore;
