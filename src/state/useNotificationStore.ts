// @ts-check
// ═══════════════════════════════════════════════════════════════════
// charEdge — Notification Store (Zustand + Persist)
//
// Manages social notifications: likes, follows, comments,
// prediction results. Generates mock activity data.
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const NOW = Date.now();
const HOUR = 3600_000;
const MIN = 60_000;

const INITIAL_NOTIFICATIONS = [
  {
    id: 'n1',
    type: 'like',
    actorName: 'Emma Chen',
    actorAvatar: '🐍',
    message: 'liked your chart idea "BTC breakout from 4h consolidation"',
    timestamp: NOW - 12 * MIN,
    read: false,
  },
  {
    id: 'n2',
    type: 'follow',
    actorName: 'Marcus Rivera',
    actorAvatar: '📈',
    message: 'started following you',
    timestamp: NOW - 45 * MIN,
    read: false,
  },
  {
    id: 'n3',
    type: 'comment',
    actorName: 'Priya Sharma',
    actorAvatar: '💎',
    message: 'commented on your chart idea: "Great analysis, that level is key"',
    timestamp: NOW - 2 * HOUR,
    read: false,
  },
  {
    id: 'n4',
    type: 'prediction',
    actorName: 'System',
    actorAvatar: '🔮',
    message: 'Prediction "BTC hits $100k" — you voted Yes (71.9% agree)',
    timestamp: NOW - 3 * HOUR,
    read: true,
  },
  {
    id: 'n5',
    type: 'like',
    actorName: 'Dan Brooks',
    actorAvatar: '🦁',
    message: 'liked your chart idea "ETH weekly structure"',
    timestamp: NOW - 5 * HOUR,
    read: true,
  },
  {
    id: 'n6',
    type: 'milestone',
    actorName: 'charEdge',
    actorAvatar: '🏆',
    message: 'You reached Gold League! Keep climbing the Alpha Board.',
    timestamp: NOW - 8 * HOUR,
    read: true,
  },
  {
    id: 'n7',
    type: 'comment',
    actorName: 'Sofia Navarro',
    actorAvatar: '⚡',
    message: 'replied to your comment: "Totally agree, patience is everything"',
    timestamp: NOW - 12 * HOUR,
    read: true,
  },
  {
    id: 'n8',
    type: 'follow',
    actorName: 'Alex Kim',
    actorAvatar: '🔥',
    message: 'started following you',
    timestamp: NOW - 18 * HOUR,
    read: true,
  },
];

export const useNotificationStore = create(
  persist(
    (set, get) => ({
      notifications: INITIAL_NOTIFICATIONS,

      // Sprint 19: Notification batching mode
      digestMode: 'instant', // 'instant' | 'daily'

      get unreadCount() {
        return get().notifications.filter((n) => !n.read).length;
      },

      getUnreadCount: () => get().notifications.filter((n) => !n.read).length,

      markAsRead: (id) => {
        set({
          notifications: get().notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        });
      },

      markAllRead: () => {
        set({
          notifications: get().notifications.map((n) => ({ ...n, read: true })),
        });
      },

      addNotification: (notif) => {
        const id = `n_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
        set({
          notifications: [
            { ...notif, id, timestamp: Date.now(), read: false },
            ...get().notifications,
          ].slice(0, 50), // Keep last 50
        });
      },

      clearAll: () => set({ notifications: [] }),

      // Sprint 19: Digest mode actions
      setDigestMode: (mode) => set({ digestMode: mode }),

      /** Get grouped digest of unread notifications from last 24h */
      getDigest: () => {
        const cutoff = Date.now() - 86_400_000;
        const recent = get().notifications.filter((n) => n.timestamp >= cutoff);
        const byType = {};
        for (const n of recent) {
          if (!byType[n.type]) byType[n.type] = [];
          byType[n.type].push(n);
        }
        return byType;
      },
    }),
    {
      name: 'tf-notifications-store',
    }
  )
);

export default useNotificationStore;
