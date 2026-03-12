// ═══════════════════════════════════════════════════════════════════
// charEdge — Keyboard Shortcut Modal
// Shows all available keyboard shortcuts, triggered by `?` key.
// Lists shortcuts from useHotkeys and chart keyboard nav.
// ═══════════════════════════════════════════════════════════════════
import React from 'react';
import styles from './KeyboardShortcutModal.module.css';

const SHORTCUT_GROUPS = [
    {
        title: 'Navigation',
        shortcuts: [
            { keys: ['1'], description: 'Go to Home' },
            { keys: ['2'], description: 'Go to Charts' },
            { keys: ['3'], description: 'Go to Discover' },
            { keys: ['4'], description: 'Toggle Settings' },
            { keys: ['?'], description: 'Toggle this panel' },
        ],
    },
    {
        title: 'Trading',
        shortcuts: [
            { keys: ['Ctrl', '/'], description: 'Quick add trade' },
            { keys: ['Ctrl', 'N'], description: 'New trade' },
            { keys: ['Ctrl', '.'], description: 'Toggle activity log' },
        ],
    },
    {
        title: 'Chart',
        shortcuts: [
            { keys: ['←', '→'], description: 'Pan chart left/right' },
            { keys: ['↑', '↓'], description: 'Zoom in/out' },
            { keys: ['Home'], description: 'Jump to oldest bar' },
            { keys: ['End'], description: 'Jump to newest bar' },
            { keys: ['Shift', '←→'], description: 'Fine pan (1 bar)' },
        ],
    },
    {
        title: 'General',
        shortcuts: [
            { keys: ['Ctrl', 'Shift', 'F'], description: 'Toggle focus mode' },
            { keys: ['Esc'], description: 'Close modal / panel' },
        ],
    },
];

/**
 * @param {{ isOpen: boolean; onClose: () => void }} props
 */
function KeyboardShortcutModal({ isOpen, onClose }) {
    if (!isOpen) return null;

    return (
        <div className={styles.backdrop} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2 className={styles.title}>Keyboard Shortcuts</h2>
                    <button className={styles.closeBtn} onClick={onClose} type="button" aria-label="Close">
                        ✕
                    </button>
                </div>

                <div className={styles.content}>
                    {SHORTCUT_GROUPS.map((group) => (
                        <div key={group.title} className={styles.group}>
                            <h3 className={styles.groupTitle}>{group.title}</h3>
                            <div className={styles.shortcuts}>
                                {group.shortcuts.map((sc) => (
                                    <div key={sc.description} className={styles.row}>
                                        <span className={styles.description}>{sc.description}</span>
                                        <span className={styles.keys}>
                                            {sc.keys.map((key, i) => (
                                                <React.Fragment key={key}>
                                                    {i > 0 && <span className={styles.plus}>+</span>}
                                                    <kbd className={styles.kbd}>{key}</kbd>
                                                </React.Fragment>
                                            ))}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className={styles.footer}>
                    Press <kbd className={styles.kbd}>?</kbd> to toggle this panel
                </div>
            </div>
        </div>
    );
}

export default React.memo(KeyboardShortcutModal);
