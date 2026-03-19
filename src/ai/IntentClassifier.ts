// ═══════════════════════════════════════════════════════════════════
// charEdge — TF-IDF Intent Classifier (Phase 2 Tasks #20-21)
//
// Upgrades the regex-only intent classifier with TF-IDF cosine
// similarity matching. Each intent has 15-25 training examples.
// At runtime: tokenize → TF-IDF → cosine sim → best intent.
//
// Regex patterns remain as a fast-path first pass; TF-IDF fires
// only when regex returns 'unknown'.
//
// Usage:
//   import { tfidfClassifier } from './IntentClassifier';
//   const { intent, confidence } = tfidfClassifier.classify('how am I doing this week');
// ═══════════════════════════════════════════════════════════════════

// ─── Types ───────────────────────────────────────────────────────

export type IntentLabel =
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

export interface ClassificationResult {
  intent: IntentLabel;
  confidence: number;  // 0-1
  secondBest?: { intent: IntentLabel; confidence: number } | undefined;
}

// ─── Training Data ──────────────────────────────────────────────

const TRAINING_DATA: Record<IntentLabel, string[]> = {
  educational: [
    'what is rsi', 'explain bollinger bands', 'how does macd work',
    'tell me about support and resistance', 'what are fibonacci retracements',
    'define stop loss', 'how to use moving averages', 'what is position sizing',
    'explain candlestick patterns', 'difference between limit and market order',
    'what does overbought mean', 'how does volume analysis work',
    'explain divergence in trading', 'what is an ema', 'what is vwap',
    'how do i read a chart', 'explain trend following', 'what is liquidity',
    'teach me about risk reward', 'explain market structure',
    'what is a doji', 'how does atr work', 'what are order blocks',
    'explain fair value gap', 'what is wyckoff method',
  ],

  chart_analysis: [
    'what do you see on the chart', 'analyze this chart', 'is this a good setup',
    'should i buy here', 'should i sell now', 'what is the trend',
    'where is support', 'where is resistance', 'is this bullish or bearish',
    'key levels for btc', 'what pattern do you see', 'is this a breakout',
    'any signals on this chart', 'chart looks like a head and shoulders',
    'is momentum building', 'whats the target price', 'entry point suggestion',
    'what does the setup look like', 'double top forming',
    'is this overbought', 'is this oversold', 'price action analysis',
    'read the chart for me', 'technical analysis please',
  ],

  coaching: [
    'how am i doing', 'how can i improve', 'what am i doing wrong',
    'give me advice', 'trading tips', 'how to be a better trader',
    'whats my biggest weakness', 'am i overtrading', 'help me with discipline',
    'i keep losing money', 'suggestions for improvement',
    'how to manage emotions', 'i feel tilted', 'im on a losing streak',
    'how to handle revenge trading', 'mindset tips', 'trading psychology help',
    'why do i keep making the same mistakes', 'confidence issues',
    'how to stay patient', 'how to cut losses faster',
    'my edge seems to be disappearing', 'performance review',
    'what should i focus on', 'tell me my strengths',
  ],

  journal: [
    'how did i do this week', 'my trading performance', 'show my stats',
    'whats my win rate', 'best trade this month', 'worst trade recently',
    'pnl summary', 'trading history', 'how was last week',
    'show me my trades', 'journal summary', 'trading record',
    'how am i doing this month', 'performance this year',
    'what was my biggest win', 'biggest loss', 'profit and loss report',
    'my trading results', 'session review', 'daily recap',
    'how many trades did i take today', 'average win versus average loss',
    'trade log', 'my logbook',
  ],

  journal_search: [
    'find my btc trades', 'search for winning trades on spy',
    'show me trades from last month', 'look up breakout trades',
    'find trades where i felt confident', 'search journal for revenge trades',
    'get my apple trades', 'find losing trades from january',
    'search for trades with high risk reward',
    'show me all my eth trades', 'find trades on friday',
    'lookup morning session trades', 'find scalp trades',
    'search for trades i tagged as a setup', 'get all swing trades',
  ],

  personal_model: [
    'train my model', 'retrain the model', 'build my personal model',
    'score this setup', 'predict win probability', 'rate this trade setup',
    'what are my chances of winning this trade', 'personal prediction',
    'setup scoring', 'model accuracy', 'personal model stats',
    'win probability for this entry', 'how likely am i to win this',
  ],

  risk: [
    'whats my risk', 'risk assessment', 'how much am i risking',
    'position size calculator', 'portfolio risk', 'exposure report',
    'am i risking too much', 'total open risk', 'risk dashboard',
    'how exposed am i', 'risk management check', 'risk analysis',
    'my current exposure', 'position sizes', 'portfolio health',
  ],

  scanner: [
    'scan my watchlist', 'any setups today', 'what looks good',
    'top picks', 'opportunities right now', 'scanner results',
    'market scan', 'watchlist analysis', 'best setups today',
    'any signals', 'screener results', 'whats moving',
    'momentum stocks', 'strong setups', 'scan for breakouts',
  ],

  trade_grade: [
    'grade my last trade', 'score my trade', 'rate this trade',
    'how was my last entry', 'trade report card', 'review my trade',
    'grade entry and exit', 'trade score', 'how did my last trade go',
    'evaluate my trade', 'was that a good trade', 'trade review',
    'give me a grade', 'letter grade for this trade',
  ],

  greeting: [
    'hello', 'hi', 'hey', 'whats up', 'good morning', 'good evening',
    'who are you', 'what can you do', 'help', 'how do you work',
    'howdy', 'yo', 'greetings', 'sup',
  ],

  command: [
    '/help', '/scan', '/dna', '/risk', '/journal', '/review',
  ],

  unknown: [], // No training data for unknown
};

