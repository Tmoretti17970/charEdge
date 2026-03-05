// ═══════════════════════════════════════════════════════════════════
// charEdge — Feature Gate Component
//
// Wraps any feature in a tier-aware visibility gate.
// Shows the feature if the user's tier is high enough,
// otherwise shows a styled unlock prompt.
//
// Usage:
//   <FeatureGate feature="replay_mode">
//     <ReplayBar />
//   </FeatureGate>
//
//   <FeatureGate feature="strategy_builder" silent>
//     <StrategyBuilder />
//   </FeatureGate>
// ═══════════════════════════════════════════════════════════════════

import { useUserStore } from '../../../state/useUserStore.js';
import React from 'react';
import { TIER_CONFIG, FEATURE_TIERS, TIERS } from '../../../state/user/personaSlice.js';
import { C, F, M } from '../../../constants.js';
import { trackFeatureUse } from '../../../utils/telemetry.js';
import styles from './FeatureGate.module.css';

/**
 * Feature gate that conditionally renders children based on user tier.
 *
 * @param {string} feature - Feature ID from FEATURE_TIERS
 * @param {boolean} [silent=false] - If true, renders nothing when locked (no prompt)
 * @param {React.ReactNode} children - Content to show when unlocked
 * @param {React.ReactNode} [fallback] - Custom fallback when locked
 * @param {string} [label] - Human-readable feature name for the unlock prompt
 */
export default function FeatureGate({ feature, silent = false, children, fallback, label }) {
  const tier = useUserStore((s) => s.tier);
  const isUnlocked = useUserStore((s) => s.isFeatureUnlocked(feature));
  const unlockFeature = useUserStore((s) => s.unlockFeature);

  if (isUnlocked) return <>{children}</>;
  if (silent) return null;

  // Show custom fallback if provided
  if (fallback) return <>{fallback}</>;

  // Default: show enhanced unlock prompt with progress bar
  const requiredTier = FEATURE_TIERS[feature] || TIERS.EXPLORER;
  const tierConfig = TIER_CONFIG[requiredTier];
  const featureLabel = label || feature.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const tradeCount = useUserStore((s) => s.tradeCount);

  // Progress towards required tier
  const progress = Math.min(tradeCount / Math.max(tierConfig.minTrades, 1), 1);
  const progressPct = Math.round(progress * 100);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        padding: '14px 16px',
        borderRadius: 10,
        border: `1px dashed ${C.bd}`,
        background: `${C.sf}80`,
        gap: 8,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Top row: lock icon + label + tier badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>🔒</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.t2, fontFamily: F }}>
            {featureLabel}
          </span>
        </div>
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            fontFamily: M,
            color: tierConfig.color,
            background: `${tierConfig.color}15`,
            border: `1px solid ${tierConfig.color}30`,
            padding: '2px 8px',
            borderRadius: 4,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {tierConfig.icon} {tierConfig.label}
        </span>
      </div>

      {/* Progress bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
          <span style={{ fontSize: 9, color: C.t3, fontWeight: 500, fontFamily: F }}>
            {tradeCount} / {tierConfig.minTrades} trades
          </span>
          <span style={{ fontSize: 9, color: tierConfig.color, fontWeight: 600, fontFamily: M }}>
            {progressPct}%
          </span>
        </div>
        <div
          style={{
            height: 4,
            borderRadius: 2,
            background: `${C.bd}60`,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progressPct}%`,
              borderRadius: 2,
              background: `linear-gradient(90deg, ${tierConfig.color}, ${tierConfig.color}CC)`,
              transition: 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
              '--feature-gate-color': `${tierConfig.color}40`,
            }}
            className={styles.progressBar}
          />
        </div>

        {/* Unlock button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className="tf-btn"
            onClick={() => {
              unlockFeature(feature);
              trackFeatureUse('feature_gate_unlock', { feature });
            }}
            style={{
              fontSize: 10,
              padding: '4px 10px',
              borderRadius: 6,
              border: `1px solid ${tierConfig.color}40`,
              background: `${tierConfig.color}15`,
              color: tierConfig.color,
              fontWeight: 600,
              fontFamily: M,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = `${tierConfig.color}25`; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = `${tierConfig.color}15`; }}
          >
            Unlock Early
          </button>
        </div>
      </div>

    </div>
  );
}

/**
 * Hook for checking feature access without rendering a gate.
 * @param {string} feature - Feature ID
 * @returns {boolean} Whether the feature is unlocked
 */
export function useFeatureAccess(feature) {
  return useUserStore((s) => s.isFeatureUnlocked(feature));
}

export { FeatureGate };
