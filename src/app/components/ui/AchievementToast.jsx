// ═══════════════════════════════════════════════════════════════════
// charEdge — Achievement Toast (Gamification Sprint A)
//
// Fires celebratory toasts when new achievements are unlocked.
// Uses the existing toast system with enhanced styling.
// ═══════════════════════════════════════════════════════════════════

import toast from './Toast.jsx';

const RARITY_COLORS = {
  common:    '#8E8E93',
  uncommon:  '#34C759',
  rare:      '#007AFF',
  epic:      '#AF52DE',
  legendary: '#FF9500',
};

/**
 * Show a celebratory toast for a newly unlocked achievement.
 * @param {{ id: string, name: string, emoji: string, rarity: string }} achievement
 */
export function showAchievementToast(achievement) {
  const rarityLabel = achievement.rarity.charAt(0).toUpperCase() + achievement.rarity.slice(1);
  const message = `${achievement.emoji} Achievement Unlocked: ${achievement.name} [${rarityLabel}]`;
  toast.success(message, 5000);
}

/**
 * Process all pending achievements from the gamification store.
 * @param {Function} consumeFn - useGamificationStore.getState().consumePendingAchievements
 */
export function processPendingAchievements(consumeFn) {
  const pending = consumeFn();
  if (!pending || pending.length === 0) return;

  // Show toasts with staggered timing so they don't overlap
  pending.forEach((ach, i) => {
    setTimeout(() => showAchievementToast(ach), i * 800);
  });
}

export { RARITY_COLORS };
