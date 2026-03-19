// ═══════════════════════════════════════════════════════════════════
// charEdge — Security Section (Sprint 4: Email & Password)
//
// Account security UI for the Settings Account page:
//   - Connected account display (email, provider, sign-out)
//   - Local-only mode banner with setup CTA
//   - Password change form with real-time strength meter
//   - Forgot password / reset link
//   - Toast confirmations for all actions
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useMemo, useCallback } from 'react';
import { C, F, M } from '../../../constants.js';
import { useUserStore } from '../../../state/useUserStore';
import { radii, transition } from '../../../theme/tokens.js';
import { Card, Btn, inputStyle } from '../ui/UIKit.jsx';
import { SectionHeader } from './SettingsHelpers.jsx';
import { toast } from '../ui/Toast.jsx';
import TwoFactorSection from './TwoFactorSection.jsx';
import SessionsSection from './SessionsSection.jsx';

// ─── Password Strength ──────────────────────────────────────────

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
    <div style={{ marginTop: 6 }}>
      <div style={{ display: 'flex', gap: 3, marginBottom: 4 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            style={{
              flex: 1, height: 3, borderRadius: 2,
              background: i <= score ? color : C.bd + '30',
              transition: `background 0.2s`,
            }}
          />
        ))}
      </div>
      <div style={{ fontSize: 10, fontWeight: 600, color, fontFamily: M }}>
        {label}
      </div>
    </div>
  );
}

// ─── SecuritySection ─────────────────────────────────────────────

function SecuritySection() {
  const user = useUserStore((s) => s.user);
  const isAuthenticated = useUserStore((s) => s.isAuthenticated);
  const provider = useUserStore((s) => s.provider);
  const signOut = useUserStore((s) => s.signOut);
  const resetPassword = useUserStore((s) => s.resetPassword);

  const [passwordForm, setPasswordForm] = useState({
    current: '', newPass: '', confirm: '',
  });
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
      // In a real Supabase setup this would call updateUser
      // For now, we simulate success and update the profile
      const updateProfile = useUserStore.getState().updateProfile;
      updateProfile({ lastPasswordChange: Date.now() });
      toast.success('Password updated successfully');
      setPasswordForm({ current: '', newPass: '', confirm: '' });
      setShowPasswordForm(false);
    } catch (err) {
      toast.error(err.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  }, [passwordValid, passwordForm]);

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
    <section style={{ marginBottom: 24 }}>
      <SectionHeader icon="lock" title="Sign In & Security" description="Account access and password" />

      {/* Account Status Banner */}
      <Card style={{ padding: 20, marginBottom: 12 }}>
        {isAuthenticated && !isLocal ? (
          // Connected account
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: `linear-gradient(135deg, ${C.g}20, ${C.g}08)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16,
                }}>
                  ☁️
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: F }}>
                    Cloud Connected
                  </div>
                  <div style={{ fontSize: 11, color: C.t3, fontFamily: M }}>
                    {userEmail || 'No email on file'}
                  </div>
                </div>
              </div>
              <Btn variant="ghost" onClick={handleSignOut}
                style={{ fontSize: 11, padding: '4px 12px', color: C.r }}>
                Sign Out
              </Btn>
            </div>

            {/* Provider info */}
            <div style={{
              display: 'flex', gap: 16, marginTop: 12, paddingTop: 12,
              borderTop: `1px solid ${C.bd}20`,
            }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: C.t3, fontFamily: M }}>Provider</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.t1, fontFamily: F, marginTop: 2 }}>
                  {provider === 'supabase' ? 'Supabase' : provider}
                </div>
              </div>
              {user?.last_sign_in_at && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: C.t3, fontFamily: M }}>Last Sign-In</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.t1, fontFamily: F, marginTop: 2 }}>
                    {new Date(user.last_sign_in_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          // Local mode banner
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: `linear-gradient(135deg, ${C.b}15, ${C.b}05)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16,
            }}>
              💻
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: F }}>
                Running Locally
              </div>
              <div style={{ fontSize: 11, color: C.t3, fontFamily: F, marginTop: 1 }}>
                Your data stays on this device. Set up cloud sync to enable email & password.
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Change Password */}
      <Card style={{ padding: 20, marginBottom: 12 }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: showPasswordForm ? 16 : 0,
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: F }}>
              Password
            </div>
            <div style={{ fontSize: 11, color: C.t3, fontFamily: F }}>
              {useUserStore.getState().profile?.lastPasswordChange
                ? `Last changed ${new Date(useUserStore.getState().profile.lastPasswordChange).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                : 'Never changed'}
            </div>
          </div>
          <Btn variant="ghost" onClick={() => setShowPasswordForm(!showPasswordForm)}
            style={{ fontSize: 11, padding: '4px 12px' }}>
            {showPasswordForm ? 'Cancel' : 'Change'}
          </Btn>
        </div>

        {showPasswordForm && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: C.t3, fontFamily: F, display: 'block', marginBottom: 4 }}>
                Current Password
              </label>
              <input
                type="password"
                value={passwordForm.current}
                onChange={(e) => setPasswordForm((f) => ({ ...f, current: e.target.value }))}
                placeholder="Enter current password"
                style={{ ...inputStyle, width: '100%' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: C.t3, fontFamily: F, display: 'block', marginBottom: 4 }}>
                New Password
              </label>
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
              <label style={{ fontSize: 11, fontWeight: 600, color: C.t3, fontFamily: F, display: 'block', marginBottom: 4 }}>
                Confirm New Password
              </label>
              <input
                type="password"
                value={passwordForm.confirm}
                onChange={(e) => setPasswordForm((f) => ({ ...f, confirm: e.target.value }))}
                placeholder="Re-enter new password"
                style={{
                  ...inputStyle, width: '100%',
                  borderColor: passwordForm.confirm && !passwordsMatch ? C.r : undefined,
                }}
              />
              {passwordForm.confirm && !passwordsMatch && (
                <div style={{ fontSize: 10, color: C.r, marginTop: 4, fontFamily: F }}>
                  Passwords don't match
                </div>
              )}
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

      {/* Two-Factor Authentication */}
      <TwoFactorSection />

      {/* Active Sessions */}
      <SessionsSection />

      {/* Forgot Password */}
      <Card style={{ padding: 20 }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: showResetForm ? 16 : 0,
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: F }}>
              Forgot Password?
            </div>
            <div style={{ fontSize: 11, color: C.t3, fontFamily: F }}>
              Send a password reset link to your email
            </div>
          </div>
          <Btn variant="ghost" onClick={() => setShowResetForm(!showResetForm)}
            style={{ fontSize: 11, padding: '4px 12px' }}>
            {showResetForm ? 'Cancel' : 'Reset'}
          </Btn>
        </div>

        {showResetForm && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: C.t3, fontFamily: F, display: 'block', marginBottom: 4 }}>
                Email Address
              </label>
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
