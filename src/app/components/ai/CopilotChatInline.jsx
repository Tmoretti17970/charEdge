// ═══════════════════════════════════════════════════════════════════
// charEdge — CopilotChatInline (Phase 3: Refactored)
//
// Inline chat interface for the charts SlidePanel.
// No fixed positioning — renders inside a flex parent.
// Reuses useCopilotChat store for messages, streaming, and history.
//
// Phase 3 Task #34: Split into sub-components:
//   MsgBubble, TypingDots, ModelCTA, PresetChips, SlashAutocomplete
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from 'react';
import AIOrb from '../design/AIOrb.jsx';
import ModelCTA from './ModelCTA.jsx';
import MsgBubble from './MsgBubble.jsx';
import PresetChips from './PresetChips.jsx';
import SlashAutocomplete from './SlashAutocomplete.jsx';
import TypingDots from './TypingDots.jsx';
import { C } from '@/constants.js';
import useCopilotChat from '@/hooks/useCopilotChat';

// ─── Mode Metadata ──────────────────────────────────────────────

const MODE_META = {
  quick: { emoji: '⚡', label: 'Quick', color: '#f59e0b' },
  analysis: { emoji: '🔬', label: 'Analysis', color: '#3b82f6' },
  coaching: { emoji: '🎯', label: 'Coaching', color: '#10b981' },
  journal: { emoji: '📓', label: 'Journal', color: '#8b5cf6' },
};

// ─── CSS Keyframes (injected once) ──────────────────────────────

