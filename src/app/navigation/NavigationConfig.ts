// ═══════════════════════════════════════════════════════════════════
// charEdge — Navigation Configuration (P2-6)
//
// Defines the navigation tree for the sidebar.
// Single source of truth for route hierarchy, icons, and grouping.
// ═══════════════════════════════════════════════════════════════════

export interface NavItem {
  id: string;
  label: string;
  icon: string; // Emoji or icon name
  path?: string; // Route path (leaf nodes)
  children?: NavItem[];
  badge?: string; // 'new', 'beta', count string, etc.
  shortcut?: string; // Keyboard shortcut hint
}

export const NAVIGATION: NavItem[] = [
  { id: 'journal', label: 'Journal', icon: '📓', path: '/journal', shortcut: '1' },
  { id: 'charts', label: 'Charts', icon: '📈', path: '/charts', shortcut: '2' },
  { id: 'intel', label: 'Intel', icon: '🔍', path: '/intel', shortcut: '3' },
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
  component: string; // Lazy-loaded component path
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
