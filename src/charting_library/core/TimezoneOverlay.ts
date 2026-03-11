// ═══════════════════════════════════════════════════════════════════
// charEdge — Timezone Overlay
//
// Interactive DOM overlay in the chart's bottom-right corner.
// Shows current timezone as a pill; click reveals a dropdown picker.
// Follows the same DOM overlay pattern as CountdownOverlay.
// ═══════════════════════════════════════════════════════════════════

import { temporalEngine } from './TemporalEngine.js';

/** Popular timezones for the picker dropdown. */
const TIMEZONE_OPTIONS = [
  { iana: 'UTC',                 label: 'UTC',            abbr: 'UTC'  },
  { iana: 'America/New_York',    label: 'New York',       abbr: 'ET'   },
  { iana: 'America/Chicago',     label: 'Chicago',        abbr: 'CT'   },
  { iana: 'America/Los_Angeles', label: 'Los Angeles',    abbr: 'PT'   },
  { iana: 'Europe/London',       label: 'London',         abbr: 'GMT'  },
  { iana: 'Europe/Berlin',       label: 'Berlin',         abbr: 'CET'  },
  { iana: 'Asia/Tokyo',          label: 'Tokyo',          abbr: 'JST'  },
  { iana: 'Asia/Shanghai',       label: 'Shanghai',       abbr: 'CST'  },
  { iana: 'Asia/Kolkata',        label: 'Mumbai',         abbr: 'IST'  },
  { iana: 'Australia/Sydney',    label: 'Sydney',         abbr: 'AEST' },
  { iana: 'Pacific/Auckland',    label: 'Auckland',       abbr: 'NZST' },
];

export class TimezoneOverlay {
  private _btn: HTMLButtonElement;
  private _dropdown: HTMLDivElement;
  private _container: HTMLElement;
  private _open: boolean = false;
  private _current: string = 'UTC';
  private _boundClose: (e: MouseEvent) => void;

