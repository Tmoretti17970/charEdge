// ═══════════════════════════════════════════════════════════════════
// charEdge — TypingDots (extracted from CopilotChatInline)
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { C } from '../../../../constants.js';
import AIOrb from '../design/AIOrb.jsx';

export default function TypingDots() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0', marginBottom: 6 }}>
      <AIOrb size={12} animate />
      <div style={{ display: 'flex', gap: 3 }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{
            width: 4, height: 4, borderRadius: '50%', background: C.t3,
            animation: `copilotInlineDot 1.2s ease ${i * 0.2}s infinite`,
          }} />
        ))}
      </div>
    </div>
  );
}
