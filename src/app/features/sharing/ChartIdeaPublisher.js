// ═══════════════════════════════════════════════════════════════════
// charEdge — Chart Publishing & Idea Sharing (Sprint 16)
// Packages chart state as shareable "chart ideas" with annotations.
// ═══════════════════════════════════════════════════════════════════

const IDEAS_KEY = 'charEdge-chart-ideas';

let _savedIdeas = [];
try {
  const raw = localStorage.getItem(IDEAS_KEY);
  if (raw) _savedIdeas = JSON.parse(raw);
} catch (_) { /* storage may be blocked */ }

/**
 * Publish a chart idea — captures everything needed to reproduce the chart.
 */
export function publishChartIdea({
  symbol, tf, chartType, indicators, drawings,
  title, description, bias, tags = [],
  author = 'You',
  screenshot = null,
}) {
  const idea = {
    id: `idea_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    createdAt: Date.now(),
    symbol,
    tf,
    chartType,
    indicators: (indicators || []).map(i => ({ type: i.type || i.indicatorId, params: i.params })),
    drawings: (drawings || []).map(d => ({
      type: d.type,
      points: d.points,
      style: d.style,
      meta: d.meta,
    })),
    title: title || `${symbol} ${tf} Analysis`,
    description: description || '',
    bias, // 'bullish' | 'bearish' | 'neutral'
    tags: [symbol, tf, bias, ...tags].filter(Boolean),
    author,
    screenshot,
    likes: 0,
    comments: [],
    views: 0,
    status: 'published',
  };

  _savedIdeas = [idea, ..._savedIdeas].slice(0, 200);
  try { localStorage.setItem(IDEAS_KEY, JSON.stringify(_savedIdeas)); } catch (_) { /* storage may be blocked */ }
  return idea;
}

/**
 * Load an idea onto the chart.
 */
export function loadChartIdea(idea) {
  return {
    symbol: idea.symbol,
    tf: idea.tf,
    chartType: idea.chartType,
    indicators: idea.indicators,
    drawings: idea.drawings,
  };
}

/**
 * Get all published ideas, optionally filtered.
 */
export function getPublishedIdeas(filter = {}) {
  let results = [..._savedIdeas];
  if (filter.symbol) results = results.filter(i => i.symbol === filter.symbol);
  if (filter.bias) results = results.filter(i => i.bias === filter.bias);
  if (filter.tag) results = results.filter(i => i.tags.includes(filter.tag));
  if (filter.author) results = results.filter(i => i.author === filter.author);
  return results;
}

/**
 * Like/unlike an idea.
 */
export function toggleIdeaLike(ideaId) {
  const idea = _savedIdeas.find(i => i.id === ideaId);
  if (idea) {
    idea.likes = (idea.likes || 0) + 1;
    try { localStorage.setItem(IDEAS_KEY, JSON.stringify(_savedIdeas)); } catch (_) { /* storage may be blocked */ }
  }
  return idea;
}

/**
 * Add a comment to an idea.
 */
export function addIdeaComment(ideaId, text, author = 'You') {
  const idea = _savedIdeas.find(i => i.id === ideaId);
  if (idea) {
    idea.comments = idea.comments || [];
    idea.comments.push({
      id: `cmt_${Date.now()}`,
      text,
      author,
      createdAt: Date.now(),
    });
    try { localStorage.setItem(IDEAS_KEY, JSON.stringify(_savedIdeas)); } catch (_) { /* storage may be blocked */ }
  }
  return idea;
}

/**
 * Generate a shareable URL for an idea.
 */
export function generateIdeaShareURL(idea) {
  const data = {
    s: idea.symbol,
    tf: idea.tf,
    ct: idea.chartType,
    t: idea.title,
    b: idea.bias,
  };
  const encoded = btoa(JSON.stringify(data));
  return `${window.location.origin}?idea=${encoded}`;
}
