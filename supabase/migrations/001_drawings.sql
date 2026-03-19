-- ═══════════════════════════════════════════════════════════════════
-- charEdge — Sprint 6 Task 6.2: Drawings Cloud Sync Table
--
-- Stores per-user, per-symbol/tf drawing records for cross-device sync.
-- Uses RLS so users can only access their own drawings.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS drawings (
  id          TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol      TEXT NOT NULL,
  tf          TEXT NOT NULL,
  drawings    JSONB NOT NULL DEFAULT '[]'::jsonb,
  version     INTEGER DEFAULT 1,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_drawings_user ON drawings(user_id);
CREATE INDEX IF NOT EXISTS idx_drawings_user_symbol ON drawings(user_id, symbol);

-- Row-Level Security: users can only read/write their own drawings
ALTER TABLE drawings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own drawings"
  ON drawings
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
