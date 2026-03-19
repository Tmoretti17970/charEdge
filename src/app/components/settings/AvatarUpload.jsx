// ═══════════════════════════════════════════════════════════════════
// charEdge — Avatar Upload Component (Sprint 3)
//
// 3-tab avatar picker: Upload Photo | Pick Emoji | Initials
// - Photo: file input → canvas crop → base64 JPEG
// - Emoji: 16-option grid (existing)
// - Initials: auto-generated from display name with color picker
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useRef, useCallback } from 'react';
import { C, F, M } from '../../../constants.js';
import { AVATAR_OPTIONS } from '../../../state/user/profileSlice.js';
import { cropToSquare, generateInitials, getAvatarDisplay } from '../../../utils/avatarUtils.js';
import { radii, transition } from '../../../theme/tokens.js';

const TABS = [
  { id: 'emoji', label: '😀 Emoji' },
  { id: 'upload', label: '📸 Photo' },
  { id: 'initials', label: 'AA' },
];

const INITIALS_COLORS = [
  '#E8590C', '#D6336C', '#7048E8', '#1C7ED6',
  '#0CA678', '#F59F00', '#E64980', '#845EF7',
];

export default function AvatarUpload({ draft, onUpdate }) {
  const [activeTab, setActiveTab] = useState(draft.avatarType || 'emoji');
  const [uploadError, setUploadError] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const avatarDisplay = getAvatarDisplay(draft, 80);

  const handleFileSelect = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError('');
    setUploading(true);

    try {
      const base64 = await cropToSquare(file);
      onUpdate({
        avatarType: 'image',
        avatarImage: base64,
      });
    } catch (err) {
      setUploadError(err.message || 'Failed to process image');
    } finally {
      setUploading(false);
      // Reset input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [onUpdate]);

  const selectEmoji = useCallback((emoji) => {
    onUpdate({ avatar: emoji, avatarType: 'emoji', avatarImage: '' });
  }, [onUpdate]);

  const selectInitials = useCallback(() => {
    onUpdate({ avatarType: 'initials', avatarImage: '' });
  }, [onUpdate]);

  const setInitialsColor = useCallback((color) => {
    onUpdate({ avatarType: 'initials', avatarColor: color, avatarImage: '' });
  }, [onUpdate]);

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: C.t2, marginBottom: 10, fontFamily: F }}>
        Avatar
      </div>

      {/* Current avatar preview */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14,
      }}>
        <div style={{
          ...avatarDisplay.style,
          border: `2px solid ${C.b}30`,
          background: avatarDisplay.type === 'image'
            ? undefined
            : avatarDisplay.type === 'initials'
              ? (draft.avatarColor || '#E8590C')
              : `linear-gradient(135deg, ${C.b}20, ${C.b}08)`,
          backgroundImage: avatarDisplay.type === 'image' ? `url(${draft.avatarImage})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}>
          {avatarDisplay.type !== 'image' && avatarDisplay.content}
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.t1, fontFamily: F }}>
            {avatarDisplay.type === 'image' ? 'Custom Photo'
              : avatarDisplay.type === 'initials' ? 'Initials'
              : 'Emoji'}
          </div>
          <div style={{ fontSize: 10, color: C.t3, fontFamily: F }}>
            Choose your avatar style below
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 2,
        background: C.bd + '20', borderRadius: radii.sm, padding: 2,
        marginBottom: 12,
      }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="tf-btn"
            style={{
              flex: 1, padding: '6px 0',
              borderRadius: radii.xs, border: 'none',
              background: activeTab === tab.id ? C.sf : 'transparent',
              color: activeTab === tab.id ? C.t1 : C.t3,
              fontSize: 11, fontWeight: 600, fontFamily: F,
              cursor: 'pointer',
              transition: `all ${transition.base}`,
              boxShadow: activeTab === tab.id ? `0 1px 3px ${C.bd}40` : 'none',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'emoji' && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {AVATAR_OPTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => selectEmoji(emoji)}
              className="tf-btn"
              style={{
                width: 40, height: 40, borderRadius: '50%',
                border: `2px solid ${draft.avatarType === 'emoji' && draft.avatar === emoji ? C.b : C.bd + '40'}`,
                background: draft.avatarType === 'emoji' && draft.avatar === emoji ? C.b + '15' : 'transparent',
                fontSize: 18, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: `all ${transition.base}`,
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'upload' && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="tf-btn"
            style={{
              width: '100%', padding: '20px 16px',
              borderRadius: radii.sm,
              border: `2px dashed ${C.bd}`,
              background: 'transparent',
              color: C.t2, fontSize: 12, fontFamily: F,
              cursor: uploading ? 'wait' : 'pointer',
              textAlign: 'center',
              transition: `all ${transition.base}`,
            }}
          >
            {uploading ? (
              <span>Processing…</span>
            ) : (
              <>
                <div style={{ fontSize: 24, marginBottom: 4 }}>📸</div>
                <div style={{ fontWeight: 600 }}>Click to upload a photo</div>
                <div style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>
                  JPEG, PNG, or WebP · Max 2 MB · Cropped to square
                </div>
              </>
            )}
          </button>
          {uploadError && (
            <div style={{
              fontSize: 11, color: C.r, marginTop: 6, fontFamily: F,
            }}>
              ⚠️ {uploadError}
            </div>
          )}
          {draft.avatarType === 'image' && draft.avatarImage && (
            <div style={{
              fontSize: 10, color: C.g, marginTop: 6, fontFamily: F,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              ✓ Photo uploaded successfully
            </div>
          )}
        </div>
      )}

      {activeTab === 'initials' && (
        <div>
          {/* Preview */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12,
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: draft.avatarColor || '#E8590C',
              color: '#fff', fontSize: 18, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              letterSpacing: 1,
            }}>
              {generateInitials(draft.displayName)}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.t1, fontFamily: F }}>
                {generateInitials(draft.displayName) || '?'}
              </div>
              <div style={{ fontSize: 10, color: C.t3, fontFamily: F }}>
                Generated from your display name
              </div>
            </div>
          </div>

          {/* Color picker */}
          <div style={{ fontSize: 11, fontWeight: 600, color: C.t3, marginBottom: 6, fontFamily: F }}>
            Background Color
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {INITIALS_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => { selectInitials(); setInitialsColor(color); }}
                className="tf-btn"
                style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: color,
                  border: `2px solid ${draft.avatarColor === color && draft.avatarType === 'initials' ? '#fff' : 'transparent'}`,
                  cursor: 'pointer',
                  boxShadow: draft.avatarColor === color && draft.avatarType === 'initials'
                    ? `0 0 0 2px ${color}`
                    : 'none',
                  transition: `all ${transition.base}`,
                }}
                title={color}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
