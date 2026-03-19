// ═══════════════════════════════════════════════════════════════════
// charEdge — Conversation Memory System (AI Copilot Sprint 2)
//
// Persistent conversation history manager that stores AI interactions
// in IndexedDB. Provides rolling context windows, session summaries,
// and long-term memory extraction for personalized AI coaching.
//
// All data stays in-browser (IndexedDB). Nothing leaves unless the
// user explicitly connects a cloud LLM.
//
// Usage:
//   import { conversationMemory } from './ConversationMemory';
//   await conversationMemory.startSession('BTC analysis');
//   await conversationMemory.addMessage('user', 'What do you see?');
//   const context = conversationMemory.getContextForAI();
// ═══════════════════════════════════════════════════════════════════

import { logger } from '@/observability/logger.js';

// ─── Types ──────────────────────────────────────────────────────

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: {
    symbol?: string;
    timeframe?: string;
    requestType?: string;
    tier?: string;
    model?: string;
    [key: string]: unknown;
  };
}

export interface ConversationSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ConversationMessage[];
  summary: string;
  keyInsights: string[];
}

export interface LongTermMemory {
  recurringTopics: Map<string, number>;   // topic → frequency
  importantInsights: string[];            // extracted key takeaways
  lastUpdated: number;
}

// ─── Constants ──────────────────────────────────────────────────

const DB_NAME = 'charEdge-conversations';
const DB_VERSION = 1;
const SESSIONS_STORE = 'sessions';
const MEMORY_STORE = 'memory';
const MAX_MESSAGES_PER_SESSION = 20;
const MAX_CONTEXT_MESSAGES = 10;
const MAX_SUMMARY_SESSIONS = 3;
const MEMORY_KEY = 'long-term';

// ─── Topic Keywords (for insight extraction) ────────────────────

const TOPIC_KEYWORDS: Record<string, string[]> = {
  'risk management': ['stop loss', 'risk', 'position size', 'drawdown', 'sizing'],
  'emotional trading': ['tilt', 'fomo', 'revenge', 'emotional', 'frustrated', 'anxious'],
  'entry timing': ['entry', 'too early', 'too late', 'timing', 'patience'],
  'exit strategy': ['take profit', 'exit', 'target', 'trailing stop', 'hold too long'],
  'trend analysis': ['trend', 'regime', 'bullish', 'bearish', 'consolidation'],
  'pattern recognition': ['pattern', 'head and shoulders', 'wedge', 'channel', 'breakout'],
  'volume analysis': ['volume', 'accumulation', 'distribution', 'anomaly'],
  'overtrading': ['overtrad', 'too many trades', 'frequency', 'churn'],
};

// ─── Store Class ────────────────────────────────────────────────

export class ConversationMemory {
  private _currentSession: ConversationSession | null = null;
  private _dbPromise: Promise<IDBDatabase> | null = null;
  private _memoryCache: LongTermMemory | null = null;

  // ── Session Management ───────────────────────────────────────

