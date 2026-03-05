// ═══════════════════════════════════════════════════════════════════
// charEdge — Financial Disclaimer Component
//
// SEC/FCA-compliant disclaimer shown on all AI-powered features.
// Two variants:
//   'banner' — full-width bar with icon (for page tops)
//   'inline' — compact text (for embedding inside cards)
//
// Phase 1 Task 1.1.1: Financial disclaimer on ALL AI features
// ═══════════════════════════════════════════════════════════════════

import { C, F } from '../../../constants.js';

const DISCLAIMER_TEXT =
    'charEdge does not provide financial advice, trading recommendations, or investment guidance. All insights are for educational and informational purposes only. Always do your own research and consult a qualified financial advisor before making investment decisions.';

const DISCLAIMER_SHORT =
    'For educational purposes only — not financial advice.';

/**
 * Financial disclaimer component for AI features.
 * @param {'banner' | 'inline'} [variant='banner'] - Display variant
 * @param {Object} [style] - Additional styles
 */
export default function FinancialDisclaimer({ variant = 'banner', style }) {
    if (variant === 'inline') {
        return (
            <div
                style={{
                    fontSize: 10,
                    fontFamily: F,
                    color: C.t3,
                    lineHeight: 1.4,
                    padding: '6px 0',
                    borderTop: `1px solid ${C.bd}`,
                    marginTop: 8,
                    ...style,
                }}
            >
                ⚖️ {DISCLAIMER_SHORT}
            </div>
        );
    }

    // Banner variant (default)
    return (
        <div
            role="note"
            aria-label="Financial disclaimer"
            style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                padding: '10px 14px',
                marginBottom: 16,
                borderRadius: 10,
                background: `${C.y}08`,
                border: `1px solid ${C.y}20`,
                ...style,
            }}
        >
            <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>⚠️</span>
            <span style={{ fontSize: 11, fontFamily: F, color: C.t3, lineHeight: 1.5 }}>
                <strong style={{ color: C.t2 }}>For educational purposes only.</strong>{' '}
                {DISCLAIMER_TEXT}
            </span>
        </div>
    );
}

export { FinancialDisclaimer, DISCLAIMER_TEXT, DISCLAIMER_SHORT };
