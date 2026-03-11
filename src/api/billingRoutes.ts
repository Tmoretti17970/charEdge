// ═══════════════════════════════════════════════════════════════════
// charEdge v11 — Stripe Billing Routes (TypeScript)
//
// Subscription management for Free / Trader / Pro plans.
// Phase 2: Converted to TypeScript.
// ═══════════════════════════════════════════════════════════════════

import type { Application, Request, Response, NextFunction } from 'express';

// ─── Types ──────────────────────────────────────────────────────

type PlanId = 'free' | 'trader' | 'pro';
type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete';

interface Subscription {
  plan: PlanId;
  status: SubscriptionStatus;
  stripeCustomerId: string | null;
  stripeSubId: string | null;
  currentPeriodEnd: string | null;
}

interface PlanFeatureSet {
  aiCoach: boolean;
  gpuCompute: boolean;
  scripting: boolean;
  cloudSync: boolean;
  brokerAutoImport: boolean;
  maxTrades: number;
  maxCharts: number;
  exportFormats: string[];
  priority: boolean;
}

// Augment Express Request for billing
declare global {
  namespace Express {
    interface Request {
      rawBody?: string;
    }
  }
}

// ─── In-Memory Subscription Store ───────────────────────────────

const _subscriptions = new Map<string, Subscription>();

const DEFAULT_SUB: Subscription = {
  plan: 'free',
  status: 'active',
  stripeCustomerId: null,
  stripeSubId: null,
  currentPeriodEnd: null,
};

function getSubscription(userId: string): Subscription {
  return _subscriptions.get(userId) || { ...DEFAULT_SUB };
}

function setSubscription(userId: string, data: Partial<Subscription>): void {
  _subscriptions.set(userId, { ...getSubscription(userId), ...data });
}

// ─── Feature Gates ──────────────────────────────────────────────

const PLAN_FEATURES: Record<PlanId, PlanFeatureSet> = {
  free: {
    aiCoach: false,
    gpuCompute: false,
    scripting: false,
    cloudSync: false,
    brokerAutoImport: false,
    maxTrades: 500,
    maxCharts: 4,
    exportFormats: ['csv'],
    priority: false,
  },
  trader: {
    aiCoach: true,
    gpuCompute: false,
    scripting: false,
    cloudSync: false,
    brokerAutoImport: false,
    maxTrades: 5000,
    maxCharts: 8,
    exportFormats: ['csv', 'json'],
    priority: false,
  },
  pro: {
    aiCoach: true,
    gpuCompute: true,
    scripting: true,
    cloudSync: true,
    brokerAutoImport: true,
    maxTrades: Infinity,
    maxCharts: 16,
    exportFormats: ['csv', 'html', 'json', 'pdf'],
    priority: true,
  },
};

export function getFeatures(userId: string): { plan: PlanId; features: PlanFeatureSet } {
  const sub = getSubscription(userId);
  const plan: PlanId = sub.status === 'active' || sub.status === 'trialing' ? sub.plan : 'free';
  return { plan, features: PLAN_FEATURES[plan] };
}

// ─── Price ID Lookup ────────────────────────────────────────────

const PLAN_PRICE_ENV: Record<string, string> = {
  trader: 'STRIPE_TRADER_PRICE_ID',
  pro: 'STRIPE_PRO_PRICE_ID',
};

// ─── Route Registration ─────────────────────────────────────────

