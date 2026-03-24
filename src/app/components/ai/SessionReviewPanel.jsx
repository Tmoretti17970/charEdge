// ═══════════════════════════════════════════════════════════════════
// charEdge — Session Review Panel (Sprint 71)
//
// Dashboard widget showing the latest AI session review.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useCallback } from 'react';
import { C } from '../../../constants.js';
import AIStreamText from './AIStreamText.jsx';
import st from './SessionReviewPanel.module.css';

const ACCENT = '#6e5ce6';

export default function SessionReviewPanel() {
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const generateReview = useCallback(async () => {
    setLoading(true);
    try {
      const { aiSessionReview } = await import('../../../ai/AISessionReview');
      const result = await aiSessionReview.generate();
      setReview(result);
    } catch {
      setReview({ overview: 'Failed to generate review. Check API keys.', raw: '', tier: 'L1', timestamp: Date.now() });
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div style={{
      background: C.bg2 || C.bg,
      border: `1px solid ${C.bd}`,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>📋</span>
          <span style={{
            fontSize: 13,
            fontWeight: 700,
            fontFamily: 'var(--tf-font)',
            color: C.t1,
          }}>
            Session Review
          </span>
        </div>
        <button
          onClick={generateReview}
          disabled={loading}
          style={{
            padding: '4px 12px',
            borderRadius: 6,
            border: `1px solid ${ACCENT}40`,
            background: loading ? `${C.bd}20` : `${ACCENT}15`,
            color: ACCENT,
            fontSize: 10,
            fontFamily: 'var(--tf-mono)',
            cursor: loading ? 'wait' : 'pointer',
            transition: 'all 0.15s',
          }}
        >
          {loading ? '⏳ Generating...' : review ? '🔄 Refresh' : '✨ Generate'}
        </button>
      </div>

      {/* Content */}
      {!review && !loading && (
        <div style={{
          textAlign: 'center',
          padding: '12px 0',
          color: C.t3,
          fontSize: 11,
          fontFamily: 'var(--tf-mono)',
        }}>
          Click "Generate" after your trading session for an AI-powered review.
        </div>
      )}

      {review && (
        <div>
          <AIStreamText text={review.overview || review.raw} />

          {review.raw && (
            <>
              <button
                onClick={() => setExpanded(!expanded)}
                style={{
                  marginTop: 8,
                  padding: '3px 8px',
                  borderRadius: 4,
                  border: `1px solid ${C.bd}`,
                  background: 'transparent',
                  color: C.t3,
                  fontSize: 9,
                  fontFamily: 'var(--tf-mono)',
                  cursor: 'pointer',
                }}
              >
                {expanded ? '▾ Collapse' : '▸ Full Review'}
              </button>
              {expanded && (
                <div style={{ marginTop: 8 }}>
                  <AIStreamText text={review.raw} />
                </div>
              )}
            </>
          )}

          {review.tier && (
            <div style={{
              marginTop: 8,
              fontSize: 8,
              fontFamily: 'var(--tf-mono)',
              color: C.t3,
            }}>
              Via {review.tier} · {new Date(review.timestamp).toLocaleTimeString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
