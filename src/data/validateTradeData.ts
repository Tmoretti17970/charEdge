// ═══════════════════════════════════════════════════════════════════
// charEdge — Trade Data Validator (Phase 3 Task #47)
//
// Validates trade data on journal import (CSV/JSON).
// Returns per-row validation errors for user feedback.
//
// Usage:
//   import { validateTradeData } from './validateTradeData';
//   const { valid, errors } = validateTradeData(rawTrades);
// ═══════════════════════════════════════════════════════════════════

// ─── Types ───────────────────────────────────────────────────────

export interface TradeValidationError {
  row: number;
  field: string;
  message: string;
}

export interface TradeValidationResult {
  valid: Record<string, unknown>[];
  errors: TradeValidationError[];
  totalRows: number;
  validCount: number;
  errorCount: number;
}

// ─── Required Fields ────────────────────────────────────────────

const REQUIRED_FIELDS = ['symbol', 'side', 'entryPrice'] as const;

const VALID_SIDES = new Set(['long', 'short', 'buy', 'sell']);

// ─── Validator ──────────────────────────────────────────────────

/**
 * Validate an array of raw trade objects from CSV/JSON import.
 * Checks required fields, types, and value ranges.
 */
export function validateTradeData(
  trades: Record<string, unknown>[],
): TradeValidationResult {
  const valid: Record<string, unknown>[] = [];
  const errors: TradeValidationError[] = [];

  for (let i = 0; i < trades.length; i++) {
    const trade = trades[i];
    const row = i + 1; // 1-indexed for user display
    let hasError = false;

    if (!trade || typeof trade !== 'object') {
      errors.push({ row, field: '*', message: 'Row is not a valid object' });
      continue;
    }

    // Required fields
    for (const field of REQUIRED_FIELDS) {
      if (trade[field] === undefined || trade[field] === null || trade[field] === '') {
        errors.push({ row, field, message: `Missing required field "${field}"` });
        hasError = true;
      }
    }

    // Symbol must be a non-empty string
    if (typeof trade.symbol === 'string' && trade.symbol.trim().length === 0) {
      errors.push({ row, field: 'symbol', message: 'Symbol cannot be empty' });
      hasError = true;
    }

    // Side must be a known value
    if (trade.side !== undefined && typeof trade.side === 'string') {
      if (!VALID_SIDES.has(trade.side.toLowerCase())) {
        errors.push({ row, field: 'side', message: `Invalid side "${trade.side}" — expected long/short/buy/sell` });
        hasError = true;
      }
    }

    // Numeric field validation
    const numericChecks: [string, boolean, number?, number?][] = [
      ['entryPrice', true, 0],       // required, must be > 0
      ['exitPrice', false, 0],       // optional, must be > 0 if present
      ['quantity', false, 0],        // optional, must be > 0
      ['pnl', false],                // optional, can be negative
      ['stopLoss', false, 0],        // optional, must be > 0
      ['takeProfit', false, 0],      // optional, must be > 0
    ];

    for (const [field, required, min] of numericChecks) {
      const val = trade[field];
      if (val === undefined || val === null || val === '') {
        if (required && !hasError) {
          errors.push({ row, field, message: `Missing required numeric field "${field}"` });
          hasError = true;
        }
        continue;
      }

      const num = typeof val === 'string' ? parseFloat(val) : val;
      if (typeof num !== 'number' || isNaN(num as number)) {
        errors.push({ row, field, message: `"${field}" must be a valid number, got "${val}"` });
        hasError = true;
      } else if (min !== undefined && (num as number) <= min) {
        errors.push({ row, field, message: `"${field}" must be > ${min}, got ${num}` });
        hasError = true;
      }
    }

    // Date validation
    for (const field of ['date', 'entryTime', 'exitTime', 'entryDate', 'exitDate']) {
      const val = trade[field];
      if (val === undefined || val === null || val === '') continue;

      if (typeof val === 'string') {
        const d = new Date(val);
        if (isNaN(d.getTime())) {
          errors.push({ row, field, message: `"${field}" is not a valid date: "${val}"` });
          hasError = true;
        }
      } else if (typeof val === 'number') {
        // Epoch — sanity check (must be after 2000, before 2100)
        const epoch = val > 1e12 ? val : val * 1000; // s vs ms
        if (epoch < 946684800000 || epoch > 4102444800000) {
          errors.push({ row, field, message: `"${field}" epoch out of range: ${val}` });
          hasError = true;
        }
      }
    }

    if (!hasError) {
      valid.push(trade);
    }
  }

  return {
    valid,
    errors,
    totalRows: trades.length,
    validCount: valid.length,
    errorCount: errors.length,
  };
}

export default validateTradeData;
