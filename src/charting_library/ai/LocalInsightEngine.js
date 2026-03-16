// ═══════════════════════════════════════════════════════════════════
// charEdge — Local Insight Engine v2
//
// Rich template-based analysis that runs entirely in the browser.
// No API key required — all insights derived from FeatureExtractor.
//
// v2 Enhancements:
//   • Divergence detection (price vs RSI, price vs volume)
//   • Candlestick pattern recognition (12 patterns)
//   • Deep momentum / volume / volatility interpretation
//   • Risk assessment engine
//   • Multi-factor market narrative builder
//   • Prioritized key observations
//   • Context-sensitive language (50+ templates)
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
    ACCUMULATION: { label: 'Accumulation', emoji: '🔋', color: 'blue', bias: 'building position' },
};

// ─── Divergence Detection ───────────────────────────────────────

function detectDivergences(candles, features) {
    const divs = [];
    if (!candles || candles.length < 20) return divs;

    const recent = candles.slice(-20);
    const { momentum, volume } = features;

    // Price making higher highs but RSI making lower highs → bearish divergence
    const lastHigh = recent[recent.length - 1].high;
    const prevHigh = Math.max(...recent.slice(0, 10).map(c => c.high));
    if (lastHigh > prevHigh && momentum.rsi < 60 && momentum.rsiSlope < 0) {
        divs.push({
            type: 'bearish',
            indicator: 'RSI',
            severity: momentum.rsi > 50 ? 'moderate' : 'strong',
            desc: `Price making new highs but RSI declining (${momentum.rsi.toFixed(0)}) — bearish divergence`,
        });
    }

    // Price making lower lows but RSI making higher lows → bullish divergence
    const lastLow = recent[recent.length - 1].low;
    const prevLow = Math.min(...recent.slice(0, 10).map(c => c.low));
    if (lastLow < prevLow && momentum.rsi > 40 && momentum.rsiSlope > 0) {
        divs.push({
            type: 'bullish',
            indicator: 'RSI',
            severity: momentum.rsi < 50 ? 'moderate' : 'strong',
            desc: `Price making new lows but RSI rising (${momentum.rsi.toFixed(0)}) — bullish divergence`,
        });
    }

    // Volume divergence: price trending but volume declining
    if (momentum.trendStrength > 15 && volume.volumeRatio < 0.7) {
        divs.push({
            type: momentum.priceVsEma > 0 ? 'bearish' : 'bullish',
            indicator: 'Volume',
            severity: volume.volumeRatio < 0.5 ? 'strong' : 'moderate',
            desc: `Price trending ${momentum.priceVsEma > 0 ? 'up' : 'down'} but volume drying up (${volume.volumeRatio.toFixed(1)}x avg) — move losing conviction`,
        });
    }

    return divs;
}

// ─── Candlestick Pattern Recognition ────────────────────────────

