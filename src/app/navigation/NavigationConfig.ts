// ═══════════════════════════════════════════════════════════════════
// charEdge — Navigation Configuration (P2-6)
//
// Defines the navigation tree for the sidebar.
// Single source of truth for route hierarchy, icons, and grouping.
// ═══════════════════════════════════════════════════════════════════

export interface NavItem {
    id: string;
    label: string;
    icon: string;      // Emoji or icon name
    path?: string;      // Route path (leaf nodes)
    children?: NavItem[];
    badge?: string;     // 'new', 'beta', count string, etc.
    shortcut?: string;  // Keyboard shortcut hint
}

export const NAVIGATION: NavItem[] = [
    {
        id: 'charts',
        label: 'Charts',
        icon: '📊',
        children: [
            { id: 'chart', label: 'Live Chart', icon: '📈', path: '/chart', shortcut: '1' },
            { id: 'scanner', label: 'Scanner', icon: '🔍', path: '/scanner', badge: 'beta' },
            { id: 'screener', label: 'Screener', icon: '📋', path: '/screener' },
            { id: 'discover', label: 'Discover', icon: '🧭', path: '/discover' },
        ],
    },
    {
        id: 'journal',
        label: 'Journal',
        icon: '📓',
        children: [
            { id: 'trades', label: 'Trades', icon: '💰', path: '/journal', shortcut: '2' },
            { id: 'notes', label: 'Notes', icon: '📝', path: '/journal/notes' },
            { id: 'plans', label: 'Trade Plans', icon: '🎯', path: '/journal/plans' },
            { id: 'playbooks', label: 'Playbooks', icon: '📚', path: '/journal/playbooks' },
        ],
    },
    {
        id: 'analysis',
        label: 'Analysis',
        icon: '📉',
        children: [
            { id: 'dashboard', label: 'Dashboard', icon: '🏠', path: '/dashboard', shortcut: '3' },
            { id: 'insights', label: 'Insights', icon: '💡', path: '/insights' },
            { id: 'analytics', label: 'Analytics', icon: '📊', path: '/analytics' },
            { id: 'paper-trade', label: 'Paper Trade', icon: '🎮', path: '/paper-trade' },
        ],
    },
    {
        id: 'social',
        label: 'Community',
        icon: '👥',
        badge: 'new',
        children: [
            { id: 'feed', label: 'Feed', icon: '📡', path: '/social/feed' },
            { id: 'live-rooms', label: 'Live Rooms', icon: '🔴', path: '/social/live' },
            { id: 'copy-trade', label: 'Copy Trade', icon: '🔗', path: '/social/copy' },
        ],
    },
    {
        id: 'settings',
        label: 'Settings',
        icon: '⚙️',
        path: '/settings',
        shortcut: ',',
    },
];

/**
 * Flatten the navigation tree into a flat array of leaf items.
 */
export function flattenNavItems(items: NavItem[] = NAVIGATION): NavItem[] {
    const result: NavItem[] = [];
    for (const item of items) {
        if (item.path) result.push(item);
        if (item.children) result.push(...flattenNavItems(item.children));
    }
    return result;
}

/**
 * Find a nav item by its id.
 */
export function findNavItem(id: string, items: NavItem[] = NAVIGATION): NavItem | undefined {
    for (const item of items) {
        if (item.id === id) return item;
        if (item.children) {
            const found = findNavItem(id, item.children);
            if (found) return found;
        }
    }
    return undefined;
}

/**
 * Get the breadcrumb trail for a given path.
 */
export function getBreadcrumbs(path: string, items: NavItem[] = NAVIGATION, trail: NavItem[] = []): NavItem[] {
    for (const item of items) {
        if (item.path === path) return [...trail, item];
        if (item.children) {
            const result = getBreadcrumbs(path, item.children, [...trail, item]);
            if (result.length > 0) return result;
        }
    }
    return [];
}

/**
 * Settings page section configuration.
 */
export interface SettingsSection {
    id: string;
    label: string;
    icon: string;
    component: string;  // Lazy-loaded component path
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
    { id: 'account', label: 'Account', icon: '👤', component: 'ProfileSection' },
    { id: 'appearance', label: 'Appearance', icon: '🎨', component: 'ThemeSection' },
    { id: 'trading', label: 'Trading', icon: '📈', component: 'TradingSection' },
    { id: 'data', label: 'Data & Storage', icon: '💾', component: 'DataSection' },
    { id: 'integrations', label: 'Integrations', icon: '🔌', component: 'IntegrationsSection' },
    { id: 'shortcuts', label: 'Keyboard Shortcuts', icon: '⌨️', component: 'ShortcutsSection' },
    { id: 'notifications', label: 'Notifications', icon: '🔔', component: 'NotificationsSection' },
    { id: 'danger', label: 'Danger Zone', icon: '⚠️', component: 'DangerZoneSection' },
];
