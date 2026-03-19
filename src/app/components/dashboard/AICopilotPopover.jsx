// ═══════════════════════════════════════════════════════════════════
// charEdge — AI Copilot Popover (Sprint 1: Conversational Redesign)
//
// Hybrid chat + presets panel. Users can:
//   - Type free-text messages and get AI responses
//   - Click preset chips (auto-sent as chat messages)
//   - See streaming responses with typing indicator
//
// All messages flow through useCopilotChat Zustand store.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { C, F, GLASS, DEPTH } from '../../../constants.js';
import useHomeSummary from '../../../hooks/useHomeSummary.js';
import useCopilotChat from '../../../hooks/useCopilotChat';
import AIOrb from '../design/AIOrb.jsx';

// ─── Quick Action Presets ───────────────────────────────────────

const PRESETS = [
    { id: 'best', label: 'Best trade this week', emoji: '🏆' },
    { id: 'risk', label: 'Risk assessment', emoji: '🛡️' },
    { id: 'week', label: 'Week analysis', emoji: '📊' },
    { id: 'tips', label: 'Suggestions', emoji: '💡' },
];

// ─── Relative Time Formatter ─────────────────────────────────────

function relativeTime(ts) {
    const diff = Date.now() - ts;
    if (diff < 60_000) return 'just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return new Date(ts).toLocaleDateString();
}

// ─── CSS Keyframes (injected once) ──────────────────────────────

const KEYFRAMES_ID = 'tf-copilot-popover-keyframes';

function ensureKeyframes() {
    if (typeof document === 'undefined') return;
    if (document.getElementById(KEYFRAMES_ID)) return;
    const style = document.createElement('style');
    style.id = KEYFRAMES_ID;
    style.textContent = `
    @keyframes copilotPopoverIn {
      0% { opacity: 0; transform: scale(0.95) translateY(-8px); }
      100% { opacity: 1; transform: scale(1) translateY(0); }
    }
    @keyframes copilotMsgIn {
      0% { opacity: 0; transform: translateY(8px); }
      100% { opacity: 1; transform: translateY(0); }
    }
    @keyframes copilotDotPulse {
      0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
      40% { opacity: 1; transform: scale(1); }
    }
  `;
    document.head.appendChild(style);
}

// ─── Component ──────────────────────────────────────────────────

