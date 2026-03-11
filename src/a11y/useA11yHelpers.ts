// ═══════════════════════════════════════════════════════════════════
// charEdge — Accessibility Helpers (TypeScript)
//
// Sprint 24: React hooks for accessibility.
// Phase 2: Converted to TypeScript.
// ═══════════════════════════════════════════════════════════════════

import { useRef, useEffect, useCallback, useState } from 'react';
import type { HTMLAttributes, RefObject } from 'react';

// ─── Live Region ────────────────────────────────────────────────

interface LiveRegionResult {
    announce: (msg: string) => void;
    regionProps: HTMLAttributes<HTMLDivElement> & { ref: RefObject<HTMLDivElement | null>; children: string };
}

export function useLiveRegion(priority: 'polite' | 'assertive' = 'polite'): LiveRegionResult {
    const ref = useRef<HTMLDivElement>(null);
    const [message, setMessage] = useState('');

    const announce = useCallback((msg: string) => {
        setMessage('');
        requestAnimationFrame(() => setMessage(msg));
    }, []);

    const regionProps = {
        ref,
        role: 'status' as const,
        'aria-live': priority,
        'aria-atomic': true,
        className: 'tf-sr-only',
        children: message,
    };

    return { announce, regionProps };
}

// ─── Roving Tab Index ───────────────────────────────────────────

interface RovingOptions {
    columns?: number;
    orientation?: 'horizontal' | 'vertical' | 'both';
    loop?: boolean;
}

interface RovingResult {
    // eslint-disable-next-line no-undef
    containerProps: { role: string; onKeyDown: (e: React.KeyboardEvent) => void };
    getItemProps: (index: number) => {
        ref: (el: HTMLElement | null) => void;
        tabIndex: number;
        role: string;
        onFocus: () => void;
    };
    activeIndex: number;
    setActiveIndex: (index: number) => void;
}

export function useRovingTabIndex(itemCount: number, options: RovingOptions = {}): RovingResult {
    const { columns = 1, orientation = 'both', loop = true } = options;
    const [activeIndex, setActiveIndex] = useState(0);
    const itemsRef = useRef<(HTMLElement | null)[]>([]);

    useEffect(() => {
        const el = itemsRef.current[activeIndex];
        if (el) el.focus();
    }, [activeIndex]);

    const handleKeyDown = useCallback(
        // eslint-disable-next-line no-undef
        (e: React.KeyboardEvent) => {
            let next = activeIndex;
            const isVertical = orientation === 'vertical' || orientation === 'both';
            const isHorizontal = orientation === 'horizontal' || orientation === 'both';

            switch (e.key) {
                case 'ArrowRight':
                    if (!isHorizontal) return;
                    next = activeIndex + 1;
                    break;
                case 'ArrowLeft':
                    if (!isHorizontal) return;
                    next = activeIndex - 1;
                    break;
                case 'ArrowDown':
                    if (!isVertical) return;
                    next = activeIndex + columns;
                    break;
                case 'ArrowUp':
                    if (!isVertical) return;
                    next = activeIndex - columns;
                    break;
                case 'Home':
                    next = 0;
                    break;
                case 'End':
                    next = itemCount - 1;
                    break;
                default:
                    return;
            }

            e.preventDefault();

            if (loop) {
                next = ((next % itemCount) + itemCount) % itemCount;
            } else {
                next = Math.max(0, Math.min(next, itemCount - 1));
            }

            setActiveIndex(next);
        },
        [activeIndex, itemCount, columns, orientation, loop]
    );

    const containerProps = {
        role: 'grid',
        onKeyDown: handleKeyDown,
    };

    const getItemProps = (index: number) => ({
        ref: (el: HTMLElement | null) => { itemsRef.current[index] = el; },
        tabIndex: index === activeIndex ? 0 : -1,
        role: 'gridcell',
        onFocus: () => setActiveIndex(index),
    });

    return { containerProps, getItemProps, activeIndex, setActiveIndex };
}

// ─── Color-Blind Safe Toggle ────────────────────────────────────

interface ColorBlindResult {
    colorBlindSafe: boolean;
    toggleColorBlindSafe: () => void;
}

export function useColorBlindSafe(): ColorBlindResult {
    const [enabled, setEnabled] = useState(() => {
        try {
            return localStorage.getItem('tf-colorblind-safe') === 'true';
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (_) {
            return false;
        }
    });

    useEffect(() => {
        if (enabled) {
            document.body.classList.add('tf-colorblind-safe');
        } else {
            document.body.classList.remove('tf-colorblind-safe');
        }
        try {
            localStorage.setItem('tf-colorblind-safe', String(enabled));
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (_) {
            // storage unavailable
        }
    }, [enabled]);

    return { colorBlindSafe: enabled, toggleColorBlindSafe: () => setEnabled((v) => !v) };
}

// ─── Number / Date / Currency Formatters ────────────────────────

const locale: string =
    typeof navigator !== 'undefined' ? navigator.language || 'en-US' : 'en-US';

interface FormatNumberOptions {
    decimals?: number;
    compact?: boolean;
}

export function formatNumber(value: number, opts: FormatNumberOptions = {}): string {
    const { decimals = 2, compact = false } = opts;
    try {
        return new Intl.NumberFormat(locale, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
            notation: compact ? 'compact' : 'standard',
        }).format(value);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_) {
        return String(value);
    }
}

export function formatCurrency(value: number, currency: string = 'USD'): string {
    try {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency,
            minimumFractionDigits: 2,
        }).format(value);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_) {
        return `$${value}`;
    }
}

interface FormatDateOptions {
    style?: 'short' | 'medium' | 'long';
}

export function formatDate(date: string | number | Date, opts: FormatDateOptions = {}): string {
    const { style = 'medium' } = opts;
    const options: Intl.DateTimeFormatOptions =
        style === 'short'
            ? { month: 'short', day: 'numeric' }
            : style === 'long'
                ? { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
                : { year: 'numeric', month: 'short', day: 'numeric' };
    try {
        return new Intl.DateTimeFormat(locale, options).format(new Date(date));
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_) {
        return String(date);
    }
}

export function formatRelativeTime(date: string | number | Date): string {
    const diff = Date.now() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    try {
        const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
        if (minutes < 1) return rtf.format(0, 'minute');
        if (minutes < 60) return rtf.format(-minutes, 'minute');
        if (hours < 24) return rtf.format(-hours, 'hour');
        return rtf.format(-days, 'day');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_) {
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        return `${days}d ago`;
    }
}
