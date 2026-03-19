// ═══════════════════════════════════════════════════════════════════
// charEdge — Announcement Store (Sprint 17)
//
// Platform announcements, tips, and feature updates.
// Mirrors Coinbase's "Offers & Announcements" category.
//
// Features:
//   - Announcement definitions (JSON-driven)
//   - Read/dismissed state tracking
//   - Timed announcements (start/end dates)
//   - Tier-based targeting
//   - Routes through notificationRouter
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { notifyAnnouncement } from './notificationEngine';

// ─── Types ──────────────────────────────────────────────────────

export interface Announcement {
  id: string;
  type: 'feature' | 'changelog' | 'tip' | 'featureLab' | 'promotion';
  title: string;
  body: string;
  icon: string;
  /** When to start showing (ISO date string or timestamp) */
  startDate?: number;
  /** When to stop showing */
  endDate?: number;
  /** Min tier required to see (for Feature Lab) */
  minTier?: number;
  /** URL to open on click */
  actionUrl?: string;
  actionLabel?: string;
  /** Priority for ordering */
  priority?: number;
}

// ─── Built-in Announcements ─────────────────────────────────────

export const PLATFORM_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'launch-alert-throttler',
    type: 'feature',
    title: '🎉 New: Smart Alert Throttling',
    body: 'Choose Instant, Balanced, or Quiet alert modes to control how often you receive price notifications.',
    icon: '🎉',
    priority: 10,
    actionLabel: 'Configure',
  },
  {
    id: 'launch-alert-templates',
    type: 'feature',
    title: '📋 New: Alert Templates',
    body: 'Save and reuse alert configurations! Try our built-in Breakout, Swing, Scalp, and HODL presets.',
    icon: '📋',
    priority: 9,
    actionLabel: 'Explore Templates',
  },
  {
    id: 'launch-notif-center',
    type: 'feature',
    title: '🔔 Redesigned Notification Center',
    body: 'Tab-based filtering, per-notification dismiss, and quick access to notification settings.',
    icon: '🔔',
    priority: 8,
  },
  {
    id: 'tip-chart-right-click',
    type: 'tip',
    title: '💡 Did you know?',
    body: 'Right-click any price level on the chart to quickly set an alert at that price.',
    icon: '💡',
    priority: 3,
  },
  {
    id: 'tip-alert-drag',
    type: 'tip',
    title: '💡 Drag to adjust',
    body: 'You can drag alert lines directly on the chart to adjust their trigger price.',
    icon: '💡',
    priority: 2,
  },
  {
    id: 'tip-dnd-schedule',
    type: 'tip',
    title: '💡 Quiet hours',
    body: 'Set up Do Not Disturb in Settings > Notifications to mute alerts during sleep hours.',
    icon: '🌙',
    priority: 1,
  },
];

// ─── Store ──────────────────────────────────────────────────────

interface AnnouncementState {
  /** IDs of announcements the user has read */
  readIds: string[];
  /** IDs of announcements the user has dismissed permanently */
  dismissedIds: string[];
  
  markRead: (id: string) => void;
  dismiss: (id: string) => void;
  isRead: (id: string) => boolean;
  isDismissed: (id: string) => boolean;
  
  /** Get active announcements (not dismissed, within date range) */
  getActive: (userTier?: number) => Announcement[];
  /** Get unread count */
  getUnreadCount: (userTier?: number) => number;
  /** Fire announcement as notification */
  fireAnnouncement: (announcement: Announcement) => void;
}

export const useAnnouncementStore = create<AnnouncementState>()(
  persist(
    (set, get) => ({
      readIds: [],
      dismissedIds: [],

      markRead: (id) => set((s) => ({
        readIds: s.readIds.includes(id) ? s.readIds : [...s.readIds, id],
      })),

      dismiss: (id) => set((s) => ({
        dismissedIds: s.dismissedIds.includes(id) ? s.dismissedIds : [...s.dismissedIds, id],
      })),

      isRead: (id) => get().readIds.includes(id),
      isDismissed: (id) => get().dismissedIds.includes(id),

      getActive: (userTier = 0) => {
        const now = Date.now();
        const { dismissedIds } = get();
        return PLATFORM_ANNOUNCEMENTS
          .filter((a) => {
            if (dismissedIds.includes(a.id)) return false;
            if (a.startDate && now < a.startDate) return false;
            if (a.endDate && now > a.endDate) return false;
            if (a.minTier && userTier < a.minTier) return false;
            return true;
          })
          .sort((a, b) => (b.priority || 0) - (a.priority || 0));
      },

      getUnreadCount: (userTier = 0) => {
        const active = get().getActive(userTier);
        const { readIds } = get();
        return active.filter((a) => !readIds.includes(a.id)).length;
      },

      fireAnnouncement: (announcement) => {
        notifyAnnouncement(
          `${announcement.icon} ${announcement.title}`,
          announcement.body,
          { announcementId: announcement.id, type: announcement.type },
        );
      },
    }),
    {
      name: 'charEdge-announcements',
      version: 1,
      partialize: (s) => ({ readIds: s.readIds, dismissedIds: s.dismissedIds }),
    },
  ),
);

export default useAnnouncementStore;
