// ═══════════════════════════════════════════════════════════════════
// charEdge — Broker Export Guides (Phase 6 Sprint 6.4)
//
// Step-by-step instructions for exporting trade data from each
// supported broker platform.
// ═══════════════════════════════════════════════════════════════════

const BROKER_GUIDES = {
  tradovate: {
    name: 'Tradovate',
    logo: '📈',
    format: 'CSV',
    steps: [
      'Log in to your Tradovate account',
      'Go to Reports → Trade History',
      'Set your desired date range',
      'Click "Export to CSV"',
      'Upload the downloaded file to charEdge',
    ],
    tips: ['Use "All Time" for a complete history', 'Commission data is included automatically'],
    url: 'https://trader.tradovate.com',
  },
  ninjatrader: {
    name: 'NinjaTrader',
    logo: '⚔️',
    format: 'CSV',
    steps: [
      'Open NinjaTrader Desktop',
      'Go to Control Center → Account Performance',
      'Select your account and date range',
      'Right-click the trade list → Export',
      'Save as CSV and upload to charEdge',
    ],
    tips: ['Include commission/fee columns for accurate P&L'],
    url: 'https://ninjatrader.com',
  },
  thinkorswim: {
    name: 'thinkorswim (TD)',
    logo: '🏦',
    format: 'CSV',
    steps: [
      'Open thinkorswim platform',
      'Go to Monitor → Account Statement',
      'Set date range and select "Trades" tab',
      'Click Export → CSV',
      'Upload to charEdge',
    ],
    tips: ['Filter by "Trades" only to avoid account activity entries'],
    url: 'https://www.tdameritrade.com/tools-and-platforms/thinkorswim.page',
  },
  schwab: {
    name: 'Charles Schwab',
    logo: '💎',
    format: 'API (OAuth)',
    steps: [
      'Go to developer.schwab.com and create an account',
      'Register a new application',
      'Set the redirect URI to your charEdge URL + /auth/schwab/callback',
      'Copy the Client ID (App Key) and Client Secret',
      'Enter them in charEdge and authorize via popup',
    ],
    tips: ['Works with both Schwab and ThinkorSwim accounts', 'Use read-only scope for journaling'],
    url: 'https://developer.schwab.com',
  },
  tradestation: {
    name: 'TradeStation',
    logo: '📊',
    format: 'CSV',
    steps: [
      'Log in to TradeStation',
      'Navigate to Trade Manager → Trade History',
      'Select date range and asset classes',
      'Click Export/Download as CSV',
      'Upload the file to charEdge',
    ],
    tips: ['Export each asset class separately for best results'],
    url: 'https://www.tradestation.com',
  },
  ibkr: {
    name: 'Interactive Brokers',
    logo: '🟢',
    format: 'CSV',
    steps: [
      'Log in to IBKR Client Portal',
      'Go to Performance & Reports → Statements',
      'Select "Activity Statement" or "Trade Confirmation"',
      'Set date range and click "Run"',
      'Download as CSV',
    ],
    tips: ['Use "Flex Queries" for custom field selection', 'Activity Statement includes all details'],
    url: 'https://www.interactivebrokers.com',
  },
  robinhood: {
    name: 'Robinhood',
    logo: '🪶',
    format: 'CSV',
    steps: [
      'Open Robinhood app or web',
      'Go to Account → Statements & History',
      'Select "Account Statements"',
      'Download your monthly statement (CSV)',
      'Upload to charEdge',
    ],
    tips: ['Robinhood statements may require date parsing adjustments'],
    url: 'https://robinhood.com',
  },
  webull: {
    name: 'Webull',
    logo: '🐂',
    format: 'CSV',
    steps: [
      'Open Webull Desktop or Web',
      'Go to Records → Trade History',
      'Set date range',
      'Click export/download icon',
      'Upload the CSV to charEdge',
    ],
    tips: ['Use the desktop app for the most complete export options'],
    url: 'https://www.webull.com',
  },
  mt5: {
    name: 'MetaTrader 5',
    logo: '📉',
    format: 'HTML / CSV',
    steps: [
      'Open MetaTrader 5',
      'Go to History tab at the bottom',
      'Right-click → Select "All History"',
      'Right-click again → Save as Detailed Report',
      'Upload the HTML file to charEdge',
    ],
    tips: ['Detailed Report includes more data than the regular report', 'HTML format preserves all columns'],
    url: null,
  },
  binance: {
    name: 'Binance',
    logo: '🟡',
    format: 'CSV',
    steps: [
      'Log in to Binance',
      'Go to Orders → Trade History',
      'Click "Export Trade History"',
      'Select date range and click Generate',
      'Download and upload to charEdge',
    ],
    tips: ['Max 3-month exports at a time', 'Include fee data for accurate P&L'],
    url: 'https://www.binance.com',
  },
  coinbase: {
    name: 'Coinbase',
    logo: '🔵',
    format: 'CSV',
    steps: [
      'Log in to Coinbase',
      'Go to Taxes → Documents',
      'Find "Transaction History" and download CSV',
      'Or go to Reports → Generate Report → Transaction History',
      'Upload to charEdge',
    ],
    tips: ['Coinbase Pro/Advanced has separate export in Orders → Export'],
    url: 'https://www.coinbase.com',
  },
  fidelity: {
    name: 'Fidelity',
    logo: '🟢',
    format: 'CSV',
    steps: [
      'Log in to Fidelity',
      'Go to Accounts & Trade → Trade History',
      'Set date range',
      'Click "Export" or "Download"',
      'Upload the CSV to charEdge',
    ],
    tips: ['Activity & Orders page has the most complete data'],
    url: 'https://www.fidelity.com',
  },
  generic: {
    name: 'Generic CSV',
    logo: '📄',
    format: 'CSV',
    steps: [
      'Export your trade history as CSV from your broker',
      'Ensure columns include: Date, Symbol, Side (Buy/Sell), Quantity, Price',
      'Upload to charEdge',
      'Use the Column Mapper to assign any unrecognized columns',
    ],
    tips: ['charEdge supports most CSV formats automatically', 'The column mapper handles custom headers'],
    url: null,
  },
};

export { BROKER_GUIDES };
export default BROKER_GUIDES;
