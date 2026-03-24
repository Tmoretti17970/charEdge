// ═══════════════════════════════════════════════════════════════════
// charEdge — Feature Lab Panel (Sprint 3)
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useState, useMemo } from 'react';
import { C } from '../../../constants.js';
import { trackFeatureUse } from '../../../observability/telemetry';
import { TIER_CONFIG, TIERS } from '../../../state/user/personaSlice.js';
import { useUserStore } from '../../../state/useUserStore';
import st from './FeatureLabPanel.module.css';

const TIER_ORDER = [TIERS.EXPLORER, TIERS.BUILDER, TIERS.ARCHITECT];

function TierFilter({ active, onChange }) {
  return (
    <div className={st.filterRow}>
      <FilterChip label="All" active={active === 'all'} onClick={() => onChange('all')} />
      {TIER_ORDER.map((t) => (
        <FilterChip key={t} label={`${TIER_CONFIG[t].icon} ${TIER_CONFIG[t].label}`}
          active={active === t} color={TIER_CONFIG[t].color} onClick={() => onChange(t)} />
      ))}
      <FilterChip label="🔓 Unlocked" active={active === 'unlocked'} onClick={() => onChange('unlocked')} />
      <FilterChip label="🔒 Locked" active={active === 'locked'} onClick={() => onChange('locked')} />
    </div>
  );
}

function FilterChip({ label, active, color, onClick }) {
  return (
    <button onClick={onClick} className={st.filterChip}
      style={{
        border: `1px solid ${active ? (color || C.b) : C.bd}`,
        background: active ? `${color || C.b}18` : 'transparent',
        color: active ? (color || C.b) : C.t3,
      }}>
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
    <div className={st.featureRow}
      style={{
        background: unlocked ? `${tierConfig.color}08` : 'transparent',
        border: `1px solid ${unlocked ? `${tierConfig.color}20` : C.bd}`,
      }}>
      <div className={st.statusDot} style={{ background: unlocked ? '#10b981' : '#ef4444' }} />
      <div className={st.featureBody}>
        <div className={st.featureName}>{featureLabel}</div>
        <div className={st.featureTier}>
          {tierConfig.icon} {tierConfig.label} required
          {manuallyUnlocked && <span className={st.earlyBadge}>• early unlock</span>}
        </div>
      </div>
      <div className={st.tierBadge} style={{ background: `${tierConfig.color}15`, color: tierConfig.color }}>
        {tierConfig.label}
      </div>
      <button
        onClick={() => {
          if (nativelyUnlocked) return;
          if (unlocked && manuallyUnlocked) { lockFeature(id); trackFeatureUse('feature_lab_lock', { feature: id }); }
          else if (!unlocked) { unlockFeature(id); trackFeatureUse('feature_lab_unlock', { feature: id }); }
        }}
        disabled={nativelyUnlocked}
        className={st.toggleSwitch}
        style={{ background: unlocked ? '#10b981' : C.bd, cursor: nativelyUnlocked ? 'default' : 'pointer', opacity: nativelyUnlocked ? 0.5 : 1 }}
        title={nativelyUnlocked ? 'Unlocked by your tier' : unlocked ? 'Click to lock' : 'Click to unlock early'}>
        <div className={st.toggleKnob} style={{ left: unlocked ? 19 : 3 }} />
      </button>
    </div>
  );
}

function FeatureLabPanel() {
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
    if (search) { const q = search.toLowerCase(); list = list.filter((f) => f.id.toLowerCase().includes(q)); }
    if (filter === 'unlocked') list = list.filter((f) => f.unlocked);
    else if (filter === 'locked') list = list.filter((f) => !f.unlocked);
    else if (TIER_ORDER.includes(filter)) list = list.filter((f) => f.requiredTier === filter);
    return list;
  }, [allFeatures, filter, search]);

  const tierConfig = TIER_CONFIG[tier];
  const unlockedCount = allFeatures.filter((f) => f.unlocked).length;

  return (
    <div className={st.root}>
      <div className={st.header}>
        <h3 className={st.headerTitle}>🧪 Feature Lab</h3>
        <p className={st.headerDesc}>
          Control which features are visible. Features unlock automatically as you gain experience,
          but you can unlock them early from here.
        </p>
      </div>

      <div className={st.tierCard}
        style={{ background: `${tierConfig.color}10`, border: `1px solid ${tierConfig.color}25` }}>
        <span className={st.tierIcon}>{tierConfig.icon}</span>
        <div className={st.tierBody}>
          <div className={st.tierName} style={{ color: tierConfig.color }}>{tierConfig.label} Tier</div>
          <div className={st.tierMeta}>{tradeCount} trades logged • {unlockedCount}/{allFeatures.length} features unlocked</div>
        </div>
        <div className={st.overrideRow}>
          <span className={st.overrideLabel}>Override:</span>
          {TIER_ORDER.map((t) => (
            <button key={t}
              onClick={() => { if (manualOverride === t) clearOverride(); else setManualTier(t); }}
              className={st.overrideBtn}
              style={{
                border: `1px solid ${manualOverride === t ? TIER_CONFIG[t].color : C.bd}`,
                background: manualOverride === t ? `${TIER_CONFIG[t].color}20` : 'transparent',
                color: manualOverride === t ? TIER_CONFIG[t].color : C.t3,
              }}
              title={manualOverride === t ? 'Click to clear override' : `Override to ${TIER_CONFIG[t].label}`}>
              {TIER_CONFIG[t].icon}
            </button>
          ))}
        </div>
      </div>

      <input type="text" placeholder="Search features..." value={search}
        onChange={(e) => setSearch(e.target.value)} className={st.searchInput} />

      <TierFilter active={filter} onChange={setFilter} />

      <div className={st.featureList}>
        {filtered.map((f) => (
          <FeatureRow key={f.id} id={f.id} requiredTier={f.requiredTier}
            unlocked={f.unlocked} manuallyUnlocked={f.manuallyUnlocked} currentTier={tier} />
        ))}
        {filtered.length === 0 && <div className={st.empty}>No features match your filter.</div>}
      </div>
    </div>
  );
}

export default React.memo(FeatureLabPanel);
