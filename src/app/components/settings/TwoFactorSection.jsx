// ═══════════════════════════════════════════════════════════════════
// charEdge — Two-Factor Authentication Section (Sprint 5)
//
// 4-step TOTP setup wizard:
//   Step 1: Get Started (install authenticator)
//   Step 2: Scan QR code or enter manual key
//   Step 3: Verify 6-digit code
//   Step 4: Save backup codes
// Also includes recovery email and 2FA status display.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { C, F, M } from '../../../constants.js';
import { useUserStore } from '../../../state/useUserStore';
import { radii, transition } from '../../../theme/tokens.js';
import { Card, Btn, inputStyle } from '../ui/UIKit.jsx';
import { toast } from '../ui/Toast.jsx';
import {
  generateSecret,
  formatSecret,
  buildTOTPUri,
  generateBackupCodes,
  downloadBackupCodes,
  generateQRMatrix,
  renderQRToCanvas,
} from '../../../utils/totpUtils.js';

function TwoFactorSection() {
  const profile = useUserStore((s) => s.profile);
  const updateProfile = useUserStore((s) => s.updateProfile);
  const p = { twoFactorEnabled: false, twoFactorSetupDate: null, recoveryEmail: '', backupCodesRemaining: 0, ...profile };

  const [wizardStep, setWizardStep] = useState(0); // 0 = off, 1-4 = steps
  const [secret, setSecret] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [recoveryDraft, setRecoveryDraft] = useState(p.recoveryEmail || '');
  const qrRef = useRef(null);

  // Generate QR when step 2 is reached
  useEffect(() => {
    if (wizardStep === 2 && qrRef.current && secret) {
      const uri = buildTOTPUri(secret, p.recoveryEmail || 'user');
      const matrix = generateQRMatrix(uri);
      renderQRToCanvas(qrRef.current, matrix, 5, C.t1, C.sf);
    }
  }, [wizardStep, secret, p.recoveryEmail]);

  const startSetup = useCallback(() => {
    const newSecret = generateSecret();
    setSecret(newSecret);
    setBackupCodes([]);
    setVerifyCode('');
    setVerifyError('');
    setWizardStep(1);
  }, []);

  const handleVerify = useCallback(() => {
    // Accept any 6-digit code for now (real validation would be server-side)
    if (verifyCode.length !== 6 || !/^\d{6}$/.test(verifyCode)) {
      setVerifyError('Enter a valid 6-digit code');
      return;
    }
    setVerifyError('');
    const codes = generateBackupCodes(6);
    setBackupCodes(codes);
    setWizardStep(4);
  }, [verifyCode]);

  const finishSetup = useCallback(() => {
    updateProfile({
      twoFactorEnabled: true,
      twoFactorSetupDate: Date.now(),
      backupCodesRemaining: 6,
    });
    setWizardStep(0);
    toast.success('Two-factor authentication enabled!');
  }, [updateProfile]);

  const disable2FA = useCallback(() => {
    updateProfile({
      twoFactorEnabled: false,
      twoFactorSetupDate: null,
      backupCodesRemaining: 0,
    });
    toast.info('Two-factor authentication disabled');
  }, [updateProfile]);

  const saveRecoveryEmail = useCallback(() => {
    updateProfile({ recoveryEmail: recoveryDraft });
    toast.success('Recovery email updated');
  }, [recoveryDraft, updateProfile]);

  // ─── 2FA Enabled State ─────────────────────────────────────
  if (p.twoFactorEnabled && wizardStep === 0) {
    return (
      <Card style={{ padding: 20, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: C.g + '15', color: C.g,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 700,
            }}>🔒</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: F }}>
                Two-Factor Authentication
              </div>
              <div style={{ fontSize: 11, color: C.g, fontWeight: 600, fontFamily: M }}>
                ✓ Enabled {p.twoFactorSetupDate
                  ? `since ${new Date(p.twoFactorSetupDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                  : ''}
              </div>
            </div>
          </div>
          <Btn variant="ghost" onClick={disable2FA}
            style={{ fontSize: 11, padding: '4px 12px', color: C.r }}>
            Disable
          </Btn>
        </div>

        {/* Backup codes remaining */}
        <div style={{
          display: 'flex', gap: 16, paddingTop: 12,
          borderTop: `1px solid ${C.bd}20`,
        }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: C.t3, fontFamily: M }}>Backup Codes</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: F, marginTop: 2 }}>
              {p.backupCodesRemaining} remaining
            </div>
          </div>
          {p.recoveryEmail && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: C.t3, fontFamily: M }}>Recovery Email</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.t1, fontFamily: M, marginTop: 2 }}>
                {p.recoveryEmail}
              </div>
            </div>
          )}
        </div>
      </Card>
    );
  }

  // ─── Wizard Steps ──────────────────────────────────────────
  if (wizardStep > 0) {
    return (
      <Card style={{ padding: 20, marginBottom: 12 }}>
        {/* Progress indicator */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20,
        }}>
          {[1, 2, 3, 4].map((step) => (
            <React.Fragment key={step}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                background: wizardStep >= step ? C.b : C.bd + '30',
                color: wizardStep >= step ? '#fff' : C.t3,
                fontSize: 11, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: `all ${transition.base}`,
              }}>
                {wizardStep > step ? '✓' : step}
              </div>
              {step < 4 && (
                <div style={{
                  flex: 1, height: 2,
                  background: wizardStep > step ? C.b : C.bd + '20',
                  transition: `background ${transition.base}`,
                }} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step 1: Get Started */}
        {wizardStep === 1 && (
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.t1, fontFamily: F, marginBottom: 8 }}>
              Get Started
            </div>
            <div style={{ fontSize: 12, color: C.t2, fontFamily: F, lineHeight: 1.5, marginBottom: 16 }}>
              To enable two-factor authentication, you'll need an authenticator app on your phone:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {[
                { name: 'Google Authenticator', hint: 'iOS & Android' },
                { name: '1Password', hint: 'iOS, Android, Desktop' },
                { name: 'Authy', hint: 'iOS & Android, multi-device' },
              ].map((app) => (
                <div key={app.name} style={{
                  padding: '8px 12px', borderRadius: radii.sm,
                  background: C.bd + '10', display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span style={{ fontSize: 16 }}>📱</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.t1, fontFamily: F }}>{app.name}</div>
                    <div style={{ fontSize: 10, color: C.t3, fontFamily: F }}>{app.hint}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Btn variant="ghost" onClick={() => setWizardStep(0)} style={{ fontSize: 12, padding: '6px 14px' }}>
                Cancel
              </Btn>
              <Btn onClick={() => setWizardStep(2)} style={{ fontSize: 12, padding: '6px 14px' }}>
                Next →
              </Btn>
            </div>
          </div>
        )}

        {/* Step 2: QR Code */}
        {wizardStep === 2 && (
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.t1, fontFamily: F, marginBottom: 8 }}>
              Scan QR Code
            </div>
            <div style={{ fontSize: 12, color: C.t2, fontFamily: F, marginBottom: 16 }}>
              Open your authenticator app and scan this code:
            </div>

            {/* QR Code */}
            <div style={{
              display: 'flex', justifyContent: 'center', marginBottom: 16,
              padding: 16, background: '#fff', borderRadius: radii.md,
              border: `1px solid ${C.bd}20`,
            }}>
              <canvas ref={qrRef} style={{ borderRadius: 4 }} />
            </div>

            {/* Manual entry */}
            <div style={{
              padding: 12, borderRadius: radii.sm,
              background: C.bd + '10', marginBottom: 16,
            }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: C.t3, fontFamily: M, marginBottom: 4 }}>
                Or enter this key manually:
              </div>
              <div style={{
                fontSize: 14, fontWeight: 700, color: C.t1, fontFamily: M,
                letterSpacing: 2, userSelect: 'all',
              }}>
                {formatSecret(secret)}
              </div>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(secret);
                  toast.info('Key copied to clipboard');
                }}
                className="tf-btn"
                style={{
                  background: 'none', border: 'none', padding: 0,
                  color: C.b, fontSize: 10, fontWeight: 600, fontFamily: F,
                  cursor: 'pointer', marginTop: 4,
                }}
              >
                📋 Copy key
              </button>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Btn variant="ghost" onClick={() => setWizardStep(1)} style={{ fontSize: 12, padding: '6px 14px' }}>
                ← Back
              </Btn>
              <Btn onClick={() => setWizardStep(3)} style={{ fontSize: 12, padding: '6px 14px' }}>
                Next →
              </Btn>
            </div>
          </div>
        )}

        {/* Step 3: Verify */}
        {wizardStep === 3 && (
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.t1, fontFamily: F, marginBottom: 8 }}>
              Verify Code
            </div>
            <div style={{ fontSize: 12, color: C.t2, fontFamily: F, marginBottom: 16 }}>
              Enter the 6-digit code from your authenticator app:
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <input
                  type="text"
                  value={verifyCode}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setVerifyCode(val);
                    setVerifyError('');
                  }}
                  placeholder="000000"
                  maxLength={6}
                  style={{
                    ...inputStyle, width: '100%',
                    fontSize: 24, fontWeight: 700, fontFamily: M,
                    textAlign: 'center', letterSpacing: 8,
                    borderColor: verifyError ? C.r : undefined,
                  }}
                  autoFocus
                />
                {verifyError && (
                  <div style={{ fontSize: 10, color: C.r, marginTop: 4, fontFamily: F }}>
                    {verifyError}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Btn variant="ghost" onClick={() => setWizardStep(2)} style={{ fontSize: 12, padding: '6px 14px' }}>
                ← Back
              </Btn>
              <Btn onClick={handleVerify} disabled={verifyCode.length !== 6}
                style={{ fontSize: 12, padding: '6px 14px', opacity: verifyCode.length === 6 ? 1 : 0.5 }}>
                Verify & Enable
              </Btn>
            </div>
          </div>
        )}

        {/* Step 4: Backup Codes */}
        {wizardStep === 4 && (
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.t1, fontFamily: F, marginBottom: 8 }}>
              Save Backup Codes
            </div>
            <div style={{ fontSize: 12, color: C.t2, fontFamily: F, marginBottom: 16 }}>
              Keep these codes somewhere safe. Each can only be used once if you lose access to your authenticator.
            </div>

            <div style={{
              padding: 16, borderRadius: radii.md,
              background: C.bd + '08', border: `1px solid ${C.bd}20`,
              marginBottom: 16,
            }}>
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr',
                gap: '8px 24px',
              }}>
                {backupCodes.map((code, i) => (
                  <div key={i} style={{
                    fontSize: 14, fontWeight: 700, fontFamily: M,
                    color: C.t1, letterSpacing: 1,
                  }}>
                    {code}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(backupCodes.join('\n'));
                    toast.info('Codes copied to clipboard');
                  }}
                  className="tf-btn"
                  style={{
                    padding: '6px 12px', borderRadius: radii.sm,
                    border: `1px solid ${C.bd}`, background: 'transparent',
                    color: C.t2, fontSize: 11, fontWeight: 600, fontFamily: F,
                    cursor: 'pointer',
                  }}
                >
                  📋 Copy
                </button>
                <button
                  onClick={() => downloadBackupCodes(backupCodes)}
                  className="tf-btn"
                  style={{
                    padding: '6px 12px', borderRadius: radii.sm,
                    border: `1px solid ${C.bd}`, background: 'transparent',
                    color: C.t2, fontSize: 11, fontWeight: 600, fontFamily: F,
                    cursor: 'pointer',
                  }}
                >
                  ⬇️ Download
                </button>
              </div>
              <Btn onClick={finishSetup} style={{ fontSize: 12, padding: '6px 14px' }}>
                Done ✓
              </Btn>
            </div>
          </div>
        )}
      </Card>
    );
  }

  // ─── 2FA Disabled State ────────────────────────────────────
  return (
    <div style={{ marginBottom: 12 }}>
      <Card style={{ padding: 20, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: C.r + '10', color: C.r,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14,
            }}>🔓</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: F }}>
                Two-Factor Authentication
              </div>
              <div style={{ fontSize: 11, color: C.t3, fontFamily: F }}>
                Add an extra layer of security to your account
              </div>
            </div>
          </div>
          <Btn onClick={startSetup} style={{ fontSize: 11, padding: '6px 14px' }}>
            Enable 2FA
          </Btn>
        </div>
      </Card>

      {/* Recovery Email */}
      <Card style={{ padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: F, marginBottom: 4 }}>
          Recovery Email
        </div>
        <div style={{ fontSize: 11, color: C.t3, fontFamily: F, marginBottom: 12 }}>
          Used to recover your account if you lose access
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <input
              type="email"
              value={recoveryDraft}
              onChange={(e) => setRecoveryDraft(e.target.value)}
              placeholder="recovery@email.com"
              style={{ ...inputStyle, width: '100%' }}
            />
          </div>
          <Btn variant="ghost" onClick={saveRecoveryEmail}
            disabled={!recoveryDraft || recoveryDraft === p.recoveryEmail}
            style={{ fontSize: 11, padding: '8px 14px', opacity: recoveryDraft && recoveryDraft !== p.recoveryEmail ? 1 : 0.5 }}>
            Update
          </Btn>
        </div>
      </Card>
    </div>
  );
}

export default React.memo(TwoFactorSection);