// ─── TF-IDF Engine ──────────────────────────────────────────────

interface IntentVector {
  intent: IntentLabel;
  tfidf: Map<string, number>;
  magnitude: number;
}

class TFIDFIntentClassifier {
  private _intentVectors: IntentVector[] = [];
  private _idf: Map<string, number> = new Map();
  private _initialized = false;

  /**
   * Classify text into an intent with confidence score.
   */
  classify(text: string): ClassificationResult {
    if (!this._initialized) this._buildIndex();

    const tokens = _tokenize(text);
    if (tokens.length === 0) return { intent: 'unknown', confidence: 0 };

    // Commands are trivial
    if (text.trim().startsWith('/')) return { intent: 'command', confidence: 1.0 };

    // Build query TF-IDF vector
    const queryTF = _computeTF(tokens);
    const queryTFIDF = new Map<string, number>();
    let queryMag = 0;

    for (const [term, tf] of queryTF) {
      const idf = this._idf.get(term) || 0;
      const val = tf * idf;
      queryTFIDF.set(term, val);
      queryMag += val * val;
    }
    queryMag = Math.sqrt(queryMag);

    if (queryMag === 0) return { intent: 'unknown', confidence: 0 };

    // Cosine similarity against all intent vectors
    const scores: Array<{ intent: IntentLabel; score: number }> = [];

    for (const iv of this._intentVectors) {
      let dot = 0;
      for (const [term, val] of queryTFIDF) {
        dot += val * (iv.tfidf.get(term) || 0);
      }
      const sim = iv.magnitude > 0 ? dot / (queryMag * iv.magnitude) : 0;
      scores.push({ intent: iv.intent, score: sim });
    }

    scores.sort((a, b) => b.score - a.score);

    const best = scores[0];
    const secondBest = scores[1];

    if (!best || best.score < 0.05) {
      return { intent: 'unknown', confidence: 0 };
    }

    return {
      intent: best.intent,
      confidence: Math.round(best.score * 1000) / 1000,
      secondBest: secondBest ? {
        intent: secondBest.intent,
        confidence: Math.round(secondBest.score * 1000) / 1000,
      } : undefined,
    };
  }

  // ── Index Building ─────────────────────────────────────────

  private _buildIndex(): void {
    // Step 1: Compute document frequencies
    const allIntents = Object.entries(TRAINING_DATA)
      .filter(([, examples]) => examples.length > 0) as [IntentLabel, string[]][];

    const totalDocs = allIntents.length;
    const dfMap = new Map<string, number>();

    // Each intent = one "document" (concatenation of all examples)
    const intentTokenSets: Map<IntentLabel, Set<string>> = new Map();

    for (const [intent, examples] of allIntents) {
      const allTokens = new Set<string>();
      for (const ex of examples) {
        for (const t of _tokenize(ex)) {
          allTokens.add(t);
        }
      }
      intentTokenSets.set(intent, allTokens);

      for (const term of allTokens) {
        dfMap.set(term, (dfMap.get(term) || 0) + 1);
      }
    }

    // Step 2: Compute IDF
    for (const [term, df] of dfMap) {
      this._idf.set(term, Math.log((totalDocs + 1) / (df + 1)) + 1); // Smoothed IDF
    }

    // Step 3: Build TF-IDF vectors per intent
    for (const [intent, examples] of allIntents) {
      // Concatenate all examples into one "document"
      const allTokens: string[] = [];
      for (const ex of examples) {
        allTokens.push(..._tokenize(ex));
      }

      const tf = _computeTF(allTokens);
      const tfidf = new Map<string, number>();
      let magnitude = 0;

      for (const [term, freq] of tf) {
        const idf = this._idf.get(term) || 0;
        const val = freq * idf;
        tfidf.set(term, val);
        magnitude += val * val;
      }

      this._intentVectors.push({
        intent,
        tfidf,
        magnitude: Math.sqrt(magnitude),
      });
    }

    this._initialized = true;
  }
}

