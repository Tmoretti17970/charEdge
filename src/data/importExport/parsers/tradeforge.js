// charEdge — charEdge Native CSV Parser
import { _uid, _parseNum } from '../helpers.js';

export function parsecharEdgeCSV(rows) {
  return rows
    .map((r) => ({
      id: r['id'] || _uid(),
      date: r['date'] || null,
      closeDate: r['closeDate'] || null,
      symbol: r['symbol'] || '',
      side: r['side'] || 'long',
      entry: _parseNum(r['entry']),
      exit: _parseNum(r['exit']),
      quantity: _parseNum(r['quantity']) || 1,
      pnl: _parseNum(r['pnl']),
      fees: _parseNum(r['fees']),
      stopLoss: _parseNum(r['stopLoss']),
      takeProfit: _parseNum(r['takeProfit']),
      rMultiple: _parseNum(r['rMultiple']),
      playbook: r['playbook'] || '',
      assetClass: r['assetClass'] || '',
      emotion: r['emotion'] || '',
      notes: r['notes'] || '',
      ruleBreak: r['ruleBreak'] === 'true',
      tags: r['tags'] ? r['tags'].split(';').filter(Boolean) : [],
    }))
    .filter((t) => t.date && t.symbol);
}
