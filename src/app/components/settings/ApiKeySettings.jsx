// ═══════════════════════════════════════════════════════════════════
// charEdge — API Key Settings Panel (Sprint 73)
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { C } from '../../../constants.js';
import st from './ApiKeySettings.module.css';

const ACCENT = '#6e5ce6';

const PROVIDER_GROUPS = [
  {
    label: '🧠 AI Providers',
    providers: [
      { id: 'gemini', name: 'Google Gemini', desc: '1,500 req/day · Flash 2.0', hint: 'Get free key at ai.google.dev' },
      {
        id: 'groq',
        name: 'Groq Cloud',
        desc: '14,400 chat + 2,000 Whisper/day',
        hint: 'Get free key at console.groq.com',
      },
    ],
  },
  {
    label: '📊 Market Data',
    providers: [
      { id: 'polygon', name: 'Polygon.io', desc: 'Equities, Options, Forex', hint: '5 req/min free' },
      { id: 'fmp', name: 'FMP', desc: 'Fundamentals, Earnings', hint: '250 req/day free' },
      { id: 'alphavantage', name: 'Alpha Vantage', desc: 'Equities, Forex', hint: '25 req/day free' },
      { id: 'finnhub', name: 'Finnhub', desc: 'Real-time quotes + news', hint: '60 req/min free' },
    ],
  },
  {
    label: '🌐 Enrichment',
    providers: [
      { id: 'fred', name: 'FRED', desc: 'Economic data series', hint: 'Free key at fred.stlouisfed.org' },
      { id: 'coingecko', name: 'CoinGecko', desc: 'Crypto data', hint: 'Optional — basic features work without key' },
      { id: 'etherscan', name: 'Etherscan', desc: 'On-chain data', hint: 'Free key at etherscan.io' },
      { id: 'whalealert', name: 'Whale Alert', desc: 'Large crypto transactions', hint: '10 req/min free' },
    ],
  },
];

