// ═══════════════════════════════════════════════════════════════════
// charEdge — Sidebar Persona Badge
//
// Compact badge showing the user's current tier (Explorer/Builder/
// Architect) with a subtle progress indicator toward the next tier.
// Appears in the sidebar below the XP badge.
// ═══════════════════════════════════════════════════════════════════

import { C, F, M } from '../../../constants.js';
import { TIER_CONFIG, TIERS } from '../../../state/user/personaSlice.js';
import { useUserStore } from '../../../state/useUserStore';
import { alpha } from '@/shared/colorUtils';

const NEXT_TIER = {
  [TIERS.EXPLORER]: TIERS.BUILDER,
  [TIERS.BUILDER]: TIERS.ARCHITECT,
  [TIERS.ARCHITECT]: null,
};

export default function SidebarPersonaBadge({ expanded }) {
  const tier = useUserStore((s) => s.tier);
  const tradeCount = useUserStore((s) => s.tradeCount);
  const config = TIER_CONFIG[tier];
  const nextTier = NEXT_TIER[tier];
  const nextConfig = nextTier ? TIER_CONFIG[nextTier] : null;

  // Progress toward next tier
  let progress = 1;
  if (nextConfig) {
    const range = nextConfig.minTrades - config.minTrades;
    const current = tradeCount - config.minTrades;
    progress = Math.min(1, Math.max(0, current / range));
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: expanded ? '4px 12px' : '4px 0',
        justifyContent: expanded ? 'flex-start' : 'center',
      }}
      title={`${config.label} — ${tradeCount} trades${nextConfig ? ` (${nextConfig.minTrades - tradeCount} to ${nextConfig.label})` : ''}`}
    >
      {/* Tier icon with glow */}
      <div
        style={{
          width: 28,
          height: 28,
          minWidth: 28,
          borderRadius: 8,
          background: alpha(config.color, 0.12),
          border: `1px solid ${alpha(config.color, 0.25)}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          position: 'relative',
        }}
      >
        {config.icon}

        {/* Progress ring (only when not max tier) */}
        {nextConfig && (
          <svg
            width="28"
            height="28"
            viewBox="0 0 28 28"
            style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}
          >
            <circle
              cx="14"
              cy="14"
              r="12"
              fill="none"
              stroke={alpha(config.color, 0.15)}
              strokeWidth="2"
            />
            <circle
              cx="14"
              cy="14"
              r="12"
              fill="none"
              stroke={config.color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={`${progress * 75.4} 75.4`}
              style={{ transition: 'stroke-dasharray 0.5s ease' }}
            />
          </svg>
        )}
      </div>

      {/* Label (expanded only) */}
      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, overflow: 'hidden' }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              fontFamily: F,
              color: config.color,
              whiteSpace: 'nowrap',
            }}
          >
            {config.label}
          </span>
          <span
            style={{
              fontSize: 9,
              fontFamily: M,
              color: C.t3,
              whiteSpace: 'nowrap',
            }}
          >
            {nextConfig
              ? `${tradeCount}/${nextConfig.minTrades} trades`
              : `${tradeCount} trades ★`}
          </span>
        </div>
      )}
    </div>
  );
}
