import {
  Activity,
  BarChart3,
  Banknote,
  ClipboardCheck,
  Database,
  FileText,
  LineChart,
  Megaphone,
  Package,
  PieChart,
  PlusSquare,
  Search,
  ShoppingCart,
  Smartphone,
  Truck,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { PermissionKey } from './permissions';

export type NavItem = {
  icon: LucideIcon;
  label: string;
  path: string;
  permission: PermissionKey;
};

// The left rail mirrors the daily modules staff know from Cellstore, in the same order.
// Cellstore also has Orders between Purchase Orders and Devices Inventory; add it here once it exists.
export const RAIL_ITEMS: NavItem[] = [
  { icon: ShoppingCart, label: 'Cash Register', path: '/pos', permission: 'pos.use' },
  { icon: Wrench, label: 'Repairs', path: '/repairs', permission: 'repairs.view' },
  { icon: FileText, label: 'Invoices', path: '/invoices', permission: 'invoices.view' },
  { icon: Users, label: 'Customers', path: '/customers', permission: 'customers.view' },
  { icon: Package, label: 'Products', path: '/inventory', permission: 'inventory.view' },
  { icon: PlusSquare, label: 'Purchase Orders', path: '/purchase-orders', permission: 'purchase_orders.view' },
  { icon: Smartphone, label: 'Devices Inventory', path: '/devices', permission: 'devices.view' },
];

// Everything else lives on the Home tile grid, in Cellstore's tile order.
// Modules not built yet (Orders, Appointment Calendar, Website, Inventory Reports,
// Getting Started, Integrations) are left out rather than shown as dead tiles.
export const HOME_TILES: NavItem[] = [
  { icon: ClipboardCheck, label: 'Stock Take', path: '/stock-take', permission: 'stock_take.view' },
  { icon: Banknote, label: 'Expenses', path: '/expenses', permission: 'expenses.view' },
  { icon: Truck, label: 'Inventory Transfer', path: '/transfer', permission: 'transfer.view' },
  { icon: LineChart, label: 'Dashboard', path: '/dashboard', permission: 'dashboard.view' },
  { icon: Wallet, label: 'End of Day', path: '/end-of-day', permission: 'end_of_day.view' },
  { icon: Users, label: 'Staff Employee', path: '/staff', permission: 'staff.manage' },
  { icon: PieChart, label: 'Sales Reports', path: '/reports/sales', permission: 'reports.sales' },
  { icon: BarChart3, label: 'Repairs Reports', path: '/reports/repairs', permission: 'reports.repairs' },
  { icon: Activity, label: 'Activity Log', path: '/activity', permission: 'activity.view' },
  { icon: Database, label: 'Manage Data', path: '/manage-data', permission: 'manage_data.view' },
  { icon: Search, label: 'IMEI Search', path: '/imei', permission: 'imei.view' },
  { icon: Megaphone, label: 'Campaigns', path: '/campaigns', permission: 'marketing.view' },
];