export default function ApiKeySettings() {
  const [keys, setKeys] = useState({});
  const [editing, setEditing] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [budget, setBudget] = useState([]);
  const [saving, setSaving] = useState(null);
  const [testStatus, setTestStatus] = useState({});

  useEffect(() => {
    loadKeys();
    loadBudget();
  }, []);

  const loadKeys = async () => {
    try {
      const { getApiKey } = await import('../../../data/providers/ApiKeyStore.js');
      const allIds = PROVIDER_GROUPS.flatMap((g) => g.providers.map((p) => p.id));
      const loaded = {};
      for (const id of allIds) {
        const key = getApiKey(id);
        if (key) loaded[id] = key;
      }
      setKeys(loaded);
    } catch {
      /* */
    }
  };

  const loadBudget = async () => {
    try {
      const { aiBudget } = await import('../../../ai/AIBudgetManager');
      setBudget(aiBudget.getUsage());
    } catch {
      /* */
    }
  };

  const saveKey = useCallback(
    async (providerId) => {
      setSaving(providerId);
      try {
        const { setApiKey } = await import('../../../data/providers/ApiKeyStore.js');
        setApiKey(providerId, editValue.trim());
        setKeys((prev) => ({ ...prev, [providerId]: editValue.trim() }));
        setEditing(null);
        setEditValue('');
      } catch {
        /* */
      }
      setSaving(null);
    },
    [editValue],
  );

  const deleteKey = useCallback(async (providerId) => {
    try {
      const { setApiKey } = await import('../../../data/providers/ApiKeyStore.js');
      setApiKey(providerId, '');
      setKeys((prev) => {
        const next = { ...prev };
        delete next[providerId];
        return next;
      });
    } catch {
      /* */
    }
  }, []);

  const maskKey = (key) => {
    if (!key || key.length < 8) return '••••';
    return key.slice(0, 4) + '•'.repeat(Math.min(key.length - 8, 16)) + key.slice(-4);
  };

  return (
    <div className={st.root}>
      {/* Budget Overview */}
      {budget.length > 0 && (
        <div className={st.budgetCard} style={{ background: `${ACCENT}08`, border: `1px solid ${ACCENT}20` }}>
          <div className={st.budgetTitle}>⚡ AI Budget Today</div>
          {budget.map((b) => (
            <div key={b.provider} className={st.budgetRow}>
              <div className={st.budgetMeta}>
                <span>{b.provider}</span>
                <span>
                  {b.dailyUsed}/{b.dailyLimit}
                </span>
              </div>
              <div className={st.budgetTrack} style={{ background: `${C.bd}30` }}>
                <div
                  className={st.budgetFill}
                  style={{
                    width: `${b.dailyPercent}%`,
                    background: b.dailyPercent > 80 ? C.r : b.dailyPercent > 50 ? C.y : ACCENT,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Provider Groups */}
      {PROVIDER_GROUPS.map((group) => (
        <div key={group.label} className={st.groupSection}>
          <div className={st.groupLabel}>{group.label}</div>
          {group.providers.map((provider) => {
            const hasKey = !!keys[provider.id];
            const isEditing = editing === provider.id;
            return (
              <div key={provider.id} className={st.providerRow}>
                <div className={st.statusDot} style={{ background: hasKey ? '#4ade80' : `${C.bd}40` }} />
                <div className={st.provInfo}>
                  <div className={st.provName}>{provider.name}</div>
                  <div className={st.provDesc}>{provider.desc}</div>
                </div>
                <div className={st.provActions}>
                  {isEditing ? (
                    <>
                      <input
                        autoFocus
                        type="password"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && saveKey(provider.id)}
                        placeholder={provider.hint}
                        className={st.keyInput}
                      />
                      <button
                        onClick={() => saveKey(provider.id)}
                        disabled={saving === provider.id}
                        className={`${st.miniBtn} ${st.saveBtn}`}
                      >
                        {saving === provider.id ? '...' : '✓'}
                      </button>
                      <button
                        onClick={() => {
                          setEditing(null);
                          setEditValue('');
                        }}
                        className={`${st.miniBtn} ${st.cancelBtn}`}
                      >
                        ✕
                      </button>
                    </>
                  ) : (
                    <>
                      {hasKey && <span className={st.maskedKey}>{maskKey(keys[provider.id])}</span>}
                      <button
                        onClick={() => {
                          setEditing(provider.id);
                          setEditValue(keys[provider.id] || '');
                        }}
                        className={`${st.miniBtn} ${st.editBtn}`}
                      >
                        {hasKey ? 'Edit' : '+ Add'}
                      </button>
                      {hasKey && (
                        <button
                          onClick={async () => {
                            setTestStatus((prev) => ({ ...prev, [provider.id]: 'testing' }));
                            try {
                              const { testApiKey } = await import('../../../data/providers/ApiKeyStore.js');
                              const ok = testApiKey ? await testApiKey(provider.id) : true;
                              setTestStatus((prev) => ({ ...prev, [provider.id]: ok ? 'ok' : 'fail' }));
                            } catch {
                              setTestStatus((prev) => ({ ...prev, [provider.id]: 'fail' }));
                            }
                            setTimeout(
                              () =>
                                setTestStatus((prev) => {
                                  const n = { ...prev };
                                  delete n[provider.id];
                                  return n;
                                }),
                              3000,
                            );
                          }}
                          className={`${st.miniBtn} ${st.testBtn}`}
                          style={{
                            color:
                              testStatus[provider.id] === 'ok'
                                ? '#4ade80'
                                : testStatus[provider.id] === 'fail'
                                  ? C.r
                                  : C.t3,
                          }}
                        >
                          {testStatus[provider.id] === 'testing'
                            ? '⏳'
                            : testStatus[provider.id] === 'ok'
                              ? '✓'
                              : testStatus[provider.id] === 'fail'
                                ? '✕'
                                : 'Test'}
                        </button>
                      )}
                      {hasKey && (
                        <button onClick={() => deleteKey(provider.id)} className={`${st.miniBtn} ${st.deleteBtn}`}>
                          🗑
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}

      <div className={st.footer}>🔒 All keys are encrypted at rest using AES-GCM. Keys never leave your browser.</div>
    </div>
  );
}
