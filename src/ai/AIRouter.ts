/* global require */
// ═══════════════════════════════════════════════════════════════════
// charEdge — AI Router (Sprint 1 rewrite)
//
// Central dispatch that classifies AI requests into capability tiers
// and routes to the best available backend. Handles automatic
// degradation when a tier is unavailable.
//
// Sprint 1: Smart L1 router with intent classification, trading
// knowledge base, chart context, DNA, and AdaptiveCoach formatting.
//
// Tiers:
//   L1 — Template/heuristic (TradingKnowledgeBase + intent) — instant
//   L2 — Feature classification (FeatureExtractor) — instant
//   L3 — In-browser LLM (WebLLM) — 1-5s, needs model
//   L4 — Cloud LLM (Gemini → Groq → LLMService) — 0.5-10s, needs key
//
// Usage:
//   import { aiRouter } from './AIRouter';
//   const result = await aiRouter.route({ type: 'chat', messages });
// ═══════════════════════════════════════════════════════════════════

import { logger } from '@/observability/logger.js';
import { webLLMProvider } from './WebLLMProvider';
import type { WebLLMMessage } from './WebLLMProvider';
import { geminiAdapter } from './GeminiAdapter';
import { groqAdapter } from './GroqAdapter';
import { conversationMemory } from './ConversationMemory';
import { classifyHybrid } from './IntentClassifier';
// Sprint 5 Task 5.1.1: Lazy-load TradingKnowledgeBase (151KB) — only when AI copilot needs it
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- TradingKnowledgeBase module type is complex and lazily loaded
let _tkbPromise: Promise<any> | null = null;
function getTKB() {
  if (!_tkbPromise) _tkbPromise = import('./TradingKnowledgeBase').then((m) => m.tradingKnowledgeBase);
  return _tkbPromise;
}
import { chartContextAnalyzer } from './ChartContextAnalyzer';
import type { ExtendedChartContext } from './ChartContextAnalyzer';
import { journalPatternDetector } from './JournalPatternDetector';
import { portfolioRiskAnalyzer } from './PortfolioRiskAnalyzer';
import { scannerEngine } from './ScannerEngine';
import { tradeGrader } from './TradeGrader';
import { tradeCardFormatter } from './TradeCardFormatter';
import { tfidfClassifier } from './IntentClassifier';

// ─── Types ──────────────────────────────────────────────────────

export type AITier = 'L1' | 'L2' | 'L3' | 'L4';

export type AIRequestType =
  | 'classify' // Quick classification → L1/L2
  | 'explain' // Natural language explanation → L3
  | 'analyze' // Deep analysis → L3/L4
  | 'coach' // Behavioral coaching → L3
  | 'narrate' // Market narrative → L3
  | 'grade' // Trade grading → L3
  | 'journal' // Journal enhancement → L3
  | 'chat' // Conversational → L3/L4/L1
  | 'complex'; // Long/complex reasoning → L4

export interface AIRequest {
  type: AIRequestType;
  messages: WebLLMMessage[];
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  signal?: AbortSignal; // Phase 2 Task #22: abort signal for cancellation
}

export interface AIResponse {
  content: string;
  tier: AITier;
  model: string;
  tokensUsed: number;
  latencyMs: number;
}

// ─── L1 Intent Classification ───────────────────────────────────

export type L1Intent =
  | 'educational'
  | 'chart_analysis'
  | 'coaching'
  | 'journal'
  | 'journal_search'
  | 'personal_model'
  | 'risk'
  | 'scanner'
  | 'trade_grade'
  | 'command'
  | 'greeting'
  | 'unknown';

