// ═══════════════════════════════════════════════════════════════════
// charEdge — Natural Language Chart Query Processor (Sprint 78)
//
// Parse plain-English questions about chart data into structured
// lookups. Simple queries resolved locally; complex ones routed
// through AIRouter.
//
// Usage:
//   import { chartQueryProcessor } from './ChartQueryProcessor';
//   const answer = await chartQueryProcessor.query("what was the high last tuesday", chartContext);
// ═══════════════════════════════════════════════════════════════════

// ─── Types ───────────────────────────────────────────────────────

export interface ChartContext {
  symbol: string;
  timeframe: string;
  bars: { time: number; open: number; high: number; low: number; close: number; volume: number }[];
  indicators?: Record<string, number>;
}

export interface QueryResult {
  answer: string;
  data?: unknown;
  source: 'local' | 'ai';
}

// ─── Local Query Patterns ───────────────────────────────────────

const PRICE_QUERIES: [RegExp, string][] = [
  [/(?:what(?:'s| is) )?(?:the )?(?:current )?price/i, 'price'],
  [/(?:what(?:'s| is) )?(?:the )?(?:last|latest) close/i, 'close'],
  [/(?:what(?:'s| is) )?(?:the )?high (?:today|last|this)/i, 'high'],
  [/(?:what(?:'s| is) )?(?:the )?low (?:today|last|this)/i, 'low'],
  [/(?:what(?:'s| is) )?(?:the )?open/i, 'open'],
  [/(?:what(?:'s| is) )?(?:the )?volume/i, 'volume'],
];

const RANGE_QUERIES: [RegExp, string][] = [
  [/(?:highest|max|peak|all.?time high) (?:in |over )?(?:the )?(?:last )?(\d+)\s*(bar|candle|day|hour|min)/i, 'highest'],
  [/(?:lowest|min|bottom) (?:in |over )?(?:the )?(?:last )?(\d+)\s*(bar|candle|day|hour|min)/i, 'lowest'],
  [/average (?:price|close)?\s*(?:over|in|last)?\s*(\d+)/i, 'average'],
];

const COMPARISON_QUERIES: [RegExp, string][] = [
  [/(?:is|was) (?:it )?(?:above|over) \$?([\d,.]+)/i, 'above'],
  [/(?:is|was) (?:it )?(?:below|under) \$?([\d,.]+)/i, 'below'],
  [/(?:change|move|delta) (?:since|from|in)/i, 'change'],
];

// ─── Processor ──────────────────────────────────────────────────

class ChartQueryProcessor {
  /**
   * Process a natural language query about chart data.
   */
  async query(text: string, ctx: ChartContext): Promise<QueryResult> {
    const cleaned = text.trim();
    if (!cleaned || !ctx.bars?.length) {
      return { answer: 'No chart data available.', source: 'local' };
    }

    // Try local resolution first
    const local = this._tryLocal(cleaned, ctx);
    if (local) return local;

    // Route to AI for complex queries
    return this._routeToAI(cleaned, ctx);
  }

  private _tryLocal(text: string, ctx: ChartContext): QueryResult | null {
    const lastBar = ctx.bars[ctx.bars.length - 1];

    // Simple price queries
    for (const [pattern, type] of PRICE_QUERIES) {
      if (pattern.test(text)) {
        let value: number;
        switch (type) {
          case 'price':
          case 'close':
            value = lastBar.close;
            return { answer: `${ctx.symbol} last close: $${value.toFixed(2)}`, data: value, source: 'local' };
          case 'high':
            value = lastBar.high;
            return { answer: `${ctx.symbol} high: $${value.toFixed(2)}`, data: value, source: 'local' };
          case 'low':
            value = lastBar.low;
            return { answer: `${ctx.symbol} low: $${value.toFixed(2)}`, data: value, source: 'local' };
          case 'open':
            value = lastBar.open;
            return { answer: `${ctx.symbol} open: $${value.toFixed(2)}`, data: value, source: 'local' };
          case 'volume':
            value = lastBar.volume;
            return { answer: `${ctx.symbol} volume: ${this._fmtVol(value)}`, data: value, source: 'local' };
        }
      }
    }

    // Range queries
    for (const [pattern, type] of RANGE_QUERIES) {
      const match = text.match(pattern);
      if (match) {
        const n = parseInt(match[1], 10);
        const slice = ctx.bars.slice(-Math.min(n, ctx.bars.length));

        if (type === 'highest') {
          const val = Math.max(...slice.map(b => b.high));
          return { answer: `Highest in last ${n} bars: $${val.toFixed(2)}`, data: val, source: 'local' };
        }
        if (type === 'lowest') {
          const val = Math.min(...slice.map(b => b.low));
          return { answer: `Lowest in last ${n} bars: $${val.toFixed(2)}`, data: val, source: 'local' };
        }
        if (type === 'average') {
          const avg = slice.reduce((s, b) => s + b.close, 0) / slice.length;
          return { answer: `Average close over ${n} bars: $${avg.toFixed(2)}`, data: avg, source: 'local' };
        }
      }
    }

    // Comparison queries
    for (const [pattern, type] of COMPARISON_QUERIES) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const threshold = parseFloat(match[1].replace(/,/g, ''));
        const price = lastBar.close;

        if (type === 'above') {
          const ans = price > threshold;
          return { answer: `${ctx.symbol} at $${price.toFixed(2)} is ${ans ? 'YES, above' : 'NO, below'} $${threshold}`, data: ans, source: 'local' };
        }
        if (type === 'below') {
          const ans = price < threshold;
          return { answer: `${ctx.symbol} at $${price.toFixed(2)} is ${ans ? 'YES, below' : 'NO, above'} $${threshold}`, data: ans, source: 'local' };
        }
      }
    }

    return null;
  }

  private async _routeToAI(text: string, ctx: ChartContext): Promise<QueryResult> {
    const lastBars = ctx.bars.slice(-10);
    const barSummary = lastBars.map(b =>
      `${new Date(b.time).toLocaleDateString()} O:${b.open} H:${b.high} L:${b.low} C:${b.close} V:${b.volume}`
    ).join('\n');

    try {
      const { aiRouter } = await import('./AIRouter');
      const result = await aiRouter.route({
        type: 'chat',
        messages: [
          { role: 'system', content: `You are a chart analysis assistant for ${ctx.symbol} (${ctx.timeframe} timeframe). Answer concisely with specific numbers.` },
          { role: 'user', content: `Chart data (last 10 bars):\n${barSummary}\n\nQuestion: ${text}` },
        ],
        maxTokens: 150,
        temperature: 0.2,
      });
      return { answer: result.content, source: 'ai' };
    } catch {
      return { answer: 'Unable to process query. Try a simpler question.', source: 'local' };
    }
  }

  private _fmtVol(v: number): string {
    if (v >= 1e9) return (v / 1e9).toFixed(1) + 'B';
    if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
    if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
    return v.toString();
  }
}

// ─── Singleton ──────────────────────────────────────────────────

export const chartQueryProcessor = new ChartQueryProcessor();
export default chartQueryProcessor;
