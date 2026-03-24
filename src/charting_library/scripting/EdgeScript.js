// ═══════════════════════════════════════════════════════════════════
// charEdge — EdgeScript Transpiler
//
// Phase 2: Pine Script-compatible language that compiles to JavaScript
// for execution in the existing ScriptEngine sandbox.
//
// EdgeScript syntax:
//   @version(1)
//   @overlay(true)
//
//   input length = 14
//   input source = close
//
//   rsi_val = ta.rsi(source, length)
//   sma_val = ta.sma(rsi_val, 10)
//
//   plot(rsi_val, "RSI", color.blue)
//   hline(70, "Overbought", color.red)
//
//   if ta.crossover(rsi_val, 30)
//       marker(barCount - 1, { shape: "triangle", color: color.green, position: "below" })
//
// Compiles to JavaScript that runs in ScriptEngine sandbox.
// ═══════════════════════════════════════════════════════════════════

// ─── Color Constants ─────────────────────────────────────────────

const COLORS = {
  red: '#EF5350',
  green: '#26A69A',
  blue: '#2962FF',
  orange: '#FF6D00',
  purple: '#AB47BC',
  yellow: '#FFC107',
  cyan: '#00BCD4',
  white: '#FFFFFF',
  gray: '#787B86',
  lime: '#4CAF50',
  aqua: '#00E5FF',
  fuchsia: '#E040FB',
  teal: '#009688',
  navy: '#1A237E',
  maroon: '#B71C1C',
  olive: '#827717',
  silver: '#9E9E9E',
  black: '#000000',
};

// ─── ta.* → sandbox function mapping ────────────────────────────

const TA_FUNCTIONS = new Set([
  'sma',
  'ema',
  'wma',
  'rsi',
  'atr',
  'vwap',
  'bollinger',
  'macd',
  'stochastic',
  'dema',
  'tema',
  'hullma',
  'adx',
  'cci',
  'mfi',
  'obv',
  'williamsR',
  'supertrend',
  'ichimoku',
  'pivotPoints',
  'heikinAshi',
  'linearRegression',
  'keltner',
  'donchian',
  'vwma',
  'cmf',
  'roc',
  'highest',
  'lowest',
  'change',
  'barssince',
  'valuewhen',
  'stdev',
  'crossover',
  'crossunder',
  'fillna',
  'offset',
]);

// ─── Transpiler ──────────────────────────────────────────────────

/**
 * Transpile EdgeScript source code to JavaScript for ScriptEngine.
 *
 * @param {string} source - EdgeScript source code
 * @returns {{ js: string, meta: { version: number, overlay: boolean }, errors: string[] }}
 */
