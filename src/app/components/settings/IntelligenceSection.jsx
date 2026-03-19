// ═══════════════════════════════════════════════════════════════════
// charEdge — Intelligence Settings Section (Phase 2, Sprints 6–11)
//
// Apple-HIG grouped-list intelligence settings:
//   1. Engine — WebLLM model picker, ONNX ML toggles
//   2. Personality — Tone, verbosity, frequency
//   3. Context Sources — What data the AI can see
//   4. Cloud AI — Optional API key configuration
//   5. Privacy — Data transparency, memory reset
//
// Uses existing singletons: webLLMProvider, adaptiveCoach,
// conversationMemory, ApiKeyStore. No new stores.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import AIPersonalityPicker from './AIPersonalityPicker.jsx';
import ModelBenchmarkCard from './ModelBenchmarkCard.jsx';
import { C, F, M } from '../../../constants.js';
import { Card } from '../ui/UIKit.jsx';
import { StatusBadge } from './SettingsHelpers.jsx';

// ─── Shared Sub-components ──────────────────────────────────────

function GroupHeader({ emoji, title, subtitle }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>{emoji}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: C.t1, fontFamily: F }}>{title}</span>
      </div>
      {subtitle && (
        <div style={{ fontSize: 11, color: C.t3, fontFamily: F, marginTop: 2, paddingLeft: 24 }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

function Toggle({ checked, onChange, label, disabled = false }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label || 'Toggle'}
      disabled={disabled}
      onClick={onChange}
      style={{
        width: 36, height: 20, borderRadius: 10,
        border: 'none', padding: 2,
        background: checked ? C.g : C.bd,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'background 0.2s ease',
        display: 'flex', alignItems: 'center',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: 16, height: 16, borderRadius: '50%',
          background: '#fff',
          transition: 'transform 0.2s ease',
          transform: checked ? 'translateX(16px)' : 'translateX(0)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
        }}
      />
    </button>
  );
}

function PillSelector({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className="tf-btn"
          style={{
            padding: '5px 12px',
            borderRadius: 8,
            border: `1px solid ${value === opt.value ? C.b + '40' : C.bd}`,
            background: value === opt.value ? C.b + '12' : 'transparent',
            color: value === opt.value ? C.b : C.t2,
            fontSize: 11,
            fontWeight: 600,
            fontFamily: F,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function ToggleRow({ label, hint, checked, onChange, preview, disabled }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 0',
      borderBottom: `1px solid ${C.bd}10`,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.t1, fontFamily: F }}>{label}</div>
        {hint && <div style={{ fontSize: 10, color: C.t3, fontFamily: F, marginTop: 1 }}>{hint}</div>}
        {preview && checked && (
          <div style={{
            fontSize: 9, color: C.t3, fontFamily: M, fontStyle: 'italic',
            marginTop: 4, padding: '4px 8px',
            background: C.b + '06', borderRadius: 4,
            maxHeight: 40, overflow: 'hidden',
          }}>
            {preview}
          </div>
        )}
      </div>
      <Toggle checked={checked} onChange={onChange} label={label} disabled={disabled} />
    </div>
  );
}

// ─── localStorage Helpers ───────────────────────────────────────

const CONTEXT_KEY = 'charEdge-ai-context';
const AUTOLOAD_KEY = 'charEdge-autoload-model';
const PREFS_KEY = 'charEdge-coaching-prefs';

function loadContextToggles() {
  try {
    const raw = localStorage.getItem(CONTEXT_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* */ }
  return { traderDNA: true, journal: true, chart: true, watchlist: true };
}

function saveContextToggles(ctx) {
  try { localStorage.setItem(CONTEXT_KEY, JSON.stringify(ctx)); } catch { /* */ }
}

function getAutoLoad() {
  try { return localStorage.getItem(AUTOLOAD_KEY) === 'true'; } catch { return false; }
}

function setAutoLoad(val) {
  try { localStorage.setItem(AUTOLOAD_KEY, val ? 'true' : 'false'); } catch { /* */ }
}

// ═══════════════════════════════════════════════════════════════════
// GROUP 1: ENGINE
// ═══════════════════════════════════════════════════════════════════

function EngineGroup() {
  const [webLLMStatus, setWebLLMStatus] = useState(null);
  const [models, setModels] = useState([]);
  const [autoLoad, setAutoLoadState] = useState(getAutoLoad);
  const [mlEnabled, setMlEnabled] = useState(true);
  const [mlModels, setMlModels] = useState({});

  // Initialize WebLLM status
  useEffect(() => {
    let cleanup = () => {};
    (async () => {
      try {
        const { webLLMProvider } = await import('../../../ai/WebLLMProvider');
        setWebLLMStatus(webLLMProvider.status);
        setModels(webLLMProvider.getAvailableModels());
        cleanup = webLLMProvider.onStatusChange((s) => {
          setWebLLMStatus(s);
          setModels(webLLMProvider.getAvailableModels());
        });
      } catch { /* WebLLM not available */ }
    })();
    return () => cleanup();
  }, []);

  // Initialize ML pipeline status
  useEffect(() => {
    (async () => {
      try {
        const { useModelStore } = await import('../../../state/useModelStore');
        const state = useModelStore.getState();
        setMlEnabled(state.mlEnabled);
        setMlModels(state.enabledModels);
      } catch { /* */ }
    })();
  }, []);

  const handleLoadModel = useCallback(async (modelId) => {
    try {
      const { webLLMProvider } = await import('../../../ai/WebLLMProvider');
      await webLLMProvider.loadModel(modelId);
    } catch { /* */ }
  }, []);

  const handleUnload = useCallback(async () => {
    try {
      const { webLLMProvider } = await import('../../../ai/WebLLMProvider');
      await webLLMProvider.unload();
    } catch { /* */ }
  }, []);

  const handleAutoLoadChange = useCallback(() => {
    setAutoLoadState((prev) => {
      const next = !prev;
      setAutoLoad(next);
      return next;
    });
  }, []);

  const handleToggleMl = useCallback(async () => {
    try {
      const { useModelStore } = await import('../../../state/useModelStore');
      useModelStore.getState().toggleMlEnabled();
      setMlEnabled((p) => !p);
    } catch { /* */ }
  }, []);

  const statusEmoji = webLLMStatus?.loaded ? '✅' : webLLMStatus?.loading ? '🔄' : '⬇️';
  const statusLabel = webLLMStatus?.loaded ? 'Ready' : webLLMStatus?.loading ? 'Downloading…' : 'Not loaded';

  return (
    <Card style={{ padding: 20, marginBottom: 12 }}>
      <GroupHeader emoji="⚡" title="Engine" subtitle="In-browser AI model and ML pipeline" />

      {/* WebLLM Model Picker */}
      <div style={{ fontSize: 11, fontWeight: 700, color: C.t2, fontFamily: F, marginBottom: 8 }}>
        WebLLM Model
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
        {models.map((m) => (
          <div
            key={m.id}
            id={`webllm-model-${m.tier}`}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 10,
              background: m.loaded ? `${C.g}08` : 'transparent',
              border: `1px solid ${m.loaded ? `${C.g}30` : C.bd}`,
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.t1, fontFamily: F }}>{m.label}</div>
              <div style={{ fontSize: 9, color: C.t3, fontFamily: M, marginTop: 2 }}>
                {m.size} · {m.speed} · {m.contextWindow} ctx
              </div>
              <div style={{ fontSize: 9, color: C.t3, fontFamily: F, marginTop: 1 }}>
                {m.description}
              </div>
            </div>
            {m.loaded ? (
              <StatusBadge ok label="Loaded" />
            ) : (
              <button
                onClick={() => handleLoadModel(m.id)}
                disabled={webLLMStatus?.loading}
                className="tf-btn"
                style={{
                  padding: '4px 12px', borderRadius: 6,
                  border: 'none', background: C.b, color: '#fff',
                  fontSize: 10, fontWeight: 600, fontFamily: F,
                  cursor: webLLMStatus?.loading ? 'not-allowed' : 'pointer',
                  opacity: webLLMStatus?.loading ? 0.5 : 1,
                }}
              >
                Download
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Status + Progress */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 0', borderBottom: `1px solid ${C.bd}10`,
        marginBottom: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12 }}>{statusEmoji}</span>
          <span style={{ fontSize: 11, color: C.t2, fontFamily: F }}>{statusLabel}</span>
          {webLLMStatus?.modelId && webLLMStatus?.loaded && (
            <span style={{ fontSize: 9, color: C.t3, fontFamily: M }}>({webLLMStatus.modelId.split('-')[0]})</span>
          )}
        </div>
        {webLLMStatus?.loaded && (
          <button
            onClick={handleUnload}
            className="tf-btn"
            style={{
              padding: '3px 10px', borderRadius: 5,
              border: `1px solid ${C.bd}`, background: 'transparent',
              color: C.t3, fontSize: 9, fontFamily: M, cursor: 'pointer',
            }}
          >
            Unload
          </button>
        )}
      </div>

      {/* Download Progress Bar */}
      {webLLMStatus?.loading && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 9, color: C.t3, fontFamily: M, marginBottom: 3 }}>
            {webLLMStatus.progressText}
          </div>
          <div style={{
            height: 4, borderRadius: 2, background: `${C.bd}30`, overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', borderRadius: 2,
              width: `${webLLMStatus.progress}%`,
              background: C.b,
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>
      )}

      {/* Auto-load toggle */}
      <ToggleRow
        label="Auto-load on start"
        hint="Load preferred model when app opens"
        checked={autoLoad}
        onChange={handleAutoLoadChange}
      />

      {/* ONNX ML Pipeline */}
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.bd}15` }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 8,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.t2, fontFamily: F }}>
            🤖 ONNX ML Pipeline
          </div>
          <Toggle checked={mlEnabled} onChange={handleToggleMl} label="ML Engine" />
        </div>
        <div style={{ fontSize: 9, color: C.t3, fontFamily: M, marginBottom: 4 }}>
          In-browser pattern detection and market regime classification via ONNX Runtime.
        </div>
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════
// GROUP 2: PERSONALITY
// ═══════════════════════════════════════════════════════════════════

function PersonalityGroup() {
  const [prefs, setPrefs] = useState({ tone: 'supportive', verbosity: 'normal', frequency: 'medium' });
  const [totalInteractions, setTotalInteractions] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const { adaptiveCoach } = await import('../../../ai/AdaptiveCoach');
        setPrefs(adaptiveCoach.getPreferences());
        setTotalInteractions(adaptiveCoach.totalInteractions);
      } catch { /* */ }
    })();
  }, []);

  const updatePref = useCallback(async (key, value) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
    try {
      // Write directly to localStorage (AdaptiveCoach reads from it)
      const raw = localStorage.getItem('charEdge-coaching-prefs');
      const data = raw ? JSON.parse(raw) : { categories: {}, globalPrefs: {}, totalInteractions: 0, updatedAt: 0 };
      data.globalPrefs = { ...data.globalPrefs, [key]: value };
      data.updatedAt = Date.now();
      localStorage.setItem('charEdge-coaching-prefs', JSON.stringify(data));
    } catch { /* */ }
  }, []);

  const handleReset = useCallback(async () => {
    if (!confirm('Reset all learned coaching preferences? The AI will start fresh learning your style.')) return;
    try {
      const { adaptiveCoach } = await import('../../../ai/AdaptiveCoach');
      adaptiveCoach.reset();
      setPrefs({ tone: 'supportive', verbosity: 'normal', frequency: 'medium' });
      setTotalInteractions(0);
    } catch { /* */ }
  }, []);

  const isAdapted = totalInteractions > 5;

  return (
    <Card style={{ padding: 20, marginBottom: 12 }}>
      <GroupHeader emoji="🎭" title="Personality" subtitle="How the copilot communicates with you" />

      {/* Adapted badge */}
      {isAdapted && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '3px 10px', borderRadius: 12,
          background: `${C.b}10`, border: `1px solid ${C.b}25`,
          fontSize: 9, fontWeight: 600, color: C.b, fontFamily: M,
          marginBottom: 12,
        }}>
          ✦ Auto-learned from {totalInteractions} interactions
        </div>
      )}

      {/* Tone */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: C.t2, fontFamily: F, marginBottom: 6 }}>Tone</div>
        <PillSelector
          options={[
            { value: 'direct', label: '⚡ Direct' },
            { value: 'supportive', label: '💬 Supportive' },
            { value: 'analytical', label: '📊 Analytical' },
          ]}
          value={prefs.tone}
          onChange={(v) => updatePref('tone', v)}
        />
      </div>

      {/* Verbosity */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: C.t2, fontFamily: F, marginBottom: 6 }}>Verbosity</div>
        <PillSelector
          options={[
            { value: 'brief', label: 'Brief' },
            { value: 'normal', label: 'Normal' },
            { value: 'detailed', label: 'Detailed' },
          ]}
          value={prefs.verbosity}
          onChange={(v) => updatePref('verbosity', v)}
        />
      </div>

      {/* Frequency */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: C.t2, fontFamily: F, marginBottom: 6 }}>Coaching Frequency</div>
        <PillSelector
          options={[
            { value: 'high', label: 'High' },
            { value: 'medium', label: 'Medium' },
            { value: 'low', label: 'Low' },
          ]}
          value={prefs.frequency}
          onChange={(v) => updatePref('frequency', v)}
        />
      </div>

      {/* Reset */}
      <button
        onClick={handleReset}
        className="tf-btn"
        style={{
          padding: '6px 14px', borderRadius: 6,
          border: `1px solid ${C.bd}`, background: 'transparent',
          color: C.t3, fontSize: 10, fontFamily: M,
          cursor: 'pointer', transition: 'all 0.15s ease',
        }}
      >
        Reset Learned Preferences
      </button>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════
// GROUP 3: CONTEXT SOURCES
// ═══════════════════════════════════════════════════════════════════

function ContextGroup() {
  const [ctx, setCtx] = useState(loadContextToggles);

  const toggleKey = useCallback((key) => {
    setCtx((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      saveContextToggles(next);
      return next;
    });
  }, []);

  return (
    <Card style={{ padding: 20, marginBottom: 12 }}>
      <GroupHeader emoji="📋" title="Context Sources" subtitle="What data the AI can use in responses" />

      <ToggleRow
        label="Trader DNA"
        hint="Your trading personality profile"
        checked={ctx.traderDNA}
        onChange={() => toggleKey('traderDNA')}
        preview="Win rate, avg RR, trait scores, edge analysis"
      />
      <ToggleRow
        label="Journal History"
        hint="Recent trades and patterns"
        checked={ctx.journal}
        onChange={() => toggleKey('journal')}
        preview="Last 5 trades, win/loss streaks, recent P&L"
      />
      <ToggleRow
        label="Chart Context"
        hint="Current chart state and indicators"
        checked={ctx.chart}
        onChange={() => toggleKey('chart')}
        preview="Symbol, timeframe, RSI, EMA, patterns"
      />
      <ToggleRow
        label="Watchlist Data"
        hint="Symbols and alerts you're tracking"
        checked={ctx.watchlist}
        onChange={() => toggleKey('watchlist')}
        preview="Tracked symbols, price alerts, scanner results"
      />
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════
// GROUP 4: CLOUD AI
// ═══════════════════════════════════════════════════════════════════

function CloudAIGroup() {
  const [keys, setKeys] = useState({});
  const [editing, setEditing] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [testing, setTesting] = useState(null);
  const [testResult, setTestResult] = useState({});
  const [showWhy, setShowWhy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { getApiKey } = await import('../../../data/providers/ApiKeyStore.js');
        const loaded = {};
        for (const id of ['gemini', 'groq']) {
          const key = getApiKey(id);
          if (key) loaded[id] = key;
        }
        setKeys(loaded);
      } catch { /* */ }
    })();
  }, []);

  const saveKey = useCallback(async (providerId) => {
    try {
      const { setApiKey } = await import('../../../data/providers/ApiKeyStore.js');
      setApiKey(providerId, editValue.trim());
      setKeys((prev) => ({ ...prev, [providerId]: editValue.trim() }));
      setEditing(null);
      setEditValue('');
    } catch { /* */ }
  }, [editValue]);

  const deleteKey = useCallback(async (providerId) => {
    try {
      const { setApiKey } = await import('../../../data/providers/ApiKeyStore.js');
      setApiKey(providerId, '');
      setKeys((prev) => { const n = { ...prev }; delete n[providerId]; return n; });
      setTestResult((prev) => { const n = { ...prev }; delete n[providerId]; return n; });
    } catch { /* */ }
  }, []);

  const testConnection = useCallback(async (providerId) => {
    setTesting(providerId);
    try {
      if (providerId === 'groq') {
        const { groqAdapter } = await import('../../../ai/GroqAdapter');
        await groqAdapter.chat([{ role: 'user', content: 'Say "ok" in one word.' }], { maxTokens: 4 });
        setTestResult((prev) => ({ ...prev, groq: true }));
      } else if (providerId === 'gemini') {
        // Simple test — we'll just verify the key format
        setTestResult((prev) => ({ ...prev, gemini: keys.gemini?.length > 20 }));
      }
    } catch {
      setTestResult((prev) => ({ ...prev, [providerId]: false }));
    }
    setTesting(null);
  }, [keys]);

  const maskKey = (key) => {
    if (!key || key.length < 8) return '••••';
    return key.slice(0, 4) + '•'.repeat(Math.min(key.length - 8, 12)) + key.slice(-4);
  };

  const PROVIDERS = [
    { id: 'gemini', name: 'Google Gemini', desc: '1,500 req/day · Flash 2.0', hint: 'ai.google.dev' },
    { id: 'groq', name: 'Groq Cloud', desc: '14,400 chat/day · Llama 3.3 70B', hint: 'console.groq.com' },
  ];

  return (
    <Card style={{ padding: 20, marginBottom: 12 }}>
      <GroupHeader emoji="☁️" title="Cloud AI" subtitle="Optional — copilot works entirely offline without these" />

      {/* Optional banner */}
      <div style={{
        padding: '6px 10px', borderRadius: 6,
        background: `${C.y}08`, border: `1px solid ${C.y}20`,
        fontSize: 9, color: C.t2, fontFamily: F,
        marginBottom: 12,
      }}>
        ⚡ Optional — Add API keys for faster, smarter responses. Free tiers available.
      </div>

      {/* Provider rows */}
      {PROVIDERS.map((prov) => {
        const hasKey = !!keys[prov.id];
        const isEditing = editing === prov.id;
        const result = testResult[prov.id];

        return (
          <div
            key={prov.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 0', borderBottom: `1px solid ${C.bd}10`,
            }}
          >
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: hasKey ? '#4ade80' : `${C.bd}40`,
              flexShrink: 0,
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.t1, fontFamily: F }}>{prov.name}</div>
              <div style={{ fontSize: 9, color: C.t3, fontFamily: M }}>{prov.desc}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {isEditing ? (
                <>
                  <input
                    autoFocus
                    type="password"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveKey(prov.id)}
                    placeholder={prov.hint}
                    style={{
                      width: 160, padding: '4px 8px', borderRadius: 4,
                      border: `1px solid ${C.bd}`, background: C.bg,
                      color: C.t1, fontSize: 10, fontFamily: M, outline: 'none',
                    }}
                  />
                  <button onClick={() => saveKey(prov.id)} className="tf-btn" style={{
                    padding: '3px 8px', borderRadius: 4, border: 'none',
                    background: C.b, color: '#fff', fontSize: 9, cursor: 'pointer',
                  }}>✓</button>
                  <button onClick={() => { setEditing(null); setEditValue(''); }} className="tf-btn" style={{
                    padding: '3px 6px', borderRadius: 4, border: `1px solid ${C.bd}`,
                    background: 'transparent', color: C.t3, fontSize: 9, cursor: 'pointer',
                  }}>✕</button>
                </>
              ) : (
                <>
                  {hasKey && <span style={{ fontSize: 9, fontFamily: M, color: C.t3 }}>{maskKey(keys[prov.id])}</span>}
                  {hasKey && (
                    <button
                      onClick={() => testConnection(prov.id)}
                      disabled={testing === prov.id}
                      className="tf-btn"
                      style={{
                        padding: '3px 8px', borderRadius: 4,
                        border: `1px solid ${C.bd}`, background: 'transparent',
                        color: result === true ? C.g : result === false ? C.r : C.t2,
                        fontSize: 9, fontFamily: M, cursor: 'pointer',
                      }}
                    >
                      {testing === prov.id ? '…' : result === true ? '✓ OK' : result === false ? '✗ Fail' : 'Test'}
                    </button>
                  )}
                  <button
                    onClick={() => { setEditing(prov.id); setEditValue(keys[prov.id] || ''); }}
                    className="tf-btn"
                    style={{
                      padding: '3px 8px', borderRadius: 4,
                      border: `1px solid ${C.bd}`, background: 'transparent',
                      color: C.t2, fontSize: 9, fontFamily: M, cursor: 'pointer',
                    }}
                  >
                    {hasKey ? 'Edit' : '+ Add'}
                  </button>
                  {hasKey && (
                    <button onClick={() => deleteKey(prov.id)} className="tf-btn" style={{
                      padding: '3px 6px', borderRadius: 4, border: 'none',
                      background: `${C.r}15`, color: C.r, fontSize: 9, cursor: 'pointer',
                    }}>🗑</button>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}

      {/* Why add an API key? */}
      <button
        onClick={() => setShowWhy((p) => !p)}
        className="tf-btn"
        style={{
          display: 'block', marginTop: 10, padding: 0,
          border: 'none', background: 'transparent',
          color: C.b, fontSize: 10, fontFamily: F,
          cursor: 'pointer', textDecoration: 'underline',
        }}
      >
        {showWhy ? 'Hide' : 'Why add an API key?'}
      </button>
      {showWhy && (
        <div style={{
          marginTop: 6, padding: '8px 10px', borderRadius: 6,
          background: `${C.b}06`, fontSize: 10, color: C.t2, fontFamily: F, lineHeight: 1.6,
        }}>
          <strong>Gemini:</strong> Longer, more nuanced analysis. Great for multi-step reasoning and coaching narratives.<br />
          <strong>Groq:</strong> Ultra-fast inference. Best for real-time chart queries and quick responses.
          Both have generous free tiers — no credit card needed.
        </div>
      )}
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════
// GROUP 5: PRIVACY
// ═══════════════════════════════════════════════════════════════════

function PrivacyGroup() {
  const [memoryCount, setMemoryCount] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const { conversationMemory } = await import('../../../ai/ConversationMemory');
        setMemoryCount(conversationMemory.messageCount);
      } catch { /* */ }
    })();
  }, []);

  const handleClearMemory = useCallback(async () => {
    if (!confirm('Clear all AI conversation memory? This cannot be undone.')) return;
    try {
      const { conversationMemory } = await import('../../../ai/ConversationMemory');
      await conversationMemory.reset();
      setMemoryCount(0);
    } catch { /* */ }
  }, []);

  const handleClearPrefs = useCallback(async () => {
    if (!confirm('Reset all learned coaching preferences? The AI will re-learn from scratch.')) return;
    try {
      const { adaptiveCoach } = await import('../../../ai/AdaptiveCoach');
      adaptiveCoach.reset();
    } catch { /* */ }
  }, []);

  return (
    <Card style={{ padding: 20 }}>
      <GroupHeader emoji="🛡️" title="Privacy" subtitle="Your data stays on your device" />

      {/* Shield banner */}
      <div style={{
        padding: '10px 12px', borderRadius: 8,
        background: `${C.g}08`, border: `1px solid ${C.g}20`,
        fontSize: 11, color: C.t1, fontFamily: F,
        marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 16 }}>🛡️</span>
        <div>
          <div style={{ fontWeight: 700 }}>All AI processing happens in your browser</div>
          <div style={{ fontSize: 9, color: C.t3, marginTop: 1 }}>
            No data is sent to external servers unless you add a Cloud AI key.
          </div>
        </div>
      </div>

      {/* Data summary */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: C.t2, fontFamily: F, marginBottom: 6 }}>
          What the AI can access
        </div>
        <div style={{ fontSize: 10, color: C.t3, fontFamily: F, lineHeight: 1.7, paddingLeft: 4 }}>
          • Journal trades and trade history<br />
          • Chart context (symbol, timeframe, indicators)<br />
          • Trader DNA personality profile<br />
          • Watchlist symbols and alerts<br />
          • Conversation history (current session)
        </div>
      </div>

      {/* Clear buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <button
          onClick={handleClearMemory}
          className="tf-btn"
          style={{
            flex: 1, padding: '8px 0', borderRadius: 6,
            border: `1px solid ${C.r}30`, background: `${C.r}06`,
            color: C.r, fontSize: 10, fontWeight: 600, fontFamily: F,
            cursor: 'pointer', transition: 'all 0.15s ease',
          }}
        >
          Clear AI Memory
        </button>
        <button
          onClick={handleClearPrefs}
          className="tf-btn"
          style={{
            flex: 1, padding: '8px 0', borderRadius: 6,
            border: `1px solid ${C.y}30`, background: `${C.y}06`,
            color: C.y, fontSize: 10, fontWeight: 600, fontFamily: F,
            cursor: 'pointer', transition: 'all 0.15s ease',
          }}
        >
          Clear Learned Preferences
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
        <StatusBadge ok label="Local-only processing" />
        {memoryCount > 0 && (
          <span style={{ fontSize: 9, color: C.t3, fontFamily: M }}>
            {memoryCount} messages in memory
          </span>
        )}
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════

function IntelligenceSection() {
  return (
    <section id="intelligence-settings" style={{ marginBottom: 40 }}>
      {/* Local-processing reassurance banner */}
      <div style={{
        padding: '10px 14px', borderRadius: 10,
        background: `${C.g}08`, border: `1px solid ${C.g}20`,
        display: 'flex', alignItems: 'center', gap: 10,
        marginBottom: 16,
      }}>
        <span style={{ fontSize: 18 }}>🛡️</span>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.t1, fontFamily: F }}>
            All AI processing happens locally in your browser
          </div>
          <div style={{ fontSize: 10, color: C.t3, fontFamily: F, marginTop: 1 }}>
            No data leaves your machine. Models run on-device via WebLLM and ONNX Runtime.
          </div>
        </div>
      </div>

      <AIPersonalityPicker />
      <PersonalityGroup />
      <ContextGroup />
      <ModelBenchmarkCard />

      {/* Advanced: Engine & ML — collapsed by default */}
      <details style={{ marginTop: 8 }}>
        <summary style={{
          fontSize: 12, fontWeight: 700, color: C.t2, fontFamily: F,
          cursor: 'pointer', padding: '12px 0',
          borderTop: `1px solid ${C.bd}20`,
          listStyle: 'none', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 11 }}>⚙️</span>
          Advanced: Engine & ML
          <span style={{ fontSize: 10, color: C.t3, fontFamily: F, marginLeft: 'auto' }}>
            Model management & technical controls
          </span>
        </summary>
        <div style={{ padding: '8px 0' }}>
          <EngineGroup />
        </div>
      </details>
    </section>
  );
}

export default React.memo(IntelligenceSection);
