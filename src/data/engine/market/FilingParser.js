// ═══════════════════════════════════════════════════════════════════
// charEdge v15 — SEC Filing Parser
//
// Parses SEC EDGAR filing content to extract structured data:
//   • 8-K Item categorization with urgency scoring
//   • Form 4 insider transaction extraction
//   • Key financial figures from earnings filings
//
// Usage:
//   import { filingParser } from './FilingParser.js';
//   const parsed = filingParser.parse8K(htmlContent);
//   const insider = filingParser.parseForm4(xmlContent);
// ═══════════════════════════════════════════════════════════════════

// ─── 8-K Item Definitions ──────────────────────────────────────

const ITEM_CATEGORIES = {
  '1.01': { label: 'Entry into Material Agreement', impact: 'high', icon: '⚡', urgency: 4 },
  '1.02': { label: 'Termination of Material Agreement', impact: 'high', icon: '⚠️', urgency: 4 },
  '1.03': { label: 'Bankruptcy', impact: 'critical', icon: '🔥', urgency: 5 },
  '2.01': { label: 'Acquisition/Disposition', impact: 'high', icon: '⚡', urgency: 4 },
  '2.02': { label: 'Results of Operations (Earnings)', impact: 'critical', icon: '🔥', urgency: 5 },
  '2.03': { label: 'Creation of Financial Obligation', impact: 'medium', icon: '📢', urgency: 3 },
  '2.04': { label: 'Triggering Events (Default)', impact: 'critical', icon: '🔥', urgency: 5 },
  '2.05': { label: 'Costs for Exit/Restructuring', impact: 'high', icon: '⚡', urgency: 4 },
  '2.06': { label: 'Material Impairments', impact: 'high', icon: '⚡', urgency: 4 },
  '3.01': { label: 'Delisting Notice', impact: 'critical', icon: '🔥', urgency: 5 },
  '3.02': { label: 'Unregistered Sale of Securities', impact: 'medium', icon: '📢', urgency: 3 },
  '3.03': { label: 'Amendment to Articles', impact: 'low', icon: '📌', urgency: 2 },
  '4.01': { label: 'Auditor Changes', impact: 'high', icon: '⚠️', urgency: 4 },
  '4.02': { label: 'Non-Reliance on Financial Statements', impact: 'critical', icon: '🔥', urgency: 5 },
  '5.01': { label: 'Leadership Changes', impact: 'medium', icon: '⚠️', urgency: 3 },
  '5.02': { label: 'Officer Departure/Appointment', impact: 'medium', icon: '⚠️', urgency: 3 },
  '5.03': { label: 'Bylaws Amendment', impact: 'low', icon: '📌', urgency: 2 },
  '5.04': { label: 'Temporary Suspension of Trading', impact: 'high', icon: '⚡', urgency: 4 },
  '5.05': { label: 'Code of Ethics Amendments', impact: 'low', icon: '📌', urgency: 2 },
  '5.06': { label: 'Change in Shell Company Status', impact: 'medium', icon: '📢', urgency: 3 },
  '5.07': { label: 'Submission of Matters to Vote', impact: 'low', icon: '📌', urgency: 2 },
  '5.08': { label: 'Shareholder Nominations', impact: 'low', icon: '📌', urgency: 2 },
  '7.01': { label: 'Regulation FD Disclosure', impact: 'medium', icon: '📢', urgency: 3 },
  '8.01': { label: 'Other Events', impact: 'low', icon: '📌', urgency: 2 },
  '9.01': { label: 'Financial Statements & Exhibits', impact: 'low', icon: '📌', urgency: 1 },
};

// ─── Parser Constants ──────────────────────────────────────────

const DOLLAR_REGEX = /\$[\d,]+(?:\.\d+)?(?:\s*(?:million|billion|thousand|M|B|K))?/gi;
const PERCENT_REGEX = /(?:(?:increased?|decreased?|(?:grew|fell|rose|declined))\s+(?:by\s+)?)?(\d+(?:\.\d+)?)\s*%/gi;
const EPS_REGEX = /(?:earnings?\s+per\s+share|EPS)\s*(?:of|was|were|:)?\s*\$?(-?[\d.]+)/gi;
const REVENUE_REGEX = /(?:revenue|net\s+sales|total\s+sales)\s*(?:of|was|were|:)?\s*\$([\d,.]+)\s*(?:million|billion|M|B)?/gi;
const GUIDANCE_REGEX = /(?:guidance|outlook|expect|forecast)[^.]*?\$([\d,.]+)\s*(?:million|billion|M|B)?/gi;

