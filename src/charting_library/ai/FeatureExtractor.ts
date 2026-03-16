// ═══════════════════════════════════════════════════════════════════
// charEdge — Feature Extractor v2 (Sprint 2)
//
// Extracts numeric feature vectors from OHLCV + indicator data for
// ML models and anomaly detection. All features are normalized to
// comparable scales for downstream consumption.
//
// v2: Expanded from 18 → 36 features:
//   + Williams %R, Stochastic %K/%D, ADX, EMA 12/26 distance
//   + Fibonacci proximity, pivot proximity, VWAP deviation
//   + Volume trend, money flow ratio, ATR expansion
//   + Volatility regime rank, returns 3/10, lower wick ratio
//   + Consecutive direction count
//
// Usage:
//   import { featureExtractor } from './FeatureExtractor.ts';
//   const features = featureExtractor.extract(candles, indicators);
//   // features.volatility, features.momentum, features.volume, features.vector
// ═══════════════════════════════════════════════════════════════════

// ─── Types ──────────────────────────────────────────────────────

export interface CandleInput {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface IndicatorValues {
    rsi?: number | null;
    macd?: { macd: number | null; signal: number | null; histogram: number | null } | null;
    ema?: number | null;
    sma?: number | null;
    atr?: number | null;
    obv?: number | null;
    vwap?: number | null;
    bollinger?: { upper: number | null; middle: number | null; lower: number | null } | null;
}

export interface FeatureSet {
    volatility: VolatilityFeatures;
    momentum: MomentumFeatures;
    volume: VolumeFeatures;
    price: PriceFeatures;
    vector: Float32Array;       // Flat feature vector for ML models
    timestamp: number;
}

export interface VolatilityFeatures {
    atrRatio: number;           // ATR / close price (normalized volatility)
    bollingerWidth: number;     // (upper - lower) / middle
    highLowRange: number;       // (high - low) / close over lookback
    gapFrequency: number;       // % of candles with open ≠ prev close
    // v2
    atrExpansion: number;       // ATR(5) / ATR(20) — tightening vs expanding
    volatilityRegime: number;   // Percentile rank of current vol vs trailing
}

export interface MomentumFeatures {
    rsi: number;                // 0-100
    rsiSlope: number;           // RSI change rate
    macdHistogram: number;      // MACD histogram value
    macdCrossover: number;      // 1 = bullish cross, -1 = bearish, 0 = none
    priceVsEma: number;         // (close - EMA) / EMA (% deviation)
    trendStrength: number;      // Abs deviation from 50 RSI (0-50)
    // v2
    williamsR: number;          // Williams %R (-100 to 0)
    stochK: number;             // Stochastic %K (0-100)
    stochD: number;             // Stochastic %D (0-100)
    adxStrength: number;        // ADX approximation (0-100)
    emaDistance12: number;       // (close - EMA12) / close
    emaDistance26: number;       // (close - EMA26) / close
}

export interface VolumeFeatures {
    volumeRatio: number;        // Current vol / average vol
    obvTrend: number;           // OBV slope (normalized)
    volumeSpike: number;        // Max(vol / avg, 1) — spike detector
    buyPressure: number;        // Estimated buy pressure 0-1
    // v2
    vwapDeviation: number;      // (close - VWAP) / VWAP
    volumeTrend5: number;       // 5-bar volume slope (normalized)
    moneyFlowRatio: number;     // Positive money flow / total money flow (0-1)
}

export interface PriceFeatures {
    returns1: number;           // 1-bar return
    returns5: number;           // 5-bar return
    returns20: number;          // 20-bar return
    bodyRatio: number;          // |close - open| / (high - low)
    wickRatio: number;          // Upper wick / (high - low)
    // v2
    returns3: number;           // 3-bar return
    returns10: number;          // 10-bar return
    lowerWickRatio: number;     // Lower wick / (high - low)
    pivotProximity: number;     // Distance to nearest pivot point (normalized)
    fib382: number;             // Distance to 38.2% fib level (normalized)
    fib618: number;             // Distance to 61.8% fib level (normalized)
    consecutiveDirection: number; // Same-direction closes in a row (sign = direction)
}

// ─── Constants ──────────────────────────────────────────────────

const LOOKBACK = 20;
const FEATURE_COUNT = 36; // Total features in the flat vector (v2)

// ─── Feature Extractor ──────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/naming-convention
class _FeatureExtractor {

