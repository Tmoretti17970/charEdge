// ═══════════════════════════════════════════════════════════════════
// charEdge — Intent Slice (G1.1)
//
// Zustand slice storing detected intent mode + confidence score.
// ═══════════════════════════════════════════════════════════════════

import type { IntentMode, IntentState } from '../hooks/useIntentDetector';

export interface IntentSlice {
  intent: IntentState;
  setIntent: (intent: IntentState) => void;
  forceMode: (mode: IntentMode) => void;
  clearForce: () => void;
  /** Manually forced mode override (null = auto-detect) */
  forcedMode: IntentMode | null;
}

/**
 * Zustand slice creator for intent state.
 *
 * Usage in your store:
 *   import { createIntentSlice } from './intentSlice';
 *   const useStore = create((...a) => ({
 *     ...createIntentSlice(...a),
 *   }));
 */
export const createIntentSlice = (set: unknown): IntentSlice => ({
  intent: {
    mode: 'analysis',
    confidence: 0,
    signals: {},
    lastChanged: Date.now(),
  },
  forcedMode: null,

  setIntent: (intent: IntentState) =>
    set((state: unknown) => ({
      intent: state.forcedMode
        ? { ...intent, mode: state.forcedMode, confidence: 1 }
        : intent,
    })),

  forceMode: (mode: IntentMode) =>
    set({ forcedMode: mode }),

  clearForce: () =>
    set({ forcedMode: null }),
});

export default createIntentSlice;
