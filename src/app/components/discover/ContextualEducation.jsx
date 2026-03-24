// ═══════════════════════════════════════════════════════════════════
// charEdge — Contextual Education Layer
//
// Sprint 17: Inline education system — teach while showing data.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useState } from 'react';
import { C } from '../../../constants.js';
import { alpha } from '@/shared/colorUtils';
import st from './ContextualEducation.module.css';

const TIPS = [
  {
    id: 1,
    category: 'technical',
    title: 'Understanding Moving Average Crossovers',
    tip: 'When a short-term MA (like the 9 EMA) crosses above a long-term MA (like the 21 EMA), it signals potential bullish momentum. This is called a "Golden Cross." The reverse is a "Death Cross."',
    example:
      'NVDA showed a 9/21 EMA Golden Cross on the 4H chart yesterday — it rallied 4.2% in the following 12 hours.',
    difficulty: 'beginner',
  },
  {
    id: 2,
    category: 'risk',
    title: 'The 1% Rule: Protecting Your Capital',
    tip: 'Never risk more than 1-2% of your total account on a single trade. Calculate position size by dividing your risk amount by the distance to your stop loss.',
    example: '$10,000 account × 1% risk = $100 max risk. If stop is $2 away, max position = 50 shares.',
    difficulty: 'beginner',
  },
  {
    id: 3,
    category: 'fundamental',
    title: 'Reading Insider Cluster Buys',
    tip: 'When multiple insiders (CEO, CFO, Directors) buy stock within a short window, it\'s called a "cluster buy." This is one of the strongest bullish signals — insiders collectively believe the stock is undervalued.',
    example:
      'JPM had 2 insiders buy $7.9M worth of stock this week. Historically, cluster buys lead to +12% avg returns over 6 months.',
    difficulty: 'intermediate',
  },
  {
    id: 4,
    category: 'psychology',
    title: 'Avoiding Revenge Trading',
    tip: 'After a loss, your brain seeks to "get it back" immediately. This leads to larger, riskier trades with less setup quality. The best traders walk away for 15 minutes after a loss before placing another trade.',
    example:
      'Pro tip: Set a rule — if you lose 2 trades in a row, take a 30-minute break. Journal your emotions before re-entering.',
    difficulty: 'beginner',
  },
  {
    id: 5,
    category: 'technical',
    title: 'IV Rank vs. IV Percentile',
    tip: 'IV Rank compares current IV to the 52-week high/low range. IV Percentile shows what % of days had lower IV than today. High IVR (>50) means options are relatively expensive — good for selling premium.',
    example:
      'TSLA has IVR of 85 ahead of earnings. Selling a put spread could benefit from the expected IV crush after the report.',
    difficulty: 'advanced',
  },
  {
    id: 6,
    category: 'risk',
    title: 'Correlation Risk in Your Portfolio',
    tip: "Holding 5 tech stocks doesn't mean you're diversified. If they're all 0.85+ correlated with each other, a tech selloff hits your entire portfolio. Check the Correlation Matrix widget to spot hidden risk.",
    example:
      'NVDA, AMD, and AVGO have 0.89 avg correlation — they move almost identically. Consider adding uncorrelated assets.',
    difficulty: 'intermediate',
  },
];

function getCategory(cat) {
  return {
    technical: { icon: '📐', color: '#38bdf8' },
    fundamental: { icon: '📊', color: C.g },
    risk: { icon: '🛡️', color: '#f0b64e' },
    psychology: { icon: '🧠', color: '#c084fc' },
  }[cat];
}
function getDifficulty(diff) {
  return {
    beginner: { label: '🟢 Beginner', color: C.g },
    intermediate: { label: '🟡 Intermediate', color: '#f0b64e' },
    advanced: { label: '🔴 Advanced', color: C.r },
  }[diff];
}

