export const fetchXSentiment = async (category = 'all') => {
  // Simulate API delay
  await new Promise((r) => setTimeout(r, 600));

  if (category === 'macro') {
    return {
      score: 48, // 0-100
      label: 'Neutral',
      mentionVolume24h: 340000,
      volumeChangePct: -4.5,
      topKeywords: ['#Fed', 'Inflation', 'Rates', 'Gold'],
      breakdown: {
        bullish: 30,
        neutral: 45,
        bearish: 25,
      },
      lastUpdated: new Date().toISOString(),
    };
  }

  return {
    score: 72, // 0-100
    label: 'Bullish',
    mentionVolume24h: 145000,
    volumeChangePct: 12.5,
    topKeywords: ['#Bitcoin', 'ETF', 'Bull Run', 'Solana'],
    breakdown: {
      bullish: 65,
      neutral: 20,
      bearish: 15,
    },
    lastUpdated: new Date().toISOString(),
  };
};

export const fetchTopPosts = async (category = 'all') => {
  await new Promise((r) => setTimeout(r, 700));

  const cryptoPosts = [
    {
      id: '1',
      author: {
        name: 'Crypto Analyst',
        handle: '@crypto_analyst',
        verified: true,
        avatar: 'https://i.pravatar.cc/150?u=1',
      },
      content:
        'Bitcoin just broke major resistance at $70k. Next target $75k. The structure looks incredibly solid here. #BTC #Crypto',
      likes: 4500,
      reposts: 1200,
      replies: 340,
      timeAgo: '2h',
      sentiment: 'bullish',
    },
    {
      id: '2',
      author: {
        name: 'Whale Alerts',
        handle: '@whale_alerts',
        verified: true,
        avatar: 'https://i.pravatar.cc/150?u=2',
      },
      content: '🚨 🚨 🚨 10,000 ETH (approx $35M) transferred from unknown wallet to Binance.',
      likes: 8900,
      reposts: 3100,
      replies: 890,
      timeAgo: '4h',
      sentiment: 'neutral',
    },
    {
      id: '4',
      author: {
        name: 'Solana Daily',
        handle: '@solana_daily',
        verified: true,
        avatar: 'https://i.pravatar.cc/150?u=4',
      },
      content: 'Network activity on Solana reaches new all-time high! DEX volume crosses $3B in 24h. 🚀',
      likes: 5600,
      reposts: 1800,
      replies: 450,
      timeAgo: '6h',
      sentiment: 'bullish',
    },
  ];

  const macroPosts = [
    {
      id: '3',
      author: {
        name: 'Macro Trader',
        handle: '@macro_trader',
        verified: false,
        avatar: 'https://i.pravatar.cc/150?u=3',
      },
      content:
        'Inflation data came in hotter than expected. Expecting some short-term volatility in risk assets including crypto. Stay safe out there.',
      likes: 1200,
      reposts: 450,
      replies: 120,
      timeAgo: '5h',
      sentiment: 'bearish',
    },
    {
      id: '5',
      author: { name: 'FX Sniper', handle: '@fx_sniper', verified: true, avatar: 'https://i.pravatar.cc/150?u=5' },
      content:
        'DXY cooling off as markets price in a potential dovish tone from the Fed next week. Gold catching a nice bid here.',
      likes: 3400,
      reposts: 890,
      replies: 210,
      timeAgo: '1h',
      sentiment: 'bullish',
    },
  ];

  if (category === 'crypto') return cryptoPosts;
  if (category === 'macro') return macroPosts;
  // mix them
  return [cryptoPosts[0], macroPosts[0], cryptoPosts[1], macroPosts[1]];
};

export const fetchMarketNews = async (category = 'all') => {
  await new Promise((r) => setTimeout(r, 800));

  const cryptoNews = [
    {
      id: 'n1',
      title: 'SEC Delays Decision on Spot Ethereum ETFs',
      source: 'CoinDesk',
      publishedAt: '2026-02-22T20:00:00Z',
      url: '#',
      imageUrl: 'https://images.unsplash.com/photo-1621416894569-0f39ed31d247?auto=format&fit=crop&w=400&q=80',
      description:
        'The Securities and Exchange Commission has delayed its decision on several spot Ethereum ETF applications, pushing the deadline to next month.',
    },
    {
      id: 'n2',
      title: 'Major Protocol Upgrade Implemented Successfully',
      source: 'The Block',
      publishedAt: '2026-02-22T18:30:00Z',
      url: '#',
      imageUrl: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=400&q=80',
      description:
        'The highly anticipated network upgrade went live earlier today, promising reduced fees and faster transaction times.',
    },
  ];

  const macroNews = [
    {
      id: 'n3',
      title: 'Unemployment Rate Unexpectedly Ticks Higher',
      source: 'Bloomberg',
      publishedAt: '2026-02-22T15:15:00Z',
      url: '#',
      imageUrl: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=400&q=80',
      description:
        'Weekly jobless claims rose above expectations, suggesting the labor market may be beginning to cool off.',
    },
    {
      id: 'n4',
      title: 'ECB Maintains Interest Rates, Signals Future Cuts',
      source: 'Reuters',
      publishedAt: '2026-02-22T12:00:00Z',
      url: '#',
      imageUrl: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=400&q=80',
      description:
        'The European Central Bank held rates steady but indicated that disinflationary trends could allow for policy easing soon.',
    },
  ];

  if (category === 'crypto') return cryptoNews;
  if (category === 'macro') return macroNews;
  return [cryptoNews[0], macroNews[0], cryptoNews[1], macroNews[1]];
};
