// ═══════════════════════════════════════════════════════════════════
// charEdge — BotStatsSkeleton
//
// Skeleton placeholder for the arbitrage/bot monitoring panel.
// Uses unified .tf-skeleton system with deferred loading.
// Audit Item 10: "No skeleton exists for arbitrage/bot monitoring panel"
// ═══════════════════════════════════════════════════════════════════

import { C } from '../../../constants.js';

/**
 * BotStatsSkeleton — loading placeholder for bot/arbitrage stats panel.
 * Shows shimmer placeholders for bot status, P&L, and spread metrics.
 */
export default function BotStatsSkeleton() {
    return (
        <div
            role="status"
            aria-busy="true"
            aria-label="Loading bot statistics"
            style={{
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
            }}
        >
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="tf-skeleton tf-skeleton-deferred" style={{ width: 32, height: 32, borderRadius: 8 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div className="tf-skeleton tf-skeleton-deferred" style={{ width: '60%', height: 12, borderRadius: 4 }} />
                    <div className="tf-skeleton tf-skeleton-deferred" style={{ width: '40%', height: 10, borderRadius: 3, animationDelay: '0.05s' }} />
                </div>
            </div>

            {/* Stat cards row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {[0, 1, 2].map((i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 10, background: C.bg2, borderRadius: 8 }}>
                        <div className="tf-skeleton tf-skeleton-deferred" style={{ width: '70%', height: 8, borderRadius: 3, animationDelay: `${i * 0.06}s` }} />
                        <div className="tf-skeleton tf-skeleton-deferred" style={{ width: '50%', height: 14, borderRadius: 4, animationDelay: `${i * 0.06 + 0.03}s` }} />
                    </div>
                ))}
            </div>

            {/* Spread table rows */}
            {[0, 1, 2, 3].map((i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="tf-skeleton tf-skeleton-deferred" style={{ width: 24, height: 24, borderRadius: 6, animationDelay: `${i * 0.04}s` }} />
                    <div className="tf-skeleton tf-skeleton-deferred" style={{ flex: 1, height: 10, borderRadius: 3, animationDelay: `${i * 0.04 + 0.02}s` }} />
                    <div className="tf-skeleton tf-skeleton-deferred" style={{ width: 48, height: 10, borderRadius: 3, animationDelay: `${i * 0.04 + 0.04}s` }} />
                </div>
            ))}
        </div>
    );
}
