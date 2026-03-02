// ═══════════════════════════════════════════════════════════════════
// charEdge — Feedback Widget
//
// Floating FAB (bottom-right) → slide-up modal with type picker,
// text input, and optional email. Saves to localStorage for now;
// future: wired to API endpoint.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { C, F, M } from '../../../constants.js';

// ─── Feedback Types ─────────────────────────────────────────────

export const FEEDBACK_TYPES = [
  { id: 'idea',    emoji: '💡', label: 'Idea',    description: 'Feature request or suggestion' },
  { id: 'bug',     emoji: '🐛', label: 'Bug',     description: 'Something isn\'t working right' },
  { id: 'general', emoji: '💬', label: 'General', description: 'Question, praise, or anything else' },
];

export const FEEDBACK_STORAGE_KEY = 'charedge-feedback';

// ─── Component ──────────────────────────────────────────────────

export default function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState(null);
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [fabHovered, setFabHovered] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const textareaRef = useRef(null);
  const panelRef = useRef(null);

  // Focus textarea when type is selected
  useEffect(() => {
    if (type && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [type]);

  // Escape key to close
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        reset();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const reset = useCallback(() => {
    setType(null);
    setMessage('');
    setEmail('');
    setSubmitted(false);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!type || !message.trim()) return;

    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      type,
      message: message.trim(),
      email: email.trim() || null,
      timestamp: new Date().toISOString(),
      version: '11.0.0',
      url: typeof window !== 'undefined' ? window.location.href : null,
    };

    // Store locally
    try {
      const existing = JSON.parse(localStorage.getItem(FEEDBACK_STORAGE_KEY) || '[]');
      existing.push(entry);
      localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(existing));
    } catch {
      // Storage full or unavailable — silently fail
    }

    setSubmitted(true);
    setTimeout(() => {
      setOpen(false);
      // Reset after close animation
      setTimeout(reset, 300);
    }, 1800);
  }, [type, message, email, reset]);

  const toggleOpen = useCallback(() => {
    if (open) {
      setOpen(false);
      reset();
    } else {
      setOpen(true);
    }
  }, [open, reset]);

  // Motion variants
  const panelVariants = prefersReducedMotion
    ? { hidden: { opacity: 0 }, visible: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        hidden: { opacity: 0, y: 20, scale: 0.95 },
        visible: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 400, damping: 30 } },
        exit: { opacity: 0, y: 10, scale: 0.97, transition: { duration: 0.15 } },
      };

  return (
    <>
      {/* ─── Backdrop ──────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { setOpen(false); reset(); }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.3)',
              zIndex: 9998,
            }}
          />
        )}
      </AnimatePresence>

      {/* ─── Panel ─────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            role="dialog"
            aria-modal="true"
            aria-label="Send feedback"
            style={{
              position: 'fixed',
              bottom: 80,
              right: 24,
              width: 360,
              maxWidth: 'calc(100vw - 48px)',
              maxHeight: 'calc(100vh - 120px)',
              background: C.sf,
              border: `1px solid ${C.bd}`,
              borderRadius: 16,
              padding: 24,
              zIndex: 9999,
              boxShadow: `0 16px 48px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.04) inset`,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              overflowY: 'auto',
            }}
          >
            {submitted ? (
              // ─── Success State ──────────────────────────────
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.t1, marginBottom: 6 }}>
                  Thank you!
                </div>
                <div style={{ fontSize: 13, color: C.t3 }}>
                  Your feedback has been recorded. We'll review it soon.
                </div>
              </div>
            ) : (
              <>
                {/* Header */}
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.t1, marginBottom: 4 }}>
                    Send Feedback
                  </div>
                  <div style={{ fontSize: 12, color: C.t3 }}>
                    Help us make charEdge better.
                  </div>
                </div>

                {/* Type Picker */}
                <div style={{ display: 'flex', gap: 8 }}>
                  {FEEDBACK_TYPES.map((ft) => (
                    <button
                      key={ft.id}
                      onClick={() => setType(ft.id)}
                      aria-pressed={type === ft.id}
                      aria-label={`${ft.label}: ${ft.description}`}
                      style={{
                        flex: 1,
                        padding: '10px 8px',
                        borderRadius: 10,
                        border: `1px solid ${type === ft.id ? C.b : C.bd}`,
                        background: type === ft.id ? `${C.b}12` : 'transparent',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ fontSize: 20, marginBottom: 4 }}>{ft.emoji}</div>
                      <div style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: type === ft.id ? C.b : C.t2,
                        fontFamily: F,
                      }}>
                        {ft.label}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Message */}
                <div>
                  <label
                    htmlFor="tf-feedback-msg"
                    style={{ fontSize: 11, fontWeight: 600, color: C.t3, display: 'block', marginBottom: 6 }}
                  >
                    Details {!type && <span style={{ fontWeight: 400, opacity: 0.6 }}>— pick a type first</span>}
                  </label>
                  <textarea
                    id="tf-feedback-msg"
                    ref={textareaRef}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    disabled={!type}
                    placeholder={
                      type === 'idea' ? 'Describe the feature you\'d like to see...'
                      : type === 'bug' ? 'What happened? What did you expect?'
                      : type === 'general' ? 'Tell us what\'s on your mind...'
                      : 'Select a feedback type above'
                    }
                    rows={4}
                    style={{
                      width: '100%',
                      resize: 'vertical',
                      background: C.bg2,
                      border: `1px solid ${C.bd}`,
                      borderRadius: 8,
                      padding: '10px 12px',
                      fontSize: 13,
                      fontFamily: F,
                      color: C.t1,
                      outline: 'none',
                      transition: 'border-color 0.15s',
                      opacity: type ? 1 : 0.5,
                      boxSizing: 'border-box',
                    }}
                    onFocus={(e) => { e.target.style.borderColor = C.b; }}
                    onBlur={(e) => { e.target.style.borderColor = C.bd; }}
                  />
                </div>

                {/* Optional Email */}
                <div>
                  <label
                    htmlFor="tf-feedback-email"
                    style={{ fontSize: 11, fontWeight: 600, color: C.t3, display: 'block', marginBottom: 6 }}
                  >
                    Email <span style={{ fontWeight: 400, opacity: 0.6 }}>— optional, for follow-up</span>
                  </label>
                  <input
                    id="tf-feedback-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    style={{
                      width: '100%',
                      background: C.bg2,
                      border: `1px solid ${C.bd}`,
                      borderRadius: 8,
                      padding: '8px 12px',
                      fontSize: 13,
                      fontFamily: F,
                      color: C.t1,
                      outline: 'none',
                      transition: 'border-color 0.15s',
                      boxSizing: 'border-box',
                    }}
                    onFocus={(e) => { e.target.style.borderColor = C.b; }}
                    onBlur={(e) => { e.target.style.borderColor = C.bd; }}
                  />
                </div>

                {/* Submit */}
                <button
                  onClick={handleSubmit}
                  disabled={!type || !message.trim()}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    borderRadius: 10,
                    border: 'none',
                    background: type && message.trim()
                      ? `linear-gradient(135deg, ${C.b}, ${C.y})`
                      : C.bd,
                    color: type && message.trim() ? '#fff' : C.t3,
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: F,
                    cursor: type && message.trim() ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s ease',
                    opacity: type && message.trim() ? 1 : 0.5,
                  }}
                >
                  Send Feedback
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── FAB ───────────────────────────────────────────── */}
      <button
        onClick={toggleOpen}
        onMouseEnter={() => setFabHovered(true)}
        onMouseLeave={() => setFabHovered(false)}
        aria-label={open ? 'Close feedback' : 'Send feedback'}
        aria-expanded={open}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          width: 48,
          height: 48,
          borderRadius: '50%',
          border: 'none',
          background: open
            ? C.r
            : fabHovered
              ? C.b
              : `linear-gradient(135deg, ${C.b}, ${C.y})`,
          color: '#fff',
          fontSize: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 9999,
          boxShadow: `0 4px 16px ${C.b}40`,
          transition: 'all 0.2s ease',
          transform: fabHovered ? 'scale(1.08)' : 'scale(1)',
        }}
      >
        {open ? '✕' : '💬'}
      </button>
    </>
  );
}
