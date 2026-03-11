// ═══════════════════════════════════════════════════════════════════
// charEdge — Trade Replay Panel
//
// Dashboard widget that lets users pick a recent trade and replay it.
// Shows a compact list of replayable trades with entry details, then
// launches the full chart replay mode on click.
// ═══════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import { C, F, M } from '../../../constants.js';
import { useJournalStore } from '../../../state/useJournalStore';
import { fmtD } from '../../../utils.js';
import { Card } from '../../components/ui/UIKit.jsx';
import { launchTradeReplay } from '../../features/journal/journal_ui/TradeReplay.js';

export default function TradeReplayPanel() {
  const trades = useJournalStore((s) => s.trades);
  const [hovered, setHovered] = useState(null);

  // Show most recent trades with enough data to replay
  const replayable = useMemo(() => {
    return [...trades]
      .filter((t) => t.symbol && t.date) // Must have symbol and date at minimum
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 6);
  }, [trades]);

  if (replayable.length === 0) {
    return (
      <Card style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 16 }}>⏪</span>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: F }}>Trade Replay</div>
        </div>
        <div style={{ fontSize: 12, color: C.t3, fontFamily: F }}>
          Add trades to replay them on the chart with step-by-step playback.
        </div>
      </Card>
    );
  }

  const handleReplay = (trade) => {
    launchTradeReplay(trade, { replayMode: true, highlightTrade: true });
  };

  const handleViewChart = (trade) => {
    launchTradeReplay(trade, { replayMode: false, highlightTrade: true });
  };

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div
        style={{
          padding: '14px 20px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${C.bd}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16 }}>⏪</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: F }}>Trade Replay</div>
            <div style={{ fontSize: 10, color: C.t3, fontFamily: M }}>
              Click to replay on chart · Step through bar-by-bar
            </div>
          </div>
        </div>
      </div>

      {/* Trade List */}
      <div style={{ maxHeight: 280, overflowY: 'auto' }}>
        {replayable.map((trade, i) => {
          const pnl = trade.pnl || 0;
          const isHovered = hovered === trade.id;
          return (
            <div
              key={trade.id || i}
              onMouseEnter={() => setHovered(trade.id)}
              onMouseLeave={() => setHovered(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 20px',
                borderBottom: i < replayable.length - 1 ? `1px solid ${C.bd}30` : 'none',
                background: isHovered ? C.b + '08' : 'transparent',
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onClick={() => handleReplay(trade)}
            >
              {/* Trade info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    color: trade.side === 'long' ? C.g : C.r,
                    textTransform: 'uppercase',
                    fontFamily: M,
                    minWidth: 36,
                  }}
                >
                  {trade.side || '—'}
                </span>
                <span style={{ fontWeight: 700, fontSize: 13, color: C.t1, fontFamily: F }}>
                  {trade.symbol}
                </span>
                <span style={{ fontSize: 10, color: C.t3, fontFamily: M }}>
                  {trade.date
                    ? new Date(trade.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })
                    : ''}
                </span>
                {trade.playbook && (
                  <span
                    style={{
                      fontSize: 9,
                      padding: '1px 6px',
                      borderRadius: 4,
                      background: C.b + '12',
                      color: C.b,
                      fontFamily: M,
                    }}
                  >
                    {trade.playbook}
                  </span>
                )}
              </div>

              {/* Right side */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: 12,
                    fontFamily: M,
                    color: pnl >= 0 ? C.g : C.r,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {fmtD(pnl)}
                </span>
                {isHovered && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReplay(trade);
                      }}
                      style={{
                        padding: '3px 8px',
                        borderRadius: 4,
                        background: C.b,
                        color: '#fff',
                        border: 'none',
                        fontSize: 9,
                        fontWeight: 700,
                        fontFamily: M,
                        cursor: 'pointer',
                      }}
                    >
                      ▶ Replay
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewChart(trade);
                      }}
                      style={{
                        padding: '3px 8px',
                        borderRadius: 4,
                        background: 'transparent',
                        border: `1px solid ${C.bd}`,
                        color: C.t2,
                        fontSize: 9,
                        fontWeight: 700,
                        fontFamily: M,
                        cursor: 'pointer',
                      }}
                    >
                      📈 Chart
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer tip */}
      <div
        style={{
          padding: '8px 20px',
          borderTop: `1px solid ${C.bd}`,
          fontSize: 10,
          color: C.t3,
          fontFamily: M,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span style={{ fontSize: 8 }}>💡</span>
        Use ▶ Replay to step through bar-by-bar · Place ghost trades to test alternate decisions
      </div>
    </Card>
  );
}
