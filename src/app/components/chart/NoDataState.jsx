// ═══════════════════════════════════════════════════════════════════
// charEdge — No Data State Component (Phase 0.4)
// Displayed when no chart data is available — replaces fake OHLCV.
// ═══════════════════════════════════════════════════════════════════

import s from './NoDataState.module.css';

export default function NoDataState({ symbol, message }) {
  return (
    <div className={s.root}>
      <div className={s.iconBox}>📊</div>
      <div className={s.textBlock}>
        <span className={s.title}>NO DATA</span>
        {symbol && <span className={s.symbol}>{symbol}</span>}
      </div>
      <span className={s.desc}>
        {message || 'Could not load data for this symbol. Check your network connection or try a different symbol.'}
      </span>
      <div className={s.badge}>
        <span className={s.pulseDot} />
        NO DATA
      </div>
    </div>
  );
}

export { NoDataState };
