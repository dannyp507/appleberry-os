import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Megaphone,
  ShoppingCart, 
  Package, 
  Wrench, 
  Users, 
  Search, 
  LogOut,
  User as UserIcon,
  FileText,
  Truck,
  ClipboardList,
  Smartphone,
  CheckSquare,
  Database
} from 'lucide-react';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { cn } from '../lib/utils';
import { Company, Profile } from '../types';
import { PermissionKey, hasPermission } from '../lib/permissions';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/', permission: 'dashboard.view' as PermissionKey },
  { icon: Megaphone, label: 'Campaigns', path: '/campaigns', permission: 'marketing.view' as PermissionKey },
  { icon: ShoppingCart, label: 'Cash Register', path: '/pos', permission: 'pos.use' as PermissionKey },
  { icon: Wrench, label: 'Repairs', path: '/repairs', permission: 'repairs.view' as PermissionKey },
  { icon: FileText, label: 'Invoices', path: '/invoices', permission: 'invoices.view' as PermissionKey },
  { icon: Users, label: 'Customers', path: '/customers', permission: 'customers.view' as PermissionKey },
  { icon: Package, label: 'Products', path: '/inventory', permission: 'inventory.view' as PermissionKey },
  { icon: Users, label: 'Staff', path: '/staff', permission: 'staff.manage' as PermissionKey },
  { icon: FileText, label: 'Sales Reports', path: '/reports/sales', permission: 'reports.sales' as PermissionKey },
  { icon: ClipboardList, label: 'Activity Log', path: '/activity', permission: 'activity.view' as PermissionKey },
  { icon: Truck, label: 'Purchase Orders', path: '/purchase-orders', permission: 'purchase_orders.view' as PermissionKey },
  { icon: ClipboardList, label: 'Orders', path: '/orders', permission: 'orders.view' as PermissionKey },
  { icon: Smartphone, label: 'Devices Inventory', path: '/devices', permission: 'devices.view' as PermissionKey },
  { icon: CheckSquare, label: 'Stock Take', path: '/stock-take', permission: 'stock_take.view' as PermissionKey },
  { icon: Database, label: 'Manage Data', path: '/manage-data', permission: 'manage_data.view' as PermissionKey },
  { icon: Search, label: 'IMEI Search', path: '/imei', permission: 'imei.view' as PermissionKey },
];

export default function Sidebar({ profile, company }: { profile: Profile | null; company?: Company | null }) {
  const visibleNavItems = navItems.filter((item) => hasPermission(profile, item.permission));

  const handleLogout = async () => {
    await signOut(auth);
  };

  return (
    <aside className="w-72 app-sidebar relative border-r border-white/10 flex flex-col h-full overflow-hidden">
      <div className="relative p-6 flex-1 min-h-0 flex flex-col">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl brand-badge flex items-center justify-center text-white font-bold text-xl">
            A
          </div>
          <div>
            <h1 className="display-font font-bold text-2xl leading-none text-white">Appleberry OS</h1>
            <p className="text-[11px] tracking-[0.22em] uppercase text-white/65 font-semibold mt-1">
              {company?.name || 'Repair Operations Suite'}
            </p>
          </div>
        </div>

        <nav className="space-y-1 overflow-y-auto pr-1">
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                  isActive
                    ? "bg-white/12 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                    : "text-white/72 hover:bg-white/8 hover:text-white"
                )
              }
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="mt-auto relative p-6 border-t border-white/10 space-y-4">
        {auth.currentUser && (
          <div className="flex items-center gap-3 px-4 py-3 bg-white/8 rounded-2xl border border-white/10">
            <div className="w-9 h-9 rounded-full bg-white/12 flex items-center justify-center text-white">
              <UserIcon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">
                {profile?.full_name || 'Staff Member'}
              </p>
              <p className="text-[10px] text-white/60 truncate uppercase tracking-[0.24em]">
                {profile?.role || 'Staff'}
              </p>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-sm font-medium text-white/72 hover:bg-white/8 hover:text-white transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Logout
        </button>
      </div>
    </aside>
  );
}
