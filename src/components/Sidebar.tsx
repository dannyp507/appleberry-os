import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Megaphone, MessageSquareMore, ShoppingCart, Package, Wrench,
  Users, Search, LogOut, User as UserIcon, FileText, Truck, ClipboardList,
  Smartphone, CheckSquare, Database, Settings, X, Calendar, ShoppingBag,
  BarChart2, DollarSign, ArrowLeftRight, SunMedium,
} from 'lucide-react';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { cn } from '../lib/utils';
import { Company, Profile } from '../types';
import { PermissionKey, hasPermission } from '../lib/permissions';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/', permission: 'dashboard.view' as PermissionKey },
  { icon: ShoppingCart, label: 'Cash Register', path: '/pos', permission: 'pos.use' as PermissionKey },
  { icon: Wrench, label: 'Repairs', path: '/repairs', permission: 'repairs.view' as PermissionKey },
  { icon: Calendar, label: 'Appointments', path: '/appointments', permission: 'appointments.view' as PermissionKey },
  { icon: Users, label: 'Customers', path: '/customers', permission: 'customers.view' as PermissionKey },
  { icon: FileText, label: 'Invoices', path: '/invoices', permission: 'invoices.view' as PermissionKey },
  { icon: ShoppingBag, label: 'Orders', path: '/orders', permission: 'orders.view' as PermissionKey },
  { icon: DollarSign, label: 'Expenses', path: '/expenses', permission: 'expenses.view' as PermissionKey },
  { icon: SunMedium, label: 'End of Day', path: '/end-of-day', permission: 'end_of_day.view' as PermissionKey },
  { icon: Package, label: 'Products', path: '/inventory', permission: 'inventory.view' as PermissionKey },
  { icon: Smartphone, label: 'Devices', path: '/devices', permission: 'devices.view' as PermissionKey },
  { icon: CheckSquare, label: 'Stock Take', path: '/stock-take', permission: 'stock_take.view' as PermissionKey },
  { icon: ArrowLeftRight, label: 'Transfers', path: '/transfer', permission: 'transfer.view' as PermissionKey },
  { icon: Truck, label: 'Purchase Orders', path: '/purchase-orders', permission: 'purchase_orders.view' as PermissionKey },
  { icon: BarChart2, label: 'Sales Reports', path: '/reports/sales', permission: 'reports.sales' as PermissionKey },
  { icon: BarChart2, label: 'Repairs Reports', path: '/reports/repairs', permission: 'reports.repairs' as PermissionKey },
  { icon: BarChart2, label: 'Inventory Reports', path: '/reports/inventory', permission: 'reports.inventory' as PermissionKey },
  { icon: Megaphone, label: 'Campaigns', path: '/campaigns', permission: 'marketing.view' as PermissionKey },
  { icon: MessageSquareMore, label: 'WhatsApp Studio', path: '/whatsapp-studio', permission: 'marketing.view' as PermissionKey },
  { icon: Search, label: 'IMEI Search', path: '/imei', permission: 'imei.view' as PermissionKey },
  { icon: ClipboardList, label: 'Activity Log', path: '/activity', permission: 'activity.view' as PermissionKey },
  { icon: Database, label: 'Manage Data', path: '/manage-data', permission: 'manage_data.view' as PermissionKey },
  { icon: Users, label: 'Staff', path: '/staff', permission: 'staff.manage' as PermissionKey },
  { icon: Settings, label: 'Setup', path: '/setup', permission: 'staff.manage' as PermissionKey },
];

type SidebarProps = {
  profile: Profile | null;
  company?: Company | null;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
};

function SidebarContent({ profile, company, onNavigate }: {
  profile: Profile | null;
  company?: Company | null;
  onNavigate?: () => void;
}) {
  const visibleNavItems = navItems.filter((item) => hasPermission(profile, item.permission));

  const handleLogout = async () => {
    await signOut(auth);
    onNavigate?.();
  };

  return (
    <>
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl brand-badge flex items-center justify-center text-white font-black text-lg shrink-0">
            A
          </div>
          <div className="min-w-0">
            <h1 className="font-black text-lg leading-tight text-white truncate">Appleberry OS</h1>
            <p className="text-[10px] tracking-widest uppercase text-white/40 font-medium truncate">
              {company?.name || 'Repair Suite'}
            </p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {visibleNavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                isActive
                  ? "bg-white/15 text-white font-semibold"
                  : "text-white/60 hover:bg-white/8 hover:text-white/90"
              )
            }
          >
            <item.icon className="w-[18px] h-[18px] shrink-0" />
            <span className="truncate">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User + Logout */}
      <div className="px-3 py-4 border-t border-white/10 space-y-1">
        {auth.currentUser && (
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/8 mb-2">
            <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center text-white shrink-0">
              <UserIcon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {profile?.full_name || 'Staff Member'}
              </p>
              <p className="text-[10px] text-white/40 truncate uppercase tracking-widest">
                {profile?.role || 'Staff'}
              </p>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-white/50 hover:bg-white/8 hover:text-white/80 transition-colors"
        >
          <LogOut className="w-[18px] h-[18px]" />
          Sign out
        </button>
      </div>
    </>
  );
}

export default function Sidebar({ profile, company, mobileOpen = false, onCloseMobile }: SidebarProps) {
  return (
    <>
      {/* Desktop */}
      <aside className="hidden lg:flex w-64 flex-col min-h-screen bg-[#1E293B] border-r border-white/10 overflow-hidden">
        <SidebarContent profile={profile} company={company} />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={onCloseMobile}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />
          <aside className="relative z-10 h-full w-[80vw] max-w-xs bg-[#1E293B] border-r border-white/10 flex flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <p className="text-xs uppercase tracking-widest text-white/40 font-medium">Menu</p>
              <button
                type="button"
                aria-label="Close"
                onClick={onCloseMobile}
                className="rounded-lg bg-white/10 p-1.5 text-white/60 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <SidebarContent profile={profile} company={company} onNavigate={onCloseMobile} />
          </aside>
        </div>
      )}
    </>
  );
}
