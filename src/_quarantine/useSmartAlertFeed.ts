// ═══════════════════════════════════════════════════════════════════
// charEdge — Smart Alert Feed Store (Phase E5)
//
// Lightweight Zustand store that accumulates live smart alert events
// (volume spikes, pattern completions) from the server.
// SmartAlerts.jsx consumes this instead of mock data.
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';

export interface SmartAlertEvent {
    id: string;
    type: 'price' | 'volume' | 'pattern' | 'earnings' | 'insider' | 'analyst' | 'sentiment';
    symbol: string;
    priority: 'critical' | 'important' | 'fyi';
    message: string;
    time: string;        // ISO string
    outcome: string | null;
}

interface SmartAlertFeedState {
    events: SmartAlertEvent[];
    isLive: boolean;
}

interface SmartAlertFeedActions {
    pushEvent: (event: Omit<SmartAlertEvent, 'id' | 'time'>) => void;
    setLive: (live: boolean) => void;
    clear: () => void;
}

const MAX_EVENTS = 50;

const useSmartAlertFeed = create<SmartAlertFeedState & SmartAlertFeedActions>()((set) => ({
    events: [],
    isLive: false,

    pushEvent: (event) => {
        const entry: SmartAlertEvent = {
            ...event,
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            time: new Date().toISOString(),
        };
        set((s) => ({
            events: [entry, ...s.events].slice(0, MAX_EVENTS),
        }));
    },

    setLive: (live) => set({ isLive: live }),

    clear: () => set({ events: [] }),
}));

export { useSmartAlertFeed };
export default useSmartAlertFeed;
