// ═══════════════════════════════════════════════════════════════════
// charEdge — Technical Scan Engine
//
// Phase 1: Connects real pattern detection + signal generation
// to the TechnicalScanner UI (replacing mock data).
//
// Uses:
//   - PatternCNN for chart pattern detection
//   - computeIntel for technical signal generation
//   - fetchBarsForIntel for data sourcing
//
// Usage:
//   import { scanEngine } from './ScanEngine.js';
//   const results = await scanEngine.scan(['BTCUSDT', 'AAPL', 'SPY']);
// ═══════════════════════════════════════════════════════════════════

import { logger } from '@/observability/logger';

/** @type {{ patterns: Array, signals: Array, confluence: Array, scannedAt: number }} */
let _cache = { patterns: [], signals: [], confluence: [], scannedAt: 0 };
const CACHE_TTL = 60_000; // 1 minute cache

/**
 * Scan a list of symbols for patterns, signals, and confluence.
 * @param {string[]} symbols
 * @param {string} [tf='1h'] - Default timeframe
 * @returns {Promise<{ patterns: Array, signals: Array, confluence: Array }>}
 */
export async function scan(symbols, tf = '1h') {
  // Return cached results if fresh
  if (Date.now() - _cache.scannedAt < CACHE_TTL && _cache.patterns.length > 0) {
    return _cache;
  }

  const [{ computeIntel, fetchBarsForIntel }, { patternCNN }] = await Promise.all([
    import('./computeWatchlistIntel.js'),
    import('../../ai/PatternCNN.ts'),
  ]);

  const patterns = [];
  const signals = [];
  const confluenceRows = [];

  // Scan each symbol (limit concurrency to avoid rate limits)
  const BATCH_SIZE = 5;
  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (symbol) => {
        const bars = await fetchBarsForIntel(symbol, tf);
        if (!bars || bars.length < 30) return null;

        // Pattern detection
        const detected = patternCNN.detect(bars);
        for (const p of detected) {
          const lastBar = bars[bars.length - 1];
          patterns.push({
            id: `${symbol}-${p.type}-${Date.now()}`,
            symbol,
            pattern: p.label,
            type: p.direction === 'neutral' ? 'continuation' : 'reversal',
            timeframe: tf.toUpperCase(),
            confidence: p.confidence,
            direction: p.direction,
            target: null,
            entry: lastBar?.close || 0,
            stop: null,
            detected: _timeAgo(Date.now()),
          });
        }

        // Signal detection via computeIntel
        const intel = computeIntel(symbol, bars, null);
        _extractSignals(symbol, tf, intel, signals);

        // Confluence (multi-tf not feasible in single scan, use intel trend)
        confluenceRows.push({
          symbol,
          direction: intel.trendDirection,
          rsi: intel.rsi14,
          trend: intel.trendDirection,
          volatility: intel.volatilityRank,
          score: _computeConfluenceScore(intel),
        });

        return symbol;
      }),
    );

    // Small delay between batches to avoid rate limiting
    if (i + BATCH_SIZE < symbols.length) {
      await new Promise((r) => setTimeout(r, 200));
    }

    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length > 0) {
      logger.data.warn(`[ScanEngine] ${failed.length} symbols failed in batch`);
    }
  }

  // Sort patterns by confidence, signals by strength
  patterns.sort((a, b) => b.confidence - a.confidence);
  confluenceRows.sort((a, b) => b.score - a.score);

  _cache = { patterns, signals, confluence: confluenceRows, scannedAt: Date.now() };
  logger.data.info(
    `[ScanEngine] Scanned ${symbols.length} symbols: ${patterns.length} patterns, ${signals.length} signals`,
  );
  return _cache;
}

/** Clear cache to force rescan */
export function invalidateCache() {
  _cache = { patterns: [], signals: [], confluence: [], scannedAt: 0 };
}

// ─── Signal Extraction ──────────────────────────────────────────

