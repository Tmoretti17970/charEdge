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

import React, { useState, useEffect, useCallback } from 'react';
import { C } from '../../../constants.js';
import { Card } from '../ui/UIKit.jsx';
import AIPersonalityPicker from './AIPersonalityPicker.jsx';
import css from './IntelligenceSection.module.css';
import ModelBenchmarkCard from './ModelBenchmarkCard.jsx';
import { StatusBadge } from './SettingsHelpers.jsx';

// ─── Shared Sub-components ──────────────────────────────────────

function GroupHeader({ emoji, title, subtitle }) {
  return (
    <div className={css.groupHdr}>
      <div className={css.groupHdrRow}>
        <span className={css.groupEmoji}>{emoji}</span>
        <span className={css.groupTitle}>{title}</span>
      </div>
      {subtitle && <div className={css.groupSub}>{subtitle}</div>}
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
      className={css.toggleTrack}
      style={{
        background: checked ? C.g : C.bd,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <div className={css.toggleThumb} style={{ transform: checked ? 'translateX(16px)' : 'translateX(0)' }} />
    </button>
  );
}

function PillSelector({ options, value, onChange }) {
  return (
    <div className={css.pillRow}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`tf-btn ${css.pillBtn}`}
          style={{
            border: `1px solid ${value === opt.value ? C.b + '40' : C.bd}`,
            background: value === opt.value ? C.b + '12' : 'transparent',
            color: value === opt.value ? C.b : C.t2,
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
    <div className={css.toggleRow} style={{ borderBottom: `1px solid ${C.bd}10` }}>
      <div className={css.flex1}>
        <div className={css.toggleRowLabel}>{label}</div>
        {hint && <div className={css.toggleRowHint}>{hint}</div>}
        {preview && checked && (
          <div className={css.toggleRowPreview} style={{ background: C.b + '06' }}>
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
function loadContextToggles() {
  try {
    const raw = localStorage.getItem(CONTEXT_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* */
  }
  return { traderDNA: true, journal: true, chart: true, watchlist: true };
}

function saveContextToggles(ctx) {
  try {
    localStorage.setItem(CONTEXT_KEY, JSON.stringify(ctx));
  } catch {
    /* */
  }
}

function getAutoLoad() {
  try {
    return localStorage.getItem(AUTOLOAD_KEY) === 'true';
  } catch {
    return false;
  }
}

function setAutoLoad(val) {
  try {
    localStorage.setItem(AUTOLOAD_KEY, val ? 'true' : 'false');
  } catch {
    /* */
  }
}

// ═══════════════════════════════════════════════════════════════════
// GROUP 1: ENGINE
// ═══════════════════════════════════════════════════════════════════

function EngineGroup() {
  const [webLLMStatus, setWebLLMStatus] = useState(null);
  const [models, setModels] = useState([]);
  const [autoLoad, setAutoLoadState] = useState(getAutoLoad);
  const [mlEnabled, setMlEnabled] = useState(true);
  const [_mlModels, setMlModels] = useState({});

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
      } catch {
        /* WebLLM not available */
      }
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
      } catch {
        /* */
      }
    })();
  }, []);

  const handleLoadModel = useCallback(async (modelId) => {
    try {
      const { webLLMProvider } = await import('../../../ai/WebLLMProvider');
      await webLLMProvider.loadModel(modelId);
    } catch {
      /* */
    }
  }, []);

  const handleUnload = useCallback(async () => {
    try {
      const { webLLMProvider } = await import('../../../ai/WebLLMProvider');
      await webLLMProvider.unload();
    } catch {
      /* */
    }
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
    } catch {
      /* */
    }
  }, []);

  const statusEmoji = webLLMStatus?.loaded ? '✅' : webLLMStatus?.loading ? '🔄' : '⬇️';
  const statusLabel = webLLMStatus?.loaded ? 'Ready' : webLLMStatus?.loading ? 'Downloading…' : 'Not loaded';

  return (
    <Card style={{ padding: 20, marginBottom: 12 }}>
      <GroupHeader emoji="⚡" title="Engine" subtitle="In-browser AI model and ML pipeline" />

      {/* WebLLM Model Picker */}
      <div className={css.subLabel}>WebLLM Model</div>
      <div className={css.modelList}>
        {models.map((m) => (
          <div
            key={m.id}
            id={`webllm-model-${m.tier}`}
            className={css.modelRow}
            style={{
              background: m.loaded ? `${C.g}08` : 'transparent',
              border: `1px solid ${m.loaded ? `${C.g}30` : C.bd}`,
            }}
          >
            <div className={css.flex1}>
              <div className={css.modelName}>{m.label}</div>
              <div className={css.modelMeta}>
                {m.size} · {m.speed} · {m.contextWindow} ctx
              </div>
              <div className={css.modelDesc}>{m.description}</div>
            </div>
            {m.loaded ? (
              <StatusBadge ok label="Loaded" />
            ) : (
              <button
                onClick={() => handleLoadModel(m.id)}
                disabled={webLLMStatus?.loading}
                className={`tf-btn ${css.downloadBtn}`}
                style={{
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
      <div className={css.statusRow} style={{ borderBottom: `1px solid ${C.bd}10` }}>
        <div className={css.statusInner}>
          <span className={css.statusEmoji}>{statusEmoji}</span>
          <span className={css.statusLabel}>{statusLabel}</span>
          {webLLMStatus?.modelId && webLLMStatus?.loaded && (
            <span className={css.statusModelId}>({webLLMStatus.modelId.split('-')[0]})</span>
          )}
        </div>
        {webLLMStatus?.loaded && (
          <button onClick={handleUnload} className={`tf-btn ${css.unloadBtn}`}>
            Unload
          </button>
        )}
      </div>

      {/* Download Progress Bar */}
      {webLLMStatus?.loading && (
        <div className={css.progressWrap}>
          <div className={css.progressText}>{webLLMStatus.progressText}</div>
          <div className={css.progressTrack} style={{ background: `${C.bd}30` }}>
            <div className={css.progressFill} style={{ width: `${webLLMStatus.progress}%`, background: C.b }} />
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
      <div className={css.mlSection} style={{ borderTop: `1px solid ${C.bd}15` }}>
        <div className={css.mlHeaderRow}>
          <div className={css.mlLabel}>🤖 ONNX ML Pipeline</div>
          <Toggle checked={mlEnabled} onChange={handleToggleMl} label="ML Engine" />
        </div>
        <div className={css.mlHint}>
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
      } catch {
        /* */
      }
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
    } catch {
      /* */
    }
  }, []);

  const handleReset = useCallback(async () => {
    if (!confirm('Reset all learned coaching preferences? The AI will start fresh learning your style.')) return;
    try {
      const { adaptiveCoach } = await import('../../../ai/AdaptiveCoach');
      adaptiveCoach.reset();
      setPrefs({ tone: 'supportive', verbosity: 'normal', frequency: 'medium' });
      setTotalInteractions(0);
    } catch {
      /* */
    }
  }, []);

  const isAdapted = totalInteractions > 5;

  return (
    <Card style={{ padding: 20, marginBottom: 12 }}>
      <GroupHeader emoji="🎭" title="Personality" subtitle="How the copilot communicates with you" />

      {/* Adapted badge */}
      {isAdapted && (
        <div className={css.adaptedBadge} style={{ background: `${C.b}10`, border: `1px solid ${C.b}25`, color: C.b }}>
          ✦ Auto-learned from {totalInteractions} interactions
        </div>
      )}

      {/* Tone */}
      <div className={css.prefBlock}>
        <div className={css.prefLabel}>Tone</div>
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
      <div className={css.prefBlock}>
        <div className={css.prefLabel}>Verbosity</div>
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
      <div className={css.prefBlock}>
        <div className={css.prefLabel}>Coaching Frequency</div>
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
      <button onClick={handleReset} className={`tf-btn ${css.resetBtn}`}>
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

// eslint-disable-next-line unused-imports/no-unused-vars
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
      } catch {
        /* */
      }
    })();
  }, []);

  const saveKey = useCallback(
    async (providerId) => {
      try {
        const { setApiKey } = await import('../../../data/providers/ApiKeyStore.js');
        setApiKey(providerId, editValue.trim());
        setKeys((prev) => ({ ...prev, [providerId]: editValue.trim() }));
        setEditing(null);
        setEditValue('');
      } catch {
        /* */
      }
    },
    [editValue],
  );

  const deleteKey = useCallback(async (providerId) => {
    try {
      const { setApiKey } = await import('../../../data/providers/ApiKeyStore.js');
      setApiKey(providerId, '');
      setKeys((prev) => {
        const n = { ...prev };
        delete n[providerId];
        return n;
      });
      setTestResult((prev) => {
        const n = { ...prev };
        delete n[providerId];
        return n;
      });
    } catch {
      /* */
    }
  }, []);

  const testConnection = useCallback(
    async (providerId) => {
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
    },
    [keys],
  );

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
      <div className={css.optionalBanner} style={{ background: `${C.y}08`, border: `1px solid ${C.y}20` }}>
        ⚡ Optional — Add API keys for faster, smarter responses. Free tiers available.
      </div>

      {/* Provider rows */}
      {PROVIDERS.map((prov) => {
        const hasKey = !!keys[prov.id];
        const isEditing = editing === prov.id;
        const result = testResult[prov.id];

        return (
          <div key={prov.id} className={css.providerRow} style={{ borderBottom: `1px solid ${C.bd}10` }}>
            <div className={css.provDot} style={{ background: hasKey ? '#4ade80' : `${C.bd}40` }} />
            <div className={css.flex1}>
              <div className={css.provName}>{prov.name}</div>
              <div className={css.provDesc}>{prov.desc}</div>
            </div>
            <div className={css.provActions}>
              {isEditing ? (
                <>
                  <input
                    autoFocus
                    type="password"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveKey(prov.id)}
                    placeholder={prov.hint}
                    className={css.apiInput}
                  />
                  <button onClick={() => saveKey(prov.id)} className={`tf-btn ${css.miniBtnPrimary}`}>
                    ✓
                  </button>
                  <button
                    onClick={() => {
                      setEditing(null);
                      setEditValue('');
                    }}
                    className={`tf-btn ${css.miniBtnCancel}`}
                  >
                    ✕
                  </button>
                </>
              ) : (
                <>
                  {hasKey && <span className={css.maskedKey}>{maskKey(keys[prov.id])}</span>}
                  {hasKey && (
                    <button
                      onClick={() => testConnection(prov.id)}
                      disabled={testing === prov.id}
                      className={`tf-btn ${css.miniBtn}`}
                      style={{ color: result === true ? C.g : result === false ? C.r : C.t2 }}
                    >
                      {testing === prov.id ? '…' : result === true ? '✓ OK' : result === false ? '✗ Fail' : 'Test'}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setEditing(prov.id);
                      setEditValue(keys[prov.id] || '');
                    }}
                    className={`tf-btn ${css.miniBtn}`}
                  >
                    {hasKey ? 'Edit' : '+ Add'}
                  </button>
                  {hasKey && (
                    <button
                      onClick={() => deleteKey(prov.id)}
                      className={`tf-btn ${css.miniBtnDelete}`}
                      style={{ background: `${C.r}15`, color: C.r }}
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

      {/* Why add an API key? */}
      <button onClick={() => setShowWhy((p) => !p)} className={`tf-btn ${css.whyBtn}`}>
        {showWhy ? 'Hide' : 'Why add an API key?'}
      </button>
      {showWhy && (
        <div className={css.whyBox} style={{ background: `${C.b}06` }}>
          <strong>Gemini:</strong> Longer, more nuanced analysis. Great for multi-step reasoning and coaching
          narratives.
          <br />
          <strong>Groq:</strong> Ultra-fast inference. Best for real-time chart queries and quick responses. Both have
          generous free tiers — no credit card needed.
        </div>
      )}
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════
// GROUP 5: PRIVACY
// ═══════════════════════════════════════════════════════════════════

// eslint-disable-next-line unused-imports/no-unused-vars
function PrivacyGroup() {
  const [memoryCount, setMemoryCount] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const { conversationMemory } = await import('../../../ai/ConversationMemory');
        setMemoryCount(conversationMemory.messageCount);
      } catch {
        /* */
      }
    })();
  }, []);

  const handleClearMemory = useCallback(async () => {
    if (!confirm('Clear all AI conversation memory? This cannot be undone.')) return;
    try {
      const { conversationMemory } = await import('../../../ai/ConversationMemory');
      await conversationMemory.reset();
      setMemoryCount(0);
    } catch {
      /* */
    }
  }, []);

  const handleClearPrefs = useCallback(async () => {
    if (!confirm('Reset all learned coaching preferences? The AI will re-learn from scratch.')) return;
    try {
      const { adaptiveCoach } = await import('../../../ai/AdaptiveCoach');
      adaptiveCoach.reset();
    } catch {
      /* */
    }
  }, []);

  return (
    <Card style={{ padding: 20 }}>
      <GroupHeader emoji="🛡️" title="Privacy" subtitle="Your data stays on your device" />

      {/* Shield banner */}
      <div className={css.shieldBanner} style={{ background: `${C.g}08`, border: `1px solid ${C.g}20` }}>
        <span className={css.shieldIcon}>🛡️</span>
        <div>
          <div className={css.shieldTitle}>All AI processing happens in your browser</div>
          <div className={css.shieldSubtitle}>No data is sent to external servers unless you add a Cloud AI key.</div>
        </div>
      </div>

      {/* Data summary */}
      <div className={css.prefBlock}>
        <div className={css.dataAccessLabel}>What the AI can access</div>
        <div className={css.dataAccessList}>
          • Journal trades and trade history
          <br />
          • Chart context (symbol, timeframe, indicators)
          <br />
          • Trader DNA personality profile
          <br />
          • Watchlist symbols and alerts
          <br />• Conversation history (current session)
        </div>
      </div>

      {/* Clear buttons */}
      <div className={css.clearRow}>
        <button
          onClick={handleClearMemory}
          className={`tf-btn ${css.clearBtn}`}
          style={{ border: `1px solid ${C.r}30`, background: `${C.r}06`, color: C.r }}
        >
          Clear AI Memory
        </button>
        <button
          onClick={handleClearPrefs}
          className={`tf-btn ${css.clearBtn}`}
          style={{ border: `1px solid ${C.y}30`, background: `${C.y}06`, color: C.y }}
        >
          Clear Learned Preferences
        </button>
      </div>

      <div className={css.statusFooter}>
        <StatusBadge ok label="Local-only processing" />
        {memoryCount > 0 && <span className={css.memoryCount}>{memoryCount} messages in memory</span>}
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════

function IntelligenceSection() {
  return (
    <section id="intelligence-settings" className={css.sectionWrap}>
      {/* Local-processing reassurance banner */}
      <div className={css.heroBanner} style={{ background: `${C.g}08`, border: `1px solid ${C.g}20` }}>
        <span className={css.heroBannerIcon}>🛡️</span>
        <div>
          <div className={css.heroBannerTitle}>All AI processing happens locally in your browser</div>
          <div className={css.heroBannerSub}>
            No data leaves your machine. Models run on-device via WebLLM and ONNX Runtime.
          </div>
        </div>
      </div>

      <AIPersonalityPicker />
      <PersonalityGroup />
      <ContextGroup />
      <ModelBenchmarkCard />

      {/* Advanced: Engine & ML — collapsed by default */}
      <details className={css.advancedDetails}>
        <summary className={css.advancedSummary} style={{ borderTop: `1px solid ${C.bd}20` }}>
          <span className={css.advancedIcon}>⚙️</span>
          Advanced: Engine & ML
          <span className={css.advancedHint}>Model management & technical controls</span>
        </summary>
        <div className={css.advancedBody}>
          <EngineGroup />
        </div>
      </details>
    </section>
  );
}

export default React.memo(IntelligenceSection);
