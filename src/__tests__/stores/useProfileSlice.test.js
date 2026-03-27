import { describe, it, expect } from 'vitest';
import {
  AVATAR_OPTIONS,
  EXPERIENCE_LEVELS,
  MARKET_OPTIONS,
  TRADING_STYLES,
  calcCompleteness,
  createProfileSlice,
} from '../../state/user/profileSlice.js';

describe('profileSlice', () => {
  // ─── Constants ──────────────────────────────────────────────
  describe('constants', () => {
    it('AVATAR_OPTIONS has emoji options', () => {
      expect(AVATAR_OPTIONS.length).toBeGreaterThan(5);
      expect(AVATAR_OPTIONS).toContain('🔥');
    });

    it('EXPERIENCE_LEVELS has id and label', () => {
      expect(EXPERIENCE_LEVELS.length).toBeGreaterThan(0);
      for (const level of EXPERIENCE_LEVELS) {
        expect(level).toHaveProperty('id');
        expect(level).toHaveProperty('label');
        expect(level).toHaveProperty('hint');
      }
    });

    it('MARKET_OPTIONS covers major asset classes', () => {
      const ids = MARKET_OPTIONS.map((m) => m.id);
      expect(ids).toContain('stocks');
      expect(ids).toContain('crypto');
      expect(ids).toContain('forex');
    });

    it('TRADING_STYLES has expected entries', () => {
      const ids = TRADING_STYLES.map((s) => s.id);
      expect(ids).toContain('day');
      expect(ids).toContain('swing');
      expect(ids).toContain('scalper');
    });
  });

  // ─── calcCompleteness ───────────────────────────────────────
  describe('calcCompleteness', () => {
    it('returns 0 for empty profile', () => {
      const profile = {
        displayName: '',
        username: '',
        bio: '',
        tradingExperience: '',
        tradingStyle: '',
        preferredMarkets: [],
        avatar: '🔥',
        avatarType: 'emoji',
      };
      expect(calcCompleteness(profile)).toBe(0);
    });

    it('returns 100 for fully filled profile', () => {
      const profile = {
        displayName: 'John',
        username: 'john_trader',
        bio: 'I trade stuff',
        tradingExperience: 'advanced',
        tradingStyle: 'day',
        preferredMarkets: ['stocks', 'crypto'],
        avatar: '🐂',
        avatarType: 'emoji',
      };
      expect(calcCompleteness(profile)).toBe(100);
    });

    it('returns partial completeness', () => {
      const profile = {
        displayName: 'John',
        username: 'john_trader',
        bio: '',
        tradingExperience: '',
        tradingStyle: '',
        preferredMarkets: [],
        avatar: '🔥',
        avatarType: 'emoji',
      };
      const completeness = calcCompleteness(profile);
      expect(completeness).toBeGreaterThan(0);
      expect(completeness).toBeLessThan(100);
    });

    it('counts image avatar as custom', () => {
      const profile = {
        displayName: '',
        username: '',
        bio: '',
        tradingExperience: '',
        tradingStyle: '',
        preferredMarkets: [],
        avatar: '🔥',
        avatarType: 'image',
      };
      // avatarType=image counts as having custom avatar
      expect(calcCompleteness(profile)).toBeGreaterThan(0);
    });
  });

  // ─── createProfileSlice ─────────────────────────────────────
  describe('createProfileSlice', () => {
    it('creates slice with default profile', () => {
      const get = () => slice;
      const set = (fn) => {
        const update = typeof fn === 'function' ? fn(slice) : fn;
        Object.assign(slice, update);
      };
      const slice = createProfileSlice(set, get);

      expect(slice.profile).toBeDefined();
      expect(slice.profile.avatar).toBe('🔥');
      expect(slice.profile.displayName).toBe('');
    });

    it('updateProfile merges updates', () => {
      const get = () => state;
      const set = (fn) => {
        const update = typeof fn === 'function' ? fn(state) : fn;
        Object.assign(state, update);
      };
      const state = createProfileSlice(set, get);

      state.updateProfile({ displayName: 'Alice' });
      expect(state.profile.displayName).toBe('Alice');
      expect(state.profile.avatar).toBe('🔥'); // unchanged
    });

    it('resetProfile restores defaults', () => {
      const get = () => state;
      const set = (fn) => {
        const update = typeof fn === 'function' ? fn(state) : fn;
        Object.assign(state, update);
      };
      const state = createProfileSlice(set, get);

      state.updateProfile({ displayName: 'Alice' });
      state.resetProfile();
      expect(state.profile.displayName).toBe('');
    });

    it('getProfileCompleteness returns a number', () => {
      const get = () => state;
      const set = (fn) => {
        const update = typeof fn === 'function' ? fn(state) : fn;
        Object.assign(state, update);
      };
      const state = createProfileSlice(set, get);

      expect(typeof state.getProfileCompleteness()).toBe('number');
    });
  });
});
