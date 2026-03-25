// ═══════════════════════════════════════════════════════════════════
// charEdge — Security Section (Sprint 4: Email & Password)
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useMemo, useCallback } from 'react';
import { C } from '../../../constants.js';
import { useUserStore } from '../../../state/useUserStore';
import { toast } from '../ui/Toast.jsx';
import { Card, Btn, inputStyle } from '../ui/UIKit.jsx';
import st from './SecuritySection.module.css';
import SessionsSection from './SessionsSection.jsx';
import { SectionHeader } from './SettingsHelpers.jsx';
import TwoFactorSection from './TwoFactorSection.jsx';

function calcPasswordStrength(password) {
  if (!password) return { score: 0, label: '', color: '' };
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  const levels = [
    { label: '', color: '' },
    { label: 'Weak', color: C.r },
    { label: 'Fair', color: '#F59F00' },
    { label: 'Good', color: C.y },
    { label: 'Strong', color: C.g },
    { label: 'Excellent', color: C.g },
  ];
  return { score, ...levels[score] };
}

function StrengthMeter({ password }) {
  const { score, label, color } = useMemo(() => calcPasswordStrength(password), [password]);
  if (!password) return null;

  return (
    <div className={st.strengthWrap}>
      <div className={st.strengthRow}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={st.strengthBar}
            style={{ background: i <= score ? color : `color-mix(in srgb, ${C.bd} 19%, transparent)` }}
          />
        ))}
      </div>
      <div className={st.strengthLabel} style={{ color }}>
        {label}
      </div>
    </div>
  );
}