export function transpile(source) {
  const errors = [];
  const meta = { version: 1, overlay: true };
  const lines = source.split('\n');
  const jsLines = [];
  const _indentStack = [0]; // Track indentation for if/for blocks (reserved for future use)

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const raw = lines[lineNum];
    const trimmed = raw.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('//')) {
      jsLines.push('');
      continue;
    }

    // ── Directives: @version, @overlay ───────────────────────
    if (trimmed.startsWith('@')) {
      const match = trimmed.match(/^@(\w+)\((.+)\)$/);
      if (match) {
        const [, directive, value] = match;
        if (directive === 'version') meta.version = parseInt(value, 10);
        else if (directive === 'overlay') meta.overlay = value === 'true';
      }
      jsLines.push('');
      continue;
    }

    // ── Input declarations ───────────────────────────────────
    // input length = 14         → const length = param("length", 14);
    // input length = 14, min=2  → const length = param("length", 14, { min: 2 });
    const inputMatch = trimmed.match(/^input\s+(\w+)\s*=\s*(.+)$/);
    if (inputMatch) {
      const [, name, rest] = inputMatch;
      const parts = rest.split(',').map((s) => s.trim());
      const defaultVal = _parseValue(parts[0]);
      const opts = {};
      for (let i = 1; i < parts.length; i++) {
        const kvMatch = parts[i].match(/^(\w+)\s*=\s*(.+)$/);
        if (kvMatch) opts[kvMatch[1]] = _parseValue(kvMatch[2]);
      }
      const optsStr = Object.keys(opts).length > 0 ? `, ${JSON.stringify(opts)}` : '';
      jsLines.push(`const ${name} = param("${name}", ${defaultVal}${optsStr});`);
      continue;
    }

    // ── Variable declarations ────────────────────────────────
    // var_name = expression    → const var_name = expression;
    // (only if line is assignment, not inside if/for)
    const assignMatch = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
    if (assignMatch && !trimmed.startsWith('if ') && !trimmed.startsWith('for ') && !trimmed.startsWith('else')) {
      const [, varName, expr] = assignMatch;
      const jsExpr = _transpileExpr(expr, errors, lineNum);
      // Use 'let' to allow reassignment in loops
      jsLines.push(`let ${varName} = ${jsExpr};`);
      continue;
    }

    // ── If statements ────────────────────────────────────────
    // if condition              → if (condition) {
    if (trimmed.startsWith('if ')) {
      const condition = trimmed.slice(3).trim();
      const jsCondition = _transpileExpr(condition, errors, lineNum);
      jsLines.push(`if (${jsCondition}) {`);
      continue;
    }

    // ── Else / elif ──────────────────────────────────────────
    if (trimmed === 'else') {
      jsLines.push('} else {');
      continue;
    }
    if (trimmed.startsWith('elif ') || trimmed.startsWith('else if ')) {
      const condition = trimmed.replace(/^(elif|else if)\s+/, '').trim();
      const jsCondition = _transpileExpr(condition, errors, lineNum);
      jsLines.push(`} else if (${jsCondition}) {`);
      continue;
    }

    // ── For loops ────────────────────────────────────────────
    // for i = 0 to barCount    → for (let i = 0; i < barCount; i++) { tick();
    const forMatch = trimmed.match(/^for\s+(\w+)\s*=\s*(\S+)\s+to\s+(\S+)(?:\s+step\s+(\S+))?$/);
    if (forMatch) {
      const [, varName, start, end, step] = forMatch;
      const jsStart = _transpileExpr(start, errors, lineNum);
      const jsEnd = _transpileExpr(end, errors, lineNum);
      const jsStep = step ? _transpileExpr(step, errors, lineNum) : '1';
      jsLines.push(`for (let ${varName} = ${jsStart}; ${varName} < ${jsEnd}; ${varName} += ${jsStep}) { tick();`);
      continue;
    }

    // ── End blocks (indentation-based → brace-based) ─────────
    // Use 'end' keyword to close blocks (alternative to indent)
    if (trimmed === 'end') {
      jsLines.push('}');
      continue;
    }

    // ── Plot / hline / band / histogram / marker commands ────
    // plot(values, "Label", color.blue)
    // hline(70, "Level", color.red, style.dashed)
    const plotMatch = trimmed.match(/^(plot|hline|band|histogram|marker)\s*\((.+)\)$/);
    if (plotMatch) {
      const [, cmd, argsStr] = plotMatch;
      const jsArgs = _transpileArgs(argsStr, cmd, errors, lineNum);
      jsLines.push(`${cmd}(${jsArgs});`);
      continue;
    }

    // ── Function calls (standalone) ──────────────────────────
    // log("message")
    if (trimmed.match(/^\w+\s*\(.*\)$/)) {
      jsLines.push(_transpileExpr(trimmed, errors, lineNum) + ';');
      continue;
    }

    // ── Fallthrough: treat as raw expression ─────────────────
    jsLines.push(_transpileExpr(trimmed, errors, lineNum) + ';');
  }

  // Close any unclosed blocks
  // Simple heuristic: count open vs close braces
  const jsCode = jsLines.join('\n');
  const opens = (jsCode.match(/\{/g) || []).length;
  const closes = (jsCode.match(/\}/g) || []).length;
  const missing = opens - closes;
  const closingBraces = missing > 0 ? '\n' + '}'.repeat(missing) : '';

  return {
    js: jsCode + closingBraces,
    meta,
    errors,
  };
}

// ─── Expression Transpiler ───────────────────────────────────────

