// ═══════════════════════════════════════════════════════════════════
// charEdge — NPS Survey
//
// Phase 6 Task 6.2.5: Net Promoter Score survey component.
// Auto-triggers monthly, dismissable, with optional comment.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, memo, useCallback } from 'react';
import { logger } from '@/observability/logger';

const STORAGE_KEY = 'charedge_nps_last';
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

const NPSSurvey = memo(function NPSSurvey({ onSubmit }) {
  const [visible, setVisible] = useState(false);
  const [score, setScore] = useState(null);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const last = localStorage.getItem(STORAGE_KEY);
    if (!last || Date.now() - parseInt(last, 10) > THIRTY_DAYS) {
      // Delay showing by 60s to not interrupt flow
      const t = setTimeout(() => setVisible(true), 60_000);
      return () => clearTimeout(t);
    }
  }, []);

  const dismiss = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
    setVisible(false);
  }, []);

  const handleSubmit = useCallback(() => {
    if (score === null) return;
    const data = { score, comment: comment.trim() || undefined, timestamp: Date.now() };

    if (onSubmit) {
      onSubmit(data);
    } else {
      logger.ui.info('[NPS] Survey submitted:', data);
    }

    localStorage.setItem(STORAGE_KEY, String(Date.now()));
    setSubmitted(true);
    setTimeout(() => setVisible(false), 2000);
  }, [score, comment, onSubmit]);

  if (!visible) return null;

  return (
    <div style={bannerStyle} role="dialog" aria-label="NPS Survey">
      {submitted ? (
        <p style={{ textAlign: 'center', color: 'var(--tf-green)', fontWeight: 600 }}>
          Thank you for your feedback! 🎉
        </p>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 'var(--tf-fs-base)' }}>
              How likely are you to recommend charEdge?
            </p>
            <button onClick={dismiss} style={dismissStyle} aria-label="Dismiss">
              ✕
            </button>
          </div>

          <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginBottom: 12 }}>
            {Array.from({ length: 11 }, (_, i) => (
              <button
                key={i}
                onClick={() => setScore(i)}
                aria-label={`Score ${i}`}
                style={{
                  ...scoreBtn,
                  background:
                    score === i
                      ? i <= 6
                        ? 'var(--tf-red)'
                        : i <= 8
                          ? 'var(--tf-yellow)'
                          : 'var(--tf-green)'
                      : 'var(--tf-sf)',
                  color: score === i ? '#fff' : 'var(--tf-t2)',
                }}
              >
                {i}
              </button>
            ))}
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 'var(--tf-fs-xs)',
              color: 'var(--tf-t3)',
              marginBottom: 12,
            }}
          >
            <span>Not likely</span>
            <span>Very likely</span>
          </div>

          {score !== null && (
            <>
              <textarea
                placeholder="Any additional feedback? (optional)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                style={textareaStyle}
              />
              <button onClick={handleSubmit} style={submitStyle}>
                Submit
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
});

const bannerStyle = {
  position: 'fixed',
  bottom: 16,
  right: 16,
  zIndex: 'var(--tf-z-toast)',
  background: 'var(--tf-bg2)',
  borderRadius: 'var(--tf-radius-md)',
  border: '1px solid var(--tf-bd)',
  padding: 16,
  maxWidth: 400,
  width: '90vw',
  boxShadow: 'var(--tf-shadow-3)',
  animation: 'fadeInUp 250ms ease-out',
};

const scoreBtn = {
  width: 32,
  height: 32,
  border: '1px solid var(--tf-bd)',
  borderRadius: 'var(--tf-radius-xs)',
  cursor: 'pointer',
  fontSize: 'var(--tf-fs-xs)',
  fontWeight: 600,
  transition: 'all 150ms ease',
};

const dismissStyle = {
  background: 'none',
  border: 'none',
  color: 'var(--tf-t3)',
  fontSize: 16,
  cursor: 'pointer',
  padding: 4,
};

const textareaStyle = {
  width: '100%',
  background: 'var(--tf-bg)',
  border: '1px solid var(--tf-bd)',
  borderRadius: 'var(--tf-radius-sm)',
  padding: 8,
  color: 'var(--tf-t1)',
  fontSize: 'var(--tf-fs-sm)',
  resize: 'vertical',
  marginBottom: 8,
  fontFamily: 'inherit',
};

const submitStyle = {
  width: '100%',
  padding: '8px 16px',
  background: 'var(--tf-info)',
  color: '#fff',
  border: 'none',
  borderRadius: 'var(--tf-radius-sm)',
  fontSize: 'var(--tf-fs-sm)',
  fontWeight: 600,
  cursor: 'pointer',
};

export default NPSSurvey;
