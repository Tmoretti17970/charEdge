// ═══════════════════════════════════════════════════════════════════
// Poll Slice — prediction polls
// Previously: usePollStore.js
// ═══════════════════════════════════════════════════════════════════

const initialPolls = [
  // CRYPTO & BLOCKCHAIN (14)
  {
    id: 'poll_btc_100k',
    category: 'crypto',
    question: 'Will BTC hit $100k by the end of the year?',
    ticker: 'BTCUSDT',
    options: [
      { id: 'yes', label: 'Yes', votes: 14200 },
      { id: 'no', label: 'No', votes: 5560 },
    ],
    status: 'active',
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'poll_eth_flippening',
    category: 'crypto',
    question: 'Will ETH ever flip BTC in market cap?',
    ticker: 'ETHUSDT',
    options: [
      { id: 'yes', label: 'Yes', votes: 8450 },
      { id: 'no', label: 'No', votes: 22100 },
      { id: 'unsure', label: 'Unsure', votes: 3120 },
    ],
    status: 'active',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'poll_sol_500',
    category: 'crypto',
    question: 'Will SOL cross $500 this cycle?',
    ticker: 'SOLUSDT',
    options: [
      { id: 'yes', label: 'Yes', votes: 12340 },
      { id: 'no', label: 'No', votes: 4890 },
      { id: 'unsure', label: 'Unsure', votes: 1560 },
    ],
    status: 'active',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'poll_doge_1',
    category: 'crypto',
    question: 'Will Dogecoin (DOGE) reach $1.00?',
    ticker: 'DOGEUSDT',
    options: [
      { id: 'yes', label: 'Yes', votes: 45600 },
      { id: 'no', label: 'No', votes: 32100 },
    ],
    status: 'active',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'poll_binance_dom',
    category: 'crypto',
    question: 'Will Binance maintain #1 spot by volume all year?',
    ticker: 'BNBUSDT',
    options: [
      { id: 'yes', label: 'Yes', votes: 15020 },
      { id: 'no', label: 'No', votes: 8400 },
    ],
    status: 'active',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 300 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'poll_ada_ath',
    category: 'crypto',
    question: 'Will Cardano (ADA) hit a new All-Time High this cycle?',
    ticker: 'ADAUSDT',
    options: [
      { id: 'yes', label: 'Yes', votes: 8900 },
      { id: 'no', label: 'No', votes: 12500 },
    ],
    status: 'active',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 150 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'poll_sol_etf',
    category: 'crypto',
    question: 'Will a Spot Solana ETF be approved in the US this year?',
    ticker: 'SOLUSDT',
    options: [
      { id: 'yes', label: 'Yes', votes: 18400 },
      { id: 'no', label: 'No', votes: 11200 },
    ],
    status: 'active',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'poll_xrp_sec',
    category: 'crypto',
    question: 'Will XRP fully resolve its SEC lawsuit favorably this year?',
    ticker: 'XRPUSDT',
    options: [
      { id: 'yes', label: 'Yes', votes: 22100 },
      { id: 'no', label: 'No', votes: 9800 },
    ],
    status: 'active',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'poll_eth_gas',
    category: 'crypto',
    question: 'Will ETH gas average below 10 gwei for a full month?',
    ticker: 'ETHUSDT',
    options: [
      { id: 'yes', label: 'Yes', votes: 5600 },
      { id: 'no', label: 'No', votes: 19400 },
    ],
    status: 'active',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'poll_usdt_peg',
    category: 'crypto',
    question: 'Will Tether (USDT) dip below $0.95 for > 24 hours?',
    ticker: 'USDT',
    options: [
      { id: 'yes', label: 'Yes', votes: 3200 },
      { id: 'no', label: 'No', votes: 45000 },
    ],
    status: 'active',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'poll_sovereign_btc',
    category: 'crypto',
    question: 'Will a major sovereign wealth fund publicly announce BTC holdings?',
    ticker: 'BTCUSDT',
    options: [
      { id: 'yes', label: 'Yes', votes: 28900 },
      { id: 'no', label: 'No', votes: 7600 },
    ],
    status: 'active',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 200 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'poll_crypto_mcap',
    category: 'crypto',
    question: 'Will the total crypto market cap exceed $5 Trillion?',
    ticker: 'TOTAL',
    options: [
      { id: 'yes', label: 'Yes', votes: 31000 },
      { id: 'no', label: 'No', votes: 14200 },
    ],
    status: 'active',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 250 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'poll_btcd_60',
    category: 'crypto',
    question: 'Will Bitcoin dominance (BTC.D) cross 60% this year?',
    ticker: 'BTC.D',
    options: [
      { id: 'yes', label: 'Yes', votes: 17500 },
      { id: 'no', label: 'No', votes: 19200 },
    ],
    status: 'active',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'poll_l2_flippening',
    category: 'crypto',
    question: 'Will an ETH L2 surpass Ethereum Mainnet in TVL?',
    ticker: 'ETHUSDT',
    options: [
      { id: 'yes', label: 'Yes', votes: 4800 },
      { id: 'no', label: 'No', votes: 27500 },
    ],
    status: 'active',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 300 * 24 * 60 * 60 * 1000).toISOString(),
  },
  // MACRO & TRADITIONAL MARKETS (6)
  {
    id: 'poll_fed_cuts',
    category: 'macro',
    question: 'Will the Fed cut rates more than 3 times this year?',
    ticker: 'DXY',
    options: [
      { id: 'yes', label: 'Yes', votes: 12500 },
      { id: 'no', label: 'No', votes: 15600 },
    ],
    status: 'active',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'poll_spx_6000',
    category: 'macro',
    question: 'Will the S&P 500 index hit 6000 by year-end?',
    ticker: 'SPX',
    options: [
      { id: 'yes', label: 'Yes', votes: 21000 },
      { id: 'no', label: 'No', votes: 18400 },
    ],
    status: 'active',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 200 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'poll_gold_3000',
    category: 'macro',
    question: 'Will Gold (XAU) cross $3000 an ounce this year?',
    ticker: 'XAUUSD',
    options: [
      { id: 'yes', label: 'Yes', votes: 16800 },
      { id: 'no', label: 'No', votes: 9200 },
    ],
    status: 'active',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 250 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'poll_aapl_btc',
    category: 'macro',
    question: 'Will Apple buy Bitcoin for its corporate treasury?',
    ticker: 'AAPL',
    options: [
      { id: 'yes', label: 'Yes', votes: 8500 },
      { id: 'no', label: 'No', votes: 34200 },
    ],
    status: 'active',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 350 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'poll_ai_tokens',
    category: 'crypto',
    question: 'Will AI tokens combined market cap surpass $100B?',
    ticker: 'TOTAL',
    options: [
      { id: 'yes', label: 'Yes', votes: 24500 },
      { id: 'no', label: 'No', votes: 11200 },
    ],
    status: 'active',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 150 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'poll_defi_stable',
    category: 'crypto',
    question: 'Will a decentralized stablecoin flip USDC in market cap?',
    ticker: 'USDC',
    options: [
      { id: 'yes', label: 'Yes', votes: 5400 },
      { id: 'no', label: 'No', votes: 22800 },
    ],
    status: 'active',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 300 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export { initialPolls };

export const createPollSlice = (set, get) => ({
  polls: initialPolls,
  userVotes: {},

  vote: (pollId, optionId) => {
    set((state) => {
      if (state.userVotes[pollId]) return state;

      const newPolls = state.polls.map((poll) => {
        if (poll.id === pollId) {
          return {
            ...poll,
            options: poll.options.map((opt) => (opt.id === optionId ? { ...opt, votes: opt.votes + 1 } : opt)),
          };
        }
        return poll;
      });

      return {
        polls: newPolls,
        userVotes: {
          ...state.userVotes,
          [pollId]: optionId,
        },
      };
    });
  },

  resolvePoll: (pollId, winningOptionId) => {
    set((state) => ({
      polls: state.polls.map((poll) =>
        poll.id === pollId ? { ...poll, status: 'resolved', winningOptionId } : poll,
      ),
    }));
  },

  getPollsForTicker: (ticker) => {
    return get().polls.filter((p) => p.ticker === ticker && p.status === 'active');
  },
});
