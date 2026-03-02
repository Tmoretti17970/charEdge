// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — Contextual Tooltip
//
// Dismissible tips that appear near UI elements for feature discovery.
// Each tip has a unique ID — once dismissed, it won't show again.
//
// Usage:
//   <Tooltip id="chart-drawing" position="bottom">
//     Try drawing trend lines on the chart!
//   </Tooltip>
// ═══════════════════════════════════════════════════════════════════

import { useUserStore } from '../../../state/useUserStore.js';
import React from 'react';
import { C, F, M } from '../../../constants.js';
import { space, radii, transition, zIndex as zi } from '../../../theme/tokens.js';

/**
 * Contextual tooltip that auto-hides once dismissed.
 *
 * @param {Object} props
 * @param {string} props.id - Unique tip identifier
 * @param {React.ReactNode} props.children - Tip content
 * @param {'top'|'bottom'|'left'|'right'} [props.position='bottom'] - Arrow position
 * @param {boolean} [props.pulse=false] - Add pulse animation to draw attention
 * @param {string} [props.requiredFeature] - Only show if this feature NOT yet discovered
 */
export default function Tooltip({ id, children, position = 'bottom', pulse = false, requiredFeature }) {
  const dismissedTips = useUserStore((s) => s.dismissedTips);
  const discoveredFeatures = useUserStore((s) => s.discoveredFeatures);
  const dismissTip = useUserStore((s) => s.dismissTip);
  const wizardComplete = useUserStore((s) => s.wizardComplete);

  // Don't show tips during wizard
  if (!wizardComplete) return null;

  // Already dismissed
  if (dismissedTips.includes(id)) return null;

  // Feature already discovered — no need for tip
  if (requiredFeature && discoveredFeatures.includes(requiredFeature)) return null;

  const arrowStyles = {
    top: {
      bottom: '100%',
      left: '50%',
      transform: 'translateX(-50%)',
      arrow: { bottom: -4, left: '50%', transform: 'translateX(-50%) rotate(45deg)' },
    },
    bottom: {
      top: '100%',
      left: '50%',
      transform: 'translateX(-50%)',
      arrow: { top: -4, left: '50%', transform: 'translateX(-50%) rotate(45deg)' },
    },
    left: {
      right: '100%',
      top: '50%',
      transform: 'translateY(-50%)',
      arrow: { right: -4, top: '50%', transform: 'translateY(-50%) rotate(45deg)' },
    },
    right: {
      left: '100%',
      top: '50%',
      transform: 'translateY(-50%)',
      arrow: { left: -4, top: '50%', transform: 'translateY(-50%) rotate(45deg)' },
    },
  };

  const posStyle = arrowStyles[position] || arrowStyles.bottom;
  const { arrow, ...containerPos } = posStyle;

  return (
    <div
      className={pulse ? 'tf-fade-in' : ''}
      style={{
        position: 'absolute',
        ...containerPos,
        zIndex: zi.tooltip,
        marginTop: position === 'bottom' ? space[2] : 0,
        marginBottom: position === 'top' ? space[2] : 0,
        marginLeft: position === 'right' ? space[2] : 0,
        marginRight: position === 'left' ? space[2] : 0,
      }}
    >
      <div
        style={{
          background: C.b,
          borderRadius: radii.md,
          padding: `${space[2]}px ${space[3]}px`,
          maxWidth: 240,
          position: 'relative',
          boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
        }}
      >
        {/* Arrow */}
        <div
          style={{
            position: 'absolute',
            width: 8,
            height: 8,
            background: C.b,
            ...arrow,
          }}
        />

        {/* Content */}
        <div
          style={{
            fontSize: 11,
            fontFamily: F,
            color: '#fff',
            lineHeight: 1.4,
            marginBottom: space[1],
          }}
        >
          {children}
        </div>

        {/* Dismiss */}
        <button
          className="tf-btn"
          onClick={(e) => {
            e.stopPropagation();
            dismissTip(id);
          }}
          style={{
            background: 'rgba(255,255,255,0.2)',
            border: 'none',
            borderRadius: radii.sm,
            padding: '2px 8px',
            fontSize: 9,
            fontWeight: 600,
            fontFamily: M,
            color: '#fff',
            cursor: 'pointer',
            transition: `background ${transition.fast}`,
          }}
        >
          Got it
        </button>
      </div>
    </div>
  );
}

/**
 * Wrapper that positions a tooltip relative to its child.
 * Use this when you want to attach a tip to an existing element.
 *
 * Usage:
 *   <WithTooltip id="journal-add" position="bottom" tip="Click here to add your first trade!">
 *     <Btn>Add Trade</Btn>
 *   </WithTooltip>
 */
export function WithTooltip({ id, children, tip, position = 'bottom', pulse, requiredFeature }) {
  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      {children}
      <Tooltip id={id} position={position} pulse={pulse} requiredFeature={requiredFeature}>
        {tip}
      </Tooltip>
    </div>
  );
}
