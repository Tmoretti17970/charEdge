// ═══════════════════════════════════════════════════════════════════
// charEdge — AI Journal Digest (Sprint 27)
//
// Collapsible card above trade list showing:
//  - Weekly summary (win rate, best/worst day, dominant setup, streaks)
//  - Auto-tag pills per trade
//  - Similar trade finder
// Powered by JournalIntelligence.js engine.
// ═══════════════════════════════════════════════════════════════════

import { useState, useMemo, useCallback, memo } from 'react';
import { C, F, M } from '../../../constants.js';
import { radii, transition } from '../../../theme/tokens.js';
import { journalIntelligence } from '../../../charting_library/ai/JournalIntelligence.js';

// ─── Tag Colors ─────────────────────────────────────────────────

const TAG_COLORS = {
  A: C.g, B: '#22d3ee', C: C.y, D: C.r,
  breakout: '#c084fc', reversal: '#f472b6', continuation: C.b,
  range: C.t3, momentum: '#f0b64e', mean_reversion: '#22d3ee',
};

// ─── Trade Tag Pill ──────────────────────────────────────────────

export function TradeTagPill({ label, color }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '2px 8px', borderRadius: 12,
      background: (color || C.t3) + '18',
      color: color || C.t3,
      fontSize: 10, fontWeight: 600, fontFamily: M,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

// ─── Auto-Tag Row ────────────────────────────────────────────────

export function AutoTagRow({ trade, features }) {
  const result = useMemo(() =>
    journalIntelligence.autoTag(trade, features || {}),
    [trade, features]
  );

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
      <TradeTagPill
        label={`Grade ${result.quality}`}
        color={TAG_COLORS[result.quality]}
      />
      {result.tags.map((tag, i) => (
        <TradeTagPill
          key={i}
          label={tag}
          color={TAG_COLORS[result.setupType] || C.t3}
        />
      ))}
      {result.emotion !== 'neutral' && (
        <TradeTagPill
          label={result.emotion.toUpperCase()}
          color={result.emotion === 'fomo' ? C.r : C.y}
        />
      )}
    </div>
  );
}

// ─── Similar Trade Card ──────────────────────────────────────────

function SimilarTradeCard({ trade }) {
  return (
    <div style={{
      padding: '8px 10px', borderRadius: radii.md,
      background: C.bg2, marginBottom: 6,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      fontSize: 11, fontFamily: F,
    }}>
      <div>
        <span style={{ fontWeight: 700, color: C.t1 }}>{trade.symbol}</span>
        <span style={{ color: C.t3, marginLeft: 6 }}>{trade.side}</span>
        {trade.date && (
          <span style={{ color: C.t3, marginLeft: 6, fontSize: 10 }}>
            {new Date(trade.date).toLocaleDateString()}
          </span>
        )}
      </div>
      <div style={{
        fontWeight: 700, fontFamily: M,
        color: (trade.pnl || 0) >= 0 ? C.g : C.r,
      }}>
        {(trade.pnl || 0) >= 0 ? '+' : ''}{(trade.pnl || 0).toFixed(2)}
      </div>
    </div>
  );
}

// ─── Weekly Summary Section ──────────────────────────────────────

