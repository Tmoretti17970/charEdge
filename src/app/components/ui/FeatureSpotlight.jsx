// ═══════════════════════════════════════════════════════════════════
// charEdge — FeatureSpotlight (Sprint 16)
//
// Pulsing dot + tooltip that appears next to undiscovered features.
// Appears organically as user hits trade milestones.
// Dismissable + persists in useUserStore.
// ═══════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { C, F } from '../../../constants.js';
import { radii, space } from '../../../theme/tokens.js';
import { useFeatureDiscovery } from '../../../hooks/useFeatureDiscovery.js';
import { Card } from './UIKit.jsx';

function FeatureSpotlightCard({ feature, icon, title, desc, onDismiss }) {
  const [hovered, setHovered] = useState(false);

  return (
    <Card
      style={{
        padding: `${space[3]}px ${space[4]}px`,
        display: 'flex',
        alignItems: 'center',
        gap: space[3],
        cursor: 'default',
        transition: 'all 0.2s ease',
        borderColor: hovered ? `${C.b}40` : undefined,
        background: hovered ? `${C.b}06` : undefined,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Pulsing dot */}
      <div
        style={{
          position: 'relative',
          width: 36,
          height: 36,
          borderRadius: 10,
          background: `linear-gradient(135deg, ${C.b}20, ${C.y}15)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          flexShrink: 0,
        }}
      >
        {icon}
        <div
          style={{
            position: 'absolute',
            top: -2,
            right: -2,
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: C.b,
            boxShadow: `0 0 6px ${C.b}60`,
            animation: 'pulse 2s ease-in-out infinite',
          }}
        />
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: C.t1,
            fontFamily: F,
            marginBottom: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span
            style={{
              fontSize: 8,
              fontWeight: 700,
              color: C.b,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              padding: '1px 6px',
              background: `${C.b}15`,
              borderRadius: 4,
            }}
          >
            New
          </span>
          {title}
        </div>
        <div style={{ fontSize: 11, color: C.t3, fontFamily: F }}>{desc}</div>
      </div>

      {/* Dismiss button */}
      <button
        onClick={() => onDismiss(feature)}
        style={{
          background: 'none',
          border: 'none',
          color: C.t3,
          fontSize: 14,
          cursor: 'pointer',
          padding: '4px',
          borderRadius: radii.sm,
          lineHeight: 1,
          opacity: 0.5,
          transition: 'opacity 0.15s',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.5'; }}
        title="Dismiss"
      >
        ✕
      </button>
    </Card>
  );
}

export default function FeatureSpotlight() {
  const { spotlights, dismiss } = useFeatureDiscovery();

  if (spotlights.length === 0) return null;

  // Show max 2 spotlights at a time to avoid overwhelming
  const visible = spotlights.slice(0, 2);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space[2] }}>
      {visible.map((s) => (
        <FeatureSpotlightCard
          key={s.feature}
          feature={s.feature}
          icon={s.icon}
          title={s.title}
          desc={s.desc}
          onDismiss={dismiss}
        />
      ))}
    </div>
  );
}
