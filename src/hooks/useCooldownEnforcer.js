// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — Cooldown Enforcer Hook (Sprint 3: B.3)
//
// Watches today's trades for consecutive losses and auto-triggers
// the COOLING_DOWN session state when threshold is breached.
//
// Persists cooldown end time in sessionStorage so page refresh
// doesn't reset the timer.
//
// Usage:
//   const { isActive, minutesLeft, secondsLeft, override } = useCooldownEnforcer();
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from 'react';
import { useJournalStore } from '../state/useJournalStore.js';
import { useRuleEngine } from '../state/useRuleEngine.js';
import toast from '../app/components/ui/Toast.jsx';

const COOLDOWN_KEY = 'charEdge-cooldown-end';
const DEFAULT_COOLDOWN_MINUTES = 15;

/**
 * Build session context from today's trades for rule evaluation.
 * @param {Object[]} trades - All trades from the journal store
 * @returns {Object} Session context
 */
function buildSessionContext(trades) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayTrades = trades.filter((t) => t.date?.slice(0, 10) === todayStr);

  if (!todayTrades.length) {
    return { consecLosses: 0, dailyPnl: 0, sessionWinRate: 0, tradeCount: 0, totalLosses: 0 };
  }

  // Sort by date ascending
  const sorted = [...todayTrades].sort((a, b) => a.date.localeCompare(b.date));

  // Count consecutive losses from the end
  let consecLosses = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].pnl < 0) consecLosses++;
    else break;
  }

  // Total P&L for today
  let dailyPnl = 0;
  let wins = 0;
  let losses = 0;
  for (const t of sorted) {
    dailyPnl += t.pnl || 0;
    if (t.pnl > 0) wins++;
    else if (t.pnl < 0) losses++;
  }

  const tradeCount = sorted.length;
  const sessionWinRate = tradeCount > 0 ? (wins / tradeCount) * 100 : 0;

  return { consecLosses, dailyPnl, sessionWinRate, tradeCount, totalLosses: losses };
}

/**
 * Hook: monitors session for rule violations and manages cooldown timer.
 * @param {Object} [opts]
 * @param {number} [opts.cooldownMinutes=15]
 * @returns {{ isActive: boolean, minutesLeft: number, secondsLeft: number, override: Function, context: Object }}
 */
export function useCooldownEnforcer(opts = {}) {
  const cooldownMinutes = opts.cooldownMinutes || DEFAULT_COOLDOWN_MINUTES;
  const trades = useJournalStore((s) => s.trades);
  const evaluate = useRuleEngine((s) => s.evaluate);

  // Track cooldown end time
  const [cooldownEnd, setCooldownEnd] = useState(() => {
    const stored = sessionStorage.getItem(COOLDOWN_KEY);
    return stored ? Number(stored) : 0;
  });
  const [now, setNow] = useState(Date.now());
  const lastTriggeredRef = useRef(0);

  // Tick timer every second when cooldown is active
  useEffect(() => {
    if (cooldownEnd <= 0) return;
    const id = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= cooldownEnd) {
        setCooldownEnd(0);
        sessionStorage.removeItem(COOLDOWN_KEY);
        toast.success('Cooldown complete. You can trade again. Stay disciplined. 🧘');
      }
    }, 1000);
    return () => clearInterval(id);
  }, [cooldownEnd]);

  // Build context and evaluate rules when trades change
  const context = buildSessionContext(trades);

  useEffect(() => {
    // Don't re-trigger if already in cooldown
    if (cooldownEnd > Date.now()) return;

    // Debounce: don't re-trigger within 5 seconds
    if (Date.now() - lastTriggeredRef.current < 5000) return;

    const triggered = evaluate(context);

    for (const { rule, action } of triggered) {
      if (action === 'cooldown') {
        const endTime = Date.now() + cooldownMinutes * 60 * 1000;
        setCooldownEnd(endTime);
        sessionStorage.setItem(COOLDOWN_KEY, String(endTime));
        lastTriggeredRef.current = Date.now();
        toast.error(`🧊 ${rule.name} — Cooling down for ${cooldownMinutes} minutes.`);
      } else if (action === 'warning') {
        toast(`⚠️ ${rule.name}`, { icon: rule.icon || '⚠️' });
        lastTriggeredRef.current = Date.now();
      } else if (action === 'stop') {
        toast.error(`🛑 ${rule.name} — Consider stopping for today.`);
        lastTriggeredRef.current = Date.now();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trades.length]);

  // Override: end cooldown early (tracked for analytics)
  const override = useCallback(() => {
    setCooldownEnd(0);
    sessionStorage.removeItem(COOLDOWN_KEY);
    toast('Cooldown overridden. Trade carefully. ⚠️', { icon: '⚡' });
  }, []);

  const isActive = cooldownEnd > now && cooldownEnd > 0;
  const remaining = Math.max(0, cooldownEnd - now);
  const minutesLeft = Math.floor(remaining / 60000);
  const secondsLeft = Math.floor((remaining % 60000) / 1000);

  return { isActive, minutesLeft, secondsLeft, override, context };
}

export { buildSessionContext };
export default useCooldownEnforcer;
