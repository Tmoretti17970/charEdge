// ═══════════════════════════════════════════════════════════════════
// charEdge — Metaculus Prediction Market Adapter
//
// Fetches community forecasts from Metaculus — known for calibrated
// predictions on science, tech, geopolitics, and economics.
// No auth needed for public reads.
//
// API Docs: https://www.metaculus.com/api/
// ═══════════════════════════════════════════════════════════════════

import { createMarket } from '../schemas/PredictionMarketSchema.js';

const BASE_URL = 'https://www.metaculus.com/api2';
const HEADERS = { Accept: 'application/json' };

// ─── Category rules ────────────────────────────────────────────
const CATEGORY_RULES = [
  {
    category: 'economy',
    keywords: ['fed', 'gdp', 'inflation', 'cpi', 'recession', 'unemployment', 'rate', 'treasury', 'housing'],
  },
  {
    category: 'finance',
    keywords: ['stock', 's&p', 'nasdaq', 'market', 'earnings', 'ipo', 'gold', 'oil', 'commodity'],
  },
  { category: 'crypto', keywords: ['bitcoin', 'btc', 'ethereum', 'eth', 'crypto', 'blockchain', 'defi'] },
  {
    category: 'politics',
    keywords: ['election', 'president', 'congress', 'vote', 'democrat', 'republican', 'senate', 'tariff'],
  },
  {
    category: 'tech',
    keywords: ['ai', 'agi', 'spacex', 'tesla', 'nvidia', 'apple', 'google', 'microsoft', 'semiconductor', 'quantum'],
  },
  {
    category: 'science',
    keywords: ['space', 'nasa', 'mars', 'climate', 'vaccine', 'research', 'physics', 'biology', 'nuclear'],
  },
  {
    category: 'geopolitics',
    keywords: ['china', 'russia', 'iran', 'nato', 'war', 'ceasefire', 'ukraine', 'military', 'sanctions'],
  },
  { category: 'health', keywords: ['covid', 'pandemic', 'fda', 'drug', 'outbreak', 'disease', 'mortality'] },
  {
    category: 'climate',
    keywords: ['temperature', 'carbon', 'emissions', 'hurricane', 'earthquake', 'wildfire', 'sea level'],
  },
];

// ═══════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════

/**
 * Fetch active questions from Metaculus.
 */
export async function fetchMetaculusMarkets({ category: _category, limit = 50 } = {}) {
  try {
    const params = new URLSearchParams({
      status: 'open',
      order_by: '-activity',
      limit: String(limit),
      type: 'forecast',
    });

    const res = await fetch(`${BASE_URL}/questions/?${params}`, { headers: HEADERS });

    if (!res.ok) return getFallbackData();

    const data = await res.json();
    const questions = data.results || [];

    return questions
      .filter((q) => q.active && !q.resolved)
      .slice(0, limit)
      .map(normalizeMetaculusQuestion)
      .filter(Boolean);
  } catch {
    return getFallbackData();
  }
}

// ═══════════════════════════════════════════════════════════════════
// Normalization
// ═══════════════════════════════════════════════════════════════════

function normalizeMetaculusQuestion(question) {
  const title = question.title || '';
  const category = categorize(title);
  const probability = extractProbability(question);
  if (probability === null) return null;

  const prevProbability =
    question.community_prediction?.history?.length > 1
      ? Math.round((question.community_prediction.history.slice(-2)[0]?.x2 || probability / 100) * 100)
      : probability;

  return createMarket({
    id: `metaculus-${question.id}`,
    source: 'metaculus',
    question: title,
    description: question.description_html ? stripHtml(question.description_html).slice(0, 300) : '',
    category,
    subcategory: null,
    outcomes:
      question.possibilities?.type === 'binary'
        ? [
            {
              label: 'Yes',
              probability,
              previousProbability: prevProbability,
              volume: question.number_of_predictions || 0,
              payoutMultiplier: 0,
            },
            {
              label: 'No',
              probability: 100 - probability,
              previousProbability: 100 - prevProbability,
              volume: 0,
              payoutMultiplier: 0,
            },
          ]
        : [
            {
              label: 'Community Estimate',
              probability,
              previousProbability: prevProbability,
              volume: question.number_of_predictions || 0,
              payoutMultiplier: 0,
            },
          ],
    marketType: question.possibilities?.type === 'binary' ? 'binary' : 'scalar',
    status: 'open',
    volume24h: question.number_of_predictions || 0,
    totalVolume: question.number_of_predictions || 0,
    openInterest: 0,
    liquidity: 0,
    change24h: probability - prevProbability,
    closeDate: question.resolve_time || question.close_time,
    createdDate: question.created_time || null,
    resolutionSource: 'Metaculus Community',
    relatedTickers: extractTickers(title),
    tags: extractTags(title),
    url: `https://www.metaculus.com/questions/${question.id}/`,
  });
}