export function registerBillingRoutes(app: Application): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let stripe: any = null;

  function getStripe(): typeof stripe {
    if (stripe) return stripe;
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) return null;
    try {
      const Stripe = require('stripe');
      stripe = new Stripe(key, { apiVersion: '2024-12-18.acacia' });
      return stripe;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_) {
      process.stdout.write('[Billing] Stripe SDK not installed. Run: npm install stripe\n');
      return null;
    }
  }

  function requireAuth(req: Request, res: Response, next: NextFunction): void {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const token = auth.slice(7);
    if (!token || token === 'local-token') { res.status(401).json({ error: 'Invalid token' }); return; }
    req.userId = 'user_' + simpleHash(token);
    next();
  }

  // ─── GET /api/billing/status ────────────────────────────────
  app.get('/api/billing/status', requireAuth, (req: Request, res: Response): void => {
    const sub = getSubscription(req.userId!);
    const { features } = getFeatures(req.userId!);

    res.json({
      plan: sub.plan,
      status: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd,
      features,
      stripeConfigured: !!process.env.STRIPE_SECRET_KEY,
    });
  });

  // ─── POST /api/billing/checkout ─────────────────────────────
  app.post('/api/billing/checkout', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const s = getStripe();
    if (!s) { res.status(400).json({ error: 'Stripe not configured' }); return; }

    const targetPlan = (req.body?.plan as string) || 'pro';
    const envKey = PLAN_PRICE_ENV[targetPlan];
    if (!envKey) { res.status(400).json({ error: `Invalid plan: ${targetPlan}` }); return; }

    const priceId = process.env[envKey];
    if (!priceId) { res.status(400).json({ error: `${envKey} not set` }); return; }

    try {
      const sub = getSubscription(req.userId!);
      let customerId = sub.stripeCustomerId;

      if (!customerId) {
        const customer = await s.customers.create({
          metadata: { userId: req.userId },
        });
        customerId = customer.id;
        setSubscription(req.userId!, { stripeCustomerId: customerId });
      }

      const session = await s.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${req.protocol}://${req.get('host')}/?billing=success`,
        cancel_url: `${req.protocol}://${req.get('host')}/?billing=cancel`,
        metadata: { userId: req.userId, plan: targetPlan },
      });

      res.json({ checkoutUrl: session.url, sessionId: session.id });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  });

  // ─── POST /api/billing/portal ───────────────────────────────
  app.post('/api/billing/portal', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const s = getStripe();
    if (!s) { res.status(400).json({ error: 'Stripe not configured' }); return; }

    const sub = getSubscription(req.userId!);
    if (!sub.stripeCustomerId) {
      res.status(400).json({ error: 'No subscription found' });
      return;
    }

    try {
      const portal = await s.billingPortal.sessions.create({
        customer: sub.stripeCustomerId,
        return_url: `${req.protocol}://${req.get('host')}/`,
      });

      res.json({ portalUrl: portal.url });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  });

  // ─── POST /api/billing/webhook ──────────────────────────────
  app.post(
    '/api/billing/webhook',
    (req: Request, _res: Response, next: NextFunction): void => {
      if (req.headers['content-type'] === 'application/json') {
        next();
      } else {
        let rawBody = '';
        req.on('data', (chunk: Buffer) => {
          rawBody += chunk;
        });
        req.on('end', () => {
          req.rawBody = rawBody;
          next();
        });
      }
    },
    async (req: Request, res: Response): Promise<void> => {
      const s = getStripe();
      if (!s) { res.status(400).send('Stripe not configured'); return; }

      const sig = req.headers['stripe-signature'] as string | undefined;
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let event: any;

      try {
        if (webhookSecret && sig) {
          event = s.webhooks.constructEvent(req.rawBody || JSON.stringify(req.body), sig, webhookSecret);
        } else {
          event = req.body;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(400).send(`Webhook signature failed: ${message}`);
        return;
      }

      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object;
          const userId = session.metadata?.userId as string | undefined;
          const plan = (session.metadata?.plan as PlanId) || 'pro';
          if (userId) {
            setSubscription(userId, {
              plan,
              status: 'active',
              stripeCustomerId: session.customer,
              stripeSubId: session.subscription,
            });
            process.stdout.write(`[Billing] User ${userId} upgraded to ${plan}\n`);
          }
          break;
        }

        case 'customer.subscription.updated': {
          const sub = event.data.object;
          const userId = findUserByCustomerId(sub.customer);
          if (userId) {
            setSubscription(userId, {
              status: sub.status,
              currentPeriodEnd: sub.current_period_end
                ? new Date(sub.current_period_end * 1000).toISOString()
                : null,
            });
          }
          break;
        }

        case 'customer.subscription.deleted': {
          const sub = event.data.object;
          const userId = findUserByCustomerId(sub.customer);
          if (userId) {
            setSubscription(userId, { plan: 'free', status: 'canceled', stripeSubId: null });
            process.stdout.write(`[Billing] User ${userId} downgraded to Free\n`);
          }
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object;
          const userId = findUserByCustomerId(invoice.customer);
          if (userId) {
            setSubscription(userId, { status: 'past_due' });
          }
          break;
        }
      }

      res.json({ received: true });
    },
  );
}

// ─── Helpers ────────────────────────────────────────────────────

function findUserByCustomerId(customerId: string): string | null {
  for (const [userId, sub] of _subscriptions) {
    if (sub.stripeCustomerId === customerId) return userId;
  }
  return null;
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export { PLAN_FEATURES, getSubscription, setSubscription };
export default registerBillingRoutes;
