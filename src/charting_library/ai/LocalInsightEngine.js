// ═══════════════════════════════════════════════════════════════════
// charEdge — Local Insight Engine
//
// Rich template-based analysis that runs entirely in the browser.
// No API key required — all insights derived from FeatureExtractor.
//
// Provides:
//   • Market pulse (one-liner)
//   • Full analysis report (multi-section)
//   • Key level detection
//   • Setup quality grading
// ═══════════════════════════════════════════════════════════════════

// ─── Market Regime Classification ───────────────────────────────

const REGIMES = {
    STRONG_UPTREND: { label: 'Strong Uptrend', emoji: '🚀', color: 'green', bias: 'bullish' },
    MILD_UPTREND: { label: 'Mild Uptrend', emoji: '📈', color: 'green', bias: 'lean long' },
    CONSOLIDATION: { label: 'Consolidation', emoji: '💤', color: 'neutral', bias: 'neutral' },
    MILD_DOWNTREND: { label: 'Mild Downtrend', emoji: '📉', color: 'red', bias: 'lean short' },
    STRONG_DOWNTREND: { label: 'Strong Downtrend', emoji: '🔻', color: 'red', bias: 'bearish' },
    BREAKOUT: { label: 'Breakout', emoji: '⚡', color: 'blue', bias: 'follow momentum' },
    REVERSAL: { label: 'Potential Reversal', emoji: '⚠️', color: 'amber', bias: 'caution' },
    CHOPPY: { label: 'Choppy', emoji: '🌊', color: 'neutral', bias: 'stay out' },
};

function classifyRegime(features) {
    const { momentum, volatility, volume } = features;
    const { rsi, trendStrength, priceVsEma, macdCrossover } = momentum;
    const { atrRatio, bollingerWidth } = volatility;
    const { volumeSpike, volumeRatio } = volume;

    // Breakout detection: high volume + expanding volatility + strong momentum
    if (volumeSpike > 2.0 && bollingerWidth > 0.04 && trendStrength > 15) {
        return REGIMES.BREAKOUT;
    }

    // Reversal detection: overbought/oversold + volume spike
    if ((rsi > 75 || rsi < 25) && volumeSpike > 1.5) {
        return REGIMES.REVERSAL;
    }

    // Strong trend
    if (trendStrength > 20 && Math.abs(priceVsEma) > 0.01) {
        return priceVsEma > 0 ? REGIMES.STRONG_UPTREND : REGIMES.STRONG_DOWNTREND;
    }

    // Mild trend
    if (trendStrength > 8 && Math.abs(priceVsEma) > 0.003) {
        return priceVsEma > 0 ? REGIMES.MILD_UPTREND : REGIMES.MILD_DOWNTREND;
    }

    // Choppy: high volatility + low trend
    if (atrRatio > 0.02 && trendStrength < 8) {
        return REGIMES.CHOPPY;
    }

    // Consolidation
    return REGIMES.CONSOLIDATION;
}

// ─── Setup Quality Grading ──────────────────────────────────────

const GRADES = [
    { min: 90, letter: 'A+', stars: 5, desc: 'Exceptional — textbook setup' },
    { min: 80, letter: 'A', stars: 5, desc: 'Excellent — high conviction' },
    { min: 70, letter: 'B+', stars: 4, desc: 'Good — solid edge' },
    { min: 60, letter: 'B', stars: 4, desc: 'Above average — proceed with discipline' },
    { min: 50, letter: 'C+', stars: 3, desc: 'Average — needs additional confluence' },
    { min: 40, letter: 'C', stars: 3, desc: 'Below average — tight stops required' },
    { min: 30, letter: 'D', stars: 2, desc: 'Weak — high risk, low conviction' },
    { min: 0, letter: 'F', stars: 1, desc: 'No edge — sit on hands' },
];

function scoreSetup(features) {
    let score = 50; // Base score
    const { momentum, volatility, volume, price } = features;

    // Momentum alignment (+/- 15)
    if (momentum.trendStrength > 15) score += 10;
    if (momentum.trendStrength > 25) score += 5;
    if (momentum.macdCrossover !== 0) score += 5; // MACD has a signal
    if (momentum.rsi > 30 && momentum.rsi < 70) score += 5; // Not overbought/oversold

    // Volume confirmation (+/- 15)
    if (volume.volumeRatio > 1.2) score += 8;
    if (volume.volumeSpike > 1.5) score += 4;
    if (volume.buyPressure > 0.6) score += 3;
    if (volume.volumeRatio < 0.5) score -= 10; // Low volume = no conviction

    // Volatility context (+/- 10)
    if (volatility.bollingerWidth > 0.01 && volatility.bollingerWidth < 0.06) score += 5;
    if (volatility.atrRatio < 0.005) score -= 5; // Too quiet
    if (volatility.atrRatio > 0.04) score -= 5; // Too volatile

    // Price action (+/- 10)
    if (price.bodyRatio > 0.6) score += 5;  // Strong candle body
    if (price.wickRatio < 0.2) score += 3;  // Clean close
    if (Math.abs(price.returns1) < 0.001) score -= 3; // No movement

    return Math.max(0, Math.min(100, score));
}

