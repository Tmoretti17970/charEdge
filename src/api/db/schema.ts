// ═══════════════════════════════════════════════════════════════════
// charEdge — Database Schema (Drizzle ORM, TypeScript)
//
// Phase 5 Task 5.1.1 + 5.1.2: PostgreSQL schema for users,
// subscriptions, API keys, and activity logging.
// Phase 2: Converted to TypeScript.
//
// Usage:
//   import { db } from './connection.ts';
//   import { users, subscriptions } from './schema.ts';
//   const user = await db.select().from(users).where(eq(users.email, email));
// ═══════════════════════════════════════════════════════════════════

import { pgTable, varchar, text, integer, boolean, timestamp, jsonb, uuid, pgEnum } from 'drizzle-orm/pg-core';

// ─── Enums ──────────────────────────────────────────────────────

export const userRoleEnum = pgEnum('user_role', ['free', 'trader', 'pro', 'admin']);
export const subStatusEnum = pgEnum('sub_status', ['trialing', 'active', 'past_due', 'canceled', 'unpaid']);
export const activityTypeEnum = pgEnum('activity_type', ['login', 'logout', 'trade', 'alert', 'subscription', 'api_call', 'settings']);

// ─── Users ──────────────────────────────────────────────────────

export const users = pgTable('users', {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    displayName: varchar('display_name', { length: 100 }),
    avatarUrl: text('avatar_url'),
    role: userRoleEnum('role').notNull().default('free'),
    emailVerified: boolean('email_verified').notNull().default(false),

    // Stripe
    stripeCustomerId: varchar('stripe_customer_id', { length: 255 }).unique(),

    // Preferences
    preferences: jsonb('preferences').default({}),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
});

// ─── Subscriptions ──────────────────────────────────────────────

export const subscriptions = pgTable('subscriptions', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

    // Stripe
    stripeSubId: varchar('stripe_sub_id', { length: 255 }).unique(),
    stripePriceId: varchar('stripe_price_id', { length: 255 }),
    plan: userRoleEnum('plan').notNull().default('free'),
    status: subStatusEnum('status').notNull().default('active'),

    // Period
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── API Keys ───────────────────────────────────────────────────

export const apiKeys = pgTable('api_keys', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    keyHash: varchar('key_hash', { length: 128 }).notNull().unique(),
    prefix: varchar('prefix', { length: 12 }).notNull(), // First 8 chars for identification

    // Permissions
    scopes: jsonb('scopes').default(['read']),

    // Usage
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    requestCount: integer('request_count').notNull().default(0),

    // State
    active: boolean('active').notNull().default(true),
    expiresAt: timestamp('expires_at', { withTimezone: true }),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── Activity Log ───────────────────────────────────────────────

export const activityLog = pgTable('activity_log', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    type: activityTypeEnum('type').notNull(),
    action: varchar('action', { length: 100 }).notNull(),
    metadata: jsonb('metadata').default({}),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── Idempotency Keys (Stripe payments) ─────────────────────────

export const idempotencyKeys = pgTable('idempotency_keys', {
    key: varchar('key', { length: 255 }).primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    action: varchar('action', { length: 100 }).notNull(),
    response: jsonb('response'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});