function detectCandlestickPatterns(candles) {
    const patterns = [];
    if (!candles || candles.length < 5) return patterns;

    const last = candles.length - 1;
    const c = candles[last];           // Current candle
    const p = candles[last - 1];       // Previous candle
    const pp = candles[last - 2];      // 2 candles back

    const bodySize = Math.abs(c.close - c.open);
    const range = c.high - c.low;
    const upperWick = c.high - Math.max(c.open, c.close);
    const lowerWick = Math.min(c.open, c.close) - c.low;
    const isBullish = c.close > c.open;
    const pBodySize = Math.abs(p.close - p.open);
    const pIsBullish = p.close > p.open;

    if (range === 0) return patterns;

    // Doji — tiny body, long wicks
    if (bodySize / range < 0.1 && range > 0) {
        patterns.push({ name: 'Doji', type: 'neutral', emoji: '✝️',
            desc: 'Market indecision — buyers and sellers at equilibrium. Watch for direction on next candle.' });
    }

    // Hammer — small body at top, long lower wick (bullish reversal)
    if (lowerWick > bodySize * 2 && upperWick < bodySize * 0.5 && !pIsBullish) {
        patterns.push({ name: 'Hammer', type: 'bullish', emoji: '🔨',
            desc: 'Sellers pushed price down but buyers reclaimed — potential bottom reversal signal.' });
    }

    // Shooting Star — small body at bottom, long upper wick (bearish reversal)
    if (upperWick > bodySize * 2 && lowerWick < bodySize * 0.5 && pIsBullish) {
        patterns.push({ name: 'Shooting Star', type: 'bearish', emoji: '⭐',
            desc: 'Buyers pushed price up but sellers slammed it back — potential top reversal.' });
    }

    // Bullish Engulfing — current bullish candle engulfs previous bearish
    if (isBullish && !pIsBullish && c.close > p.open && c.open < p.close && bodySize > pBodySize) {
        patterns.push({ name: 'Bullish Engulfing', type: 'bullish', emoji: '🟢',
            desc: 'Strong bullish candle completely engulfs prior selling — powerful reversal signal.' });
    }

    // Bearish Engulfing — current bearish candle engulfs previous bullish
    if (!isBullish && pIsBullish && c.close < p.open && c.open > p.close && bodySize > pBodySize) {
        patterns.push({ name: 'Bearish Engulfing', type: 'bearish', emoji: '🔴',
            desc: 'Strong bearish candle overwhelms prior buying — reversal warning.' });
    }

    // Morning Star (3-candle bullish reversal)
    if (candles.length >= 3 && !candles[last-2].close > candles[last-2].open
        && Math.abs(p.close - p.open) / (p.high - p.low || 1) < 0.3
        && isBullish && c.close > (pp.open + pp.close) / 2) {
        patterns.push({ name: 'Morning Star', type: 'bullish', emoji: '🌅',
            desc: '3-candle bullish reversal — selling exhaustion followed by buyer strength.' });
    }

    // Evening Star (3-candle bearish reversal)
    if (candles.length >= 3 && pp.close > pp.open
        && Math.abs(p.close - p.open) / (p.high - p.low || 1) < 0.3
        && !isBullish && c.close < (pp.open + pp.close) / 2) {
        patterns.push({ name: 'Evening Star', type: 'bearish', emoji: '🌆',
            desc: '3-candle bearish reversal — buying exhaustion followed by seller control.' });
    }

    // Three White Soldiers (3 consecutive bullish with higher closes)
    if (candles.length >= 3 && isBullish && pIsBullish && pp.close > pp.open
        && c.close > p.close && p.close > pp.close
        && bodySize / range > 0.5 && pBodySize / (p.high - p.low || 1) > 0.5) {
        patterns.push({ name: 'Three White Soldiers', type: 'bullish', emoji: '💂',
            desc: 'Three strong bullish candles in a row — sustained buying pressure.' });
    }

    // Three Black Crows (3 consecutive bearish with lower closes)
    if (candles.length >= 3 && !isBullish && !pIsBullish && pp.close < pp.open
        && c.close < p.close && p.close < pp.close
        && bodySize / range > 0.5 && pBodySize / (p.high - p.low || 1) > 0.5) {
        patterns.push({ name: 'Three Black Crows', type: 'bearish', emoji: '🪶',
            desc: 'Three strong bearish candles in a row — sustained selling pressure.' });
    }

    // Pin Bar — long wick on one side, tiny body
    if (bodySize / range < 0.2) {
        if (lowerWick > range * 0.6) {
            patterns.push({ name: 'Bullish Pin Bar', type: 'bullish', emoji: '📌',
                desc: 'Long lower wick shows rejection of lower prices — buyers defending this level.' });
        } else if (upperWick > range * 0.6) {
            patterns.push({ name: 'Bearish Pin Bar', type: 'bearish', emoji: '📌',
                desc: 'Long upper wick shows rejection of higher prices — sellers capping the move.' });
        }
    }

    // Inside Bar — current range entirely within previous
    if (c.high <= p.high && c.low >= p.low) {
        patterns.push({ name: 'Inside Bar', type: 'neutral', emoji: '📦',
            desc: 'Price compressing inside prior range — breakout setup forming. Trade the break of the mother bar.' });
    }

    return patterns;
}

// ─── Chart-Level Pattern Detection (Sprint 3) ──────────────────

/**
 * Detect multi-bar chart patterns for canvas overlay rendering.
 * Returns patterns with `idx` for PatternOverlay positioning.
 *
 * @param {Array} candles - OHLCV array (oldest first)
 * @returns {Array<{idx: number, label: string, icon: string, bias: string, confidence: number, desc: string}>}
 */
