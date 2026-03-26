// ═══════════════════════════════════════════════════════════════════
// charEdge — AI Market Summarizer
//
// Generates plain-English market summaries by analyzing market data.
// Currently uses template-based generation (no LLM call).
// Can be upgraded to use real LLM when backend is ready.
// ═══════════════════════════════════════════════════════════════════

import { formatVolume, timeToClose } from '../schemas/PredictionMarketSchema.js';

/**
 * Generate a plain-English summary for a prediction market.
 * @param {Object} market - Normalized market object
 * @returns {string} Human-readable market summary
 */
export function generateMarketSummary(market) {
  if (!market) return '';

  const parts = [];
  const lead = market.outcomes?.[0];
  const remaining = timeToClose(market.closeDate);

  // What is the market about
  parts.push(`This market tracks: "${market.question}"`);

  // Current state
  if (lead) {
    const direction = market.change24h > 0 ? 'up' : market.change24h < 0 ? 'down' : 'unchanged';
    const deltaStr = market.change24h !== 0 ? ` ${direction} ${Math.abs(market.change24h)}% in the last 24 hours` : '';

    if (market.outcomes.length === 2) {
      // Binary
      parts.push(`Currently ${lead.probability}% likely (${lead.label})${deltaStr}.`);
    } else {
      // Multi-outcome
      parts.push(`Leading outcome: "${lead.label}" at ${lead.probability}%${deltaStr}.`);
      if (market.outcomes.length > 2) {
        const runner = market.outcomes[1];
        parts.push(`Runner-up: "${runner.label}" at ${runner.probability}%.`);
      }
    }
  }

  // Volume context
  if (market.volume24h > 0) {
    const volStr = formatVolume(market.volume24h);
    if (market.volume24h >= 10_000_000) {
      parts.push(`Very high activity with ${volStr} traded in 24h.`);
    } else if (market.volume24h >= 1_000_000) {
      parts.push(`Active trading with ${volStr} in 24h volume.`);
    } else if (market.volume24h >= 100_000) {
      parts.push(`Moderate trading volume at ${volStr}/24h.`);
    } else {
      parts.push(`${volStr} traded in the last 24 hours.`);
    }
  }

  // Time context
  if (remaining) {
    parts.push(`Resolves in ${remaining}.`);
  }

  // Momentum signal
  if (Math.abs(market.change24h || 0) >= 10) {
    const dir = market.change24h > 0 ? 'surged' : 'dropped';
    parts.push(`Notable: Probability has ${dir} ${Math.abs(market.change24h)}% — this is a significant move.`);
  }

  // Source context
  if (market.source === 'kalshi') {
    parts.push('Traded on Kalshi, a CFTC-regulated prediction exchange.');
  } else if (market.source === 'polymarket') {
    parts.push('Traded on Polymarket, the largest prediction market by volume.');
  } else if (market.source === 'metaculus') {
    parts.push('Forecasted on Metaculus, known for calibrated community predictions.');
  } else if (market.source === 'manifold') {
    parts.push('From Manifold Markets, a play-money prediction platform with diverse topics.');
  }

  return parts.join(' ');
}

/**
 * Generate a one-liner headline for the market.
 */
export function generateHeadline(market) {
  if (!market) return '';
  const lead = market.outcomes?.[0];
  if (!lead) return market.question;

  const delta = market.change24h || 0;
  const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '→';

  return `${lead.label} at ${lead.probability}% ${arrow}${Math.abs(delta)}%`;
}
