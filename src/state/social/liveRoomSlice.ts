// ═══════════════════════════════════════════════════════════════════
// Live Room Slice — chat rooms and messaging
// Previously: useLiveRoomStore.js
// ═══════════════════════════════════════════════════════════════════

const AVATARS = ['🐺', '🦁', '🐻', '🦊', '🐸', '🦉', '🤖', '💎', '⚡', '🔥', '🧠', '🎯'];
const NAMES = ['TraderX', 'AlphaBot', 'SwingKing', 'FedWatcher', 'DeltaQ', 'NightOwl', 'IronHands', 'ZenTrader', 'CryptoKid', 'MacroGuru', 'VolumeHunter', 'OrderFlow'];

const randomUser = (i) => ({
  id: `user_${i}`,
  name: NAMES[i % NAMES.length],
  avatar: AVATARS[i % AVATARS.length],
  online: Math.random() > 0.3,
});

const MOCK_ROOMS = [
  {
    id: 'room_crypto', name: 'Crypto Trading', assetClass: 'crypto', icon: '₿',
    description: 'Bitcoin, Ethereum, Altcoins — charts, setups, and alpha',
    participants: Array.from({ length: 24 }, (_, i) => randomUser(i)),
    color: '#f7931a',
  },
  {
    id: 'room_futures', name: 'Futures & Indices', assetClass: 'futures', icon: '📈',
    description: 'ES, NQ, CL, GC — macro events and flow analysis',
    participants: Array.from({ length: 18 }, (_, i) => randomUser(i + 10)),
    color: '#22d3ee',
  },
  {
    id: 'room_forex', name: 'Forex Lounge', assetClass: 'forex', icon: '💱',
    description: 'Major and minor pairs, central bank analysis, NFP plays',
    participants: Array.from({ length: 12 }, (_, i) => randomUser(i + 20)),
    color: '#a3e635',
  },
  {
    id: 'room_stocks', name: 'Equities Arena', assetClass: 'stocks', icon: '🏛️',
    description: 'Large cap, small cap, earnings plays, sector rotation',
    participants: Array.from({ length: 15 }, (_, i) => randomUser(i + 30)),
    color: '#c084fc',
  },
  {
    id: 'room_general', name: 'General Chat', assetClass: 'general', icon: '💬',
    description: 'Off-topic, community hangout, memes, and vibes',
    participants: Array.from({ length: 31 }, (_, i) => randomUser(i + 40)),
    color: '#f472b6',
  },
];

const MOCK_MESSAGES = [
  { id: 'm1', userId: 'user_0', userName: 'TraderX', avatar: '🐺', text: 'BTC looking strong above 64k support, watching for a push to 66k', ts: Date.now() - 180000 },
  { id: 'm2', userId: 'user_1', userName: 'AlphaBot', avatar: '🦁', text: 'Agreed, order flow is heavily bullish on the 5m. CVD divergence resolved.', ts: Date.now() - 150000 },
  { id: 'm3', userId: 'user_2', userName: 'SwingKing', avatar: '🐻', text: 'Be careful, there\'s a massive sell wall at 65.2k on the DOM', ts: Date.now() - 120000 },
  { id: 'm4', userId: 'user_3', userName: 'FedWatcher', avatar: '🦊', text: 'FOMC minutes dropping in 2 hours, might get volatile 📊', ts: Date.now() - 90000 },
  { id: 'm5', userId: 'user_0', userName: 'TraderX', avatar: '🐺', text: 'Good call. I\'m scaling down position size for the event.', ts: Date.now() - 60000 },
  { id: 'm6', userId: 'user_4', userName: 'DeltaQ', avatar: '🐸', text: 'ETH/BTC ratio is at a key inflection point — reversal incoming?', ts: Date.now() - 30000 },
  { id: 'm7', userId: 'user_5', userName: 'NightOwl', avatar: '🦉', text: 'SOL breaking out of a 4h triangle, targeting $160 🎯', ts: Date.now() - 10000 },
];

export const createLiveRoomSlice = (set, get) => ({
  rooms: MOCK_ROOMS,
  activeRoom: null,
  messages: [],
  typingUsers: [],

  joinRoom: (roomId) => {
    set({
      activeRoom: roomId,
      messages: MOCK_MESSAGES,
      typingUsers: [],
    });
    setTimeout(() => {
      const { activeRoom } = get();
      if (activeRoom === roomId) {
        set({ typingUsers: [{ name: 'AlphaBot', avatar: '🦁' }] });
        setTimeout(() => set({ typingUsers: [] }), 3000);
      }
    }, 5000);
  },

  leaveRoom: () => {
    set({ activeRoom: null, messages: [], typingUsers: [] });
  },

  sendMessage: (text) => {
    const msg = {
      id: `msg_${Date.now()}`,
      userId: 'local_user',
      userName: 'You',
      avatar: '🔥',
      text,
      ts: Date.now(),
    };
    set((s) => ({ messages: [...s.messages, msg] }));

    const replies = [
      'Great point! 🔥',
      'I see the same setup on my charts',
      'Volume confirming that move 📊',
      'NFA but that looks like a solid entry',
      'What timeframe are you looking at?',
      'Interesting perspective, thanks for sharing',
    ];
    setTimeout(() => {
      const reply = {
        id: `msg_reply_${Date.now()}`,
        userId: 'user_' + Math.floor(Math.random() * 5),
        userName: NAMES[Math.floor(Math.random() * NAMES.length)],
        avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)],
        text: replies[Math.floor(Math.random() * replies.length)],
        ts: Date.now(),
      };
      set((s) => ({ messages: [...s.messages, reply] }));
    }, 2000 + Math.random() * 3000);
  },

  getRoomById: (id) => get().rooms.find((r) => r.id === id),

  getOnlineCount: (roomId) => {
    const room = get().rooms.find((r) => r.id === roomId);
    return room ? room.participants.filter((p) => p.online).length : 0;
  },
});