function _transpileExpr(expr, errors, lineNum) {
  let js = expr;

  // Replace ta.xxx() → xxx()
  js = js.replace(/\bta\.(\w+)\b/g, (_, fn) => {
    if (TA_FUNCTIONS.has(fn)) return fn;
    errors.push(`Line ${lineNum + 1}: Unknown ta.${fn} function`);
    return fn;
  });

  // Replace color.xxx → hex string
  js = js.replace(/\bcolor\.(\w+)\b/g, (_, name) => {
    if (COLORS[name]) return `"${COLORS[name]}"`;
    errors.push(`Line ${lineNum + 1}: Unknown color.${name}`);
    return `"${name}"`;
  });

  // Replace style.xxx → string
  js = js.replace(/\bstyle\.(\w+)\b/g, (_, name) => `"${name}"`);

  // Replace 'and' → '&&', 'or' → '||', 'not' → '!'
  js = js.replace(/\band\b/g, '&&');
  js = js.replace(/\bor\b/g, '||');
  js = js.replace(/\bnot\b/g, '!');

  // Replace 'true'/'false' → true/false (already valid JS)
  // Replace 'na' → null
  js = js.replace(/\bna\b/g, 'null');

  // Replace source keywords
  js = js.replace(/\bsource\b(?!\s*=)/g, 'close'); // default source = close

  return js;
}

function _transpileArgs(argsStr, cmd, errors, lineNum) {
  // Split on commas, but respect nested parens and strings
  const args = _splitArgs(argsStr);

  if (cmd === 'plot') {
    // plot(values, "Label", color.blue, lineWidth=2)
    const [values, label, color, ...opts] = args;
    const jsValues = _transpileExpr(values?.trim() || '', errors, lineNum);
    const jsLabel = label?.trim() || '"Plot"';
    const jsColor = color ? _transpileExpr(color.trim(), errors, lineNum) : '"#f59e0b"';
    const optsObj = _parseOpts(opts, errors, lineNum);
    return `${jsValues}, { label: ${jsLabel}, color: ${jsColor}${optsObj} }`;
  }

  if (cmd === 'hline') {
    // hline(price, "Label", color.red, style.dashed)
    const [price, label, color, style] = args;
    const jsPrice = _transpileExpr(price?.trim() || '0', errors, lineNum);
    const jsLabel = label?.trim() || '""';
    const jsColor = color ? _transpileExpr(color.trim(), errors, lineNum) : '"#5d6377"';
    const jsStyle = style ? _transpileExpr(style.trim(), errors, lineNum) : '"dashed"';
    return `${jsPrice}, { label: ${jsLabel}, color: ${jsColor}, style: ${jsStyle} }`;
  }

  if (cmd === 'band') {
    // band(upper, lower, "Label", color.blue)
    const [upper, lower, label, color] = args;
    return `${_transpileExpr(upper?.trim() || '[]', errors, lineNum)}, ${_transpileExpr(lower?.trim() || '[]', errors, lineNum)}, { label: ${label?.trim() || '"Band"'}, color: ${color ? _transpileExpr(color.trim(), errors, lineNum) : '"#5c9cf5"'} }`;
  }

  // Default: pass through
  return args.map((a) => _transpileExpr(a.trim(), errors, lineNum)).join(', ');
}

function _splitArgs(str) {
  const args = [];
  let depth = 0;
  let inStr = false;
  let strChar = '';
  let current = '';

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (inStr) {
      current += ch;
      if (ch === strChar) inStr = false;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inStr = true;
      strChar = ch;
      current += ch;
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') {
      depth++;
      current += ch;
      continue;
    }
    if (ch === ')' || ch === ']' || ch === '}') {
      depth--;
      current += ch;
      continue;
    }
    if (ch === ',' && depth === 0) {
      args.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) args.push(current);
  return args;
}

function _parseValue(str) {
  const s = str.trim();
  if (s === 'true') return 'true';
  if (s === 'false') return 'false';
  if (s === 'close' || s === 'open' || s === 'high' || s === 'low' || s === 'volume') return s;
  if (/^-?\d+(\.\d+)?$/.test(s)) return s;
  if (s.startsWith('"') || s.startsWith("'")) return s;
  return `"${s}"`;
}

function _parseOpts(optParts, errors, lineNum) {
  let result = '';
  for (const part of optParts) {
    const match = part.trim().match(/^(\w+)\s*=\s*(.+)$/);
    if (match) {
      const val = _transpileExpr(match[2].trim(), errors, lineNum);
      result += `, ${match[1]}: ${val}`;
    }
  }
  return result;
}

