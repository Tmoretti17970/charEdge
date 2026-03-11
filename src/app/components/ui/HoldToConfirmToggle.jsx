// ═══════════════════════════════════════════════════════════════════
// charEdge — Hold-to-Confirm Toggle (Strategic Item #24)
//
// Generic hold-to-confirm toggle for dangerous actions.
// Uses conic-gradient radial fill with requestAnimationFrame.
// Shake + color flash on premature release.
// ═══════════════════════════════════════════════════════════════════

import { useState, useRef, useCallback } from 'react';
import { C, M } from '../../../constants.js';
import { radii } from '../../../theme/tokens.js';

/**
 * HoldToConfirmToggle — requires sustained press to toggle.
 *
 * @param {Object} props
 * @param {() => void} props.onConfirm    - Fires when hold completes
 * @param {number}     [props.holdDuration=500] - Hold time in ms
 * @param {string}     props.label        - Button label
 * @param {string}     [props.icon]       - Optional emoji icon
 * @param {boolean}    [props.active=false] - Current toggle state
 * @param {string}     [props.activeColor] - Color when active
 * @param {string}     [props.inactiveColor] - Color when inactive
 */
export default function HoldToConfirmToggle({
    onConfirm,
    holdDuration = 500,
    label = 'Enable',
    icon,
    active = false,
    activeColor,
    inactiveColor,
}) {
    const [progress, setProgress] = useState(0);
    const [shake, setShake] = useState(false);
    const holdTimer = useRef(null);
    const startTime = useRef(0);

    const accentColor = active
        ? (activeColor || C.g)
        : (inactiveColor || C.r);

    const startHold = useCallback(() => {
        startTime.current = Date.now();
        setShake(false);

        const tick = () => {
            const elapsed = Date.now() - startTime.current;
            const pct = Math.min(elapsed / holdDuration, 1);
            setProgress(pct);

            if (pct >= 1) {
                onConfirm?.();
                setProgress(0);
            } else {
                holdTimer.current = requestAnimationFrame(tick);
            }
        };

        holdTimer.current = requestAnimationFrame(tick);
    }, [onConfirm, holdDuration]);

    const cancelHold = useCallback(() => {
        if (holdTimer.current) {
            cancelAnimationFrame(holdTimer.current);
            holdTimer.current = null;
        }

        // If released early, shake to indicate incomplete
        if (progress > 0 && progress < 1) {
            setShake(true);
            setTimeout(() => setShake(false), 400);
        }
        setProgress(0);
    }, [progress]);

    const degrees = progress * 360;

    return (
        <button
            aria-pressed={active}
            aria-label={`${label} — hold ${holdDuration}ms to confirm`}
            onMouseDown={startHold}
            onMouseUp={cancelHold}
            onMouseLeave={cancelHold}
            onTouchStart={startHold}
            onTouchEnd={cancelHold}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 12px',
                borderRadius: radii.sm,
                border: `1px solid ${accentColor}30`,
                background: progress > 0
                    ? `conic-gradient(${accentColor} ${degrees}deg, ${accentColor}15 ${degrees}deg)`
                    : `${accentColor}10`,
                color: progress > 0 ? '#fff' : accentColor,
                fontSize: 10,
                fontWeight: 700,
                fontFamily: M,
                cursor: 'pointer',
                transition: progress > 0 ? 'none' : 'all 0.2s ease',
                transform: shake
                    ? 'translateX(-3px)'
                    : progress > 0
                        ? `scale(${1 + progress * 0.05})`
                        : 'scale(1)',
                animation: shake ? 'tf-shake 0.3s ease' : 'none',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                flexShrink: 0,
                letterSpacing: '0.03em',
                textTransform: 'uppercase',
            }}
        >
            {icon && <span style={{ fontSize: 12, lineHeight: 1 }}>{icon}</span>}
            <span>{active ? 'ON' : label}</span>

            {/* Progress indicator dot */}
            {progress > 0 && (
                <span
                    style={{
                        width: 6,
                        height: 6,
                        borderRadius: radii.pill,
                        background: '#fff',
                        opacity: 0.8,
                        animation: 'tf-pulse 0.5s infinite',
                    }}
                />
            )}
        </button>
    );
}
