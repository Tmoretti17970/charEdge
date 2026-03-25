// ═══════════════════════════════════════════════════════════════════
// Mobile Settings — Profile Section
// Avatar, display name, username, bio.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { MobileRow, MobileBtn, mobileInput } from '../MobilePrimitives.jsx';
import { C, M } from '@/constants.js';

const AVATAR_OPTIONS = ['🔥', '🐂', '🐻', '🦈', '🦅', '🐺', '🦁', '🐲', '🦊', '🎯', '💎', '⚡', '🌊', '🏔️', '🎲', '🧠'];

export default function ProfileContent() {
  const myProfile = null;
  const loadMyProfile = useCallback(() => {}, []);
  const updateMyProfile = useCallback(() => {}, []);
  const [profileForm, setProfileForm] = useState({});

  useEffect(() => {
    loadMyProfile();
  }, [loadMyProfile]);

  useEffect(() => {
    if (myProfile) {
      setProfileForm({
        username: myProfile.username || '',
        displayName: myProfile.displayName || '',
        bio: myProfile.bio || '',
        avatar: myProfile.avatar || '🔥',
      });
    }
  }, [myProfile]);

  const saveProfile = useCallback(() => {
    updateMyProfile(profileForm);
  }, [profileForm, updateMyProfile]);

  return (
    <div>
      {/* Avatar picker — grid for easy touch */}
      <MobileRow label="Avatar">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(8, 1fr)',
            gap: 6,
          }}
        >
          {AVATAR_OPTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => setProfileForm((f) => ({ ...f, avatar: emoji }))}
              className="tf-btn"
              aria-label={`Avatar ${emoji}`}
              style={{
                width: '100%',
                aspectRatio: '1',
                minHeight: 40,
                borderRadius: '50%',
                border: `2px solid ${profileForm.avatar === emoji ? C.b : C.bd}`,
                background: profileForm.avatar === emoji ? C.b + '15' : 'transparent',
                fontSize: 18,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      </MobileRow>

      <MobileRow label="Display Name">
        <input
          value={profileForm.displayName || ''}
          onChange={(e) => setProfileForm((f) => ({ ...f, displayName: e.target.value }))}
          placeholder="Your display name"
          maxLength={30}
          style={mobileInput}
        />
      </MobileRow>

      <MobileRow label="Username">
        <input
          value={profileForm.username || ''}
          onChange={(e) => setProfileForm((f) => ({ ...f, username: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') }))}
          placeholder="your_username"
          maxLength={20}
          style={{ ...mobileInput, fontFamily: M }}
        />
      </MobileRow>

      <MobileRow label="Bio">
        <textarea
          value={profileForm.bio || ''}
          onChange={(e) => setProfileForm((f) => ({ ...f, bio: e.target.value }))}
          placeholder="Trading style, experience..."
          maxLength={150}
          rows={3}
          style={{ ...mobileInput, resize: 'vertical', minHeight: 80 }}
        />
        <div style={{ fontSize: 11, color: C.t3, textAlign: 'right', marginTop: 2, fontFamily: M }}>
          {(profileForm.bio || '').length}/150
        </div>
      </MobileRow>

      <MobileBtn onClick={saveProfile}>Save Profile</MobileBtn>
    </div>
  );
}