  /**
   * Start a new conversation session.
   */
  async startSession(title?: string): Promise<ConversationSession> {
    const session: ConversationSession = {
      id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: title || `Session ${new Date().toLocaleDateString()}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
      summary: '',
      keyInsights: [],
    };

    this._currentSession = session;
    await this._saveSession(session);

    logger.ai?.debug?.(`[ConvoMemory] Started session: ${session.id}`);
    return session;
  }

  /**
   * Get the current active session, creating one if needed.
   */
  async getCurrentSession(): Promise<ConversationSession> {
    if (!this._currentSession) {
      // Try to resume the most recent session from DB
      const sessions = await this.listSessions(1);
      if (sessions.length > 0) {
        const recent = sessions[0]!;
        // Resume if it's less than 30 minutes old
        if (Date.now() - recent.updatedAt < 30 * 60 * 1000) {
          this._currentSession = recent;
          return recent;
        }
      }
      // Otherwise start fresh
      return this.startSession();
    }
    return this._currentSession;
  }

  // ── Message Management ──────────────────────────────────────

  /**
   * Add a message to the current session.
   * Auto-trims to MAX_MESSAGES_PER_SESSION (keeps most recent).
   */
  async addMessage(
    role: 'user' | 'assistant',
    content: string,
    metadata?: ConversationMessage['metadata'],
  ): Promise<void> {
    const session = await this.getCurrentSession();

    const msg: ConversationMessage = {
      role,
      content,
      timestamp: Date.now(),
    };
    if (metadata) {
      msg.metadata = metadata;
    }

    session.messages.push(msg);

    // Trim oldest messages if over capacity
    if (session.messages.length > MAX_MESSAGES_PER_SESSION) {
      session.messages = session.messages.slice(-MAX_MESSAGES_PER_SESSION);
    }

    session.updatedAt = Date.now();

    // Auto-generate summary and insights periodically
    if (session.messages.length % 5 === 0) {
      session.summary = this._generateSessionSummary(session);
      session.keyInsights = this._extractSessionInsights(session);
    }

    await this._saveSession(session);
  }

  // ── Context Retrieval ───────────────────────────────────────

  /**
   * Get recent messages for LLM context injection.
   * Returns the last `maxMessages` from the current session.
   */
  getRecentContext(maxMessages = MAX_CONTEXT_MESSAGES): ConversationMessage[] {
    if (!this._currentSession) return [];

    return this._currentSession.messages
      .slice(-maxMessages)
      .map(m => {
        const msg: ConversationMessage = {
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
        };
        if (m.metadata) msg.metadata = m.metadata;
        return msg;
      });
  }

  /**
   * Generate a concise context string for AI system prompt injection.
   * Includes: current session context + recent session summaries.
   * Kept short to save tokens.
   */
  async getContextForAI(): Promise<string> {
    const lines: string[] = [];

    // Current session context
    if (this._currentSession && this._currentSession.messages.length > 0) {
      const recent = this._currentSession.messages.slice(-5);
      lines.push('--- Recent Conversation ---');
      for (const msg of recent) {
        const preview = msg.content.length > 120
          ? msg.content.slice(0, 120) + '…'
          : msg.content;
        lines.push(`${msg.role === 'user' ? 'User' : 'AI'}: ${preview}`);
      }
    }

    // Past session summaries (for long-term awareness)
    try {
      const pastSessions = await this.listSessions(MAX_SUMMARY_SESSIONS + 1);
      const past = pastSessions
        .filter(s => s.id !== this._currentSession?.id)
        .slice(0, MAX_SUMMARY_SESSIONS);

      if (past.length > 0) {
        lines.push('');
        lines.push('--- Previous Session Summaries ---');
        for (const s of past) {
          if (s.summary) {
            lines.push(`• ${s.title}: ${s.summary}`);
          }
        }
      }
    } catch {
      // IndexedDB not available (test environment) — non-critical
    }

    // Long-term memory insights
    const memory = await this._getMemory();
    if (memory && memory.importantInsights.length > 0) {
      lines.push('');
      lines.push('--- Key Patterns Observed ---');
      for (const insight of memory.importantInsights.slice(0, 5)) {
        lines.push(`• ${insight}`);
      }
    }

    return lines.join('\n');
  }

  // ── Session Listing & Retrieval ─────────────────────────────

  /**
   * List past sessions, most recent first.
   */
  async listSessions(limit = 10): Promise<ConversationSession[]> {
    try {
      const db = await this._getDB();
      const sessions = await new Promise<ConversationSession[]>((resolve, reject) => {
        const tx = db.transaction(SESSIONS_STORE, 'readonly');
        const req = tx.objectStore(SESSIONS_STORE).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });

      return sessions
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, limit);
    } catch {
      return [];
    }
  }

  /**
   * Get a specific session by ID.
   */
  async getSession(id: string): Promise<ConversationSession | null> {
    try {
      const db = await this._getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(SESSIONS_STORE, 'readonly');
        const req = tx.objectStore(SESSIONS_STORE).get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return null;
    }
  }

  /**
   * Delete a session.
   */
  async deleteSession(id: string): Promise<void> {
    try {
      const db = await this._getDB();
      const tx = db.transaction(SESSIONS_STORE, 'readwrite');
      tx.objectStore(SESSIONS_STORE).delete(id);
      
      if (this._currentSession?.id === id) {
        this._currentSession = null;
      }
    } catch {
      // Non-critical
    }
  }

  // ── Long-Term Memory ────────────────────────────────────────

  /**
   * Extract and persist key insights across all sessions.
   * Call periodically (e.g., on session end or app boot).
   */
  async extractKeyInsights(): Promise<string[]> {
    const sessions = await this.listSessions(20);
    const topicCounts = new Map<string, number>();
    const insights: string[] = [];

    for (const session of sessions) {
      const allText = session.messages
        .map(m => m.content.toLowerCase())
        .join(' ');

      // Count topic mentions
      for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
        for (const keyword of keywords) {
          if (allText.includes(keyword)) {
            topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
            break; // Count each topic once per session
          }
        }
      }

      // Collect session insights
      if (session.keyInsights.length > 0) {
        insights.push(...session.keyInsights);
      }
    }

    // Generate insights from recurring topics
    const sorted = [...topicCounts.entries()]
      .sort((a, b) => b[1] - a[1]);

    const topInsights: string[] = [];

    for (const [topic, count] of sorted) {
      if (count >= 2) {
        topInsights.push(`Recurring topic: "${topic}" (discussed in ${count} sessions)`);
      }
    }

    // Merge with per-session insights (deduplicate)
    const allInsights = [...new Set([...topInsights, ...insights])].slice(0, 10);

    // Persist to long-term memory
    const memory: LongTermMemory = {
      recurringTopics: topicCounts,
      importantInsights: allInsights,
      lastUpdated: Date.now(),
    };
    await this._saveMemory(memory);
    this._memoryCache = memory;

    return allInsights;
  }

  /**
   * Get the current session's message count.
   */
  get messageCount(): number {
    return this._currentSession?.messages.length || 0;
  }

  /**
   * Get the current session ID.
   */
  get currentSessionId(): string | null {
    return this._currentSession?.id || null;
  }

  /**
   * Reset all conversation data.
   */
  async reset(): Promise<void> {
    this._currentSession = null;
    this._memoryCache = null;
    try {
      const db = await this._getDB();
      const tx = db.transaction([SESSIONS_STORE, MEMORY_STORE], 'readwrite');
      tx.objectStore(SESSIONS_STORE).clear();
      tx.objectStore(MEMORY_STORE).clear();
    } catch {
      // Non-critical
    }
  }

  // ── Summary & Insight Generation ────────────────────────────

  /**
   * Generate a concise summary of a session (rule-based, no LLM).
   */
  _generateSessionSummary(session: ConversationSession): string {
    const msgs = session.messages;
    if (msgs.length === 0) return '';

    const userMsgs = msgs.filter(m => m.role === 'user');
    const aiMsgs = msgs.filter(m => m.role === 'assistant');

    // Extract key topics from user questions
    const topics: string[] = [];
    for (const msg of userMsgs) {
      const lower = msg.content.toLowerCase();
      for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
        if (keywords.some(k => lower.includes(k)) && !topics.includes(topic)) {
          topics.push(topic);
        }
      }
    }

    // Extract mentioned symbols
    const symbols = new Set<string>();
    for (const msg of msgs) {
      const matches = msg.content.match(/\b[A-Z]{2,6}(?:USDT|USD|BTC|ETH)?\b/g);
      if (matches) {
        for (const m of matches) {
          if (m.length >= 3 && !['THE', 'AND', 'FOR', 'BUT', 'NOT', 'YOU', 'ARE', 'WAS', 'HAS', 'HAD', 'HIS', 'HER', 'CAN', 'ALL', 'DID', 'GET', 'HIM'].includes(m)) {
            symbols.add(m);
          }
        }
      }
    }

    const parts: string[] = [];
    parts.push(`${userMsgs.length} questions, ${aiMsgs.length} responses`);

    if (symbols.size > 0) {
      parts.push(`symbols: ${[...symbols].slice(0, 3).join(', ')}`);
    }

    if (topics.length > 0) {
      parts.push(`topics: ${topics.slice(0, 3).join(', ')}`);
    }

    return parts.join(' | ');
  }

  /**
   * Extract insights from a single session's messages.
   */
  _extractSessionInsights(session: ConversationSession): string[] {
    const insights: string[] = [];
    const aiMessages = session.messages.filter(m => m.role === 'assistant');

    for (const msg of aiMessages) {
      const lower = msg.content.toLowerCase();

      // Look for actionable phrases
      const actionPatterns = [
        /you (should|could|might want to) (.{20,80})/i,
        /consider (.{20,80})/i,
        /your (biggest|main|primary) (weakness|strength|edge|pattern) .{10,80}/i,
        /stop (loss|trading) .{10,60}/i,
      ];

      for (const pattern of actionPatterns) {
        const match = lower.match(pattern);
        if (match) {
          // Capitalize first letter and truncate
          const insight = msg.content.slice(
            match.index || 0,
            (match.index || 0) + 100,
          ).trim();
          if (insight.length > 15) {
            insights.push(insight);
          }
          break; // One insight per message
        }
      }
    }

    return [...new Set(insights)].slice(0, 5);
  }

  // ── IndexedDB ───────────────────────────────────────────────

  private _getDB(): Promise<IDBDatabase> {
    if (this._dbPromise) return this._dbPromise;

    this._dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
          db.createObjectStore(SESSIONS_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(MEMORY_STORE)) {
          db.createObjectStore(MEMORY_STORE, { keyPath: 'key' });
        }
      };

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    return this._dbPromise;
  }

  private async _saveSession(session: ConversationSession): Promise<void> {
    try {
      const db = await this._getDB();
      const tx = db.transaction(SESSIONS_STORE, 'readwrite');
      tx.objectStore(SESSIONS_STORE).put(session);
    } catch {
      // IndexedDB save failed — non-critical
    }
  }

  private async _getMemory(): Promise<LongTermMemory | null> {
    if (this._memoryCache) return this._memoryCache;

    try {
      const db = await this._getDB();
      const result = await new Promise<{ key: string; data: LongTermMemory } | undefined>(
        (resolve, reject) => {
          const tx = db.transaction(MEMORY_STORE, 'readonly');
          const req = tx.objectStore(MEMORY_STORE).get(MEMORY_KEY);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        },
      );

      if (result?.data) {
        this._memoryCache = result.data;
        return result.data;
      }
    } catch {
      // Non-critical
    }

    return null;
  }

  private async _saveMemory(memory: LongTermMemory): Promise<void> {
    try {
      const db = await this._getDB();
      const tx = db.transaction(MEMORY_STORE, 'readwrite');
      // Serialize Map to plain object for storage
      const serialized = {
        key: MEMORY_KEY,
        data: {
          ...memory,
          recurringTopics: Object.fromEntries(memory.recurringTopics),
        },
      };
      tx.objectStore(MEMORY_STORE).put(serialized);
    } catch {
      // Non-critical
    }
  }
}

// ─── Singleton ──────────────────────────────────────────────────

export const conversationMemory = new ConversationMemory();
export default conversationMemory;
