// ═══════════════════════════════════════════════════════════════════
// charEdge — Profile Section (Sprint 2: Hero Card Redesign)
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useMemo, useCallback } from 'react';
import { C } from '../../../constants.js';
import {
  EXPERIENCE_LEVELS, MARKET_OPTIONS, TRADING_STYLES, calcCompleteness,
} from '../../../state/user/profileSlice.js';
import { useUserStore } from '../../../state/useUserStore';
import { getAvatarDisplay } from '../../../utils/avatarUtils.js';
import { Card, Btn, inputStyle } from '../ui/UIKit.jsx';
import AvatarUpload from './AvatarUpload.jsx';
import st from './ProfileSection.module.css';

function ProfileSection() {
  const profile = useUserStore((s) => s.profile);
  const updateProfile = useUserStore((s) => s.updateProfile);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});

  const p = useMemo(() => ({
    avatar: '🔥', displayName: '', username: '', bio: '',
    memberSince: Date.now(), tradingExperience: '', tradingStyle: '',
    preferredMarkets: [], timezone: 'UTC',
    socialLinks: { twitter: '', discord: '', tradingview: '' }, ...profile,
  }), [profile]);

  const completeness = useMemo(() => calcCompleteness(p), [p]);
  const startEditing = useCallback(() => { setDraft({ ...p }); setEditing(true); }, [p]);
  const cancelEditing = useCallback(() => { setDraft({}); setEditing(false); }, []);
  const saveProfile = useCallback(() => { updateProfile(draft); setEditing(false); setDraft({}); }, [draft, updateProfile]);
  const updateDraft = useCallback((updates) => { setDraft((d) => ({ ...d, ...updates })); }, []);
  const toggleMarket = useCallback((marketId) => {
    setDraft((d) => {
      const current = d.preferredMarkets || [];
      return { ...d, preferredMarkets: current.includes(marketId) ? current.filter((m) => m !== marketId) : [...current, marketId] };
    });
  }, []);

  const memberSinceStr = useMemo(() => {
    const d = new Date(p.memberSince);
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }, [p.memberSince]);

  // ─── Editing mode ──────────────────────────────────────────
  if (editing) {
    return (
      <section className={st.section}>
        <Card style={{ padding: 24 }}>
          <div className={st.editHeader}>
            <div className={st.editTitle}>Edit Profile</div>
            <div className={st.editBtns}>
              <Btn variant="ghost" onClick={cancelEditing} style={{ fontSize: 12, padding: '6px 14px' }}>Cancel</Btn>
              <Btn onClick={saveProfile} style={{ fontSize: 12, padding: '6px 14px' }}>Save Profile</Btn>
            </div>
          </div>

          <AvatarUpload draft={draft} onUpdate={updateDraft} />

          <div className={st.nameGrid}>
            <div>
              <label className={st.fieldLabel}>Display Name</label>
              <input value={draft.displayName || ''} onChange={(e) => updateDraft({ displayName: e.target.value })}
                placeholder="Your display name" maxLength={30} style={{ ...inputStyle, width: '100%' }} />
            </div>
            <div>
              <label className={st.fieldLabel}>Username</label>
              <input value={draft.username || ''} onChange={(e) => updateDraft({ username: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })}
                placeholder="your_username" maxLength={20} style={{ ...inputStyle, width: '100%', fontFamily: 'var(--tf-mono)' }} />
            </div>
          </div>

          <div className={st.bioWrap}>
            <label className={st.fieldLabel}>Bio</label>
            <textarea value={draft.bio || ''} onChange={(e) => updateDraft({ bio: e.target.value })}
              placeholder="Trading style, experience, interests..." maxLength={150} rows={2}
              style={{ ...inputStyle, resize: 'vertical', width: '100%' }} />
            <div className={st.bioCount}>{(draft.bio || '').length}/150</div>
          </div>

          <div className={st.identitySection}>
            <div className={st.identityTitle}>Trading Identity</div>

            <div className={st.fieldGroup}>
              <div className={st.fieldLabelSm}>Experience Level</div>
              <div className={st.chipRow}>
                {EXPERIENCE_LEVELS.map((level) => (
                  <button key={level.id} onClick={() => updateDraft({ tradingExperience: level.id })}
                    className={`tf-btn ${st.chipBtn} ${draft.tradingExperience === level.id ? st.chipBtnActive : st.chipBtnInactive}`}
                    title={level.hint}>{level.label}</button>
                ))}
              </div>
            </div>

            <div className={st.fieldGroup}>
              <div className={st.fieldLabelSm}>Trading Style</div>
              <div className={st.chipRow}>
                {TRADING_STYLES.map((style) => (
                  <button key={style.id} onClick={() => updateDraft({ tradingStyle: style.id })}
                    className={`tf-btn ${st.chipBtn} ${draft.tradingStyle === style.id ? st.chipBtnActive : st.chipBtnInactive}`}>
                    {style.label}</button>
                ))}
              </div>
            </div>

            <div>
              <div className={st.fieldLabelSm}>Preferred Markets</div>
              <div className={st.chipRow}>
                {MARKET_OPTIONS.map((market) => {
                  const selected = (draft.preferredMarkets || []).includes(market.id);
                  return (
                    <button key={market.id} onClick={() => toggleMarket(market.id)}
                      className={`tf-btn ${st.chipBtn} ${selected ? st.chipBtnActive : st.chipBtnInactive}`}>
                      {market.emoji} {market.label}</button>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>
      </section>
    );
  }

  // ─── Display mode (Hero Card) ─────────────────────────────
  return (
    <section className={st.sectionSm}>
      <Card className={st.heroCard}
        style={{ background: `linear-gradient(135deg, ${C.sf}, ${C.b}06)` }}>
        <div className={st.heroPad}>
          <div className={st.heroRow}>
            {(() => {
              const av = getAvatarDisplay(p, 64);
              return (
                <div style={{
                  ...av.style,
                  border: `2px solid ${C.b}30`,
                  background: av.type === 'image' ? undefined
                    : av.type === 'initials' ? (p.avatarColor || '#E8590C')
                    : `linear-gradient(135deg, ${C.b}20, ${C.b}08)`,
                  backgroundImage: av.type === 'image' ? `url(${p.avatarImage})` : undefined,
                  backgroundSize: 'cover', backgroundPosition: 'center',
                }}>
                  {av.type !== 'image' && av.content}
                </div>
              );
            })()}

            <div className={st.identity}>
              <div className={st.displayName}>{p.displayName || 'Set your name'}</div>
              <div className={st.metaRow}>
                {p.username ? `@${p.username}` : 'No username set'}
                <span className={st.dotSep} />
                <span>Member since {memberSinceStr}</span>
              </div>
              {p.bio && <div className={st.bio}>{p.bio}</div>}
              <div className={st.tagRow}>
                {p.tradingExperience && (
                  <span className={`${st.tag} ${st.tagAccent}`}>
                    {EXPERIENCE_LEVELS.find((l) => l.id === p.tradingExperience)?.label}
                  </span>
                )}
                {p.tradingStyle && (
                  <span className={`${st.tag} ${st.tagAccent}`}>
                    {TRADING_STYLES.find((s) => s.id === p.tradingStyle)?.label}
                  </span>
                )}
                {(p.preferredMarkets || []).map((mId) => {
                  const m = MARKET_OPTIONS.find((o) => o.id === mId);
                  return m ? <span key={mId} className={`${st.tag} ${st.tagMuted}`}>{m.emoji} {m.label}</span> : null;
                })}
              </div>
            </div>

            <button onClick={startEditing} className={`tf-btn ${st.editBtn}`}>✏️ Edit</button>
          </div>

          <div className={st.completenessWrap}>
            <div className={st.completenessHeader}>
              <span className={st.completenessLabel}>Profile {completeness}% complete</span>
              {completeness < 100 && (
                <button onClick={startEditing} className={`tf-btn ${st.completenessLink}`}>Complete your profile →</button>
              )}
            </div>
            <div className={st.progressTrack}>
              <div className={st.progressFill} style={{
                width: `${completeness}%`,
                background: completeness === 100 ? C.g : `linear-gradient(90deg, ${C.b}, ${C.b}90)`,
              }} />
            </div>
          </div>
        </div>
      </Card>

      <Card style={{ padding: 20, marginTop: 12 }}>
        <div className={st.traderCardHeader}>
          <div>
            <div className={st.traderCardTitle}>Trader Card</div>
            <div className={st.traderCardHint}>Your shareable trader identity card</div>
          </div>
          <Btn variant="ghost" onClick={() => {}} style={{ fontSize: 11, padding: '4px 10px' }}>📋 Copy</Btn>
        </div>

        <div className={st.traderPreview}
          style={{ background: `linear-gradient(135deg, ${C.b}08, ${C.b}03)` }}>
          <div className={st.traderPreviewRow}>
            {(() => {
              const av = getAvatarDisplay(p, 44);
              return (
                <div style={{
                  ...av.style, borderRadius: 12,
                  background: av.type === 'image' ? undefined : av.type === 'initials' ? (p.avatarColor || '#E8590C') : C.b + '15',
                  backgroundImage: av.type === 'image' ? `url(${p.avatarImage})` : undefined,
                  backgroundSize: 'cover', backgroundPosition: 'center',
                }}>
                  {av.type !== 'image' && av.content}
                </div>
              );
            })()}
            <div>
              <div className={st.traderName}>{p.displayName || 'Your Name'}</div>
              <div className={st.traderMeta}>
                {p.username ? `@${p.username}` : '@username'}
                {p.tradingExperience && ` · ${EXPERIENCE_LEVELS.find((l) => l.id === p.tradingExperience)?.label}`}
              </div>
            </div>
          </div>
          {p.bio && <div className={st.traderBio}>"{p.bio}"</div>}
          <div className={st.traderTags}>
            {(p.preferredMarkets || []).map((mId) => {
              const m = MARKET_OPTIONS.find((o) => o.id === mId);
              return m ? <span key={mId} className={st.traderTag}>{m.emoji} {m.label}</span> : null;
            })}
          </div>
        </div>
      </Card>
    </section>
  );
}

export default React.memo(ProfileSection);
