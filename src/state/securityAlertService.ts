// ═══════════════════════════════════════════════════════════════════
// charEdge — Security Alert Service (Sprint 15)
//
// Listens to auth events and fires security notifications through
// the notification router. Mirrors Coinbase's Security Alerts.
//
// Events covered:
//   - New sign-in (with device fingerprint)
//   - Password changed
//   - OAuth provider linked/unlinked
//   - Session expired
//
// All security channels are REQUIRED (push, inApp, email locked on).
// ═══════════════════════════════════════════════════════════════════

import { notifySecurity } from './notificationEngine';

// ─── Device Fingerprinting ──────────────────────────────────────

interface DeviceInfo {
  browser: string;
  os: string;
  timestamp: string;
}

function getDeviceInfo(): DeviceInfo {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  
  // Parse browser
  let browser = 'Unknown';
  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Edg')) browser = 'Edge';

  // Parse OS
  let os = 'Unknown';
  if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  else if (ua.includes('Android')) os = 'Android';

  const now = new Date();
  const timestamp = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  return { browser, os, timestamp };
}

// ─── Security Event Handlers ────────────────────────────────────

export function onNewSignIn(userId?: string): void {
  const device = getDeviceInfo();
  notifySecurity(
    '🔐 New sign-in detected',
    `${device.browser} on ${device.os} · ${device.timestamp}`,
    { event: 'new_sign_in', device, userId },
  );
}

export function onPasswordChanged(userId?: string): void {
  notifySecurity(
    '🔑 Password changed',
    'Your password was recently changed. If this wasn\'t you, reset it immediately.',
    { event: 'password_changed', userId },
  );
}

export function onOAuthLinked(provider: string, userId?: string): void {
  notifySecurity(
    '🔗 Account linked',
    `${provider} account linked to your charEdge profile`,
    { event: 'oauth_linked', provider, userId },
  );
}

export function onOAuthUnlinked(provider: string, userId?: string): void {
  notifySecurity(
    '🔗 Account unlinked',
    `${provider} account removed from your charEdge profile`,
    { event: 'oauth_unlinked', provider, userId },
  );
}

export function onSessionExpired(userId?: string): void {
  notifySecurity(
    '⏰ Session expired',
    'Your session has expired. Please sign in again.',
    { event: 'session_expired', userId },
  );
}

export function onFailedSignIn(attempts: number, userId?: string): void {
  notifySecurity(
    '⚠️ Failed sign-in attempts',
    `${attempts} failed sign-in attempt${attempts > 1 ? 's' : ''} detected`,
    { event: 'failed_sign_in', attempts, userId },
  );
}

// ─── Auth State Change Listener ─────────────────────────────────

/**
 * Wire into useAuthStore's onAuthStateChange.
 * Call this once during app initialization.
 *
 * @example
 * ```ts
 * // In App.jsx or auth initialization:
 * import { initSecurityAlerts } from './state/securityAlertService';
 * initSecurityAlerts();
 * ```
 */
export function initSecurityAlerts(): void {
  if (typeof window === 'undefined') return;

  // Listen for auth events dispatched by useAuthStore
  window.addEventListener('charEdge:auth-event', ((event: CustomEvent) => {
    const { type, detail } = event.detail || {};
    switch (type) {
      case 'SIGNED_IN':
        onNewSignIn(detail?.userId);
        break;
      case 'PASSWORD_RECOVERY':
        onPasswordChanged(detail?.userId);
        break;
      case 'TOKEN_REFRESHED':
        // Silent — don't notify on token refreshes
        break;
      case 'SIGNED_OUT':
        onSessionExpired(detail?.userId);
        break;
      case 'OAUTH_LINKED':
        onOAuthLinked(detail?.provider || 'Unknown', detail?.userId);
        break;
      case 'OAUTH_UNLINKED':
        onOAuthUnlinked(detail?.provider || 'Unknown', detail?.userId);
        break;
      default:
        break;
    }
  }) as ((e: Event) => void));
}

export default { initSecurityAlerts, onNewSignIn, onPasswordChanged, onOAuthLinked, onOAuthUnlinked, onSessionExpired, onFailedSignIn };
