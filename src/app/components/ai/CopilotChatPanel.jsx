// ═══════════════════════════════════════════════════════════════════
// charEdge — Copilot Chat Panel (Sprint 61)
//
// Right slide-over conversational AI panel (360px).
// Message history with context cards, streaming responses.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { C } from '../../../constants.js';
import AIStreamText from './AIStreamText.jsx';
import { useCopilotChat } from '../../../hooks/useCopilotChat.ts';
import { useChartCoreStore } from '../../../state/chart/useChartCoreStore';
import st from './CopilotChatPanel.module.css';

const PANEL_WIDTH = 360;
const ACCENT = '#6e5ce6';

// Quick action suggestions
const QUICK_ACTIONS = [
  { label: '📊 Analyze chart', prompt: 'Analyze the current chart setup and give me your take' },
  { label: '🎯 Grade my trade', prompt: 'Grade my most recent trade and suggest improvements' },
  { label: '🧠 Market pulse', prompt: 'Give me a quick market pulse summary' },
  { label: '⚡ Risk check', prompt: 'What risks should I watch for in this setup?' },
];

export default function CopilotChatPanel() {
  const messages = useCopilotChat(s => s.messages);
  const isStreaming = useCopilotChat(s => s.isStreaming);
  const streamingText = useCopilotChat(s => s.streamingText);
  const panelOpen = useCopilotChat(s => s.panelOpen);
  const error = useCopilotChat(s => s.error);
  const sendMessage = useCopilotChat(s => s.sendMessage);
  const closePanel = useCopilotChat(s => s.closePanel);
  const clearMessages = useCopilotChat(s => s.clearMessages);
  const updateContext = useCopilotChat(s => s.updateContext);

  const [input, setInput] = useState('');
  const inputRef = useRef(null);
  const scrollRef = useRef(null);

  // Inject chart context
  useEffect(() => {
    const unsub = useChartCoreStore.subscribe(s => {
      updateContext({
        symbol: s.symbol,
        timeframe: s.tf,
        lastPrice: s.data?.[s.data.length - 1]?.close,
      });
    });
    return unsub;
  }, [updateContext]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingText]);

  // Focus input on open
  useEffect(() => {
    if (panelOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [panelOpen]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput('');
    sendMessage(text);
  }, [input, isStreaming, sendMessage]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  if (!panelOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      right: 0,
      top: 0,
      bottom: 0,
      width: PANEL_WIDTH,
      background: C.bg2 || C.bg,
      borderLeft: `1px solid ${C.bd}`,
      display: 'flex',
      flexDirection: 'column',
      zIndex: 9999,
      boxShadow: '-4px 0 24px rgba(0,0,0,0.3)',
      animation: 'copilotSlideIn 0.25s ease-out',
    }}>
      {/* ─── Header ──────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '12px 16px',
        borderBottom: `1px solid ${C.bd}`,
      }}>
        <span style={{ fontSize: 18 }}>🧠</span>
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 13,
            fontWeight: 700,
            fontFamily: 'var(--tf-font)',
            color: C.t1,
          }}>
            AI Copilot
          </div>
          <div style={{
            fontSize: 9,
            fontFamily: 'var(--tf-mono)',
            color: ACCENT,
          }}>
            {isStreaming ? 'Thinking…' : 'Ready'}
          </div>
        </div>
        <button
          onClick={clearMessages}
          title="Clear chat"
          style={{
            background: 'none',
            border: 'none',
            color: C.t3,
            cursor: 'pointer',
            fontSize: 12,
            padding: 4,
            opacity: messages.length > 0 ? 1 : 0.3,
          }}
        >
          🗑️
        </button>
        <button
          onClick={closePanel}
          style={{
            background: 'none',
            border: 'none',
            color: C.t3,
            cursor: 'pointer',
            fontSize: 16,
            padding: 4,
          }}
        >
          ✕
        </button>
      </div>

      {/* ─── Messages ────────────────────────────────────── */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {messages.length === 0 && !isStreaming && (
          <div style={{ padding: '20px 8px', textAlign: 'center' }}>
            <div style={{
              fontSize: 28,
              marginBottom: 12,
            }}>
              🧠
            </div>
            <div style={{
              fontSize: 12,
              fontFamily: 'var(--tf-font)',
              fontWeight: 600,
              color: C.t2,
              marginBottom: 4,
            }}>
              charEdge AI Copilot
            </div>
            <div style={{
              fontSize: 10,
              fontFamily: 'var(--tf-mono)',
              color: C.t3,
              marginBottom: 16,
              lineHeight: 1.5,
            }}>
              Ask about chart patterns, trade analysis, risk management, or trading psychology.
            </div>
            {/* Quick actions */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
              {QUICK_ACTIONS.map(qa => (
                <button
                  key={qa.label}
                  onClick={() => sendMessage(qa.prompt)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 8,
                    border: `1px solid ${C.bd}`,
                    background: 'transparent',
                    color: C.t2,
                    fontSize: 10,
                    fontFamily: 'var(--tf-mono)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = `${ACCENT}12`;
                    e.currentTarget.style.borderColor = `${ACCENT}40`;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.borderColor = C.bd;
                  }}
                >
                  {qa.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div style={{
              maxWidth: '85%',
              padding: '8px 12px',
              borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
              background: msg.role === 'user'
                ? `${ACCENT}20`
                : `${C.bd}15`,
              border: `1px solid ${msg.role === 'user' ? `${ACCENT}30` : `${C.bd}25`}`,
            }}>
              {msg.role === 'assistant' ? (
                <AIStreamText text={msg.content} isStreaming={false} />
              ) : (
                <div style={{
                  fontSize: 12,
                  fontFamily: 'var(--tf-font)',
                  color: C.t1,
                  lineHeight: 1.5,
                }}>
                  {msg.content}
                </div>
              )}
            </div>
            <div style={{
              fontSize: 8,
              fontFamily: 'var(--tf-mono)',
              color: C.t3,
              marginTop: 2,
              padding: '0 4px',
            }}>
              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {msg.tier && msg.tier !== 'L1' && (
                <span style={{ marginLeft: 4, color: ACCENT }}>·{msg.tier}</span>
              )}
            </div>
          </div>
        ))}

        {/* Streaming response */}
        {isStreaming && streamingText && (
          <div style={{
            maxWidth: '85%',
            padding: '8px 12px',
            borderRadius: '12px 12px 12px 2px',
            background: `${C.bd}15`,
            border: `1px solid ${C.bd}25`,
          }}>
            <AIStreamText text={streamingText} isStreaming={true} />
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            padding: '8px 12px',
            borderRadius: 8,
            background: `${C.r}10`,
            border: `1px solid ${C.r}20`,
            fontSize: 11,
            fontFamily: 'var(--tf-mono)',
            color: C.r,
          }}>
            ⚠️ {error}
          </div>
        )}
      </div>

      {/* ─── Input ───────────────────────────────────────── */}
      <div style={{
        padding: '8px 12px 12px',
        borderTop: `1px solid ${C.bd}`,
      }}>
        <div style={{
          display: 'flex',
          gap: 8,
          alignItems: 'flex-end',
        }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask AI Copilot..."
            rows={1}
            style={{
              flex: 1,
              resize: 'none',
              padding: '8px 12px',
              borderRadius: 10,
              border: `1px solid ${C.bd}`,
              background: `${C.bg}`,
              color: C.t1,
              fontSize: 12,
              fontFamily: 'var(--tf-font)',
              outline: 'none',
              maxHeight: 80,
              lineHeight: 1.4,
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: 'none',
              background: input.trim() && !isStreaming ? ACCENT : `${C.bd}30`,
              color: '#fff',
              fontSize: 14,
              cursor: input.trim() && !isStreaming ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s',
              flexShrink: 0,
            }}
          >
            ↑
          </button>
        </div>
      </div>

      {/* ─── Keyframes ───────────────────────────────────── */}
      <style>{`
        @keyframes copilotSlideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
