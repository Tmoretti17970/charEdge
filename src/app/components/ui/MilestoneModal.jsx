// ═══════════════════════════════════════════════════════════════════
// charEdge — Milestone Notification (Phase 4: Simplified)
//
// Replaced full-screen confetti modal with a subtle toast notification.
// Milestones are achievements, not interruptions.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useEffect } from 'react';
import { useGamificationStore } from '../../../state/useGamificationStore';
import toast from './Toast.jsx';

function MilestoneModal() {
  const pendingMilestone = useGamificationStore((s) => s._pendingMilestone);
  const clearPendingMilestone = useGamificationStore((s) => s.clearPendingMilestone);
  const notifEnabled = useGamificationStore((s) => s.notificationPrefs.achievements);

  useEffect(() => {
    if (!pendingMilestone) return;

    if (notifEnabled) {
      toast.success(`${pendingMilestone.emoji} ${pendingMilestone.title}`);
    }

    clearPendingMilestone();
  }, [pendingMilestone, notifEnabled, clearPendingMilestone]);

  // No modal rendered — just toast
  return null;
}

export { MilestoneModal };
export default React.memo(MilestoneModal);
