// ═══════════════════════════════════════════════════════════════════
// charEdge — CopilotPanel (Sprint 24: CSS Module Migration)
//
// Responsive AI Copilot panel:
//   Desktop: fixed right-side panel (resizable, full height, slide-in)
//   Mobile:  bottom sheet (full width, 60vh, swipe-to-dismiss)
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef, useCallback } from 'react';
import useHomeSummary from '../../../hooks/useHomeSummary.js';
import useCopilotChat from '../../../hooks/useCopilotChat';
import AIOrb from '../design/AIOrb.jsx';
import { useBreakpoints } from '@/hooks/useMediaQuery';
import st from './CopilotPanel.module.css';

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

// ─── Desktop Resize Constants ────────────────────────────────────

const MIN_WIDTH = 300;
const MAX_WIDTH = 600;
const DEFAULT_WIDTH = 380;

// ═══════════════════════════════════════════════════════════════════
// CopilotPanel (main export)
// ═══════════════════════════════════════════════════════════════════

export default function CopilotPanel() {
    const { isMobile } = useBreakpoints();
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
    const closePanel = useCopilotChat((s) => s.closePanel);

    // Local state
    const [input, setInput] = useState('');
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [panelWidth, setPanelWidth] = useState(DEFAULT_WIDTH);
    const [showScrollBtn, setShowScrollBtn] = useState(false);

    // Auto-focus textarea
    useEffect(() => {
        const t = setTimeout(() => textareaRef.current?.focus(), 150);
        return () => clearTimeout(t);
    }, []);

    // Load history from IndexedDB
    useEffect(() => { loadHistory(); }, [loadHistory]);

    // Auto-scroll to bottom on new messages or streaming
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, streamingText]);

    // Escape to close
    useEffect(() => {
        function handleKey(e) {
            if (e.key === 'Escape') {
                e.preventDefault();
                closePanel();
            }
        }
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [closePanel]);

    // ─── Send ────────────────────────────────────────────────

    const handleSend = useCallback(() => {
        const text = input.trim();
        if (!text || isStreaming) return;
        setInput('');
        sendMessage(text);
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
    }, [input, isStreaming, sendMessage]);

    const handlePreset = useCallback((preset) => {
        if (isStreaming) return;
        sendMessage(`${preset.emoji} ${preset.label}`);
    }, [isStreaming, sendMessage]);

    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }, [handleSend]);

    const handleInputChange = useCallback((e) => {
        setInput(e.target.value);
        const ta = e.target;
        ta.style.height = 'auto';
        ta.style.height = Math.min(ta.scrollHeight, 96) + 'px';
    }, []);

    // ─── Desktop Resize Handle ───────────────────────────────

    const handleResizeStart = useCallback((e) => {
        e.preventDefault();
        const startX = e.clientX;
        const startW = panelWidth;

        function onMove(e2) {
            const delta = startX - e2.clientX;
            setPanelWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startW + delta)));
        }
        function onUp() {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        }
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }, [panelWidth]);

    // ─── Scroll detection for scroll-to-bottom button ─────────

    const handleScroll = useCallback((e) => {
        const el = e.target;
        const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        setShowScrollBtn(!nearBottom);
    }, []);

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    const hasMessages = messages.length > 0;
    const layout = isMobile ? 'mobile' : 'desktop';
    const isReady = input.trim() && !isStreaming;

    return (
        <>
            {/* Backdrop (mobile only) */}
            {isMobile && <div className={st.backdrop} onClick={closePanel} />}

            <div
                id="tf-copilot-panel"
                role="dialog"
                aria-label="AI Copilot"
                className={st.panel}
                data-layout={layout}
                style={!isMobile ? { width: panelWidth } : undefined}
            >
                {/* Desktop resize handle */}
                {!isMobile && (
                    <div className={st.resizeHandle} onMouseDown={handleResizeStart} title="Drag to resize" />
                )}

                {/* Mobile drag handle */}
                {isMobile && (
                    <div className={st.dragPill}>
                        <div className={st.dragPillBar} />
                    </div>
                )}

                {/* ─── Header ──────────────────────────────────── */}
                <div className={st.header}>
                    <div className={st.headerLeft}>
                        <AIOrb size={18} glow animate={isStreaming} />
                        <span className={st.headerTitle}>charEdge Copilot</span>
                        {isStreaming && <span className={st.headerStatus}>thinking…</span>}
                    </div>
                    <div className={st.headerRight}>
                        {messages.length > 0 && (
                            <button onClick={newConversation} title="New conversation" className={st.ghostBtnSm}>
                                ＋
                            </button>
                        )}
                        <button onClick={closePanel} aria-label="Close copilot" className={st.ghostBtnLg}>
                            ✕
                        </button>
                    </div>
                </div>

                {/* Clear confirmation */}
                {showClearConfirm && (
                    <div className={st.clearBar}>
                        <span>Clear all conversation history?</span>
                        <div className={st.clearBarActions}>
                            <button className={st.clearBtnDanger} onClick={() => { clearAllHistory(); setShowClearConfirm(false); }}>
                                Clear
                            </button>
                            <button className={st.clearBtnCancel} onClick={() => setShowClearConfirm(false)}>
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* ─── Message Area ────────────────────────────── */}
                <div className={st.messages} onScroll={handleScroll}>
                    {!hasMessages && !isStreaming ? (
                        <EmptyState summary={summary} />
                    ) : (
                        <>
                            {messages.map((msg) => (
                                <ChatMessage key={msg.id} message={msg} isStreaming={false} />
                            ))}
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
                            {isStreaming && !streamingText && <TypingIndicator />}
                            {error && (
                                <div className={st.errorBanner}>
                                    <span>⚠️ {error}</span>
                                    <button className={st.retryBtn} onClick={retryLast}>Retry ↻</button>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </>
                    )}
                </div>

                {/* Scroll-to-bottom FAB */}
                {showScrollBtn && hasMessages && (
                    <button className={st.scrollFab} onClick={scrollToBottom} aria-label="Scroll to bottom">↓</button>
                )}

                {/* ─── Preset Chips ────────────────────────────── */}
                {!hasMessages && (
                    <div className={st.presetArea}>
                        <div className={st.presetGrid}>
                            {PRESETS.map((p) => (
                                <button
                                    key={p.id}
                                    className={st.presetPill}
                                    disabled={isStreaming}
                                    onClick={() => handlePreset(p)}
                                >
                                    <span className={st.presetEmoji}>{p.emoji}</span>
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* ─── Input Area ──────────────────────────────── */}
                <div className={st.inputArea}>
                    <textarea
                        ref={textareaRef}
                        id="tf-copilot-input"
                        value={input}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask anything about your trades…"
                        rows={1}
                        className={st.textarea}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!isReady}
                        aria-label="Send message"
                        id="tf-copilot-send"
                        className={st.sendBtn}
                        data-ready={isReady ? 'true' : undefined}
                    >
                        ↑
                    </button>
                </div>

                {/* ─── Footer ─────────────────────────────────── */}
                <div className={st.footer}>
                    <kbd className={st.kbd}>⌘K</kbd>
                    to toggle
                </div>
            </div>
        </>
    );
}

// ─── Chat Message Bubble ────────────────────────────────────────

function ChatMessage({ message, isStreaming: streaming }) {
    const role = message.role === 'user' ? 'user' : 'assistant';

    return (
        <div className={st.msgWrap} data-role={role}>
            <div className={st.msgBubble} data-role={role}>
                {message.content}
                {streaming && <span className={st.streamCursor} />}
            </div>
            <div className={st.msgMeta}>
                <span>{relativeTime(message.timestamp)}</span>
                {role === 'assistant' && message.tier && (
                    <span
                        className={st.tierBadge}
                        style={{
                            background: `var(--tf-${message.tier === 'L1' ? 'g' : 'p'}-15, rgba(0,0,0,0.1))`,
                            color: `var(--tf-${message.tier === 'L1' ? 'g' : 'p'})`,
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
        <div className={st.typing}>
            <AIOrb size={14} animate />
            <div className={st.typingDots}>
                <span className={st.typingDot} />
                <span className={st.typingDot} />
                <span className={st.typingDot} />
            </div>
        </div>
    );
}

// ─── Empty State ─────────────────────────────────────────────────

function EmptyState({ summary }) {
    const stats = [];
    if (summary.todayTradeCount > 0) {
        stats.push({ label: 'Today', value: `${summary.todayTradeCount} trades`, color: 'var(--tf-info)' });
        stats.push({ label: 'Win Rate', value: `${summary.todayWinRate}%`, color: summary.todayWinRate >= 50 ? 'var(--tf-g)' : 'var(--tf-r)' });
    }
    if (summary.weekTrend !== 0) {
        stats.push({ label: 'Week', value: `${summary.weekTrend >= 0 ? '+' : ''}${summary.weekTrend}%`, color: summary.weekTrend >= 0 ? 'var(--tf-g)' : 'var(--tf-r)' });
    }

    return (
        <div>
            <div className={st.emptyHeader}>📊 Your Day at a Glance</div>
            <p className={st.emptyBriefing}>{summary.briefing}</p>
            {stats.length > 0 && (
                <div className={st.statRow}>
                    {stats.map((s) => (
                        <div
                            key={s.label}
                            className={st.statChip}
                            style={{ '--dyn-color': s.color }}
                        >
                            <span style={{ color: 'var(--tf-t3)' }}>{s.label}</span>
                            <span style={{ color: 'var(--dyn-color)' }}>{s.value}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export { CopilotPanel };
