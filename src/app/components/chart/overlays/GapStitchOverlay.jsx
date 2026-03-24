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
import s from './GapStitchOverlay.module.css';

const PHASES = { IDLE: 'idle', DISCONNECT: 'disconnect', SYNC: 'sync', STITCH: 'stitch' };
const BAR_REVEAL_STAGGER = 15;
const SYNC_FADE_DURATION = 400;

function GapStitchOverlay({
  connectionState = 'connected',
  backfillProgress = 0,
  barsToReveal = 0,
  onStitchComplete,
}) {
  const [phase, setPhase] = useState(PHASES.IDLE);
  const [revealedBars, setRevealedBars] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (connectionState === 'disconnected') {
      setPhase(PHASES.DISCONNECT);
      setRevealedBars(0);
    } else if (connectionState === 'reconnecting' && phase === PHASES.DISCONNECT) {
      setPhase(PHASES.SYNC);
    } else if (connectionState === 'connected' && phase === PHASES.SYNC) {
      if (barsToReveal > 0) setPhase(PHASES.STITCH);
      else setPhase(PHASES.IDLE);
    }
  }, [connectionState, phase, barsToReveal]);

  useEffect(() => {
    if (phase !== PHASES.STITCH || barsToReveal <= 0) return;
    let bar = 0;
    timerRef.current = setInterval(() => {
      bar++;
      setRevealedBars(bar);
      if (bar >= barsToReveal) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        setTimeout(() => { setPhase(PHASES.IDLE); onStitchComplete?.(); }, SYNC_FADE_DURATION);
      }
    }, BAR_REVEAL_STAGGER);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase, barsToReveal, onStitchComplete]);

  if (phase === PHASES.IDLE) return null;

  return (
    <div
      className={`tf-depth-overlay ${s.overlay}`}
      data-phase={phase}
      style={{
        transition: `opacity ${SYNC_FADE_DURATION}ms ease`,
        opacity: phase === PHASES.STITCH && revealedBars >= barsToReveal ? 0 : 1,
      }}
    >
      {/* Phase 1: Disconnect */}
      {phase === PHASES.DISCONNECT && (
        <div className={s.center}>
          <div className={s.pulseIcon}>
            <span className={s.pulseEmoji}>⚡</span>
          </div>
          <div className={s.disconnectTitle}>Connection Lost</div>
          <div className={s.disconnectSub}>Reconnecting…</div>
        </div>
      )}

      {/* Phase 2: Sync */}
      {phase === PHASES.SYNC && (
        <div className={s.syncWrap}>
          <div className={s.syncTitle}>Syncing data…</div>
          <div className={s.syncTrack}>
            <div className={s.syncFill} style={{ width: `${Math.round(backfillProgress * 100)}%` }} />
          </div>
          <div className={s.syncPct}>{Math.round(backfillProgress * 100)}%</div>
        </div>
      )}

      {/* Phase 3: Stitch */}
      {phase === PHASES.STITCH && (
        <div className={s.stitchLabel}>
          Stitching {revealedBars}/{barsToReveal} bars
        </div>
      )}
    </div>
  );
}

export default React.memo(GapStitchOverlay);