    /**
     * Extract a complete feature set from candles and indicator values.
     *
     * @param candles - OHLCV candle array (most recent last)
     * @param indicators - Current indicator values (optional)
     * @param lookback - Number of candles to analyze (default: 20)
     */
    extract(candles: CandleInput[], indicators?: IndicatorValues, lookback = LOOKBACK): FeatureSet {
        const n = candles.length;
        const window = candles.slice(Math.max(0, n - lookback));
        const last = window[window.length - 1];
        const ind = indicators || {};

        const volatility = this._extractVolatility(window, last, ind, candles);
        const momentum = this._extractMomentum(window, last, ind, candles);
        const volume = this._extractVolume(window, last, ind);
        const price = this._extractPrice(window, last, candles);

        // Build flat vector (36 features)
        const vector = new Float32Array(FEATURE_COUNT);
        let i = 0;
        // Volatility (6)
        vector[i++] = volatility.atrRatio;
        vector[i++] = volatility.bollingerWidth;
        vector[i++] = volatility.highLowRange;
        vector[i++] = volatility.gapFrequency;
        vector[i++] = clamp(volatility.atrExpansion, 0, 3) / 3;
        vector[i++] = volatility.volatilityRegime;
        // Momentum (12)
        vector[i++] = momentum.rsi / 100;
        vector[i++] = momentum.rsiSlope;
        vector[i++] = momentum.macdHistogram;
        vector[i++] = momentum.macdCrossover;
        vector[i++] = momentum.priceVsEma;
        vector[i++] = momentum.trendStrength / 50;
        vector[i++] = (momentum.williamsR + 100) / 100;    // Normalize -100..0 → 0..1
        vector[i++] = momentum.stochK / 100;
        vector[i++] = momentum.stochD / 100;
        vector[i++] = momentum.adxStrength / 100;
        vector[i++] = clamp(momentum.emaDistance12, -0.1, 0.1) / 0.1;
        vector[i++] = clamp(momentum.emaDistance26, -0.1, 0.1) / 0.1;
        // Volume (7)
        vector[i++] = Math.min(volume.volumeRatio, 5) / 5;
        vector[i++] = volume.obvTrend;
        vector[i++] = Math.min(volume.volumeSpike, 5) / 5;
        vector[i++] = volume.buyPressure;
        vector[i++] = clamp(volume.vwapDeviation, -0.05, 0.05) / 0.05;
        vector[i++] = clamp(volume.volumeTrend5, -1, 1);
        vector[i++] = volume.moneyFlowRatio;
        // Price (11)
        vector[i++] = clamp(price.returns1, -0.1, 0.1) / 0.1;
        vector[i++] = clamp(price.returns3, -0.15, 0.15) / 0.15;
        vector[i++] = clamp(price.returns5, -0.3, 0.3) / 0.3;
        vector[i++] = clamp(price.returns10, -0.5, 0.5) / 0.5;
        vector[i++] = clamp(price.returns20, -0.5, 0.5) / 0.5;
        vector[i++] = price.bodyRatio;
        vector[i++] = price.wickRatio;
        vector[i++] = price.lowerWickRatio;
        vector[i++] = clamp(price.pivotProximity, -0.05, 0.05) / 0.05;
        vector[i++] = clamp(price.fib382, -0.05, 0.05) / 0.05;
        vector[i++] = clamp(price.consecutiveDirection, -10, 10) / 10;

        return { volatility, momentum, volume, price, vector, timestamp: Date.now() };
    }

