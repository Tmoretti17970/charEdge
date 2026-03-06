// ═══════════════════════════════════════════════════════════════════
// charEdge — Co-Pilot Pipeline Hook (Task 4.2.2)
//
// Orchestrates: bars → FeatureExtractor → feature set → display
// Debounced (2s) to avoid excessive computation.
// Optional LLM call on user request.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from 'react';
import { useChartStore } from '../state/useChartStore.js';
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
        const unsub = useChartStore.subscribe((state: any) => {
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

    // On-demand LLM narrative
    const requestNarrative = useCallback(async () => {
        setInsight((prev) => ({ ...prev, loading: true }));
        try {
            // Dynamic import to avoid loading LLM code unless needed
            const { llmService } = await import('../intelligence/LLMService.js');
            const state = useChartStore.getState() as any;
            const bars = state.data || [];

            if (!llmService.isAvailable || bars.length < MIN_BARS_FOR_ANALYSIS) {
                // Generate template-based insight instead
                const features = insight.features;
                if (features) {
                    const narrative = [
                        `📊 **${state.symbol || 'Chart'} Analysis** (${state.tf || '—'})`,
                        '',
                        `**Momentum:** RSI at ${features.momentum.rsi.toFixed(0)} — ${insight.momentumLabel}`,
                        `**Volatility:** ATR ratio ${features.volatility.atrRatio.toFixed(2)} — ${insight.volatilityLabel}`,
                        `**Volume:** ${features.volume.volumeRatio.toFixed(1)}x average — ${insight.volumeLabel}`,
                        '',
                        `**Condition:** ${insight.conditionLabel}`,
                    ].join('\n');
                    setInsight((prev) => ({ ...prev, narrative, loading: false }));
                } else {
                    setInsight((prev) => ({
                        ...prev,
                        narrative: 'No data available for analysis.',
                        loading: false,
                    }));
                }
                return;
            }

            // Build a trade snapshot for LLM analysis
            const { captureSnapshotFromStore } = await import('../hooks/useSnapshotCapture.js');
            const snapshot = captureSnapshotFromStore();
            const response = await llmService.analyzeTradeSnapshot(snapshot as any);
            setInsight((prev) => ({
                ...prev,
                narrative: response.content,
                loading: false,
            }));
        } catch {
            setInsight((prev) => ({
                ...prev,
                narrative: 'Analysis unavailable — check LLM configuration in Settings.',
                loading: false,
            }));
        }
    }, [insight.features, insight.momentumLabel, insight.volatilityLabel, insight.volumeLabel, insight.conditionLabel]);

    return { ...insight, requestNarrative };
}

export default useCopilotPipeline;