export default function AICopilotPopover({ anchorRef, onClose }) {
    const popoverRef = useRef(null);
    const messagesEndRef = useRef(null);
    const textareaRef = useRef(null);
    const summary = useHomeSummary();

    // Zustand store
    const messages = useCopilotChat((s) => s.messages);
    const isStreaming = useCopilotChat((s) => s.isStreaming);
    const streamingText = useCopilotChat((s) => s.streamingText);
    const error = useCopilotChat((s) => s.error);
    const sendMessage = useCopilotChat((s) => s.sendMessage);
    const retryLast = useCopilotChat((s) => s.retryLast);
    const loadHistory = useCopilotChat((s) => s.loadHistory);
    const newConversation = useCopilotChat((s) => s.newConversation);
    const clearAllHistory = useCopilotChat((s) => s.clearAllHistory);

    // Local state
    const [input, setInput] = useState('');
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    // Inject keyframes on first mount
    useEffect(() => ensureKeyframes(), []);

    // Auto-focus textarea on mount
    useEffect(() => {
        const t = setTimeout(() => textareaRef.current?.focus(), 100);
        return () => clearTimeout(t);
    }, []);

    // Sprint 3: Load history from IndexedDB on mount
    useEffect(() => {
        loadHistory();
    }, [loadHistory]);

    // Auto-scroll to bottom on new messages or streaming
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, streamingText]);

    // Click-outside dismiss
    useEffect(() => {
        function handleClickOutside(e) {
            if (
                popoverRef.current &&
                !popoverRef.current.contains(e.target) &&
                anchorRef?.current &&
                !anchorRef.current.contains(e.target)
            ) {
                onClose();
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose, anchorRef]);

    // Escape dismiss
    useEffect(() => {
        function handleKey(e) {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        }
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [onClose]);

    // ─── Send Message ────────────────────────────────────────

    const handleSend = useCallback(() => {
        const text = input.trim();
        if (!text || isStreaming) return;
        setInput('');
        sendMessage(text);
        // Reset textarea height
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
    }, [input, isStreaming, sendMessage]);

    // Handle preset pill click → send as chat message
    const handlePreset = useCallback((preset) => {
        if (isStreaming) return;
        sendMessage(`${preset.emoji} ${preset.label}`);
    }, [isStreaming, sendMessage]);

    // Handle keyboard: Enter to send, Shift+Enter for newline
    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }, [handleSend]);

    // Auto-grow textarea
    const handleInputChange = useCallback((e) => {
        setInput(e.target.value);
        const ta = e.target;
        ta.style.height = 'auto';
        ta.style.height = Math.min(ta.scrollHeight, 96) + 'px'; // max ~4 lines
    }, []);

    // Position below anchor
    const getPosition = useCallback(() => {
        if (!anchorRef?.current) return { top: 60, left: 80 };
        const rect = anchorRef.current.getBoundingClientRect();
        return {
            top: rect.bottom + 10,
            left: Math.min(rect.left, window.innerWidth - 396),
        };
    }, [anchorRef]);

    const pos = getPosition();
    const hasMessages = messages.length > 0;

    return (
        <div
            ref={popoverRef}
            id="tf-copilot-panel"
            role="dialog"
            aria-label="AI Copilot"
            style={{
                position: 'fixed',
                top: pos.top,
                left: pos.left,
                width: 380,
                maxHeight: 520,
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                background: GLASS.heavy,
                backdropFilter: GLASS.blurLg,
                WebkitBackdropFilter: GLASS.blurLg,
                border: GLASS.border,
                borderRadius: 16,
                boxShadow: DEPTH[4],
                fontFamily: F,
                animation: 'copilotPopoverIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
                overflow: 'hidden',
            }}
        >
            {/* ─── Header ──────────────────────────────────────── */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 16px 10px',
                    borderBottom: GLASS.border,
                    flexShrink: 0,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AIOrb size={18} glow animate={isStreaming} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.t1, letterSpacing: '-0.01em' }}>
                        charEdge Copilot
                    </span>
                    {isStreaming && (
                        <span style={{ fontSize: 10, color: C.b, fontWeight: 500 }}>
                            thinking…
                        </span>
                    )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {/* Sprint 3: New conversation button */}
                    {messages.length > 0 && (
                        <button
                            onClick={newConversation}
                            title="New conversation"
                            style={{
                                background: 'none',
                                border: 'none',
                                color: C.t3,
                                fontSize: 12,
                                cursor: 'pointer',
                                padding: '2px 6px',
                                borderRadius: 6,
                                transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = C.sf2;
                                e.currentTarget.style.color = C.t1;
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'none';
                                e.currentTarget.style.color = C.t3;
                            }}
                        >
                            ＋
                        </button>
                    )}
                <button
                    onClick={onClose}
                    aria-label="Close copilot"
                    style={{
                        background: 'none',
                        border: 'none',
                        color: C.t3,
                        fontSize: 16,
                        cursor: 'pointer',
                        padding: '2px 6px',
                        borderRadius: 6,
                        transition: 'all 0.15s ease',
                        lineHeight: 1,
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = C.sf2;
                        e.currentTarget.style.color = C.t1;
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'none';
                        e.currentTarget.style.color = C.t3;
                    }}
                >
                    ✕
                </button>
                </div>
            </div>

            {/* Sprint 3: Clear history confirmation */}
            {showClearConfirm && (
                <div style={{
                    padding: '8px 16px',
                    background: C.r + '10',
                    borderBottom: GLASS.border,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: 11,
                    color: C.t2,
                }}>
                    <span>Clear all conversation history?</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => { clearAllHistory(); setShowClearConfirm(false); }}
                            style={{ background: C.r + '20', border: `1px solid ${C.r}40`, borderRadius: 6, color: C.r, fontSize: 10, fontWeight: 600, padding: '2px 8px', cursor: 'pointer', fontFamily: F }}>
                            Clear
                        </button>
                        <button onClick={() => setShowClearConfirm(false)}
                            style={{ background: C.sf2, border: `1px solid ${C.bd}`, borderRadius: 6, color: C.t2, fontSize: 10, padding: '2px 8px', cursor: 'pointer', fontFamily: F }}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* ─── Message Area ─────────────────────────────────── */}
            <div
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '12px 16px',
                    minHeight: hasMessages ? 160 : 0,
                    maxHeight: 320,
                    scrollBehavior: 'smooth',
                }}
            >
                {!hasMessages && !isStreaming ? (
                    // Empty state — briefing
                    <EmptyState summary={summary} />
                ) : (
                    <>
                        {messages.map((msg) => (
                            <ChatMessage key={msg.id} message={msg} isStreaming={false} />
                        ))}

                        {/* Streaming partial response */}
                        {isStreaming && streamingText && (
                            <ChatMessage
                                message={{
                                    id: '__streaming',
                                    role: 'assistant',
                                    content: streamingText,
                                    timestamp: Date.now(),
                                    tier: 'L3',
                                }}
                                isStreaming
                            />
                        )}

                        {/* Typing indicator (no text yet) */}
                        {isStreaming && !streamingText && (
                            <TypingIndicator />
                        )}

                        {/* Error state */}
                        {error && (
                            <div style={{
                                padding: '8px 12px',
                                borderRadius: 10,
                                background: C.r + '12',
                                border: `1px solid ${C.r}25`,
                                fontSize: 12,
                                color: C.r,
                                marginTop: 8,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 8,
                            }}>
                                <span>⚠️ {error}</span>
                                <button
                                    onClick={retryLast}
                                    style={{
                                        background: C.r + '20',
                                        border: `1px solid ${C.r}40`,
                                        borderRadius: 6,
                                        color: C.r,
                                        fontSize: 11,
                                        fontWeight: 600,
                                        padding: '3px 10px',
                                        cursor: 'pointer',
                                        fontFamily: F,
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    Retry ↻
                                </button>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>

            {/* ─── Preset Chips ─────────────────────────────────── */}
            {!hasMessages && (
                <div
                    style={{
                        padding: '8px 16px 4px',
                        borderTop: GLASS.border,
                        flexShrink: 0,
                    }}
                >
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        {PRESETS.map((p) => (
                            <PresetPill
                                key={p.id}
                                preset={p}
                                disabled={isStreaming}
                                onClick={() => handlePreset(p)}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* ─── Input Area ──────────────────────────────────── */}
            <div
                style={{
                    padding: '10px 16px 14px',
                    borderTop: GLASS.border,
                    display: 'flex',
                    gap: 8,
                    alignItems: 'flex-end',
                    flexShrink: 0,
                }}
            >
                <textarea
                    ref={textareaRef}
                    id="tf-copilot-input"
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask anything about your trades…"
                    rows={1}
                    style={{
                        flex: 1,
                        resize: 'none',
                        border: `1px solid ${C.bd}`,
                        borderRadius: 10,
                        background: C.sf2,
                        color: C.t1,
                        fontSize: 13,
                        fontFamily: F,
                        padding: '8px 12px',
                        outline: 'none',
                        lineHeight: 1.5,
                        minHeight: 36,
                        maxHeight: 96,
                        transition: 'border-color 0.2s ease',
                    }}
                    onFocus={(e) => { e.target.style.borderColor = C.b + '60'; }}
                    onBlur={(e) => { e.target.style.borderColor = C.bd; }}
                />
                <button
                    onClick={handleSend}
                    disabled={!input.trim() || isStreaming}
                    aria-label="Send message"
                    id="tf-copilot-send"
                    style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        border: 'none',
                        background: input.trim() && !isStreaming
                            ? `linear-gradient(135deg, ${C.b}, ${C.bH})`
                            : C.sf2,
                        color: input.trim() && !isStreaming ? '#fff' : C.t3,
                        fontSize: 16,
                        cursor: input.trim() && !isStreaming ? 'pointer' : 'default',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s ease',
                        flexShrink: 0,
                    }}
                >
                    ↑
                </button>
            </div>

            {/* ─── Footer Hint ─────────────────────────────────── */}
            <div
                style={{
                    padding: '6px 16px',
                    borderTop: GLASS.border,
                    display: 'flex',
                    justifyContent: 'center',
                    fontSize: 10,
                    color: C.t3,
                    opacity: 0.6,
                    flexShrink: 0,
                }}
            >
                <kbd
                    style={{
                        background: C.sf2,
                        padding: '1px 5px',
                        borderRadius: 4,
                        fontSize: 10,
                        fontFamily: F,
                        marginRight: 4,
                        border: `1px solid ${C.bd}`,
                    }}
                >
                    ⌘K
                </kbd>
                to toggle
            </div>
        </div>
    );
}

// ─── Chat Message Bubble ────────────────────────────────────────

function ChatMessage({ message, isStreaming: streaming }) {
    const isUser = message.role === 'user';

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: isUser ? 'flex-end' : 'flex-start',
                marginBottom: 10,
                animation: 'copilotMsgIn 0.25s ease forwards',
            }}
        >
            <div
                style={{
                    maxWidth: '85%',
                    padding: '8px 12px',
                    borderRadius: isUser ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                    background: isUser
                        ? `linear-gradient(135deg, ${C.b}20, ${C.b}10)`
                        : C.sf2,
                    border: `1px solid ${isUser ? C.b + '25' : C.bd}`,
                    fontSize: 13,
                    lineHeight: 1.55,
                    color: C.t1,
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap',
                }}
            >
                {message.content}
                {streaming && (
                    <span
                        style={{
                            display: 'inline-block',
                            width: 6,
                            height: 14,
                            background: C.b,
                            marginLeft: 2,
                            borderRadius: 1,
                            animation: 'copilotDotPulse 1s ease infinite',
                            verticalAlign: 'text-bottom',
                        }}
                    />
                )}
            </div>

            {/* Meta row: timestamp + tier badge */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginTop: 3,
                    fontSize: 10,
                    color: C.t3,
                }}
            >
                <span>{relativeTime(message.timestamp)}</span>
                {!isUser && message.tier && (
                    <span
                        style={{
                            padding: '1px 5px',
                            borderRadius: 4,
                            background: message.tier === 'L1' ? C.g + '18' : C.p + '18',
                            color: message.tier === 'L1' ? C.g : C.p,
                            fontSize: 9,
                            fontWeight: 600,
                        }}
                    >
                        {message.tier}
                    </span>
                )}
            </div>
        </div>
    );
}

// ─── Typing Indicator ───────────────────────────────────────────

function TypingIndicator() {
    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 0',
                marginBottom: 8,
            }}
        >
            <AIOrb size={14} animate />
            <div style={{ display: 'flex', gap: 4 }}>
                {[0, 1, 2].map((i) => (
                    <span
                        key={i}
                        style={{
                            width: 5,
                            height: 5,
                            borderRadius: '50%',
                            background: C.t3,
                            animation: `copilotDotPulse 1.2s ease ${i * 0.2}s infinite`,
                        }}
                    />
                ))}
            </div>
        </div>
    );
}

