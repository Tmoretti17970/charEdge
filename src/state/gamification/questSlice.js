// ═══════════════════════════════════════════════════════════════════
// charEdge — Quest Slice
//
// Multi-step quest definitions and progress evaluation.
// Extracted from useGamificationStore for composition.
// ═══════════════════════════════════════════════════════════════════

export const QUEST_DEFS = [
  {
    id: 'risk_manager',
    name: 'Risk Manager',
    description: 'Complete 5 trades with stop-loss set',
    emoji: '🛡️',
    xpReward: 200,
    steps: [
      { description: 'Set stop-loss on 1 trade', target: 1 },
      { description: 'Set stop-loss on 3 trades', target: 3 },
      { description: 'Set stop-loss on 5 trades', target: 5 },
    ],
    evaluate: (trades) => (trades || []).filter(t => t.stopLoss != null && t.stopLoss !== 0).length,
  },
  {
    id: 'strategy_explorer',
    name: 'Strategy Explorer',
    description: 'Trade with 3 different strategies',
    emoji: '🧭',
    xpReward: 150,
    steps: [
      { description: 'Use 1 strategy', target: 1 },
      { description: 'Use 2 strategies', target: 2 },
      { description: 'Use 3 strategies', target: 3 },
    ],
    evaluate: (trades) => new Set((trades || []).map(t => t.strategy).filter(Boolean)).size,
  },
  {
    id: 'journal_master',
    name: 'Journal Master',
    description: 'Write journal notes for 7 consecutive days',
    emoji: '📖',
    xpReward: 250,
    steps: [
      { description: 'Journal 1 day', target: 1 },
      { description: 'Journal 3 days', target: 3 },
      { description: 'Journal 7 days', target: 7 },
    ],
    evaluate: (_trades, state) => state.streaks?.journaling?.best || 0,
  },
  {
    id: 'volume_trader',
    name: 'Volume Trader',
    description: 'Log 50 total trades',
    emoji: '📈',
    xpReward: 175,
    steps: [
      { description: 'Log 10 trades', target: 10 },
      { description: 'Log 25 trades', target: 25 },
      { description: 'Log 50 trades', target: 50 },
    ],
    evaluate: (trades) => (trades || []).length,
  },
];

export const createQuestSlice = (set, get) => ({
  startQuest: (questId) => {
    if (get().activeQuests[questId] || get().completedQuests[questId]) return;
    const quest = QUEST_DEFS.find(q => q.id === questId);
    if (!quest) return;
    set({
      activeQuests: {
        ...get().activeQuests,
        [questId]: { step: 0, progress: 0, startedAt: Date.now() },
      },
    });
  },

  evaluateQuestProgress: (trades) => {
    if (!get().enabled) return;
    const state = get();
    const updated = { ...state.activeQuests };
    let changed = false;

    for (const [questId, questState] of Object.entries(updated)) {
      const def = QUEST_DEFS.find(q => q.id === questId);
      if (!def) continue;

      const progress = def.evaluate(trades, state);
      const currentStep = def.steps.findIndex(s => progress < s.target);
      const step = currentStep === -1 ? def.steps.length - 1 : currentStep;
      const completed = progress >= def.steps[def.steps.length - 1].target;

      if (progress !== questState.progress || step !== questState.step) {
        updated[questId] = { ...questState, progress, step };
        changed = true;
      }

      if (completed && !state.completedQuests[questId]) {
        delete updated[questId];
        set({
          completedQuests: { ...get().completedQuests, [questId]: Date.now() },
        });
        get().awardXP(def.xpReward, `quest_${questId}`);
        changed = true;
      }
    }

    if (changed) {
      set({ activeQuests: updated });
    }
  },
});
