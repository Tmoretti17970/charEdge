// ═══════════════════════════════════════════════════════════════════
// charEdge — Quest Panel (Sprint D)
//
// Shows available, active, and completed trading quests.
// Multi-step guided missions that teach good habits.
// Rendered in Settings > Achievements and accessible via sidebar.
// ═══════════════════════════════════════════════════════════════════

import { memo } from 'react';
import { C, F, M } from '../../../constants.js';
import { useGamificationStore, QUEST_DEFS } from '../../../state/useGamificationStore';
import { Card, Btn } from '../ui/UIKit.jsx';
import { alpha } from '@/shared/colorUtils';

export const QuestPanel = memo(function QuestPanel() {
  const activeQuests = useGamificationStore((s) => s.activeQuests);
  const completedQuests = useGamificationStore((s) => s.completedQuests);
  const startQuest = useGamificationStore((s) => s.startQuest);
  const enabled = useGamificationStore((s) => s.enabled);

  if (!enabled) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {QUEST_DEFS.map((quest) => {
        const isActive = !!activeQuests[quest.id];
        const isCompleted = !!completedQuests[quest.id];
        const questState = activeQuests[quest.id];

        // Determine current step info
        let currentStep = null;
        let _pct = 0;
        if (isActive && questState) {
          const stepIdx = quest.steps.findIndex((s) => questState.progress < s.target);
          currentStep = stepIdx === -1 ? quest.steps[quest.steps.length - 1] : quest.steps[stepIdx];
          const maxTarget = quest.steps[quest.steps.length - 1].target;
           
          _pct = Math.min(100, Math.round((questState.progress / maxTarget) * 100));
        }

        return (
          <Card
            key={quest.id}
            style={{
              padding: 16,
              opacity: isCompleted ? 0.7 : 1,
              border: isActive
                ? `1px solid ${alpha('#007AFF', 0.3)}`
                : isCompleted
                  ? `1px solid ${alpha('#34C759', 0.2)}`
                  : undefined,
              background: isActive
                ? alpha('#007AFF', 0.03)
                : undefined,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              {/* Quest icon */}
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: isCompleted
                    ? alpha('#34C759', 0.12)
                    : isActive
                      ? alpha('#007AFF', 0.12)
                      : alpha(C.bd, 0.2),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  flexShrink: 0,
                }}
              >
                {isCompleted ? '✅' : quest.emoji}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Name + XP reward */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                  <div style={{
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: F,
                    color: C.t1,
                    textDecoration: isCompleted ? 'line-through' : 'none',
                  }}>
                    {quest.name}
                  </div>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    fontFamily: M,
                    color: isCompleted ? '#34C759' : '#007AFF',
                  }}>
                    {isCompleted ? '✓ Done' : `+${quest.xpReward} XP`}
                  </span>
                </div>

                {/* Description */}
                <div style={{ fontSize: 11, color: C.t3, marginBottom: isActive ? 8 : 4 }}>
                  {quest.description}
                </div>

                {/* Active quest: step indicators */}
                {isActive && questState && (
                  <>
                    {/* Steps */}
                    <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                      {quest.steps.map((step, i) => {
                        const done = questState.progress >= step.target;
                        const isCurrent = !done && (i === 0 || questState.progress >= quest.steps[i - 1].target);
                        return (
                          <div
                            key={i}
                            style={{
                              flex: 1,
                              height: 4,
                              borderRadius: 2,
                              background: done
                                ? '#34C759'
                                : isCurrent
                                  ? alpha('#007AFF', 0.4)
                                  : alpha(C.bd, 0.3),
                              transition: 'background 0.3s',
                            }}
                          />
                        );
                      })}
                    </div>

                    {/* Current step description */}
                    {currentStep && (
                      <div style={{ fontSize: 10, fontFamily: M, color: '#007AFF' }}>
                        → {currentStep.description} ({questState.progress}/{currentStep.target})
                      </div>
                    )}
                  </>
                )}

                {/* Start button for available quests */}
                {!isActive && !isCompleted && (
                  <Btn
                    onClick={() => startQuest(quest.id)}
                    style={{
                      fontSize: 11,
                      padding: '5px 12px',
                      marginTop: 6,
                      background: alpha('#007AFF', 0.1),
                      color: '#007AFF',
                      border: `1px solid ${alpha('#007AFF', 0.2)}`,
                    }}
                  >
                    Start Quest
                  </Btn>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
});

export default QuestPanel;
