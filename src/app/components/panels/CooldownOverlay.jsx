// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — Cooldown Overlay (Sprint 3: B.3)
//
// Non-dismissible banner when cooldown is active. Shows countdown,
// coaching message, and an override escape hatch.
// ═══════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { C, F, M } from '../../../constants.js';

const pad = (n) => String(n).padStart(2, '0');

function CooldownOverlay({ isActive, minutesLeft, secondsLeft, onOverride }) {
  const [showOverride, setShowOverride] = useState(false);

  if (!isActive) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        position: 'relative',
        width: '100%',
        background: `linear-gradient(135deg, ${C.r}08, ${C.y}06)`,
        border: `1px solid ${C.y}30`,
        borderRadius: 12,
        padding: '16px 20px',
        marginBottom: 16,
        animation: 'tfSubTabsIn 0.3s ease forwards',
      }}
    >
      {/* Timer + Message Row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* Countdown */}
        <div style={{
          background: C.bg2,
          borderRadius: 10,
          padding: '10px 16px',
          minWidth: 90,
          textAlign: 'center',
          border: `1px solid ${C.bd}`,
        }}>
          <div style={{
            fontSize: 24,
            fontWeight: 800,
            fontFamily: M,
            color: C.y,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '0.05em',
          }}>
            {pad(minutesLeft)}:{pad(secondsLeft)}
          </div>
          <div style={{
            fontSize: 8,
            fontWeight: 600,
            color: C.t3,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginTop: 2,
          }}>
            remaining
          </div>
        </div>

        {/* Message */}
        <div style={{ flex: 1 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4,
          }}>
            <span style={{ fontSize: 18 }}>🧊</span>
            <span style={{
              fontSize: 13, fontWeight: 800, fontFamily: F, color: C.t1,
            }}>
              Cooling Down
            </span>
          </div>
          <div style={{
            fontSize: 12, color: C.t2, lineHeight: 1.5, fontFamily: M,
          }}>
            Step away from the screen. Breathe. Your next trade can wait.
            <br />
            <span style={{ fontSize: 10, color: C.t3 }}>
              Your best trades happen when you're calm and focused.
            </span>
          </div>
        </div>

        {/* Override */}
        <div style={{ flexShrink: 0 }}>
          {!showOverride ? (
            <button
              className="tf-btn"
              onClick={() => setShowOverride(true)}
              style={{
                background: 'transparent',
                border: `1px solid ${C.bd}`,
                borderRadius: 6,
                padding: '6px 12px',
                fontSize: 10,
                color: C.t3,
                cursor: 'pointer',
                fontFamily: M,
                fontWeight: 600,
              }}
            >
              Override
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 9, color: C.r, fontFamily: M, fontWeight: 600, textAlign: 'center' }}>
                Are you sure?
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  className="tf-btn"
                  onClick={() => {
                    setShowOverride(false);
                    onOverride?.();
                  }}
                  style={{
                    background: C.r + '20',
                    border: `1px solid ${C.r}`,
                    borderRadius: 4,
                    padding: '4px 10px',
                    fontSize: 10,
                    color: C.r,
                    cursor: 'pointer',
                    fontWeight: 700,
                  }}
                >
                  Yes
                </button>
                <button
                  className="tf-btn"
                  onClick={() => setShowOverride(false)}
                  style={{
                    background: 'transparent',
                    border: `1px solid ${C.bd}`,
                    borderRadius: 4,
                    padding: '4px 10px',
                    fontSize: 10,
                    color: C.t3,
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  No
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        marginTop: 12,
        height: 3,
        borderRadius: 2,
        background: C.bd,
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          borderRadius: 2,
          background: `linear-gradient(90deg, ${C.y}, ${C.g})`,
          width: `${Math.max(0, 100 - ((minutesLeft * 60 + secondsLeft) / (15 * 60)) * 100)}%`,
          transition: 'width 1s linear',
        }} />
      </div>
    </div>
  );
}

export default React.memo(CooldownOverlay);
export { CooldownOverlay };