function detectChartPatterns(candles) {
    const chartPats = [];
    if (!candles || candles.length < 30) return chartPats;

    const n = candles.length;
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const closes = candles.map(c => c.close);

    // Find local swing highs/lows (within ±3 bars window)
    const swingHighs = [];
    const swingLows = [];
    for (let i = 3; i < n - 3; i++) {
        if (highs[i] >= Math.max(...highs.slice(i - 3, i)) && highs[i] >= Math.max(...highs.slice(i + 1, i + 4))) {
            swingHighs.push({ idx: i, price: highs[i] });
        }
        if (lows[i] <= Math.min(...lows.slice(i - 3, i)) && lows[i] <= Math.min(...lows.slice(i + 1, i + 4))) {
            swingLows.push({ idx: i, price: lows[i] });
        }
    }

    // --- Double Top ---
    for (let i = 0; i < swingHighs.length - 1; i++) {
        const a = swingHighs[i], b = swingHighs[i + 1];
        const diff = Math.abs(a.price - b.price) / a.price;
        const dist = b.idx - a.idx;
        if (diff < 0.015 && dist >= 5 && dist <= 40) {
            // Check for valley between peaks
            const valley = Math.min(...lows.slice(a.idx, b.idx + 1));
            const necklineBreak = closes[n - 1] < valley * 1.005;
            chartPats.push({
                idx: b.idx, label: 'Double Top', icon: '🔻', bias: 'bearish',
                confidence: necklineBreak ? 0.85 : 0.6,
                desc: `Resistance tested twice at ~$${a.price.toFixed(2)} — ${necklineBreak ? 'neckline broken, bearish confirmed' : 'watch neckline'}`,
            });
        }
    }

    // --- Double Bottom ---
    for (let i = 0; i < swingLows.length - 1; i++) {
        const a = swingLows[i], b = swingLows[i + 1];
        const diff = Math.abs(a.price - b.price) / a.price;
        const dist = b.idx - a.idx;
        if (diff < 0.015 && dist >= 5 && dist <= 40) {
            const peak = Math.max(...highs.slice(a.idx, b.idx + 1));
            const necklineBreak = closes[n - 1] > peak * 0.995;
            chartPats.push({
                idx: b.idx, label: 'Double Bottom', icon: '🔺', bias: 'bullish',
                confidence: necklineBreak ? 0.85 : 0.6,
                desc: `Support tested twice at ~$${a.price.toFixed(2)} — ${necklineBreak ? 'neckline broken, bullish confirmed' : 'watch neckline'}`,
            });
        }
    }

    // --- Ascending Triangle (flat resistance + rising lows) ---
    if (swingHighs.length >= 2 && swingLows.length >= 2) {
        const recentHighs = swingHighs.slice(-3);
        const recentLows = swingLows.slice(-3);
        const highFlat = recentHighs.every(h => Math.abs(h.price - recentHighs[0].price) / recentHighs[0].price < 0.01);
        const lowsRising = recentLows.length >= 2 && recentLows[recentLows.length - 1].price > recentLows[0].price * 1.005;
        if (highFlat && lowsRising) {
            chartPats.push({
                idx: recentHighs[recentHighs.length - 1].idx, label: 'Asc Triangle', icon: '📐', bias: 'bullish',
                confidence: 0.7,
                desc: 'Flat resistance with rising lows — breakout bias is bullish',
            });
        }
    }

    // --- Descending Triangle (flat support + falling highs) ---
    if (swingHighs.length >= 2 && swingLows.length >= 2) {
        const recentHighs = swingHighs.slice(-3);
        const recentLows = swingLows.slice(-3);
        const lowFlat = recentLows.every(l => Math.abs(l.price - recentLows[0].price) / recentLows[0].price < 0.01);
        const highsFalling = recentHighs.length >= 2 && recentHighs[recentHighs.length - 1].price < recentHighs[0].price * 0.995;
        if (lowFlat && highsFalling) {
            chartPats.push({
                idx: recentLows[recentLows.length - 1].idx, label: 'Desc Triangle', icon: '📐', bias: 'bearish',
                confidence: 0.7,
                desc: 'Flat support with falling highs — breakdown bias is bearish',
            });
        }
    }

    // --- Bull Flag (sharp rally then tight consolidation) ---
    if (n >= 20) {
        const flagpole = candles.slice(-20, -10);
        const flag = candles.slice(-10);
        const poleMove = (flagpole[flagpole.length - 1].close - flagpole[0].open) / flagpole[0].open;
        const flagRange = Math.max(...flag.map(c => c.high)) - Math.min(...flag.map(c => c.low));
        const poleRange = Math.max(...flagpole.map(c => c.high)) - Math.min(...flagpole.map(c => c.low));
        if (poleMove > 0.03 && flagRange < poleRange * 0.5) {
            const flagSlope = (flag[flag.length - 1].close - flag[0].close) / flag[0].close;
            if (flagSlope < 0.005) {
                chartPats.push({
                    idx: n - 5, label: 'Bull Flag', icon: '🏁', bias: 'bullish',
                    confidence: 0.65,
                    desc: `Strong rally (+${(poleMove * 100).toFixed(1)}%) followed by tight pullback — continuation expected`,
                });
            }
        }
    }

    // --- Bear Flag (sharp drop then tight consolidation) ---
    if (n >= 20) {
        const flagpole = candles.slice(-20, -10);
        const flag = candles.slice(-10);
        const poleMove = (flagpole[flagpole.length - 1].close - flagpole[0].open) / flagpole[0].open;
        const flagRange = Math.max(...flag.map(c => c.high)) - Math.min(...flag.map(c => c.low));
        const poleRange = Math.max(...flagpole.map(c => c.high)) - Math.min(...flagpole.map(c => c.low));
        if (poleMove < -0.03 && flagRange < poleRange * 0.5) {
            const flagSlope = (flag[flag.length - 1].close - flag[0].close) / flag[0].close;
            if (flagSlope > -0.005) {
                chartPats.push({
                    idx: n - 5, label: 'Bear Flag', icon: '🏁', bias: 'bearish',
                    confidence: 0.65,
                    desc: `Sharp drop (${(poleMove * 100).toFixed(1)}%) followed by tight bounce — continuation down expected`,
                });
            }
        }
    }

    return chartPats;
}

