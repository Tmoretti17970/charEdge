// ═══════════════════════════════════════════════════════════════════
// charEdge — useBootEffects
//
// Post-mount side effects extracted from App.jsx:
//   1. Theme hydration + animation budget + crash recovery
//   2. Supabase auth listener
//   3. Gamification ↔ journal subscriber
//
// These are *render-independent* effects that don't produce UI.
// App.jsx should only handle layout/routing.
// ═══════════════════════════════════════════════════════════════════

import { useEffect } from 'react';
import { processPendingAchievements } from '../app/components/ui/AchievementToast.jsx';
import { useAuthStore } from '../state/useAuthStore.js';
import { useGamificationStore, XP_TABLE } from '../state/useGamificationStore';
import { useJournalStore } from '../state/useJournalStore';
import { useUIStore } from '../state/useUIStore';
import { useUserStore } from '../state/useUserStore';
import { animationBudget } from '@/charting_library/utils/AnimationBudget.js';

// ─── Sub-hook 1: Theme + Animation Budget + Session Recovery ────

function useThemeInit() {
  useEffect(() => {
    useUserStore.getState().hydrate();
    useUserStore.getState().init();
    animationBudget.start();

    // Task 2.3.23: Check for crash recovery state on boot
    let recoveryHandled = false;
    import('../charting_library/core/SessionRecovery.js').then(({ getRecoveryState, clearRecoveryState }) => {
      if (recoveryHandled) return;
      recoveryHandled = true;
      getRecoveryState().then((recovery) => {
        if (!recovery) return;
        import('../app/components/ui/Toast.jsx').then(({ default: toast }) => {
          toast.action(
            `💾 Restore session? (${recovery.symbol} ${recovery.timeframe})`,
            'Restore →',
            async () => {
              const { useChartCoreStore } = await import('../state/chart/useChartCoreStore');
              const { useChartToolsStore } = await import('../state/chart/useChartToolsStore');
              if (recovery.symbol) useChartCoreStore.getState().setSymbol(recovery.symbol);
              if (recovery.timeframe) useChartCoreStore.getState().setTf(recovery.timeframe);
              if (recovery.chartType) useChartCoreStore.getState().setChartType(recovery.chartType);
              if (recovery.indicators?.length) {
                const existing = useChartToolsStore.getState().indicators || [];
                for (const ind of existing) useChartToolsStore.getState().removeIndicator(ind.id);
                for (const ind of recovery.indicators) useChartToolsStore.getState().addIndicator(ind);
              }
              if (recovery.page) useUIStore.getState().setPage(recovery.page);
              clearRecoveryState();
            },
            { type: 'info', duration: 12000 },
          );
          setTimeout(() => clearRecoveryState(), 15000);
        }).catch(() => { /* Toast import is best-effort */ });
      }).catch(() => { /* recovery check is best-effort */ });
    }).catch(() => { /* SessionRecovery import is best-effort */ });

    return () => animationBudget.stop();
  }, []);
}

// ─── Sub-hook 2: Auth Listener ──────────────────────────────────

function useAuthInit() {
  useEffect(() => {
    const unsubscribe = useAuthStore.getState().initialize();
    return unsubscribe;
  }, []);
}

// ─── Sub-hook 3: Gamification ↔ Journal Subscriber ──────────────

function useGamificationSync() {
  useEffect(() => {
    const unsub = useJournalStore.subscribe((state, prevState) => {
      if (!state.loaded || !useGamificationStore.getState().enabled) return;
      const trades = state.trades;
      const prevTrades = prevState.trades;

      // Award XP for new trades
      if (trades.length > prevTrades.length) {
        const newCount = trades.length - prevTrades.length;
        for (let i = 0; i < newCount; i++) {
          useGamificationStore.getState().awardXP(XP_TABLE.trade_logged, 'trade_logged');
          const trade = trades[trades.length - newCount + i];
          if (trade && trade.notes && trade.notes.trim().length > 10) {
            useGamificationStore.getState().awardXP(XP_TABLE.notes_written, 'notes_written');
          }
        }

        // Sprint 16: First-trade celebration 🎉
        if (prevTrades.length === 0 && trades.length >= 1) {
          import('../state/useUserStore.js').then((mod) => {
            const onboarding = mod.useUserStore;
            if (!onboarding.getState().isDiscovered('first_trade')) {
              onboarding.getState().markDiscovered('first_trade');
              import('../app/components/ui/Toast.jsx').then(({ default: toast }) => {
                toast.success('🎉 First trade logged! You\'re on your way.', {
                  duration: 6000,
                });
                setTimeout(() => {
                  toast.action(
                    '📊 View your analytics',
                    'Go to Dashboard →',
                    () => useUIStore.getState().setPage('journal'),
                    { type: 'info', duration: 8000 },
                  );
                }, 2000);
              }).catch(() => { }); // intentional: Toast import is best-effort UI
            }
          }).catch(() => { }); // intentional: dynamic import is best-effort
        }
      }

      // Update streaks + evaluate achievements + update daily challenge
      useGamificationStore.getState().updateStreaks(trades);
      useGamificationStore.getState().evaluateAchievements(trades);
      useGamificationStore.getState().updateChallengeProgress(trades);

      // Show achievement toasts (if notifications enabled)
      if (useGamificationStore.getState().notificationPrefs.achievements) {
        processPendingAchievements(
          useGamificationStore.getState().consumePendingAchievements,
        );
      } else {
        useGamificationStore.getState().consumePendingAchievements();
      }

      // Sprint C: Evaluate milestones
      useGamificationStore.getState().evaluateMilestones(trades);

      // Sprint D: Weekly challenge + quest progress
      useGamificationStore.getState().updateWeeklyChallengeProgress(trades);
      useGamificationStore.getState().evaluateQuestProgress(trades);
    });
    return unsub;
  }, []);
}

// ─── Main Hook ──────────────────────────────────────────────────

/**
 * Consolidates all post-mount side effects that App.jsx doesn't need
 * to know about. Call once in App component body.
 */
export function useBootEffects() {
  useThemeInit();
  useAuthInit();
  useGamificationSync();
}
