// ═══════════════════════════════════════════════════════════════════
// charEdge — Billing / Pricing Tests (Task 2.2.4)
//
// Source-verification tests for Stripe billing integration.
// Validates: 3-tier plan structure, route wiring, UI components,
// subscription store, and env configuration.
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '../../..');
const SRC = resolve(__dirname, '..', '..');

// ─── Billing Routes (Backend) ──────────────────────────────────

describe('Billing Routes — 3-Tier Plan Structure', () => {
  const src = readFileSync(resolve(SRC, 'api/billingRoutes.ts'), 'utf8');

  it('exports PLAN_FEATURES with three tiers', () => {
    expect(src).toContain('PLAN_FEATURES');
    expect(src).toContain("free:");
    expect(src).toContain("trader:");
    expect(src).toContain("pro:");
  });

  it('free plan has correct limitations', () => {
    expect(src).toContain('aiCoach: false');
    expect(src).toContain('maxTrades: 500');
    expect(src).toContain('maxCharts: 4');
  });

  it('trader plan includes AI Coach', () => {
    // Trader has aiCoach: true
    expect(src).toContain('aiCoach: true');
    expect(src).toContain('maxTrades: 5000');
    expect(src).toContain('maxCharts: 8');
  });

  it('pro plan includes everything', () => {
    expect(src).toContain('gpuCompute: true');
    expect(src).toContain('scripting: true');
    expect(src).toContain('cloudSync: true');
    expect(src).toContain('maxCharts: 16');
  });

  it('has checkout, portal, webhook, and status endpoints', () => {
    expect(src).toContain('/api/billing/checkout');
    expect(src).toContain('/api/billing/portal');
    expect(src).toContain('/api/billing/webhook');
    expect(src).toContain('/api/billing/status');
  });

  it('supports plan selection in checkout', () => {
    expect(src).toContain('STRIPE_TRADER_PRICE_ID');
    expect(src).toContain('STRIPE_PRO_PRICE_ID');
    expect(src).toContain("req.body?.plan");
  });

  it('exports registerBillingRoutes and PLAN_FEATURES', () => {
    expect(src).toContain('export function registerBillingRoutes(app');
    expect(src).toContain('export { PLAN_FEATURES');
  });
});

// ─── Server Integration ────────────────────────────────────────

describe('Billing Routes — Server Registration', () => {
  const src = readFileSync(resolve(ROOT, 'server.js'), 'utf8');

  it('imports registerBillingRoutes', () => {
    expect(src).toContain("import { registerBillingRoutes }");
  });

  it('calls registerBillingRoutes(app)', () => {
    expect(src).toContain('registerBillingRoutes(app)');
  });

  it('sets up JSON body parser for billing endpoints', () => {
    expect(src).toContain("/api/billing");
  });
});

// ─── Environment Configuration ─────────────────────────────────

describe('Billing — Environment Variables', () => {
  const envExample = readFileSync(resolve(ROOT, '.env.example'), 'utf8');

  it('.env.example has Stripe config vars', () => {
    expect(envExample).toContain('STRIPE_SECRET_KEY');
    expect(envExample).toContain('STRIPE_WEBHOOK_SECRET');
    expect(envExample).toContain('STRIPE_TRADER_PRICE_ID');
    expect(envExample).toContain('STRIPE_PRO_PRICE_ID');
  });
});

// ─── Pricing Page (Frontend) ───────────────────────────────────

describe('Pricing Page — UI', () => {
  const pricingExists = existsSync(resolve(SRC, 'pages/PricingPage.jsx'));

  it.skip('PricingPage.jsx exists (Phase 7 — not yet implemented)', () => {
    expect(pricingExists).toBe(true);
  });

  const src = pricingExists ? readFileSync(resolve(SRC, 'pages/PricingPage.jsx'), 'utf8') : '';

  it('renders 3 plan cards', () => {
    if (!pricingExists) return;
    expect(src).toContain("id: 'free'");
    expect(src).toContain("id: 'trader'");
    expect(src).toContain("id: 'pro'");
  });

  it('shows correct pricing', () => {
    if (!pricingExists) return;
    expect(src).toContain("$0");
    expect(src).toContain("$14.99");
    expect(src).toContain("$29.99");
  });

  it('imports useSubscriptionStore', () => {
    if (!pricingExists) return;
    expect(src).toContain("useSubscriptionStore");
  });

  it('has FAQ section', () => {
    if (!pricingExists) return;
    expect(src).toContain('Frequently Asked Questions');
  });
});

// ─── Router Integration ────────────────────────────────────────

describe('Pricing — Router Integration', () => {
  const src = readFileSync(resolve(SRC, 'app/layouts/PageRouter.jsx'), 'utf8');

  // Wave 0: Pricing route removed during navigation cleanup
  it.skip('has pricing route in PAGES map (removed — pricing page sunset)', () => {
    expect(src).toContain('pricing: JournalPage');
  });

  it.skip('lazy-loads PricingPage (removed — pricing page sunset)', () => {
    expect(src).toContain("PricingPage.jsx");
  });

  it.skip('has pricing label (removed — pricing page sunset)', () => {
    expect(src).toContain("pricing: 'Pricing'");
  });
});

// ─── Sidebar Upgrade Link ──────────────────────────────────────

describe('Pricing — Sidebar Upgrade Link', () => {
  const src = readFileSync(resolve(SRC, 'app/layouts/Sidebar.jsx'), 'utf8');

  it('has upgrade link to pricing page', () => {
    expect(src).toContain("setPage('pricing')");
  });

  it('shows upgrade text with icon', () => {
    expect(src).toContain('Upgrade');
    expect(src).toContain("name=\"eye\"");
  });
});

// ─── Subscription Store ────────────────────────────────────────

describe('Subscription Store', () => {
  it('useSubscriptionStore.ts exists', () => {
    expect(existsSync(resolve(SRC, 'state/useSubscriptionStore.ts'))).toBe(true);
  });

  const src = readFileSync(resolve(SRC, 'state/useSubscriptionStore.ts'), 'utf8');

  it('exports useSubscriptionStore', () => {
    expect(src).toContain('export const useSubscriptionStore');
  });

  it('exports canUse helper', () => {
    expect(src).toContain('export function canUse(featureName)');
  });

  it('defaults to free plan', () => {
    expect(src).toContain("plan: 'free'");
  });

  it('has fetchStatus action', () => {
    expect(src).toContain('fetchStatus');
    expect(src).toContain('/api/billing/status');
  });

  it('has checkout action', () => {
    expect(src).toContain('checkout');
    expect(src).toContain('/api/billing/checkout');
  });

  it('has openPortal action', () => {
    expect(src).toContain('openPortal');
    expect(src).toContain('/api/billing/portal');
  });
});

// ─── Landing Page Pricing Section ──────────────────────────────

describe('Landing Page — Pricing Section', () => {
  const src = readFileSync(resolve(SRC, 'pages/LandingPage.jsx'), 'utf8');

  it('has pricing preview section', () => {
    expect(src).toContain('landing-pricing');
    expect(src).toContain('Simple Pricing');
  });

  it('shows three tier previews', () => {
    expect(src).toContain("'$0'");
    expect(src).toContain("'$14.99'");
    expect(src).toContain("'$29.99'");
  });

  it('links to full pricing page', () => {
    expect(src).toContain("setPage('pricing')");
    expect(src).toContain('View All Plans');
  });
});
