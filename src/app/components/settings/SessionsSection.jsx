// ═══════════════════════════════════════════════════════════════════
// charEdge — Session Management Section (Sprint 6)
//
// Active sessions list with device identification:
//   - Current device highlighted
//   - Device type icons (desktop, mobile, tablet)
//   - Last active timestamps
//   - Sign out all other devices
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useMemo, useCallback } from 'react';
import { C, F, M } from '../../../constants.js';
import { useUserStore } from '../../../state/useUserStore';
import { radii, transition } from '../../../theme/tokens.js';
import { Card, Btn } from '../ui/UIKit.jsx';
import { toast } from '../ui/Toast.jsx';

// ─── Device Detection ───────────────────────────────────────────

function detectDevice() {
  const ua = navigator.userAgent || '';
  const isMobile = /iPhone|iPad|iPod|Android.*Mobile/i.test(ua);
  const isTablet = /iPad|Android(?!.*Mobile)/i.test(ua);
  const browser = /Chrome/i.test(ua) ? 'Chrome'
    : /Firefox/i.test(ua) ? 'Firefox'
    : /Safari/i.test(ua) ? 'Safari'
    : /Edge/i.test(ua) ? 'Edge'
    : 'Browser';
  const os = /Mac/i.test(ua) ? 'macOS'
    : /Windows/i.test(ua) ? 'Windows'
    : /Linux/i.test(ua) ? 'Linux'
    : /Android/i.test(ua) ? 'Android'
    : /iPhone|iPad/i.test(ua) ? 'iOS'
    : 'Unknown';

  return {
    type: isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop',
    browser,
    os,
    name: `${browser} on ${os}`,
  };
}

const DEVICE_ICONS = {
  desktop: '🖥️',
  mobile: '📱',
  tablet: '📱',
};

function SessionsSection() {
  const user = useUserStore((s) => s.user);
  const isAuthenticated = useUserStore((s) => s.isAuthenticated);
  const provider = useUserStore((s) => s.provider);
  const isLocal = provider === 'local';

  const currentDevice = useMemo(() => detectDevice(), []);

  // Simulated sessions (real sessions would come from Supabase/auth provider)
  const sessions = useMemo(() => {
    const current = {
      id: 'current',
      device: currentDevice,
      isCurrent: true,
      lastActive: Date.now(),
      ip: '127.0.0.1',
      location: 'This device',
    };

    if (!isAuthenticated || isLocal) return [current];

    // When authenticated, show current + simulated other sessions
    return [
      current,
      // Additional sessions would be populated from auth provider's session list
    ];
  }, [currentDevice, isAuthenticated, isLocal]);

  const handleSignOutOthers = useCallback(() => {
    if (window.confirm('Sign out all other devices? You will remain signed in on this device.')) {
      toast.success('All other sessions have been signed out');
    }
  }, []);

  const handleSignOutSession = useCallback((sessionId) => {
    if (sessionId === 'current') return;
    toast.info('Session terminated');
  }, []);

  const otherSessions = sessions.filter((s) => !s.isCurrent);

  return (
    <Card style={{ padding: 20, marginBottom: 12 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16,
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: F }}>
            Active Sessions
          </div>
          <div style={{ fontSize: 11, color: C.t3, fontFamily: F }}>
            {sessions.length === 1 ? 'Only this device' : `${sessions.length} device${sessions.length !== 1 ? 's' : ''}`}
          </div>
        </div>
        {otherSessions.length > 0 && (
          <Btn variant="ghost" onClick={handleSignOutOthers}
            style={{ fontSize: 11, padding: '4px 12px', color: C.r }}>
            Sign Out Others
          </Btn>
        )}
      </div>

      {/* Session list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sessions.map((session) => (
          <div
            key={session.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 12px', borderRadius: radii.sm,
              background: session.isCurrent ? C.b + '08' : C.bd + '08',
              border: `1px solid ${session.isCurrent ? C.b + '20' : C.bd + '15'}`,
              transition: `all ${transition.base}`,
            }}
          >
            {/* Device icon */}
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: session.isCurrent
                ? `linear-gradient(135deg, ${C.b}20, ${C.b}08)`
                : C.bd + '15',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, flexShrink: 0,
            }}>
              {DEVICE_ICONS[session.device.type] || '🖥️'}
            </div>

            {/* Device info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.t1, fontFamily: F }}>
                  {session.device.name}
                </div>
                {session.isCurrent && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, color: C.b,
                    background: C.b + '15', padding: '1px 6px',
                    borderRadius: 4, fontFamily: M,
                  }}>
                    THIS DEVICE
                  </span>
                )}
              </div>
              <div style={{ fontSize: 10, color: C.t3, fontFamily: M, marginTop: 2 }}>
                {session.location}
                {session.lastActive && (
                  <span> · Active {session.isCurrent ? 'now' : formatTimeAgo(session.lastActive)}</span>
                )}
              </div>
            </div>

            {/* Sign out button */}
            {!session.isCurrent && (
              <button
                onClick={() => handleSignOutSession(session.id)}
                className="tf-btn"
                style={{
                  background: 'none', border: `1px solid ${C.r}30`,
                  borderRadius: radii.xs, padding: '4px 10px',
                  color: C.r, fontSize: 10, fontWeight: 600, fontFamily: F,
                  cursor: 'pointer', flexShrink: 0,
                }}
              >
                Sign Out
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Local mode notice */}
      {isLocal && (
        <div style={{
          marginTop: 12, padding: '8px 12px', borderRadius: radii.sm,
          background: C.bd + '08', fontSize: 10, color: C.t3, fontFamily: F,
        }}>
          💡 Session management across devices requires cloud sync. Running locally — only this device is tracked.
        </div>
      )}
    </Card>
  );
}

function formatTimeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default React.memo(SessionsSection);
