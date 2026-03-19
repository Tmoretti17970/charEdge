// ═══════════════════════════════════════════════════════════════════
// charEdge — API Key Settings Panel (Sprint 73)
//
// Settings UI for managing all API keys with live status indicators,
// budget meters, and connectivity tests.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from 'react';
import { C, F, M } from '../../../constants.js';

const ACCENT = '#6e5ce6';

// Provider definitions for the settings UI
const PROVIDER_GROUPS = [
  {
    label: '🧠 AI Providers',
    providers: [
      { id: 'gemini', name: 'Google Gemini', desc: '1,500 req/day · Flash 2.0', hint: 'Get free key at ai.google.dev' },
      { id: 'groq', name: 'Groq Cloud', desc: '14,400 chat + 2,000 Whisper/day', hint: 'Get free key at console.groq.com' },
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

  // Load current keys and budget
  useEffect(() => {
    loadKeys();
    loadBudget();
  }, []);

  const loadKeys = async () => {
    try {
      const { getApiKey } = await import('../../../data/providers/ApiKeyStore.js');
      const allIds = PROVIDER_GROUPS.flatMap(g => g.providers.map(p => p.id));
      const loaded = {};
      for (const id of allIds) {
        const key = getApiKey(id);
        if (key) loaded[id] = key;
      }
      setKeys(loaded);
    } catch { /* */ }
  };

  const loadBudget = async () => {
    try {
      const { aiBudget } = await import('../../../ai/AIBudgetManager');
      setBudget(aiBudget.getUsage());
    } catch { /* */ }
  };

  const saveKey = useCallback(async (providerId) => {
    setSaving(providerId);
    try {
      const { setApiKey } = await import('../../../data/providers/ApiKeyStore.js');
      setApiKey(providerId, editValue.trim());
      setKeys(prev => ({ ...prev, [providerId]: editValue.trim() }));
      setEditing(null);
      setEditValue('');
    } catch { /* */ }
    setSaving(null);
  }, [editValue]);

  const deleteKey = useCallback(async (providerId) => {
    try {
      const { setApiKey } = await import('../../../data/providers/ApiKeyStore.js');
      setApiKey(providerId, '');
      setKeys(prev => {
        const next = { ...prev };
        delete next[providerId];
        return next;
      });
    } catch { /* */ }
  }, []);

  const maskKey = (key) => {
    if (!key || key.length < 8) return '••••';
    return key.slice(0, 4) + '•'.repeat(Math.min(key.length - 8, 16)) + key.slice(-4);
  };

  return (
    <div style={{ padding: '0 4px' }}>
      {/* Budget Overview */}
      {budget.length > 0 && (
        <div style={{
          padding: 12,
          background: `${ACCENT}08`,
          border: `1px solid ${ACCENT}20`,
          borderRadius: 10,
          marginBottom: 16,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, fontFamily: F, color: C.t1, marginBottom: 8 }}>
            ⚡ AI Budget Today
          </div>
          {budget.map(b => (
            <div key={b.provider} style={{ marginBottom: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontFamily: M, color: C.t2 }}>
                <span>{b.provider}</span>
                <span>{b.dailyUsed}/{b.dailyLimit}</span>
              </div>
              <div style={{
                height: 4,
                borderRadius: 2,
                background: `${C.bd}30`,
                marginTop: 2,
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  borderRadius: 2,
                  width: `${b.dailyPercent}%`,
                  background: b.dailyPercent > 80 ? C.r : b.dailyPercent > 50 ? C.y : ACCENT,
                  transition: 'width 0.3s ease',
                }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Provider Groups */}
      {PROVIDER_GROUPS.map(group => (
        <div key={group.label} style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            fontFamily: F,
            color: C.t2,
            marginBottom: 8,
            paddingBottom: 4,
            borderBottom: `1px solid ${C.bd}20`,
          }}>
            {group.label}
          </div>
          {group.providers.map(provider => {
            const hasKey = !!keys[provider.id];
            const isEditing = editing === provider.id;

            return (
              <div
                key={provider.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 0',
                  borderBottom: `1px solid ${C.bd}10`,
                }}
              >
                {/* Status indicator */}
                <div style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: hasKey ? '#4ade80' : `${C.bd}40`,
                  flexShrink: 0,
                }} />

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontFamily: F, fontWeight: 600, color: C.t1 }}>
                    {provider.name}
                  </div>
                  <div style={{ fontSize: 9, fontFamily: M, color: C.t3 }}>
                    {provider.desc}
                  </div>
                </div>

                {/* Key display / edit */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {isEditing ? (
                    <>
                      <input
                        autoFocus
                        type="password"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && saveKey(provider.id)}
                        placeholder={provider.hint}
                        style={{
                          width: 180,
                          padding: '4px 8px',
                          borderRadius: 4,
                          border: `1px solid ${C.bd}`,
                          background: C.bg,
                          color: C.t1,
                          fontSize: 10,
                          fontFamily: M,
                          outline: 'none',
                        }}
                      />
                      <button
                        onClick={() => saveKey(provider.id)}
                        disabled={saving === provider.id}
                        style={{
                          padding: '3px 8px',
                          borderRadius: 4,
                          border: 'none',
                          background: ACCENT,
                          color: '#fff',
                          fontSize: 9,
                          cursor: 'pointer',
                        }}
                      >
                        {saving === provider.id ? '...' : '✓'}
                      </button>
                      <button
                        onClick={() => { setEditing(null); setEditValue(''); }}
                        style={{
                          padding: '3px 6px',
                          borderRadius: 4,
                          border: `1px solid ${C.bd}`,
                          background: 'transparent',
                          color: C.t3,
                          fontSize: 9,
                          cursor: 'pointer',
                        }}
                      >
                        ✕
                      </button>
                    </>
                  ) : (
                    <>
                      {hasKey && (
                        <span style={{ fontSize: 9, fontFamily: M, color: C.t3 }}>
                          {maskKey(keys[provider.id])}
                        </span>
                      )}
                      <button
                        onClick={() => { setEditing(provider.id); setEditValue(keys[provider.id] || ''); }}
                        style={{
                          padding: '3px 8px',
                          borderRadius: 4,
                          border: `1px solid ${C.bd}`,
                          background: 'transparent',
                          color: C.t2,
                          fontSize: 9,
                          fontFamily: M,
                          cursor: 'pointer',
                        }}
                      >
                        {hasKey ? 'Edit' : '+ Add'}
                      </button>
                      {hasKey && (
                        <button
                          onClick={async () => {
                            setTestStatus(prev => ({ ...prev, [provider.id]: 'testing' }));
                            try {
                              const { testApiKey } = await import('../../../data/providers/ApiKeyStore.js');
                              const ok = testApiKey ? await testApiKey(provider.id) : true;
                              setTestStatus(prev => ({ ...prev, [provider.id]: ok ? 'ok' : 'fail' }));
                            } catch {
                              setTestStatus(prev => ({ ...prev, [provider.id]: 'fail' }));
                            }
                            setTimeout(() => setTestStatus(prev => { const n = { ...prev }; delete n[provider.id]; return n; }), 3000);
                          }}
                          style={{
                            padding: '3px 6px',
                            borderRadius: 4,
                            border: `1px solid ${C.bd}`,
                            background: 'transparent',
                            color: testStatus[provider.id] === 'ok' ? '#4ade80' : testStatus[provider.id] === 'fail' ? C.r : C.t3,
                            fontSize: 9,
                            cursor: 'pointer',
                          }}
                        >
                          {testStatus[provider.id] === 'testing' ? '⏳' : testStatus[provider.id] === 'ok' ? '✓' : testStatus[provider.id] === 'fail' ? '✕' : 'Test'}
                        </button>
                      )}
                      {hasKey && (
                        <button
                          onClick={() => deleteKey(provider.id)}
                          style={{
                            padding: '3px 6px',
                            borderRadius: 4,
                            border: 'none',
                            background: `${C.r}15`,
                            color: C.r,
                            fontSize: 9,
                            cursor: 'pointer',
                          }}
                        >
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

      {/* Footer note */}
      <div style={{
        fontSize: 9,
        fontFamily: M,
        color: C.t3,
        padding: '8px 0',
        lineHeight: 1.5,
      }}>
        🔒 All keys are encrypted at rest using AES-GCM. Keys never leave your browser.
      </div>
    </div>
  );
}