// ─── Momentum Interpretation ────────────────────────────────────

function interpretMomentum(features) {
    const { rsi, trendStrength, macdCrossover, rsiSlope, priceVsEma } = features.momentum;
    const insights = [];

    // RSI zones
    if (rsi > 80) insights.push('🔥 RSI extremely overbought — exhaustion likely, avoid new longs');
    else if (rsi > 70) insights.push('⚠️ RSI overbought — momentum stretched, watch for pullback');
    else if (rsi > 55) insights.push('📈 RSI healthy bullish — momentum supports upside');
    else if (rsi > 45) insights.push('⚖️ RSI neutral — no strong directional bias');
    else if (rsi > 30) insights.push('📉 RSI healthy bearish — momentum supports downside');
    else if (rsi > 20) insights.push('⚠️ RSI oversold — bounce potential building');
    else insights.push('🧊 RSI extremely oversold — snapback rally likely');

    // RSI momentum (slope)
    if (Math.abs(rsiSlope) > 5) {
        insights.push(rsiSlope > 0
            ? '⬆️ RSI accelerating higher — momentum building'
            : '⬇️ RSI accelerating lower — momentum fading fast');
    }

    // MACD
    if (macdCrossover > 0) insights.push('✅ MACD bullish cross — fresh buy signal');
    else if (macdCrossover < 0) insights.push('❌ MACD bearish cross — fresh sell signal');

    // Trend strength
    if (trendStrength > 30) insights.push('💪 Very strong directional move — don\'t fade it');
    else if (trendStrength > 20) insights.push('📊 Solid trend in progress — trade with it');
    else if (trendStrength < 5) insights.push('😴 Zero trend conviction — range-bound territory');

    // EMA position with context
    if (Math.abs(priceVsEma) > 0.02) {
        insights.push(priceVsEma > 0
            ? `📏 Price ${(priceVsEma * 100).toFixed(1)}% above EMA — extended, mean reversion risk`
            : `📏 Price ${(Math.abs(priceVsEma) * 100).toFixed(1)}% below EMA — extended, bounce potential`);
    }

    return insights;
}

// ─── Volume Interpretation ──────────────────────────────────────

function interpretVolume(features) {
    const { volumeRatio, volumeSpike, buyPressure, obvTrend } = features.volume;
    const insights = [];

    if (volumeSpike > 3) insights.push(`🚨 Massive volume spike (${volumeSpike.toFixed(1)}x) — institutional activity likely`);
    else if (volumeSpike > 2) insights.push(`⚡ Significant volume surge (${volumeSpike.toFixed(1)}x) — conviction behind this move`);
    else if (volumeSpike > 1.5) insights.push(`📊 Above-average volume (${volumeSpike.toFixed(1)}x) — interested participants`);

    if (volumeRatio < 0.3) insights.push('🔇 Extremely low volume — no one cares about this level, move will fail');
    else if (volumeRatio < 0.5) insights.push('📉 Below average volume — moves lack conviction, fade risk');

    if (buyPressure > 0.75) insights.push(`🟢 Strong buy pressure (${(buyPressure * 100).toFixed(0)}%) — buyers in control`);
    else if (buyPressure > 0.6) insights.push(`📈 Healthy buy pressure (${(buyPressure * 100).toFixed(0)}%)`);
    else if (buyPressure < 0.25) insights.push(`🔴 Heavy sell pressure (${((1 - buyPressure) * 100).toFixed(0)}%) — sellers dominating`);
    else if (buyPressure < 0.4) insights.push(`📉 Bears have the edge (${((1 - buyPressure) * 100).toFixed(0)}% sell pressure)`);

    if (obvTrend > 0.5) insights.push('📈 OBV trending up — accumulation in progress');
    else if (obvTrend < -0.5) insights.push('📉 OBV trending down — distribution in progress');

    return insights;
}

// ─── Risk Assessment ────────────────────────────────────────────

