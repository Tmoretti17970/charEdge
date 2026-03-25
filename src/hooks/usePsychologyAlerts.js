// ═══════════════════════════════════════════════════════════════════
// charEdge — usePsychologyAlerts Hook (Sprint 16)
//
// Runs PsychologyEngine.analyze() reactively against recent trades
// and current candle data. Returns alerts, session curve, and risk level
// for use by AIBehavioralAlert and ChartInsightsPanel.
//
// Usage:
//   const { alerts, topAlert, dismissAlert, sessionCurve, riskLevel }
//     = usePsychologyAlerts(data);
// ═══════════════════════════════════════════════════════════════════

import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { psychologyEngine } from '../charting_library/ai/PsychologyEngine.js';
import { useJournalStore } from '../state/useJournalStore';

/**
 * @param {Array} candles - Current chart OHLCV data
 * @returns {{ alerts: Array, topAlert: Object|null, dismissAlert: Function, sessionCurve: Array, riskLevel: string, summary: string }}
 */
export default function usePsychologyAlerts(candles) {
  const trades = useJournalStore((s) => s.trades);
  const [dismissed, setDismissed] = useState(new Set());
  // Run analysis reactively — debounced via useMemo
  const analysis = useMemo(() => {
    if (!trades?.length) return { alerts: [], sessionCurve: [], riskLevel: 'low', summary: '' };
    try {
      return psychologyEngine.analyze(trades, candles || []);
    } catch {
      return { alerts: [], sessionCurve: [], riskLevel: 'low', summary: '' };
    }
  }, [trades, candles]);

  // Filter out dismissed alerts
  const activeAlerts = useMemo(() => {
    return analysis.alerts.filter((a) => {
      const id = `${a.type}-${a.timestamp}`;
      return !dismissed.has(id);
    });
  }, [analysis.alerts, dismissed]);

  // Top alert = highest severity undismissed alert
  const topAlert = activeAlerts.length > 0 ? activeAlerts[0] : null;

  // Dismiss handler
  const dismissAlert = useCallback(() => {
    if (topAlert) {
      const id = `${topAlert.type}-${topAlert.timestamp}`;
      setDismissed((prev) => new Set(prev).add(id));
    }
  }, [topAlert]);

  // Reset dismissed set when trades change significantly
  const tradeCountRef = useRef(trades?.length || 0);
  useEffect(() => {
    const newCount = trades?.length || 0;
    if (newCount !== tradeCountRef.current) {
      tradeCountRef.current = newCount;
      // Only reset if a new trade was added (count increased)
      if (newCount > tradeCountRef.current) {
        setDismissed(new Set());
      }
    }
  }, [trades]);

  return {
    alerts: activeAlerts,
    topAlert,
    dismissAlert,
    sessionCurve: analysis.sessionCurve,
    riskLevel: analysis.riskLevel,
    summary: analysis.summary,
  };
}
