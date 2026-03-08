// ═══════════════════════════════════════════════════════════════════
// charEdge — RBAC (Role-Based Access Control) Tests
//
// Tests for useRole hook and RoleGate component.
// ═══════════════════════════════════════════════════════════════════

// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { render, screen } from '@testing-library/react';
import React from 'react';

// ─── Mock the auth store ────────────────────────────────────────

let mockUser = null;

// Vitest hoists vi.mock — this path must match from the consuming module's perspective.
// useRole.js imports from '../../state/useAuthStore.js' (resolved to src/state/useAuthStore.js).
// We mock it at the Vite resolve alias level.
vi.mock('../../state/useAuthStore.js', () => ({
    useAuthStore: (selector) => selector({ user: mockUser }),
    default: (selector) => selector({ user: mockUser }),
}));

// Also mock from the test's own perspective for direct imports
vi.mock('../../../state/useAuthStore.js', () => ({
    useAuthStore: (selector) => selector({ user: mockUser }),
    default: (selector) => selector({ user: mockUser }),
}));

// Import AFTER mocks
import { useRole } from '../../app/hooks/useRole.js';
import RoleGate from '../../app/components/auth/RoleGate.jsx';

// ─── useRole Tests ──────────────────────────────────────────────

describe('useRole', () => {
    beforeEach(() => {
        mockUser = null;
    });

    it('returns "free" role when no user is signed in', () => {
        const { result } = renderHook(() => useRole());
        expect(result.current.role).toBe('free');
        expect(result.current.isFree).toBe(true);
        expect(result.current.isTrader).toBe(false);
        expect(result.current.isAdmin).toBe(false);
        expect(result.current.isAuthenticated).toBe(false);
    });

    it('reads role from user.role property', () => {
        mockUser = { id: '1', email: 'user@test.com', role: 'trader' };
        const { result } = renderHook(() => useRole());
        expect(result.current.role).toBe('trader');
        expect(result.current.isTrader).toBe(true);
        expect(result.current.isPro).toBe(false);
    });

    it('reads role from user_metadata', () => {
        mockUser = { id: '1', email: 'user@test.com', user_metadata: { role: 'pro' } };
        const { result } = renderHook(() => useRole());
        expect(result.current.role).toBe('pro');
        expect(result.current.isPro).toBe(true);
    });

    it('reads role from app_metadata', () => {
        mockUser = { id: '1', email: 'user@test.com', app_metadata: { role: 'admin' } };
        const { result } = renderHook(() => useRole());
        expect(result.current.role).toBe('admin');
        expect(result.current.isAdmin).toBe(true);
    });

    it('hasRole() respects role hierarchy', () => {
        mockUser = { id: '1', email: 'user@test.com', role: 'pro' };
        const { result } = renderHook(() => useRole());
        expect(result.current.hasRole('free')).toBe(true);
        expect(result.current.hasRole('trader')).toBe(true);
        expect(result.current.hasRole('pro')).toBe(true);
        expect(result.current.hasRole('admin')).toBe(false);
    });

    it('falls back to "free" for unknown roles', () => {
        mockUser = { id: '1', email: 'user@test.com', role: 'mystery' };
        const { result } = renderHook(() => useRole());
        expect(result.current.role).toBe('free');
    });

    it('admin has all permissions', () => {
        mockUser = { id: '1', email: 'admin@test.com', role: 'admin' };
        const { result } = renderHook(() => useRole());
        expect(result.current.hasRole('free')).toBe(true);
        expect(result.current.hasRole('trader')).toBe(true);
        expect(result.current.hasRole('pro')).toBe(true);
        expect(result.current.hasRole('admin')).toBe(true);
        expect(result.current.isFree).toBe(false);
        expect(result.current.isTrader).toBe(true);
        expect(result.current.isPro).toBe(true);
        expect(result.current.isAdmin).toBe(true);
    });
});

// ─── RoleGate Tests ─────────────────────────────────────────────

describe('RoleGate', () => {
    beforeEach(() => {
        mockUser = null;
    });

    it('hides content when role is insufficient (mode="hide")', () => {
        mockUser = { id: '1', role: 'free' };
        render(
            <RoleGate minRole="trader">
                <div data-testid="secret">Secret Content</div>
            </RoleGate>
        );
        expect(screen.queryByTestId('secret')).toBeNull();
    });

    it('shows content when role meets minimum', () => {
        mockUser = { id: '1', role: 'trader' };
        render(
            <RoleGate minRole="trader">
                <div data-testid="content">Trader Content</div>
            </RoleGate>
        );
        expect(screen.getByTestId('content')).toBeDefined();
    });

    it('shows content when role exceeds minimum', () => {
        mockUser = { id: '1', role: 'admin' };
        render(
            <RoleGate minRole="trader">
                <div data-testid="content">Trader Content</div>
            </RoleGate>
        );
        expect(screen.getByTestId('content')).toBeDefined();
    });

    it('shows fallback when access denied with custom fallback', () => {
        mockUser = { id: '1', role: 'free' };
        render(
            <RoleGate minRole="pro" fallback={<div data-testid="upgrade">Upgrade pls</div>}>
                <div data-testid="secret">Pro Only</div>
            </RoleGate>
        );
        expect(screen.queryByTestId('secret')).toBeNull();
        expect(screen.getByTestId('upgrade')).toBeDefined();
    });

    it('renders disabled content when mode="disable"', () => {
        mockUser = { id: '1', role: 'free' };
        const { container } = render(
            <RoleGate minRole="trader" mode="disable">
                <div data-testid="widget">Widget</div>
            </RoleGate>
        );
        expect(screen.getByTestId('widget')).toBeDefined();
        expect(container.firstChild.getAttribute('aria-disabled')).toBe('true');
    });

    it('renders blurred content when mode="blur"', () => {
        mockUser = { id: '1', role: 'free' };
        render(
            <RoleGate minRole="pro" mode="blur">
                <div data-testid="chart">Advanced Chart</div>
            </RoleGate>
        );
        expect(screen.getByTestId('chart')).toBeDefined();
        expect(screen.getByText(/upgrade to/i)).toBeDefined();
    });
});