// ─── Filing Parser ─────────────────────────────────────────────

class _FilingParser {

  /**
   * Parse an 8-K filing to extract items and key information.
   *
   * @param {string} content - HTML or plain text content of the 8-K
   * @returns {{ items: Array, keyFigures: Object, urgency: number, summary: string }}
   */
  parse8K(content) {
    if (!content) return { items: [], keyFigures: {}, urgency: 0, summary: '' };

    // Strip HTML tags for analysis
    const text = this._stripHtml(content);

    // Extract Item numbers
    const items = this._extractItems(text);

    // Compute overall urgency (max of all items)
    const urgency = items.length > 0
      ? Math.max(...items.map(i => i.urgency))
      : 1;

    // Extract key financial figures
    const keyFigures = this._extractFinancialFigures(text);

    // Generate summary
    const summary = this._generate8KSummary(items, keyFigures);

    // Check if after-hours filing (boost urgency for earnings)
    const afterHoursBoost = items.some(i => i.itemNumber === '2.02') ? 1 : 0;

    return {
      items,
      keyFigures,
      urgency: Math.min(5, urgency + afterHoursBoost),
      summary,
      isEarnings: items.some(i => i.itemNumber === '2.02'),
      isMaterial: urgency >= 4,
    };
  }

  /**
   * Parse a Form 4 (insider transaction) filing.
   *
   * @param {string} content - XML or text content of the Form 4
   * @returns {{ insider: Object, transactions: Array, totalValue: number }}
   */
  parseForm4(content) {
    if (!content) return { insider: {}, transactions: [], totalValue: 0 };

    const text = this._stripHtml(content);
    const transactions = [];
    let insiderName = '';
    let insiderTitle = '';

    // Extract insider name
    const nameMatch = text.match(/(?:Reporting Person|Name of Reporting Person)[:\s]*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/);
    if (nameMatch) insiderName = nameMatch[1].trim();

    // Extract title/relationship
    const titleMatch = text.match(/(?:Title|Relationship)[:\s]*(\w+(?:\s+\w+)*)/i);
    if (titleMatch) insiderTitle = titleMatch[1].trim();

    // Extract transactions
    const txRegex = /(?:(?:Purchase|Sale|Grant|Exercise|Disposition)[^.]*?\$?([\d,.]+)\s*(?:shares?|options?)?[^.]*?(?:at\s*\$?([\d,.]+)|price\s*(?:of\s*)?\$?([\d,.]+)))/gi;
    let match;
    while ((match = txRegex.exec(text)) !== null) {
      const shares = this._parseNumber(match[1]);
      const price = this._parseNumber(match[2] || match[3]);
      const type = /sale|sold|disposition/i.test(match[0]) ? 'sell' : 'buy';
      if (shares > 0 && price > 0) {
        transactions.push({ type, shares, price, value: shares * price });
      }
    }

    // Try simple dollar extraction for total value
    const dollarMatches = text.match(DOLLAR_REGEX) || [];
    const values = dollarMatches.map(d => this._parseDollarAmount(d)).filter(v => v > 0);
    const totalValue = transactions.length > 0
      ? transactions.reduce((s, t) => s + t.value, 0)
      : Math.max(...values, 0);

    return {
      insider: { name: insiderName, title: insiderTitle },
      transactions,
      totalValue,
      urgency: totalValue > 1000000 ? 4 : totalValue > 100000 ? 3 : 2,
      isMaterialBuy: transactions.some(t => t.type === 'buy' && t.value > 1000000),
    };
  }

