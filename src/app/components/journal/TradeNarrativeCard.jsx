// ═══════════════════════════════════════════════════════════════════
// charEdge — TradeNarrativeCard (Task 4.2.3)
//
// Renders in TradingJournalInspector trade detail view.
// Generates a human-readable story of the trade using LLM or
// template-based fallback. Caches narratives per trade ID.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useCallback, useEffect } from 'react';

const FONT = 'var(--forge-font, Inter, sans-serif)';
const MONO = 'var(--forge-mono, "JetBrains Mono", monospace)';

const CACHE_KEY = 'charEdge-trade-narratives';

// ─── Template Fallback ──────────────────────────────────────────

function generateTemplateNarrative(trade) {
    if (!trade) return 'No trade data available.';

    const side = trade.side || 'long';
    const symbol = trade.symbol || 'Unknown';
    const entry = trade.entry || trade.entryPrice || 0;
    const exit = trade.exit || trade.exitPrice || 0;
    const pnl = trade.pnl || 0;
    const pnlPct = entry > 0 ? ((exit - entry) / entry * 100 * (side === 'short' ? -1 : 1)).toFixed(2) : '0.00';
    const fees = trade.fees || trade.commission || 0;
    const setup = trade.setupType || trade.playbook || 'unclassified';
    const tags = trade.tags || [];
    const notes = trade.notes || '';
    const duration = trade.holdTime || trade.duration || 'unknown';

    const outcome = pnl >= 0 ? 'winning' : 'losing';
    const sideEmoji = side === 'long' ? '📈' : '📉';
    const outcomeEmoji = pnl >= 0 ? '✅' : '❌';

    const lines = [
        `${sideEmoji} **${side.toUpperCase()} ${symbol}** — ${outcomeEmoji} ${outcome} trade`,
        '',
        `Entered at **$${entry.toFixed(2)}** and exited at **$${exit.toFixed(2)}** for a **${pnl >= 0 ? '+' : ''}${pnlPct}%** move ($${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}).`,
    ];

    if (fees > 0) {
        lines.push(`Fees/commissions: **$${fees.toFixed(2)}** (${entry > 0 ? ((fees / Math.abs(pnl + fees)) * 100).toFixed(1) : '0'}% of gross).`);
    }

    if (setup !== 'unclassified') {
        lines.push('', `**Setup:** ${setup}`);
    }

    if (tags.length > 0) {
        lines.push(`**Tags:** ${tags.join(', ')}`);
    }

    if (trade.mfe != null && trade.mae != null) {
        const eff = trade.efficiencyRatio != null ? (trade.efficiencyRatio * 100).toFixed(0) : '—';
        lines.push('', `**MFE/MAE:** The trade went as far as +$${trade.mfe.toFixed(2)} in your favor and -$${trade.mae.toFixed(2)} against you. You captured **${eff}%** of the favorable move.`);
    }

    if (notes) {
        lines.push('', `**Notes:** "${notes}"`);
    }

    // Coaching hint
    if (pnl < 0) {
        lines.push('', '💡 *Consider reviewing entry timing and stop placement for this setup type.*');
    } else if (trade.efficiencyRatio != null && trade.efficiencyRatio < 0.5) {
        lines.push('', '💡 *You captured less than 50% of the favorable move — consider trailing stops to let winners run.*');
    }

    return lines.join('\n');
}

// ─── Cache ──────────────────────────────────────────────────────

function getCachedNarrative(tradeId) {
    try {
        const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
        return cache[tradeId] || null;
    } catch { return null; }
}

function setCachedNarrative(tradeId, narrative) {
    try {
        const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
        cache[tradeId] = narrative;
        // Keep only last 50
        const keys = Object.keys(cache);
        if (keys.length > 50) {
            for (const k of keys.slice(0, keys.length - 50)) delete cache[k];
        }
        localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch { /* */ }
}

// ─── Component ──────────────────────────────────────────────────

export default function TradeNarrativeCard({ trade }) {
    const [narrative, setNarrative] = useState(null);
    const [loading, setLoading] = useState(false);
    const [isLLM, setIsLLM] = useState(false);

    // Check cache on mount
    useEffect(() => {
        if (!trade?.id) return;
        const cached = getCachedNarrative(trade.id);
        if (cached) {
            setNarrative(cached.text);
            setIsLLM(cached.isLLM || false);
        }
    }, [trade?.id]);

    const handleGenerate = useCallback(async () => {
        if (!trade) return;
        setLoading(true);

        try {
            // Try LLM first
            const { llmService } = await import('../../../intelligence/LLMService.ts');
            if (llmService.isAvailable()) {
                const response = await llmService.analyzeTradeSnapshot(trade);
                setNarrative(response.content);
                setIsLLM(true);
                setCachedNarrative(trade.id, { text: response.content, isLLM: true });
            } else {
                // Template fallback (prioritized per user preference)
                const text = generateTemplateNarrative(trade);
                setNarrative(text);
                setIsLLM(false);
                setCachedNarrative(trade.id, { text, isLLM: false });
            }
        } catch {
            // Fallback to template
            const text = generateTemplateNarrative(trade);
            setNarrative(text);
            setIsLLM(false);
            setCachedNarrative(trade.id, { text, isLLM: false });
        }

        setLoading(false);
    }, [trade]);

    return (
        <div style={CARD_STYLE}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={LABEL_STYLE}>
                    Trade Narrative
                    {isLLM && <span style={{ marginLeft: 6, fontSize: 9, opacity: 0.5 }}>AI</span>}
                </div>
                {narrative && (
                    <button onClick={handleGenerate} style={REGEN_BTN} disabled={loading}>
                        ↻ Regenerate
                    </button>
                )}
            </div>

            {!narrative && !loading && (
                <button onClick={handleGenerate} style={GEN_BTN}>
                    📝 Generate Narrative
                </button>
            )}

            {loading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                        width: 14, height: 14,
                        border: '2px solid rgba(255,255,255,0.1)',
                        borderTopColor: '#60a5fa',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                    }} />
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: FONT }}>
                        Analyzing trade…
                    </span>
                </div>
            )}

            {narrative && !loading && (
                <div style={{
                    fontSize: 13,
                    color: 'rgba(255,255,255,0.75)',
                    fontFamily: FONT,
                    lineHeight: 1.65,
                    whiteSpace: 'pre-wrap',
                }}>
                    {narrative}
                </div>
            )}

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}

// ─── Styles ─────────────────────────────────────────────────────

const CARD_STYLE = {
    background: 'rgba(20, 20, 30, 0.6)',
    backdropFilter: 'blur(16px) saturate(1.4)',
    WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: 16,
    padding: 20,
};

const LABEL_STYLE = {
    fontSize: 11,
    fontWeight: 600,
    color: 'rgba(255, 255, 255, 0.45)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    fontFamily: 'var(--forge-font, Inter, sans-serif)',
};

const GEN_BTN = {
    width: '100%',
    padding: '10px 16px',
    borderRadius: 10,
    background: 'rgba(96, 165, 250, 0.08)',
    border: '1px solid rgba(96, 165, 250, 0.15)',
    color: '#60a5fa',
    fontSize: 13,
    fontWeight: 600,
    fontFamily: 'var(--forge-font, Inter, sans-serif)',
    cursor: 'pointer',
    transition: 'background 0.15s',
};

const REGEN_BTN = {
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.35)',
    fontSize: 10,
    cursor: 'pointer',
    fontFamily: 'var(--forge-font, Inter, sans-serif)',
};

export { TradeNarrativeCard };
