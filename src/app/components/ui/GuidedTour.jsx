// ═══════════════════════════════════════════════════════════════════
// charEdge — Guided Tour (Sprint 14: Interactive Onboarding 2.0)
// 5-step spotlight tour highlighting key features on first visit.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useEffect, useState, useCallback } from 'react';
import { C, F } from '../../../constants.js';
import { useUserStore } from '../../../state/useUserStore';

const TOUR_STEPS = [
  // ─── App Navigation (sidebar) ──────────────────────────────────
  {
    title: 'Your Home Base',
    desc: 'Home is your trading journal and dashboard — log trades, review performance, and track your progress.',
    selector: '[data-tour="nav-journal"]',
    position: 'right',
  },
  {
    title: 'Live Charts',
    desc: 'Full charting with 50+ indicators, drawing tools, and multi-timeframe analysis.',
    selector: '[data-tour="nav-charts"]',
    position: 'right',
  },
  {
    title: 'Insights & Analytics',
    desc: 'Deep analytics: Sharpe ratio, profit factor, win rate, psychology patterns — powered by your journal data.',
    selector: '[data-tour="nav-discover"]',
    position: 'right',
  },
  // ─── Chart Features ────────────────────────────────────────────
  {
    title: 'Symbol Search',
    desc: 'Type any symbol to search — futures, crypto, equities. Press / for quick access.',
    selector: '.tf-symbol-zone',
    position: 'bottom',
  },
  {
    title: 'Timeframe Pills',
    desc: 'Switch between 1m, 5m, 15m, 1H, 4H, Daily. Press 1–6 for instant switching.',
    selector: '.tf-timeframe-zone',
    position: 'bottom',
  },
  {
    title: 'Drawing Sidebar',
    desc: 'All your drawing tools in one place. Press D to toggle, or right-click the chart for the radial menu.',
    selector: '.tf-drawing-sidebar',
    position: 'right',
  },
  {
    title: 'Indicators',
    desc: 'Click any indicator label to quick-edit: change period, color, opacity in real-time.',
    selector: '.tf-chart-area',
    position: 'bottom',
  },
  {
    title: 'Logbook & Add Trade',
    desc: 'Click 📓 Logbook to search and browse your trades, or + Add Trade to log a new one.',
    selector: '#tf-logbook-btn',
    position: 'bottom',
  },
];

