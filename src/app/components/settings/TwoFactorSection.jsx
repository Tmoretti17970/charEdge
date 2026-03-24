// ═══════════════════════════════════════════════════════════════════
// charEdge — Two-Factor Authentication Section (Sprint 5)
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { C } from '../../../constants.js';
import { useUserStore } from '../../../state/useUserStore';
import { Card, Btn, inputStyle } from '../ui/UIKit.jsx';
import { toast } from '../ui/Toast.jsx';
import {
  generateSecret, formatSecret, buildTOTPUri,
  generateBackupCodes, downloadBackupCodes, generateQRMatrix, renderQRToCanvas,
} from '../../../utils/totpUtils.js';
import st from './TwoFactorSection.module.css';

function TwoFactorSection() {
  const profile = useUserStore((s) => s.profile);
  const updateProfile = useUserStore((s) => s.updateProfile);
  const p = { twoFactorEnabled: false, twoFactorSetupDate: null, recoveryEmail: '', backupCodesRemaining: 0, ...profile };

  const [wizardStep, setWizardStep] = useState(0);
  const [secret, setSecret] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [recoveryDraft, setRecoveryDraft] = useState(p.recoveryEmail || '');
  const qrRef = useRef(null);

  useEffect(() => {
    if (wizardStep === 2 && qrRef.current && secret) {
      const uri = buildTOTPUri(secret, p.recoveryEmail || 'user');
      const matrix = generateQRMatrix(uri);
      renderQRToCanvas(qrRef.current, matrix, 5, C.t1, C.sf);
    }
  }, [wizardStep, secret, p.recoveryEmail]);

  const startSetup = useCallback(() => {
    setSecret(generateSecret()); setBackupCodes([]); setVerifyCode(''); setVerifyError(''); setWizardStep(1);
  }, []);

  const handleVerify = useCallback(() => {
    if (verifyCode.length !== 6 || !/^\d{6}$/.test(verifyCode)) { setVerifyError('Enter a valid 6-digit code'); return; }
    setVerifyError(''); setBackupCodes(generateBackupCodes(6)); setWizardStep(4);
  }, [verifyCode]);

  const finishSetup = useCallback(() => {
    updateProfile({ twoFactorEnabled: true, twoFactorSetupDate: Date.now(), backupCodesRemaining: 6 });
    setWizardStep(0); toast.success('Two-factor authentication enabled!');
  }, [updateProfile]);

  const disable2FA = useCallback(() => {
    updateProfile({ twoFactorEnabled: false, twoFactorSetupDate: null, backupCodesRemaining: 0 });
    toast.info('Two-factor authentication disabled');
  }, [updateProfile]);

  const saveRecoveryEmail = useCallback(() => {
    updateProfile({ recoveryEmail: recoveryDraft }); toast.success('Recovery email updated');
  }, [recoveryDraft, updateProfile]);

  // ─── 2FA Enabled State ─────────────────────────────────────
  if (p.twoFactorEnabled && wizardStep === 0) {
    return (
      <Card className={st.cardPad}>
        <div className={st.enabledHeader}>
          <div className={st.enabledLeft}>
            <div className={`${st.iconBox} ${st.iconEnabled}`}>🔒</div>
            <div>
              <div className={st.sectionTitle}>Two-Factor Authentication</div>
              <div className={st.enabledStatus}>
                ✓ Enabled {p.twoFactorSetupDate
                  ? `since ${new Date(p.twoFactorSetupDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                  : ''}
              </div>
            </div>
          </div>
          <Btn variant="ghost" onClick={disable2FA} style={{ fontSize: 11, padding: '4px 12px', color: C.r }}>Disable</Btn>
        </div>
        <div className={st.infoRow}>
          <div>
            <div className={st.infoLabel}>Backup Codes</div>
            <div className={st.infoValue}>{p.backupCodesRemaining} remaining</div>
          </div>
          {p.recoveryEmail && (
            <div>
              <div className={st.infoLabel}>Recovery Email</div>
              <div className={st.infoValueMono}>{p.recoveryEmail}</div>
            </div>
          )}
        </div>
      </Card>
    );
  }

  // ─── Wizard Steps ──────────────────────────────────────────
  if (wizardStep > 0) {
    return (
      <Card className={st.cardPad}>
        <div className={st.progressRow}>
          {[1, 2, 3, 4].map((step) => (
            <React.Fragment key={step}>
              <div className={`${st.stepDot} ${wizardStep >= step ? st.stepDotActive : st.stepDotInactive}`}>
                {wizardStep > step ? '✓' : step}
              </div>
              {step < 4 && <div className={`${st.stepLine} ${wizardStep > step ? st.stepLineActive : st.stepLineInactive}`} />}
            </React.Fragment>
          ))}
        </div>

        {wizardStep === 1 && (
          <div>
            <div className={st.stepTitle}>Get Started</div>
            <div className={st.stepDesc}>To enable two-factor authentication, you'll need an authenticator app on your phone:</div>
            <div className={st.appList}>
              {[
                { name: 'Google Authenticator', hint: 'iOS & Android' },
                { name: '1Password', hint: 'iOS, Android, Desktop' },
                { name: 'Authy', hint: 'iOS & Android, multi-device' },
              ].map((app) => (
                <div key={app.name} className={st.appCard}>
                  <span className={st.appIcon}>📱</span>
                  <div>
                    <div className={st.appName}>{app.name}</div>
                    <div className={st.appHint}>{app.hint}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className={st.navRow}>
              <Btn variant="ghost" onClick={() => setWizardStep(0)} style={{ fontSize: 12, padding: '6px 14px' }}>Cancel</Btn>
              <Btn onClick={() => setWizardStep(2)} style={{ fontSize: 12, padding: '6px 14px' }}>Next →</Btn>
            </div>
          </div>
        )}

        {wizardStep === 2 && (
          <div>
            <div className={st.stepTitle}>Scan QR Code</div>
            <div className={st.stepDesc}>Open your authenticator app and scan this code:</div>
            <div className={st.qrWrap}><canvas ref={qrRef} className={st.qrCanvas} /></div>
            <div className={st.manualBlock}>
              <div className={st.manualLabel}>Or enter this key manually:</div>
              <div className={st.manualKey}>{formatSecret(secret)}</div>
              <button
                onClick={() => { navigator.clipboard?.writeText(secret); toast.info('Key copied to clipboard'); }}
                className={`tf-btn ${st.copyKeyBtn}`}
              >📋 Copy key</button>
            </div>
            <div className={st.navRow}>
              <Btn variant="ghost" onClick={() => setWizardStep(1)} style={{ fontSize: 12, padding: '6px 14px' }}>← Back</Btn>
              <Btn onClick={() => setWizardStep(3)} style={{ fontSize: 12, padding: '6px 14px' }}>Next →</Btn>
            </div>
          </div>
        )}

        {wizardStep === 3 && (
          <div>
            <div className={st.stepTitle}>Verify Code</div>
            <div className={st.stepDesc}>Enter the 6-digit code from your authenticator app:</div>
            <div className={st.verifyRow}>
              <div className={st.verifyInputWrap}>
                <input
                  type="text" value={verifyCode}
                  onChange={(e) => { setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setVerifyError(''); }}
                  placeholder="000000" maxLength={6} autoFocus
                  style={{
                    ...inputStyle, width: '100%', fontSize: 24, fontWeight: 700,
                    textAlign: 'center', letterSpacing: 8,
                    borderColor: verifyError ? C.r : undefined,
                  }}
                />
                {verifyError && <div className={st.verifyError}>{verifyError}</div>}
              </div>
            </div>
            <div className={st.navRow}>
              <Btn variant="ghost" onClick={() => setWizardStep(2)} style={{ fontSize: 12, padding: '6px 14px' }}>← Back</Btn>
              <Btn onClick={handleVerify} disabled={verifyCode.length !== 6}
                style={{ fontSize: 12, padding: '6px 14px', opacity: verifyCode.length === 6 ? 1 : 0.5 }}>Verify & Enable</Btn>
            </div>
          </div>
        )}

        {wizardStep === 4 && (
          <div>
            <div className={st.stepTitle}>Save Backup Codes</div>
            <div className={st.stepDesc}>Keep these codes somewhere safe. Each can only be used once if you lose access to your authenticator.</div>
            <div className={st.backupWrap}>
              <div className={st.backupGrid}>
                {backupCodes.map((code, i) => (
                  <div key={i} className={st.backupCode}>{code}</div>
                ))}
              </div>
            </div>
            <div className={st.backupActions}>
              <div className={st.backupBtns}>
                <button onClick={() => { navigator.clipboard?.writeText(backupCodes.join('\n')); toast.info('Codes copied to clipboard'); }}
                  className={`tf-btn ${st.secondaryBtn}`}>📋 Copy</button>
                <button onClick={() => downloadBackupCodes(backupCodes)}
                  className={`tf-btn ${st.secondaryBtn}`}>⬇️ Download</button>
              </div>
              <Btn onClick={finishSetup} style={{ fontSize: 12, padding: '6px 14px' }}>Done ✓</Btn>
            </div>
          </div>
        )}
      </Card>
    );
  }

  // ─── 2FA Disabled State ────────────────────────────────────
  return (
    <div className={st.disabledWrap}>
      <Card className={st.cardPad}>
        <div className={st.disabledRow}>
          <div className={st.disabledLeft}>
            <div className={`${st.iconBox} ${st.iconDisabled}`}>🔓</div>
            <div>
              <div className={st.sectionTitle}>Two-Factor Authentication</div>
              <div className={st.disabledHint}>Add an extra layer of security to your account</div>
            </div>
          </div>
          <Btn onClick={startSetup} style={{ fontSize: 11, padding: '6px 14px' }}>Enable 2FA</Btn>
        </div>
      </Card>

      <Card className={st.cardPad}>
        <div className={st.recoveryTitle}>Recovery Email</div>
        <div className={st.recoveryHint}>Used to recover your account if you lose access</div>
        <div className={st.recoveryRow}>
          <div className={st.recoveryInputWrap}>
            <input type="email" value={recoveryDraft} onChange={(e) => setRecoveryDraft(e.target.value)}
              placeholder="recovery@email.com" style={{ ...inputStyle, width: '100%' }} />
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
