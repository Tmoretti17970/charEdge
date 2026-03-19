// ═══════════════════════════════════════════════════════════════════
// charEdge — ModelCTA (extracted from CopilotChatInline)
//
// Sprint 17: Inline prompt to download an LLM model.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { C, F, M } from '../../../../constants.js';

export default function ModelCTA({ onDownload, onDismiss, loading, progress }) {
  return (
    <div style={{
      margin: '6px 0', padding: '10px 12px', borderRadius: 10,
      background: `linear-gradient(135deg, ${C.b}08, ${C.p}06)`,
      border: `1px solid ${C.b}20`,
      animation: 'copilotInlineMsgIn 0.3s ease forwards',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.t1, fontFamily: F }}>
          ✨ Want smarter answers?
        </div>
        <button
          onClick={onDismiss}
          style={{ background: 'none', border: 'none', color: C.t3, fontSize: 10, cursor: 'pointer', padding: 2 }}
        >
          ✕
        </button>
      </div>
      <div style={{ fontSize: 10, color: C.t2, fontFamily: F, marginBottom: 8, lineHeight: 1.5 }}>
        Download SmolLM2 (80MB) for in-browser AI. Runs locally, no API key needed.
      </div>
      {loading ? (
        <div style={{ fontSize: 9, color: C.b, fontFamily: M }}>
          {progress || 'Downloading…'}
        </div>
      ) : (
        <button
          onClick={onDownload}
          className="tf-btn"
          style={{
            padding: '5px 14px', borderRadius: 6,
            border: 'none',
            background: `linear-gradient(135deg, ${C.b}, ${C.bH})`,
            color: '#fff', fontSize: 10, fontWeight: 600, fontFamily: F,
            cursor: 'pointer', transition: 'all 0.15s ease',
          }}
        >
          ⬇️ Download SmolLM2
        </button>
      )}
    </div>
  );
}