function GuidedTour() {
  const tourStep = useUserStore((s) => s.tourStep);
  const tourCompleted = useUserStore((s) => s.tourCompleted);
  const wizardComplete = useUserStore((s) => s.wizardComplete);
  const nextTourStep = useUserStore((s) => s.nextTourStep);
  const skipTour = useUserStore((s) => s.skipTour);
  const startTour = useUserStore((s) => s.startTour);

  const [targetRect, setTargetRect] = useState(null);

  // Auto-start tour on first visit after wizard is complete
  useEffect(() => {
    if (wizardComplete && !tourCompleted && tourStep === -1) {
      const t = setTimeout(() => startTour(), 1500);
      return () => clearTimeout(t);
    }
  }, [wizardComplete, tourCompleted, tourStep, startTour]);

  // Measure target element position
  useEffect(() => {
    if (tourStep < 0 || tourStep >= TOUR_STEPS.length) {
      setTargetRect(null);
      return;
    }

    const step = TOUR_STEPS[tourStep];
    if (!step.selector) {
      setTargetRect(null);
      return;
    }

    const measure = () => {
      const el = document.querySelector(step.selector);
      if (el) {
        const rect = el.getBoundingClientRect();
        setTargetRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
      } else {
        setTargetRect(null);
      }
    };

    measure();
    const interval = setInterval(measure, 500);
    return () => clearInterval(interval);
  }, [tourStep]);

  // Close on Escape
  useEffect(() => {
    if (tourStep < 0) return;
    const handler = (e) => {
      if (e.key === 'Escape') skipTour();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [tourStep, skipTour]);

  const handleNext = useCallback(() => {
    nextTourStep();
  }, [nextTourStep]);

  if (tourStep < 0 || tourStep >= TOUR_STEPS.length) return null;

  const step = TOUR_STEPS[tourStep];
  const isCenter = step.position === 'center' || !targetRect;
  const pad = 8;

  // Tooltip position calculation
  let tooltipStyle = {};
  if (isCenter) {
    tooltipStyle = {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
    };
  } else if (targetRect) {
    switch (step.position) {
      case 'bottom':
        tooltipStyle = {
          top: targetRect.top + targetRect.height + pad + 8,
          left: Math.max(16, Math.min(targetRect.left, window.innerWidth - 340)),
        };
        break;
      case 'right':
        tooltipStyle = {
          top: Math.max(16, targetRect.top),
          left: targetRect.left + targetRect.width + pad + 8,
        };
        break;
      default:
        tooltipStyle = {
          top: targetRect.top + targetRect.height + pad + 8,
          left: targetRect.left,
        };
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100000,
        pointerEvents: 'auto',
      }}
    >
      {/* Overlay mask with cutout */}
      <svg
        width="100%"
        height="100%"
        style={{ position: 'absolute', inset: 0 }}
      >
        <defs>
          <mask id="tf-tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.left - pad}
                y={targetRect.top - pad}
                width={targetRect.width + pad * 2}
                height={targetRect.height + pad * 2}
                rx={10}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.6)"
          mask="url(#tf-tour-mask)"
        />
      </svg>

      {/* Spotlight border glow */}
      {targetRect && (
        <div
          style={{
            position: 'absolute',
            top: targetRect.top - pad,
            left: targetRect.left - pad,
            width: targetRect.width + pad * 2,
            height: targetRect.height + pad * 2,
            borderRadius: 10,
            border: `2px solid ${C.b}`,
            boxShadow: `0 0 20px ${C.b}40, inset 0 0 20px ${C.b}20`,
            pointerEvents: 'none',
            animation: 'pulse 2s ease-in-out infinite',
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        style={{
          position: 'absolute',
          ...tooltipStyle,
          width: 300,
          padding: '16px 18px',
          background: 'rgba(14, 16, 22, 0.95)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: `1px solid ${C.bd}`,
          borderRadius: 14,
          boxShadow: '0 12px 48px rgba(0,0,0,0.5)',
          fontFamily: F,
          animation: 'scaleInSm 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
          zIndex: 2,
        }}
      >
        {/* Step counter */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: C.b, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Step {tourStep + 1} of {TOUR_STEPS.length}
          </span>
          <div style={{ display: 'flex', gap: 3 }}>
            {TOUR_STEPS.map((_, i) => (
              <div
                key={i}
                style={{
                  width: i === tourStep ? 16 : 6,
                  height: 3,
                  borderRadius: 2,
                  background: i <= tourStep ? C.b : C.bd,
                  transition: 'all 0.3s ease',
                }}
              />
            ))}
          </div>
        </div>

        {/* Title */}
        <div style={{ fontSize: 14, fontWeight: 700, color: C.t1, marginBottom: 6 }}>
          {step.title}
        </div>

        {/* Description */}
        <div style={{ fontSize: 11, color: C.t2, lineHeight: 1.5, marginBottom: 14 }}>
          {step.desc}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={skipTour}
            style={{
              background: 'none',
              border: 'none',
              color: C.t3,
              fontSize: 10,
              fontWeight: 500,
              cursor: 'pointer',
              padding: '4px 0',
              fontFamily: F,
            }}
          >
            Skip Tour
          </button>
          <button
            onClick={handleNext}
            style={{
              background: C.b,
              border: 'none',
              color: '#fff',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              padding: '6px 18px',
              borderRadius: 8,
              fontFamily: F,
              boxShadow: `0 2px 8px ${C.b}40`,
              transition: 'transform 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            {tourStep >= TOUR_STEPS.length - 1 ? 'Done ✓' : 'Next →'}
          </button>
        </div>
      </div>

    </div>
  );
}

export default React.memo(GuidedTour);
