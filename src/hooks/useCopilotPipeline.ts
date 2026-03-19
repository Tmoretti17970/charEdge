// ═══════════════════════════════════════════════════════════════════
// charEdge — Co-Pilot Pipeline Hook (Task 4.2.2)
//
// Orchestrates: bars → FeatureExtractor → feature set → display
// Debounced (2s) to avoid excessive computation.
// Optional LLM call on user request.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from 'react';
import { useChartCoreStore } from '../state/chart/useChartCoreStore';
import { useChartToolsStore } from '../state/chart/useChartToolsStore';
import { featureExtractor } from '../charting_library/ai/FeatureExtractor.js';
import type { FeatureSet } from '../charting_library/ai/FeatureExtractor.js';

// ─── Types ──────────────────────────────────────────────────────

export interface CopilotInsight {
    /** Current feature analysis */
    features: FeatureSet | null;
    /** Momentum summary label */
    momentumLabel: string;
    /** Volatility summary label */
    volatilityLabel: string;
    /** Volume summary label */
    volumeLabel: string;
    /** Overall market condition label */
    conditionLabel: string;
    /** LLM narrative (null until requested) */
    narrative: string | null;
    /** Whether an LLM call is in progress */
    loading: boolean;
    /** Timestamp of last feature update */
    updatedAt: number;
}

// ─── Helpers ────────────────────────────────────────────────────

function classifyMomentum(rsi: number, trend: number): string {
    if (rsi > 70) return '🔴 Overbought';
    if (rsi < 30) return '🟢 Oversold';
    if (trend > 0.6) return '📈 Strong Uptrend';
    if (trend < -0.6) return '📉 Strong Downtrend';
    if (Math.abs(trend) < 0.2) return '➡️ Neutral';
    return trend > 0 ? '📈 Mild Bullish' : '📉 Mild Bearish';
}

function classifyVolatility(atrRatio: number, bbWidth: number): string {
    if (atrRatio > 2.0 || bbWidth > 0.08) return '🌋 High Volatility';
    if (atrRatio < 0.5 && bbWidth < 0.02) return '😴 Low Volatility';
    return '⚡ Normal Volatility';
}

function classifyVolume(volumeRatio: number, spike: number): string {
    if (spike > 2.0) return '🚀 Volume Spike';
    if (volumeRatio > 1.5) return '📊 Above Average';
    if (volumeRatio < 0.5) return '🔇 Below Average';
    return '📊 Normal Volume';
}

function classifyCondition(momentum: string, volatility: string): string {
    if (volatility.includes('High') && momentum.includes('Overbought'))
        return '⚠️ Potential Reversal';
    if (volatility.includes('Low') && momentum.includes('Neutral'))
        return '💤 Consolidation';
    if (momentum.includes('Strong Up'))
        return '🚀 Trending Up';
    if (momentum.includes('Strong Down'))
        return '🔻 Trending Down';
    return '📊 Mixed Signals';
}

// ─── Constants ──────────────────────────────────────────────────

const DEBOUNCE_MS = 2000;
const MIN_BARS_FOR_ANALYSIS = 25;

// ─── Hook ───────────────────────────────────────────────────────

