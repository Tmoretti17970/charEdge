// ═══════════════════════════════════════════════════════════════════
// charEdge — Focus Overlay (Sprint 20)
//
// Shows session timer, break reminders, and exit button when in
// focus mode. Minimal, non-intrusive UI in bottom-right corner.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { C, F, M } from '../../../constants.js';
import { useFocusStore } from '../../../state/useFocusStore.js';

export default function FocusOverlay() {
  const focusMode = useFocusStore((s) => s.focusMode);
  const sessionStart = useFocusStore((s) => s.sessionStart);
  const breakReminderMinutes = useFocusStore((s) => s.breakReminderMinutes);
  const breakReminderShown = useFocusStore((s) => s.breakReminderShown);
  const exitFocus = useFocusStore((s) => s.exitFocus);
  const markBreakReminderShown = useFocusStore((s) => s.markBreakReminderShown);

  const [elapsed, setElapsed] = useState('0m');
  const [showBreakToast, setShowBreakToast] = useState(false);

  // Update session timer every 30s
  useEffect(() => {
    if (!focusMode || !sessionStart) return;

    const update = () => {
      const mins = Math.floor((Date.now() - sessionStart) / 60_000);
      if (mins < 60) {
        setElapsed(`${mins}m`);
      } else {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        setElapsed(`${h}h ${m}m`);
      }

      // Check break reminder
      if (
        breakReminderMinutes > 0 &&
        !breakReminderShown &&
        mins >= breakReminderMinutes
      ) {
        setShowBreakToast(true);
        markBreakReminderShown();
      }
    };

    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [focusMode, sessionStart, breakReminderMinutes, breakReminderShown, markBreakReminderShown]);

  const handleDismissBreak = useCallback(() => {
    setShowBreakToast(false);
  }, []);

  if (!focusMode) return null;

  return (
    <>
      {/* Session Timer — bottom right pill */}
      <div
        className="tf-fade-in"
        style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 14px',
          borderRadius: 20,
          background: C.sf + 'e0',
          border: `1px solid ${C.bd}60`,
          backdropFilter: 'blur(12px)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          zIndex: 9999,
          fontFamily: F,
        }}
      >
        <span style={{ fontSize: 13 }}>🎯</span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            fontFamily: M,
            color: C.t1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {elapsed}
        </span>
        <button
          onClick={exitFocus}
          className="tf-btn"
          title="Exit Focus Mode"
          style={{
            padding: '3px 8px',
            borderRadius: 6,
            border: `1px solid ${C.bd}`,
            background: 'transparent',
            color: C.t3,
            fontSize: 10,
            fontWeight: 600,
            fontFamily: F,
            cursor: 'pointer',
          }}
        >
          Exit
        </button>
      </div>

      {/* Break Reminder Toast */}
      {showBreakToast && (
        <div
          className="tf-toast-enter"
          style={{
            position: 'fixed',
            bottom: 70,
            right: 20,
            padding: '16px 20px',
            borderRadius: 12,
            background: C.sf,
            border: `1px solid ${C.y}40`,
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            zIndex: 10000,
            maxWidth: 300,
            fontFamily: F,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 18 }}>☕</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>Time for a break</span>
          </div>
          <div style={{ fontSize: 12, color: C.t3, lineHeight: 1.5, marginBottom: 12 }}>
            You've been focused for {breakReminderMinutes}+ minutes. Taking a short break can improve decision quality.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => { exitFocus(); setShowBreakToast(false); }}
              className="tf-btn"
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: 'none',
                background: C.b,
                color: '#fff',
                fontSize: 11,
                fontWeight: 700,
                fontFamily: F,
                cursor: 'pointer',
              }}
            >
              Take a Break
            </button>
            <button
              onClick={handleDismissBreak}
              className="tf-btn"
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: `1px solid ${C.bd}`,
                background: 'transparent',
                color: C.t3,
                fontSize: 11,
                fontWeight: 600,
                fontFamily: F,
                cursor: 'pointer',
              }}
            >
              Keep Going
            </button>
          </div>
        </div>
      )}
    </>
  );
}
