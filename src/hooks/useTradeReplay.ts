// ═══════════════════════════════════════════════════════════════════
// charEdge — useTradeReplay Hook (Sprint 77)
//
// React hook wrapping TradeReplayEngine for component state.
// ═══════════════════════════════════════════════════════════════════

import { useState, useRef, useCallback, useEffect } from 'react';
import type { ReplaySession, ReplayBar } from '../ai/TradeReplayEngine';

interface ReplayState {
  isActive: boolean;
  isPlaying: boolean;
  currentIdx: number;
  totalBars: number;
  entryIdx: number;
  exitIdx: number;
  speed: number;
  commentary: Record<string, string>;
}

export function useTradeReplay() {
  const [state, setState] = useState<ReplayState>({
    isActive: false,
    isPlaying: false,
    currentIdx: 0,
    totalBars: 0,
    entryIdx: 0,
    exitIdx: 0,
    speed: 200,
    commentary: {},
  });

  const sessionRef = useRef<ReplaySession | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startReplay = useCallback(async (trade: Record<string, unknown>, bars: ReplayBar[]) => {
    const { tradeReplayEngine } = await import('../ai/TradeReplayEngine');
    const session = tradeReplayEngine.createSession(trade, bars);
    sessionRef.current = session;

    setState({
      isActive: true,
      isPlaying: false,
      currentIdx: session.currentIdx,
      totalBars: bars.length,
      entryIdx: session.entryIdx,
      exitIdx: session.exitIdx,
      speed: session.speed,
      commentary: {},
    });
  }, []);

  const step = useCallback((delta = 1) => {
    const session = sessionRef.current;
    if (!session) return;
    session.step(delta);
    setState(s => ({ ...s, currentIdx: session.currentIdx }));
  }, []);

  const play = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;

    setState(s => ({ ...s, isPlaying: true }));
    tickRef.current = setInterval(() => {
      session.step();
      setState(s => {
        if (session.currentIdx >= session.exitIdx + 10) {
          pause();
          return { ...s, currentIdx: session.currentIdx, isPlaying: false };
        }
        return { ...s, currentIdx: session.currentIdx };
      });
    }, session.speed);
  }, []);

  const pause = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    setState(s => ({ ...s, isPlaying: false }));
  }, []);

  const setSpeed = useCallback((ms: number) => {
    const session = sessionRef.current;
    if (!session) return;
    session.speed = ms;
    setState(s => ({ ...s, speed: ms }));
    if (state.isPlaying) {
      pause();
      play();
    }
  }, [state.isPlaying, pause, play]);

  const getCommentary = useCallback(async (point: 'entry' | 'midpoint' | 'exit' | 'hindsight') => {
    const session = sessionRef.current;
    if (!session) return '';
    const text = await session.getCommentary(point);
    setState(s => ({ ...s, commentary: { ...s.commentary, [point]: text } }));
    return text;
  }, []);

  const stopReplay = useCallback(() => {
    pause();
    sessionRef.current = null;
    setState({
      isActive: false,
      isPlaying: false,
      currentIdx: 0,
      totalBars: 0,
      entryIdx: 0,
      exitIdx: 0,
      speed: 200,
      commentary: {},
    });
  }, [pause]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  return {
    ...state,
    startReplay,
    step,
    play,
    pause,
    setSpeed,
    getCommentary,
    stopReplay,
  };
}

export default useTradeReplay;