const INTENT_PATTERNS: Array<{ intent: L1Intent; patterns: RegExp[] }> = [
  {
    intent: 'greeting',
    patterns: [
      /^(hi|hello|hey|sup|yo|what'?s up|howdy|greetings)\b/i,
      /^(good\s+(morning|afternoon|evening))/i,
      /^(help|what can you do|who are you|how do you work)/i,
    ],
  },
  {
    intent: 'educational',
    patterns: [
      /\b(?:what(?:'s|\s+is|\s+are|\s+does))\s+/i,
      /\b(?:how\s+(?:to\s+use|does|do|should\s+i\s+use|is))\s+/i,
      /\b(?:explain|describe|define|meaning\s+of|tell\s+me\s+about)\s+/i,
      /\b(?:difference\s+between)\s+/i,
      /\b(?:what\s+(?:is|are)\s+(?:a|an|the)\s+)/i,
    ],
  },
  {
    intent: 'chart_analysis',
    patterns: [
      /\b(?:analyze|analysis|what\s+do\s+you\s+see|chart|setup|pattern|signal)/i,
      /\b(?:should\s+i\s+(?:buy|sell|trade|enter|exit))/i,
      /\b(?:key\s+levels|support|resistance|target|breakout|breakdown)/i,
      /\b(?:bullish|bearish|neutral|trend|momentum)/i,
      /\b(?:overbought|oversold|divergence|squeeze)/i,
    ],
  },
  {
    intent: 'coaching',
    patterns: [
      /\b(?:how\s+(?:am\s+i|did\s+i|can\s+i)\s+(?:doing|improve|do\s+better))/i,
      /\b(?:my\s+(?:edge|weakness|strength|biggest\s+mistake|performance))/i,
      /\b(?:improve|suggestion|advice|tip|recommend)/i,
      /\b(?:overtrading|revenge|tilt|discipline|patience|emotional)/i,
      /\b(?:psychology|mindset|mental|confidence)/i,
    ],
  },
  {
    intent: 'trade_grade',
    patterns: [
      /\b(?:grade|score|rate)\s+(?:my|this|the|last)?\s*trade/i,
      /\b(?:how\s+was\s+my\s+(?:last\s+)?(?:trade|entry|exit))/i,
      /\b(?:trade\s+(?:grade|score|review|report\s*card))/i,
      /\b(?:review\s+(?:my|this|the|last)\s+(?:trade|entry))/i,
    ],
  },
  {
    intent: 'journal_search',
    patterns: [
      /\b(?:find|search|show|look\s+up|get)\s+(?:my\s+)?(?:.*?)\s*trades?/i,
      /\bjournal\s+(?:search|find|query|lookup)/i,
      /\b(?:winning|losing|profitable)\s+(?:.*?)\s*trades?/i,
      /\b(?:trades?\s+(?:on|for|with|in|from)\s+)/i,
    ],
  },
  {
    intent: 'journal',
    patterns: [
      /\b(?:my\s+trade|best\s+trade|worst\s+trade|last\s+trade|recent\s+trade)/i,
      /\b(?:win\s*rate|lose?\s*rate|strike\s*rate|p\s*[&/]\s*l|pnl|profit|loss)/i,
      /\b(?:trading\s+(?:history|record|log|stats|performance|results))/i,
      /\b(?:journal|logbook)/i,
      /\b(?:how\s+(?:did|am|was)\s+i\s+(?:do|doing|trade|trading))/i,
      /\b(?:this|last)\s+(?:week|month|day|session)/i,
    ],
  },
  {
    intent: 'command',
    patterns: [/^\//],
  },
  {
    intent: 'risk',
    patterns: [
      /\b(?:risk|exposure|how\s+much\s+am\s+i\s+risking|position\s+size|portfolio\s+risk)/i,
      /\b(?:at\s+risk|risk\s+dashboard|risk\s+management|open\s+risk)/i,
      /\b(?:my\s+(?:exposure|risk|positions?))/i,
      /\b(?:how\s+exposed|total\s+risk|risk\s+%)/i,
    ],
  },
  {
    intent: 'scanner',
    patterns: [
      /\b(?:scan|scanner|screener)/i,
      /\b(?:what\s+looks\s+good|any\s+(?:setups|opportunities|signals))/i,
      /\b(?:watchlist\s+(?:scan|analysis|signals|opportunities))/i,
      /\b(?:top\s+(?:picks|setups|movers|signals))/i,
    ],
  },
  {
    intent: 'personal_model',
    patterns: [
      /\b(?:train|retrain)\s+(?:my\s+)?model/i,
      /\b(?:score|predict|rate)\s+(?:this\s+)?setup/i,
      /\b(?:personal\s+(?:model|prediction|scorer))/i,
      /\b(?:win\s+probability|setup\s+score)/i,
    ],
  },
];

/**
 * Classify user intent from message text.
 * Phase 2 Task #20: Regex fast path → TF-IDF fallback.
 * Phase 2 Task #21: Returns confidence score.
 * Exported for testing.
 */
export function classifyIntent(text: string): { intent: L1Intent; confidence: number } {
  const trimmed = text.trim();

  // Fast path: regex patterns
  for (const { intent, patterns } of INTENT_PATTERNS) {
    for (const p of patterns) {
      if (p.test(trimmed)) return { intent, confidence: 0.95 };
    }
  }

  // TF-IDF fallback for queries that don't match any regex
  const tfidfResult = tfidfClassifier.classify(trimmed);
  if (tfidfResult.intent !== 'unknown' && tfidfResult.confidence >= 0.1) {
    return {
      intent: tfidfResult.intent as L1Intent,
      confidence: tfidfResult.confidence,
    };
  }

  return { intent: 'unknown', confidence: 0 };
}

// ─── Routing Table ──────────────────────────────────────────────

const TIER_MAP: Record<AIRequestType, AITier[]> = {
  classify: ['L1', 'L2'],
  explain: ['L3', 'L4', 'L1'],
  analyze: ['L3', 'L4', 'L1'],
  coach: ['L3', 'L4', 'L1'],
  narrate: ['L3', 'L4', 'L1'],
  grade: ['L3', 'L4', 'L1'],
  journal: ['L3', 'L4', 'L1'],
  chat: ['L3', 'L4', 'L1'], // Sprint 1: added L1 fallback
  complex: ['L4', 'L3'],
};

// ─── Router Class ───────────────────────────────────────────────

class AIRouter {
  /**
   * Determine which tier is best for this request type.
   */
  resolveTier(type: AIRequestType): AITier {
    const chain = TIER_MAP[type] || ['L1'];

    for (const tier of chain) {
      if (this._isTierAvailable(tier)) return tier;
    }

    // Ultimate fallback
    return 'L1';
  }

  /**
   * Route a request to the best available tier.
   */
  async route(request: AIRequest): Promise<AIResponse> {
    const tier = this.resolveTier(request.type);
    const start = performance.now();

    logger.ai?.debug?.(`[AIRouter] ${request.type} → ${tier}`);

    // Inject conversation context for contextual requests
    const contextTypes: AIRequestType[] = ['chat', 'coach', 'explain', 'analyze'];
    if (contextTypes.includes(request.type)) {
      const context = conversationMemory.getRecentContext(5);
      if (context.length > 0) {
        const contextStr = context.map((m) => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`).join('\n');
        // Prepend conversation context as a system message
        const sysIdx = request.messages.findIndex((m) => m.role === 'system');
        if (sysIdx >= 0) {
          const sysMsg = request.messages[sysIdx];
          if (sysMsg) {
            request.messages[sysIdx] = {
              role: sysMsg.role,
              content: sysMsg.content + `\n\n--- Conversation Context ---\n${contextStr}`,
            };
          }
        }
      }
    }

    // Store the user message
    const userMsg = request.messages.find((m) => m.role === 'user');
    if (userMsg) {
      conversationMemory
        .addMessage('user', userMsg.content, {
          requestType: request.type,
        })
        .catch(() => {
          /* non-critical */
        });
    }

    try {
      let result: AIResponse;
      switch (tier) {
        case 'L3':
          result = await this._routeL3(request, start);
          break;
        case 'L4':
          result = await this._routeL4(request, start);
          break;
        case 'L1':
        case 'L2':
        default:
          result = await this._routeL1(request, start);
          break;
      }

      // Store the AI response
      conversationMemory
        .addMessage('assistant', result.content, {
          requestType: request.type,
          tier: result.tier,
          model: result.model,
        })
        .catch(() => {
          /* non-critical */
        });

      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.ai?.error?.(`[AIRouter] ${tier} failed: ${msg}`);

      // Try degradation
      const chain = TIER_MAP[request.type] || ['L1'];
      const currentIdx = chain.indexOf(tier);
      for (let i = currentIdx + 1; i < chain.length; i++) {
        const fallbackTier = chain[i];
        if (this._isTierAvailable(fallbackTier)) {
          logger.ai?.info?.(`[AIRouter] Degrading to ${fallbackTier}`);
          return this._routeFallback(fallbackTier, request, start);
        }
      }

      // Last resort: L1 template
      return this._routeL1(request, start);
    }
  }

  /**
   * Stream a request (returns async generator).
   * Sprint 67-68: supports L3 (WebLLM) + L4 (Gemini/Groq) streaming.
   */
  async *stream(request: AIRequest): AsyncGenerator<string, AIResponse> {
    const tier = this.resolveTier(request.type);
    const start = performance.now();

    if (tier === 'L3' && webLLMProvider.isLoaded) {
      let tokensUsed = 0;
      for await (const token of webLLMProvider.streamChat(request.messages, request.maxTokens, request.temperature)) {
        tokensUsed++;
        yield token;
      }
      return {
        content: '',
        tier: 'L3',
        model: webLLMProvider.status.modelId || 'webllm',
        tokensUsed,
        latencyMs: performance.now() - start,
      };
    }

    // L4 streaming: try Gemini → Groq
    if (tier === 'L4') {
      try {
        if (geminiAdapter.isAvailable) {
          let tokensUsed = 0;
          for await (const token of geminiAdapter.stream(request.messages, {
            maxTokens: request.maxTokens,
            temperature: request.temperature,
          })) {
            tokensUsed++;
            yield token;
          }
          return {
            content: '',
            tier: 'L4',
            model: geminiAdapter.model,
            tokensUsed,
            latencyMs: performance.now() - start,
          };
        }
        if (groqAdapter.isAvailable) {
          let tokensUsed = 0;
          for await (const token of groqAdapter.stream(request.messages, {
            maxTokens: request.maxTokens,
            temperature: request.temperature,
          })) {
            tokensUsed++;
            yield token;
          }
          return {
            content: '',
            tier: 'L4',
            model: groqAdapter.model,
            tokensUsed,
            latencyMs: performance.now() - start,
          };
        }
      } catch {
        /* fall through to non-streaming */
      }
    }

    // Non-streaming fallback (includes L1)
    const result = await this._routeL1(request, start);
    yield result.content;
    return result;
  }

  // ─── Tier Availability ──────────────────────────────────────

  private _isTierAvailable(tier: AITier): boolean {
    switch (tier) {
      case 'L1':
      case 'L2':
        return true; // Always available
      case 'L3':
        return webLLMProvider.isLoaded;
      case 'L4':
        return this._isCloudAvailable();
      default:
        return false;
    }
  }

  private _isCloudAvailable(): boolean {
    // Sprint 67-68: Gemini/Groq free tier adapters count as cloud availability
    if (geminiAdapter.isAvailable || groqAdapter.isAvailable) return true;
    try {
      const env = typeof import.meta !== 'undefined' ? import.meta.env : {};
      return env?.VITE_LLM_ENABLED === 'true' || !!env?.VITE_LLM_PROVIDER;
    } catch {
      return false;
    }
  }

  /**
   * Get current tier availability for UI display.
   */
  getAvailability(): Record<AITier, boolean> {
    return {
      L1: true,
      L2: true,
      L3: webLLMProvider.isLoaded,
      L4: this._isCloudAvailable(),
    };
  }

  // ─── Route Implementations ────────────────────────────────

  /**
   * Sprint 1: Smart L1 router with intent classification.
   * No more echoes — returns genuinely useful template responses.
   */
  private async _routeL1(request: AIRequest, start: number): Promise<AIResponse> {
    const userMsg = request.messages.find((m) => m.role === 'user')?.content || '';
    const sysMsg = request.messages.find((m) => m.role === 'system')?.content || '';
    const { intent, confidence } = await classifyHybrid(userMsg);

    let content: string;

    // Phase 2 Task #21: Ask for clarification on low confidence
    if (intent !== 'unknown' && intent !== 'greeting' && confidence < 0.4 && confidence > 0) {
      const suggestions = this._getSuggestionsForIntent(intent);
      content =
        `I think you might be asking about **${intent.replace(/_/g, ' ')}**, but I'm not sure.\n\n` +
        `Did you mean one of these?\n${suggestions}\n\n` +
        `You can also try rephrasing your question, or type **/help** to see all available commands.`;
    } else {
      switch (intent) {
        case 'educational':
          content = await this._handleEducational(userMsg);
          break;
        case 'chart_analysis':
          content = await this._handleChartAnalysis(userMsg, sysMsg);
          break;
        case 'coaching':
          content = this._handleCoaching(userMsg, sysMsg);
          break;
        case 'journal':
          content = this._handleJournal(userMsg, sysMsg);
          break;
        case 'greeting':
          content = this._handleGreeting();
          break;
        case 'risk':
          content = this._handleRisk();
          break;
        case 'scanner':
          content = this._handleScanner();
          break;
        case 'trade_grade':
          content = this._handleTradeGrade();
          break;
        case 'journal_search':
          content = await this._handleJournalSearch(userMsg);
          break;
        case 'personal_model':
          content = await this._handlePersonalModel(userMsg);
          break;
        case 'command':
          content = "Type your command and I'll handle it. Use **/help** to see all available commands.";
          break;
        case 'unknown':
        default:
          content = await this._handleUnknown(userMsg, sysMsg);
          break;
      }
    }

    return {
      content,
      tier: 'L1',
      model: 'template-v1',
      tokensUsed: 0,
      latencyMs: performance.now() - start,
    };
  }

  // ─── L1 Intent Handlers ────────────────────────────────────

  private async _handleEducational(query: string): Promise<string> {
    const tkb = await getTKB();
    const result = tkb.lookup(query);
    if (result && result.score >= 0.3) {
      return tkb.formatForCopilot(result.entry);
    }

    // Partial match — suggest related topics
    const related = tkb.search(query, 3);
    const firstRelated = related[0];
    if (related.length > 0 && firstRelated && firstRelated.score >= 0.15) {
      const suggestions = related.map((r) => `• **${r.entry.name}**`).join('\n');
      return `I'm not sure about that exact topic, but here are some related concepts:\n\n${suggestions}\n\nAsk about any of these for a detailed explanation.`;
    }

    return "I don't have a built-in answer for that topic yet. Try asking about common trading concepts like RSI, MACD, support/resistance, position sizing, or candlestick patterns.\n\nFor more advanced questions, download an AI model in **Settings → Intelligence** for deeper analysis.";
  }

  private async _handleChartAnalysis(query: string, systemContext: string): Promise<string> {
    // Sprint 32: Detect chart pattern keywords for ChartQueryProcessor
    const PATTERN_KEYWORDS =
      /\b(double\s+top|double\s+bottom|head\s+and\s+shoulders|triangle|wedge|flag|pennant|channel|breakout|breakdown|support|resistance|trend\s*line|cup\s+and\s+handle)\b/i;
    const patternMatch = query.match(PATTERN_KEYWORDS);

    // Sprint 46: Detect multi-timeframe confluence keywords
    const MTF_KEYWORDS =
      /\b(aligned|confluence|multi.?time\s*frame|timeframes|across\s+(?:1h|4h|daily|weekly)|all\s+time\s*frames)\b/i;
    const mtfMatch = query.match(MTF_KEYWORDS);

    // Extract chart context from system message if available
    const chartMatch = systemContext.match(/--- Current Chart: (.+?) ---/);
    const rsiMatch = systemContext.match(/RSI:\s*([\d.]+)/);
    const regimeMatch = systemContext.match(/Regime:\s*(\w+)/);
    const priceMatch = systemContext.match(/Price:\s*\$?([\d,.]+)/);
    const ema20Match = systemContext.match(/20 EMA:\s*\$?([\d,.]+)/);
    const ema50Match = systemContext.match(/50 EMA:\s*\$?([\d,.]+)/);
    const ema200Match = systemContext.match(/200 EMA:\s*\$?([\d,.]+)/);
    const volumeMatch = systemContext.match(/Volume:\s*(\w+)/);
    const emaSpreadMatch = systemContext.match(/EMA Spread:\s*([\d.-]+)/);

    if (chartMatch && chartMatch[1]) {
      const [symbol = '', timeframe = '1H'] = chartMatch[1].split(/\s+/);
      const price = priceMatch?.[1] ? parseFloat(priceMatch[1].replace(/,/g, '')) : 0;

      // Sprint 46: Multi-timeframe confluence
      if (mtfMatch) {
        try {
          const { mtfConfluence } = await import('./MTFConfluence');
          const confluenceText = mtfConfluence.getConfluenceForAI({});
          if (confluenceText) {
            return `📊 **Multi-Timeframe Confluence: ${symbol || chartMatch[1]}**\n\n${confluenceText}`;
          }
        } catch {
          /* fall through */
        }
      }

      // Sprint 32: If pattern detected, use ChartQueryProcessor for rich answer
      if (patternMatch) {
        try {
          const { chartQueryProcessor } = await import('./ChartQueryProcessor');
          const result = await chartQueryProcessor.query(query, {
            symbol: symbol || chartMatch[1],
            timeframe: timeframe || '1H',
            bars: [], // No bar data in L1 context, processor will route to AI
            indicators: {
              rsi: rsiMatch?.[1] ? parseFloat(rsiMatch[1]) : 0,
              price,
            },
          });
          if (result.answer) {
            return `📊 **Pattern Analysis: ${patternMatch[1]}**\n\n${result.answer}`;
          }
        } catch {
          /* fall through to general analysis */
        }
      }

      // Build extended context for analyzer
      const ctx: ExtendedChartContext = {
        symbol: symbol || chartMatch[1],
        timeframe: timeframe || '1H',
        price,
        rsi: rsiMatch?.[1] ? parseFloat(rsiMatch[1]) : undefined,
        regime: regimeMatch?.[1] || undefined,
        ema20: ema20Match?.[1] ? parseFloat(ema20Match[1].replace(/,/g, '')) : undefined,
        ema50: ema50Match?.[1] ? parseFloat(ema50Match[1].replace(/,/g, '')) : undefined,
        ema200: ema200Match?.[1] ? parseFloat(ema200Match[1].replace(/,/g, '')) : undefined,
        volume: volumeMatch?.[1] || undefined,
        emaSpread: emaSpreadMatch?.[1] ? parseFloat(emaSpreadMatch[1]) : undefined,
      };

      // Sprint 21: Use ChartContextAnalyzer for structured analysis
      const analysis = chartContextAnalyzer.analyze(ctx);
      const parts: string[] = [analysis.summary];

      // Inject DNA if available
      const dnaContext = this._getDNA();
      if (dnaContext) {
        parts.push('');
        parts.push(`*Personalized for your trading style: ${dnaContext}*`);
      }

      if (analysis.confluenceScore < 4) {
        parts.push('');
        parts.push(
          'For deeper AI-powered analysis with pattern detection and trade recommendations, download an AI model in **Settings → Intelligence**.',
        );
      }

      return parts.join('\n');
    }

    return "I can see you're asking about chart analysis. Open a chart and I'll have more context to work with — I can see the current symbol, price, indicators, and market regime.\n\nFor full AI-powered analysis, download a model in **Settings → Intelligence**.";
  }

  private _handleCoaching(query: string, systemContext: string): string {
    const parts: string[] = [];

    // Try to get AdaptiveCoach formatting
    try {
      const { adaptiveCoach } = require('./AdaptiveCoach');

      // Determine coaching category from query
      const category = this._detectCoachingCategory(query);
      const dna = this._getDNA();
      if (dna) {
        parts.push(`*Based on your trading profile: ${dna}*\n`);
      }

      const baseMessage = this._getCoachingTemplate(query, systemContext);
      const formatted = adaptiveCoach.formatMessage(baseMessage, category);
      parts.push(formatted);

      // Sprint 22: Enrich with pattern insights if available
      try {
        const { default: useJournalStore } = require('@/state/useJournalStore');
        const trades = useJournalStore.getState().trades || [];
        if (trades.length >= 10) {
          const analysis = journalPatternDetector.analyze(trades);
          const warnings = analysis.patterns.filter((p) => p.severity === 'warning' || p.severity === 'critical');
          if (warnings.length > 0) {
            parts.push('\n\n**From your journal data:**');
            for (const w of warnings.slice(0, 2)) {
              parts.push(`\n• ${w.description}`);
            }
          }
        }
      } catch {
        /* journal not available */
      }
    } catch {
      // AdaptiveCoach not available, use raw template
      parts.push(this._getCoachingTemplate(query, systemContext));
    }

    parts.push('\n\nFor personalized coaching powered by AI, download a model in **Settings → Intelligence**.');
    return parts.join('');
  }

  private _handleJournal(_query: string, systemContext: string): string {
    const parts: string[] = [];

    // Sprint 22: Try structured pattern analysis from journal store
    try {
      const { default: useJournalStore } = require('@/state/useJournalStore');
      const trades = useJournalStore.getState().trades || [];

      if (trades.length > 0) {
        const patterns = journalPatternDetector.analyze(trades);
        parts.push(patterns.summary);

        const dna = this._getDNA();
        if (dna) {
          parts.push('');
          parts.push(`*Your profile: ${dna}*`);
        }

        parts.push(
          '\nFor deeper AI-powered analysis and pattern detection, download a model in **Settings → Intelligence**.',
        );
        return parts.join('\n');
      }
    } catch {
      // Journal store not available — fall through to template
    }

    // Fallback: Check for trade data in system context
    const tradesMatch = systemContext.match(/--- Recent Trades \((\d+)\) ---/);
    if (tradesMatch) {
      const count = tradesMatch[1];
      parts.push(`📓 **Journal Summary** (${count} recent trades)\n`);

      const tradeLines = systemContext
        .split('\n')
        .filter((l) => /^\d+\./.test(l.trim()))
        .slice(0, 5);

      if (tradeLines.length > 0) {
        parts.push(tradeLines.join('\n'));
        parts.push('');
      }
    }

    const dna = this._getDNA();
    if (dna) {
      parts.push(`*Your profile: ${dna}*\n`);
    }

    parts.push(
      'For detailed trade analysis, pattern detection, and AI-powered journal insights, download a model in **Settings → Intelligence**.',
    );

    return parts.join('\n');
  }

  // ── Sprint 23: Risk Dashboard ──────────────────────────────

  // ── Sprint 31: Journal Search ───────────────────────────────

  private async _handleJournalSearch(query: string): Promise<string> {
    try {
      const { journalRAG } = await import('./JournalRAG');
      const { default: useJournalStore } = await import('@/state/useJournalStore');

      const store = useJournalStore as unknown as { getState: () => Record<string, unknown> };
      const trades = (store.getState().trades || []) as Record<string, unknown>[];
      if (trades.length === 0) {
        return '📓 No trades found in your journal yet. Start logging trades to use journal search!';
      }

      // Ensure trades are indexed
      await journalRAG.indexAllTrades(trades);

      // Semantic search
      const ragContext = await journalRAG.getContextForPrompt(query, 5);
      if (!ragContext) {
        return `📓 No trades matching "${query}" found. Try a different search term.`;
      }

      // Try to find matching trade objects for card formatting
      const matchedTrades = trades
        .filter((t: Record<string, unknown>) => {
          const content = `${t.symbol || ''} ${t.side || ''} ${t.setup || ''} ${t.notes || ''}`.toLowerCase();
          const queryTerms = query
            .toLowerCase()
            .split(/\s+/)
            .filter((w: string) => w.length > 2);
          return queryTerms.some((term: string) => content.includes(term));
        })
        .slice(0, 5);

      if (matchedTrades.length > 0) {
        return tradeCardFormatter.formatSearchResults(
          query,
          matchedTrades as unknown as import('./TradeCardFormatter').TradeForCard[],
        );
      }

      // Fallback: return RAG context as markdown
      return `📓 **Journal Search:** "${query}"\n\n${ragContext}`;
    } catch {
      return '📓 Journal search is not available right now. Try again later.';
    }
  }

  // Sprint 44: Personal model training / prediction
  private async _handlePersonalModel(query: string): Promise<string> {
    const isTrainRequest = /\b(?:train|retrain|build|create)\s/i.test(query);

    try {
      const { personalModelTrainer } = await import('./PersonalModelTrainer');

      if (isTrainRequest) {
        // Training request
        if (personalModelTrainer.isTraining) {
          return '⏳ Model training is already in progress. Please wait for it to finish.';
        }

        const { default: useJournalStore } = await import('@/state/useJournalStore');
        const store = useJournalStore as unknown as { getState: () => Record<string, unknown> };
        const trades = (store.getState().trades || []) as Record<string, unknown>[];

        if (trades.length < 20) {
          return `🧠 Need at least **20 trades** to train your personal model. You have ${trades.length} trades currently. Keep journaling!`;
        }

        const result = await personalModelTrainer.train(trades);
        return (
          `🧠 **Personal Model Trained!**\n\n` +
          `- **Trades Used:** ${result.sampleSize}\n` +
          `- **Accuracy:** ${result.accuracy}%\n` +
          `- **Loss:** ${result.finalLoss}\n` +
          `- **Epochs:** ${result.epochs}\n\n` +
          `Your model is ready. Ask me to "score this setup" for predictions.`
        );
      }

      // Prediction request
      const prediction = await personalModelTrainer.predict({});
      const emoji = prediction.signal === 'green' ? '🟢' : prediction.signal === 'red' ? '🔴' : '🟡';

      return (
        `🧠 **Setup Score**\n\n` +
        `${emoji} **Win Probability:** ${Math.round(prediction.winProbability * 100)}%\n` +
        `**Confidence:** ${prediction.confidence}%\n` +
        `**Signal:** ${prediction.signal.toUpperCase()}\n\n` +
        (prediction.confidence < 30
          ? '_Low confidence — consider training with more trades._'
          : '_Based on your trading history pattern._')
      );
    } catch (e: unknown) {
      if (e instanceof Error && e.message?.includes('at least 20')) {
        return `🧠 ${e.message}`;
      }
      return '🧠 Personal model is not available yet. Make sure you have enough trades and try "train my model" first.';
    }
  }

  private _handleRisk(): string {
    try {
      const { default: useJournalStore } = require('@/state/useJournalStore');
      const trades = useJournalStore.getState().trades || [];
      const analysis = portfolioRiskAnalyzer.analyze(trades);

      const parts: string[] = [analysis.summary];
      const dna = this._getDNA();
      if (dna) {
        parts.push('');
        parts.push(`*${dna}*`);
      }
      return parts.join('\n');
    } catch {
      return portfolioRiskAnalyzer.analyze([]).summary;
    }
  }

  // ── Sprint 24: Scanner Responses ───────────────────────────

  private _handleScanner(): string {
    const scanSummary = scannerEngine.getScanSummaryForAI();

    if (scanSummary) {
      const parts: string[] = [];
      parts.push('**📡 Watchlist Scan Results**\n');
      parts.push(scanSummary);

      const dna = this._getDNA();
      if (dna) {
        parts.push('');
        parts.push(`*Filtered for your style: ${dna}*`);
      }

      parts.push('\nRun **/scan** to refresh results with latest data.');
      return parts.join('\n');
    }

    return '📡 **No scan results yet.**\n\nRun **/scan** to analyze your watchlist for opportunities. The scanner checks momentum, volume, regime, and signals across all your watched symbols.\n\nYou can also ask "What looks good?" after running a scan.';
  }

  // ── Sprint 25: Trade Grading ───────────────────────────────

  private _handleTradeGrade(): string {
    try {
      const { default: useJournalStore } = require('@/state/useJournalStore');
      const trades = useJournalStore.getState().trades || [];

      // Find most recent closed trade
      const closed = trades
        .filter((t: Record<string, unknown>) => typeof t.pnl === 'number' && !isNaN(t.pnl as number))
        .sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
          const dateA = new Date(String(a.exitDate || a.entryDate || a.date || 0)).getTime();
          const dateB = new Date(String(b.exitDate || b.entryDate || b.date || 0)).getTime();
          return dateB - dateA;
        });

      const lastTrade = closed[0];
      if (!lastTrade) {
        return "📝 **No closed trades to grade.**\n\nClose a trade and ask me to grade it — I'll analyze your entry, exit, and risk management with a letter grade (A+ through F).";
      }

      const grade = tradeGrader.grade(lastTrade, trades);

      const parts: string[] = [grade.summary];
      const dna = this._getDNA();
      if (dna) {
        parts.push('');
        parts.push(`*${dna}*`);
      }
      return parts.join('\n');
    } catch {
      return '📝 **Trade grading unavailable.**\n\nI need access to your journal to grade trades. Make sure you have trades logged.';
    }
  }

  private _handleGreeting(): string {
    const dna = this._getDNA();
    const personalNote = dna ? `\n\n*${dna}*` : '';

    return (
      `👋 Hey! I'm your trading copilot. Here's what I can help with:\n\n` +
      `• **Ask questions** — "What is RSI?" or "How does position sizing work?"\n` +
      `• **Chart analysis** — Open a chart and ask "What do you see?"\n` +
      `• **Trade review** — "How did I do this week?" or "Best trade?"\n` +
      `• **Commands** — Type **/help** to see all slash commands\n` +
      `\nI work offline with instant template responses. For deeper AI analysis, download a model in **Settings → Intelligence**.${personalNote}`
    );
  }

  private async _handleUnknown(query: string, systemContext: string): Promise<string> {
    // Try knowledge base as a last resort
    const tkb = await getTKB();
    const kbResult = tkb.lookup(query);
    if (kbResult && kbResult.score >= 0.4) {
      return tkb.formatForCopilot(kbResult.entry);
    }

    // Check if we have chart context to provide something useful
    const chartMatch = systemContext.match(/--- Current Chart: (.+?) ---/);
    if (chartMatch) {
      return (
        `I can see you're viewing **${chartMatch[1]}**. I can help with:\n\n` +
        `• Chart analysis — "What do you see?"\n` +
        `• Trading concepts — "What is RSI?"\n` +
        `• Trade review — "How did I do?"\n` +
        `• Commands — **/scan**, **/dna**, **/risk**\n\n` +
        `For advanced conversations, download an AI model in **Settings → Intelligence**.`
      );
    }

    return (
      `I can answer trading questions, analyze charts, review your journal, and more.\n\n` +
      `Try asking:\n` +
      `• "What is MACD?"\n` +
      `• "How should I size my positions?"\n` +
      `• "Show me my best trade"\n` +
      `• **/help** for all commands\n\n` +
      `For deeper AI conversations, download a model in **Settings → Intelligence**.`
    );
  }

  // ─── L1 Helpers ────────────────────────────────────────────

  private _getDNA(): string {
    try {
      // Dynamic import to avoid circular deps at module level

      const { traderDNA } = require('./TraderDNA');
      const dna = traderDNA.getDNAForPrompt();
      if (dna && dna.length > 10) {
        // Extract the archetype summary line (first line)
        const firstLine = dna.split('\n')[0] || dna.slice(0, 100);
        return firstLine;
      }
    } catch {
      /* not available */
    }
    return '';
  }

  private _detectCoachingCategory(
    query: string,
  ): 'risk' | 'psychology' | 'timing' | 'performance' | 'improvement' | 'tilt' | 'overtrading' {
    const q = query.toLowerCase();
    if (/tilt|emotional|anger|frustrat/i.test(q)) return 'tilt';
    if (/overtrad|too many|bored|addic/i.test(q)) return 'overtrading';
    if (/revenge|get back|recover loss/i.test(q)) return 'psychology';
    if (/risk|stop loss|position size|exposure/i.test(q)) return 'risk';
    if (/timing|entry|exit|when to/i.test(q)) return 'timing';
    if (/performance|results|stats|record/i.test(q)) return 'performance';
    return 'improvement';
  }

  // Phase 2 Task #21: Suggestion builder for low-confidence classification
  private _getSuggestionsForIntent(intent: L1Intent): string {
    const map: Partial<Record<L1Intent, string[]>> = {
      educational: ['"What is RSI?"', '"Explain MACD"', '"How does position sizing work?"'],
      chart_analysis: ['"Analyze the chart"', '"What do you see?"', '"Is this bullish?"'],
      coaching: ['"How can I improve?"', '"Am I overtrading?"', '"Trading psychology tips"'],
      journal: ['"How did I do this week?"', '"Show my stats"', '"Best trade this month"'],
      risk: ['"What\'s my risk?"', '"Portfolio exposure"', '"Position size calculator"'],
      scanner: ['"Scan my watchlist"', '"Any setups today?"', '"What looks good?"'],
      trade_grade: ['"Grade my last trade"', '"Trade report card"', '"Review my entry"'],
      journal_search: ['"Find my BTC trades"', '"Search for winning trades"', '"Show breakout trades"'],
    };
    const suggestions = map[intent] || ['Try rephrasing your question.'];
    return suggestions.map((s) => `• ${s}`).join('\n');
  }

  private _getCoachingTemplate(query: string, _systemContext: string): string {
    const q = query.toLowerCase();

    if (/overtrad/i.test(q)) {
      return 'Overtrading is often driven by boredom or the need to be "active." Quality setups are rare — most of your time should be spent watching, not trading. Set a maximum trade count per day and review which trades were A+ setups vs. filler.';
    }
    if (/revenge|get back/i.test(q)) {
      return 'Revenge trading is the #1 account killer. After a loss or losing streak, the emotional need to "get it back" leads to larger sizes and worse decisions. Set a daily loss limit and take a mandatory break when you hit it.';
    }
    if (/tilt|emotional/i.test(q)) {
      return 'When you feel tilted, your decision-making is compromised. Step away from the screen. No trade is better than a tilt trade. Create a "tilt protocol": close all positions, walk away for 30 minutes, return only if you feel calm.';
    }
    if (/improve|better|suggestion/i.test(q)) {
      return 'The best way to improve is to review your journal data. Look for patterns: which setups have the highest win rate? What time of day do you trade best? Where do your largest losses come from? The data will reveal your next improvement.';
    }
    if (/edge|strength|best at/i.test(q)) {
      return 'Your edge is hidden in your trade data. Look at your win rate by setup type, time of day, and market condition. Most traders find they have one or two setups that produce 80% of their profits. Focus on those.';
    }

    return 'Good trading comes from consistent process, not perfect prediction. Focus on your pre-trade checklist, position sizing, and post-trade review. Small improvements compound over time.';
  }

  // ─── L3/L4/Fallback Routes ─────────────────────────────────

  private async _routeL3(request: AIRequest, start: number): Promise<AIResponse> {
    const result = await webLLMProvider.chat(request.messages, request.maxTokens || 512, request.temperature ?? 0.3);

    return {
      content: result.content,
      tier: 'L3',
      model: webLLMProvider.status.modelId || 'webllm',
      tokensUsed: result.tokensUsed,
      latencyMs: performance.now() - start,
    };
  }

  private async _routeL4(request: AIRequest, start: number): Promise<AIResponse> {
    const speedCritical = request.type === 'chat' || request.type === 'grade';

    if (speedCritical && groqAdapter.isAvailable) {
      try {
        const result = await groqAdapter.chat(request.messages, {
          maxTokens: request.maxTokens,
          temperature: request.temperature,
        });
        return {
          content: result.content,
          tier: 'L4',
          model: result.model,
          tokensUsed: result.tokensUsed,
          latencyMs: performance.now() - start,
        };
      } catch {
        /* fall through */
      }
    }

    if (geminiAdapter.isAvailable) {
      try {
        const result = await geminiAdapter.chat(request.messages, {
          maxTokens: request.maxTokens,
          temperature: request.temperature,
        });
        return {
          content: result.content,
          tier: 'L4',
          model: result.model,
          tokensUsed: result.tokensUsed,
          latencyMs: performance.now() - start,
        };
      } catch {
        /* fall through */
      }
    }

    if (!speedCritical && groqAdapter.isAvailable) {
      try {
        const result = await groqAdapter.chat(request.messages, {
          maxTokens: request.maxTokens,
          temperature: request.temperature,
        });
        return {
          content: result.content,
          tier: 'L4',
          model: result.model,
          tokensUsed: result.tokensUsed,
          latencyMs: performance.now() - start,
        };
      } catch {
        /* fall through */
      }
    }

    const { llmService } = await import('./LLMService.js');
    if (!llmService.isAvailable) {
      throw new Error('No cloud LLM available (Gemini, Groq, or LLMService)');
    }
    const response = await llmService.chatDirect(request.messages);
    return {
      content: response.content,
      tier: 'L4',
      model: response.model,
      tokensUsed: response.tokensUsed,
      latencyMs: performance.now() - start,
    };
  }

  private async _routeFallback(tier: AITier, request: AIRequest, start: number): Promise<AIResponse> {
    switch (tier) {
      case 'L3':
        return this._routeL3(request, start);
      case 'L4':
        return this._routeL4(request, start);
      default:
        return this._routeL1(request, start);
    }
  }
}

// ─── Singleton ──────────────────────────────────────────────────

export const aiRouter = new AIRouter();
export default aiRouter;
