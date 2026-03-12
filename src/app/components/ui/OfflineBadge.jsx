// ═══════════════════════════════════════════════════════════════════
// charEdge — Offline Badge (Task 2.3.12)
//
// Small amber badge indicating offline state with cached data info.
// Positioned near ConnectionStatus component.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useState, useEffect } from 'react';
import offlineManager from '../../../data/engine/OfflineManager';
import styles from './OfflineBadge.module.css';

function OfflineBadge() {
    const [isOffline, setIsOffline] = useState(offlineManager.isOffline);
    const [duration, setDuration] = useState('');

    useEffect(() => {
        const unsub = offlineManager.subscribe((offline) => {
            setIsOffline(offline);
        });
        return unsub;
    }, []);

    // Update duration display every 10s while offline
    useEffect(() => {
        if (!isOffline) return;
        const interval = setInterval(() => {
            setDuration(offlineManager.offlineDuration);
        }, 10_000);
        setDuration(offlineManager.offlineDuration);
        return () => clearInterval(interval);
    }, [isOffline]);

    if (!isOffline) return null;

    return (
        <div className={styles.badge} title="Network is offline. Showing cached data.">
            <span className={styles.dot} />
            <span className={styles.label}>Offline</span>
            {duration && <span className={styles.duration}> · {duration}</span>}
            {offlineManager.pendingActions > 0 && (
                <span className={styles.pending}> · {offlineManager.pendingActions} queued</span>
            )}
        </div>
    );
}

export default React.memo(OfflineBadge);