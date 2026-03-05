import React, { useState, useEffect, useRef } from 'react';
import { C, F } from '../../../constants.js';

export default function AICopilotBar({ onCommand, onClose }) {
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', text: '' }
  const inputRef = useRef(null);

  // Focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Handle keyboard events (Escape to close, Enter to submit)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isProcessing || feedback) return;

    setIsProcessing(true);
    // Simulate slight network/processing delay for the AI feel
    setTimeout(() => {
      const result = onCommand(input.trim());
      setIsProcessing(false);

      if (result && result.success) {
        setFeedback({ type: 'success', text: result.message });
      } else {
        setFeedback({ type: 'error', text: result ? result.message : "I didn't understand that." });
      }

      // Briefly show the feedback before closing
      setTimeout(() => {
        setFeedback(null);
        setInput('');
        onClose();
      }, 1500);

    }, 400);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: '20%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 500,
        maxWidth: '90%',
        zIndex: 9999,
        background: C.bg,
        border: `1px solid ${C.bd}`,
        borderRadius: 12,
        boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'scaleInSm 0.2s ease-out',
      }}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', gap: 12 }}>
        <span style={{ fontSize: 18, color: C.b }}>✨</span>
        {feedback ? (
          <div style={{ flex: 1, color: feedback.type === 'error' ? C.r : C.g, fontFamily: F, fontSize: 16 }}>
            {feedback.text}
          </div>
        ) : (
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask AI to draw, add indicators, or change charts..."
            disabled={isProcessing}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: C.t1,
              fontFamily: F,
              fontSize: 16,
              outline: 'none',
            }}
          />
        )}

        {isProcessing && (
          <div
            style={{
              width: 16,
              height: 16,
              border: `2px solid ${C.bd}`,
              borderTopColor: C.b,
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
        )}
      </form>
      <div
        style={{
          padding: '8px 16px',
          background: C.sf2,
          borderTop: `1px solid ${C.bd}`,
          fontSize: 12,
          color: C.t3,
          fontFamily: F,
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>
          Try: <em>"Add RSI"</em>, <em>"Go to 15m"</em>, <em>"Chart TSLA"</em>
        </span>
        <span>
          <kbd style={{ background: C.bd, padding: '2px 6px', borderRadius: 4, marginRight: 4 }}>Esc</kbd>
          to close
        </span>
      </div>
    </div>
  );
}
