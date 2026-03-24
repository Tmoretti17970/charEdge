// ═══════════════════════════════════════════════════════════════════
// charEdge — Avatar Upload Component (Sprint 3)
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useRef, useCallback } from 'react';
import { C } from '../../../constants.js';
import { AVATAR_OPTIONS } from '../../../state/user/profileSlice.js';
import { cropToSquare, generateInitials, getAvatarDisplay } from '../../../utils/avatarUtils.js';
import st from './AvatarUpload.module.css';

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
    setUploadError(''); setUploading(true);
    try { const base64 = await cropToSquare(file); onUpdate({ avatarType: 'image', avatarImage: base64 }); }
    catch (err) { setUploadError(err.message || 'Failed to process image'); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  }, [onUpdate]);

  const selectEmoji = useCallback((emoji) => { onUpdate({ avatar: emoji, avatarType: 'emoji', avatarImage: '' }); }, [onUpdate]);
  const selectInitials = useCallback(() => { onUpdate({ avatarType: 'initials', avatarImage: '' }); }, [onUpdate]);
  const setInitialsColor = useCallback((color) => { onUpdate({ avatarType: 'initials', avatarColor: color, avatarImage: '' }); }, [onUpdate]);

  return (
    <div className={st.root}>
      <div className={st.label}>Avatar</div>

      {/* Preview */}
      <div className={st.previewRow}>
        <div style={{
          ...avatarDisplay.style,
          border: `2px solid ${C.b}30`,
          background: avatarDisplay.type === 'image' ? undefined
            : avatarDisplay.type === 'initials' ? (draft.avatarColor || '#E8590C')
            : `linear-gradient(135deg, ${C.b}20, ${C.b}08)`,
          backgroundImage: avatarDisplay.type === 'image' ? `url(${draft.avatarImage})` : undefined,
          backgroundSize: 'cover', backgroundPosition: 'center',
        }}>
          {avatarDisplay.type !== 'image' && avatarDisplay.content}
        </div>
        <div>
          <div className={st.previewType}>
            {avatarDisplay.type === 'image' ? 'Custom Photo' : avatarDisplay.type === 'initials' ? 'Initials' : 'Emoji'}
          </div>
          <div className={st.previewHint}>Choose your avatar style below</div>
        </div>
      </div>

      {/* Tab bar */}
      <div className={st.tabBar}>
        {TABS.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`tf-btn ${st.tabBtn} ${activeTab === tab.id ? st.tabBtnActive : st.tabBtnInactive}`}
            style={{ boxShadow: activeTab === tab.id ? `0 1px 3px ${C.bd}40` : 'none' }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Emoji */}
      {activeTab === 'emoji' && (
        <div className={st.emojiGrid}>
          {AVATAR_OPTIONS.map((emoji) => (
            <button key={emoji} onClick={() => selectEmoji(emoji)}
              className={`tf-btn ${st.emojiBtn}`}
              style={{
                border: `2px solid ${draft.avatarType === 'emoji' && draft.avatar === emoji ? C.b : C.bd + '40'}`,
                background: draft.avatarType === 'emoji' && draft.avatar === emoji ? C.b + '15' : 'transparent',
              }}>
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Upload */}
      {activeTab === 'upload' && (
        <div>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileSelect} style={{ display: 'none' }} />
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
            className={`tf-btn ${st.uploadBtn}`} style={{ cursor: uploading ? 'wait' : 'pointer' }}>
            {uploading ? <span>Processing…</span> : (
              <>
                <div className={st.uploadIcon}>📸</div>
                <div className={st.uploadText}>Click to upload a photo</div>
                <div className={st.uploadHint}>JPEG, PNG, or WebP · Max 2 MB · Cropped to square</div>
              </>
            )}
          </button>
          {uploadError && <div className={st.uploadError}>⚠️ {uploadError}</div>}
          {draft.avatarType === 'image' && draft.avatarImage && (
            <div className={st.uploadSuccess}>✓ Photo uploaded successfully</div>
          )}
        </div>
      )}

      {/* Initials */}
      {activeTab === 'initials' && (
        <div>
          <div className={st.initialsRow}>
            <div className={st.initialsPreview} style={{ background: draft.avatarColor || '#E8590C' }}>
              {generateInitials(draft.displayName)}
            </div>
            <div>
              <div className={st.initialsLabel}>{generateInitials(draft.displayName) || '?'}</div>
              <div className={st.initialsHint}>Generated from your display name</div>
            </div>
          </div>
          <div className={st.colorLabel}>Background Color</div>
          <div className={st.colorGrid}>
            {INITIALS_COLORS.map((color) => (
              <button key={color} onClick={() => { selectInitials(); setInitialsColor(color); }}
                className={`tf-btn ${st.colorSwatch}`} title={color}
                style={{
                  background: color,
                  border: `2px solid ${draft.avatarColor === color && draft.avatarType === 'initials' ? '#fff' : 'transparent'}`,
                  boxShadow: draft.avatarColor === color && draft.avatarType === 'initials' ? `0 0 0 2px ${color}` : 'none',
                }} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
