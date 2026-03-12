// ═══════════════════════════════════════════════════════════════════
// charEdge — Chart Loading Narrative
//
// P2-4: Stepped loading overlay that shows what the chart engine is
// doing during initialization, replacing the bare "Loading..." text.
//
// Steps:
//   1. Connecting to market data…
//   2. Loading price history…
//   3. Rendering candles…
//   4. Ready → auto-dismiss
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useState, useEffect } from 'react';
import styles from '../../../../styles/ChartLoadingNarrative.module.css';

const STEPS = [
    { id: 'connect', label: 'Connecting to market data…' },
    { id: 'history', label: 'Loading price history…' },
    { id: 'render', label: 'Rendering candles…' },
    { id: 'ready', label: 'Ready' },
];

/**
 * Stepped loading narrative overlay for chart boot.
 *
 * @param {Object} props
 * @param {'idle'|'loading'|'ready'|'error'} props.status - Current engine status
 * @param {string} props.symbol - Ticker being loaded
 * @param {number} props.barCount - Number of bars loaded so far
 */
function ChartLoadingNarrative({ status, symbol, barCount }) {
    const [currentStep, setCurrentStep] = useState(0);
    const [exiting, setExiting] = useState(false);
    const [visible, setVisible] = useState(true);

    // Progress through steps based on status and bar count
    useEffect(() => {
        if (status === 'loading' && barCount === 0) {
            setCurrentStep(0); // Connecting
            setExiting(false);
            setVisible(true);
        } else if (status === 'loading' && barCount > 0) {
            setCurrentStep(2); // Rendering
        }
    }, [status, barCount]);

    // When data starts flowing, advance to "Loading history"
    useEffect(() => {
        if (status === 'loading' && currentStep === 0) {
            const timer = setTimeout(() => setCurrentStep(1), 600);
            return () => clearTimeout(timer);
        }
    }, [status, currentStep]);

    // When status becomes ready, show "Ready" briefly then fade out
    useEffect(() => {
        if (status === 'ready') {
            setCurrentStep(3); // Ready
            const exitTimer = setTimeout(() => setExiting(true), 400);
            const hideTimer = setTimeout(() => setVisible(false), 750);
            return () => { clearTimeout(exitTimer); clearTimeout(hideTimer); };
        }
    }, [status]);

    // Don't render if dismissed or in an error state
    if (!visible || status === 'error' || status === 'idle') return null;

    return (
        <div className={styles.overlay} data-exiting={exiting}>
            <div className={styles.symbol}>{symbol || 'Chart'}</div>
            <div className={styles.steps}>
                {STEPS.map((step, idx) => {
                    const isDone = idx < currentStep;
                    const isActive = idx === currentStep;
                    return (
                        <div
                            key={step.id}
                            className={styles.step}
                            data-active={isActive}
                            data-done={isDone}
                        >
                            <div className={styles.stepIcon}>
                                {isDone ? '✓' : isActive ? <div className={styles.spinner} /> : '○'}
                            </div>
                            <span className={styles.stepLabel}>{step.label}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default React.memo(ChartLoadingNarrative);