function _extractSignals(symbol, tf, intel, signals) {
  const tfLabel = tf.toUpperCase();
  const now = Date.now();

  // RSI overbought/oversold
  if (intel.rsi14 != null) {
    if (intel.rsi14 >= 70) {
      signals.push({
        id: `${symbol}-rsi-ob-${now}`,
        symbol,
        signal: `RSI Overbought (${intel.rsi14})`,
        timeframe: tfLabel,
        strength: intel.rsi14 >= 80 ? 'strong' : 'medium',
        direction: 'bearish',
        detected: _timeAgo(now),
      });
    } else if (intel.rsi14 <= 30) {
      signals.push({
        id: `${symbol}-rsi-os-${now}`,
        symbol,
        signal: `RSI Oversold (${intel.rsi14})`,
        timeframe: tfLabel,
        strength: intel.rsi14 <= 20 ? 'strong' : 'medium',
        direction: 'bullish',
        detected: _timeAgo(now),
      });
    }
  }

  // EMA/SMA cross (trend direction as proxy)
  if (intel.smaFast && intel.smaSlow) {
    const crossUp = intel.smaFast > intel.smaSlow && intel.trendDirection === 'up';
    const crossDown = intel.smaFast < intel.smaSlow && intel.trendDirection === 'down';
    if (crossUp) {
      signals.push({
        id: `${symbol}-sma-bull-${now}`,
        symbol,
        signal: 'SMA 10/50 Bullish Alignment',
        timeframe: tfLabel,
        strength: 'strong',
        direction: 'bullish',
        detected: _timeAgo(now),
      });
    } else if (crossDown) {
      signals.push({
        id: `${symbol}-sma-bear-${now}`,
        symbol,
        signal: 'SMA 10/50 Bearish Alignment',
        timeframe: tfLabel,
        strength: 'strong',
        direction: 'bearish',
        detected: _timeAgo(now),
      });
    }
  }

  // Bollinger Squeeze (narrow bands = pending breakout)
  if (intel.bbWidth != null && parseFloat(intel.bbWidth) < 3) {
    signals.push({
      id: `${symbol}-bb-squeeze-${now}`,
      symbol,
      signal: `Bollinger Squeeze (${intel.bbWidth}%)`,
      timeframe: tfLabel,
      strength: 'medium',
      direction: 'neutral',
      detected: _timeAgo(now),
    });
  }

  // Price near support/resistance
  if (intel.support && intel.price) {
    const distToSupport = ((intel.price - intel.support) / intel.price) * 100;
    if (distToSupport > 0 && distToSupport < 1.5) {
      signals.push({
        id: `${symbol}-support-${now}`,
        symbol,
        signal: `Near Support ($${intel.support.toFixed(2)})`,
        timeframe: tfLabel,
        strength: 'medium',
        direction: 'bullish',
        detected: _timeAgo(now),
      });
    }
  }
  if (intel.resistance && intel.price) {
    const distToResistance = ((intel.resistance - intel.price) / intel.price) * 100;
    if (distToResistance > 0 && distToResistance < 1.5) {
      signals.push({
        id: `${symbol}-resistance-${now}`,
        symbol,
        signal: `Near Resistance ($${intel.resistance.toFixed(2)})`,
        timeframe: tfLabel,
        strength: 'medium',
        direction: 'bearish',
        detected: _timeAgo(now),
      });
    }
  }

  // High volatility alert
  if (intel.volatilityRank === 'high') {
    signals.push({
      id: `${symbol}-vol-high-${now}`,
      symbol,
      signal: 'High Volatility (ATR elevated)',
      timeframe: tfLabel,
      strength: 'medium',
      direction: 'neutral',
      detected: _timeAgo(now),
    });
  }
}

// ─── Confluence Score ───────────────────────────────────────────

function _computeConfluenceScore(intel) {
  let score = 50; // neutral baseline

  // Trend alignment (+/- 20)
  if (intel.trendDirection === 'up') score += 20;
  else if (intel.trendDirection === 'down') score -= 10;

  // RSI momentum (+/- 15)
  if (intel.rsi14 != null) {
    if (intel.rsi14 > 50 && intel.rsi14 < 70)
      score += 15; // healthy bullish
    else if (intel.rsi14 <= 30)
      score += 10; // oversold bounce
    else if (intel.rsi14 >= 70) score -= 10; // overbought risk
  }

  // Bollinger position (+/- 10)
  if (intel.bbWidth != null) {
    const bw = parseFloat(intel.bbWidth);
    if (bw < 3) score += 5; // squeeze = pending breakout
  }

  // Volatility (-5 for high vol)
  if (intel.volatilityRank === 'high') score -= 5;

  return Math.max(0, Math.min(100, Math.round(score)));
}

// ─── Helpers ────────────────────────────────────────────────────

function _timeAgo(_timestamp) {
  return 'just now';
}

export const scanEngine = { scan, invalidateCache };
export default scanEngine;
