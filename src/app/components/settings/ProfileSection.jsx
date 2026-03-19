// ═══════════════════════════════════════════════════════════════════
// charEdge — Profile Section (Sprint 2: Hero Card Redesign)
//
// Apple-style hero card with:
//   - Large avatar + display name + username + member since
//   - Profile completeness progress bar
//   - Inline edit mode with save/cancel
//   - Trading identity (experience, style, markets)
//   - Live Trader Card preview
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useMemo, useCallback } from 'react';
import { C, F, M } from '../../../constants.js';
import {
  AVATAR_OPTIONS,
  EXPERIENCE_LEVELS,
  MARKET_OPTIONS,
  TRADING_STYLES,
  calcCompleteness,
} from '../../../state/user/profileSlice.js';
import { useUserStore } from '../../../state/useUserStore';
import { getAvatarDisplay } from '../../../utils/avatarUtils.js';
import { radii, transition } from '../../../theme/tokens.js';
import { Card, Btn, inputStyle } from '../ui/UIKit.jsx';
import AvatarUpload from './AvatarUpload.jsx';

function ProfileSection() {
  const profile = useUserStore((s) => s.profile);
  const updateProfile = useUserStore((s) => s.updateProfile);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});

  // Merge profile with defaults for safety
  const p = useMemo(() => ({
    avatar: '🔥',
    displayName: '',
    username: '',
    bio: '',
    memberSince: Date.now(),
    tradingExperience: '',
    tradingStyle: '',
    preferredMarkets: [],
    timezone: 'UTC',
    socialLinks: { twitter: '', discord: '', tradingview: '' },
    ...profile,
  }), [profile]);

  const completeness = useMemo(() => calcCompleteness(p), [p]);

  const startEditing = useCallback(() => {
    setDraft({ ...p });
    setEditing(true);
  }, [p]);

  const cancelEditing = useCallback(() => {
    setDraft({});
    setEditing(false);
  }, []);

  const saveProfile = useCallback(() => {
    updateProfile(draft);
    setEditing(false);
    setDraft({});
  }, [draft, updateProfile]);

  const updateDraft = useCallback((updates) => {
    setDraft((d) => ({ ...d, ...updates }));
  }, []);

  const toggleMarket = useCallback((marketId) => {
    setDraft((d) => {
      const current = d.preferredMarkets || [];
      return {
        ...d,
        preferredMarkets: current.includes(marketId)
          ? current.filter((m) => m !== marketId)
          : [...current, marketId],
      };
    });
  }, []);

  const memberSinceStr = useMemo(() => {
    const d = new Date(p.memberSince);
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }, [p.memberSince]);

  // ─── Editing mode ──────────────────────────────────────────
  if (editing) {
    return (
      <section style={{ marginBottom: 40 }}>
        <Card style={{ padding: 24 }}>
          {/* Edit Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${C.bd}30`,
          }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.t1, fontFamily: F }}>
              Edit Profile
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="ghost" onClick={cancelEditing}
                style={{ fontSize: 12, padding: '6px 14px' }}>Cancel</Btn>
              <Btn onClick={saveProfile}
                style={{ fontSize: 12, padding: '6px 14px' }}>Save Profile</Btn>
            </div>
          </div>

          {/* Avatar Picker — 3-tab component */}
          <AvatarUpload draft={draft} onUpdate={updateDraft} />

          {/* Name Fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.t2, fontFamily: F, display: 'block', marginBottom: 4 }}>
                Display Name
              </label>
              <input
                value={draft.displayName || ''}
                onChange={(e) => updateDraft({ displayName: e.target.value })}
                placeholder="Your display name"
                maxLength={30}
                style={{ ...inputStyle, width: '100%' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.t2, fontFamily: F, display: 'block', marginBottom: 4 }}>
                Username
              </label>
              <input
                value={draft.username || ''}
                onChange={(e) => updateDraft({ username: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })}
                placeholder="your_username"
                maxLength={20}
                style={{ ...inputStyle, width: '100%', fontFamily: M }}
              />
            </div>
          </div>

          {/* Bio */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.t2, fontFamily: F, display: 'block', marginBottom: 4 }}>
              Bio
            </label>
            <textarea
              value={draft.bio || ''}
              onChange={(e) => updateDraft({ bio: e.target.value })}
              placeholder="Trading style, experience, interests..."
              maxLength={150}
              rows={2}
              style={{ ...inputStyle, resize: 'vertical', width: '100%' }}
            />
            <div style={{ fontSize: 10, color: C.t3, textAlign: 'right', marginTop: 2, fontFamily: M }}>
              {(draft.bio || '').length}/150
            </div>
          </div>

          {/* Trading Identity */}
          <div style={{ paddingTop: 16, borderTop: `1px solid ${C.bd}30` }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, marginBottom: 12, fontFamily: F }}>
              Trading Identity
            </div>

            {/* Experience Level */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.t3, marginBottom: 6, fontFamily: F }}>
                Experience Level
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {EXPERIENCE_LEVELS.map((level) => (
                  <button
                    key={level.id}
                    onClick={() => updateDraft({ tradingExperience: level.id })}
                    className="tf-btn"
                    title={level.hint}
                    style={{
                      padding: '6px 14px', borderRadius: radii.sm,
                      border: `1px solid ${draft.tradingExperience === level.id ? C.b : C.bd}`,
                      background: draft.tradingExperience === level.id ? C.b + '12' : 'transparent',
                      color: draft.tradingExperience === level.id ? C.b : C.t2,
                      fontSize: 12, fontWeight: 600, fontFamily: F,
                      cursor: 'pointer', transition: `all ${transition.base}`,
                    }}
                  >
                    {level.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Trading Style */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.t3, marginBottom: 6, fontFamily: F }}>
                Trading Style
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {TRADING_STYLES.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => updateDraft({ tradingStyle: style.id })}
                    className="tf-btn"
                    style={{
                      padding: '6px 14px', borderRadius: radii.sm,
                      border: `1px solid ${draft.tradingStyle === style.id ? C.b : C.bd}`,
                      background: draft.tradingStyle === style.id ? C.b + '12' : 'transparent',
                      color: draft.tradingStyle === style.id ? C.b : C.t2,
                      fontSize: 12, fontWeight: 600, fontFamily: F,
                      cursor: 'pointer', transition: `all ${transition.base}`,
                    }}
                  >
                    {style.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Preferred Markets */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.t3, marginBottom: 6, fontFamily: F }}>
                Preferred Markets
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {MARKET_OPTIONS.map((market) => {
                  const selected = (draft.preferredMarkets || []).includes(market.id);
                  return (
                    <button
                      key={market.id}
                      onClick={() => toggleMarket(market.id)}
                      className="tf-btn"
                      style={{
                        padding: '6px 14px', borderRadius: radii.sm,
                        border: `1px solid ${selected ? C.b : C.bd}`,
                        background: selected ? C.b + '12' : 'transparent',
                        color: selected ? C.b : C.t2,
                        fontSize: 12, fontWeight: 600, fontFamily: F,
                        cursor: 'pointer', transition: `all ${transition.base}`,
                      }}
                    >
                      {market.emoji} {market.label}
                    </button>
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
    <section style={{ marginBottom: 24 }}>
      {/* Hero Card */}
      <Card style={{
        padding: 0,
        overflow: 'hidden',
        background: `linear-gradient(135deg, ${C.sf}, ${C.b}06)`,
      }}>
        <div style={{ padding: '24px 24px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            {/* Large Avatar — dynamic rendering */}
            {(() => {
              const av = getAvatarDisplay(p, 64);
              return (
                <div style={{
                  ...av.style,
                  border: `2px solid ${C.b}30`,
                  background: av.type === 'image'
                    ? undefined
                    : av.type === 'initials'
                      ? (p.avatarColor || '#E8590C')
                      : `linear-gradient(135deg, ${C.b}20, ${C.b}08)`,
                  backgroundImage: av.type === 'image' ? `url(${p.avatarImage})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}>
                  {av.type !== 'image' && av.content}
                </div>
              );
            })()}

            {/* Identity */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 20, fontWeight: 800, fontFamily: F, color: C.t1,
                lineHeight: 1.2,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {p.displayName || 'Set your name'}
              </div>
              <div style={{
                fontSize: 13, color: C.t3, fontFamily: M, marginTop: 2,
                display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
              }}>
                {p.username ? `@${p.username}` : 'No username set'}
                <span style={{
                  width: 3, height: 3, borderRadius: '50%', background: C.t3 + '60',
                }} />
                <span>Member since {memberSinceStr}</span>
              </div>

              {/* Bio */}
              {p.bio && (
                <div style={{
                  fontSize: 12, color: C.t2, fontFamily: F,
                  marginTop: 8, lineHeight: 1.4,
                }}>
                  {p.bio}
                </div>
              )}

              {/* Trading identity tags */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                {p.tradingExperience && (
                  <span style={{
                    padding: '2px 8px', borderRadius: radii.pill,
                    background: C.b + '12', color: C.b,
                    fontSize: 10, fontWeight: 600, fontFamily: M,
                  }}>
                    {EXPERIENCE_LEVELS.find((l) => l.id === p.tradingExperience)?.label}
                  </span>
                )}
                {p.tradingStyle && (
                  <span style={{
                    padding: '2px 8px', borderRadius: radii.pill,
                    background: C.b + '12', color: C.b,
                    fontSize: 10, fontWeight: 600, fontFamily: M,
                  }}>
                    {TRADING_STYLES.find((s) => s.id === p.tradingStyle)?.label}
                  </span>
                )}
                {(p.preferredMarkets || []).map((mId) => {
                  const m = MARKET_OPTIONS.find((o) => o.id === mId);
                  return m ? (
                    <span key={mId} style={{
                      padding: '2px 8px', borderRadius: radii.pill,
                      background: C.sf2 || C.bd + '20', color: C.t2,
                      fontSize: 10, fontWeight: 600, fontFamily: M,
                    }}>
                      {m.emoji} {m.label}
                    </span>
                  ) : null;
                })}
              </div>
            </div>

            {/* Edit button */}
            <button
              onClick={startEditing}
              className="tf-btn"
              style={{
                padding: '6px 14px', borderRadius: radii.sm,
                border: `1px solid ${C.bd}`,
                background: 'transparent',
                color: C.t2, fontSize: 12, fontWeight: 600, fontFamily: F,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
                transition: `all ${transition.base}`,
                flexShrink: 0,
              }}
            >
              ✏️ Edit
            </button>
          </div>

          {/* Profile Completeness */}
          <div style={{ marginTop: 16 }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 4,
            }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: C.t3, fontFamily: M }}>
                Profile {completeness}% complete
              </span>
              {completeness < 100 && (
                <button
                  onClick={startEditing}
                  className="tf-btn"
                  style={{
                    background: 'none', border: 'none', padding: 0,
                    color: C.b, fontSize: 10, fontWeight: 600, fontFamily: F,
                    cursor: 'pointer',
                  }}
                >
                  Complete your profile →
                </button>
              )}
            </div>
            <div style={{
              height: 4, borderRadius: 2,
              background: C.bd + '30',
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${completeness}%`,
                height: '100%', borderRadius: 2,
                background: completeness === 100
                  ? C.g
                  : `linear-gradient(90deg, ${C.b}, ${C.b}90)`,
                transition: `width 0.5s ease`,
              }} />
            </div>
          </div>
        </div>
      </Card>

      {/* Trader Card Preview */}
      <Card style={{ padding: 20, marginTop: 12 }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 12,
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: F }}>
              Trader Card
            </div>
            <div style={{ fontSize: 11, color: C.t3, fontFamily: F }}>
              Your shareable trader identity card
            </div>
          </div>
          <Btn variant="ghost"
            onClick={() => {/* copy-to-clipboard will be Sprint 9 */}}
            style={{ fontSize: 11, padding: '4px 10px' }}
          >
            📋 Copy
          </Btn>
        </div>

        {/* Mini Trader Card Preview */}
        <div style={{
          padding: 16, borderRadius: radii.md,
          background: `linear-gradient(135deg, ${C.b}08, ${C.b}03)`,
          border: `1px solid ${C.b}15`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {(() => {
              const av = getAvatarDisplay(p, 44);
              return (
                <div style={{
                  ...av.style,
                  borderRadius: 12,
                  background: av.type === 'image'
                    ? undefined
                    : av.type === 'initials'
                      ? (p.avatarColor || '#E8590C')
                      : C.b + '15',
                  backgroundImage: av.type === 'image' ? `url(${p.avatarImage})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}>
                  {av.type !== 'image' && av.content}
                </div>
              );
            })()}
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.t1, fontFamily: F }}>
                {p.displayName || 'Your Name'}
              </div>
              <div style={{ fontSize: 11, color: C.t3, fontFamily: M }}>
                {p.username ? `@${p.username}` : '@username'}
                {p.tradingExperience && ` · ${EXPERIENCE_LEVELS.find((l) => l.id === p.tradingExperience)?.label}`}
              </div>
            </div>
          </div>
          {p.bio && (
            <div style={{
              fontSize: 11, color: C.t2, fontFamily: F,
              marginTop: 10, lineHeight: 1.4,
              fontStyle: 'italic',
            }}>
              "{p.bio}"
            </div>
          )}
          <div style={{
            display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap',
          }}>
            {(p.preferredMarkets || []).map((mId) => {
              const m = MARKET_OPTIONS.find((o) => o.id === mId);
              return m ? (
                <span key={mId} style={{
                  padding: '1px 6px', borderRadius: 4,
                  background: C.b + '10', color: C.b,
                  fontSize: 9, fontWeight: 600, fontFamily: M,
                }}>
                  {m.emoji} {m.label}
                </span>
              ) : null;
            })}
          </div>
        </div>
      </Card>
    </section>
  );
}

export default React.memo(ProfileSection);
