// ═══════════════════════════════════════════════════════════════════
// charEdge — Persona Layout Controller (Sprint 16)
//
// Wraps dashboard sections to show/hide/simplify them based on the
// user's persona tier (Explorer → Builder → Architect).
//
// Explorer: Minimal dashboard — briefing, checklist, bento only
// Builder:  Full dashboard — all Phase 1-3 components
// Architect: Full + advanced features (NL Query, Community, etc.)
//
// Uses the existing useUserStore for tier detection.
// ═══════════════════════════════════════════════════════════════════

import { C, M } from '../../../constants.js';
import { TIERS, TIER_CONFIG } from '../../../state/user/personaSlice.js';
import { useUserStore } from '../../../state/useUserStore';
import { radii } from '../../../theme/tokens.js';
import { useBreakpoints } from '@/hooks/useMediaQuery';

// ─── Layout visibility per tier ──────────────────────────────────

const SECTION_VISIBILITY = {
  // Section ID → minimum tier required
  'smart-action-bar': TIERS.EXPLORER,
  'dashboard-commands': TIERS.BUILDER,
  'morning-briefing': TIERS.EXPLORER,
  'pre-market-checklist': TIERS.EXPLORER,
  'ai-insight': TIERS.BUILDER,
  'session-timeline': TIERS.BUILDER,
  'risk-dashboard': TIERS.BUILDER,
  'hero-trade': TIERS.EXPLORER,
  'progress-arc': TIERS.BUILDER,
  'achievement-showcase': TIERS.EXPLORER,
  'streak-celebration': TIERS.BUILDER,
  'accountability': TIERS.BUILDER,
  'contextual-injector': TIERS.BUILDER,
  'nl-query': TIERS.ARCHITECT,
  'community-pulse': TIERS.ARCHITECT,
  'weekly-digest': TIERS.BUILDER,
  'bento-grid': TIERS.EXPLORER,
};

const TIER_ORDER = [TIERS.EXPLORER, TIERS.BUILDER, TIERS.ARCHITECT];

function meetsMinTier(currentTier, requiredTier) {
  return TIER_ORDER.indexOf(currentTier) >= TIER_ORDER.indexOf(requiredTier);
}

// ─── Section Wrapper ─────────────────────────────────────────────
// Wrap individual sections with this to auto-gate by persona

export function PersonaSection({ sectionId, children }) {
  const tier = useUserStore((s) => s.override || s.tier);
  const requiredTier = SECTION_VISIBILITY[sectionId];

  if (requiredTier && !meetsMinTier(tier, requiredTier)) {
    return null; // Hidden for this tier
  }
  return <>{children}</>;
}

// ─── Layout Banner ───────────────────────────────────────────────
// Shows current tier and a hint about what unlocks next

export function PersonaTierBanner() {
  const tier = useUserStore((s) => s.override || s.tier);
  const tradeCount = useUserStore((s) => s.tradeCount);
  const { isMobile } = useBreakpoints();
  const config = TIER_CONFIG[tier];

  if (!config) return null;

  // Skip banner for Architect (fully unlocked)
  if (tier === TIERS.ARCHITECT) return null;

  const nextTier = tier === TIERS.EXPLORER ? TIERS.BUILDER : TIERS.ARCHITECT;
  const nextConfig = TIER_CONFIG[nextTier];
  const tradesNeeded = (nextConfig?.minTrades || 0) - tradeCount;

  return (
    <div className="tf-container" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: isMobile ? '6px 12px' : '6px 16px',
      borderRadius: radii.xs,
      background: config.color + '08',
      border: `1px solid ${config.color}15`,
      marginBottom: 10,
      fontSize: 10,
      fontFamily: M,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12, lineHeight: 1 }}>{config.icon}</span>
        <span style={{ color: config.color, fontWeight: 700 }}>
          {config.label}
        </span>
        <span style={{ color: C.t3 }}>Mode</span>
      </div>
      {tradesNeeded > 0 && (
        <span style={{ color: C.t3 }}>
          {tradesNeeded} more trade{tradesNeeded !== 1 ? 's' : ''} to unlock {nextConfig?.icon} {nextConfig?.label}
        </span>
      )}
    </div>
  );
}

// ─── Exports ─────────────────────────────────────────────────────

export { SECTION_VISIBILITY, meetsMinTier };
export default PersonaSection;