// ─── Empty State (briefing) ──────────────────────────────────────

function EmptyState({ summary }) {
    const stats = [];
    if (summary.todayTradeCount > 0) {
        stats.push({ label: 'Today', value: `${summary.todayTradeCount} trades`, color: C.info });
        stats.push({ label: 'Win Rate', value: `${summary.todayWinRate}%`, color: summary.todayWinRate >= 50 ? C.g : C.r });
    }
    if (summary.weekTrend !== 0) {
        stats.push({ label: 'Week', value: `${summary.weekTrend >= 0 ? '+' : ''}${summary.weekTrend}%`, color: summary.weekTrend >= 0 ? C.g : C.r });
    }

    return (
        <div>
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: 8,
                    fontSize: 11,
                    fontWeight: 600,
                    color: C.t3,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                }}
            >
                📊 Your Day at a Glance
            </div>
            <p
                style={{
                    margin: 0,
                    fontSize: 13,
                    lineHeight: 1.6,
                    color: C.t2,
                }}
            >
                {summary.briefing}
            </p>

            {stats.length > 0 && (
                <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                    {stats.map((s) => (
                        <div
                            key={s.label}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '3px 8px',
                                borderRadius: 8,
                                background: s.color + '12',
                                border: `1px solid ${s.color}20`,
                                fontSize: 10,
                                fontWeight: 600,
                            }}
                        >
                            <span style={{ color: C.t3 }}>{s.label}</span>
                            <span style={{ color: s.color }}>{s.value}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Preset Pill ────────────────────────────────────────────────

function PresetPill({ preset, disabled, onClick }) {
    const [hovered, setHovered] = React.useState(false);

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 10px',
                borderRadius: 10,
                border: `1px solid ${hovered ? C.b + '30' : C.bd}`,
                background: hovered ? C.b + '08' : C.sf2,
                color: hovered ? C.t1 : C.t2,
                fontSize: 11,
                fontWeight: 500,
                fontFamily: F,
                cursor: disabled ? 'default' : 'pointer',
                transition: 'all 0.2s ease',
                textAlign: 'left',
                opacity: disabled ? 0.5 : 1,
            }}
        >
            <span style={{ fontSize: 14, lineHeight: 1 }}>{preset.emoji}</span>
            {preset.label}
        </button>
    );
}

export { AICopilotPopover };
