// ═══════════════════════════════════════════════════════════════════
// charEdge — MsgBubble (extracted from CopilotChatInline)
//
// Renders a single message bubble with markdown, tier badges,
// journal context badge, and feedback buttons.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { C } from '@/constants.js';
import useCopilotChat from '@/hooks/useCopilotChat';

// ─── Lightweight Markdown Parser ─────────────────────────────────

function parseMarkdown(text) {
  if (!text) return text;
  const cleaned = text.replace(/^\s*\[AI Insight\]\s*/i, '');

  const parts = cleaned.split(/(```[\s\S]*?```)/g);
  return parts.map((part, pi) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      const inner = part.slice(3, -3).replace(/^\w*\n?/, '');
      return (
        <pre
          key={pi}
          style={{
            background: C.sf,
            padding: '8px 10px',
            borderRadius: 6,
            fontSize: 10,
            fontFamily: 'var(--tf-mono)',
            lineHeight: 1.5,
            overflowX: 'auto',
            margin: '4px 0',
            border: `1px solid ${C.bd}`,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {inner.trim()}
        </pre>
      );
    }
    const lines = part.split('\n');
    return lines.map((line, li) => {
      const bulletMatch = line.match(/^\s*[-•*]\s+(.+)/);
      if (bulletMatch) {
        return (
          <div key={`${pi}-${li}`} style={{ paddingLeft: 10, position: 'relative', marginBottom: 1 }}>
            <span style={{ position: 'absolute', left: 0, color: C.t3 }}>•</span>
            {renderInline(bulletMatch[1])}
          </div>
        );
      }
      const numMatch = line.match(/^\s*(\d+)\.\s+(.+)/);
      if (numMatch) {
        return (
          <div key={`${pi}-${li}`} style={{ paddingLeft: 14, position: 'relative', marginBottom: 1 }}>
            <span style={{ position: 'absolute', left: 0, color: C.t3, fontSize: 10, fontWeight: 600 }}>
              {numMatch[1]}.
            </span>
            {renderInline(numMatch[2])}
          </div>
        );
      }
      return (
        <span key={`${pi}-${li}`}>
          {renderInline(line)}
          {li < lines.length - 1 ? '\n' : ''}
        </span>
      );
    });
  });
}

function renderInline(text) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**'))
      return (
        <strong key={i} style={{ fontWeight: 700 }}>
          {p.slice(2, -2)}
        </strong>
      );
    if (p.startsWith('*') && p.endsWith('*')) return <em key={i}>{p.slice(1, -1)}</em>;
    if (p.startsWith('`') && p.endsWith('`'))
      return (
        <code
          key={i}
          style={{
            background: C.sf,
            padding: '1px 4px',
            borderRadius: 3,
            fontSize: '0.9em',
            fontFamily: 'var(--tf-mono)',
          }}
        >
          {p.slice(1, -1)}
        </code>
      );
    return p;
  });
}

// ─── Relative Time ──────────────────────────────────────────────

function relativeTime(ts) {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

// ═══════════════════════════════════════════════════════════════════
// MsgBubble
// ═══════════════════════════════════════════════════════════════════

function MsgBubble({ msg, streaming }) {
  const isUser = msg.role === 'user';

  // Sprint 33: Insight card
  if (msg.tier === 'insight') {
    return (
      <div
        style={{
          margin: '8px 0',
          padding: '8px 12px',
          borderRadius: 10,
          background: 'linear-gradient(135deg, #f59e0b10, #f59e0b05)',
          border: '1px solid #f59e0b30',
          fontSize: 12,
          lineHeight: 1.5,
          color: C.t1,
        }}
      >
        {parseMarkdown(msg.content)}
        <div style={{ fontSize: 9, color: '#f59e0b', marginTop: 4, fontWeight: 600 }}>
          INSIGHT · {relativeTime(msg.timestamp)}
        </div>
      </div>
    );
  }

  // Sprint 34: Morning brief card
  if (msg.tier === 'brief') {
    return (
      <div
        style={{
          margin: '8px 0',
          padding: '10px 14px',
          borderRadius: 12,
          background: `linear-gradient(135deg, ${C.b}12, ${C.p}08)`,
          border: `1px solid ${C.b}25`,
          fontSize: 12,
          lineHeight: 1.6,
          color: C.t1,
        }}
      >
        {parseMarkdown(msg.content)}
        <div style={{ fontSize: 9, color: C.b, marginTop: 4, fontWeight: 600 }}>
          DAILY BRIEF · {relativeTime(msg.timestamp)}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        marginBottom: 8,
        animation: 'copilotInlineMsgIn 0.3s ease forwards',
      }}
    >
      <div
        style={{
          maxWidth: '90%',
          padding: '6px 10px',
          borderRadius: isUser ? '10px 10px 3px 10px' : '10px 10px 10px 3px',
          background: isUser ? `linear-gradient(135deg, ${C.b}20, ${C.b}10)` : C.sf2,
          border: `1px solid ${isUser ? C.b + '25' : C.bd}`,
          fontSize: 12,
          lineHeight: 1.5,
          color: C.t1,
          wordBreak: 'break-word',
          whiteSpace: 'pre-wrap',
        }}
      >
        {isUser ? msg.content : parseMarkdown(msg.content)}
        {streaming && (
          <span
            style={{
              display: 'inline-block',
              width: 5,
              height: 12,
              background: C.b,
              marginLeft: 2,
              borderRadius: 1,
              animation: 'copilotInlineCursor 1s step-end infinite',
              verticalAlign: 'text-bottom',
            }}
          />
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2, fontSize: 9, color: C.t3 }}>
        <span>{relativeTime(msg.timestamp)}</span>
        {!isUser && msg.tier && (
          <span
            style={{
              padding: '1px 4px',
              borderRadius: 3,
              background: msg.tier === 'L1' ? C.g + '18' : C.p + '18',
              color: msg.tier === 'L1' ? C.g : C.p,
              fontSize: 8,
              fontWeight: 600,
            }}
          >
            {msg.tier}
          </span>
        )}
        {!isUser && msg.journalContext && (
          <span
            style={{
              padding: '1px 4px',
              borderRadius: 3,
              background: '#f59e0b18',
              color: '#f59e0b',
              fontSize: 8,
              fontWeight: 600,
              letterSpacing: 0.2,
            }}
          >
            📓 Journal
          </span>
        )}
        {/* Sprint 48: Feedback buttons */}
        {!isUser && !streaming && (
          <>
            <button
              onClick={() => useCopilotChat.getState().recordFeedback(msg.id, 'positive')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 10,
                padding: '0 2px',
                opacity: 0.5,
                color: C.t3,
              }}
              title="Helpful"
            >
              👍
            </button>
            <button
              onClick={() => useCopilotChat.getState().recordFeedback(msg.id, 'negative')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 10,
                padding: '0 2px',
                opacity: 0.5,
                color: C.t3,
              }}
              title="Not helpful"
            >
              👎
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default React.memo(MsgBubble);
