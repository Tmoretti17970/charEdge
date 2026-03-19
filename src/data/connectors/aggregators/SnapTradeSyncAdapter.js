// ═══════════════════════════════════════════════════════════════════
// charEdge — SnapTrade Sync Adapter (Phase 8 Sprint 8.2)
//
// Maps SnapTrade activity/position schema to charEdge canonical
// trade format. Handles multi-account flattening and dedup.
// ═══════════════════════════════════════════════════════════════════

import { deduplicateImport } from '../../importExport/ReconciliationEngine.js';

// ─── Schema Mapping ─────────────────────────────────────────────

/**
 * Map a SnapTrade activity to charEdge canonical trade format.
 *
 * @param {Object} activity - SnapTrade activity object
 * @param {Object} [accountInfo] - Account metadata
 * @returns {Object|null} Canonical trade or null if not a trade activity
 */
export function mapActivity(activity, accountInfo = {}) {
  const type = (activity.type || activity.action || '').toUpperCase();

  // Only map buy/sell/dividend activities
  if (!['BUY', 'SELL', 'DIVIDEND', 'FEE', 'CONTRIBUTION', 'WITHDRAWAL'].includes(type)) {
    return null;
  }

  // For non-trade activities (fees, contributions), create a note-only entry
  if (['FEE', 'CONTRIBUTION', 'WITHDRAWAL'].includes(type)) {
    return {
      date: activity.trade_date || activity.settlement_date,
      symbol: activity.symbol?.symbol || 'CASH',
      side: type === 'CONTRIBUTION' ? 'BUY' : 'SELL',
      quantity: 0,
      price: 0,
      pnl: 0,
      commission: type === 'FEE' ? Math.abs(parseFloat(activity.amount || 0)) : 0,
      assetClass: 'cash',
      notes: `SnapTrade ${type} | ${accountInfo.name || accountInfo.brokerage?.name || ''}`,
      _source: 'snaptrade',
      _accountId: accountInfo.id,
      _externalId: activity.id || activity.external_id,
    };
  }

  const symbol = _resolveSymbol(activity);
  const side = type === 'SELL' ? 'SELL' : 'BUY';

  return {
    date: activity.trade_date || activity.settlement_date,
    symbol,
    side,
    quantity: Math.abs(parseFloat(activity.units || activity.quantity || 0)),
    price: parseFloat(activity.price || 0),
    pnl: type === 'DIVIDEND' ? parseFloat(activity.amount || 0) : 0,
    commission: parseFloat(activity.commission || activity.fee || 0),
    assetClass: _guessAssetClass(symbol, activity),
    notes: `SnapTrade | ${accountInfo.name || accountInfo.brokerage?.name || ''} | ${type}`,
    _source: 'snaptrade',
    _accountId: accountInfo.id,
    _externalId: activity.id || activity.external_id,
  };
}

/**
 * Map a SnapTrade position to charEdge position format.
 *
 * @param {Object} position - SnapTrade position object
 * @param {Object} [accountInfo]
 * @returns {Object} Position summary
 */
export function mapPosition(position, accountInfo = {}) {
  const symbol = position.symbol?.symbol || position.symbol?.ticker || '';

  return {
    symbol: symbol.toUpperCase(),
    quantity: parseFloat(position.units || 0),
    avgEntry: parseFloat(position.average_purchase_price || position.price || 0),
    currentPrice: parseFloat(position.current_price || position.price || 0),
    marketValue: parseFloat(position.market_value || 0),
    unrealizedPnl: parseFloat(position.open_pnl || 0),
    costBasis: parseFloat(position.cost_basis || 0),
    currency: position.currency || 'USD',
    assetClass: _guessAssetClass(symbol, position),
    _source: 'snaptrade',
    _accountId: accountInfo.id,
    broker: accountInfo.name || accountInfo.brokerage?.name || 'Unknown',
  };
}

// ─── Batch Sync ─────────────────────────────────────────────────

/**
 * Process a batch of SnapTrade activities into canonical trades,
 * deduplicating against existing journal entries.
 *
 * @param {Object[]} activities - Raw SnapTrade activities
 * @param {Object[]} existingTrades - Current journal trades
 * @param {Object} [accountInfo]
 * @returns {{ trades: Object[], duplicates: Object[], skipped: number }}
 */
export function syncActivities(activities, existingTrades, accountInfo = {}) {
  const mapped = [];
  let skipped = 0;

  for (const activity of activities) {
    const trade = mapActivity(activity, accountInfo);
    if (trade) {
      mapped.push(trade);
    } else {
      skipped++;
    }
  }

  // Dedup against existing trades
  const { unique, duplicates } = deduplicateImport(existingTrades, mapped);

  return {
    trades: unique,
    duplicates,
    skipped,
  };
}

// ─── Helpers ────────────────────────────────────────────────────

function _resolveSymbol(activity) {
  if (activity.symbol?.symbol) return activity.symbol.symbol.toUpperCase();
  if (activity.symbol?.ticker) return activity.symbol.ticker.toUpperCase();
  if (typeof activity.symbol === 'string') return activity.symbol.toUpperCase();
  return 'UNKNOWN';
}

function _guessAssetClass(symbol, data) {
  const type = (data.type || data.security_type || '').toLowerCase();

  if (type.includes('option')) return 'options';
  if (type.includes('crypto') || type.includes('digital')) return 'crypto';
  if (type.includes('bond') || type.includes('fixed')) return 'bonds';
  if (type.includes('etf') || type.includes('fund')) return 'etf';
  if (type.includes('future') || type.includes('commodity')) return 'futures';

  // Heuristic: crypto symbols
  if (/^(BTC|ETH|SOL|ADA|DOT|DOGE|XRP|AVAX|MATIC)/i.test(symbol)) return 'crypto';

  return 'equities';
}

export default { mapActivity, mapPosition, syncActivities };