// ─── Helpers ───────────────────────────────────────────────────

function extractProbability(question) {
  // Binary questions: community_prediction.full.q2 (median)
  if (question.community_prediction?.full?.q2 != null) {
    return Math.round(question.community_prediction.full.q2 * 100);
  }
  // Fallback to latest value
  if (question.community_prediction?.history?.length) {
    const latest = question.community_prediction.history.at(-1);
    if (latest?.x2 != null) return Math.round(latest.x2 * 100);
  }
  return null;
}

function categorize(title) {
  const text = title.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((kw) => text.includes(kw))) return rule.category;
  }
  return 'other';
}

function extractTickers(text) {
  const tickers = [];
  const patterns = [/\b(NVDA|AAPL|MSFT|GOOGL|META|AMZN|TSLA|AMD|SPY|QQQ)\b/g, /\bBTC\b/gi, /\bETH\b/gi];
  for (const p of patterns) {
    p.lastIndex = 0;
    const m = text.match(p);
    if (m) tickers.push(...m.map((t) => t.toUpperCase()));
  }
  return [...new Set(tickers)];
}

function extractTags(title) {
  const tags = [];
  const text = title.toLowerCase();
  const TOPIC_KEYWORDS = [
    'ai',
    'agi',
    'bitcoin',
    'climate',
    'covid',
    'china',
    'russia',
    'election',
    'fed',
    'inflation',
    'nuclear',
    'spacex',
    'tesla',
    'war',
    'pandemic',
    'quantum',
    'mars',
    'nasa',
  ];
  for (const kw of TOPIC_KEYWORDS) {
    if (text.includes(kw)) tags.push(kw.charAt(0).toUpperCase() + kw.slice(1));
  }
  return tags;
}

function stripHtml(html) {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&[^;]+;/g, ' ')
    .trim();
}

// ─── Fallback data ─────────────────────────────────────────────

function getFallbackData() {
  return [
    createMarket({
      id: 'metaculus-agi-2030',
      source: 'metaculus',
      question: 'Will AGI be achieved by 2030?',
      description: 'Will an artificial general intelligence system be publicly demonstrated before January 1, 2030?',
      category: 'tech',
      outcomes: [
        { label: 'Yes', probability: 12, previousProbability: 10, volume: 2840, payoutMultiplier: 0 },
        { label: 'No', probability: 88, previousProbability: 90, volume: 0, payoutMultiplier: 0 },
      ],
      marketType: 'binary',
      volume24h: 2840,
      change24h: 2,
      closeDate: '2030-01-01T00:00:00Z',
      tags: ['AI', 'Agi'],
      url: 'https://www.metaculus.com/questions/5121/',
    }),
    createMarket({
      id: 'metaculus-mars-2035',
      source: 'metaculus',
      question: 'Will humans land on Mars by 2035?',
      category: 'science',
      outcomes: [
        { label: 'Yes', probability: 18, previousProbability: 17, volume: 1520, payoutMultiplier: 0 },
        { label: 'No', probability: 82, previousProbability: 83, volume: 0, payoutMultiplier: 0 },
      ],
      marketType: 'binary',
      volume24h: 1520,
      change24h: 1,
      closeDate: '2035-01-01T00:00:00Z',
      tags: ['Mars', 'Nasa', 'Spacex'],
      url: 'https://www.metaculus.com/questions/3596/',
    }),
    createMarket({
      id: 'metaculus-nuclear-2030',
      source: 'metaculus',
      question: 'Will a nuclear weapon be detonated in conflict by 2030?',
      category: 'geopolitics',
      outcomes: [
        { label: 'Yes', probability: 4, previousProbability: 5, volume: 3100, payoutMultiplier: 0 },
        { label: 'No', probability: 96, previousProbability: 95, volume: 0, payoutMultiplier: 0 },
      ],
      marketType: 'binary',
      volume24h: 3100,
      change24h: -1,
      closeDate: '2030-01-01T00:00:00Z',
      tags: ['Nuclear', 'War'],
      url: 'https://www.metaculus.com/questions/7407/',
    }),
  ];
}

export default { fetchMetaculusMarkets };
