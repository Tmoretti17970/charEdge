// ═══════════════════════════════════════════════════════════════════
// charEdge — Notification Bell
//
// Dropdown bell icon for the Social Hub header. Shows activity
// feed: likes, follows, comments, prediction results.
// ═══════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect } from 'react';
import { C, F, M } from '../../../constants.js';
import { useNotificationStore } from '../../../state/useNotificationStore.js';
import { alpha } from '@/shared/colorUtils';

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function getTypeIcon(type) {
  switch (type) {
    case 'like': return '❤️';
    case 'follow': return '👤';
    case 'comment': return '💬';
    case 'prediction': return '🔮';
    case 'milestone': return '🏆';
    default: return '🔔';
  }
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const notifications = useNotificationStore((s) => s.notifications);
  const getUnreadCount = useNotificationStore((s) => s.getUnreadCount);
  const markAsRead = useNotificationStore((s) => s.markAsRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);

  const unreadCount = getUnreadCount();

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Bell Button */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          position: 'relative',
          width: 36,
          height: 36,
          borderRadius: 10,
          border: `1px solid ${open ? C.b : C.bd}`,
          background: open ? alpha(C.b, 0.1) : 'transparent',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s ease',
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke={open ? C.b : C.t2}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {/* Badge */}
        {unreadCount > 0 && (
          <div
            className="tf-notif-badge"
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              width: 18,
              height: 18,
              borderRadius: '50%',
              background: C.r,
              color: '#fff',
              fontSize: 10,
              fontWeight: 800,
              fontFamily: M,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `2px solid ${C.bg}`,
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </div>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="tf-dropdown-enter"
          style={{
            position: 'absolute',
            top: 44,
            right: 0,
            width: 360,
            maxHeight: 480,
            overflowY: 'auto',
            background: C.bg2,
            border: `1px solid ${C.bd}`,
            borderRadius: 16,
            boxShadow: `0 16px 48px ${alpha(C.bg, 0.8)}`,
            zIndex: 9999,
            padding: '6px',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 14px 8px',
            }}
          >
            <span
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: C.t1,
                fontFamily: F,
              }}
            >
              Notifications
            </span>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead()}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: C.b,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: F,
                  padding: '4px 8px',
                  borderRadius: 6,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = alpha(C.b, 0.1))}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notifications List */}
          {notifications.length === 0 ? (
            <div
              style={{
                padding: '32px 16px',
                textAlign: 'center',
                color: C.t3,
                fontSize: 13,
                fontFamily: F,
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 8 }}>🔔</div>
              No notifications yet
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {notifications.map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => markAsRead(notif.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: 'none',
                    background: notif.read ? 'transparent' : alpha(C.b, 0.05),
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = alpha(C.t3, 0.08))
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = notif.read
                      ? 'transparent'
                      : alpha(C.b, 0.05))
                  }
                >
                  {/* Icon */}
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: alpha(C.b, 0.1),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 14,
                      flexShrink: 0,
                    }}
                  >
                    {notif.actorAvatar || getTypeIcon(notif.type)}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        color: C.t1,
                        lineHeight: 1.4,
                        fontFamily: F,
                        fontWeight: notif.read ? 400 : 600,
                      }}
                    >
                      <span style={{ fontWeight: 700 }}>{notif.actorName}</span>{' '}
                      {notif.message}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: C.t3,
                        fontFamily: M,
                        marginTop: 3,
                      }}
                    >
                      {getTypeIcon(notif.type)} {timeAgo(notif.timestamp)}
                    </div>
                  </div>

                  {/* Unread dot */}
                  {!notif.read && (
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: C.b,
                        flexShrink: 0,
                        marginTop: 4,
                      }}
                    />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