  /**
   * Compute urgency score with after-hours context.
   *
   * @param {Object} filing - Parsed filing
   * @param {number} filingHour - Hour of filing (0-23 UTC)
   * @returns {number} Adjusted urgency 1-5
   */
  computeUrgency(filing, filingHour) {
    let urgency = filing.urgency || 1;

    // After-hours filings (4PM-8AM ET = 21-13 UTC) get urgency boost
    const isAfterHours = filingHour >= 21 || filingHour < 13;
    if (isAfterHours && filing.isEarnings) urgency = 5;
    if (isAfterHours && urgency >= 3) urgency = Math.min(5, urgency + 1);

    return urgency;
  }

  /**
   * Determine if a filing warrants a desktop notification.
   *
   * @param {Object} parsed - Parsed filing result
   * @returns {boolean}
   */
  shouldNotify(parsed) {
    return parsed.urgency >= 4;
  }

  // ─── Private Methods ─────────────────────────────────────────

  /** @private — Extract 8-K Item numbers from text */
  _extractItems(text) {
    const items = [];
    const itemRegex = /Item\s+(\d+\.\d+)/gi;
    let match;
    const seen = new Set();

    while ((match = itemRegex.exec(text)) !== null) {
      const itemNum = match[1];
      if (seen.has(itemNum)) continue;
      seen.add(itemNum);

      const category = ITEM_CATEGORIES[itemNum];
      if (category) {
        items.push({
          itemNumber: itemNum,
          label: category.label,
          impact: category.impact,
          icon: category.icon,
          urgency: category.urgency,
        });
      }
    }

    return items;
  }

  /** @private — Extract financial figures from text */
  _extractFinancialFigures(text) {
    const figures = {};

    // EPS
    const epsMatch = EPS_REGEX.exec(text);
    if (epsMatch) figures.eps = parseFloat(epsMatch[1]);
    EPS_REGEX.lastIndex = 0;

    // Revenue
    const revMatch = REVENUE_REGEX.exec(text);
    if (revMatch) {
      figures.revenue = this._parseDollarAmount('$' + revMatch[1] + (revMatch[0].match(/million|M/i) ? ' million' : revMatch[0].match(/billion|B/i) ? ' billion' : ''));
    }
    REVENUE_REGEX.lastIndex = 0;

    // Guidance
    const guidanceMatch = GUIDANCE_REGEX.exec(text);
    if (guidanceMatch) {
      figures.guidance = this._parseDollarAmount('$' + guidanceMatch[1] + (guidanceMatch[0].match(/million|M/i) ? ' million' : ''));
    }
    GUIDANCE_REGEX.lastIndex = 0;

    // All dollar amounts mentioned
    const dollars = text.match(DOLLAR_REGEX) || [];
    if (dollars.length > 0) {
      figures.dollarAmounts = dollars.slice(0, 10).map(d => ({
        raw: d,
        value: this._parseDollarAmount(d),
      }));
    }

    // Percentage changes
    const pcts = [];
    let pctMatch;
    while ((pctMatch = PERCENT_REGEX.exec(text)) !== null) {
      pcts.push(parseFloat(pctMatch[1]));
    }
    PERCENT_REGEX.lastIndex = 0;
    if (pcts.length) figures.percentages = pcts.slice(0, 5);

    return figures;
  }

  /** @private — Generate a short summary */
  _generate8KSummary(items, figures) {
    if (!items.length) return 'SEC filing details unavailable.';

    const parts = items.map(i => `${i.icon} ${i.label}`);
    let summary = parts.join(', ');

    if (figures.eps) summary += ` | EPS: $${figures.eps}`;
    if (figures.revenue) summary += ` | Revenue: $${this._formatNumber(figures.revenue)}`;

    return summary;
  }

  /** @private */
  _stripHtml(html) {
    return html
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** @private */
  _parseNumber(str) {
    if (!str) return 0;
    return parseFloat(str.replace(/,/g, '')) || 0;
  }

  /** @private */
  _parseDollarAmount(str) {
    if (!str) return 0;
    const num = parseFloat(str.replace(/[$,]/g, '')) || 0;
    if (/billion|B/i.test(str)) return num * 1e9;
    if (/million|M/i.test(str)) return num * 1e6;
    if (/thousand|K/i.test(str)) return num * 1e3;
    return num;
  }

  /** @private */
  _formatNumber(num) {
    if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num.toFixed(2);
  }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const filingParser = new _FilingParser();
export default filingParser;