  constructor(container: HTMLElement) {
    this._container = container;

    // ─── Pill Button ──────────────────────────────────────────────
    this._btn = document.createElement('button');
    this._btn.setAttribute('data-test', 'timezone-selector');
    this._btn.setAttribute('id', 'timezone-selector-btn');
    this._btn.textContent = 'UTC';
    Object.assign(this._btn.style, {
      position: 'absolute',
      bottom: '36px',
      right: '56px',
      zIndex: '15',
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      padding: '3px 8px',
      font: '11px Inter, -apple-system, sans-serif',
      fontWeight: '600',
      color: 'rgba(255,255,255,0.85)',
      background: 'rgba(42,46,57,0.85)',
      border: '1px solid rgba(54,58,69,0.6)',
      borderRadius: '4px',
      cursor: 'pointer',
      backdropFilter: 'blur(8px)',
      transition: 'background 0.15s, border-color 0.15s',
      lineHeight: '1',
      letterSpacing: '0.5px',
    });
    this._btn.addEventListener('mouseenter', () => {
      this._btn.style.background = 'rgba(55,60,75,0.95)';
      this._btn.style.borderColor = 'rgba(80,85,100,0.8)';
    });
    this._btn.addEventListener('mouseleave', () => {
      if (!this._open) {
        this._btn.style.background = 'rgba(42,46,57,0.85)';
        this._btn.style.borderColor = 'rgba(54,58,69,0.6)';
      }
    });
    this._btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._toggle();
    });

    // ─── Dropdown ─────────────────────────────────────────────────
    this._dropdown = document.createElement('div');
    this._dropdown.setAttribute('data-test', 'timezone-dropdown');
    Object.assign(this._dropdown.style, {
      position: 'absolute',
      bottom: '58px',
      right: '56px',
      zIndex: '20',
      display: 'none',
      flexDirection: 'column',
      minWidth: '160px',
      maxHeight: '280px',
      overflowY: 'auto',
      background: 'rgba(30,34,45,0.96)',
      border: '1px solid rgba(54,58,69,0.7)',
      borderRadius: '6px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
      backdropFilter: 'blur(12px)',
      padding: '4px 0',
    });

    // Build timezone option rows
    for (const tz of TIMEZONE_OPTIONS) {
      const row = document.createElement('div');
      row.setAttribute('data-tz', tz.iana);
      Object.assign(row.style, {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 12px',
        font: '11px Inter, -apple-system, sans-serif',
        color: 'rgba(255,255,255,0.8)',
        cursor: 'pointer',
        transition: 'background 0.1s',
        borderRadius: '2px',
        margin: '0 4px',
      });
      row.innerHTML = `<span>${tz.label}</span><span style="color:rgba(255,255,255,0.4);font-size:10px;margin-left:12px">${tz.abbr}</span>`;

      row.addEventListener('mouseenter', () => {
        row.style.background = 'rgba(41,98,255,0.2)';
      });
      row.addEventListener('mouseleave', () => {
        row.style.background = 'transparent';
      });
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        this._select(tz.iana, tz.abbr);
      });

      this._dropdown.appendChild(row);
    }

    // "Local" option (auto-detect)
    const localRow = document.createElement('div');
    localRow.setAttribute('data-tz', 'local');
    const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    Object.assign(localRow.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '6px 12px',
      font: '11px Inter, -apple-system, sans-serif',
      color: 'rgba(255,255,255,0.8)',
      cursor: 'pointer',
      transition: 'background 0.1s',
      borderRadius: '2px',
      margin: '0 4px',
      borderTop: '1px solid rgba(54,58,69,0.5)',
    });
    localRow.innerHTML = `<span>Local</span><span style="color:rgba(255,255,255,0.4);font-size:10px;margin-left:12px">${localTz.split('/').pop()}</span>`;
    localRow.addEventListener('mouseenter', () => { localRow.style.background = 'rgba(41,98,255,0.2)'; });
    localRow.addEventListener('mouseleave', () => { localRow.style.background = 'transparent'; });
    localRow.addEventListener('click', (e) => {
      e.stopPropagation();
      const shortName = localTz.split('/').pop() || 'Local';
      this._select(localTz, shortName);
    });
    this._dropdown.appendChild(localRow);

    // Mount
    container.appendChild(this._btn);
    container.appendChild(this._dropdown);

    // Close on outside click
    this._boundClose = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!this._dropdown.contains(target) && !this._btn.contains(target)) {
        this._close();
      }
    };
    document.addEventListener('click', this._boundClose, true);
  }

  /** Update the displayed timezone text. */
  setTimezone(iana: string): void {
    this._current = iana;
    const opt = TIMEZONE_OPTIONS.find(o => o.iana === iana);
    const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (opt) {
      this._btn.textContent = opt.abbr;
    } else if (iana === localTz) {
      this._btn.textContent = localTz.split('/').pop() || 'Local';
    } else {
      // Show last segment of IANA string
      this._btn.textContent = iana.split('/').pop() || iana;
    }
    // Update active indicator in dropdown
    this._highlightActive();
  }

  /** Toggle dropdown open/closed. */
  private _toggle(): void {
    if (this._open) {
      this._close();
    } else {
      this._open = true;
      this._dropdown.style.display = 'flex';
      this._btn.style.background = 'rgba(55,60,75,0.95)';
      this._btn.style.borderColor = '#2962FF';
      this._highlightActive();
    }
  }

  /** Close dropdown. */
  private _close(): void {
    this._open = false;
    this._dropdown.style.display = 'none';
    this._btn.style.background = 'rgba(42,46,57,0.85)';
    this._btn.style.borderColor = 'rgba(54,58,69,0.6)';
  }

  /** Select a timezone and fire event. */
  private _select(iana: string, _abbr: string): void {
    this._current = iana;
    this.setTimezone(iana);
    this._close();

    // Update the TemporalEngine singleton
    temporalEngine.setTimezone(iana);

    // Fire event for ChartEngineWidget to update the store
    window.dispatchEvent(new CustomEvent('charEdge:set-timezone', { detail: { timezone: iana } }));
  }

  /** Highlight the currently active timezone row. */
  private _highlightActive(): void {
    const rows = this._dropdown.querySelectorAll('[data-tz]');
    const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    rows.forEach(row => {
      const tz = row.getAttribute('data-tz');
      const isActive = tz === this._current || (tz === 'local' && this._current === localTz);
      (row as HTMLElement).style.color = isActive ? '#2962FF' : 'rgba(255,255,255,0.8)';
      (row as HTMLElement).style.fontWeight = isActive ? '700' : '400';
    });
  }

  /** Remove from DOM and clean up listeners. */
  dispose(): void {
    document.removeEventListener('click', this._boundClose, true);
    this._btn.remove();
    this._dropdown.remove();
  }
}
