// ═══════════════════════════════════════════════════════════════════
// H2.2: Emotion → P&L Correlation (Pearson r)
// ═══════════════════════════════════════════════════════════════════

/**
 * Compute Pearson correlation between emotion sentiment and P&L.
 * Maps emotions to a numeric sentiment scale:
 *   negative emotions → -1, neutral → 0, positive → +1
 * @param {Object[]} trades
 * @returns {{ pearsonR: number, sampleSize: number, emotions: Object }}
 */
export function computeEmotionCorrelation(trades) {
    const SENTIMENT = {
        // Negative
        anxious: -1,
        fearful: -1,
        frustrated: -1,
        angry: -1,
        revenge: -1,
        fomo: -1,
        greedy: -1,
        stressed: -1,
        panicked: -1,
        impatient: -1,
        // Neutral
        neutral: 0,
        calm: 0,
        bored: 0,
        indifferent: 0,
        untagged: 0,
        // Positive
        confident: 1,
        focused: 1,
        disciplined: 1,
        patient: 1,
        euphoric: 0.5,
        optimistic: 1,
        satisfied: 1,
    };

    const pairs = [];
    const emotionPnl = {};

    for (const t of trades) {
        const emo = (t.emotion || 'untagged').toLowerCase().trim();
        const sentiment = SENTIMENT[emo];
        if (sentiment == null || !isFinite(t.pnl)) continue;

        pairs.push({ sentiment, pnl: t.pnl });

        if (!emotionPnl[emo]) emotionPnl[emo] = { pnl: 0, count: 0, avgPnl: 0 };
        emotionPnl[emo].pnl += t.pnl;
        emotionPnl[emo].count++;
    }

    // Finalize avgPnl
    for (const emo of Object.keys(emotionPnl)) {
        emotionPnl[emo].avgPnl = emotionPnl[emo].count > 0 ? emotionPnl[emo].pnl / emotionPnl[emo].count : 0;
    }

    // Pearson r
    const n = pairs.length;
    if (n < 5) return { pearsonR: 0, sampleSize: n, emotions: emotionPnl };

    let sumX = 0,
        sumY = 0;
    for (let i = 0; i < n; i++) {
        sumX += pairs[i].sentiment;
        sumY += pairs[i].pnl;
    }
    const meanX = sumX / n;
    const meanY = sumY / n;

    let cov = 0,
        varX = 0,
        varY = 0;
    for (let i = 0; i < n; i++) {
        const dx = pairs[i].sentiment - meanX;
        const dy = pairs[i].pnl - meanY;
        cov += dx * dy;
        varX += dx * dx;
        varY += dy * dy;
    }
    const denom = Math.sqrt(varX * varY);
    const pearsonR = denom > 0 ? cov / denom : 0;

    return { pearsonR, sampleSize: n, emotions: emotionPnl };
}