const KF_ID = 'tf-copilot-inline-kf';
function ensureKeyframes() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(KF_ID)) return;
  const s = document.createElement('style');
  s.id = KF_ID;
  s.textContent = `
    @keyframes copilotInlineMsgIn {
      0% { opacity: 0; transform: translateY(8px) scale(0.97); }
      60% { opacity: 1; transform: translateY(-2px) scale(1.01); }
      100% { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes copilotInlineDot {
      0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
      40% { opacity: 1; transform: scale(1); }
    }
    @keyframes copilotInlineCursor {
      0%, 100% { opacity: 1; }
      50% { opacity: 0; }
    }
    @keyframes copilotSlideUp {
      0% { opacity: 0; transform: translateY(8px); }
      100% { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(s);
}

// ═══════════════════════════════════════════════════════════════════
// CopilotChatInline (main export)
// ═══════════════════════════════════════════════════════════════════

export default function CopilotChatInline() {
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

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
  // Sprint 26: Model auto-load
  const modelPromptShown = useCopilotChat((s) => s.modelPromptShown);
  const modelDownloading = useCopilotChat((s) => s.modelDownloading);
  const modelProgress = useCopilotChat((s) => s.modelProgress);
  const modelProgressText = useCopilotChat((s) => s.modelProgressText);
  const downloadModel = useCopilotChat((s) => s.downloadModel);
  const dismissModelPrompt = useCopilotChat((s) => s.dismissModelPrompt);
  // Sprint 28: Stop generation
  const stopGeneration = useCopilotChat((s) => s.stopGeneration);

  // Local state
  const [input, setInput] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Sprint 3: Slash command autocomplete
  const [cmdSuggestions, setCmdSuggestions] = useState([]);
  const [cmdSelectedIdx, setCmdSelectedIdx] = useState(0);

  // Sprint 16: Mode state
  const [currentMode, setCurrentMode] = useState('analysis');

  // Phase 2 Task #19: Search mode indicator
  const [searchMode, setSearchMode] = useState('none');
  useEffect(() => {
    let cancelled = false;
    if (messages.length === 0) return;
    (async () => {
      try {
        const { journalRAG } = await import('../../../ai/JournalRAG');
        if (!cancelled) setSearchMode(journalRAG.searchMode);
      } catch {
        /* non-critical */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [messages.length]);

  // Sprint 29: Token report (dev-mode only)
  const [tokenReport, setTokenReport] = useState(null);
  useEffect(() => {
    if (!import.meta.env.DEV || messages.length === 0) return;
    (async () => {
      try {
        const { promptAssembler } = await import('../../../ai/PromptAssembler');
        const report = promptAssembler.getLastTokenReport();
        if (report) setTokenReport(report);
      } catch {
        /* non-critical */
      }
    })();
  }, [messages]);

  // Sprint 17: Model CTA
  const [ctaDismissed, setCtaDismissed] = useState(() => {
    try {
      return localStorage.getItem('charEdge-model-cta-dismissed') === 'true';
    } catch {
      return false;
    }
  });
  const [ctaLoading, setCtaLoading] = useState(false);
  const [ctaProgress, setCtaProgress] = useState('');
  const lastResponseTier = useCopilotChat((s) => s.lastResponseTier);

  // Sprint 6: DNA personalization indicator
  const [dnaInfo, setDnaInfo] = useState(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { promptAssembler } = await import('../../../ai/PromptAssembler');
        const { traderDNA } = await import('../../../ai/TraderDNA');
        if (cancelled) return;
        const available = promptAssembler.hasDNA();
        if (available) {
          const dna = traderDNA.generateDNA();
          setDnaInfo({ available: true, summary: `Based on ${dna.tradeCount} trades · ${dna.archetypeLabel}` });
        } else {
          setDnaInfo({ available: false, summary: '' });
        }
      } catch {
        setDnaInfo({ available: false, summary: '' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Sprint 16: Load current mode
  useEffect(() => {
    (async () => {
      try {
        const { conversationModes } = await import('../../../ai/ConversationModes');
        setCurrentMode(conversationModes.getMode());
      } catch {
        /* */
      }
    })();
  }, [messages.length]);

  // Inject keyframes
  useEffect(() => ensureKeyframes(), []);

  // Auto-focus textarea
  useEffect(() => {
    const t = setTimeout(() => textareaRef.current?.focus(), 200);
    return () => clearTimeout(t);
  }, []);

  // Load history
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  // ─── Handlers ──────────────────────────────────────────────

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput('');
    sendMessage(text);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, [input, isStreaming, sendMessage]);

  const handlePreset = useCallback(
    (text) => {
      if (isStreaming) return;
      sendMessage(text);
    },
    [isStreaming, sendMessage],
  );

  // Sprint 16: Cycle through modes
  const handleCycleMode = useCallback(async () => {
    try {
      const { conversationModes } = await import('../../../ai/ConversationModes');
      conversationModes.cycleMode();
      setCurrentMode(conversationModes.getMode());
    } catch {
      /* */
    }
  }, []);

  // Sprint 17: Download model from CTA
  const handleCtaDownload = useCallback(async () => {
    setCtaLoading(true);
    try {
      const { webLLMProvider } = await import('../../../ai/WebLLMProvider');
      webLLMProvider.onStatusChange((s) => {
        if (s.progressText) setCtaProgress(s.progressText);
      });
      await webLLMProvider.loadModel('SmolLM2-135M-Instruct-q0f16-MLC');
      setCtaLoading(false);
      setCtaProgress('');
      retryLast();
    } catch {
      setCtaLoading(false);
      setCtaProgress('Download failed');
    }
  }, [retryLast]);

  const handleCtaDismiss = useCallback(() => {
    setCtaDismissed(true);
    try {
      localStorage.setItem('charEdge-model-cta-dismissed', 'true');
    } catch {
      /* */
    }
  }, []);

  const handleCmdSelect = useCallback((cmd) => {
    setInput(`/${cmd.name} `);
    setCmdSuggestions([]);
    setCmdSelectedIdx(0);
    textareaRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (e) => {
      // Slash command autocomplete navigation
      if (cmdSuggestions.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setCmdSelectedIdx((i) => Math.min(i + 1, cmdSuggestions.length - 1));
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setCmdSelectedIdx((i) => Math.max(i - 1, 0));
          return;
        }
        if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Tab') {
          e.preventDefault();
          const selected = cmdSuggestions[cmdSelectedIdx];
          if (selected) handleCmdSelect(selected);
          return;
        }
        if (e.key === 'Escape') {
          setCmdSuggestions([]);
          setCmdSelectedIdx(0);
          return;
        }
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend, cmdSuggestions, cmdSelectedIdx, handleCmdSelect],
  );

  const handleInputChange = useCallback(
    (e) => {
      const val = e.target.value;
      setInput(val);
      const ta = e.target;
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 96) + 'px';

      if (val.startsWith('/')) {
        import('../../../ai/SlashCommandParser')
          .then(({ slashCommandParser }) => {
            const suggestions = slashCommandParser.getCommandSuggestions(val.trim());
            setCmdSuggestions(suggestions);
            setCmdSelectedIdx(0);
          })
          .catch(() => setCmdSuggestions([]));
      } else {
        if (cmdSuggestions.length > 0) setCmdSuggestions([]);
      }
    },
    [cmdSuggestions.length],
  );

  const hasMessages = messages.length > 0;

  // ─── Render ────────────────────────────────────────────────

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        marginTop: -16,
        marginLeft: -16,
        marginRight: -16,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px 6px',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <AIOrb size={14} glow animate={isStreaming} />
          <span style={{ fontSize: 11, fontWeight: 600, color: C.t2 }}>
            {isStreaming ? 'Thinking…' : 'Ask anything'}
          </span>
          {/* Mode pill */}
          <button
            onClick={handleCycleMode}
            title={`Mode: ${MODE_META[currentMode]?.label || 'Analysis'} — tap to cycle`}
            className="tf-btn"
            style={{
              fontSize: 9,
              fontWeight: 600,
              padding: '1px 7px',
              borderRadius: 10,
              background: (MODE_META[currentMode]?.color || C.b) + '12',
              border: `1px solid ${(MODE_META[currentMode]?.color || C.b) + '25'}`,
              color: MODE_META[currentMode]?.color || C.b,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            {MODE_META[currentMode]?.emoji || '🔬'} {MODE_META[currentMode]?.label || 'Analysis'}
          </button>
          {dnaInfo?.available && (
            <span
              title={dnaInfo.summary}
              style={{
                fontSize: 9,
                fontWeight: 600,
                padding: '1px 6px',
                borderRadius: 10,
                background: `linear-gradient(135deg, ${C.b}18, ${C.p}18)`,
                border: `1px solid ${C.b}25`,
                color: C.b,
                letterSpacing: 0.3,
                cursor: 'default',
                whiteSpace: 'nowrap',
              }}
            >
              Personalized ✦
            </span>
          )}
          {searchMode === 'keyword' && (
            <span
              title="Using keyword search. Semantic search requires WebGPU or a Gemini API key."
              style={{
                fontSize: 8,
                fontWeight: 600,
                padding: '1px 6px',
                borderRadius: 8,
                background: '#f59e0b12',
                border: '1px solid #f59e0b25',
                color: '#f59e0b',
                cursor: 'default',
                whiteSpace: 'nowrap',
              }}
            >
              🔤 Keyword search
            </span>
          )}
          {import.meta.env.DEV && tokenReport && (
            <span
              title={`System: ${tokenReport.breakdown.system} | User: ${tokenReport.breakdown.user} | History: ${tokenReport.breakdown.history}`}
              style={{
                fontSize: 8,
                fontWeight: 600,
                padding: '1px 5px',
                borderRadius: 8,
                background: tokenReport.overBudget ? C.r + '15' : C.sf2,
                border: `1px solid ${tokenReport.overBudget ? C.r + '30' : C.bd}`,
                color: tokenReport.overBudget ? C.r : C.t3,
                fontFamily: 'monospace',
                cursor: 'default',
                whiteSpace: 'nowrap',
              }}
            >
              {tokenReport.totalTokens}/{tokenReport.contextWindow}t
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {hasMessages && (
            <button
              onClick={newConversation}
              title="New conversation"
              style={{
                background: 'none',
                border: 'none',
                color: C.t3,
                fontSize: 11,
                cursor: 'pointer',
                padding: '2px 6px',
                borderRadius: 4,
                fontFamily: 'var(--tf-font)',
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
              ＋ New
            </button>
          )}
          {hasMessages && (
            <button
              onClick={() => setShowClearConfirm(true)}
              title="Clear history"
              style={{
                background: 'none',
                border: 'none',
                color: C.t3,
                fontSize: 10,
                cursor: 'pointer',
                padding: '2px 6px',
                borderRadius: 4,
                fontFamily: 'var(--tf-font)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = C.r + '12';
                e.currentTarget.style.color = C.r;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'none';
                e.currentTarget.style.color = C.t3;
              }}
            >
              🗑
            </button>
          )}
        </div>
      </div>

      {/* Clear confirmation */}
      {showClearConfirm && (
        <div
          style={{
            padding: '6px 16px',
            background: C.r + '10',
            borderBottom: `1px solid ${C.r}20`,
            borderTop: `1px solid ${C.r}20`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 11,
            color: C.t2,
            flexShrink: 0,
          }}
        >
          <span>Clear all history?</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => {
                clearAllHistory();
                setShowClearConfirm(false);
              }}
              style={{
                background: C.r + '20',
                border: `1px solid ${C.r}40`,
                borderRadius: 4,
                color: C.r,
                fontSize: 10,
                fontWeight: 600,
                padding: '2px 6px',
                cursor: 'pointer',
                fontFamily: 'var(--tf-font)',
              }}
            >
              Clear
            </button>
            <button
              onClick={() => setShowClearConfirm(false)}
              style={{
                background: C.sf2,
                border: `1px solid ${C.bd}`,
                borderRadius: 4,
                color: C.t2,
                fontSize: 10,
                padding: '2px 6px',
                cursor: 'pointer',
                fontFamily: 'var(--tf-font)',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div
        role="log"
        aria-live="polite"
        aria-atomic="false"
        aria-label="AI Copilot conversation"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '10px 16px',
          scrollBehavior: 'smooth',
        }}
      >
        {!hasMessages && !isStreaming ? (
          <div style={{ padding: '12px 0', fontSize: 12, color: C.t3, lineHeight: 1.6 }}>
            <p style={{ margin: '0 0 10px' }}>Ask about your trades, strategies, risk, or anything else.</p>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <MsgBubble key={msg.id} msg={msg} streaming={false} />
            ))}
            {isStreaming && streamingText && (
              <MsgBubble
                msg={{
                  id: '__streaming',
                  role: 'assistant',
                  content: streamingText,
                  timestamp: Date.now(),
                  tier: 'L3',
                }}
                streaming
              />
            )}
            {isStreaming && !streamingText && <TypingDots />}
            {/* Sprint 17: Inline Model CTA */}
            {!isStreaming && !ctaDismissed && lastResponseTier === 'L1' && messages.length > 0 && !modelPromptShown && (
              <ModelCTA
                onDownload={handleCtaDownload}
                onDismiss={handleCtaDismiss}
                loading={ctaLoading}
                progress={ctaProgress}
              />
            )}
            {/* Sprint 26: Model Download Prompt */}
            {modelPromptShown && (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: `linear-gradient(135deg, ${C.b}08, ${C.p || C.b}08)`,
                  border: `1px solid ${C.b}20`,
                  margin: '8px 0',
                  animation: 'copilotInlineMsgIn 0.3s ease',
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 600, color: C.t1, marginBottom: 6 }}>
                  🧠 Want smarter, AI-powered answers?
                </div>
                <div style={{ fontSize: 10, color: C.t2, lineHeight: 1.5, marginBottom: 8 }}>
                  Download SmolLM2 (~80MB) to run a real language model in your browser. Your question will be
                  automatically re-sent after download.
                </div>
                {modelDownloading ? (
                  <div>
                    <div
                      style={{
                        height: 4,
                        borderRadius: 4,
                        background: C.sf2,
                        overflow: 'hidden',
                        marginBottom: 4,
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          borderRadius: 4,
                          background: `linear-gradient(90deg, ${C.b}, ${C.p || C.b})`,
                          width: `${modelProgress}%`,
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                    <div style={{ fontSize: 9, color: C.t3 }}>{modelProgressText || `${modelProgress}%`}</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={downloadModel}
                      style={{
                        flex: 1,
                        padding: '5px 0',
                        borderRadius: 6,
                        background: C.b,
                        color: '#fff',
                        border: 'none',
                        fontSize: 10,
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontFamily: 'var(--tf-font)',
                        transition: 'opacity 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = '0.85';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = '1';
                      }}
                    >
                      ⬇ Download SmolLM2
                    </button>
                    <button
                      onClick={dismissModelPrompt}
                      style={{
                        padding: '5px 10px',
                        borderRadius: 6,
                        background: C.sf2,
                        color: C.t2,
                        border: `1px solid ${C.bd}`,
                        fontSize: 10,
                        cursor: 'pointer',
                        fontFamily: 'var(--tf-font)',
                      }}
                    >
                      Skip
                    </button>
                  </div>
                )}
              </div>
            )}
            {error && (
              <div
                style={{
                  padding: '6px 10px',
                  borderRadius: 8,
                  background: C.r + '12',
                  border: `1px solid ${C.r}25`,
                  fontSize: 11,
                  color: C.r,
                  marginTop: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 6,
                }}
              >
                <span>⚠️ {error}</span>
                <button
                  onClick={retryLast}
                  style={{
                    background: C.r + '20',
                    border: `1px solid ${C.r}40`,
                    borderRadius: 4,
                    color: C.r,
                    fontSize: 10,
                    fontWeight: 600,
                    padding: '2px 8px',
                    cursor: 'pointer',
                    fontFamily: 'var(--tf-font)',
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

      {/* Preset Chips */}
      {!hasMessages && <PresetChips onPreset={handlePreset} disabled={isStreaming} />}

      {/* Slash Command Autocomplete */}
      <SlashAutocomplete suggestions={cmdSuggestions} selectedIdx={cmdSelectedIdx} onSelect={handleCmdSelect} />

      {/* Input */}
      <div
        style={{
          padding: '8px 16px 10px',
          borderTop: `1px solid ${C.bd}`,
          display: 'flex',
          gap: 6,
          alignItems: 'flex-end',
          flexShrink: 0,
        }}
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything…"
          rows={1}
          style={{
            flex: 1,
            resize: 'none',
            border: `1px solid ${C.bd}`,
            borderRadius: 8,
            background: C.sf2,
            color: C.t1,
            fontSize: 12,
            fontFamily: 'var(--tf-font)',
            padding: '7px 10px',
            outline: 'none',
            lineHeight: 1.5,
            minHeight: 32,
            maxHeight: 96,
            transition: 'border-color 0.2s ease',
          }}
          onFocus={(e) => {
            e.target.style.borderColor = C.b + '60';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = C.bd;
          }}
        />
        {isStreaming ? (
          <button
            onClick={stopGeneration}
            aria-label="Stop generation"
            title="Stop generating"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: `1px solid ${C.r}40`,
              background: C.r + '15',
              color: C.r,
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = C.r + '25';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = C.r + '15';
            }}
          >
            ■
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            aria-label="Send message"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: 'none',
              background: input.trim() ? `linear-gradient(135deg, ${C.b}, ${C.bH})` : C.sf2,
              color: input.trim() ? '#fff' : C.t3,
              fontSize: 14,
              cursor: input.trim() ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
              flexShrink: 0,
            }}
          >
            ↑
          </button>
        )}
      </div>
    </div>
  );
}
