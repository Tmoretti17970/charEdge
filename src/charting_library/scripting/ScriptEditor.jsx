// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — Script Editor (Bottom Panel)
//
// DevTools-style bottom panel for writing custom indicators.
// Features:
//   - Line-numbered textarea with monospace styling
//   - Regex-based syntax highlighting (preview pane)
//   - Run button with execution time display
//   - Error console with line numbers
//   - Parameter controls auto-generated from param() calls
//   - Resizable via drag handle
//   - Collapse/expand toggle
//
// Mounts below the chart in ChartsPage.
// ═══════════════════════════════════════════════════════════════════

import { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import { C, M } from '../../constants.js';
import { space, radii, text, transition, preset } from '../../theme/tokens.js';
import { useScriptStore } from '../../state/useScriptStore.js';
import { executeScript, validateScript } from './ScriptEngine.js';

const MIN_HEIGHT = 120;
const MAX_HEIGHT = 600;
const DEFAULT_HEIGHT = 280;
const COLLAPSED_HEIGHT = 32;

/**
 * @param {Object} props
 * @param {Object[]} props.bars - Current chart OHLCV data
 * @param {Function} props.onResults - Callback with script outputs for chart rendering
 */
const ScriptEditor = forwardRef(function ScriptEditor({ bars, onResults }, ref) {
  const scripts = useScriptStore((s) => s.scripts);

  // Track which script is being edited locally
  const [editingId, setEditingId] = useState(null);
  const [code, setCode] = useState('');
  const [collapsed, setCollapsed] = useState(true);
  const [panelHeight, setPanelHeight] = useState(DEFAULT_HEIGHT);
  const [consoleOutput, setConsoleOutput] = useState(null);
  const [execMs, setExecMs] = useState(null);
  const [tab, setTab] = useState('editor'); // editor | console | params
  const [declaredParams, setDeclaredParams] = useState({});

  const _dragRef = useRef(null);
  const textareaRef = useRef(null);

  // Load script code when editingId changes
  useEffect(() => {
    if (!editingId) return;
    const script = useScriptStore.getState().scripts.find((s) => s.id === editingId);
    if (script) setCode(script.code);
  }, [editingId]);

  // ─── Open script for editing ────────────────────────────
  const openScript = useCallback((id) => {
    setEditingId(id);
    setCollapsed(false);
    setTab('editor');
    setConsoleOutput(null);
    const script = useScriptStore.getState().scripts.find((s) => s.id === id);
    if (script) setCode(script.code);
  }, []);

  // Expose openScript to parent via ref
  useImperativeHandle(ref, () => ({ openScript }), [openScript]);

  // ─── Run Script ─────────────────────────────────────────
  const runScript = useCallback(() => {
    if (!code.trim()) {
      setConsoleOutput({ error: 'Script is empty', outputs: [] });
      setTab('console');
      return;
    }

    // Validate first
    const validation = validateScript(code);
    if (!validation.valid) {
      setConsoleOutput({ error: validation.error, outputs: [] });
      setTab('console');
      return;
    }

    // Get current param values
    const script = editingId ? useScriptStore.getState().scripts.find((s) => s.id === editingId) : null;
    const userParams = script?.params || {};

    // Execute
    const result = executeScript(code, bars || [], userParams);
    setExecMs(result.execMs);
    setDeclaredParams(result.params);

    if (result.error) {
      setConsoleOutput({ error: result.error, outputs: [] });
      setTab('console');
    } else {
      setConsoleOutput({
        error: null,
        outputs: result.outputs,
        summary: `${result.outputs.length} output(s) · ${result.execMs.toFixed(1)}ms`,
      });

      // Save code back to store
      if (editingId) {
        useScriptStore.getState().updateScript(editingId, { code });
      }

      // Send outputs to chart
      if (onResults) {
        onResults(editingId, result.outputs);
      }
    }
  }, [code, bars, editingId, onResults]);

  // ─── Save on Ctrl+S ────────────────────────────────────
  const handleKeyDown = useCallback(
    (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (editingId) {
          useScriptStore.getState().updateScript(editingId, { code });
        }
        runScript();
      }
      // Tab key inserts spaces
      if (e.key === 'Tab') {
        e.preventDefault();
        const ta = textareaRef.current;
        if (!ta) return;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const newCode = code.substring(0, start) + '  ' + code.substring(end);
        setCode(newCode);
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = start + 2;
        });
      }
    },
    [code, editingId, runScript],
  );

  // ─── Resize Handle ─────────────────────────────────────
  const startResize = useCallback(
    (e) => {
      e.preventDefault();
      const startY = e.clientY;
      const startH = panelHeight;

      const onMove = (me) => {
        const delta = startY - me.clientY;
        setPanelHeight(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, startH + delta)));
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [panelHeight],
  );

  // ─── Param change handler ──────────────────────────────
  const handleParamChange = useCallback(
    (name, value) => {
      if (editingId) {
        useScriptStore.getState().setScriptParam(editingId, name, Number(value));
      }
    },
    [editingId],
  );

  // Get current script for param values
  const currentScript = editingId ? scripts.find((s) => s.id === editingId) : null;

  // Line count for gutter
  const lineCount = code.split('\n').length;

  return (
    <div
      style={{
        height: collapsed ? COLLAPSED_HEIGHT : panelHeight,
        flexShrink: 0,
        borderTop: `1px solid ${C.bd}`,
        background: C.bg,
        display: 'flex',
        flexDirection: 'column',
        transition: collapsed ? `height ${transition.base}` : 'none',
      }}
    >
      {/* ─── Resize Handle ────────────────────────────── */}
      {!collapsed && (
        <div
          onMouseDown={startResize}
          style={{
            height: 4,
            cursor: 'ns-resize',
            background: 'transparent',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => (e.target.style.background = C.b + '40')}
          onMouseLeave={(e) => (e.target.style.background = 'transparent')}
        />
      )}

      {/* ─── Header Bar ───────────────────────────────── */}
      <div
        style={{
          height: COLLAPSED_HEIGHT,
          display: 'flex',
          alignItems: 'center',
          padding: `0 ${space[3]}px`,
          gap: space[2],
          borderBottom: collapsed ? 'none' : `1px solid ${C.bd}`,
          flexShrink: 0,
          background: C.sf,
        }}
      >
        {/* Toggle */}
        <button
          className="tf-btn"
          onClick={() => setCollapsed(!collapsed)}
          style={{
            background: 'transparent',
            border: 'none',
            color: C.t2,
            fontSize: 10,
            fontFamily: M,
            cursor: 'pointer',
            padding: '2px 4px',
          }}
        >
          {collapsed ? '▴ Script Editor' : '▾ Script Editor'}
        </button>

        {!collapsed && (
          <>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: 2, marginLeft: space[2] }}>
              {['editor', 'console', 'params'].map((t) => (
                <button
                  className="tf-btn"
                  key={t}
                  onClick={() => setTab(t)}
                  style={{
                    ...preset.toolbarBtn,
                    fontSize: 10,
                    color: tab === t ? C.b : C.t3,
                    background: tab === t ? C.b + '15' : 'transparent',
                    borderRadius: radii.sm,
                    textTransform: 'capitalize',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Script name */}
            {currentScript && (
              <span
                style={{
                  ...text.captionSm,
                  color: C.t2,
                  marginLeft: space[2],
                }}
              >
                {currentScript.builtin ? '📦' : '✏️'} {currentScript.name}
              </span>
            )}

            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* Exec time */}
            {execMs != null && (
              <span
                style={{
                  ...text.captionSm,
                  color: execMs > 100 ? C.y : C.g,
                }}
              >
                {execMs.toFixed(1)}ms
              </span>
            )}

            {/* Run button */}
            <button
              className="tf-btn"
              onClick={runScript}
              style={{
                padding: '3px 10px',
                borderRadius: radii.sm,
                border: 'none',
                background: C.g,
                color: '#fff',
                fontSize: 10,
                fontWeight: 700,
                fontFamily: M,
                cursor: 'pointer',
              }}
              title="Run script (⌘S)"
            >
              ▶ Run
            </button>
          </>
        )}
      </div>

      {/* ─── Content Area ─────────────────────────────── */}
      {!collapsed && (
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
          {/* Editor Tab */}
          {tab === 'editor' && (
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              {/* Line numbers gutter */}
              <div
                style={{
                  width: 36,
                  padding: '8px 4px',
                  background: C.sf,
                  borderRight: `1px solid ${C.bd}`,
                  overflow: 'hidden',
                  flexShrink: 0,
                }}
              >
                {Array.from({ length: lineCount }, (_, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: 10,
                      fontFamily: M,
                      color: C.t3 + '80',
                      textAlign: 'right',
                      lineHeight: '18px',
                      paddingRight: 4,
                    }}
                  >
                    {i + 1}
                  </div>
                ))}
              </div>

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={handleKeyDown}
                spellCheck={false}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  background: C.bg,
                  color: C.t1,
                  border: 'none',
                  outline: 'none',
                  resize: 'none',
                  fontFamily: M,
                  fontSize: 12,
                  lineHeight: '18px',
                  tabSize: 2,
                  whiteSpace: 'pre',
                  overflowX: 'auto',
                  overflowY: 'auto',
                }}
                placeholder="// Write your custom indicator here..."
              />
            </div>
          )}

          {/* Console Tab */}
          {tab === 'console' && (
            <div
              style={{
                flex: 1,
                padding: space[3],
                overflowY: 'auto',
                fontFamily: M,
                fontSize: 11,
              }}
            >
              {!consoleOutput ? (
                <div style={{ color: C.t3 }}>Run a script to see output here.</div>
              ) : consoleOutput.error ? (
                <div>
                  <div
                    style={{
                      color: C.r,
                      padding: `${space[2]}px ${space[3]}px`,
                      background: C.r + '10',
                      borderRadius: radii.sm,
                      border: `1px solid ${C.r}30`,
                      marginBottom: space[2],
                    }}
                  >
                    ✕ {consoleOutput.error}
                  </div>
                </div>
              ) : (
                <div>
                  <div
                    style={{
                      color: C.g,
                      padding: `${space[2]}px ${space[3]}px`,
                      background: C.g + '10',
                      borderRadius: radii.sm,
                      border: `1px solid ${C.g}30`,
                      marginBottom: space[3],
                    }}
                  >
                    ✓ {consoleOutput.summary}
                  </div>

                  {/* Output details */}
                  {consoleOutput.outputs.map((out, i) => (
                    <div
                      key={i}
                      style={{
                        padding: `${space[1]}px 0`,
                        borderBottom: `1px solid ${C.bd}30`,
                        display: 'flex',
                        gap: space[2],
                        alignItems: 'center',
                        color: C.t2,
                      }}
                    >
                      <span
                        style={{
                          ...preset.badge,
                          fontSize: 8,
                          background: C.b + '20',
                          color: C.b,
                        }}
                      >
                        {out.type}
                      </span>
                      <span>{out.label || out.type}</span>
                      {out.color && (
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 2,
                            background: out.color,
                            flexShrink: 0,
                          }}
                        />
                      )}
                      {out.data && (
                        <span style={{ color: C.t3, fontSize: 10 }}>
                          {Array.isArray(out.data)
                            ? `${out.data.length} points`
                            : out.data.upper
                              ? `${out.data.upper.length} points`
                              : ''}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Params Tab */}
          {tab === 'params' && (
            <div
              style={{
                flex: 1,
                padding: space[3],
                overflowY: 'auto',
              }}
            >
              {Object.keys(declaredParams).length === 0 ? (
                <div style={{ ...text.captionSm, color: C.t3 }}>
                  No parameters declared. Use <code style={{ color: C.b }}>param(name, default)</code> in your script.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: space[2] }}>
                  {Object.entries(declaredParams).map(([name, def]) => {
                    const value = currentScript?.params?.[name] ?? def.default;
                    return (
                      <div
                        key={name}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: space[3],
                        }}
                      >
                        <label
                          style={{
                            ...text.captionSm,
                            color: C.t2,
                            width: 80,
                            flexShrink: 0,
                          }}
                        >
                          {def.label || name}
                        </label>
                        <input
                          type="range"
                          min={def.min ?? 1}
                          max={def.max ?? 200}
                          step={def.step ?? 1}
                          value={value}
                          onChange={(e) => handleParamChange(name, e.target.value)}
                          style={{ flex: 1, accentColor: C.b }}
                        />
                        <span
                          style={{
                            ...text.monoXs,
                            width: 36,
                            textAlign: 'right',
                            color: C.t1,
                          }}
                        >
                          {value}
                        </span>
                      </div>
                    );
                  })}

                  <button
                    className="tf-btn"
                    onClick={runScript}
                    style={{
                      ...preset.toolbarBtn,
                      marginTop: space[2],
                      color: C.b,
                      fontSize: 10,
                      alignSelf: 'flex-start',
                    }}
                  >
                    ▶ Re-run with new params
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default ScriptEditor;
