// ═══════════════════════════════════════════════════════════════════
// charEdge — Focus Store (Sprint 20)
//
// Manages focus mode, DND, session timer, and break reminders.
// Protects user flow state during active trading sessions.
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useFocusStore = create(
  persist(
    (set, get) => ({
      // Focus mode — hides sidebar, notifications, gamification
      focusMode: false,

      // Do Not Disturb — suppresses non-essential toasts/popups
      dndMode: false,

      // Session timer start (epoch ms, null when not active)
      sessionStart: null,

      // Break reminder interval in minutes (0 = disabled)
      breakReminderMinutes: 120,

      // Reduced motion in focus mode
      reducedMotion: false,

      // Whether we already showed the break reminder for this session
      breakReminderShown: false,

      // ─── Actions ─────────────────────────────────────────

      toggleFocus() {
        const current = get().focusMode;
        const next = !current;

        // Apply to DOM
        if (typeof document !== 'undefined') {
          document.documentElement.setAttribute('data-focus', String(next));
          if (next && get().reducedMotion) {
            document.documentElement.setAttribute('data-reduced-motion', 'true');
          } else {
            document.documentElement.removeAttribute('data-reduced-motion');
          }
        }

        set({
          focusMode: next,
          sessionStart: next ? Date.now() : null,
          breakReminderShown: false,
        });
      },

      toggleDnd() {
        set((s) => ({ dndMode: !s.dndMode }));
      },

      setBreakReminder(minutes) {
        set({ breakReminderMinutes: minutes });
      },

      setReducedMotion(val) {
        set({ reducedMotion: val });
        if (get().focusMode && typeof document !== 'undefined') {
          if (val) {
            document.documentElement.setAttribute('data-reduced-motion', 'true');
          } else {
            document.documentElement.removeAttribute('data-reduced-motion');
          }
        }
      },

      markBreakReminderShown() {
        set({ breakReminderShown: true });
      },

      /** Get session duration in minutes, returns 0 if not in focus mode */
      getSessionDurationMinutes() {
        const { focusMode, sessionStart } = get();
        if (!focusMode || !sessionStart) return 0;
        return Math.floor((Date.now() - sessionStart) / 60_000);
      },

      /** Check if break reminder should fire */
      shouldShowBreakReminder() {
        const { focusMode, breakReminderMinutes, breakReminderShown } = get();
        if (!focusMode || breakReminderShown || breakReminderMinutes <= 0) return false;
        return get().getSessionDurationMinutes() >= breakReminderMinutes;
      },

      /** Exit focus mode and reset */
      exitFocus() {
        if (typeof document !== 'undefined') {
          document.documentElement.setAttribute('data-focus', 'false');
          document.documentElement.removeAttribute('data-reduced-motion');
        }
        set({ focusMode: false, sessionStart: null, breakReminderShown: false });
      },
    }),
    {
      name: 'charEdge-focus',
      version: 1,
      partialize: (state) => ({
        breakReminderMinutes: state.breakReminderMinutes,
        reducedMotion: state.reducedMotion,
      }),
    },
  ),
);

export default useFocusStore;