    /**
     * Extract only momentum features (lightweight).
     */
    extractMomentum(candles: CandleInput[], indicators?: IndicatorValues): MomentumFeatures {
        const window = candles.slice(-LOOKBACK);
        const last = window[window.length - 1];
        return this._extractMomentum(window, last, indicators || {}, candles);
    }

    // ─── Private Feature Extractors ─────────────────────────────

    /** @private */
    _extractVolatility(window: CandleInput[], last: CandleInput, ind: IndicatorValues, allCandles: CandleInput[]): VolatilityFeatures {
        const close = last.close || 1;

        // ATR ratio
        const atrRatio = ind.atr ? ind.atr / close : this._calcATRRatio(window);

        // Bollinger width
        let bollingerWidth = 0;
        if (ind.bollinger?.upper != null && ind.bollinger?.lower != null && ind.bollinger?.middle) {
            bollingerWidth = (ind.bollinger.upper - ind.bollinger.lower) / ind.bollinger.middle;
        } else {
            bollingerWidth = this._calcBollingerWidth(window);
        }

        // High-low range
        const ranges = window.map(c => (c.high - c.low) / (c.close || 1));
        const highLowRange = ranges.reduce((s, v) => s + v, 0) / (ranges.length || 1);

        // Gap frequency
        let gaps = 0;
        for (let i = 1; i < window.length; i++) {
            if (Math.abs(window[i].open - window[i - 1].close) / (window[i - 1].close || 1) > 0.001) {
                gaps++;
            }
        }
        const gapFrequency = window.length > 1 ? gaps / (window.length - 1) : 0;

        // v2: ATR expansion (short-term vs long-term volatility)
        const atrExpansion = this._calcATRExpansion(allCandles);

        // v2: Volatility regime (percentile rank)
        const volatilityRegime = this._calcVolatilityRegime(allCandles);

        return { atrRatio, bollingerWidth, highLowRange, gapFrequency, atrExpansion, volatilityRegime };
    }

    /** @private */
    _extractMomentum(window: CandleInput[], last: CandleInput, ind: IndicatorValues, allCandles: CandleInput[]): MomentumFeatures {
        // RSI
        const rsi = ind.rsi ?? this._calcRSI(window);

        // RSI slope (approximate from price momentum)
        const rsiSlope = window.length >= 5
            ? (rsi - 50) / 50 * (last.close > window[window.length - 5]?.close ? 1 : -1)
            : 0;

        // MACD
        const macdHistogram = ind.macd?.histogram ?? 0;
        const macdCrossover = ind.macd?.macd != null && ind.macd?.signal != null
            ? Math.sign(ind.macd.macd - ind.macd.signal)
            : 0;

        // Price vs EMA
        const ema = ind.ema ?? ind.sma ?? last.close;
        const priceVsEma = ema ? (last.close - ema) / ema : 0;

        // Trend strength
        const trendStrength = Math.abs(rsi - 50);

        // v2: Williams %R
        const williamsR = this._calcWilliamsR(window);

        // v2: Stochastic %K/%D
        const { stochK, stochD } = this._calcStochastic(window);

        // v2: ADX
        const adxStrength = this._calcADX(window);

        // v2: EMA distance (12/26)
        const closes = allCandles.length > 26 ? allCandles.slice(-30).map(c => c.close) : window.map(c => c.close);
        const emaDistance12 = this._emaDistance(closes, 12, last.close);
        const emaDistance26 = this._emaDistance(closes, 26, last.close);

        return {
            rsi, rsiSlope, macdHistogram, macdCrossover, priceVsEma, trendStrength,
            williamsR, stochK, stochD, adxStrength, emaDistance12, emaDistance26,
        };
    }

