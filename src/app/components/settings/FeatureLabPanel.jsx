// ═══════════════════════════════════════════════════════════════════
// charEdge — Feature Lab Panel
//
// Sprint 3: Settings panel where users can see all features,
// their tier requirements, and manually toggle them on/off.
// This is the "Feature Lab" — a power-user escape hatch for
// progressive disclosure.
//
// Accessed from Settings → Feature Lab tab.
// ═══════════════════════════════════════════════════════════════════

import { useState, useMemo } from 'react';
import { C, F, M } from '../../../constants.js';
import { trackFeatureUse } from '../../../observability/telemetry';
import {
  TIER_CONFIG,
  TIERS,
} from '../../../state/user/personaSlice.js';
import { useUserStore } from '../../../state/useUserStore';

const TIER_ORDER = [TIERS.EXPLORER, TIERS.BUILDER, TIERS.ARCHITECT];

function TierFilter({ active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
      <FilterChip label="All" active={active === 'all'} onClick={() => onChange('all')} />
      {TIER_ORDER.map((t) => (
        <FilterChip
          key={t}
          label={`${TIER_CONFIG[t].icon} ${TIER_CONFIG[t].label}`}
          active={active === t}
          color={TIER_CONFIG[t].color}
          onClick={() => onChange(t)}
        />
      ))}
      <FilterChip label="🔓 Unlocked" active={active === 'unlocked'} onClick={() => onChange('unlocked')} />
      <FilterChip label="🔒 Locked" active={active === 'locked'} onClick={() => onChange('locked')} />
    </div>
  );
}

function FilterChip({ label, active, color, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 10px',
        borderRadius: 6,
        border: `1px solid ${active ? (color || C.b) : C.bd}`,
        background: active ? `${color || C.b}18` : 'transparent',
        color: active ? (color || C.b) : C.t3,
        fontSize: 11,
        fontFamily: M,
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
    >
      {label}
    </button>
  );
}

function FeatureRow({ id, requiredTier, unlocked, manuallyUnlocked, currentTier }) {
  const unlockFeature = useUserStore((s) => s.unlockFeature);
  const lockFeature = useUserStore((s) => s.lockFeature);
  const tierConfig = TIER_CONFIG[requiredTier];
  const currentTierIdx = TIER_ORDER.indexOf(currentTier);
  const requiredTierIdx = TIER_ORDER.indexOf(requiredTier);
  const nativelyUnlocked = currentTierIdx >= requiredTierIdx;

  const featureLabel = id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 12px',
        borderRadius: 8,
        background: unlocked ? `${tierConfig.color}08` : 'transparent',
        border: `1px solid ${unlocked ? `${tierConfig.color}20` : C.bd}`,
        transition: 'all 0.15s ease',
      }}
    >
      {/* Status indicator */}
      <div style={{
        width: 8,
        height: 8,
        borderRadius: 4,
        background: unlocked ? '#10b981' : '#ef4444',
        flexShrink: 0,
      }} />

      {/* Feature name */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.t1, fontFamily: F }}>
          {featureLabel}
        </div>
        <div style={{ fontSize: 10, color: C.t3, fontFamily: M }}>
          {tierConfig.icon} {tierConfig.label} required
          {manuallyUnlocked && (
            <span style={{ color: '#f59e0b', marginLeft: 6 }}>• early unlock</span>
          )}
        </div>
      </div>

      {/* Tier badge */}
      <div
        style={{
          padding: '2px 8px',
          borderRadius: 4,
          background: `${tierConfig.color}15`,
          color: tierConfig.color,
          fontSize: 10,
          fontWeight: 700,
          fontFamily: M,
          flexShrink: 0,
        }}
      >
        {tierConfig.label}
      </div>

      {/* Toggle */}
      <button
        onClick={() => {
          if (nativelyUnlocked) return; // can't lock natively unlocked features
          if (unlocked && manuallyUnlocked) {
            lockFeature(id);
            trackFeatureUse('feature_lab_lock', { feature: id });
          } else if (!unlocked) {
            unlockFeature(id);
            trackFeatureUse('feature_lab_unlock', { feature: id });
          }
        }}
        disabled={nativelyUnlocked}
        style={{
          width: 36,
          height: 20,
          borderRadius: 10,
          border: 'none',
          background: unlocked ? '#10b981' : C.bd,
          cursor: nativelyUnlocked ? 'default' : 'pointer',
          position: 'relative',
          transition: 'background 0.2s ease',
          flexShrink: 0,
          opacity: nativelyUnlocked ? 0.5 : 1,
        }}
        title={nativelyUnlocked ? 'Unlocked by your tier' : unlocked ? 'Click to lock' : 'Click to unlock early'}
      >
        <div style={{
          width: 14,
          height: 14,
          borderRadius: 7,
          background: '#fff',
          position: 'absolute',
          top: 3,
          left: unlocked ? 19 : 3,
          transition: 'left 0.2s ease',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }} />
      </button>
    </div>
  );
}

