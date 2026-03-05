// ═══════════════════════════════════════════════════════════════════
// charEdge — EmptyState Component
// Reusable empty state for features with no data yet.
// Shows icon, title, description, and optional CTA button.
// ═══════════════════════════════════════════════════════════════════
import React from 'react';
import styles from './EmptyState.module.css';

/**
 * A reusable empty state component for screens with no data.
 *
 * @param {{
 *   icon?: string;
 *   title: string;
 *   description?: string;
 *   actionLabel?: string;
 *   onAction?: () => void;
 *   children?: React.ReactNode;
 * }} props
 */
export default function EmptyState({
    icon = '📭',
    title,
    description,
    actionLabel,
    onAction,
    children,
}) {
    return (
        <div className={styles.emptyRoot}>
            <div className={styles.iconWrap}>
                <span className={styles.icon} role="img" aria-hidden="true">{icon}</span>
            </div>
            <h3 className={styles.title}>{title}</h3>
            {description && <p className={styles.description}>{description}</p>}
            {actionLabel && onAction && (
                <button className={styles.cta} onClick={onAction} type="button">
                    {actionLabel}
                </button>
            )}
            {children}
        </div>
    );
}