    /** @private */
    _extractVolume(window: CandleInput[], last: CandleInput, ind: IndicatorValues): VolumeFeatures {
        const vols = window.map(c => c.volume);
        const avgVol = vols.reduce((s, v) => s + v, 0) / (vols.length || 1);

        const volumeRatio = avgVol > 0 ? last.volume / avgVol : 1;
        const volumeSpike = Math.max(volumeRatio, 1);

        // OBV trend (normalized)
        const obvTrend = ind.obv != null ? Math.sign(ind.obv) * Math.min(Math.abs(ind.obv) / (avgVol * 10 || 1), 1) : 0;

        // Buy pressure estimate (close position within high-low range)
        const range = last.high - last.low;
        const buyPressure = range > 0 ? (last.close - last.low) / range : 0.5;

        // v2: VWAP deviation
        const vwap = ind.vwap ?? this._calcVWAP(window);
        const vwapDeviation = vwap > 0 ? (last.close - vwap) / vwap : 0;

        // v2: Volume trend (5-bar slope)
        const volumeTrend5 = this._calcVolumeTrend(window, 5);

        // v2: Money Flow Ratio (approximate MFI)
        const moneyFlowRatio = this._calcMoneyFlowRatio(window);

        return { volumeRatio, obvTrend, volumeSpike, buyPressure, vwapDeviation, volumeTrend5, moneyFlowRatio };
    }

    /** @private */
    _extractPrice(window: CandleInput[], last: CandleInput, allCandles: CandleInput[]): PriceFeatures {
        const n = window.length;
        const prevClose = (idx: number) => window[Math.max(0, n - 1 - idx)]?.close || last.close;

        const returns1 = last.close / (prevClose(1) || 1) - 1;
        const returns3 = last.close / (prevClose(3) || 1) - 1;
        const returns5 = last.close / (prevClose(5) || 1) - 1;
        const returns10 = last.close / (prevClose(Math.min(10, n - 1)) || 1) - 1;
        const returns20 = last.close / (prevClose(Math.min(20, n - 1)) || 1) - 1;

        const range = last.high - last.low || 1;
        const bodyRatio = Math.abs(last.close - last.open) / range;
        const wickRatio = (last.high - Math.max(last.open, last.close)) / range;
        const lowerWickRatio = (Math.min(last.open, last.close) - last.low) / range;

        // v2: Pivot proximity
        const pivotProximity = this._calcPivotProximity(window, last);

        // v2: Fibonacci proximity (38.2% and 61.8%)
        const { fib382, fib618 } = this._calcFibProximity(allCandles, last);

        // v2: Consecutive same-direction closes
        const consecutiveDirection = this._calcConsecutiveDirection(window);

        return {
            returns1, returns3, returns5, returns10, returns20,
            bodyRatio, wickRatio, lowerWickRatio,
            pivotProximity, fib382, fib618, consecutiveDirection,
        };
    }

    // ─── v2 Feature Methods ─────────────────────────────────────

    /** Williams %R: ((Highest High - Close) / (Highest High - Lowest Low)) × -100 */
    _calcWilliamsR(window: CandleInput[], period = 14): number {
        const slice = window.slice(-period);
        if (slice.length < 2) return -50;
        const hh = Math.max(...slice.map(c => c.high));
        const ll = Math.min(...slice.map(c => c.low));
        const range = hh - ll;
        if (range === 0) return -50;
        return ((hh - slice[slice.length - 1].close) / range) * -100;
    }

    /** Stochastic %K and %D */
    _calcStochastic(window: CandleInput[], kPeriod = 14, dPeriod = 3): { stochK: number; stochD: number } {
        if (window.length < kPeriod) return { stochK: 50, stochD: 50 };
        const kValues: number[] = [];
        for (let i = kPeriod - 1; i < window.length; i++) {
            const slice = window.slice(i - kPeriod + 1, i + 1);
            const hh = Math.max(...slice.map(c => c.high));
            const ll = Math.min(...slice.map(c => c.low));
            const range = hh - ll;
            kValues.push(range > 0 ? ((slice[slice.length - 1].close - ll) / range) * 100 : 50);
        }
        const stochK = kValues[kValues.length - 1];
        const dSlice = kValues.slice(-dPeriod);
        const stochD = dSlice.reduce((s, v) => s + v, 0) / dSlice.length;
        return { stochK, stochD };
    }

