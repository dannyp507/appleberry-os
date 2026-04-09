import { Profile, Role } from '../types';

export type PermissionKey =
  | 'dashboard.view'
  | 'marketing.view'
  | 'pos.use'
  | 'repairs.view'
  | 'invoices.view'
  | 'customers.view'
  | 'inventory.view'
  | 'imei.view'
  | 'expenses.view'
  | 'end_of_day.view'
  | 'staff.manage'
  | 'reports.sales'
  | 'reports.repairs'
  | 'reports.inventory'
  | 'activity.view'
  | 'purchase_orders.view'
  | 'orders.view'
  | 'devices.view'
  | 'stock_take.view'
  | 'transfer.view'
  | 'appointments.view'
  | 'website.view'
  | 'manage_data.view'
  | 'setup.view'
  | 'integrations.view'
  | 'getting_started.view';

export type PermissionPreset = 'cashier' | 'technician' | 'manager' | 'custom';

export const PERMISSION_GROUPS: Array<{ title: string; items: Array<{ key: PermissionKey; label: string; description: string }> }> = [
  {
    title: 'Core Access',
    items: [
      { key: 'dashboard.view', label: 'Dashboard', description: 'View the business dashboard and quick links.' },
      { key: 'marketing.view', label: 'Campaigns', description: 'Access marketing campaigns, templates, and CRM outreach tools.' },
      { key: 'pos.use', label: 'Cash Register', description: 'Create sales, take payments, and complete checkout.' },
      { key: 'repairs.view', label: 'Repairs', description: 'View and manage repair tickets.' },
      { key: 'invoices.view', label: 'Invoices', description: 'View invoices and invoice history.' },
      { key: 'customers.view', label: 'Customers', description: 'View and manage customer records.' },
      { key: 'inventory.view', label: 'Products', description: 'View and manage stock and products.' },
      { key: 'imei.view', label: 'IMEI Search', description: 'Search device and IMEI history.' },
    ],
  },
  {
    title: 'Operations',
    items: [
      { key: 'expenses.view', label: 'Expenses', description: 'Manage expenses and spend tracking.' },
      { key: 'end_of_day.view', label: 'End of Day', description: 'Run end-of-day checks and summaries.' },
      { key: 'purchase_orders.view', label: 'Purchase Orders', description: 'Access supplier purchase orders.' },
      { key: 'orders.view', label: 'Orders', description: 'Access internal order management.' },
      { key: 'devices.view', label: 'Devices Inventory', description: 'Access tracked devices inventory.' },
      { key: 'stock_take.view', label: 'Stock Take', description: 'Count stock and manage variances.' },
      { key: 'transfer.view', label: 'Inventory Transfer', description: 'Move stock between branches.' },
      { key: 'appointments.view', label: 'Appointments', description: 'Manage appointment calendars.' },
    ],
  },
  {
    title: 'Admin & Reports',
    items: [
      { key: 'staff.manage', label: 'Staff Management', description: 'Add, edit, and remove staff members.' },
      { key: 'reports.sales', label: 'Sales Reports', description: 'View sales performance and revenue reports.' },
      { key: 'reports.repairs', label: 'Repairs Reports', description: 'View repairs pipeline and turnaround reports.' },
      { key: 'reports.inventory', label: 'Inventory Reports', description: 'View inventory reporting pages.' },
      { key: 'activity.view', label: 'Activity Log', description: 'Review system-wide operational activity.' },
      { key: 'manage_data.view', label: 'Manage Data', description: 'Use import tools and app management pages.' },
      { key: 'setup.view', label: 'Setup', description: 'Access setup and system configuration pages.' },
      { key: 'integrations.view', label: 'Integrations', description: 'Manage third-party integration pages.' },
      { key: 'website.view', label: 'Website', description: 'Access website management pages.' },
      { key: 'getting_started.view', label: 'Getting Started', description: 'Access onboarding and getting started pages.' },
    ],
  },
];

export const ALL_PERMISSIONS: PermissionKey[] = PERMISSION_GROUPS.flatMap((group) => group.items.map((item) => item.key));

export const PRESET_PERMISSIONS: Record<Exclude<PermissionPreset, 'custom'>, PermissionKey[]> = {
  cashier: ['dashboard.view', 'pos.use', 'invoices.view', 'customers.view', 'inventory.view', 'imei.view', 'expenses.view', 'end_of_day.view'],
  technician: ['dashboard.view', 'repairs.view', 'customers.view', 'inventory.view', 'imei.view', 'invoices.view'],
  manager: [
    'dashboard.view',
    'marketing.view',
    'pos.use',
    'repairs.view',
    'invoices.view',
    'customers.view',
    'inventory.view',
    'imei.view',
    'expenses.view',
    'end_of_day.view',
    'reports.sales',
    'reports.repairs',
    'activity.view',
    'purchase_orders.view',
    'orders.view',
    'devices.view',
    'stock_take.view',
    'transfer.view',
    'appointments.view',
  ],
};

const LEGACY_STAFF_PERMISSIONS: PermissionKey[] = ['dashboard.view', 'pos.use', 'repairs.view', 'invoices.view', 'customers.view', 'inventory.view', 'imei.view', 'expenses.view', 'end_of_day.view'];

export function getDefaultPermissions(role: Role): PermissionKey[] {
  return role === 'admin' || role === 'owner' ? ALL_PERMISSIONS : LEGACY_STAFF_PERMISSIONS;
}

export function normalizePermissions(role: Role, permissions?: string[] | null): PermissionKey[] {
  if (role === 'admin' || role === 'owner') return ALL_PERMISSIONS;
  if (!permissions || permissions.length === 0) return LEGACY_STAFF_PERMISSIONS;
  return permissions.filter((permission): permission is PermissionKey => ALL_PERMISSIONS.includes(permission as PermissionKey));
}

export function hasPermission(profile: Profile | null, permission: PermissionKey) {
  if (!profile) return false;
  if (profile.role === 'admin' || profile.role === 'owner') return true;
  return normalizePermissions(profile.role, profile.permissions).includes(permission);
}
