// ═══════════════════════════════════════════════════════════════════
// charEdge — Social Proof & Validation Layer
//
// Sprint 19: Community consensus overlay for research validation.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useState } from 'react';
import { C } from '../../../constants.js';
import { alpha } from '@/shared/colorUtils';
import st from './SocialValidation.module.css';

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

function SocialValidation() {
  const [collapsed, setCollapsed] = useState(false);
  const [tab, setTab] = useState('consensus');

  return (
    <div className={st.card} style={{ background: C.bg2, border: `1px solid ${C.bd}` }}>
      <button onClick={() => setCollapsed(!collapsed)} className={`tf-btn ${st.headerBtn}`}>
        <div className={st.headerLeft}>
          <span className={st.headerIcon}>🏆</span>
          <h3 className={st.headerTitle}>Community Validation</h3>
          <span className={st.badge} style={{ color: C.p, background: alpha(C.p, 0.1) }}>
            {MOCK_SYMBOLS.reduce((s, m) => s + m.watchers, 0).toLocaleString()} watchers
          </span>
        </div>
        <span className={st.chevron} style={{ color: C.t3, transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)' }}>▾</span>
      </button>

      {!collapsed && (
        <div className={st.body}>
          <div className={st.tabRow}>
            {[{ id: 'consensus', label: '📊 Community Consensus' }, { id: 'ideas', label: '🏆 Top Ideas This Week' }].map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} className={`tf-btn ${st.tabBtn}`}
                style={{ border: `1px solid ${tab === t.id ? C.b : 'transparent'}`, background: tab === t.id ? alpha(C.b, 0.08) : 'transparent', color: tab === t.id ? C.b : C.t3 }}>
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'consensus' ? (
            <div className={st.list}>
              {MOCK_SYMBOLS.map((sym) => {
                const convColor = sym.conviction >= 70 ? C.g : sym.conviction >= 50 ? C.y : C.r;
                return (
                  <div key={sym.symbol} className={st.consRow} style={{ background: alpha(C.sf, 0.5), border: `1px solid ${alpha(C.bd, 0.4)}` }}>
                    <div className={st.consMain}>
                      <div className={st.symCol}>
                        <div className={st.symName}>{sym.symbol}</div>
                        <div className={st.watchCount} style={{ color: C.t3 }}>👀 {sym.watchers.toLocaleString()}</div>
                      </div>
                      <div className={st.voteWrap}>
                        <div className={st.voteTrack}>
                          <div className={st.voteBull} style={{ width: `${sym.bullVotes}%`, background: C.g }} />
                          <div style={{ flex: 1, background: C.r }} />
                        </div>
                        <div className={st.voteLegend}>
                          <span className={st.voteLabel} style={{ color: C.g }}>🐂 {sym.bullVotes}%</span>
                          <span className={st.voteLabel} style={{ color: C.r }}>🐻 {sym.bearVotes}%</span>
                        </div>
                      </div>
                      <div className={st.convCol}>
                        <div className={st.convValue} style={{ color: convColor }}>{sym.conviction}</div>
                        <div className={st.convLabel} style={{ color: C.t3 }}>Conviction</div>
                      </div>
                    </div>
                    <div className={st.ideaRow} style={{ background: alpha(C.sf, 0.3) }}>
                      <span className={st.ideaIcon} style={{ color: C.t3 }}>💡</span>
                      <div className={st.ideaText} style={{ color: C.t2 }}>{sym.topIdea}</div>
                      <span className={st.ideaAuthor} style={{ color: C.t3 }}>@{sym.ideaAuthor}</span>
                      <span className={st.ideaReturn} style={{ color: sym.ideaReturn.startsWith('+') ? C.g : C.r }}>{sym.ideaReturn}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={st.list}>
              {TOP_IDEAS.map((idea) => (
                <div key={idea.rank} className={st.rankRow}
                  style={{ background: alpha(C.sf, idea.rank === 1 ? 0.7 : 0.4), border: `1px solid ${idea.rank === 1 ? alpha(C.y, 0.2) : alpha(C.bd, 0.3)}` }}>
                  <span className={st.rankNum} style={{ color: idea.rank === 1 ? C.y : idea.rank === 2 ? '#c0c0c0' : '#cd7f32' }}>#{idea.rank}</span>
                  <div className={st.rankBody}>
                    <div className={st.rankTitle}>{idea.title}</div>
                    <div className={st.rankMeta} style={{ color: C.t3 }}>@{idea.author} · ${idea.symbol}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className={st.rankReturn} style={{ color: idea.return.startsWith('+') ? C.g : C.r }}>{idea.return}</div>
                    <div className={st.rankVotes} style={{ color: C.t3 }}>👍 {idea.votes}</div>
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
export default React.memo(SocialValidation);