    /** ADX approximation via directional movement */
    _calcADX(window: CandleInput[], period = 14): number {
        if (window.length < period + 1) return 25; // Neutral
        let plusDM = 0, minusDM = 0, trSum = 0;
        for (let i = 1; i < Math.min(window.length, period + 1); i++) {
            const upMove = window[i].high - window[i - 1].high;
            const downMove = window[i - 1].low - window[i].low;
            plusDM += (upMove > downMove && upMove > 0) ? upMove : 0;
            minusDM += (downMove > upMove && downMove > 0) ? downMove : 0;
            const tr = Math.max(
                window[i].high - window[i].low,
                Math.abs(window[i].high - window[i - 1].close),
                Math.abs(window[i].low - window[i - 1].close),
            );
            trSum += tr;
        }
        if (trSum === 0) return 25;
        const plusDI = (plusDM / trSum) * 100;
        const minusDI = (minusDM / trSum) * 100;
        const diSum = plusDI + minusDI;
        const dx = diSum > 0 ? (Math.abs(plusDI - minusDI) / diSum) * 100 : 0;
        return dx;
    }

    /** EMA distance: (close - EMA(n)) / close */
    _emaDistance(closes: number[], period: number, currentClose: number): number {
        if (closes.length < period) return 0;
        const k = 2 / (period + 1);
        let ema = closes[0];
        for (let i = 1; i < closes.length; i++) {
            ema = closes[i] * k + ema * (1 - k);
        }
        return currentClose > 0 ? (currentClose - ema) / currentClose : 0;
    }

    /** ATR(5) / ATR(20) — expanding vs contracting volatility */
    _calcATRExpansion(candles: CandleInput[]): number {
        if (candles.length < 21) return 1;
        const calcATR = (slice: CandleInput[]) => {
            let sum = 0;
            for (let i = 1; i < slice.length; i++) {
                sum += Math.max(
                    slice[i].high - slice[i].low,
                    Math.abs(slice[i].high - slice[i - 1].close),
                    Math.abs(slice[i].low - slice[i - 1].close),
                );
            }
            return sum / (slice.length - 1);
        };
        const atr5 = calcATR(candles.slice(-6));
        const atr20 = calcATR(candles.slice(-21));
        return atr20 > 0 ? atr5 / atr20 : 1;
    }

    /** Volatility regime: percentile rank of recent vol vs trailing 50 bars */
    _calcVolatilityRegime(candles: CandleInput[]): number {
        if (candles.length < 20) return 0.5;
        const trailingCount = Math.min(50, candles.length);
        const trailing = candles.slice(-trailingCount);
        const ranges = trailing.map(c => (c.high - c.low) / (c.close || 1));
        const currentRange = ranges[ranges.length - 1];
        const below = ranges.filter(r => r < currentRange).length;
        return below / ranges.length;
    }

    /** Simple RSI calculation when external indicator not available */
    _calcRSI(window: CandleInput[], period = 14): number {
        if (window.length < period + 1) return 50;
        let gainSum = 0, lossSum = 0;
        for (let i = window.length - period; i < window.length; i++) {
            const delta = window[i].close - window[i - 1].close;
            if (delta > 0) gainSum += delta;
            else lossSum -= delta;
        }
        const avgGain = gainSum / period;
        const avgLoss = lossSum / period;
        if (avgLoss === 0) return 100;
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }

    /** Approximate VWAP from window */
    _calcVWAP(window: CandleInput[]): number {
        let typicalPriceVol = 0;
        let totalVol = 0;
        for (const c of window) {
            const tp = (c.high + c.low + c.close) / 3;
            typicalPriceVol += tp * c.volume;
            totalVol += c.volume;
        }
        return totalVol > 0 ? typicalPriceVol / totalVol : 0;
    }

