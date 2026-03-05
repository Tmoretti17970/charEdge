// ═══════════════════════════════════════════════════════════════════
// charEdge — Social Proof & Validation Layer
//
// Sprint 19: Community consensus overlay for research validation.
// ═══════════════════════════════════════════════════════════════════

import { useState, useMemo } from 'react';
import { C, F, M } from '../../../constants.js';
import { alpha } from '../../../utils/colorUtils.js';

const MOCK_SYMBOLS = [
  { symbol: 'NVDA', watchers: 1842, bullVotes: 78, bearVotes: 22, conviction: 89, topIdea: 'AI capex cycle accelerating — $1000 by June', ideaAuthor: 'CryptoKing', ideaReturn: '+12.4%' },
  { symbol: 'TSLA', watchers: 2415, bullVotes: 55, bearVotes: 45, conviction: 52, topIdea: 'Model Q launch = TAM expansion to $30K segment', ideaAuthor: 'SwingMaster', ideaReturn: '+4.8%' },
  { symbol: 'SPY', watchers: 3820, bullVotes: 48, bearVotes: 52, conviction: 45, topIdea: 'Fed pivot delayed — range-bound until March FOMC', ideaAuthor: 'MacroAlpha', ideaReturn: '-1.2%' },
  { symbol: 'BTC', watchers: 2190, bullVotes: 82, bearVotes: 18, conviction: 91, topIdea: 'ETF inflows + halving cycle = $85K target', ideaAuthor: 'NightOwl', ideaReturn: '+22.1%' },
  { symbol: 'META', watchers: 945, bullVotes: 72, bearVotes: 28, conviction: 78, topIdea: 'Ad revenue reacceleration + AI integration moat', ideaAuthor: 'ValueHunter', ideaReturn: '+8.6%' },
  { symbol: 'AAPL', watchers: 1560, bullVotes: 42, bearVotes: 58, conviction: 38, topIdea: 'EU fines + China slowdown = headwinds', ideaAuthor: 'BearishBob', ideaReturn: '-3.4%' },
];

const TOP_IDEAS = [
  { rank: 1, author: 'CryptoKing', symbol: 'NVDA', title: 'AI Infrastructure Bull Case', return: '+12.4%', votes: 342 },
  { rank: 2, author: 'NightOwl', symbol: 'BTC', title: 'Post-Halving Cycle Analysis', return: '+22.1%', votes: 289 },
  { rank: 3, author: 'MacroAlpha', symbol: 'GLD', title: 'Gold as Inflation Hedge 2026', return: '+6.2%', votes: 215 },
];

export default function SocialValidation() {
  const [collapsed, setCollapsed] = useState(false);
  const [tab, setTab] = useState('consensus'); // 'consensus' | 'ideas'

  return (
    <div style={{ background: C.bg2, border: `1px solid ${C.bd}`, borderRadius: 16, overflow: 'hidden' }}>
      <button onClick={() => setCollapsed(!collapsed)} className="tf-btn"
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: 'transparent', border: 'none', cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>🏆</span>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.t1, fontFamily: F }}>Community Validation</h3>
          <span style={{ fontSize: 10, fontWeight: 700, color: C.p, background: alpha(C.p, 0.1), padding: '2px 7px', borderRadius: 4, fontFamily: M }}>
            {MOCK_SYMBOLS.reduce((s, m) => s + m.watchers, 0).toLocaleString()} watchers
          </span>
        </div>
        <span style={{ color: C.t3, fontSize: 11, transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.2s ease' }}>▾</span>
      </button>

      {!collapsed && (
        <div style={{ padding: '0 20px 20px' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {[{ id: 'consensus', label: '📊 Community Consensus' }, { id: 'ideas', label: '🏆 Top Ideas This Week' }].map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} className="tf-btn"
                style={{ padding: '5px 14px', borderRadius: 8, border: `1px solid ${tab === t.id ? C.b : 'transparent'}`, background: tab === t.id ? alpha(C.b, 0.08) : 'transparent', color: tab === t.id ? C.b : C.t3, cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: F }}>
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'consensus' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {MOCK_SYMBOLS.map((sym) => {
                const convColor = sym.conviction >= 70 ? C.g : sym.conviction >= 50 ? C.y : C.r;
                return (
                  <div key={sym.symbol} style={{ padding: '12px 14px', background: alpha(C.sf, 0.5), border: `1px solid ${alpha(C.bd, 0.4)}`, borderRadius: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                      <div style={{ minWidth: 55 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.t1, fontFamily: F }}>{sym.symbol}</div>
                        <div style={{ fontSize: 9, color: C.t3, fontFamily: F }}>👀 {sym.watchers.toLocaleString()}</div>
                      </div>

                      {/* Bull/Bear Vote Bar */}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ width: `${sym.bullVotes}%`, background: C.g, transition: 'width 0.3s' }} />
                          <div style={{ flex: 1, background: C.r }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                          <span style={{ fontSize: 9, color: C.g, fontFamily: M, fontWeight: 600 }}>🐂 {sym.bullVotes}%</span>
                          <span style={{ fontSize: 9, color: C.r, fontFamily: M, fontWeight: 600 }}>🐻 {sym.bearVotes}%</span>
                        </div>
                      </div>

                      {/* Conviction */}
                      <div style={{ textAlign: 'center', minWidth: 50 }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: convColor, fontFamily: M }}>{sym.conviction}</div>
                        <div style={{ fontSize: 8, color: C.t3, fontFamily: F }}>Conviction</div>
                      </div>
                    </div>

                    {/* Top Idea */}
                    <div style={{ padding: '8px 10px', background: alpha(C.sf, 0.3), borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 9, color: C.t3, fontFamily: F }}>💡</span>
                      <div style={{ flex: 1, fontSize: 10, color: C.t2, fontFamily: F }}>{sym.topIdea}</div>
                      <span style={{ fontSize: 9, fontWeight: 600, color: C.t3, fontFamily: F }}>@{sym.ideaAuthor}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: sym.ideaReturn.startsWith('+') ? C.g : C.r, fontFamily: M }}>{sym.ideaReturn}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {TOP_IDEAS.map((idea) => (
                <div key={idea.rank} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: alpha(C.sf, idea.rank === 1 ? 0.7 : 0.4), border: `1px solid ${idea.rank === 1 ? alpha(C.y, 0.2) : alpha(C.bd, 0.3)}`, borderRadius: 10 }}>
                  <span style={{ fontSize: 18, fontWeight: 700, color: idea.rank === 1 ? C.y : idea.rank === 2 ? '#c0c0c0' : '#cd7f32', fontFamily: M }}>#{idea.rank}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.t1, fontFamily: F }}>{idea.title}</div>
                    <div style={{ fontSize: 10, color: C.t3, fontFamily: F }}>@{idea.author} · ${idea.symbol}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: idea.return.startsWith('+') ? C.g : C.r, fontFamily: M }}>{idea.return}</div>
                    <div style={{ fontSize: 9, color: C.t3, fontFamily: F }}>👍 {idea.votes}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { SocialValidation };
