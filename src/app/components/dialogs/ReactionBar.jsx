// ═══════════════════════════════════════════════════════════════════
// charEdge — ReactionBar (Task 6.5.2)
//
// Frictionless 2-tap post-trade widget. Appears automatically after
// a trade is logged, captures mood + process quality, auto-dismisses
// after 30 seconds.
//
// Shows detected leak tags from LeakDetector for awareness.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from 'react';
import { LEAK_TAGS } from '../../../services/LeakDetector.js';
import { useJournalStore } from '../../../state/useJournalStore.js';
import styles from './ReactionBar.module.css';

// ─── Options ─────────────────────────────────────────────────────

const MOOD_OPTIONS = [
  { value: 'neutral', emoji: '😐', label: 'Neutral' },
  { value: 'confident', emoji: '😤', label: 'Confident' },
  { value: 'stressed', emoji: '😰', label: 'Stressed' },
  { value: 'fomo', emoji: '🔥', label: 'FOMO' },
];

const PROCESS_OPTIONS = [
  { value: 'perfect', emoji: '✅', label: 'Perfect' },
  { value: 'deviation', emoji: '↗️', label: 'Deviation' },
  { value: 'gambled', emoji: '🎲', label: 'Gambled' },
];

const AUTO_DISMISS_MS = 30_000;
const EXIT_ANIMATION_MS = 250;

// ─── Component ───────────────────────────────────────────────────

function ReactionBar({ tradeId, onDismiss }) {
  const [mood, setMood] = useState(null);
  const [process, setProcess] = useState(null);
  const [exiting, setExiting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(30);
  const timerRef = useRef(null);
  const countdownRef = useRef(null);
  const updateTrade = useJournalStore((s) => s.updateTrade);

  // Get the trade to display its tags
  const trade = useJournalStore((s) => s.trades.find((t) => t.id === tradeId));

  // ── Auto-dismiss timer ──────────────────────────────────────
  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => onDismiss?.(), EXIT_ANIMATION_MS);
  }, [onDismiss]);

  useEffect(() => {
    timerRef.current = setTimeout(dismiss, AUTO_DISMISS_MS);
    countdownRef.current = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);

    return () => {
      clearTimeout(timerRef.current);
      clearInterval(countdownRef.current);
    };
  }, [dismiss]);

  // ── Auto-dismiss when both selections made ──────────────────
  useEffect(() => {
    if (mood && process) {
      // Small delay so user sees their selection
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(dismiss, 800);
    }
  }, [mood, process, dismiss]);

  // ── Save on each selection ──────────────────────────────────
  const handleMood = useCallback(
    (value) => {
      setMood(value);
      updateTrade(tradeId, { emotion: value });
    },
    [tradeId, updateTrade],
  );

  const handleProcess = useCallback(
    (value) => {
      setProcess(value);
      updateTrade(tradeId, { processGrade: value });
    },
    [tradeId, updateTrade],
  );

  // ── Leak tags (from LeakDetector, already on the trade) ─────
  const leakTags = (trade?.tags || []).filter((t) => Object.values(LEAK_TAGS).includes(t));

  return (
    <div className={`${styles.overlay} ${exiting ? styles.exiting : ''}`}>
      <div className={styles.card}>
        {/* Header */}
        <div className={styles.header}>
          <span className={styles.title}>Quick Review</span>
          <span className={styles.timer}>{secondsLeft}s</span>
          <button className={styles.closeBtn} onClick={dismiss} aria-label="Dismiss">
            ✕
          </button>
        </div>

        {/* Mood */}
        <div className={styles.section}>
          <div className={styles.sectionLabel}>How did you feel?</div>
          <div className={styles.buttonRow}>
            {MOOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={mood === opt.value ? styles.moodBtnSelected : styles.moodBtn}
                onClick={() => handleMood(opt.value)}
              >
                <span className={styles.emoji}>{opt.emoji}</span>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Process */}
        <div className={styles.section}>
          <div className={styles.sectionLabel}>Process quality</div>
          <div className={styles.buttonRow}>
            {PROCESS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={process === opt.value ? styles.moodBtnSelected : styles.moodBtn}
                onClick={() => handleProcess(opt.value)}
              >
                <span className={styles.emoji}>{opt.emoji}</span>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Leak Tags */}
        {leakTags.length > 0 && (
          <div className={styles.leakTags}>
            {leakTags.map((tag) => (
              <span key={tag} className={tag === LEAK_TAGS.PERFECT_EXECUTION ? styles.leakTagGood : styles.leakTagWarn}>
                {tag.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Hook: Auto-show after trade ─────────────────────────────────

/**
 * Hook that watches for new trades and triggers the ReactionBar.
 * Returns { tradeId, visible, dismiss } for the parent to render.
 */
export function useReactionBar() {
  const [activeTradeId, setActiveTradeId] = useState(null);
  const prevCountRef = useRef(0);
  const trades = useJournalStore((s) => s.trades);

  useEffect(() => {
    // On first mount, just record the count
    if (prevCountRef.current === 0) {
      prevCountRef.current = trades.length;
      return;
    }

    // New trade added
    if (trades.length > prevCountRef.current && trades.length > 0) {
      setActiveTradeId(trades[0].id);
    }
    prevCountRef.current = trades.length;
  }, [trades]);

  const dismiss = useCallback(() => setActiveTradeId(null), []);

  return {
    tradeId: activeTradeId,
    visible: activeTradeId != null,
    dismiss,
  };
}

export { ReactionBar };
export default ReactionBar;
