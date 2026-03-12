// ═══════════════════════════════════════════════════════════════════
// charEdge — Freshness Badge (Task 2.4.13)
//
// Subtle indicator showing when chart data is being freshened.
// Displays "Updating…" while cached data is being refreshed
// from the live API. Disappears when data is current.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import styles from './FreshnessBadge.module.css';

function FreshnessBadge({ isFreshening = false, source = 'live' }) {
    // Don't show when data is live and current
    if (!isFreshening && source === 'live') return null;

    if (isFreshening) {
        return (
            <div className={styles.badge} title="Loading latest data from server…">
                <span className={styles.spinner} />
                <span className={styles.label}>Updating…</span>
            </div>
        );
    }

    if (source === 'cache') {
        return (
            <div className={`${styles.badge} ${styles.cached}`} title="Showing cached data">
                <span className={styles.label}>Cached</span>
            </div>
        );
    }

    return null;
}

export default React.memo(FreshnessBadge);