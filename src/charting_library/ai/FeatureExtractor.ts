// ═══════════════════════════════════════════════════════════════════
// charEdge — Feature Extractor (6.1.4)
//
// Extracts numeric feature vectors from OHLCV + indicator data for
// ML models and anomaly detection. All features are normalized to
// comparable scales for downstream consumption.
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
}

export interface MomentumFeatures {
    rsi: number;                // 0-100
    rsiSlope: number;           // RSI change rate
    macdHistogram: number;      // MACD histogram value
    macdCrossover: number;      // 1 = bullish cross, -1 = bearish, 0 = none
    priceVsEma: number;         // (close - EMA) / EMA (% deviation)
    trendStrength: number;      // Abs deviation from 50 RSI (0-50)
}

export interface VolumeFeatures {
    volumeRatio: number;        // Current vol / average vol
    obvTrend: number;           // OBV slope (normalized)
    volumeSpike: number;        // Max(vol / avg, 1) — spike detector
    buyPressure: number;        // Estimated buy pressure 0-1
}

export interface PriceFeatures {
    returns1: number;           // 1-bar return
    returns5: number;           // 5-bar return
    returns20: number;          // 20-bar return
    bodyRatio: number;          // |close - open| / (high - low)
    wickRatio: number;          // Upper wick / (high - low)
}

// ─── Constants ──────────────────────────────────────────────────

const LOOKBACK = 20;
const FEATURE_COUNT = 18; // Total features in the flat vector

// ─── Feature Extractor ──────────────────────────────────────────

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

        const volatility = this._extractVolatility(window, last, ind);
        const momentum = this._extractMomentum(window, last, ind);
        const volume = this._extractVolume(window, last, ind);
        const price = this._extractPrice(window, last);

        // Build flat vector
        const vector = new Float32Array(FEATURE_COUNT);
        let i = 0;
        // Volatility (4)
        vector[i++] = volatility.atrRatio;
        vector[i++] = volatility.bollingerWidth;
        vector[i++] = volatility.highLowRange;
        vector[i++] = volatility.gapFrequency;
        // Momentum (6)
        vector[i++] = momentum.rsi / 100;        // Normalize to 0-1
        vector[i++] = momentum.rsiSlope;
        vector[i++] = momentum.macdHistogram;
        vector[i++] = momentum.macdCrossover;
        vector[i++] = momentum.priceVsEma;
        vector[i++] = momentum.trendStrength / 50; // Normalize to 0-1
        // Volume (4)
        vector[i++] = Math.min(volume.volumeRatio, 5) / 5; // Cap at 5x
        vector[i++] = volume.obvTrend;
        vector[i++] = Math.min(volume.volumeSpike, 5) / 5;
        vector[i++] = volume.buyPressure;
        // Price (4)
        vector[i++] = clamp(price.returns1, -0.1, 0.1) / 0.1;
        vector[i++] = clamp(price.returns5, -0.3, 0.3) / 0.3;
        vector[i++] = price.bodyRatio;
        vector[i++] = price.wickRatio;

        return { volatility, momentum, volume, price, vector, timestamp: Date.now() };
    }

    /**
     * Extract only momentum features (lightweight).
     */
    extractMomentum(candles: CandleInput[], indicators?: IndicatorValues): MomentumFeatures {
        const window = candles.slice(-LOOKBACK);
        const last = window[window.length - 1];
        return this._extractMomentum(window, last, indicators || {});
    }

    // ─── Private Feature Extractors ─────────────────────────────

    /** @private */
    _extractVolatility(window: CandleInput[], last: CandleInput, ind: IndicatorValues): VolatilityFeatures {
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

        return { atrRatio, bollingerWidth, highLowRange, gapFrequency };
    }

    /** @private */
    _extractMomentum(window: CandleInput[], last: CandleInput, ind: IndicatorValues): MomentumFeatures {
        // RSI
        const rsi = ind.rsi ?? 50;

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

        return { rsi, rsiSlope, macdHistogram, macdCrossover, priceVsEma, trendStrength };
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

        return { volumeRatio, obvTrend, volumeSpike, buyPressure };
    }

    /** @private */
    _extractPrice(window: CandleInput[], last: CandleInput): PriceFeatures {
        const n = window.length;
        const prevClose = (idx: number) => window[Math.max(0, n - 1 - idx)]?.close || last.close;

        const returns1 = last.close / (prevClose(1) || 1) - 1;
        const returns5 = last.close / (prevClose(5) || 1) - 1;
        const returns20 = last.close / (prevClose(Math.min(20, n - 1)) || 1) - 1;

        const range = last.high - last.low || 1;
        const bodyRatio = Math.abs(last.close - last.open) / range;
        const wickRatio = (last.high - Math.max(last.open, last.close)) / range;

        return { returns1, returns5, returns20, bodyRatio, wickRatio };
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