export default function FeatureLabPanel() {
  const tier = useUserStore((s) => s.tier);
  const tradeCount = useUserStore((s) => s.tradeCount);
  const getAllFeatures = useUserStore((s) => s.getAllFeatures);
  const setManualTier = useUserStore((s) => s.setManualTier);
  const clearOverride = useUserStore((s) => s.clearOverride);
  const manualOverride = useUserStore((s) => s.manualOverride);

  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const allFeatures = useMemo(() => getAllFeatures(), [tier, getAllFeatures]);

  const filtered = useMemo(() => {
    let list = allFeatures;

    // Text search
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((f) => f.id.toLowerCase().includes(q));
    }

    // Filter
    if (filter === 'unlocked') {
      list = list.filter((f) => f.unlocked);
    } else if (filter === 'locked') {
      list = list.filter((f) => !f.unlocked);
    } else if (TIER_ORDER.includes(filter)) {
      list = list.filter((f) => f.requiredTier === filter);
    }

    return list;
  }, [allFeatures, filter, search]);

  const tierConfig = TIER_CONFIG[tier];
  const unlockedCount = allFeatures.filter((f) => f.unlocked).length;

  return (
    <div style={{ maxWidth: 700 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 800, color: C.t1, fontFamily: F, margin: '0 0 4px' }}>
          🧪 Feature Lab
        </h3>
        <p style={{ fontSize: 12, color: C.t3, fontFamily: F, margin: 0 }}>
          Control which features are visible. Features unlock automatically as you gain experience,
          but you can unlock them early from here.
        </p>
      </div>

      {/* Current Tier Card */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: 16,
        borderRadius: 10,
        background: `${tierConfig.color}10`,
        border: `1px solid ${tierConfig.color}25`,
        marginBottom: 16,
      }}>
        <span style={{ fontSize: 28 }}>{tierConfig.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: tierConfig.color, fontFamily: F }}>
            {tierConfig.label} Tier
          </div>
          <div style={{ fontSize: 11, color: C.t3, fontFamily: M }}>
            {tradeCount} trades logged • {unlockedCount}/{allFeatures.length} features unlocked
          </div>
        </div>

        {/* Manual tier override for testing */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: C.t3, fontFamily: M, marginRight: 4 }}>Override:</span>
          {TIER_ORDER.map((t) => (
            <button
              key={t}
              onClick={() => {
                if (manualOverride === t) {
                  clearOverride();
                } else {
                  setManualTier(t);
                }
              }}
              style={{
                padding: '3px 8px',
                borderRadius: 4,
                border: `1px solid ${manualOverride === t ? TIER_CONFIG[t].color : C.bd}`,
                background: manualOverride === t ? `${TIER_CONFIG[t].color}20` : 'transparent',
                color: manualOverride === t ? TIER_CONFIG[t].color : C.t3,
                fontSize: 10,
                fontFamily: M,
                cursor: 'pointer',
              }}
              title={manualOverride === t ? 'Click to clear override' : `Override to ${TIER_CONFIG[t].label}`}
            >
              {TIER_CONFIG[t].icon}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search features..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: '100%',
          padding: '8px 12px',
          borderRadius: 8,
          border: `1px solid ${C.bd}`,
          background: C.bg,
          color: C.t1,
          fontSize: 12,
          fontFamily: M,
          marginBottom: 12,
          boxSizing: 'border-box',
          outline: 'none',
        }}
      />

      {/* Filters */}
      <TierFilter active={filter} onChange={setFilter} />

      {/* Feature List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {filtered.map((f) => (
          <FeatureRow
            key={f.id}
            id={f.id}
            requiredTier={f.requiredTier}
            unlocked={f.unlocked}
            manuallyUnlocked={f.manuallyUnlocked}
            currentTier={tier}
          />
        ))}
        {filtered.length === 0 && (
          <div style={{ fontSize: 12, color: C.t3, textAlign: 'center', padding: 24 }}>
            No features match your filter.
          </div>
        )}
      </div>
    </div>
  );
}
