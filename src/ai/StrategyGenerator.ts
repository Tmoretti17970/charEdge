// ═══════════════════════════════════════════════════════════════════
// charEdge — AI Strategy Generator (Sprint 79)
//
// Generate structured trading strategies from natural language
// descriptions. Output conforms to Playbook schema.
//
// Usage:
//   import { strategyGenerator } from './StrategyGenerator';
//   const strategy = await strategyGenerator.generate("breakouts on NVDA with RSI confirmation");
// ═══════════════════════════════════════════════════════════════════

// ─── Types ───────────────────────────────────────────────────────

export interface GeneratedStrategy {
  name: string;
  description: string;
  entryRules: string[];
  exitRules: string[];
  indicators: string[];
  riskParams: {
    stopLossPercent: number;
    takeProfitPercent: number;
    maxPositionSize: number;
    riskPerTrade: number;
  };
  timeframes: string[];
  symbols: string[];
  raw: string;
  tier: string;
}

// ─── Generator ──────────────────────────────────────────────────

class StrategyGenerator {
  /**
   * Generate a trading strategy from a natural language description.
   */
  async generate(description: string): Promise<GeneratedStrategy> {
    const prompt = `Generate a structured trading strategy based on this description:
"${description}"

Return a JSON object with these fields:
{
  "name": "short strategy name",
  "description": "1-2 sentence summary",
  "entryRules": ["rule 1", "rule 2", ...],
  "exitRules": ["rule 1", "rule 2", ...],
  "indicators": ["RSI", "EMA", ...],
  "riskParams": {
    "stopLossPercent": 2,
    "takeProfitPercent": 4,
    "maxPositionSize": 10,
    "riskPerTrade": 1
  },
  "timeframes": ["15", "60"],
  "symbols": ["NVDA", "AAPL"]
}

Rules should be specific and actionable. Include 3-5 entry rules and 2-4 exit rules.
Risk params should be conservative. Return ONLY valid JSON.`;

    try {
      const { aiRouter } = await import('./AIRouter');
      const result = await aiRouter.route({
        type: 'complex',
        messages: [
          { role: 'system', content: 'You are an expert trading strategy designer. Output only valid JSON. Be specific with entry/exit rules.' },
          { role: 'user', content: prompt },
        ],
        maxTokens: 500,
        temperature: 0.3,
      });

      const parsed = this._parseJSON(result.content);
      return {
        name: parsed.name || 'Custom Strategy',
        description: parsed.description || description,
        entryRules: parsed.entryRules || [],
        exitRules: parsed.exitRules || [],
        indicators: parsed.indicators || [],
        riskParams: {
          stopLossPercent: parsed.riskParams?.stopLossPercent || 2,
          takeProfitPercent: parsed.riskParams?.takeProfitPercent || 4,
          maxPositionSize: parsed.riskParams?.maxPositionSize || 10,
          riskPerTrade: parsed.riskParams?.riskPerTrade || 1,
        },
        timeframes: parsed.timeframes || [],
        symbols: parsed.symbols || [],
        raw: result.content,
        tier: result.tier,
      };
    } catch {
      return this._fallbackStrategy(description);
    }
  }

  private _parseJSON(text: string): Record<string, unknown> {
    // Try to extract JSON from markdown code blocks or raw text
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
    if (jsonMatch) {
      try { return JSON.parse(jsonMatch[1]); }
      catch { /* fallthrough */ }
    }
    try { return JSON.parse(text); }
    catch { return {}; }
  }

  private _fallbackStrategy(description: string): GeneratedStrategy {
    return {
      name: 'Custom Strategy',
      description,
      entryRules: ['Define your entry trigger', 'Confirm with volume', 'Check higher timeframe trend'],
      exitRules: ['Set stop loss at support/resistance', 'Take profit at 2:1 R:R', 'Trail stop after 1R move'],
      indicators: ['EMA 20', 'RSI 14'],
      riskParams: { stopLossPercent: 2, takeProfitPercent: 4, maxPositionSize: 10, riskPerTrade: 1 },
      timeframes: ['15'],
      symbols: [],
      raw: '',
      tier: 'L1',
    };
  }
}

// ─── Singleton ──────────────────────────────────────────────────

export const strategyGenerator = new StrategyGenerator();
export default strategyGenerator;