export function useCopilotPipeline(): CopilotInsight & {
    requestNarrative: () => Promise<void>;
    requestPulse: () => Promise<string>;
    requestKeyLevels: () => Promise<unknown[]>;
    requestSetupGrade: () => Promise<unknown>;
} {
    const [insight, setInsight] = useState<CopilotInsight>({
        features: null,
        momentumLabel: '—',
        volatilityLabel: '—',
        volumeLabel: '—',
        conditionLabel: '—',
        narrative: null,
        loading: false,
        updatedAt: 0,
    });

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Subscribe to bar data changes (debounced)
    useEffect(() => {
        const unsub = useChartCoreStore.subscribe((state: unknown) => {
            const bars = state.data;
            if (!bars || bars.length < MIN_BARS_FOR_ANALYSIS) return;

            // Debounce feature extraction
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => {
                try {
                    const features = featureExtractor.extract(bars);
                    const momentumLabel = classifyMomentum(
                        features.momentum.rsi,
                        features.momentum.trendStrength,
                    );
                    const volatilityLabel = classifyVolatility(
                        features.volatility.atrRatio,
                        features.volatility.bollingerWidth,
                    );
                    const volumeLabel = classifyVolume(
                        features.volume.volumeRatio,
                        features.volume.volumeSpike,
                    );
                    const conditionLabel = classifyCondition(momentumLabel, volatilityLabel);

                    setInsight((prev) => ({
                        ...prev,
                        features,
                        momentumLabel,
                        volatilityLabel,
                        volumeLabel,
                        conditionLabel,
                        updatedAt: Date.now(),
                    }));
                } catch {
                    // Feature extraction is best-effort
                }
            }, DEBOUNCE_MS);
        });

        return () => {
            unsub();
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, []);

    // On-demand LLM narrative (Sprint 63: routes through AIRouter)
    const requestNarrative = useCallback(async () => {
        setInsight((prev) => ({ ...prev, loading: true }));
        try {
            const state = useChartCoreStore.getState() as unknown;
            const bars = state.data || [];
            const features = insight.features;

            if (bars.length < MIN_BARS_FOR_ANALYSIS || !features) {
                setInsight((prev) => ({
                    ...prev,
                    narrative: 'No data available for analysis.',
                    loading: false,
                }));
                return;
            }

            // Sprint 63: Try AIRouter first (WebLLM → cloud → local)
            try {
                const { aiRouter } = await import('../ai/AIRouter');
                const prompt = `Market Analysis for ${state.symbol || 'Chart'} (${state.tf || '—'}):
Momentum: ${insight.momentumLabel} (RSI: ${features.momentum?.rsi?.toFixed(1)})
Volatility: ${insight.volatilityLabel} (ATR ratio: ${features.volatility?.atrRatio?.toFixed(2)})
Volume: ${insight.volumeLabel}
Trend: ${features.momentum?.trendStrength?.toFixed(2)}

Give a 2-3 sentence market narrative covering current conditions, key levels to watch, and what to expect next.`;

                const result = await aiRouter.route({
                    type: 'narrate',
                    messages: [
                        { role: 'system', content: 'You are a concise market analyst. Give brief, actionable market narratives.' },
                        { role: 'user', content: prompt },
                    ],
                    maxTokens: 200,
                    temperature: 0.4,
                });

                if (result.tier !== 'L1') {
                    setInsight((prev) => ({ ...prev, narrative: result.content, loading: false }));
                    return;
                }
            } catch { /* AIRouter not available, fall through */ }

            // Fallback: LocalInsightEngine
            const { localInsightEngine } = await import('../charting_library/ai/LocalInsightEngine.js');
            const result = localInsightEngine.generateDetailedNarrative(
                features, state.symbol || 'Chart', state.tf || '—', bars,
            );
            setInsight((prev) => ({ ...prev, narrative: result.narrative, loading: false }));
        } catch {
            setInsight((prev) => ({
                ...prev,
                narrative: 'Analysis unavailable — check LLM configuration in Settings.',
                loading: false,
            }));
        }
    }, [insight.features, insight.momentumLabel, insight.volatilityLabel, insight.volumeLabel, insight.conditionLabel]);

    // Quick one-liner market state
    const requestPulse = useCallback(async () => {
        const features = insight.features;
        if (!features) return '';
        const { localInsightEngine } = await import('../charting_library/ai/LocalInsightEngine.js');
        const state = useChartCoreStore.getState() as unknown;
        const { text } = localInsightEngine.generateMarketPulse(features, state.symbol, state.tf);
        return text;
    }, [insight.features]);

    // Key S&R levels
    const requestKeyLevels = useCallback(async () => {
        const state = useChartCoreStore.getState() as unknown;
        const bars = state.data || [];
        if (bars.length < 10) return [];
        const { localInsightEngine } = await import('../charting_library/ai/LocalInsightEngine.js');
        return localInsightEngine.generateKeyLevels(bars);
    }, []);

    // Setup quality grade
    const requestSetupGrade = useCallback(async () => {
        const features = insight.features;
        if (!features) return null;
        const { localInsightEngine } = await import('../charting_library/ai/LocalInsightEngine.js');
        return localInsightEngine.gradeSetup(features);
    }, [insight.features]);

    // v2: Candlestick pattern detection
    const requestPatterns = useCallback(async () => {
        const state = useChartCoreStore.getState() as unknown;
        const bars = (state as any).data || [];
        if (bars.length < 5) return [];
        const { localInsightEngine } = await import('../charting_library/ai/LocalInsightEngine.js');
        return localInsightEngine.detectPatterns(bars);
    }, []);

    // v2: Divergence detection
    const requestDivergences = useCallback(async () => {
        const features = insight.features;
        if (!features) return [];
        const state = useChartCoreStore.getState() as unknown;
        const bars = (state as any).data || [];
        if (bars.length < 20) return [];
        const { localInsightEngine } = await import('../charting_library/ai/LocalInsightEngine.js');
        return localInsightEngine.detectDivergences(bars, features);
    }, [insight.features]);

    // v2: Risk assessment
    const requestRisk = useCallback(async () => {
        const features = insight.features;
        if (!features) return { score: 0, level: 'LOW', emoji: '🟢', risks: [] };
        const { localInsightEngine } = await import('../charting_library/ai/LocalInsightEngine.js');
        return localInsightEngine.assessRisk(features);
    }, [insight.features]);

    return {
        ...insight,
        requestNarrative,
        requestPulse,
        requestKeyLevels,
        requestSetupGrade,
        requestPatterns,
        requestDivergences,
        requestRisk,
    };
}

export default useCopilotPipeline;
