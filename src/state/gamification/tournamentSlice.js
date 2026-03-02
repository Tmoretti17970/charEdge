// ═══════════════════════════════════════════════════════════════════
// charEdge — Tournament Slice
//
// Manages tournament data, entry/leave, leaderboards, and time tracking.
// Extracted from useTournamentStore for useGamificationStore composition.
// ═══════════════════════════════════════════════════════════════════

const DAY = 86400000;
const now = Date.now();

export const MOCK_TOURNAMENTS = [
  {
    id: 'tourn_1',
    name: 'Weekly P&L Challenge',
    type: 'pnl',
    status: 'active',
    description: 'Highest net P&L over 7 days wins. All asset classes eligible.',
    startDate: new Date(now - 3 * DAY).toISOString(),
    endDate: new Date(now + 4 * DAY).toISOString(),
    entrants: 156,
    maxEntrants: 500,
    prizes: ['🥇 $500 + Gold Badge', '🥈 $250 + Silver Badge', '🥉 $100 + Bronze Badge'],
    rules: ['Minimum 5 trades to qualify', 'All asset classes allowed', 'Max 10× leverage'],
    leaderboard: [
      { rank: 1, name: 'IronHands', avatar: '💎', pnl: 4820, trades: 23, winRate: 78 },
      { rank: 2, name: 'AlphaWolf', avatar: '🐺', pnl: 3950, trades: 18, winRate: 72 },
      { rank: 3, name: 'QuantFlow', avatar: '🤖', pnl: 3210, trades: 31, winRate: 65 },
      { rank: 4, name: 'NightOwl', avatar: '🦉', pnl: 2890, trades: 15, winRate: 80 },
      { rank: 5, name: 'DeltaForce', avatar: '⚡', pnl: 2340, trades: 20, winRate: 70 },
      { rank: 6, name: 'You', avatar: '🔥', pnl: 1850, trades: 12, winRate: 67 },
    ],
    icon: '💰',
    color: '#2dd4a0',
  },
  {
    id: 'tourn_2',
    name: 'Sharpshooter Challenge',
    type: 'winrate',
    status: 'active',
    description: 'Highest win rate with minimum 10 trades. Precision over volume.',
    startDate: new Date(now - 5 * DAY).toISOString(),
    endDate: new Date(now + 2 * DAY).toISOString(),
    entrants: 89,
    maxEntrants: 200,
    prizes: ['🥇 Sharpshooter Badge + 500 XP', '🥈 300 XP', '🥉 150 XP'],
    rules: ['Minimum 10 trades', 'Crypto pairs only', 'No martingale strategies'],
    leaderboard: [
      { rank: 1, name: 'ZenTrader', avatar: '🧘', pnl: 1200, trades: 12, winRate: 92 },
      { rank: 2, name: 'MacroGuru', avatar: '🧠', pnl: 890, trades: 15, winRate: 87 },
      { rank: 3, name: 'QuantFlow', avatar: '🤖', pnl: 1540, trades: 22, winRate: 82 },
    ],
    icon: '🎯',
    color: '#f0b64e',
  },
  {
    id: 'tourn_3',
    name: 'March Madness Futures Cup',
    type: 'pnl',
    status: 'upcoming',
    description: 'Month-long futures trading competition. ES, NQ, CL eligible.',
    startDate: new Date(now + 4 * DAY).toISOString(),
    endDate: new Date(now + 34 * DAY).toISOString(),
    entrants: 42,
    maxEntrants: 300,
    prizes: ['🏆 $1,000 + Master Trader Badge', '🥈 $500', '🥉 $250', '4th-10th: 200 XP each'],
    rules: ['Futures contracts only', 'Minimum 20 trades', 'Account size normalized'],
    leaderboard: [],
    icon: '🏆',
    color: '#e8642c',
  },
  {
    id: 'tourn_4',
    name: 'Last Week\'s Sprint',
    type: 'trades',
    status: 'completed',
    description: 'Most profitable trades in a 48-hour sprint.',
    startDate: new Date(now - 10 * DAY).toISOString(),
    endDate: new Date(now - 8 * DAY).toISOString(),
    entrants: 210,
    maxEntrants: 500,
    prizes: ['🥇 Sprint Champion Badge', '🥈 250 XP', '🥉 100 XP'],
    rules: ['All markets', 'No minimum trades'],
    leaderboard: [
      { rank: 1, name: 'CryptoKid', avatar: '🧒', pnl: 6200, trades: 45, winRate: 62 },
      { rank: 2, name: 'VolumeHunter', avatar: '📊', pnl: 5100, trades: 38, winRate: 58 },
      { rank: 3, name: 'IronHands', avatar: '💎', pnl: 4800, trades: 28, winRate: 71 },
    ],
    icon: '⚡',
    color: '#c084fc',
  },
];

export const createTournamentSlice = (set, get) => ({
  tournaments: MOCK_TOURNAMENTS,
  myEntries: [],

  enterTournament: (tournamentId) => {
    const { myEntries } = get();
    if (!myEntries.includes(tournamentId)) {
      set({ myEntries: [...myEntries, tournamentId] });
    }
  },

  leaveTournament: (tournamentId) => {
    set({ myEntries: get().myEntries.filter((id) => id !== tournamentId) });
  },

  isEntered: (tournamentId) => get().myEntries.includes(tournamentId),

  getByStatus: (status) => get().tournaments.filter((t) => t.status === status),

  getLeaderboard: (tournamentId) => {
    const t = get().tournaments.find((t) => t.id === tournamentId);
    return t?.leaderboard || [];
  },

  getTimeRemaining: (tournamentId) => {
    const t = get().tournaments.find((t) => t.id === tournamentId);
    if (!t) return null;
    const end = new Date(t.endDate).getTime();
    const remaining = end - Date.now();
    if (remaining <= 0) return 'Ended';
    const days = Math.floor(remaining / DAY);
    const hours = Math.floor((remaining % DAY) / 3600000);
    if (days > 0) return `${days}d ${hours}h`;
    const mins = Math.floor((remaining % 3600000) / 60000);
    return `${hours}h ${mins}m`;
  },
});
