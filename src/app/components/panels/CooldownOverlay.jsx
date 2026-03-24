// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — Cooldown Overlay (Sprint 3: B.3)
// ═══════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import st from './CooldownOverlay.module.css';

const pad = (n) => String(n).padStart(2, '0');

function CooldownOverlay({ isActive, minutesLeft, secondsLeft, onOverride }) {
  const [showOverride, setShowOverride] = useState(false);

  if (!isActive) return null;

  return (
    <div role="alert" aria-live="assertive" className={st.root}>
      <div className={st.topRow}>
        {/* Countdown */}
        <div className={st.countdown}>
          <div className={st.countdownTime}>{pad(minutesLeft)}:{pad(secondsLeft)}</div>
          <div className={st.countdownLabel}>remaining</div>
        </div>

        {/* Message */}
        <div className={st.messageBody}>
          <div className={st.messageTitleRow}>
            <span className={st.messageEmoji}>🧊</span>
            <span className={st.messageTitle}>Cooling Down</span>
          </div>
          <div className={st.messageText}>
            Step away from the screen. Breathe. Your next trade can wait.
            <br />
            <span className={st.messageSubtext}>
              Your best trades happen when you're calm and focused.
            </span>
          </div>
        </div>

        {/* Override */}
        <div className={st.overrideWrap}>
          {!showOverride ? (
            <button
              className={`tf-btn ${st.overrideBtn}`}
              onClick={() => setShowOverride(true)}
            >Override</button>
          ) : (
            <div className={st.confirmCol}>
              <div className={st.confirmLabel}>Are you sure?</div>
              <div className={st.confirmRow}>
                <button
                  className={`tf-btn ${st.confirmYes}`}
                  onClick={() => { setShowOverride(false); onOverride?.(); }}
                >Yes</button>
                <button
                  className={`tf-btn ${st.confirmNo}`}
                  onClick={() => setShowOverride(false)}
                >No</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className={st.progressTrack}>
        <div
          className={st.progressFill}
          style={{ width: `${Math.max(0, 100 - ((minutesLeft * 60 + secondsLeft) / (15 * 60)) * 100)}%` }}
        />
      </div>
    </div>
  );
}

export default React.memo(CooldownOverlay);
export { CooldownOverlay };