function assessRisk(features, regime) {
    const risks = [];
    let riskScore = 0; // 0-100, higher = more dangerous

    const { momentum, volatility, volume } = features;

    // Overbought/oversold risk
    if (momentum.rsi > 80 || momentum.rsi < 20) { riskScore += 25; risks.push('Extreme RSI — reversal risk elevated'); }
    else if (momentum.rsi > 70 || momentum.rsi < 30) { riskScore += 15; risks.push('RSI approaching extremes'); }

    // Volatility risk
    if (volatility.atrRatio > 0.04) { riskScore += 20; risks.push('High volatility — widen stops or reduce size'); }
    if (volatility.bollingerWidth > 0.08) { riskScore += 10; risks.push('Bollinger Bands very wide — chaotic price action'); }
    if (volatility.bollingerWidth < 0.01) { riskScore += 5; risks.push('Extreme squeeze — explosive move imminent, direction uncertain'); }

    // Volume risk
    if (volume.volumeRatio < 0.5) { riskScore += 15; risks.push('Low volume — breakouts will fake out'); }
    if (volume.volumeSpike > 3) { riskScore += 10; risks.push('Volume spike — potential climax/exhaustion'); }

    // Regime risk
    if (regime === REGIMES.CHOPPY) { riskScore += 20; risks.push('Choppy regime — entries get stopped out repeatedly'); }
    if (regime === REGIMES.REVERSAL) { riskScore += 15; risks.push('Reversal zone — wrong-side risk is high'); }

    const level = riskScore >= 50 ? 'HIGH' : riskScore >= 25 ? 'MODERATE' : 'LOW';
    const emoji = riskScore >= 50 ? '🔴' : riskScore >= 25 ? '🟡' : '🟢';

    return { score: Math.min(100, riskScore), level, emoji, risks };
}

// ─── Key Observations (Prioritized) ────────────────────────────

function generateKeyObservations(features, regime, divs, patterns, risk, candles) {
    const obs = [];

    // Highest priority: divergences
    divs.forEach(d => obs.push({ priority: d.severity === 'strong' ? 10 : 7, text: d.desc, type: 'divergence' }));

    // Candlestick patterns
    patterns.forEach(p => obs.push({ priority: 6, text: `${p.emoji} ${p.name}: ${p.desc}`, type: 'pattern' }));

    // Risk warnings
    if (risk.score >= 50) obs.push({ priority: 9, text: `${risk.emoji} HIGH RISK: ${risk.risks[0]}`, type: 'risk' });

    // Breakout / reversal situations
    if (regime === REGIMES.BREAKOUT) {
        obs.push({ priority: 8, text: '⚡ Breakout in progress — trail stops, let it run', type: 'regime' });
    }
    if (regime === REGIMES.REVERSAL) {
        obs.push({ priority: 8, text: '⚠️ Reversal signals present — reduce size, tighten stops', type: 'regime' });
    }

    // Volume-price confirmation/conflict
    const { momentum, volume } = features;
    if (momentum.trendStrength > 15 && volume.volumeRatio > 1.5) {
        obs.push({ priority: 5, text: '✅ Volume confirms the trend — high conviction move', type: 'confirmation' });
    }
    if (momentum.trendStrength > 15 && volume.volumeRatio < 0.6) {
        obs.push({ priority: 7, text: '⚠️ Trend on declining volume — move losing steam', type: 'warning' });
    }

    // Bollinger squeeze
    if (features.volatility.bollingerWidth < 0.015) {
        obs.push({ priority: 6, text: '🔋 Bollinger squeeze forming — big move brewing', type: 'volatility' });
    }

    // Sort by priority (highest first), return top 5
    obs.sort((a, b) => b.priority - a.priority);
    return obs.slice(0, 5);
}

