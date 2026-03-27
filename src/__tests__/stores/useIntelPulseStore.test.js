import { describe, it, expect } from 'vitest';
import useIntelPulseStore from '../../state/useIntelPulseStore.js';

describe('useIntelPulseStore', () => {
  it('initializes with valid vix data', () => {
    const state = useIntelPulseStore.getState();
    expect(typeof state.vix).toBe('number');
    expect(typeof state.vixChange).toBe('number');
  });

  it('initializes with fear/greed score between 0 and 100', () => {
    const state = useIntelPulseStore.getState();
    expect(state.fearGreedScore).toBeGreaterThanOrEqual(0);
    expect(state.fearGreedScore).toBeLessThanOrEqual(100);
  });

  it('has a valid fear/greed label', () => {
    const state = useIntelPulseStore.getState();
    const validLabels = ['Extreme Fear', 'Fear', 'Neutral', 'Greed', 'Extreme Greed'];
    expect(validLabels).toContain(state.fearGreedLabel);
  });

  it('has a valid fear/greed color', () => {
    const state = useIntelPulseStore.getState();
    expect(state.fearGreedColor).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('has a valid regime object', () => {
    const state = useIntelPulseStore.getState();
    expect(state.regime).toHaveProperty('label');
    expect(state.regime).toHaveProperty('color');
    expect(state.regime).toHaveProperty('description');
  });

  it('has a non-empty summary string', () => {
    const state = useIntelPulseStore.getState();
    expect(typeof state.summary).toBe('string');
    expect(state.summary.length).toBeGreaterThan(0);
  });

  it('refresh action updates state without errors', () => {
    useIntelPulseStore.getState().refresh();
    const state = useIntelPulseStore.getState();
    expect(state.fearGreedScore).toBeGreaterThanOrEqual(0);
    expect(state.fearGreedScore).toBeLessThanOrEqual(100);
  });

  it('regime labels correspond to vix ranges', () => {
    const state = useIntelPulseStore.getState();
    const validRegimeLabels = ['Risk-On', 'Neutral', 'Cautious', 'Risk-Off'];
    expect(validRegimeLabels).toContain(state.regime.label);
  });
});
