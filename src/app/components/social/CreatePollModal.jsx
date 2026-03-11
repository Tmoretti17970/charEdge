// ═══════════════════════════════════════════════════════════════════
// charEdge — Create Poll Modal
//
// Lets users create their own prediction markets. Adds the poll
// to useSocialStore directly.
// ═══════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { C, F, M } from '../../../constants.js';
import { useSocialStore } from '../../../state/useSocialStore.js';
import { logger } from '@/observability/logger';
import { alpha } from '@/shared/colorUtils';

export default function CreatePollModal({ open, onClose }) {
  const polls = useSocialStore((s) => s.polls);
  const [question, setQuestion] = useState('');
  const [ticker, setTicker] = useState('');
  const [options, setOptions] = useState(['Yes', 'No']);
  const [expDays, setExpDays] = useState(30);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const addOption = () => {
    if (options.length < 4) setOptions([...options, '']);
  };

  const updateOption = (idx, val) => {
    const next = [...options];
    next[idx] = val;
    setOptions(next);
  };

  const removeOption = (idx) => {
    if (options.length > 2) setOptions(options.filter((_, i) => i !== idx));
  };

  const isValid =
    question.trim().length >= 10 &&
    options.every((o) => o.trim().length > 0) &&
    options.length >= 2;

  const handleSubmit = () => {
    if (!isValid) return;
    setSubmitting(true);

    const newPoll = {
      id: `poll_user_${Date.now()}`,
      category: 'crypto',
      question: question.trim(),
      ticker: ticker.trim().toUpperCase() || null,
      options: options.map((label, i) => ({
        id: `opt_${i}`,
        label: label.trim(),
        votes: 0,
      })),
      status: 'active',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + expDays * 24 * 60 * 60 * 1000).toISOString(),
    };

    // Directly mutate the store's polls array for mock
    useSocialStore.setState({ polls: [newPoll, ...polls] });

    setSubmitting(false);
    setQuestion('');
    setTicker('');
    setOptions(['Yes', 'No']);
    onClose();

    // Success feedback
    logger.ui.info('✅ Prediction market created!');
  };

  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      onClick={handleBackdrop}
      className="tf-modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: alpha(C.bg, 0.85),
        backdropFilter: 'blur(8px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        className="tf-fade-scale"
        style={{
          background: C.bg2,
          borderRadius: 20,
          border: `1px solid ${C.bd}`,
          width: '100%',
          maxWidth: 480,
          boxShadow: `0 24px 64px ${alpha(C.bg, 0.9)}`,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px 16px',
            borderBottom: `1px solid ${C.bd}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: C.t1, fontFamily: F }}>
              Create Prediction
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: C.t3 }}>
              Ask the community — let them vote
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 10,
              border: `1px solid ${C.bd}`, background: 'transparent',
              color: C.t2, cursor: 'pointer', fontSize: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Question */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.t3, fontFamily: F, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, display: 'block' }}>
              Question
            </label>
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. Will BTC hit $100k by the end of the year?"
              maxLength={120}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 10,
                border: `1px solid ${C.bd}`, background: C.bg, color: C.t1,
                fontSize: 14, fontFamily: F, fontWeight: 600, outline: 'none',
                boxSizing: 'border-box', transition: 'border-color 0.15s',
              }}
              onFocus={(e) => (e.target.style.borderColor = C.b)}
              onBlur={(e) => (e.target.style.borderColor = C.bd)}
            />
          </div>

          {/* Ticker (optional) */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.t3, fontFamily: F, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, display: 'block' }}>
              Ticker <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span>
            </label>
            <input
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              placeholder="e.g. BTCUSDT"
              maxLength={20}
              style={{
                width: 160, padding: '8px 12px', borderRadius: 8,
                border: `1px solid ${C.bd}`, background: C.bg, color: C.t1,
                fontSize: 12, fontFamily: M, fontWeight: 600, outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Options */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.t3, fontFamily: F, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, display: 'block' }}>
              Options
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {options.map((opt, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    value={opt}
                    onChange={(e) => updateOption(i, e.target.value)}
                    placeholder={`Option ${i + 1}`}
                    maxLength={50}
                    style={{
                      flex: 1, padding: '8px 12px', borderRadius: 8,
                      border: `1px solid ${C.bd}`, background: C.bg, color: C.t1,
                      fontSize: 13, fontFamily: F, outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                  {options.length > 2 && (
                    <button
                      onClick={() => removeOption(i)}
                      style={{
                        width: 28, height: 28, borderRadius: 6,
                        border: `1px solid ${C.bd}`, background: 'transparent',
                        color: C.t3, cursor: 'pointer', fontSize: 14,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              {options.length < 4 && (
                <button
                  onClick={addOption}
                  style={{
                    padding: '6px 12px', borderRadius: 8,
                    border: `1px dashed ${C.bd}`, background: 'transparent',
                    color: C.t3, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    fontFamily: F, transition: 'all 0.15s',
                  }}
                >
                  + Add Option
                </button>
              )}
            </div>
          </div>

          {/* Duration */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.t3, fontFamily: F, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, display: 'block' }}>
              Duration
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              {[7, 14, 30, 60, 90].map((d) => (
                <button
                  key={d}
                  onClick={() => setExpDays(d)}
                  style={{
                    padding: '5px 10px', borderRadius: 6,
                    border: `1px solid ${expDays === d ? C.b : C.bd}`,
                    background: expDays === d ? alpha(C.b, 0.12) : 'transparent',
                    color: expDays === d ? C.b : C.t2,
                    fontSize: 11, fontWeight: 700, fontFamily: M, cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px', borderTop: `1px solid ${C.bd}`,
            display: 'flex', justifyContent: 'flex-end', gap: 10,
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px', borderRadius: 10, border: `1px solid ${C.bd}`,
              background: 'transparent', color: C.t2, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: F,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            style={{
              padding: '10px 24px', borderRadius: 10, border: 'none',
              background: isValid ? C.p : C.sf, color: isValid ? '#fff' : C.t3,
              fontSize: 13, fontWeight: 700, cursor: isValid ? 'pointer' : 'not-allowed',
              fontFamily: F, opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? 'Creating...' : '🔮 Create Prediction'}
          </button>
        </div>
      </div>
    </div>
  );
}
