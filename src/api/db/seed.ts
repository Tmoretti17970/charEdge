// ═══════════════════════════════════════════════════════════════════
// charEdge — Database Seed Script
//
// Inserts sample data for development. Idempotent — checks for
// existing data before inserting.
//
// Usage:
//   npx tsx src/api/db/seed.ts
//   OR add "db:seed": "npx tsx src/api/db/seed.ts" to package.json
// ═══════════════════════════════════════════════════════════════════

import { getDb, closeDb } from './sqlite.ts';
import { TradeRepository } from './TradeRepository.ts';
import { CrudRepository } from './CrudRepository.ts';
import { SettingsRepository } from './SettingsRepository.ts';

const DEV_USER_ID = 'dev-user';

function seed(): void {
    const db = getDb();
    const tradeRepo = new TradeRepository(db);
    const playbookRepo = new CrudRepository(db, 'playbooks');
    const noteRepo = new CrudRepository(db, 'notes');
    const planRepo = new CrudRepository(db, 'plans');
    const settingsRepo = new SettingsRepository(db);

    // ── Check if already seeded ─────────────────────────────
    const existingTrades = tradeRepo.list(DEV_USER_ID, {}, { limit: 1 });
    if (existingTrades.total > 0) {
        console.info('[Seed] Database already has data — skipping seed.');
        closeDb();
        return;
    }

    console.info('[Seed] Seeding database with sample data...');

    // ── Sample Trades ───────────────────────────────────────
    const sampleTrades = [
        { symbol: 'BTCUSDT', side: 'long' as const, entryPrice: 42150.00, exitPrice: 43200.00, entryDate: '2024-01-15T09:30:00Z', exitDate: '2024-01-15T14:00:00Z', size: 0.5, pnl: 525.00, notes: 'Breakout above 42k resistance', tags: ['breakout', 'momentum'], setup: 'Range Breakout' },
        { symbol: 'ETHUSDT', side: 'long' as const, entryPrice: 2280.00, exitPrice: 2350.00, entryDate: '2024-01-16T10:00:00Z', exitDate: '2024-01-16T16:30:00Z', size: 2.0, pnl: 140.00, notes: 'ETH following BTC momentum', tags: ['correlation', 'trend'], setup: 'Trend Follow' },
        { symbol: 'BTCUSDT', side: 'short' as const, entryPrice: 43500.00, exitPrice: 43800.00, entryDate: '2024-01-17T11:00:00Z', exitDate: '2024-01-17T13:00:00Z', size: 0.3, pnl: -90.00, notes: 'False breakdown, stopped out', tags: ['reversal'], setup: 'Support Break' },
        { symbol: 'SOLUSDT', side: 'long' as const, entryPrice: 95.50, exitPrice: 102.30, entryDate: '2024-01-18T08:00:00Z', exitDate: '2024-01-19T10:00:00Z', size: 10, pnl: 68.00, notes: 'SOL ecosystem rally', tags: ['altcoin', 'momentum'], setup: 'Trend Follow' },
        { symbol: 'BTCUSDT', side: 'long' as const, entryPrice: 43000.00, exitPrice: 44500.00, entryDate: '2024-01-20T09:00:00Z', exitDate: '2024-01-22T15:00:00Z', size: 0.25, pnl: 375.00, notes: 'Swing trade, held through dip', tags: ['swing', 'patience'], setup: 'Support Bounce' },
        { symbol: 'ETHUSDT', side: 'short' as const, entryPrice: 2400.00, exitPrice: 2350.00, entryDate: '2024-01-23T14:00:00Z', exitDate: '2024-01-23T18:00:00Z', size: 3.0, pnl: 150.00, notes: 'Overbought RSI divergence', tags: ['divergence', 'mean-reversion'], setup: 'RSI Divergence' },
        { symbol: 'BTCUSDT', side: 'long' as const, entryPrice: 44000.00, exitPrice: 43500.00, entryDate: '2024-01-24T10:00:00Z', exitDate: '2024-01-24T12:00:00Z', size: 0.4, pnl: -200.00, notes: 'FOMO entry, bad timing', tags: ['fomo', 'lesson'], setup: 'Breakout' },
        { symbol: 'AVAXUSDT', side: 'long' as const, entryPrice: 35.00, exitPrice: 38.50, entryDate: '2024-01-25T09:30:00Z', exitDate: '2024-01-26T11:00:00Z', size: 20, pnl: 70.00, notes: 'Range breakout with volume', tags: ['breakout', 'volume'], setup: 'Volume Breakout' },
        { symbol: 'BTCUSDT', side: 'long' as const, entryPrice: 43800.00, exitPrice: null, entryDate: '2024-01-27T08:00:00Z', exitDate: null, size: 0.5, pnl: null, notes: 'Open position — watching 44k', tags: ['open'], setup: 'Trend Follow' },
        { symbol: 'ETHUSDT', side: 'long' as const, entryPrice: 2320.00, exitPrice: 2380.00, entryDate: '2024-01-28T12:00:00Z', exitDate: '2024-01-28T17:00:00Z', size: 5.0, pnl: 300.00, notes: 'Clean bounce off 2300 support', tags: ['support', 'scalp'], setup: 'Support Bounce' },
    ];

    for (const trade of sampleTrades) {
        tradeRepo.create(DEV_USER_ID, trade);
    }
    console.info(`[Seed] Created ${sampleTrades.length} sample trades`);

    // ── Sample Playbooks ────────────────────────────────────
    const samplePlaybooks = [
        { id: 'pb-breakout', name: 'Range Breakout', description: 'Enter on confirmed breakout above range high with volume surge', rules: [{ label: 'Wait for 4H candle close above range' }, { label: 'Volume > 1.5x 20-period avg' }, { label: 'Risk max 1% of account' }] },
        { id: 'pb-trend', name: 'Trend Following', description: 'Ride established trends using EMA crossovers', rules: [{ label: '21 EMA above 55 EMA' }, { label: 'Enter on pullback to 21 EMA' }, { label: 'Stop below 55 EMA' }] },
        { id: 'pb-reversal', name: 'RSI Divergence', description: 'Mean reversion on RSI divergence at key levels', rules: [{ label: 'RSI divergence on 1H or 4H' }, { label: 'Price at major S/R level' }, { label: 'Confirm with volume drop' }] },
    ];

    for (const pb of samplePlaybooks) {
        playbookRepo.create(DEV_USER_ID, pb as Record<string, unknown> & { id: string });
    }
    console.info(`[Seed] Created ${samplePlaybooks.length} sample playbooks`);

    // ── Sample Notes ────────────────────────────────────────
    const sampleNotes = [
        { id: 'note-1', title: 'Weekly Review — Jan W3', content: 'Good week overall. 4 wins, 1 loss. Need to be more patient on entries. FOMO trade on BTC cost me. Key lesson: wait for confirmation candle.' },
        { id: 'note-2', title: 'Market Structure Update', content: 'BTC holding above 42k support zone. ETH/BTC ratio improving. Watch for SOL ecosystem tokens.' },
        { id: 'note-3', title: 'Psychology Check', content: 'Feeling confident but not overconfident. Sticking to plan sizes. Sleep has been good this week.' },
        { id: 'note-4', title: 'Risk Management Rules', content: 'Max 2% risk per trade. Max 3 concurrent positions. Scale out 50% at 1R, trail stop on remainder.' },
        { id: 'note-5', title: 'Correlation Notes', content: 'BTC and ETH showing 0.85 correlation this month. AVAX decoupling on DeFi narrative. Use BTC as directional bias for alts.' },
    ];

    for (const note of sampleNotes) {
        noteRepo.create(DEV_USER_ID, note as Record<string, unknown> & { id: string });
    }
    console.info(`[Seed] Created ${sampleNotes.length} sample notes`);

    // ── Sample Plans ────────────────────────────────────────
    const samplePlans = [
        { id: 'plan-btc-44k', symbol: 'BTCUSDT', direction: 'long', thesis: 'Break above 44k with volume confirms bullish continuation', entry: { price: 44100, condition: '4H close above 44k' }, exit: { target: 46000, stopLoss: 43200 }, riskReward: 2.4, status: 'active' },
        { id: 'plan-eth-short', symbol: 'ETHUSDT', direction: 'short', thesis: 'If BTC rejects 45k, ETH likely drops to 2200', entry: { price: 2380, condition: 'BTC rejection + ETH RSI overbought' }, exit: { target: 2200, stopLoss: 2450 }, riskReward: 2.57, status: 'draft' },
    ];

    for (const plan of samplePlans) {
        planRepo.create(DEV_USER_ID, plan as Record<string, unknown> & { id: string });
    }
    console.info(`[Seed] Created ${samplePlans.length} sample plans`);

    // ── Default Settings ────────────────────────────────────
    settingsRepo.bulkSet(DEV_USER_ID, {
        theme: 'dark',
        defaultSymbol: 'BTCUSDT',
        defaultTimeframe: '1h',
        riskPerTrade: 0.02,
        maxConcurrentPositions: 3,
        notificationsEnabled: true,
        chartLayout: { showVolume: true, showGrid: true, candleWidth: 'auto' },
    });
    console.info('[Seed] Set default settings');

    console.info('[Seed] ✓ Database seeded successfully');
    closeDb();
}

// Run if executed directly
seed();
