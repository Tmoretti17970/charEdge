// ═══════════════════════════════════════════════════════════════════
// charEdge — Flow State Haptics (G2.3)
//
// Graded vibration feedback via Navigator Vibration API.
// Gated behind settings toggle + feature detection.
// ═══════════════════════════════════════════════════════════════════

export type HapticPattern = 'tap' | 'snap' | 'anchor' | 'execute' | 'alert' | 'success';

interface HapticConfig {
  enabled: boolean;
  intensity: number; // 0-1 multiplier
}

/** Vibration patterns in milliseconds */
const PATTERNS: Record<HapticPattern, number | number[]> = {
  tap: 10,                    // Light feedback — hover/crosshair
  snap: 15,                   // Magnet snap to OHLC
  anchor: 25,                 // Drawing anchor placement
  execute: [50, 30, 50, 30, 50],  // Trade execution — 3-burst
  alert: [100, 50, 100],     // Alert triggered — 2-burst
  success: [30, 20, 80],     // Trade closed profitably
};

let config: HapticConfig = {
  enabled: false,
  intensity: 1.0,
};

/**
 * Check if haptic vibration is supported.
 */
export function isHapticSupported(): boolean {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator;
}

/**
 * Enable or disable haptic feedback.
 */
export function setHapticEnabled(enabled: boolean): void {
  config.enabled = enabled;
}

/**
 * Set haptic intensity multiplier (0-1).
 */
export function setHapticIntensity(intensity: number): void {
  config.intensity = Math.max(0, Math.min(1, intensity));
}

/**
 * Trigger a haptic pattern.
 *
 * @param pattern - Named pattern or custom ms value
 * @returns true if vibration was triggered
 */
export function haptic(pattern: HapticPattern | number): boolean {
  if (!config.enabled || !isHapticSupported()) return false;

  const value = typeof pattern === 'number'
    ? pattern
    : PATTERNS[pattern];

  if (!value) return false;

  try {
    if (Array.isArray(value)) {
      // Scale durations by intensity
      const scaled = value.map((ms) => Math.round(ms * config.intensity));
      navigator.vibrate(scaled);
    } else {
      navigator.vibrate(Math.round(value * config.intensity));
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Stop any ongoing vibration.
 */
export function stopHaptic(): void {
  if (isHapticSupported()) {
    try {
      navigator.vibrate(0);
    } catch {
      // Ignore — some browsers may throw
    }
  }
}

/**
 * Get current haptic configuration.
 */
export function getHapticConfig(): Readonly<HapticConfig> {
  return { ...config };
}

export default {
  isHapticSupported,
  setHapticEnabled,
  setHapticIntensity,
  haptic,
  stopHaptic,
  getHapticConfig,
  PATTERNS,
};