// ─── Tokenizer ──────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'it', 'in', 'on', 'at', 'to', 'of',
  'for', 'and', 'or', 'but', 'not', 'with', 'was', 'were', 'be',
  'this', 'that', 'i', 'me', 'my', 'we', 'you', 'your', 'do',
  'does', 'did', 'can', 'could', 'would', 'should',
]);

function _tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s/]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 2 && !STOP_WORDS.has(w));
}

function _computeTF(tokens: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const t of tokens) counts.set(t, (counts.get(t) || 0) + 1);
  // Normalize by max frequency
  const maxFreq = Math.max(...counts.values(), 1);
  const tf = new Map<string, number>();
  for (const [term, count] of counts) {
    tf.set(term, 0.5 + 0.5 * (count / maxFreq)); // Augmented TF
  }
  return tf;
}

// ─── Singleton ──────────────────────────────────────────────────

export const tfidfClassifier = new TFIDFIntentClassifier();

// ─── Sprint 6 Task 6.3: LLM-Assisted Classification ────────────

const VALID_INTENTS = new Set<IntentLabel>([
  'educational', 'chart_analysis', 'coaching', 'journal', 'journal_search',
  'personal_model', 'risk', 'scanner', 'trade_grade', 'command', 'greeting', 'unknown',
]);

const LLM_SYSTEM_PROMPT =
  'Classify this message into exactly one category: ' +
  'educational, chart_analysis, coaching, journal, journal_search, ' +
  'personal_model, risk, scanner, trade_grade, command, greeting, unknown. ' +
  'Respond with ONLY the category name, nothing else.';

// Simple LRU cache (100 entries)
class LRUCache<V> {
  private _map = new Map<string, V>();
  constructor(private _maxSize: number) {}

  get(key: string): V | undefined {
    const val = this._map.get(key);
    if (val !== undefined) {
      // Move to end (most recently used)
      this._map.delete(key);
      this._map.set(key, val);
    }
    return val;
  }

  set(key: string, val: V): void {
    this._map.delete(key); // Remove first for re-ordering
    this._map.set(key, val);
    if (this._map.size > this._maxSize) {
      // Evict oldest (first key)
      const firstKey = this._map.keys().next().value;
      if (firstKey !== undefined) this._map.delete(firstKey);
    }
  }
}

const _classifyCache = new LRUCache<ClassificationResult>(100);

/**
 * LLM-based intent classification via Groq (fast 8B model).
 * Returns null on failure so caller can fall back to TF-IDF.
 */
async function classifyWithLLM(text: string): Promise<ClassificationResult | null> {
  try {
    // Dynamic import to avoid circular dependency
    const { groqAdapter } = await import('./GroqAdapter');
    if (!groqAdapter.isAvailable) return null;

    const result = await groqAdapter.chat(
      [
        { role: 'system', content: LLM_SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
      { model: 'llama-3.1-8b-instant', maxTokens: 20, temperature: 0 },
    );

    const raw = result.content.trim().toLowerCase().replace(/[^a-z_]/g, '') as IntentLabel;
    if (VALID_INTENTS.has(raw)) {
      return { intent: raw, confidence: 0.9 };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Sprint 6 Task 6.3: Hybrid classifier — TF-IDF fast path + LLM fallback.
 *
 * 1. Check LRU cache → return if hit
 * 2. Run TF-IDF → return if confidence ≥ 0.4
 * 3. Try LLM classification (Groq 8B)
 * 4. On LLM failure → return TF-IDF result
 */
export async function classifyHybrid(text: string): Promise<ClassificationResult> {
  const key = text.trim().toLowerCase();
  if (!key) return { intent: 'unknown', confidence: 0 };

  // 1. Cache hit
  const cached = _classifyCache.get(key);
  if (cached) return cached;

  // 2. TF-IDF fast path
  const tfidfResult = tfidfClassifier.classify(key);
  if (tfidfResult.intent !== 'unknown' && tfidfResult.confidence >= 0.4) {
    _classifyCache.set(key, tfidfResult);
    return tfidfResult;
  }

  // 3. LLM fallback
  const llmResult = await classifyWithLLM(text);
  if (llmResult) {
    _classifyCache.set(key, llmResult);
    return llmResult;
  }

  // 4. Graceful degradation — use TF-IDF result even if low confidence
  const fallback = tfidfResult.intent !== 'unknown' ? tfidfResult : { intent: 'unknown' as IntentLabel, confidence: 0 };
  _classifyCache.set(key, fallback);
  return fallback;
}

export default tfidfClassifier;