// ─── Convenience: transpile + execute ────────────────────────────

/**
 * Transpile EdgeScript and execute in the sandbox.
 *
 * @param {string} edgeScriptSource - EdgeScript source code
 * @param {Object[]} bars - OHLCV bar data
 * @param {Object} [userParams={}] - User parameter overrides
 * @returns {Promise<{ outputs: Array, params: Object, error: string|null, meta: Object }>}
 */
export async function runEdgeScript(edgeScriptSource, bars, userParams = {}) {
  const { js, meta, errors } = transpile(edgeScriptSource);

  if (errors.length > 0) {
    return {
      outputs: [],
      params: {},
      error: `Transpile errors:\n${errors.join('\n')}`,
      meta,
      transpiled: js,
    };
  }

  // Execute through existing ScriptEngine
  const { executeScriptAsync } = await import('./ScriptEngine.js');
  const result = await executeScriptAsync(js, bars, userParams);

  return {
    ...result,
    meta,
    transpiled: js,
  };
}

// ─── Example Scripts ─────────────────────────────────────────────

export const EXAMPLE_SCRIPTS = [
  {
    id: 'rsi-overbought',
    name: 'RSI Overbought/Oversold',
    description: 'RSI with overbought (70) and oversold (30) levels',
    source: `@version(1)
@overlay(false)

input length = 14

rsi_val = ta.rsi(close, length)
plot(rsi_val, "RSI", color.purple)
hline(70, "Overbought", color.red, style.dashed)
hline(30, "Oversold", color.green, style.dashed)
hline(50, "Mid", color.gray, style.dotted)`,
  },
  {
    id: 'ema-cross',
    name: 'EMA Crossover',
    description: 'Fast and slow EMA with crossover markers',
    source: `@version(1)
@overlay(true)

input fast = 9
input slow = 21

fast_ema = ta.ema(close, fast)
slow_ema = ta.ema(close, slow)
plot(fast_ema, "Fast EMA", color.blue)
plot(slow_ema, "Slow EMA", color.orange)`,
  },
  {
    id: 'bollinger-squeeze',
    name: 'Bollinger Band Squeeze',
    description: 'Bollinger Bands with squeeze detection',
    source: `@version(1)
@overlay(true)

input length = 20
input mult = 2.0

bb = ta.bollinger(close, length, mult)
plot(bb.upper, "Upper BB", color.blue)
plot(bb.lower, "Lower BB", color.blue)
plot(bb.middle, "Middle BB", color.gray)`,
  },
  {
    id: 'supertrend',
    name: 'Supertrend',
    description: 'Supertrend indicator for trend following',
    source: `@version(1)
@overlay(true)

input period = 10
input multiplier = 3.0

st = ta.supertrend(bars, period, multiplier)
plot(st.upper, "Supertrend Up", color.green)
plot(st.lower, "Supertrend Down", color.red)`,
  },
  {
    id: 'volume-profile',
    name: 'Volume Spike Detector',
    description: 'Highlights bars with unusually high volume',
    source: `@version(1)
@overlay(false)

input lookback = 20
input threshold = 2.0

vol_sma = ta.sma(volume, lookback)
ratio = volume.map((v, i) => vol_sma[i] ? v / vol_sma[i] : 0)
plot(ratio, "Volume Ratio", color.cyan)
hline(threshold, "Spike Level", color.red, style.dashed)
hline(1.0, "Average", color.gray, style.dotted)`,
  },
  {
    id: 'ichimoku-cloud',
    name: 'Ichimoku Cloud',
    description: 'Full Ichimoku Kinko Hyo system',
    source: `@version(1)
@overlay(true)

input tenkan = 9
input kijun = 26
input senkou_b = 52

ichi = ta.ichimoku(bars, tenkan, kijun, senkou_b, kijun)
plot(ichi.tenkan, "Tenkan", color.blue)
plot(ichi.kijun, "Kijun", color.red)
plot(ichi.senkouA, "Senkou A", color.green)
plot(ichi.senkouB, "Senkou B", color.maroon)`,
  },
];

export default { transpile, runEdgeScript, EXAMPLE_SCRIPTS, COLORS };