const QUIZ = {
  question: 'NVDA drops 5% on high volume but closes above its 50-day SMA. What do you do?',
  options: [
    { id: 'a', text: 'Short it — momentum is clearly bearish', correct: false },
    { id: 'b', text: "Buy the dip immediately — it's oversold", correct: false },
    { id: 'c', text: 'Wait for next day confirmation — watch if it holds the SMA', correct: true },
    { id: 'd', text: "Do nothing — it's not on my watchlist", correct: false },
  ],
  explanation:
    'A high-volume drop that still holds a key support level (50 SMA) is ambiguous. Waiting for confirmation reduces risk. If it bounces, you get a better entry with confirmation. If it breaks down, you avoided a loss.',
};

function ContextualEducation() {
  const [collapsed, setCollapsed] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizAnswer, setQuizAnswer] = useState(null);

  const tip = TIPS[tipIndex % TIPS.length];
  const cat = getCategory(tip.category);
  const diff = getDifficulty(tip.difficulty);

  const nextTip = () => {
    setTipIndex((i) => (i + 1) % TIPS.length);
  };
  const prevTip = () => {
    setTipIndex((i) => (i - 1 + TIPS.length) % TIPS.length);
  };

  return (
    <div style={{ background: C.bg2, border: `1px solid ${C.bd}`, borderRadius: 16, overflow: 'hidden' }}>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="tf-btn"
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>📚</span>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.t1, fontFamily: 'var(--tf-font)' }}>Trading Education</h3>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: C.cyan,
              background: alpha(C.cyan, 0.1),
              padding: '2px 7px',
              borderRadius: 4,
              fontFamily: 'var(--tf-mono)',
            }}
          >
            Tip {tipIndex + 1}/{TIPS.length}
          </span>
        </div>
        <span
          style={{
            color: C.t3,
            fontSize: 11,
            transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)',
            transition: 'transform 0.2s ease',
          }}
        >
          ▾
        </span>
      </button>

      {!collapsed && (
        <div style={{ padding: '0 20px 20px' }}>
          {/* Tab Toggle */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            <button
              onClick={() => setShowQuiz(false)}
              className="tf-btn"
              style={{
                padding: '5px 14px',
                borderRadius: 8,
                border: `1px solid ${!showQuiz ? C.b : 'transparent'}`,
                background: !showQuiz ? alpha(C.b, 0.08) : 'transparent',
                color: !showQuiz ? C.b : C.t3,
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 600,
                fontFamily: 'var(--tf-font)',
              }}
            >
              💡 Daily Tip
            </button>
            <button
              onClick={() => {
                setShowQuiz(true);
                setQuizAnswer(null);
              }}
              className="tf-btn"
              style={{
                padding: '5px 14px',
                borderRadius: 8,
                border: `1px solid ${showQuiz ? C.p : 'transparent'}`,
                background: showQuiz ? alpha(C.p, 0.08) : 'transparent',
                color: showQuiz ? C.p : C.t3,
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 600,
                fontFamily: 'var(--tf-font)',
              }}
            >
              🧩 Challenge
            </button>
          </div>

          {!showQuiz ? (
            /* Daily Tip */
            <div>
              <div
                style={{
                  padding: '16px',
                  background: alpha(cat.color, 0.04),
                  border: `1px solid ${alpha(cat.color, 0.12)}`,
                  borderRadius: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <span style={{ fontSize: 14 }}>{cat.icon}</span>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: cat.color,
                      background: alpha(cat.color, 0.1),
                      padding: '2px 6px',
                      borderRadius: 3,
                      fontFamily: 'var(--tf-font)',
                      textTransform: 'capitalize',
                    }}
                  >
                    {tip.category}
                  </span>
                  <span style={{ fontSize: 9, fontWeight: 600, color: diff.color, fontFamily: 'var(--tf-font)' }}>{diff.label}</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.t1, fontFamily: 'var(--tf-font)', marginBottom: 8 }}>
                  {tip.title}
                </div>
                <div style={{ fontSize: 12, color: C.t2, fontFamily: 'var(--tf-font)', lineHeight: 1.6, marginBottom: 10 }}>
                  {tip.tip}
                </div>
                <div
                  style={{
                    padding: '10px 12px',
                    background: alpha(C.sf, 0.5),
                    borderRadius: 8,
                    borderLeft: `3px solid ${cat.color}`,
                  }}
                >
                  <div style={{ fontSize: 9, fontWeight: 600, color: C.t3, fontFamily: 'var(--tf-font)', marginBottom: 3 }}>
                    💡 Real Example
                  </div>
                  <div style={{ fontSize: 11, color: C.t1, fontFamily: 'var(--tf-font)', lineHeight: 1.5 }}>{tip.example}</div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
                <button
                  onClick={prevTip}
                  className="tf-btn"
                  style={{
                    padding: '5px 12px',
                    borderRadius: 6,
                    background: 'transparent',
                    border: `1px solid ${C.bd}`,
                    color: C.t3,
                    cursor: 'pointer',
                    fontSize: 11,
                    fontFamily: 'var(--tf-font)',
                  }}
                >
                  ← Previous
                </button>
                <button
                  onClick={nextTip}
                  className="tf-btn"
                  style={{
                    padding: '5px 12px',
                    borderRadius: 6,
                    background: alpha(C.b, 0.08),
                    border: `1px solid ${C.b}`,
                    color: C.b,
                    cursor: 'pointer',
                    fontSize: 11,
                    fontWeight: 600,
                    fontFamily: 'var(--tf-font)',
                  }}
                >
                  Next Tip →
                </button>
              </div>
            </div>
          ) : (
            /* Quiz Challenge */
            <div>
              <div
                style={{
                  padding: '16px',
                  background: alpha(C.p, 0.04),
                  border: `1px solid ${alpha(C.p, 0.12)}`,
                  borderRadius: 10,
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 700, color: C.p, fontFamily: 'var(--tf-font)', marginBottom: 6 }}>
                  🧩 What Would You Do?
                </div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: C.t1,
                    fontFamily: 'var(--tf-font)',
                    lineHeight: 1.5,
                    marginBottom: 12,
                  }}
                >
                  {QUIZ.question}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {QUIZ.options.map((opt) => {
                    const selected = quizAnswer === opt.id;
                    const showResult = quizAnswer !== null;
                    const isCorrect = opt.correct;
                    const borderColor = showResult
                      ? isCorrect
                        ? C.g
                        : selected
                          ? C.r
                          : alpha(C.bd, 0.5)
                      : selected
                        ? C.b
                        : alpha(C.bd, 0.5);
                    return (
                      <button
                        key={opt.id}
                        onClick={() => !quizAnswer && setQuizAnswer(opt.id)}
                        className="tf-btn"
                        style={{
                          textAlign: 'left',
                          padding: '10px 12px',
                          borderRadius: 8,
                          border: `1px solid ${borderColor}`,
                          background:
                            showResult && isCorrect
                              ? alpha(C.g, 0.06)
                              : showResult && selected && !isCorrect
                                ? alpha(C.r, 0.06)
                                : alpha(C.sf, 0.4),
                          color: C.t1,
                          cursor: quizAnswer ? 'default' : 'pointer',
                          fontSize: 11,
                          fontFamily: 'var(--tf-font)',
                        }}
                      >
                        <span style={{ fontWeight: 700, color: C.t3, marginRight: 6 }}>{opt.id.toUpperCase()}.</span>
                        {opt.text}
                        {showResult && isCorrect && (
                          <span style={{ marginLeft: 8, color: C.g, fontWeight: 700 }}>✓</span>
                        )}
                        {showResult && selected && !isCorrect && (
                          <span style={{ marginLeft: 8, color: C.r, fontWeight: 700 }}>✗</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {quizAnswer && (
                  <div
                    style={{
                      marginTop: 12,
                      padding: '10px 12px',
                      background: alpha(C.g, 0.04),
                      borderRadius: 8,
                      borderLeft: `3px solid ${C.g}`,
                    }}
                  >
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.g, fontFamily: 'var(--tf-font)', marginBottom: 3 }}>
                      📖 Explanation
                    </div>
                    <div style={{ fontSize: 11, color: C.t2, fontFamily: 'var(--tf-font)', lineHeight: 1.5 }}>{QUIZ.explanation}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { ContextualEducation };

export default React.memo(ContextualEducation);
