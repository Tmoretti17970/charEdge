// ═══════════════════════════════════════════════════════════════════
// charEdge — Account Switcher
//
// Segmented pill toggle for switching between Real and Demo accounts.
// - Collapsed sidebar: small icon-only pill
// - Expanded sidebar: full segmented control with labels + slider
// - Glass morphism styling consistent with existing design language
// ═══════════════════════════════════════════════════════════════════

import React, { useRef, useLayoutEffect, useState, useCallback } from 'react';
import { C, F } from '../../../constants.js';
import { haptics } from '../../misc/haptics.ts';
import s from './AccountSwitcher.module.css';
import { alpha } from '@/shared/colorUtils';
import { useAccountStore, ACCOUNTS } from '@/state/useAccountStore';

function AccountSwitcher({ expanded = false }) {
  const activeAccountId = useAccountStore((state) => state.activeAccountId);
  const switchAccount = useAccountStore((state) => state.switchAccount);
  const activeAccount = ACCOUNTS.find((a) => a.id === activeAccountId) || ACCOUNTS[0];

  // Phase 3: Confirm before switching accounts to prevent accidental trades against wrong account
  const handleSwitch = useCallback((newId) => {
    if (newId === activeAccountId) return;
    const targetLabel = ACCOUNTS.find((a) => a.id === newId)?.label || newId;
    if (window.confirm(`Switch to ${targetLabel} account?`)) {
      switchAccount(newId);
      haptics.trigger('medium');
    }
  }, [activeAccountId, switchAccount]);

  // Slider measurement for expanded mode
  const containerRef = useRef(null);
  const optionRefs = useRef({});
  const [sliderStyle, setSliderStyle] = useState({ left: 0, width: 0, ready: false });

  const updateSlider = useCallback(() => {
    const container = containerRef.current;
    const activeEl = optionRefs.current[activeAccountId];
    if (!container || !activeEl) return;
    const cRect = container.getBoundingClientRect();
    const aRect = activeEl.getBoundingClientRect();
    setSliderStyle({
      left: aRect.left - cRect.left,
      width: aRect.width,
      ready: true,
    });
  }, [activeAccountId]);

  useLayoutEffect(() => {
    if (expanded) updateSlider();
  }, [expanded, updateSlider]);

  // Collapsed mode: simple icon toggle
  if (!expanded) {
    return (
      <div
        className={`${s.switcher} ${s.switcherCollapsed}`}
        title={`${activeAccount.label} Account — click to switch`}
      >
        <button
          className={s.iconBtn}
          onClick={() => handleSwitch(activeAccountId === 'real' ? 'demo' : 'real')}
          aria-label={`Switch to ${activeAccountId === 'real' ? 'Demo' : 'Real'} account`}
          style={{
            background: alpha(activeAccount.color, 0.1),
          }}
        >
          {activeAccount.icon}
        </button>
      </div>
    );
  }

  // Expanded mode: full segmented control
  return (
    <div style={{ flexShrink: 0 }}>
      {/* Section label */}
      <div className={s.label} style={{ color: C.t3, fontFamily: F }}>
        Account
      </div>

      <div ref={containerRef} className={`${s.switcher} ${s.switcherExpanded}`}>
        {/* Animated slider */}
        {sliderStyle.ready && (
          <div
            className={s.slider}
            style={{
              left: sliderStyle.left,
              width: sliderStyle.width,
              background: alpha(activeAccount.color, 0.15),
              boxShadow: `0 0 8px ${alpha(activeAccount.color, 0.1)}, inset 0 1px 0 ${alpha(activeAccount.color, 0.08)}`,
            }}
          />
        )}

        {ACCOUNTS.map((account) => (
          <button
            key={account.id}
            ref={(el) => {
              optionRefs.current[account.id] = el;
            }}
            className={`${s.option} ${activeAccountId === account.id ? s.optionActive : ''}`}
            onClick={() => handleSwitch(account.id)}
            aria-label={`Switch to ${account.label} account`}
            aria-pressed={activeAccountId === account.id}
            style={{
              fontFamily: F,
              color: activeAccountId === account.id ? account.color : undefined,
            }}
          >
            <span className={s.dot} style={{ background: account.color }} />
            {account.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default React.memo(AccountSwitcher);