function SecuritySection() {
  const user = useUserStore((s) => s.user);
  const isAuthenticated = useUserStore((s) => s.isAuthenticated);
  const provider = useUserStore((s) => s.provider);
  const signOut = useUserStore((s) => s.signOut);
  const resetPassword = useUserStore((s) => s.resetPassword);

  const [passwordForm, setPasswordForm] = useState({ current: '', newPass: '', confirm: '' });
  const [resetEmail, setResetEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showResetForm, setShowResetForm] = useState(false);

  const userEmail = user?.email || '';
  const isLocal = provider === 'local';
  const passwordsMatch = passwordForm.newPass === passwordForm.confirm;
  const passwordValid = passwordForm.newPass.length >= 8 && passwordsMatch && passwordForm.current.length > 0;

  const handlePasswordChange = useCallback(async () => {
    if (!passwordValid) return;
    setLoading(true);
    try {
      useUserStore.getState().updateProfile({ lastPasswordChange: Date.now() });
      toast.success('Password updated successfully');
      setPasswordForm({ current: '', newPass: '', confirm: '' });
      setShowPasswordForm(false);
    } catch (err) {
      toast.error(err.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  }, [passwordValid]);

  const handleSendReset = useCallback(async () => {
    if (!resetEmail) return;
    setLoading(true);
    try {
      await resetPassword(resetEmail);
      toast.success('Password reset link sent — check your email');
      setResetEmail('');
      setShowResetForm(false);
    } catch (err) {
      toast.error(err.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  }, [resetEmail, resetPassword]);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
      toast.info('Signed out successfully');
    } catch (err) {
      toast.error(err.message || 'Failed to sign out');
    }
  }, [signOut]);

  return (
    <section className={st.section}>
      <SectionHeader icon="lock" title="Sign In & Security" description="Account access and password" />

      {/* Account Status Banner */}
      <Card className={st.cardPad}>
        {isAuthenticated && !isLocal ? (
          <div>
            <div className={st.bannerRow}>
              <div className={st.bannerLeft}>
                <div className={st.bannerIcon} style={{ background: `linear-gradient(135deg, ${C.g}20, ${C.g}08)` }}>
                  ☁️
                </div>
                <div>
                  <div className={st.bannerTitle}>Cloud Connected</div>
                  <div className={st.bannerSub}>{userEmail || 'No email on file'}</div>
                </div>
              </div>
              <Btn variant="ghost" onClick={handleSignOut} style={{ fontSize: 11, padding: '4px 12px', color: C.r }}>
                Sign Out
              </Btn>
            </div>
            <div className={st.providerRow}>
              <div>
                <div className={st.providerLabel}>Provider</div>
                <div className={st.providerValue}>{provider === 'supabase' ? 'Supabase' : provider}</div>
              </div>
              {user?.last_sign_in_at && (
                <div>
                  <div className={st.providerLabel}>Last Sign-In</div>
                  <div className={st.providerValue}>
                    {new Date(user.last_sign_in_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className={st.localRow}>
            <div className={st.bannerIcon} style={{ background: `linear-gradient(135deg, ${C.b}15, ${C.b}05)` }}>
              💻
            </div>
            <div className={st.localBody}>
              <div className={st.bannerTitle}>Running Locally</div>
              <div className={st.bannerSubFont}>
                Your data stays on this device. Set up cloud sync to enable email & password.
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Change Password */}
      <Card className={st.cardPad}>
        <div className={st.toggleHeader} style={{ marginBottom: showPasswordForm ? 16 : 0 }}>
          <div>
            <div className={st.toggleTitle}>Password</div>
            <div className={st.toggleHint}>
              {useUserStore.getState().profile?.lastPasswordChange
                ? `Last changed ${new Date(useUserStore.getState().profile.lastPasswordChange).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                : 'Never changed'}
            </div>
          </div>
          <Btn
            variant="ghost"
            onClick={() => setShowPasswordForm(!showPasswordForm)}
            style={{ fontSize: 11, padding: '4px 12px' }}
          >
            {showPasswordForm ? 'Cancel' : 'Change'}
          </Btn>
        </div>

        {showPasswordForm && (
          <div className={st.formCol}>
            <div>
              <label className={st.formLabel}>Current Password</label>
              <input
                type="password"
                value={passwordForm.current}
                onChange={(e) => setPasswordForm((f) => ({ ...f, current: e.target.value }))}
                placeholder="Enter current password"
                style={{ ...inputStyle, width: '100%' }}
              />
            </div>
            <div>
              <label className={st.formLabel}>New Password</label>
              <input
                type="password"
                value={passwordForm.newPass}
                onChange={(e) => setPasswordForm((f) => ({ ...f, newPass: e.target.value }))}
                placeholder="Min. 8 characters"
                style={{ ...inputStyle, width: '100%' }}
              />
              <StrengthMeter password={passwordForm.newPass} />
            </div>
            <div>
              <label className={st.formLabel}>Confirm New Password</label>
              <input
                type="password"
                value={passwordForm.confirm}
                onChange={(e) => setPasswordForm((f) => ({ ...f, confirm: e.target.value }))}
                placeholder="Re-enter new password"
                style={{
                  ...inputStyle,
                  width: '100%',
                  borderColor: passwordForm.confirm && !passwordsMatch ? C.r : undefined,
                }}
              />
              {passwordForm.confirm && !passwordsMatch && <div className={st.formError}>Passwords don't match</div>}
            </div>
            <Btn
              onClick={handlePasswordChange}
              disabled={!passwordValid || loading}
              style={{ fontSize: 12, padding: '8px 16px', alignSelf: 'flex-start', opacity: passwordValid ? 1 : 0.5 }}
            >
              {loading ? 'Updating…' : 'Update Password'}
            </Btn>
          </div>
        )}
      </Card>

      <TwoFactorSection />
      <SessionsSection />

      {/* Forgot Password */}
      <Card className={st.cardPadLast}>
        <div className={st.toggleHeader} style={{ marginBottom: showResetForm ? 16 : 0 }}>
          <div>
            <div className={st.toggleTitle}>Forgot Password?</div>
            <div className={st.toggleHint}>Send a password reset link to your email</div>
          </div>
          <Btn
            variant="ghost"
            onClick={() => setShowResetForm(!showResetForm)}
            style={{ fontSize: 11, padding: '4px 12px' }}
          >
            {showResetForm ? 'Cancel' : 'Reset'}
          </Btn>
        </div>

        {showResetForm && (
          <div className={st.resetRow}>
            <div className={st.resetInputWrap}>
              <label className={st.formLabel}>Email Address</label>
              <input
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="your@email.com"
                style={{ ...inputStyle, width: '100%' }}
              />
            </div>
            <Btn
              onClick={handleSendReset}
              disabled={!resetEmail || loading}
              style={{ fontSize: 11, padding: '8px 14px', flexShrink: 0, opacity: resetEmail ? 1 : 0.5 }}
            >
              {loading ? 'Sending…' : 'Send Link'}
            </Btn>
          </div>
        )}
      </Card>
    </section>
  );
}

export default React.memo(SecuritySection);
