// ═══════════════════════════════════════════════════════════════════
// charEdge — Live Trading Rooms Panel
// ═══════════════════════════════════════════════════════════════════

import { useSocialStore } from '../../../state/useSocialStore.js';
import { useState, useRef, useEffect } from 'react';
import { C, F, M } from '../../../constants.js';
import { alpha } from '../../../utils/colorUtils.js';

// ─── Room Card ──────────────────────────────────────────────────
function RoomCard({ room, onJoin }) {
  const onlineCount = room.participants.filter((p) => p.online).length;

  return (
    <div
      className="tf-room-card"
      style={{
        background: C.bg2, border: `1px solid ${C.bd}`, borderRadius: 16,
        padding: 20, cursor: 'pointer', position: 'relative', overflow: 'hidden',
        transition: 'all 0.25s ease',
      }}
      onClick={() => onJoin(room.id)}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = room.color;
        e.currentTarget.style.boxShadow = `0 0 20px ${alpha(room.color, 0.15)}`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = C.bd;
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Live indicator bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, ${room.color}, ${alpha(room.color, 0.3)})`,
      }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14,
          background: alpha(room.color, 0.12),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24,
        }}>
          {room.icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: C.t1, fontFamily: F }}>{room.name}</div>
          <div style={{ fontSize: 11, color: C.t3, fontFamily: F, marginTop: 2 }}>{room.description}</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Avatar stack */}
          <div style={{ display: 'flex' }}>
            {room.participants.slice(0, 5).map((p, i) => (
              <div key={i} style={{
                width: 22, height: 22, borderRadius: '50%',
                background: C.sf, border: `2px solid ${C.bg2}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, marginLeft: i > 0 ? -6 : 0, zIndex: 5 - i,
              }}>
                {p.avatar}
              </div>
            ))}
          </div>
          <span style={{ fontSize: 11, color: C.t3, fontFamily: F }}>
            {room.participants.length} members
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div className="tf-live-dot" style={{
            width: 7, height: 7, borderRadius: '50%',
            background: '#2dd4a0',
            boxShadow: '0 0 6px #2dd4a0',
          }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: C.g, fontFamily: M }}>
            {onlineCount} online
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Chat View ──────────────────────────────────────────────────
function ChatView({ roomId }) {
  const room = useSocialStore((s) => s.getRoomById(roomId));
  const messages = useSocialStore((s) => s.messages);
  const typingUsers = useSocialStore((s) => s.typingUsers);
  const sendMessage = useSocialStore((s) => s.sendMessage);
  const leaveRoom = useSocialStore((s) => s.leaveRoom);
  const [input, setInput] = useState('');
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(input.trim());
    setInput('');
  };

  if (!room) return null;

  const onlineParticipants = room.participants.filter((p) => p.online);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 20, height: 'calc(100vh - 300px)', minHeight: 500 }}>
      {/* Chat Area */}
      <div style={{
        display: 'flex', flexDirection: 'column',
        background: C.bg2, border: `1px solid ${C.bd}`, borderRadius: 16, overflow: 'hidden',
      }}>
        {/* Room Header */}
        <div style={{
          padding: '14px 20px', borderBottom: `1px solid ${C.bd}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: alpha(room.color, 0.04),
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>{room.icon}</span>
            <div>
              <div style={{ fontWeight: 700, color: C.t1, fontFamily: F, fontSize: 14 }}>{room.name}</div>
              <div style={{ fontSize: 11, color: C.t3 }}>{onlineParticipants.length} online</div>
            </div>
          </div>
          <button
            onClick={leaveRoom}
            style={{
              padding: '6px 14px', borderRadius: 8,
              border: `1px solid ${C.bd}`, background: 'transparent',
              color: C.t2, fontSize: 11, fontWeight: 600, fontFamily: F, cursor: 'pointer',
            }}
          >
            ← Leave Room
          </button>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {messages.map((msg) => {
            const isMe = msg.userId === 'local_user';
            return (
              <div key={msg.id} style={{
                display: 'flex', gap: 10,
                flexDirection: isMe ? 'row-reverse' : 'row',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 10,
                  background: C.sf, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, flexShrink: 0,
                }}>
                  {msg.avatar}
                </div>
                <div style={{ maxWidth: '70%' }}>
                  <div style={{
                    display: 'flex', gap: 8, alignItems: 'baseline',
                    flexDirection: isMe ? 'row-reverse' : 'row',
                    marginBottom: 3,
                  }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: isMe ? C.b : C.t1, fontFamily: F }}>{msg.userName}</span>
                    <span style={{ fontSize: 10, color: C.t3 }}>
                      {new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div style={{
                    padding: '8px 14px', borderRadius: 12,
                    background: isMe ? alpha(C.b, 0.12) : C.sf,
                    border: `1px solid ${isMe ? alpha(C.b, 0.2) : C.bd}`,
                    fontSize: 13, color: C.t1, fontFamily: F, lineHeight: 1.5,
                  }}>
                    {msg.text}
                  </div>
                </div>
              </div>
            );
          })}

          {typingUsers.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
              <span style={{ fontSize: 14 }}>{typingUsers[0].avatar}</span>
              <span style={{ fontSize: 11, color: C.t3, fontFamily: F, fontStyle: 'italic' }}>
                {typingUsers.map((u) => u.name).join(', ')} is typing
                <span className="tf-typing-dots">...</span>
              </span>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div style={{
          padding: '12px 16px', borderTop: `1px solid ${C.bd}`,
          display: 'flex', gap: 10,
        }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type a message..."
            style={{
              flex: 1, padding: '10px 14px', borderRadius: 10,
              border: `1px solid ${C.bd}`, background: C.sf, color: C.t1,
              fontSize: 13, fontFamily: F, outline: 'none',
            }}
          />
          <button
            onClick={handleSend}
            style={{
              padding: '10px 20px', borderRadius: 10, border: 'none',
              background: `linear-gradient(135deg, ${C.b}, ${C.bH})`,
              color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: F,
              cursor: 'pointer',
            }}
          >
            Send
          </button>
        </div>
      </div>

      {/* Participants Sidebar */}
      <div style={{
        background: C.bg2, border: `1px solid ${C.bd}`, borderRadius: 16,
        padding: 16, overflowY: 'auto',
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.t2, fontFamily: F, marginBottom: 14 }}>
          Participants ({room.participants.length})
        </div>

        {/* Online */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: C.g, fontFamily: F, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
            Online — {onlineParticipants.length}
          </div>
          {onlineParticipants.map((p) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
              <span style={{ fontSize: 14 }}>{p.avatar}</span>
              <span style={{ fontSize: 12, color: C.t1, fontFamily: F }}>{p.name}</span>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.g, marginLeft: 'auto' }} />
            </div>
          ))}
        </div>

        {/* Offline */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: C.t3, fontFamily: F, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
            Offline — {room.participants.filter((p) => !p.online).length}
          </div>
          {room.participants.filter((p) => !p.online).map((p) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', opacity: 0.5 }}>
              <span style={{ fontSize: 14 }}>{p.avatar}</span>
              <span style={{ fontSize: 12, color: C.t3, fontFamily: F }}>{p.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Export ─────────────────────────────────────────────────
export default function LiveRoomPanel() {
  const activeRoom = useSocialStore((s) => s.activeRoom);
  const rooms = useSocialStore((s) => s.rooms);
  const joinRoom = useSocialStore((s) => s.joinRoom);

  if (activeRoom) {
    return <ChatView roomId={activeRoom} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 22 }}>💬</span>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: C.t1, fontFamily: F }}>Live Trading Rooms</h2>
        <div className="tf-live-dot" style={{
          width: 8, height: 8, borderRadius: '50%', background: C.g,
          boxShadow: `0 0 8px ${C.g}`,
        }} />
      </div>

      <p style={{ fontSize: 13, color: C.t3, fontFamily: F, margin: 0, marginTop: -8 }}>
        Join real-time discussions by asset class. Share charts, debate setups, and learn from the community.
      </p>

      {/* Room Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
        {rooms.map((room, i) => (
          <RoomCard key={room.id} room={room} onJoin={joinRoom} />
        ))}
      </div>
    </div>
  );
}