function gradeFromScore(score) {
    for (const g of GRADES) {
        if (score >= g.min) return g;
    }
    return GRADES[GRADES.length - 1];
}

// ─── Key Level Detection ────────────────────────────────────────

function detectKeyLevels(candles, lookback = 50) {
    if (!candles || candles.length < 10) return [];

    const window = candles.slice(-Math.min(lookback, candles.length));
    const levels = [];
    const last = window[window.length - 1];

    // Swing highs and lows
    for (let i = 2; i < window.length - 2; i++) {
        const c = window[i];
        const isSwingHigh = c.high > window[i - 1].high && c.high > window[i - 2].high &&
            c.high > window[i + 1].high && c.high > window[i + 2].high;
        const isSwingLow = c.low < window[i - 1].low && c.low < window[i - 2].low &&
            c.low < window[i + 1].low && c.low < window[i + 2].low;

        if (isSwingHigh) levels.push({ price: c.high, type: 'resistance', strength: 1 });
        if (isSwingLow) levels.push({ price: c.low, type: 'support', strength: 1 });
    }

    // Cluster nearby levels (within 0.3%)
    const clustered = [];
    const used = new Set();
    for (let i = 0; i < levels.length; i++) {
        if (used.has(i)) continue;
        let cluster = [levels[i]];
        for (let j = i + 1; j < levels.length; j++) {
            if (used.has(j)) continue;
            if (Math.abs(levels[j].price - levels[i].price) / levels[i].price < 0.003) {
                cluster.push(levels[j]);
                used.add(j);
            }
        }
        used.add(i);
        const avgPrice = cluster.reduce((s, l) => s + l.price, 0) / cluster.length;
        const type = cluster[0].type;
        clustered.push({
            price: Math.round(avgPrice * 100) / 100,
            type,
            strength: cluster.length,
            distance: ((avgPrice - last.close) / last.close * 100).toFixed(2),
        });
    }

    // Sort by proximity to current price
    clustered.sort((a, b) => Math.abs(parseFloat(a.distance)) - Math.abs(parseFloat(b.distance)));

    return clustered.slice(0, 6); // Top 6 levels
}

// ─── Pulse Templates ────────────────────────────────────────────

function generatePulseText(regime, features, symbol, tf) {
    const { momentum, volume } = features;
    const sym = symbol || 'Chart';
    const volDesc = volume.volumeRatio > 1.5 ? 'elevated volume' :
        volume.volumeRatio < 0.5 ? 'muted volume' : 'normal volume';
    const rsiDesc = momentum.rsi > 70 ? 'overbought' :
        momentum.rsi < 30 ? 'oversold' :
            momentum.rsi > 55 ? 'mildly bullish' :
                momentum.rsi < 45 ? 'mildly bearish' : 'neutral';

    const templates = {
        STRONG_UPTREND: `${sym} trending strongly higher with ${volDesc}. RSI ${rsiDesc} at ${momentum.rsi.toFixed(0)}.`,
        MILD_UPTREND: `${sym} grinding higher on ${volDesc}. Momentum ${rsiDesc}.`,
        CONSOLIDATION: `${sym} consolidating in a tight range. ${volDesc.charAt(0).toUpperCase() + volDesc.slice(1)}, waiting for catalyst.`,
        MILD_DOWNTREND: `${sym} drifting lower with ${volDesc}. RSI ${rsiDesc}.`,
        STRONG_DOWNTREND: `${sym} selling off with conviction. ${volDesc.charAt(0).toUpperCase() + volDesc.slice(1)}, RSI ${momentum.rsi.toFixed(0)}.`,
        BREAKOUT: `${sym} breaking out on ${volume.volumeSpike.toFixed(1)}x volume spike! RSI ${momentum.rsi.toFixed(0)}.`,
        REVERSAL: `${sym} showing reversal signals — RSI ${rsiDesc} at ${momentum.rsi.toFixed(0)} with volume surge.`,
        CHOPPY: `${sym} chopping around with no clear direction. High noise, low signal.`,
    };

    // Find matching template
    for (const [key, regime_obj] of Object.entries(REGIMES)) {
        if (regime_obj === regime) return templates[key] || `${sym} — ${regime.label}`;
    }
    return `${sym} — analyzing...`;
}

// ─── Bias Templates ─────────────────────────────────────────────

