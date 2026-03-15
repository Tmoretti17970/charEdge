// ═══════════════════════════════════════════════════════════════════
// charEdge — Sound Design System (Sprint 21)
//
// Premium audio experience matching Apple's design language.
// Per-category sound assignment with volume curves.
//
// Features:
//   - Curated sound profiles per category
//   - Volume curves: urgent louder, info quieter
//   - Haptic feedback patterns for PWA
//   - Sound preview support
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { NotificationCategoryId } from './useNotificationPreferences';

// ─── Sound Profiles ─────────────────────────────────────────────

export interface SoundProfile {
  id: string;
  name: string;
  description: string;
  /** Frequency (Hz) for generated tones, or filename for audio files */
  frequency?: number;
  /** Duration in ms */
  duration: number;
  /** Base volume multiplier (0–1) */
  baseVolume: number;
  /** Sound type for the audio engine */
  soundType: string;
  /** Vibration pattern for haptic feedback [vibrate, pause, vibrate...] in ms */
  hapticPattern?: number[];
}

export const SOUND_PROFILES: Record<string, SoundProfile> = {
  priceAlert: {
    id: 'priceAlert',
    name: 'Price Alert',
    description: 'Clean, satisfying ping — like Apple Pay success',
    frequency: 880,
    duration: 200,
    baseVolume: 0.7,
    soundType: 'price',
    hapticPattern: [100],
  },
  urgent: {
    id: 'urgent',
    name: 'Urgent Alert',
    description: 'Attention-grabbing but not alarming — for SL/TP hits',
    frequency: 660,
    duration: 400,
    baseVolume: 0.9,
    soundType: 'urgent',
    hapticPattern: [100, 50, 100, 50, 200],
  },
  smartInsight: {
    id: 'smartInsight',
    name: 'Smart Insight',
    description: 'Subtle chime — like iOS notification',
    frequency: 1047,
    duration: 150,
    baseVolume: 0.5,
    soundType: 'info',
    hapticPattern: [50],
  },
  tradeFilled: {
    id: 'tradeFilled',
    name: 'Trade Filled',
    description: 'Congratulatory confirmation tone',
    frequency: 784,
    duration: 250,
    baseVolume: 0.65,
    soundType: 'success',
    hapticPattern: [100, 30, 100],
  },
  system: {
    id: 'system',
    name: 'System',
    description: 'Minimal click — for routine system events',
    frequency: 1200,
    duration: 80,
    baseVolume: 0.3,
    soundType: 'info',
    hapticPattern: [30],
  },
  gentle: {
    id: 'gentle',
    name: 'Gentle',
    description: 'Soft notification — for announcements and tips',
    frequency: 523,
    duration: 300,
    baseVolume: 0.4,
    soundType: 'gentle',
    hapticPattern: [80],
  },
  silent: {
    id: 'silent',
    name: 'Silent',
    description: 'No sound — visual notification only',
    duration: 0,
    baseVolume: 0,
    soundType: 'silent',
  },
};

// ─── Category → Sound Assignment ────────────────────────────────

const DEFAULT_CATEGORY_SOUNDS: Record<NotificationCategoryId, string> = {
  securityAlerts: 'urgent',
  priceAlerts: 'priceAlert',
  customAlerts: 'priceAlert',
  tradingInsights: 'smartInsight',
  advancedTransactions: 'tradeFilled',
  offersAnnouncements: 'gentle',
  smartAlerts: 'smartInsight',
  system: 'system',
};

// ─── Volume Curves ──────────────────────────────────────────────

/**
 * Apply volume curve: urgent alerts are slightly louder.
 */
export function getVolumeForProfile(profileId: string, userVolume: number): number {
  const profile = SOUND_PROFILES[profileId];
  if (!profile) return userVolume;
  return Math.min(1, userVolume * profile.baseVolume);
}

// ─── Haptic Feedback ────────────────────────────────────────────

/**
 * Trigger haptic feedback (PWA on mobile).
 */
export function triggerHaptic(profileId: string): void {
  const profile = SOUND_PROFILES[profileId];
  if (!profile?.hapticPattern) return;

  try {
    if ('vibrate' in navigator) {
      navigator.vibrate(profile.hapticPattern);
    }
  } catch { /* haptic may not be available */ }
}

// ─── Sound Preference Store ─────────────────────────────────────

interface SoundDesignState {
  /** Per-category sound assignments */
  categorySounds: Record<string, string>;
  /** Set sound for a category */
  setCategorySound: (category: NotificationCategoryId, profileId: string) => void;
  /** Get sound profile for a category */
  getSoundForCategory: (category: NotificationCategoryId) => SoundProfile;
  /** Reset all to defaults */
  reset: () => void;
}

export const useSoundDesign = create<SoundDesignState>()(
  persist(
    (set, get) => ({
      categorySounds: { ...DEFAULT_CATEGORY_SOUNDS },

      setCategorySound: (category, profileId) => set((s) => ({
        categorySounds: { ...s.categorySounds, [category]: profileId },
      })),

      getSoundForCategory: (category) => {
        const profileId = get().categorySounds[category] || DEFAULT_CATEGORY_SOUNDS[category] || 'system';
        return SOUND_PROFILES[profileId] || SOUND_PROFILES.system;
      },

      reset: () => set({ categorySounds: { ...DEFAULT_CATEGORY_SOUNDS } }),
    }),
    { name: 'charEdge-sound-design' },
  ),
);

/**
 * Preview a sound profile (for settings UI).
 */
export function previewSound(profileId: string, volume = 0.5): void {
  const profile = SOUND_PROFILES[profileId];
  if (!profile || profile.baseVolume === 0) return;

  try {
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.frequency.value = profile.frequency || 880;
    oscillator.type = 'sine';
    gain.gain.value = getVolumeForProfile(profileId, volume);

    oscillator.start();
    oscillator.stop(ctx.currentTime + profile.duration / 1000);

    // Haptic feedback too
    triggerHaptic(profileId);
  } catch { /* audio may be blocked */ }
}

export default useSoundDesign;
