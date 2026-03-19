// ═══════════════════════════════════════════════════════════════════
// charEdge — Journal AI Hook (Sprint 64)
//
// Auto-generates structured analysis from journal text entries.
// Extracts: setup type, emotional state, lessons, action items.
// ═══════════════════════════════════════════════════════════════════

import { useState, useCallback } from 'react';

/**
 * Hook for AI-powered journal enhancement.
 * Analyzes journal entries and generates structured insights.
 */
export function useJournalAI() {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Analyze a journal entry and extract structured insights.
   */
  const analyzeEntry = useCallback(async (entry) => {
    if (!entry?.notes && !entry?.text) return null;

    setLoading(true);
    setError(null);

    try {
      const { aiRouter } = await import('../ai/AIRouter');

      const text = entry.notes || entry.text || '';
      const tradeContext = entry.symbol
        ? `Symbol: ${entry.symbol}, Side: ${entry.side || 'N/A'}, P&L: $${entry.pnl?.toFixed(2) || 'N/A'}`
        : '';

      const prompt = `Analyze this trading journal entry and extract structured insights:

${tradeContext}

Journal notes:
"${text}"

Extract and return:
1. **Setup Type**: (e.g., breakout, pullback, reversal, range, news)
2. **Emotional State**: (confident, anxious, impulsive, patient, frustrated, neutral)
3. **Key Lessons**: 1-2 bullet points on what can be learned
4. **Action Items**: 1 specific thing to do differently next time
5. **Quality Score**: 1-10 for journal entry quality (depth of reflection)

Be concise. Use the exact format above.`;

      const result = await aiRouter.route({
        type: 'journal',
        messages: [
          { role: 'system', content: 'You are a trading journal analyst. Extract structured insights from journal entries. Be concise.' },
          { role: 'user', content: prompt },
        ],
        maxTokens: 250,
        temperature: 0.3,
      });

      const parsed = {
        raw: result.content,
        tier: result.tier,
        timestamp: Date.now(),
      };

      setAnalysis(parsed);
      setLoading(false);
      return parsed;
    } catch (err) {
      setError(err?.message || 'Journal analysis failed');
      setLoading(false);
      return null;
    }
  }, []);

  /**
   * Generate a weekly summary from multiple journal entries.
   */
  const generateWeeklySummary = useCallback(async (entries) => {
    if (!entries?.length) return null;

    setLoading(true);
    try {
      const { aiRouter } = await import('../ai/AIRouter');

      const entrySummaries = entries.slice(0, 20).map((e, i) =>
        `${i + 1}. ${e.symbol || '?'} ${e.side || ''} | P&L: $${e.pnl?.toFixed(2) || '?'} | ${(e.notes || e.text || '').slice(0, 80)}`
      ).join('\n');

      const result = await aiRouter.route({
        type: 'journal',
        messages: [
          { role: 'system', content: 'You are a trading performance reviewer. Summarize weekly trading journal entries.' },
          { role: 'user', content: `Summarize these ${entries.length} journal entries from the past week:\n\n${entrySummaries}\n\nProvide: 1) Overall assessment, 2) Common patterns, 3) Top improvement area, 4) Strength to maintain. Keep it under 100 words.` },
        ],
        maxTokens: 200,
        temperature: 0.4,
      });

      setAnalysis({ raw: result.content, tier: result.tier, timestamp: Date.now() });
      setLoading(false);
      return result.content;
    } catch (err) {
      setError(err?.message || 'Weekly summary failed');
      setLoading(false);
      return null;
    }
  }, []);

  return {
    analysis,
    loading,
    error,
    analyzeEntry,
    generateWeeklySummary,
  };
}

export default useJournalAI;