function generateBias(regime, features, lastClose) {
    const { momentum } = features;
    const price = lastClose ? `$${lastClose.toLocaleString()}` : '';

    if (regime.bias === 'bullish') {
        return `Lean long ${price ? `above ${price}` : ''}. Trend is your friend — don't fight it.`;
    }
    if (regime.bias === 'lean long') {
        return `Cautiously bullish. Look for pullback entries with tight stops.`;
    }
    if (regime.bias === 'bearish') {
        return `Lean short or stay flat. Don't catch the falling knife.`;
    }
    if (regime.bias === 'lean short') {
        return `Bearish lean. Consider scaling into shorts on rallies.`;
    }
    if (regime.bias === 'follow momentum') {
        return `Follow the breakout — let the move prove itself. Trail stops.`;
    }
    if (regime.bias === 'caution') {
        return `High-risk zone. Reduce size or wait for confirmation before entering.`;
    }
    if (regime.bias === 'stay out') {
        return `No edge — sit on hands. Choppy markets eat accounts.`;
    }
    return `Wait for a cleaner setup before committing capital.`;
}

// ═══════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════

export const localInsightEngine = {

    /**
     * One-liner market state.
     * @param {Object} features - FeatureSet from FeatureExtractor
     * @param {string} symbol - e.g. "BTC"
     * @param {string} tf - e.g. "1H"
     * @returns {{ text: string, regime: Object }}
     */
    generateMarketPulse(features, symbol, tf) {
        const regime = classifyRegime(features);
        const text = generatePulseText(regime, features, symbol, tf);
        return { text, regime };
    },

    /**
     * Full multi-section analysis report.
     * @param {Object} features - FeatureSet
     * @param {string} symbol
     * @param {string} tf
     * @param {Array} candles - Raw OHLCV candles
     * @returns {{ sections: Array, regime: Object, grade: Object, score: number }}
     */
    generateFullAnalysis(features, symbol, tf, candles) {
        const regime = classifyRegime(features);
        const score = scoreSetup(features);
        const grade = gradeFromScore(score);
        const levels = detectKeyLevels(candles);
        const lastClose = candles?.[candles.length - 1]?.close;
        const { momentum, volatility, volume } = features;

        const sections = [
            {
                title: 'Market Regime',
                content: `${regime.emoji} **${regime.label}**`,
                detail: generatePulseText(regime, features, symbol, tf),
            },
            {
                title: 'Setup Quality',
                content: `**${grade.letter}** (${score}/100) ${'⭐'.repeat(grade.stars)}`,
                detail: grade.desc,
            },
            {
                title: 'Momentum',
                content: `RSI ${momentum.rsi.toFixed(0)} · MACD ${momentum.macdCrossover > 0 ? 'Bullish' : momentum.macdCrossover < 0 ? 'Bearish' : 'Flat'}`,
                detail: `Trend strength: ${momentum.trendStrength.toFixed(0)}/50 · Price vs EMA: ${(momentum.priceVsEma * 100).toFixed(2)}%`,
            },
            {
                title: 'Volume',
                content: `${volume.volumeRatio.toFixed(1)}x avg · Buy pressure: ${(volume.buyPressure * 100).toFixed(0)}%`,
                detail: volume.volumeSpike > 1.5
                    ? `⚡ Volume spike detected (${volume.volumeSpike.toFixed(1)}x)`
                    : `Volume is ${volume.volumeRatio > 1.2 ? 'healthy' : volume.volumeRatio < 0.5 ? 'concerning — low conviction' : 'normal'}`,
            },
            {
                title: 'Volatility',
                content: `ATR ratio: ${(volatility.atrRatio * 100).toFixed(2)}% · BB width: ${(volatility.bollingerWidth * 100).toFixed(1)}%`,
                detail: volatility.bollingerWidth < 0.02 ? 'Squeeze forming — expect expansion' :
                    volatility.bollingerWidth > 0.06 ? 'Wide range — manage risk tightly' :
                        'Normal volatility environment',
            },
        ];

        if (levels.length > 0) {
            sections.push({
                title: 'Key Levels',
                content: levels.slice(0, 3).map(l =>
                    `${l.type === 'support' ? '🟢' : '🔴'} ${l.price} (${l.distance > 0 ? '+' : ''}${l.distance}%)`
                ).join(' · '),
                detail: `${levels.length} levels detected from swing analysis`,
            });
        }

        sections.push({
            title: 'Trade Bias',
            content: generateBias(regime, features, lastClose),
            detail: '',
        });

        return { sections, regime, grade, score };
    },

    /**
     * Key S&R levels from candle data.
     */
    generateKeyLevels(candles) {
        return detectKeyLevels(candles);
    },

    /**
     * Setup quality grade.
     * @returns {{ letter: string, stars: number, score: number, desc: string }}
     */
    gradeSetup(features) {
        const score = scoreSetup(features);
        const grade = gradeFromScore(score);
        return { ...grade, score };
    },
};

export default localInsightEngine;