function classifyRegime(features) {
    const { momentum, volatility, volume } = features;
    const { rsi, trendStrength, priceVsEma, _macdCrossover } = momentum;
    const { atrRatio, bollingerWidth } = volatility;
    const { volumeSpike, _volumeRatio } = volume;

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

    // Accumulation: low volatility + building volume + no trend yet
    if (bollingerWidth < 0.02 && volumeSpike > 1.3 && trendStrength < 10) {
        return REGIMES.ACCUMULATION;
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
        const cluster = [levels[i]];
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

function generatePulseText(regime, features, symbol, _tf) {
    const { momentum, volume } = features;
    const sym = symbol || 'Chart';
    const volDesc = volume.volumeRatio > 1.5 ? 'elevated volume' :
        volume.volumeRatio < 0.5 ? 'muted volume' : 'normal volume';
    const rsiDesc = momentum.rsi > 70 ? 'overbought' :
        momentum.rsi < 30 ? 'oversold' :
            momentum.rsi > 55 ? 'mildly bullish' :
                momentum.rsi < 45 ? 'mildly bearish' : 'neutral';
    const trendWord = momentum.trendStrength > 25 ? 'powerfully' :
        momentum.trendStrength > 15 ? 'steadily' : 'slowly';
    const emaContext = Math.abs(momentum.priceVsEma) > 0.02
        ? ` — ${(Math.abs(momentum.priceVsEma) * 100).toFixed(1)}% ${momentum.priceVsEma > 0 ? 'above' : 'below'} EMA`
        : '';

    const templates = {
        STRONG_UPTREND: `${sym} trending ${trendWord} higher with ${volDesc}${emaContext}. RSI ${rsiDesc} at ${momentum.rsi.toFixed(0)}, MACD ${momentum.macdCrossover > 0 ? 'bullish' : 'confirming'}.`,
        MILD_UPTREND: `${sym} grinding higher on ${volDesc}. Momentum ${rsiDesc} — ${momentum.trendStrength > 12 ? 'trend building' : 'needs confirmation'}.`,
        CONSOLIDATION: `${sym} consolidating in a tight range with ${volDesc}. Bollinger width ${(features.volatility.bollingerWidth * 100).toFixed(1)}% — ${features.volatility.bollingerWidth < 0.015 ? 'squeeze building, expect expansion' : 'waiting for catalyst'}.`,
        MILD_DOWNTREND: `${sym} drifting lower with ${volDesc}${emaContext}. RSI ${rsiDesc} — ${volume.buyPressure < 0.4 ? 'sellers in control' : 'some buying support'}.`,
        STRONG_DOWNTREND: `${sym} selling off ${trendWord}. ${volDesc.charAt(0).toUpperCase() + volDesc.slice(1)}, RSI ${momentum.rsi.toFixed(0)}${momentum.rsi < 25 ? ' — approaching oversold bounce territory' : ''}.`,
        BREAKOUT: `${sym} breaking out on ${volume.volumeSpike.toFixed(1)}x volume spike! RSI ${momentum.rsi.toFixed(0)}, ${volume.buyPressure > 0.6 ? 'buyers driving' : 'sellers driving'}. ${momentum.trendStrength > 20 ? 'Strong conviction.' : 'Watch for follow-through.'}`,
        REVERSAL: `${sym} flashing reversal signals — RSI ${rsiDesc} at ${momentum.rsi.toFixed(0)} with ${volume.volumeSpike > 1.5 ? volume.volumeSpike.toFixed(1) + 'x volume surge' : 'shifting momentum'}. ${momentum.rsi > 70 ? 'Exhaustion likely.' : momentum.rsi < 30 ? 'Bounce setting up.' : 'Watch for confirmation.'}`,
        CHOPPY: `${sym} chopping around with no clear direction. ATR ${(features.volatility.atrRatio * 100).toFixed(2)}% — high noise, low signal. ${volume.volumeRatio < 0.5 ? 'Dead volume.' : 'Volume present but directionless.'}`,
        ACCUMULATION: `${sym} in accumulation phase — tight range with ${volume.volumeSpike > 1.3 ? 'building volume (' + volume.volumeSpike.toFixed(1) + 'x)' : 'quiet volume'}. Smart money may be positioning. Watch for breakout.`,
    };

    // Find matching template
    for (const [key, regime_obj] of Object.entries(REGIMES)) {
        if (regime_obj === regime) return templates[key] || `${sym} — ${regime.label}`;
    }
    return `${sym} — analyzing...`;
}

// ─── Bias Templates ─────────────────────────────────────────────

function generateBias(regime, features, lastClose) {
    const { momentum, volume } = features;
    const price = lastClose ? `$${lastClose.toLocaleString()}` : '';

    if (regime.bias === 'bullish') {
        const strength = momentum.trendStrength > 25 ? 'Strong conviction' : 'Moderate conviction';
        return `${strength} — lean long ${price ? `above ${price}` : ''}. Trend is your friend. ${volume.volumeRatio > 1.2 ? 'Volume confirms.' : 'Watch volume for confirmation.'}`.trim();
    }
    if (regime.bias === 'lean long') {
        return `Cautiously bullish. Look for pullback entries with tight stops. ${momentum.rsi > 60 ? 'RSI getting warm — don\'t chase.' : 'RSI has room to run.'}`;
    }
    if (regime.bias === 'bearish') {
        return `Lean short or stay flat. Don't catch the falling knife. ${volume.volumeRatio > 1.5 ? 'Heavy selling pressure.' : 'Drift lower — no urgency to short.'}`;
    }
    if (regime.bias === 'lean short') {
        return `Bearish lean. Consider scaling into shorts on rallies. ${momentum.rsi < 40 ? 'Momentum supports shorts.' : 'Wait for rejection at resistance.'}`;
    }
    if (regime.bias === 'follow momentum') {
        return `Follow the breakout — let the move prove itself. Trail stops ${volume.buyPressure > 0.6 ? '(buyers leading)' : '(sellers leading)'}. Don't front-run.`;
    }
    if (regime.bias === 'caution') {
        return `High-risk zone — reversal signals flashing. ${momentum.rsi > 70 ? 'Overbought exhaustion.' : momentum.rsi < 30 ? 'Oversold bounce forming.' : 'Mixed signals.'} Reduce size or wait.`;
    }
    if (regime.bias === 'stay out') {
        return `No edge — sit on hands. Choppy markets eat accounts. Wait for a clean break of the range.`;
    }
    if (regime.bias === 'building position') {
        return `Accumulation in progress — smart money may be building. Wait for the breakout or scale in small with wide stops.`;
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
     * Full multi-section analysis report (v2 — enhanced with divergences, patterns, risk).
     * @param {Object} features - FeatureSet
     * @param {string} symbol
     * @param {string} tf
     * @param {Array} candles - Raw OHLCV candles
     * @returns {{ sections: Array, regime: Object, grade: Object, score: number, risk: Object, patterns: Array, divergences: Array, observations: Array }}
     */
    generateFullAnalysis(features, symbol, tf, candles) {
        const regime = classifyRegime(features);
        const score = scoreSetup(features);
        const grade = gradeFromScore(score);
        const levels = detectKeyLevels(candles);
        const lastClose = candles?.[candles.length - 1]?.close;
        const { momentum, volatility, volume } = features;

        // v2: New analysis layers
        const divs = detectDivergences(candles, features);
        const patterns = detectCandlestickPatterns(candles);
        const chartPatterns = detectChartPatterns(candles);
        const risk = assessRisk(features, regime);
        const momentumInsights = interpretMomentum(features);
        const volumeInsights = interpretVolume(features);
        const observations = generateKeyObservations(features, regime, divs, patterns, risk, candles);

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
                title: 'Risk Assessment',
                content: `${risk.emoji} **${risk.level}** (${risk.score}/100)`,
                detail: risk.risks.length > 0 ? risk.risks.join(' · ') : 'No significant risks detected',
            },
            {
                title: 'Momentum',
                content: `RSI ${momentum.rsi.toFixed(0)} · MACD ${momentum.macdCrossover > 0 ? 'Bullish' : momentum.macdCrossover < 0 ? 'Bearish' : 'Flat'}`,
                detail: momentumInsights.slice(0, 3).join('\n'),
            },
            {
                title: 'Volume',
                content: `${volume.volumeRatio.toFixed(1)}x avg · Buy pressure: ${(volume.buyPressure * 100).toFixed(0)}%`,
                detail: volumeInsights.slice(0, 3).join('\n'),
            },
            {
                title: 'Volatility',
                content: `ATR ratio: ${(volatility.atrRatio * 100).toFixed(2)}% · BB width: ${(volatility.bollingerWidth * 100).toFixed(1)}%`,
                detail: volatility.bollingerWidth < 0.015 ? '🔋 Squeeze forming — expect explosive expansion' :
                    volatility.bollingerWidth < 0.02 ? 'Squeeze forming — expect expansion' :
                    volatility.bollingerWidth > 0.08 ? '🔥 Extreme range — manage risk aggressively, widen stops' :
                    volatility.bollingerWidth > 0.06 ? 'Wide range — manage risk tightly' :
                        'Normal volatility environment',
            },
        ];

        // Divergences section (when detected)
        if (divs.length > 0) {
            sections.push({
                title: 'Divergences',
                content: divs.map(d => `${d.type === 'bullish' ? '🟢' : '🔴'} ${d.indicator}: ${d.severity}`).join(' · '),
                detail: divs.map(d => d.desc).join('\n'),
            });
        }

        // Candlestick patterns (when detected)
        if (patterns.length > 0) {
            sections.push({
                title: 'Candlestick Patterns',
                content: patterns.map(p => `${p.emoji} ${p.name}`).join(' · '),
                detail: patterns.map(p => p.desc).join('\n'),
            });
        }

        // Sprint 3: Chart-level patterns (for canvas overlay + panel)
        if (chartPatterns.length > 0) {
            sections.push({
                title: 'Chart Patterns',
                content: chartPatterns.map(p => `${p.icon} ${p.label}`).join(' · '),
                detail: chartPatterns.map(p => p.desc).join('\n'),
            });
        }

        if (levels.length > 0) {
            sections.push({
                title: 'Key Levels',
                content: levels.slice(0, 3).map(l =>
                    `${l.type === 'support' ? '🟢' : '🔴'} ${l.price} (${l.distance > 0 ? '+' : ''}${l.distance}%)`
                ).join(' · '),
                detail: `${levels.length} levels detected from swing analysis`,
            });
        }

        // Key observations (prioritized insights)
        if (observations.length > 0) {
            sections.push({
                title: 'Key Observations',
                content: observations[0].text,
                detail: observations.slice(1).map(o => o.text).join('\n'),
            });
        }

        sections.push({
            title: 'Trade Bias',
            content: generateBias(regime, features, lastClose),
            detail: '',
        });

        return { sections, regime, grade, score, risk, patterns, chartPatterns, divergences: divs, observations };
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

    // ═══════════════════════════════════════════════════════════
    // v2: New API Methods
    // ═══════════════════════════════════════════════════════════

    /**
     * Detect candlestick patterns on the last few candles.
     * @param {Array} candles - Raw OHLCV candles
     * @returns {Array} Detected patterns with name, type, emoji, description
     */
    detectPatterns(candles) {
        return detectCandlestickPatterns(candles);
    },

    /**
     * Detect multi-bar chart formations (double top/bottom, triangles, flags).
     * @param {Array} candles - Raw OHLCV candles
     * @returns {Array} Detected formations with idx, label, icon, bias, confidence, desc
     */
    detectChartPatterns(candles) {
        return detectChartPatterns(candles);
    },

    /**
     * Detect divergences between price and indicators.
     * @param {Array} candles - Raw OHLCV candles
     * @param {Object} features - FeatureSet from FeatureExtractor
     * @returns {Array} Divergences with type, indicator, severity, description
     */
    detectDivergences(candles, features) {
        return detectDivergences(candles, features);
    },

    /**
     * Risk assessment for current market conditions.
     * @param {Object} features - FeatureSet
     * @returns {{ score: number, level: string, emoji: string, risks: string[] }}
     */
    assessRisk(features) {
        const regime = classifyRegime(features);
        return assessRisk(features, regime);
    },

    /**
     * Deep momentum interpretation.
     * @param {Object} features - FeatureSet
     * @returns {string[]} Array of momentum insights
     */
    interpretMomentum(features) {
        return interpretMomentum(features);
    },

    /**
     * Deep volume interpretation.
     * @param {Object} features - FeatureSet
     * @returns {string[]} Array of volume insights
     */
    interpretVolume(features) {
        return interpretVolume(features);
    },

    /**
     * Generate a detailed multi-paragraph narrative combining all analysis.
     * This is the "What's happening?" answer — rich, context-aware, trader-focused.
     * @param {Object} features - FeatureSet
     * @param {string} symbol
     * @param {string} tf
     * @param {Array} candles
     * @returns {{ narrative: string, regime: Object, risk: Object, patterns: Array, divergences: Array }}
     */
    generateDetailedNarrative(features, symbol, tf, candles) {
        const regime = classifyRegime(features);
        const score = scoreSetup(features);
        const grade = gradeFromScore(score);
        const risk = assessRisk(features, regime);
        const divs = detectDivergences(candles, features);
        const patterns = detectCandlestickPatterns(candles);
        const levels = detectKeyLevels(candles);
        const momentumInsights = interpretMomentum(features);
        const volumeInsights = interpretVolume(features);
        const lastClose = candles?.[candles.length - 1]?.close;
        const sym = symbol || 'Chart';

        // Build narrative paragraphs
        const paras = [];

        // P1: Market state overview
        paras.push(generatePulseText(regime, features, symbol, tf));

        // P2: Key momentum + volume insights
        const topMom = momentumInsights.slice(0, 2).map(s => s.replace(/^[^\s]+ /, '')); // strip emoji
        const topVol = volumeInsights.slice(0, 1).map(s => s.replace(/^[^\s]+ /, ''));
        if (topMom.length || topVol.length) {
            paras.push([...topMom, ...topVol].join('. ') + '.');
        }

        // P3: Patterns + divergences
        if (patterns.length > 0 || divs.length > 0) {
            const parts = [];
            patterns.forEach(p => parts.push(`${p.emoji} ${p.name} detected — ${p.desc.split('.')[0]}.`));
            divs.forEach(d => parts.push(`⚠️ ${d.desc}.`));
            paras.push(parts.join(' '));
        }

        // P4: Key levels
        if (levels.length > 0) {
            const nearest = levels[0];
            const dir = parseFloat(nearest.distance) > 0 ? 'above' : 'below';
            paras.push(`Nearest ${nearest.type} at $${nearest.price} (${Math.abs(parseFloat(nearest.distance))}% ${dir} current price). ${levels.length > 1 ? `${levels.length - 1} more levels nearby.` : ''}`);
        }

        // P5: Risk + bias
        paras.push(`${risk.emoji} Risk: ${risk.level} (${risk.score}/100). Setup: ${grade.letter} (${score}/100). ${generateBias(regime, features, lastClose)}`);

        return {
            narrative: paras.join('\n\n'),
            regime,
            risk,
            patterns,
            divergences: divs,
        };
    },
};

export default localInsightEngine;
