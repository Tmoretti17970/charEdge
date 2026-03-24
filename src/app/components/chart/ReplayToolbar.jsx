import { useState, useEffect } from 'react';
import { C, F, M } from '../../../constants.js';
import { transition } from '../../../theme/tokens.js';
import s from './ReplayToolbar.module.css';

const SPEEDS = [
    { label: '1x', value: 1 },
    { label: '2x', value: 2 },
    { label: '5x', value: 5 },
    { label: '10x', value: 10 },
];

export default function ReplayToolbar({
    replayState = 'idle',
    currentIndex = 0,
    totalBars = 0,
    speed = 1,
    onPlay,
    onPause,
    onStop,
    onStep,
    onSpeedChange,
    onSeek,
    paperTrade = null,
}) {
    const [qty, setQty] = useState(1);
    const [stats, setStats] = useState(null);
    const [_tick, setTick] = useState(0);

    // Refresh stats periodically when paper trading is active
    useEffect(() => {
        if (!paperTrade) return;
        const iv = setInterval(() => {
            setStats(paperTrade.getStats());
            setTick((t) => t + 1);
        }, 500);
        return () => clearInterval(iv);
    }, [paperTrade]);

    if (replayState === 'idle' || replayState === 'stopped') return null;

    const progress = totalBars > 0 ? (currentIndex / (totalBars - 1)) * 100 : 0;
    const isPlaying = replayState === 'playing';
    const isLoading = replayState === 'loading';

    const hasOpenTrades = stats?.trades?.some((t) => t.status === 'open');
    const totalPnl = stats?.totalPnl ?? 0;

    return (
        <div className={s.toolbar}>
            {/* Replay badge */}
            <div className={s.replayBadge}>
                <span className={s.replayDot} data-playing={isPlaying ? 'true' : undefined} />
                REPLAY
            </div>

            {/* Play/Pause */}
            <ToolbarButton
                onClick={isPlaying ? onPause : onPlay}
                disabled={isLoading}
                title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                active={isPlaying}
            >
                {isLoading ? '⏳' : isPlaying ? '⏸' : '▶️'}
            </ToolbarButton>

            {/* Step Forward */}
            <ToolbarButton
                onClick={onStep}
                disabled={isLoading || isPlaying}
                title="Step Forward (→)"
            >
                ⏭
            </ToolbarButton>

            {/* Stop */}
            <ToolbarButton
                onClick={onStop}
                disabled={isLoading}
                title="Stop Replay (Esc)"
            >
                ⏹
            </ToolbarButton>

            {/* Divider */}
            <div className={s.divider} />

            {/* Speed selector */}
            <div className={s.speedRow}>
                {SPEEDS.map((sp) => (
                    <button
                        key={sp.value}
                        onClick={() => onSpeedChange?.(sp.value)}
                        className={s.speedBtn}
                        data-active={speed === sp.value ? 'true' : undefined}
                    >
                        {sp.label}
                    </button>
                ))}
            </div>

            {/* Divider */}
            <div className={s.divider} />

            {/* Progress bar */}
            <div className={s.progressWrap}
                onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                    const targetIndex = Math.round(pct * (totalBars - 1));
                    onSeek?.(targetIndex);
                }}
            >
                <div className={s.progressBg} />
                <div className={s.progressFill} style={{
                    width: `${progress}%`,
                    background: `linear-gradient(90deg, ${C.b}, #f0b64e)`,
                    transition: isPlaying ? 'width 0.15s linear' : 'width 0.05s linear',
                }} />
            </div>

            {/* Bar count */}
            <span className={s.barCount}>
                {currentIndex + 1} / {totalBars}
            </span>

            {/* ─── Paper Trading Controls ─────────────────────── */}
            {paperTrade && (
                <>
                    <div className={s.divider} />

                    <input
                        type="number" min={0.01} step={0.01}
                        value={qty}
                        onChange={(e) => setQty(Math.max(0.01, Number(e.target.value) || 0.01))}
                        title="Trade quantity"
                        className={s.qtyInput}
                    />

                    <button
                        onClick={() => { paperTrade.placeTrade('long', qty); setStats(paperTrade.getStats()); }}
                        title="Buy Long"
                        className={s.longBtn}
                    >
                        📈 Long
                    </button>

                    <button
                        onClick={() => { paperTrade.placeTrade('short', qty); setStats(paperTrade.getStats()); }}
                        title="Sell Short"
                        className={s.shortBtn}
                    >
                        📉 Short
                    </button>

                    {hasOpenTrades && (
                        <button
                            onClick={() => { paperTrade.closeAll(); setStats(paperTrade.getStats()); }}
                            title="Close all open positions"
                            className={s.closeAllBtn}
                        >
                            ✕ Close All
                        </button>
                    )}

                    {stats && stats.trades.length > 0 && (
                        <div className={s.statsBox}>
                            <span className={s.statPnl} data-positive={totalPnl >= 0 ? 'true' : 'false'}>
                                {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)}
                            </span>
                            <span className={s.statDim}>
                                {stats.winCount}W / {stats.lossCount}L
                            </span>
                            {stats.winRate > 0 && (
                                <span className={s.statWr} data-good={stats.winRate >= 0.5 ? 'true' : 'false'}>
                                    {Math.round(stats.winRate * 100)}%
                                </span>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

// ─── Toolbar Button ─────────────────────────────────────────────

function ToolbarButton({ children, onClick, disabled, title, active }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            title={title}
            className={s.toolbarBtn}
            data-active={active || undefined}
        >
            {children}
        </button>
    );
}
