// ═══════════════════════════════════════════════════════════════════
// charEdge — Refractive Glass Depth System (E1.1)
//
// 4-tier depth model with per-tier specular highlights, variable blur,
// and shadow depth. Maps to CSS custom properties in tokens.css.
//
// Usage:
//   import { getGlassStyle, DEPTH_TIERS, applyDepthClass } from './GlassDepthSystem';
//   <div style={getGlassStyle('raised')} />
//   <div className={applyDepthClass('floating')} />
// ═══════════════════════════════════════════════════════════════════

export type DepthTier = 'surface' | 'raised' | 'floating' | 'overlay';

/** CSS token mappings per depth tier */
export const DEPTH_TIERS: Record<DepthTier, {
  bg: string;
  blur: string;
  specular: string;
  shadow: string;
  zRange: string;
}> = {
  surface: {
    bg: 'var(--tf-depth-surface-bg)',
    blur: 'var(--tf-depth-surface-blur)',
    specular: 'var(--tf-depth-surface-specular)',
    shadow: 'var(--tf-shadow-0)',
    zRange: '0–10',
  },
  raised: {
    bg: 'var(--tf-depth-raised-bg)',
    blur: 'var(--tf-depth-raised-blur)',
    specular: 'var(--tf-depth-raised-specular)',
    shadow: 'var(--tf-shadow-1)',
    zRange: '10–100',
  },
  floating: {
    bg: 'var(--tf-depth-floating-bg)',
    blur: 'var(--tf-depth-floating-blur)',
    specular: 'var(--tf-depth-floating-specular)',
    shadow: 'var(--tf-shadow-2)',
    zRange: '100–500',
  },
  overlay: {
    bg: 'var(--tf-depth-overlay-bg)',
    blur: 'var(--tf-depth-overlay-blur)',
    specular: 'var(--tf-depth-overlay-specular)',
    shadow: 'var(--tf-shadow-3)',
    zRange: '500+',
  },
};

/**
 * Get inline style object for a glass depth tier.
 * Applies background, backdrop-filter, box-shadow (specular + elevation).
 */
export function getGlassStyle(tier: DepthTier): Record<string, string> {
  const t = DEPTH_TIERS[tier];
  return {
    background: t.bg,
    backdropFilter: t.blur,
    WebkitBackdropFilter: t.blur,
    boxShadow: `${t.specular}, ${t.shadow}`,
  };
}

/**
 * Get CSS class name for a depth tier.
 * Maps to `.tf-depth-{tier}` utility classes.
 */
export function applyDepthClass(tier: DepthTier): string {
  return `tf-depth-${tier}`;
}

/**
 * Determine appropriate depth tier based on element role.
 */
export function inferDepthTier(role: string): DepthTier {
  switch (role) {
    case 'toolbar':
    case 'status-bar':
    case 'sidebar':
      return 'surface';
    case 'card':
    case 'panel':
    case 'widget':
      return 'raised';
    case 'dropdown':
    case 'menu':
    case 'popover':
    case 'tooltip':
      return 'floating';
    case 'modal':
    case 'dialog':
    case 'overlay':
      return 'overlay';
    default:
      return 'surface';
  }
}
