// ═══════════════════════════════════════════════════════════════════
// charEdge — Watchlist Templates (Sprint 94)
//
// Pre-built watchlist collections for popular trading themes.
//
// Usage:
//   import { watchlistTemplates } from './WatchlistTemplates';
//   const templates = watchlistTemplates.getAll();
//   const mag7 = watchlistTemplates.get('magnificent-7');
// ═══════════════════════════════════════════════════════════════════

// ─── Types ───────────────────────────────────────────────────────

export interface WatchlistTemplate {
  id: string;
  name: string;
  description: string;
  category: 'tech' | 'crypto' | 'sectors' | 'popular' | 'commodities';
  emoji: string;
  symbols: string[];
}

// ─── Templates ──────────────────────────────────────────────────

const TEMPLATES: WatchlistTemplate[] = [
  {
    id: 'magnificent-7',
    name: 'Magnificent 7',
    description: 'The seven mega-cap tech stocks driving the market',
    category: 'tech',
    emoji: '🏆',
    symbols: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA'],
  },
  {
    id: 'faang',
    name: 'FAANG+',
    description: 'Classic FAANG stocks plus key tech leaders',
    category: 'tech',
    emoji: '🦁',
    symbols: ['META', 'AAPL', 'AMZN', 'NFLX', 'GOOGL', 'MSFT', 'NVDA', 'CRM'],
  },
  {
    id: 'ai-leaders',
    name: 'AI Revolution',
    description: 'Companies leading the artificial intelligence wave',
    category: 'tech',
    emoji: '🤖',
    symbols: ['NVDA', 'MSFT', 'GOOGL', 'AMD', 'PLTR', 'SNOW', 'AI', 'SMCI'],
  },
  {
    id: 'crypto-majors',
    name: 'Crypto Majors',
    description: 'Top cryptocurrencies by market cap',
    category: 'crypto',
    emoji: '₿',
    symbols: ['BTC-USD', 'ETH-USD', 'SOL-USD', 'XRP-USD', 'ADA-USD', 'AVAX-USD', 'DOT-USD', 'LINK-USD'],
  },
  {
    id: 'crypto-defi',
    name: 'DeFi Blue Chips',
    description: 'Leading decentralized finance protocols',
    category: 'crypto',
    emoji: '🏦',
    symbols: ['UNI-USD', 'AAVE-USD', 'MKR-USD', 'LINK-USD', 'SNX-USD', 'CRV-USD', 'COMP-USD'],
  },
  {
    id: 'sector-etfs',
    name: 'Sector ETFs',
    description: 'S&P 500 sector SPDR ETFs for macro tracking',
    category: 'sectors',
    emoji: '📊',
    symbols: ['XLK', 'XLF', 'XLE', 'XLV', 'XLI', 'XLP', 'XLU', 'XLY', 'XLB', 'XLRE', 'XLC'],
  },
  {
    id: 'market-indices',
    name: 'Market Indices',
    description: 'Major US and global market indices',
    category: 'sectors',
    emoji: '🌍',
    symbols: ['SPY', 'QQQ', 'DIA', 'IWM', 'VTI', 'EFA', 'EEM', 'VGK'],
  },
  {
    id: 'meme-stocks',
    name: 'Meme Stocks',
    description: 'Popular retail trader favorites',
    category: 'popular',
    emoji: '🚀',
    symbols: ['GME', 'AMC', 'BBBY', 'BB', 'NOK', 'PLTR', 'SOFI', 'RIVN'],
  },
  {
    id: 'growth-momentum',
    name: 'Growth Momentum',
    description: 'High-growth momentum stocks',
    category: 'popular',
    emoji: '📈',
    symbols: ['NVDA', 'ARM', 'SMCI', 'CRWD', 'PANW', 'NOW', 'UBER', 'DASH'],
  },
  {
    id: 'commodities',
    name: 'Commodities',
    description: 'Key commodity ETFs and futures',
    category: 'commodities',
    emoji: '🛢️',
    symbols: ['GLD', 'SLV', 'USO', 'UNG', 'CORN', 'WEAT', 'DBA', 'DBB'],
  },
  {
    id: 'dividend-kings',
    name: 'Dividend Kings',
    description: 'High-yield dividend aristocrats',
    category: 'popular',
    emoji: '👑',
    symbols: ['JNJ', 'PG', 'KO', 'PEP', 'MMM', 'EMR', 'CL', 'ABT'],
  },
];

// ─── Manager ────────────────────────────────────────────────────

class WatchlistTemplateManager {
  getAll(): WatchlistTemplate[] {
    return TEMPLATES;
  }

  get(id: string): WatchlistTemplate | null {
    return TEMPLATES.find(t => t.id === id) || null;
  }

  getByCategory(category: string): WatchlistTemplate[] {
    return TEMPLATES.filter(t => t.category === category);
  }

  getCategories(): string[] {
    return [...new Set(TEMPLATES.map(t => t.category))];
  }

  search(query: string): WatchlistTemplate[] {
    const q = query.toLowerCase();
    return TEMPLATES.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.symbols.some(s => s.toLowerCase().includes(q))
    );
  }
}

// ─── Singleton ──────────────────────────────────────────────────

export const watchlistTemplates = new WatchlistTemplateManager();
export default watchlistTemplates;
