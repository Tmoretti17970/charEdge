import React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { C, M } from '../../../constants.js';
// Wave 0: useSocialStore quarantined — social features removed from v1.0 scope
// Profile data will be managed via user store in Wave 6 (Supabase auth)
import { Card, Btn, inputStyle } from '../ui/UIKit.jsx';
// Wave 0: TraderCard quarantined — social features removed from v1.0 scope
function TraderCard() { return null; }
import { SectionHeader, SettingRow } from './SettingsHelpers.jsx';

const AVATAR_OPTIONS = ['🔥', '🐂', '🐻', '🦈', '🦅', '🐺', '🦁', '🐲', '🦊', '🎯', '💎', '⚡', '🌊', '🏔️', '🎲', '🧠'];

function ProfileSection() {
  // Wave 0: useSocialStore quarantined — using local defaults
  const myProfile = null;
  const loadMyProfile = useCallback(() => { }, []);
  const updateMyProfile = useCallback(() => { }, []);
  const [profileForm, setProfileForm] = useState({});

  useEffect(() => { loadMyProfile(); }, [loadMyProfile]);
  useEffect(() => {
    if (myProfile) {
      setProfileForm({ username: myProfile.username || '', displayName: myProfile.displayName || '', bio: myProfile.bio || '', avatar: myProfile.avatar || '🔥' });
    }
  }, [myProfile]);

  const saveProfile = useCallback(() => { updateMyProfile(profileForm); }, [profileForm, updateMyProfile]);

  return (
    <section style={{ marginBottom: 40 }}>
      <SectionHeader icon="user" title="Profile" description="Your community identity" />
      <Card style={{ padding: 20 }}>
        <SettingRow label="Avatar">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {AVATAR_OPTIONS.map((emoji) => (
              <button key={emoji} onClick={() => setProfileForm((f) => ({ ...f, avatar: emoji }))} className="tf-btn"
                style={{ width: 36, height: 36, borderRadius: '50%', border: `2px solid ${profileForm.avatar === emoji ? C.b : C.bd}`, background: profileForm.avatar === emoji ? C.b + '15' : 'transparent', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {emoji}
              </button>
            ))}
          </div>
        </SettingRow>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <SettingRow label="Display Name">
            <input value={profileForm.displayName || ''} onChange={(e) => setProfileForm((f) => ({ ...f, displayName: e.target.value }))} placeholder="Your display name" maxLength={30} style={inputStyle} />
          </SettingRow>
          <SettingRow label="Username">
            <input value={profileForm.username || ''} onChange={(e) => setProfileForm((f) => ({ ...f, username: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') }))} placeholder="your_username" maxLength={20} style={{ ...inputStyle, fontFamily: M }} />
          </SettingRow>
        </div>
        <SettingRow label="Bio">
          <textarea value={profileForm.bio || ''} onChange={(e) => setProfileForm((f) => ({ ...f, bio: e.target.value }))} placeholder="Trading style, experience, interests..." maxLength={150} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
          <div style={{ fontSize: 10, color: C.t3, textAlign: 'right', marginTop: 2, fontFamily: M }}>{(profileForm.bio || '').length}/150</div>
        </SettingRow>
        <Btn onClick={saveProfile} style={{ fontSize: 12, padding: '8px 16px' }}>Save Profile</Btn>
      </Card>
      <Card style={{ padding: 20, marginTop: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, marginBottom: 12 }}>Trader Card</div>
        <div style={{ fontSize: 11, color: C.t3, marginBottom: 16 }}>Your shareable trader identity card. Copy and share on social media.</div>
        <TraderCard />
      </Card>
    </section>
  );
}

export default React.memo(ProfileSection);
