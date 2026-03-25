// ═══════════════════════════════════════════════════════════════════
// charEdge — Level Up Notification (Phase 4: Simplified)
//
// Replaced full-screen confetti modal with a subtle toast notification.
// Level-ups are nice-to-know, not must-see.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useEffect } from 'react';
import { useGamificationStore } from '../../../state/useGamificationStore';
import toast from './Toast.jsx';

function LevelUpModal() {
  const pendingLevelUp = useGamificationStore((s) => s._pendingLevelUp);
  const clearPendingLevelUp = useGamificationStore((s) => s.clearPendingLevelUp);
  const levelUpEnabled = useGamificationStore((s) => s.notificationPrefs.levelUp);

  useEffect(() => {
    if (!pendingLevelUp) return;

    if (levelUpEnabled) {
      const { newRank } = pendingLevelUp;
      toast.success(`${newRank.emoji} Level Up! You're now a ${newRank.name}`);
    }

    clearPendingLevelUp();
  }, [pendingLevelUp, levelUpEnabled, clearPendingLevelUp]);

  // No modal rendered — just toast
  return null;
}

export { LevelUpModal };
export default React.memo(LevelUpModal);
