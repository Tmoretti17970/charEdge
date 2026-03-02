// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — Post-Trade Review Modal (Sprint 3: B.3)
//
// Guided reflection after logging a new trade. Helps traders build
// self-awareness by prompting structured review of every trade.
//
// Flow: TradeFormModal submit → PostTradeReviewModal opens
//       → User answers guided prompts → review data stored on trade
//
// Data shape: trade.review = {
//   takeAgain: 'yes' | 'no' | 'unsure' | null,
//   lesson: string,
//   grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F',
//   followedPlan: boolean,
//   timestamp: ISO string,
// }
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { C, F, M } from '../../../constants.js';
import { ModalOverlay, Btn } from '../ui/UIKit.jsx';
import { fmtD } from '../../../utils.js';
import { gradeTrade } from '../../features/analytics/analyticsFast.js';
import { useJournalStore } from '../../../state/useJournalStore.js';
import toast from '../ui/Toast.jsx';

const GRADES = ['A+', 'A', 'B', 'C', 'D', 'F'];
const GRADE_COLORS = {
  'A+': '#10B981', A: '#10B981', B: '#6366F1',
  C: '#F59E0B', D: '#F97316', F: '#EF4444',
};

const TAKE_AGAIN_OPTIONS = [
  { value: 'yes', emoji: '✅', label: 'Yes' },
  { value: 'no', emoji: '❌', label: 'No' },
  { value: 'unsure', emoji: '🤔', label: 'Unsure' },
];

export default function PostTradeReviewModal({ isOpen, onClose, trade }) {
  const updateTrade = useJournalStore((s) => s.updateTrade);

  // Auto-grade from analyticsFast
  const autoGrade = trade ? gradeTrade(trade) : { grade: '?', score: 0 };

  const [takeAgain, setTakeAgain] = useState(null);
  const [lesson, setLesson] = useState('');
  const [grade, setGrade] = useState(autoGrade.grade);
  const [followedPlan, setFollowedPlan] = useState(true);

  // Reset when a new trade opens
  useEffect(() => {
    if (isOpen && trade) {
      const ag = gradeTrade(trade);
      setGrade(ag.grade === '?' ? 'B' : ag.grade);
      setTakeAgain(null);
      setLesson('');
      setFollowedPlan(!trade.ruleBreak);
    }
  }, [isOpen, trade]);

  if (!trade) return null;

  function handleSubmit() {
    const review = {
      takeAgain,
      lesson: lesson.trim(),
      grade,
      followedPlan,
      timestamp: new Date().toISOString(),
    };

    updateTrade(trade.id, { ...trade, review, followedRules: followedPlan });
    toast.success('Trade review saved — +15 XP 🎯');
    onClose();
  }

  function handleSkip() {
    toast('Review skipped — no XP awarded', { icon: '⏭️' });
    onClose();
  }

  const isLoss = trade.pnl < 0;

  return (
    <ModalOverlay isOpen={isOpen} onClose={handleSkip} width={440}>
      <div style={{ padding: 2 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>
            {isLoss ? '📝' : '🎯'}
          </div>
          <h2 style={{
            fontSize: 16, fontWeight: 800, fontFamily: F, color: C.t1, margin: 0,
          }}>
            Post-Trade Review
          </h2>
          <div style={{
            fontSize: 12, color: C.t3, fontFamily: M, marginTop: 4,
          }}>
            {trade.symbol} {trade.side.toUpperCase()} ·{' '}
            <span style={{ color: trade.pnl >= 0 ? C.g : C.r, fontWeight: 700 }}>
              {fmtD(trade.pnl)}
            </span>
          </div>
        </div>

        {/* Would you take this again? */}
        <div style={{ marginBottom: 16 }}>
          <label style={{
            display: 'block', fontSize: 11, fontWeight: 700, color: C.t2,
            fontFamily: M, marginBottom: 6,
          }}>
            Would you take this trade again?
          </label>
          <div style={{ display: 'flex', gap: 6 }}>
            {TAKE_AGAIN_OPTIONS.map((opt) => (
              <button
                className="tf-btn"
                key={opt.value}
                onClick={() => setTakeAgain(opt.value)}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  borderRadius: 8,
                  border: `1px solid ${takeAgain === opt.value ? C.b : C.bd}`,
                  background: takeAgain === opt.value ? C.b + '18' : 'transparent',
                  color: takeAgain === opt.value ? C.t1 : C.t3,
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {opt.emoji} {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Execution Grade */}
        <div style={{ marginBottom: 16 }}>
          <label style={{
            display: 'block', fontSize: 11, fontWeight: 700, color: C.t2,
            fontFamily: M, marginBottom: 6,
          }}>
            Execution Grade
            <span style={{
              fontSize: 9, color: C.t3, fontWeight: 400, marginLeft: 6,
            }}>
              (auto: {autoGrade.grade})
            </span>
          </label>
          <div style={{ display: 'flex', gap: 4 }}>
            {GRADES.map((g) => (
              <button
                className="tf-btn"
                key={g}
                onClick={() => setGrade(g)}
                style={{
                  flex: 1,
                  padding: '8px 0',
                  borderRadius: 6,
                  border: `1px solid ${grade === g ? GRADE_COLORS[g] : C.bd}`,
                  background: grade === g ? GRADE_COLORS[g] + '20' : 'transparent',
                  color: grade === g ? GRADE_COLORS[g] : C.t3,
                  fontSize: 12, fontWeight: 800, cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  fontFamily: M,
                }}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Followed Plan */}
        <div style={{ marginBottom: 16 }}>
          <label style={{
            display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
            fontSize: 12, color: followedPlan ? C.g : C.r,
          }}>
            <input
              type="checkbox"
              checked={followedPlan}
              onChange={(e) => setFollowedPlan(e.target.checked)}
              style={{ accentColor: followedPlan ? C.g : C.r }}
            />
            <span style={{ fontWeight: 600 }}>
              {followedPlan ? '✅ Followed my trading plan' : '⚠️ Deviated from plan'}
            </span>
          </label>
        </div>

        {/* What did you learn? */}
        <div style={{ marginBottom: 20 }}>
          <label style={{
            display: 'block', fontSize: 11, fontWeight: 700, color: C.t2,
            fontFamily: M, marginBottom: 6,
          }}>
            What did you learn? <span style={{ fontSize: 9, color: C.t3, fontWeight: 400 }}>(optional)</span>
          </label>
          <textarea
            value={lesson}
            onChange={(e) => setLesson(e.target.value)}
            placeholder={isLoss
              ? 'What could you have done differently?'
              : 'What made this trade work?'}
            rows={3}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 8,
              border: `1px solid ${C.bd}`,
              background: C.bg2,
              color: C.t1,
              fontSize: 12,
              fontFamily: M,
              resize: 'vertical',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
          <Btn variant="ghost" onClick={handleSkip}>
            Skip Review
          </Btn>
          <Btn onClick={handleSubmit}>
            Save Review (+15 XP)
          </Btn>
        </div>
      </div>
    </ModalOverlay>
  );
}

export { PostTradeReviewModal };