function WeeklySummary({ digest }) {
  if (!digest) return null;
  return (
    <div style={{ marginBottom: 14 }}>
      {/* Stats Row */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 8, marginBottom: 10,
      }}>
        {[
          { label: 'TRADES', value: digest.totalTrades, color: C.t1 },
          { label: 'WIN RATE', value: `${(digest.winRate * 100).toFixed(0)}%`, color: digest.winRate >= 0.5 ? C.g : C.r },
          { label: 'NET P&L', value: `$${(digest.netPnl || 0).toFixed(0)}`, color: (digest.netPnl || 0) >= 0 ? C.g : C.r },
          { label: 'BEST DAY', value: `$${(digest.bestDayPnl || 0).toFixed(0)}`, color: C.g },
        ].map((s) => (
          <div key={s.label} style={{
            textAlign: 'center', padding: '8px 4px',
            borderRadius: radii.md, background: C.bg2,
          }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: C.t3, fontFamily: M }}>{s.label}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: s.color, marginTop: 2 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Narrative */}
      {digest.narrative && (
        <div style={{
          fontSize: 12, color: C.t2, fontFamily: F,
          padding: '10px 12px', borderRadius: radii.md,
          background: `${C.b}08`, borderLeft: `3px solid ${C.b}`,
          lineHeight: 1.5,
        }}>
          💡 {digest.narrative}
        </div>
      )}

      {/* Dominant Setup */}
      {digest.dominantSetup && (
        <div style={{
          fontSize: 11, color: C.t3, fontFamily: M, marginTop: 8,
        }}>
          Top setup: <span style={{ color: C.t1, fontWeight: 700 }}>{digest.dominantSetup}</span>
          {digest.avgHoldMinutes > 0 && (
            <> · Avg hold: <span style={{ color: C.t1 }}>{digest.avgHoldMinutes.toFixed(0)}min</span></>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Digest Component ───────────────────────────────────────

function AIJournalDigest({ trades, features }) {
  const [collapsed, setCollapsed] = useState(false);
  const [similarTarget, setSimilarTarget] = useState(null);

  const weeklyDigest = useMemo(() => {
    if (!trades || trades.length === 0) return null;
    try {
      return journalIntelligence.weeklyDigest(trades);
    } catch { return null; }
  }, [trades]);

  const similarTrades = useMemo(() => {
    if (!similarTarget || !trades) return [];
    try {
      return journalIntelligence.findSimilar(similarTarget, trades, 3);
    } catch { return []; }
  }, [similarTarget, trades]);

  const handleFindSimilar = useCallback((trade) => {
    setSimilarTarget((prev) => prev === trade ? null : trade);
  }, []);

  if (!trades || trades.length === 0) return null;

  return (
    <div style={{
      borderRadius: radii.lg,
      border: `1px solid ${C.bd}`,
      background: C.sf,
      marginBottom: 16,
      overflow: 'hidden',
      animation: 'tf-fade-in 0.3s ease-out',
    }}>
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          background: 'none', border: 'none',
          cursor: 'pointer', fontFamily: F,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>🧠</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>AI Journal Digest</span>
          <span style={{
            fontSize: 10, fontFamily: M, color: C.b,
            padding: '2px 6px', borderRadius: 8,
            background: `${C.b}15`,
          }}>
            {trades.length} trades
          </span>
        </div>
        <span style={{ color: C.t3, fontSize: 12, transition: transition.fast }}>
          {collapsed ? '▸' : '▾'}
        </span>
      </button>

      {/* Content */}
      {!collapsed && (
        <div style={{ padding: '0 16px 16px' }}>
          {/* Weekly Summary */}
          <WeeklySummary digest={weeklyDigest} />

          {/* Similar Trades (when active) */}
          {similarTarget && (
            <div style={{ marginBottom: 14 }}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: C.t3,
                fontFamily: M, textTransform: 'uppercase', marginBottom: 6,
              }}>
                Similar to {similarTarget.symbol} trade
              </div>
              {similarTrades.length > 0 ? (
                similarTrades.map((t, i) => <SimilarTradeCard key={i} trade={t} />)
              ) : (
                <div style={{ fontSize: 11, color: C.t3 }}>No similar trades found.</div>
              )}
              <button
                onClick={() => setSimilarTarget(null)}
                style={{
                  fontSize: 10, color: C.t3, background: 'none',
                  border: 'none', cursor: 'pointer', padding: '4px 0',
                  fontFamily: F, textDecoration: 'underline',
                }}
              >
                Clear
              </button>
            </div>
          )}

          {/* Recent Trades with Auto-Tags */}
          <div style={{
            fontSize: 10, fontWeight: 700, color: C.t3,
            fontFamily: M, textTransform: 'uppercase', marginBottom: 6,
          }}>
            Recent Trade Tags
          </div>
          {trades.slice(0, 5).map((trade, i) => (
            <div key={trade.id || i} style={{
              padding: '8px 10px', borderRadius: radii.md,
              background: C.bg2, marginBottom: 6,
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.t1, fontFamily: F }}>
                  {trade.symbol}
                  <span style={{ fontWeight: 400, color: C.t3, marginLeft: 6, fontSize: 10 }}>
                    {trade.side}
                  </span>
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    fontSize: 12, fontWeight: 700, fontFamily: M,
                    color: (trade.pnl || 0) >= 0 ? C.g : C.r,
                  }}>
                    {(trade.pnl || 0) >= 0 ? '+' : ''}{(trade.pnl || 0).toFixed(2)}
                  </span>
                  <button
                    onClick={() => handleFindSimilar(trade)}
                    title="Find similar trades"
                    style={{
                      background: 'none', border: `1px solid ${C.bd}`,
                      borderRadius: radii.sm, padding: '2px 6px',
                      fontSize: 9, color: C.t3, cursor: 'pointer',
                      fontFamily: M, transition: transition.fast,
                    }}
                  >
                    🔍
                  </button>
                </div>
              </div>
              <AutoTagRow trade={trade} features={features?.[trade.id]} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default memo(AIJournalDigest);
