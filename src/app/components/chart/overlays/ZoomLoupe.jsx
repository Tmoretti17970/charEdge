// ═══════════════════════════════════════════════════════════════════
// charEdge — Precision Zoom Loupe (Task 1.4.6)
//
// Magnifying glass overlay for mobile drawing / precision placement.
// Renders a 2× magnified circular region of the chart canvas above
// the user's finger. Activates on touch-hold (>200ms) or during
// active drawing tool interaction.
//
// Usage: <ZoomLoupe canvasRef={ref} touchPos={pos} active={bool} />
// ═══════════════════════════════════════════════════════════════════

import React, { useRef, useEffect, useCallback } from 'react';
import styles from './ZoomLoupe.module.css';

const LOUPE_SIZE = 120;       // px diameter
const MAGNIFICATION = 2;      // 2× zoom
const OFFSET_Y = -80;         // above finger
const SOURCE_SIZE = LOUPE_SIZE / MAGNIFICATION; // 60px of source captured
const PR = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;

/**
 * @param {{ canvasRef: React.RefObject, touchX: number, touchY: number, active: boolean, price?: string }} props
 */
function ZoomLoupe({ canvasRef, touchX, touchY, active, price }) {
    const loupeCanvasRef = useRef(null);
    const rafRef = useRef(null);

    const drawLoupe = useCallback(() => {
        const source = canvasRef?.current;
        const loupe = loupeCanvasRef.current;
        if (!source || !loupe || !active) return;

        const ctx = loupe.getContext('2d');
        if (!ctx) return;

        // Source region: centered on touch point, 60×60px at device pixel ratio
        const sx = (touchX * PR) - (SOURCE_SIZE * PR / 2);
        const sy = (touchY * PR) - (SOURCE_SIZE * PR / 2);
        const sw = SOURCE_SIZE * PR;
        const sh = SOURCE_SIZE * PR;

        // Clear and draw magnified region
        ctx.clearRect(0, 0, LOUPE_SIZE * PR, LOUPE_SIZE * PR);
        ctx.imageSmoothingEnabled = false;

        try {
            ctx.drawImage(source, sx, sy, sw, sh, 0, 0, LOUPE_SIZE * PR, LOUPE_SIZE * PR);
        } catch {
            // Canvas might be tainted or invalid
        }
    }, [canvasRef, touchX, touchY, active]);

    // Re-draw on every position change using rAF
    useEffect(() => {
        if (!active) return;

        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(drawLoupe);

        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [active, drawLoupe, touchX, touchY]);

    // Set canvas resolution
    useEffect(() => {
        const c = loupeCanvasRef.current;
        if (c) {
            c.width = LOUPE_SIZE * PR;
            c.height = LOUPE_SIZE * PR;
        }
    }, []);

    // Position: above the touch point, clamped to viewport bounds
    const left = Math.max(LOUPE_SIZE / 2,
        Math.min(touchX, (typeof window !== 'undefined' ? window.innerWidth : 1200) - LOUPE_SIZE / 2));
    const top = Math.max(LOUPE_SIZE / 2 + 10, touchY + OFFSET_Y);

    return (
        <div
            className={styles.zoomLoupeContainer}
            style={{
                left: left - LOUPE_SIZE / 2,
                top: top - LOUPE_SIZE / 2,
            }}
        >
            <div className={`${styles.zoomLoupeCircle} ${active ? styles.active : ''}`}>
                <canvas
                    ref={loupeCanvasRef}
                    className={styles.zoomLoupeCanvas}
                />
                {/* Crosshair inside loupe */}
                <div className={styles.zoomLoupeCrosshair} />
                <div className={styles.zoomLoupeCrosshairH} />
            </div>
            {/* Price readout */}
            {active && price && (
                <div className={styles.zoomLoupeReadout}>{price}</div>
            )}
        </div>
    );
}

export default React.memo(ZoomLoupe);
