// ═══════════════════════════════════════════════════════════════════
// charEdge — Social Service (Phase 4)
//
// Implements social features: profiles, snapshots, likes, leaderboard.
// Replaces the stub in routes.ts with real SQLite persistence.
// ═══════════════════════════════════════════════════════════════════

import type { Database } from 'better-sqlite3';

// ─── Types ──────────────────────────────────────────────────────

export interface SocialResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface Profile {
  userId: string;
  username: string;
  displayName: string;
  bio: string;
  avatar: string;
  tradeCount: number;
  winRate: number;
  totalPnl: number;
  followerCount: number;
  followingCount: number;
  joinedAt: string;
}

export interface Snapshot {
  id: string;
  userId: string;
  title: string;
  description: string;
  symbol: string;
  timeframe: string;
  chartType: string;
  indicators: string;
  tags: string;
  likesCount: number;
  viewsCount: number;
  createdAt: string;
}

// ─── Schema Init ──────────────────────────────────────────────────

export function initSocialTables(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      user_id       TEXT PRIMARY KEY,
      username      TEXT UNIQUE,
      display_name  TEXT DEFAULT '',
      bio           TEXT DEFAULT '',
      avatar        TEXT DEFAULT '',
      created_at    TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS snapshots (
      id            TEXT PRIMARY KEY,
      user_id       TEXT NOT NULL,
      title         TEXT NOT NULL,
      description   TEXT DEFAULT '',
      symbol        TEXT DEFAULT '',
      timeframe     TEXT DEFAULT '',
      chart_type    TEXT DEFAULT 'candlestick',
      indicators    TEXT DEFAULT '[]',
      tags          TEXT DEFAULT '[]',
      likes_count   INTEGER DEFAULT 0,
      views_count   INTEGER DEFAULT 0,
      created_at    TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS snapshot_likes (
      snapshot_id   TEXT NOT NULL,
      user_id       TEXT NOT NULL,
      created_at    TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (snapshot_id, user_id),
      FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS follows (
      follower_id   TEXT NOT NULL,
      following_id  TEXT NOT NULL,
      created_at    TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (follower_id, following_id)
    );

    CREATE INDEX IF NOT EXISTS idx_snapshots_user ON snapshots(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_snapshots_symbol ON snapshots(symbol);
    CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
    CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);
  `);
}

// ─── Service Implementation ─────────────────────────────────────

export function createSocialService(db: Database) {
  initSocialTables(db);

  return {
    // ── Profile ────────────────────────────────────────────
    async getProfile(userId: string): Promise<SocialResult<Profile>> {
      const row = db
        .prepare(
          `
        SELECT p.*,
          (SELECT COUNT(*) FROM follows WHERE following_id = p.user_id) as follower_count,
          (SELECT COUNT(*) FROM follows WHERE follower_id = p.user_id) as following_count,
          (SELECT COUNT(*) FROM snapshots WHERE user_id = p.user_id) as snapshot_count
        FROM profiles p WHERE p.user_id = ?
      `,
        )
        .get(userId) as Record<string, unknown> | undefined;

      if (!row) {
        // Auto-create profile from users table
        const user = db.prepare('SELECT id, email, display_name, created_at FROM users WHERE id = ?').get(userId) as
          | Record<string, unknown>
          | undefined;
        if (!user) return { ok: false, error: 'User not found' };

        db.prepare('INSERT OR IGNORE INTO profiles (user_id, username, display_name) VALUES (?, ?, ?)').run(
          userId,
          (user.email as string)?.split('@')[0] || userId,
          user.display_name || '',
        );

        return this.getProfile(userId);
      }

      return {
        ok: true,
        data: {
          userId: row.user_id as string,
          username: row.username as string,
          displayName: row.display_name as string,
          bio: row.bio as string,
          avatar: row.avatar as string,
          tradeCount: 0,
          winRate: 0,
          totalPnl: 0,
          followerCount: row.follower_count as number,
          followingCount: row.following_count as number,
          joinedAt: row.created_at as string,
        },
      };
    },

    async updateProfile(userId: string, updates: Record<string, unknown>): Promise<SocialResult> {
      const allowed = ['username', 'display_name', 'bio', 'avatar'];
      const sets: string[] = [];
      const values: unknown[] = [];

      for (const [key, val] of Object.entries(updates)) {
        const col = key === 'displayName' ? 'display_name' : key;
        if (allowed.includes(col)) {
          sets.push(`${col} = ?`);
          values.push(val);
        }
      }

      if (sets.length === 0) return { ok: false, error: 'No valid fields' };

      values.push(userId);
      db.prepare(`UPDATE profiles SET ${sets.join(', ')} WHERE user_id = ?`).run(...values);
      return { ok: true };
    },

    // ── Snapshots (Ideas) ──────────────────────────────────
    async getFeed(opts: { limit: number; offset: number; sortBy: string }): Promise<SocialResult> {
      const orderBy = opts.sortBy === 'popular' ? 'likes_count DESC' : 'created_at DESC';
      const rows = db
        .prepare(
          `
        SELECT s.*, p.username, p.display_name, p.avatar
        FROM snapshots s
        LEFT JOIN profiles p ON s.user_id = p.user_id
        ORDER BY ${orderBy}
        LIMIT ? OFFSET ?
      `,
        )
        .all(opts.limit, opts.offset);

      const total = (db.prepare('SELECT COUNT(*) as count FROM snapshots').get() as { count: number }).count;

      return { ok: true, data: { items: rows, total, limit: opts.limit, offset: opts.offset } };
    },

    async createSnapshot(data: Record<string, unknown>): Promise<SocialResult> {
      const id = `snap_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      db.prepare(
        `
        INSERT INTO snapshots (id, user_id, title, description, symbol, timeframe, chart_type, indicators, tags)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      ).run(
        id,
        data.userId,
        data.title || 'Chart Analysis',
        data.description || '',
        data.symbol || '',
        data.timeframe || '',
        data.chartType || 'candlestick',
        JSON.stringify(data.indicators || []),
        JSON.stringify(data.tags || []),
      );

      return { ok: true, data: { id } };
    },

    async getSnapshot(id: string): Promise<SocialResult> {
      const row = db
        .prepare(
          `
        SELECT s.*, p.username, p.display_name, p.avatar
        FROM snapshots s
        LEFT JOIN profiles p ON s.user_id = p.user_id
        WHERE s.id = ?
      `,
        )
        .get(id);

      if (!row) return { ok: false, error: 'Snapshot not found' };

      // Increment view count
      db.prepare('UPDATE snapshots SET views_count = views_count + 1 WHERE id = ?').run(id);
      return { ok: true, data: row };
    },

    async deleteSnapshot(id: string, userId: string): Promise<SocialResult> {
      const result = db.prepare('DELETE FROM snapshots WHERE id = ? AND user_id = ?').run(id, userId);
      return result.changes > 0 ? { ok: true } : { ok: false, error: 'Not found or not authorized' };
    },

    async toggleLike(snapshotId: string, userId: string): Promise<SocialResult> {
      const existing = db
        .prepare('SELECT 1 FROM snapshot_likes WHERE snapshot_id = ? AND user_id = ?')
        .get(snapshotId, userId);

      if (existing) {
        db.prepare('DELETE FROM snapshot_likes WHERE snapshot_id = ? AND user_id = ?').run(snapshotId, userId);
        db.prepare('UPDATE snapshots SET likes_count = MAX(0, likes_count - 1) WHERE id = ?').run(snapshotId);
        return { ok: true, data: { liked: false } };
      }

      db.prepare('INSERT INTO snapshot_likes (snapshot_id, user_id) VALUES (?, ?)').run(snapshotId, userId);
      db.prepare('UPDATE snapshots SET likes_count = likes_count + 1 WHERE id = ?').run(snapshotId);
      return { ok: true, data: { liked: true } };
    },

    // ── Leaderboard ────────────────────────────────────────
    async getLeaderboard(opts: { metric: string; period: string; limit: number }): Promise<SocialResult> {
      // Build leaderboard from trades table
      const periodFilter = periodToDateFilter(opts.period);

      const rows = db
        .prepare(
          `
        SELECT
          t.user_id,
          p.username,
          p.display_name,
          p.avatar,
          COUNT(*) as trade_count,
          SUM(CASE WHEN CAST(t.pnl AS REAL) > 0 THEN 1 ELSE 0 END) as wins,
          ROUND(SUM(CAST(t.pnl AS REAL)), 2) as total_pnl,
          ROUND(AVG(CAST(t.pnl AS REAL)), 2) as avg_pnl
        FROM trades t
        LEFT JOIN profiles p ON t.user_id = p.user_id
        WHERE t.status = 'closed' ${periodFilter}
        GROUP BY t.user_id
        HAVING trade_count >= 5
        ORDER BY ${opts.metric === 'winrate' ? 'CAST(wins AS REAL) / trade_count' : 'total_pnl'} DESC
        LIMIT ?
      `,
        )
        .all(opts.limit);

      const ranked = (rows as Record<string, unknown>[]).map((row, i) => ({
        rank: i + 1,
        userId: row.user_id,
        username: row.username || 'Trader',
        displayName: row.display_name || '',
        avatar: row.avatar || '',
        tradeCount: row.trade_count,
        winRate: row.trade_count ? Math.round(((row.wins as number) / (row.trade_count as number)) * 100) : 0,
        totalPnl: row.total_pnl,
        avgPnl: row.avg_pnl,
      }));

      return { ok: true, data: ranked };
    },

    // ── Follow System ──────────────────────────────────────
    async follow(followerId: string, followingId: string): Promise<SocialResult> {
      if (followerId === followingId) return { ok: false, error: 'Cannot follow yourself' };
      try {
        db.prepare('INSERT OR IGNORE INTO follows (follower_id, following_id) VALUES (?, ?)').run(
          followerId,
          followingId,
        );
        return { ok: true, data: { following: true } };
      } catch {
        return { ok: false, error: 'Follow failed' };
      }
    },

    async unfollow(followerId: string, followingId: string): Promise<SocialResult> {
      db.prepare('DELETE FROM follows WHERE follower_id = ? AND following_id = ?').run(followerId, followingId);
      return { ok: true, data: { following: false } };
    },

    async getFollowers(userId: string, limit = 50): Promise<SocialResult> {
      const rows = db
        .prepare(
          `
        SELECT p.user_id, p.username, p.display_name, p.avatar
        FROM follows f
        JOIN profiles p ON f.follower_id = p.user_id
        WHERE f.following_id = ?
        LIMIT ?
      `,
        )
        .all(userId, limit);
      return { ok: true, data: rows };
    },

    async getFollowing(userId: string, limit = 50): Promise<SocialResult> {
      const rows = db
        .prepare(
          `
        SELECT p.user_id, p.username, p.display_name, p.avatar
        FROM follows f
        JOIN profiles p ON f.following_id = p.user_id
        WHERE f.follower_id = ?
        LIMIT ?
      `,
        )
        .all(userId, limit);
      return { ok: true, data: rows };
    },

    async isFollowing(followerId: string, followingId: string): Promise<boolean> {
      const row = db
        .prepare('SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?')
        .get(followerId, followingId);
      return !!row;
    },
  };
}

// ─── Helpers ──────────────────────────────────────────────────────

function periodToDateFilter(period: string): string {
  switch (period) {
    case 'day':
      return "AND t.created_at >= datetime('now', '-1 day')";
    case 'week':
      return "AND t.created_at >= datetime('now', '-7 days')";
    case 'month':
      return "AND t.created_at >= datetime('now', '-30 days')";
    case 'year':
      return "AND t.created_at >= datetime('now', '-365 days')";
    default:
      return '';
  }
}

export default createSocialService;
