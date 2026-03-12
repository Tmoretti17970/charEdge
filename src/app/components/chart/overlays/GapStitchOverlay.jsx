// ═══════════════════════════════════════════════════════════════════
// charEdge — Gap Stitch Overlay (F4.1 + F4.2)
//
// 3-phase visual recovery animation on reconnect:
//   1. Disconnect — frosted glass overlay with pulse icon
//   2. Sync — progress bar showing backfill progress
//   3. Stitch — sequential bar reveal animation (left-to-right stagger)
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useState, useEffect, useRef } from 'react';

const PHASES = { IDLE: 'idle', DISCONNECT: 'disconnect', SYNC: 'sync', STITCH: 'stitch' };
const BAR_REVEAL_STAGGER = 15; // ms per bar reveal
const SYNC_FADE_DURATION = 400;

/**
 * GapStitchOverlay — 3-phase visual recovery on data reconnect.
 *
 * @param {Object} props
 * @param {string} props.connectionState - 'connected' | 'disconnected' | 'reconnecting'
 * @param {number} props.backfillProgress - 0-1 progress of gap backfill
 * @param {number} props.barsToReveal - number of new bars being stitched
 * @param {function} props.onStitchComplete - callback when stitch animation finishes
 */
function GapStitchOverlay({
  connectionState = 'connected',
  backfillProgress = 0,
  barsToReveal = 0,
  onStitchComplete,
}) {
  const [phase, setPhase] = useState(PHASES.IDLE);
  const [revealedBars, setRevealedBars] = useState(0);
  const timerRef = useRef(null);

  // Phase transitions
  useEffect(() => {
    if (connectionState === 'disconnected') {
      setPhase(PHASES.DISCONNECT);
      setRevealedBars(0);
    } else if (connectionState === 'reconnecting' && phase === PHASES.DISCONNECT) {
      setPhase(PHASES.SYNC);
    } else if (connectionState === 'connected' && phase === PHASES.SYNC) {
      // Start stitch phase
      if (barsToReveal > 0) {
        setPhase(PHASES.STITCH);
      } else {
        setPhase(PHASES.IDLE);
      }
    }
  }, [connectionState, phase, barsToReveal]);

  // Stitch animation — reveal bars one by one
  useEffect(() => {
    if (phase !== PHASES.STITCH || barsToReveal <= 0) return;

    let bar = 0;
    timerRef.current = setInterval(() => {
      bar++;
      setRevealedBars(bar);
      if (bar >= barsToReveal) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        // Fade out after last bar
        setTimeout(() => {
          setPhase(PHASES.IDLE);
          onStitchComplete?.();
        }, SYNC_FADE_DURATION);
      }
    }, BAR_REVEAL_STAGGER);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase, barsToReveal, onStitchComplete]);

  if (phase === PHASES.IDLE) return null;

  return (
    <div
      className="tf-depth-overlay"
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 30,
        transition: `opacity ${SYNC_FADE_DURATION}ms ease`,
        opacity: phase === PHASES.STITCH && revealedBars >= barsToReveal ? 0 : 1,
        pointerEvents: phase === PHASES.DISCONNECT ? 'auto' : 'none',
      }}
    >
      {/* Phase 1: Disconnect */}
      {phase === PHASES.DISCONNECT && (
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 48,
            height: 48,
            margin: '0 auto 12px',
            borderRadius: '50%',
            border: '2px solid var(--tf-yellow)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'tf-alert-pulse 2s ease-in-out infinite',
          }}>
            <span style={{ fontSize: 22 }}>⚡</span>
          </div>
          <div style={{
            font: 'var(--tf-type-sm)',
            color: 'var(--tf-yellow)',
            fontWeight: 600,
          }}>
            Connection Lost
          </div>
          <div style={{
            font: 'var(--tf-type-xs)',
            color: 'var(--tf-t3)',
            marginTop: 4,
          }}>
            Reconnecting…
          </div>
        </div>
      )}

      {/* Phase 2: Sync */}
      {phase === PHASES.SYNC && (
        <div style={{ textAlign: 'center', width: '60%', maxWidth: 240 }}>
          <div style={{
            font: 'var(--tf-type-sm)',
            color: 'var(--tf-t2)',
            marginBottom: 8,
            fontWeight: 500,
          }}>
            Syncing data…
          </div>
          <div style={{
            height: 3,
            borderRadius: 'var(--tf-radius-full)',
            background: 'var(--tf-bd)',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${Math.round(backfillProgress * 100)}%`,
              background: 'var(--tf-accent)',
              borderRadius: 'inherit',
              transition: 'width 0.3s ease',
            }} />
          </div>
          <div style={{
            font: 'var(--tf-type-mono-sm)',
            color: 'var(--tf-t3)',
            marginTop: 6,
            fontSize: 10,
          }}>
            {Math.round(backfillProgress * 100)}%
          </div>
        </div>
      )}

      {/* Phase 3: Stitch */}
      {phase === PHASES.STITCH && (
        <div style={{
          font: 'var(--tf-type-xs)',
          color: 'var(--tf-t3)',
          fontWeight: 500,
        }}>
          Stitching {revealedBars}/{barsToReveal} bars
        </div>
      )}
    </div>
  );
}

export default React.memo(GapStitchOverlay);
