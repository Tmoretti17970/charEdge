// ═══════════════════════════════════════════════════════════════════
// charEdge — Push Registration Component
//
// Client-side component that requests notification permission and
// registers the browser push subscription on mount.
// Mounted in the App shell — activates after user logs in.
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useRef } from 'react';
import { useAlertStore, requestNotificationPermission } from '../../../state/useAlertStore';

export default function PushRegistration() {
    const pushSubscribed = useAlertStore((s) => s.pushSubscribed);
    const subscribeToPush = useAlertStore((s) => s.subscribeToPush);
    const attempted = useRef(false);

    useEffect(() => {
        if (pushSubscribed || attempted.current) return;
        if (typeof window === 'undefined') return;
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

        attempted.current = true;

        // Request notification permission first
        requestNotificationPermission();

        // Delay push subscription to avoid blocking initial load
        const timer = setTimeout(() => {
            subscribeToPush();
        }, 3000);

        return () => clearTimeout(timer);
    }, [pushSubscribed, subscribeToPush]);

    // This component renders nothing — it's a side-effect hook
    return null;
}
