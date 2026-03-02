// ═══════════════════════════════════════════════════════════════════
// charEdge — Trade Grade Card
// Visual grade display for a single traded position.
// Shows letter grade, sub-category breakdown, and action items.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';

export default function TradeGradeCard({ gradeData, onClose }) {
  if (!gradeData) return null;

  const { overallGrade, overallScore, overallColor, categories, actionItems, isWin, pnl } = gradeData;

  return (
    <div className="tf-grade-card tf-fade-scale">
      {/* Header */}
      <div className="tf-grade-card__header">
        <div className="tf-grade-card__title">
          AI Trade Grade
          {onClose && (
            <button className="tf-grade-card__close" onClick={onClose}>✕</button>
          )}
        </div>

        <div className="tf-grade-card__hero" style={{ color: overallColor }}>
          <div className="tf-grade-card__letter">{overallGrade}</div>
          <div className="tf-grade-card__score">{overallScore}/100</div>
          <div className="tf-grade-card__pnl" style={{ color: isWin ? '#26A69A' : '#EF5350' }}>
            {isWin ? '✓ Winner' : '✗ Loser'} {pnl != null && `(${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)})`}
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="tf-grade-card__categories">
        {Object.entries(categories).map(([key, cat]) => (
          <CategoryBar key={key} name={key} grade={cat.grade} score={cat.score} color={cat.color} />
        ))}
      </div>

      {/* Feedback Details */}
      <div className="tf-grade-card__feedback">
        {Object.entries(categories).map(([key, cat]) => (
          cat.feedback.length > 0 && (
            <div key={key} className="tf-grade-feedback-section">
              <div className="tf-grade-feedback-section__title">
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </div>
              {cat.feedback.map((fb, i) => (
                <div key={i} className={`tf-grade-feedback-item tf-grade-feedback-item--${fb.type}`}>
                  <span className="tf-grade-feedback-item__icon">
                    {fb.type === 'good' ? '✓' : fb.type === 'improve' ? '↗' : 'ℹ'}
                  </span>
                  <span>{fb.text}</span>
                </div>
              ))}
            </div>
          )
        ))}
      </div>

      {/* Action Items */}
      {actionItems.length > 0 && (
        <div className="tf-grade-card__actions">
          <div className="tf-grade-card__actions-title">💡 What to Improve</div>
          {actionItems.map((item, i) => (
            <div key={i} className="tf-grade-action-item">
              <span className="tf-grade-action-item__num">{i + 1}</span>
              {item.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryBar({ name, grade, score, color }) {
  const labels = { entry: 'Entry Quality', risk: 'Risk Management', exit: 'Exit Timing', timing: 'Market Timing' };
  return (
    <div className="tf-grade-cat-bar">
      <div className="tf-grade-cat-bar__info">
        <span className="tf-grade-cat-bar__name">{labels[name] || name}</span>
        <span className="tf-grade-cat-bar__grade" style={{ color }}>{grade}</span>
      </div>
      <div className="tf-grade-cat-bar__track">
        <div
          className="tf-grade-cat-bar__fill"
          style={{ width: `${score}%`, background: color }}
        />
      </div>
    </div>
  );
}
