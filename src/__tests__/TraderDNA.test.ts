// ═══════════════════════════════════════════════════════════════════
// charEdge — TraderDNA Tests (AI Copilot Sprint 5)
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock UserProfileStore before importing TraderDNA
const mockProfile: Record<string, unknown> = {};

vi.mock('../ai/UserProfileStore', () => ({
  userProfileStore: {
    getProfile: () => mockProfile,
    getSummaryForAI: () => 'mock summary',
  },
}));

import { TraderDNA } from '../ai/TraderDNA';

describe('TraderDNA', () => {
  let dna: TraderDNA;

  beforeEach(() => {
    // Reset mock profile
    Object.keys(mockProfile).forEach(k => delete mockProfile[k]);
    dna = new TraderDNA();
  });

  it('classifies scalper by short hold time', () => {
    Object.assign(mockProfile, {
      avgHoldMinutes: 10,
      winRate: 55,
      totalTrades: 100,
    });
    const result = dna.generateDNA();
    expect(result.archetype).toBe('scalper');
    expect(result.archetypeLabel).toBe('Scalper');
  });

  it('classifies day trader by medium hold time', () => {
    Object.assign(mockProfile, {
      avgHoldMinutes: 120,
      winRate: 50,
      totalTrades: 50,
    });
    expect(dna.getTraderArchetype()).toBe('day_trader');
  });

  it('classifies swing trader by long hold time', () => {
    Object.assign(mockProfile, { avgHoldMinutes: 2000 });
    expect(dna.getTraderArchetype()).toBe('swing_trader');
  });

  it('classifies by tradingStyle string', () => {
    Object.assign(mockProfile, { tradingStyle: 'position trading' });
    expect(dna.getTraderArchetype()).toBe('position_trader');
  });

  it('defaults to mixed when no data', () => {
    expect(dna.getTraderArchetype()).toBe('mixed');
  });

  it('extracts strengths from high win rate', () => {
    Object.assign(mockProfile, { winRate: 65, totalTrades: 50 });
    const strengths = dna.getStrengths();
    expect(strengths.some(s => s.includes('win rate'))).toBe(true);
  });

  it('extracts weaknesses from low win rate', () => {
    Object.assign(mockProfile, { winRate: 40, totalTrades: 50 });
    const weaknesses = dna.getWeaknesses();
    expect(weaknesses.some(w => w.includes('win rate'))).toBe(true);
  });

  it('extracts best setup from setupStats', () => {
    Object.assign(mockProfile, {
      winRate: 55, totalTrades: 20, avgHoldMinutes: 30,
      setupStats: {
        breakout: { winRate: 75, count: 10 },
        reversal: { winRate: 30, count: 5 },
      },
    });
    const result = dna.generateDNA();
    expect(result.bestSetup).toBe('breakout');
    expect(result.worstSetup).toBe('reversal');
  });

  it('detects tilt trigger', () => {
    Object.assign(mockProfile, {
      winRate: 50, totalTrades: 30, avgHoldMinutes: 25,
      tiltScore: 70, tiltThreshold: 3,
    });
    const result = dna.generateDNA();
    expect(result.tiltTrigger).toBe('3 consecutive losses');
  });

  it('generates summary string', () => {
    Object.assign(mockProfile, {
      winRate: 58, totalTrades: 100, avgHoldMinutes: 12,
      tradingStyle: 'scalping',
    });
    const result = dna.generateDNA();
    expect(result.summary).toContain('Scalper');
    expect(result.summary).toContain('58%');
    expect(result.summary).toContain('100 trades');
    expect(result.summary).toContain('avg hold: 12min');
  });

  it('getDNAForPrompt returns empty when insufficient trades', () => {
    Object.assign(mockProfile, { totalTrades: 1 });
    expect(dna.getDNAForPrompt()).toBe('');
  });

  it('getDNAForPrompt returns formatted string with enough data', () => {
    Object.assign(mockProfile, {
      winRate: 55, totalTrades: 50, avgHoldMinutes: 30,
    });
    const prompt = dna.getDNAForPrompt();
    expect(prompt).toContain('--- Trader DNA ---');
    expect(prompt.length).toBeGreaterThan(20);
  });

  it('classifies risk profile', () => {
    Object.assign(mockProfile, {
      winRate: 50, totalTrades: 20, avgHoldMinutes: 30,
      positionSizeVariance: 0.1,
    });
    const result = dna.generateDNA();
    expect(result.riskProfile).toBe('conservative');
  });
});
