// ═══════════════════════════════════════════════════════════════════
// charEdge — Scanner Responses Tests (Sprint 24)
// Updated Phase 2: classifyIntent now returns { intent, confidence }
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { classifyIntent } from '../../ai/AIRouter';

describe('Scanner Intent Classification', () => {
  it('classifies "scan" as scanner intent', () => {
    expect(classifyIntent('scan my watchlist')).toMatchObject({ intent: 'scanner' });
  });

  it('classifies "what looks good" as scanner intent', () => {
    expect(classifyIntent('what looks good right now')).toMatchObject({ intent: 'scanner' });
  });

  it('classifies "any opportunities" as scanner intent', () => {
    expect(classifyIntent('any opportunities right now?')).toMatchObject({ intent: 'scanner' });
  });

  it('classifies "top picks" as scanner intent', () => {
    expect(classifyIntent('top picks today')).toMatchObject({ intent: 'scanner' });
  });

  it('classifies "watchlist opportunities" as scanner intent', () => {
    expect(classifyIntent('watchlist opportunities')).toMatchObject({ intent: 'scanner' });
  });

  it('classifies "screener" as scanner intent', () => {
    expect(classifyIntent('run the screener')).toMatchObject({ intent: 'scanner' });
  });
});

describe('Risk Intent Classification', () => {
  it('classifies "how much am i risking" as risk intent', () => {
    expect(classifyIntent('how much am i risking')).toMatchObject({ intent: 'risk' });
  });

  it('classifies "my exposure" as risk intent', () => {
    expect(classifyIntent('my exposure')).toMatchObject({ intent: 'risk' });
  });

  it('classifies "portfolio risk" as risk intent', () => {
    expect(classifyIntent('portfolio risk')).toMatchObject({ intent: 'risk' });
  });

  it('classifies "my positions" as risk intent', () => {
    expect(classifyIntent('my positions')).toMatchObject({ intent: 'risk' });
  });
});

describe('Trade Grade Intent Classification', () => {
  it('classifies "grade my trade" as trade_grade intent', () => {
    expect(classifyIntent('grade my trade')).toMatchObject({ intent: 'trade_grade' });
  });

  it('classifies "how was my last trade" as trade_grade intent', () => {
    expect(classifyIntent('how was my last trade')).toMatchObject({ intent: 'trade_grade' });
  });

  it('classifies "trade score" as trade_grade intent', () => {
    expect(classifyIntent('trade score')).toMatchObject({ intent: 'trade_grade' });
  });

  it('classifies "rate my trade" as trade_grade intent', () => {
    expect(classifyIntent('rate my trade')).toMatchObject({ intent: 'trade_grade' });
  });

  it('classifies "trade report card" as trade_grade intent', () => {
    expect(classifyIntent('trade report card')).toMatchObject({ intent: 'trade_grade' });
  });
});