    /** 5-bar volume slope (normalized) */
    _calcVolumeTrend(window: CandleInput[], bars = 5): number {
        const slice = window.slice(-bars);
        if (slice.length < 2) return 0;
        const avgVol = slice.reduce((s, c) => s + c.volume, 0) / slice.length;
        if (avgVol === 0) return 0;
        // Linear regression slope (simplified)
        let sumXY = 0, sumX = 0, sumY = 0, sumXX = 0;
        for (let i = 0; i < slice.length; i++) {
            sumX += i;
            sumY += slice[i].volume;
            sumXY += i * slice[i].volume;
            sumXX += i * i;
        }
        const n = slice.length;
        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX || 1);
        return clamp(slope / avgVol, -1, 1);
    }

    /** Money Flow Ratio (approximate MFI) */
    _calcMoneyFlowRatio(window: CandleInput[]): number {
        let posFlow = 0, negFlow = 0;
        for (let i = 1; i < window.length; i++) {
            const tp = (window[i].high + window[i].low + window[i].close) / 3;
            const prevTp = (window[i - 1].high + window[i - 1].low + window[i - 1].close) / 3;
            const mf = tp * window[i].volume;
            if (tp > prevTp) posFlow += mf;
            else if (tp < prevTp) negFlow += mf;
        }
        const total = posFlow + negFlow;
        return total > 0 ? posFlow / total : 0.5;
    }

    /** Pivot proximity: distance to classic pivot (H+L+C)/3 from previous bar */
    _calcPivotProximity(window: CandleInput[], last: CandleInput): number {
        if (window.length < 2) return 0;
        const prev = window[window.length - 2];
        const pivot = (prev.high + prev.low + prev.close) / 3;
        return pivot > 0 ? (last.close - pivot) / pivot : 0;
    }

    /** Fibonacci 38.2% and 61.8% proximity from recent swing */
    _calcFibProximity(candles: CandleInput[], last: CandleInput): { fib382: number; fib618: number } {
        const slice = candles.slice(-50);
        if (slice.length < 10) return { fib382: 0, fib618: 0 };
        const high = Math.max(...slice.map(c => c.high));
        const low = Math.min(...slice.map(c => c.low));
        const range = high - low;
        if (range === 0) return { fib382: 0, fib618: 0 };

        const level382 = high - range * 0.382;
        const level618 = high - range * 0.618;

        return {
            fib382: (last.close - level382) / (last.close || 1),
            fib618: (last.close - level618) / (last.close || 1),
        };
    }

    /** Count consecutive same-direction closes (positive = up, negative = down) */
    _calcConsecutiveDirection(window: CandleInput[]): number {
        if (window.length < 2) return 0;
        let count = 0;
        const lastDir = window[window.length - 1].close >= window[window.length - 2].close ? 1 : -1;
        for (let i = window.length - 1; i >= 1; i--) {
            const dir = window[i].close >= window[i - 1].close ? 1 : -1;
            if (dir === lastDir) count++;
            else break;
        }
        return count * lastDir;
    }

    // ─── Fallback Calculations ──────────────────────────────────

    /** @private */
    _calcATRRatio(window: CandleInput[]): number {
        if (window.length < 2) return 0;
        let sum = 0;
        for (let i = 1; i < window.length; i++) {
            const tr = Math.max(
                window[i].high - window[i].low,
                Math.abs(window[i].high - window[i - 1].close),
                Math.abs(window[i].low - window[i - 1].close),
            );
            sum += tr;
        }
        const atr = sum / (window.length - 1);
        return atr / (window[window.length - 1].close || 1);
    }

    /** @private */
    _calcBollingerWidth(window: CandleInput[]): number {
        if (window.length < 2) return 0;
        const closes = window.map(c => c.close);
        const mean = closes.reduce((s, v) => s + v, 0) / closes.length;
        const variance = closes.reduce((s, v) => s + (v - mean) ** 2, 0) / closes.length;
        const sd = Math.sqrt(variance);
        return mean > 0 ? (4 * sd) / mean : 0; // 2σ width / mean
    }
}

// ─── Helpers ────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
}

// ─── Singleton + Exports ──────────────────────────────────────

export const featureExtractor = new _FeatureExtractor();
export { _FeatureExtractor as FeatureExtractor };
export default featureExtractor;
