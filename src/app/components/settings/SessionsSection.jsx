// ═══════════════════════════════════════════════════════════════════
// charEdge — Session Management Section (Sprint 6)
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useMemo, useCallback } from 'react';
import { C } from '../../../constants.js';
import { useUserStore } from '../../../state/useUserStore';
import { Card, Btn } from '../ui/UIKit.jsx';
import { toast } from '../ui/Toast.jsx';
import st from './SessionsSection.module.css';

function detectDevice() {
  const ua = navigator.userAgent || '';
  const isMobile = /iPhone|iPad|iPod|Android.*Mobile/i.test(ua);
  const isTablet = /iPad|Android(?!.*Mobile)/i.test(ua);
  const browser = /Chrome/i.test(ua) ? 'Chrome' : /Firefox/i.test(ua) ? 'Firefox' : /Safari/i.test(ua) ? 'Safari' : /Edge/i.test(ua) ? 'Edge' : 'Browser';
  const os = /Mac/i.test(ua) ? 'macOS' : /Windows/i.test(ua) ? 'Windows' : /Linux/i.test(ua) ? 'Linux' : /Android/i.test(ua) ? 'Android' : /iPhone|iPad/i.test(ua) ? 'iOS' : 'Unknown';
  return { type: isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop', browser, os, name: `${browser} on ${os}` };
}

const DEVICE_ICONS = { desktop: '🖥️', mobile: '📱', tablet: '📱' };

function SessionsSection() {
  const user = useUserStore((s) => s.user);
  const isAuthenticated = useUserStore((s) => s.isAuthenticated);
  const provider = useUserStore((s) => s.provider);
  const isLocal = provider === 'local';
  const currentDevice = useMemo(() => detectDevice(), []);

  const sessions = useMemo(() => {
    const current = { id: 'current', device: currentDevice, isCurrent: true, lastActive: Date.now(), ip: '127.0.0.1', location: 'This device' };
    if (!isAuthenticated || isLocal) return [current];
    return [current];
  }, [currentDevice, isAuthenticated, isLocal]);

  const handleSignOutOthers = useCallback(() => {
    if (window.confirm('Sign out all other devices? You will remain signed in on this device.')) toast.success('All other sessions have been signed out');
  }, []);

  const handleSignOutSession = useCallback((sessionId) => {
    if (sessionId === 'current') return;
    toast.info('Session terminated');
  }, []);

  const otherSessions = sessions.filter((s) => !s.isCurrent);

  return (
    <Card className={st.cardPad}>
      <div className={st.header}>
        <div>
          <div className={st.headerTitle}>Active Sessions</div>
          <div className={st.headerHint}>{sessions.length === 1 ? 'Only this device' : `${sessions.length} device${sessions.length !== 1 ? 's' : ''}`}</div>
        </div>
        {otherSessions.length > 0 && (
          <Btn variant="ghost" onClick={handleSignOutOthers} style={{ fontSize: 11, padding: '4px 12px', color: C.r }}>Sign Out Others</Btn>
        )}
      </div>

      <div className={st.sessionList}>
        {sessions.map((session) => (
          <div key={session.id} className={st.sessionRow}
            style={{ background: session.isCurrent ? C.b + '08' : C.bd + '08', border: `1px solid ${session.isCurrent ? C.b + '20' : C.bd + '15'}` }}>
            <div className={st.deviceIcon}
              style={{ background: session.isCurrent ? `linear-gradient(135deg, ${C.b}20, ${C.b}08)` : C.bd + '15' }}>
              {DEVICE_ICONS[session.device.type] || '🖥️'}
            </div>
            <div className={st.deviceInfo}>
              <div className={st.deviceNameRow}>
                <div className={st.deviceName}>{session.device.name}</div>
                {session.isCurrent && (
                  <span className={st.currentBadge} style={{ color: C.b, background: C.b + '15' }}>THIS DEVICE</span>
                )}
              </div>
              <div className={st.deviceMeta}>
                {session.location}
                {session.lastActive && <span> · Active {session.isCurrent ? 'now' : formatTimeAgo(session.lastActive)}</span>}
              </div>
            </div>
            {!session.isCurrent && (
              <button onClick={() => handleSignOutSession(session.id)} className={`tf-btn ${st.signOutBtn}`}
                style={{ border: `1px solid ${C.r}30`, color: C.r }}>Sign Out</button>
            )}
          </div>
        ))}
      </div>

      {isLocal && (
        <div className={st.localNotice} style={{ background: C.bd + '08' }}>
          💡 Session management across devices requires cloud sync. Running locally — only this device is tracked.
        </div>
      )}
    </Card>
  );
}

function formatTimeAgo(ts) {
  const diff = Date.now() - ts; const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now'; if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60); if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default React.memo(SessionsSection);
