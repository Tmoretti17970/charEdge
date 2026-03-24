// ═══════════════════════════════════════════════════════════════════
// charEdge — TimeframeSwitcher
// TradingView-style timeframe button bar.
// ═══════════════════════════════════════════════════════════════════

import { useState, useCallback } from 'react';
import s from './TimeframeSwitcher.module.css';

const TIMEFRAME_GROUPS = [
  { label: 'Minutes', items: [{ value: '1m', display: '1m' }, { value: '3m', display: '3m' }, { value: '5m', display: '5m' }, { value: '15m', display: '15m' }, { value: '30m', display: '30m' }] },
  { label: 'Hours', items: [{ value: '1h', display: '1H' }, { value: '2h', display: '2H' }, { value: '4h', display: '4H' }, { value: '6h', display: '6H' }, { value: '12h', display: '12H' }] },
  { label: 'Days+', items: [{ value: '1D', display: '1D' }, { value: '3D', display: '3D' }, { value: '1W', display: '1W' }, { value: '1M', display: '1M' }] },
];

const QUICK_TIMEFRAMES = [
  { value: '1m', display: '1m' }, { value: '5m', display: '5m' }, { value: '15m', display: '15m' },
  { value: '1h', display: '1H' }, { value: '4h', display: '4H' }, { value: '1D', display: '1D' }, { value: '1W', display: '1W' },
];

export default function TimeframeSwitcher({ current, onChange, compact = true }) {
  const [showAll, setShowAll] = useState(false);

  const handleSelect = useCallback((tf) => { onChange(tf); setShowAll(false); }, [onChange]);

  if (compact) {
    return (
      <div className={s.compactBar}>
        {QUICK_TIMEFRAMES.map((tf) => (
          <button key={tf.value} onClick={() => handleSelect(tf.value)} className={s.tfBtn} data-active={current === tf.value || undefined}>
            {tf.display}
          </button>
        ))}
        <div className={s.moreWrap}>
          <button onClick={() => setShowAll(!showAll)} className={s.moreBtn} title="More timeframes">···</button>
          {showAll && (
            <div className={s.dropdown}>
              {TIMEFRAME_GROUPS.map((group) => (
                <div key={group.label}>
                  <div className={s.groupLabel}>{group.label}</div>
                  <div className={s.groupRow}>
                    {group.items.map((tf) => (
                      <button key={tf.value} onClick={() => handleSelect(tf.value)} className={s.tfBtn} data-active={current === tf.value || undefined}>
                        {tf.display}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={s.fullBar}>
      {TIMEFRAME_GROUPS.flatMap((g) => g.items).map((tf) => (
        <button key={tf.value} onClick={() => handleSelect(tf.value)} className={s.tfBtn} data-active={current === tf.value || undefined}>
          {tf.display}
        </button>
      ))}
    </div>
  );
}
