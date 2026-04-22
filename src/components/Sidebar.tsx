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
  Database,
  X
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
  { icon: Smartphone, label: 'Devices Inventory', path: '/devices', permission: 'devices.view' as PermissionKey },
  { icon: CheckSquare, label: 'Stock Take', path: '/stock-take', permission: 'stock_take.view' as PermissionKey },
  { icon: Database, label: 'Manage Data', path: '/manage-data', permission: 'manage_data.view' as PermissionKey },
  { icon: Search, label: 'IMEI Search', path: '/imei', permission: 'imei.view' as PermissionKey },
];

type SidebarProps = {
  profile: Profile | null;
  company?: Company | null;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
};

function SidebarContent({
  profile,
  company,
  onNavigate,
}: {
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
      <div className="relative p-5 md:p-6 flex-1 min-h-0 flex flex-col">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-11 h-11 md:w-12 md:h-12 rounded-xl brand-badge flex items-center justify-center text-white font-black text-xl shrink-0">
            A
          </div>
          <div className="min-w-0">
            <h1 className="font-black text-xl md:text-2xl leading-none text-white truncate">Appleberry OS</h1>
            <p className="text-[10px] md:text-[11px] tracking-[0.18em] uppercase text-zinc-400 font-semibold mt-1 truncate">
              {company?.name || 'Repair Operations Suite'}
            </p>
          </div>
        </div>

        <nav className="space-y-1 overflow-y-auto pr-1">
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  "relative flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all",
                  isActive
                    ? "bg-[#1C1C1F] text-white border border-[#2A2A2E] shadow-[inset_3px_0_0_#ed1978]"
                    : "text-zinc-400 hover:bg-white/[0.04] hover:text-white"
                )
              }
            >
              <item.icon className="w-5 h-5 shrink-0" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="mt-auto relative p-5 md:p-6 border-t border-[#2A2A2E] space-y-4">
        {auth.currentUser && (
          <div className="flex items-center gap-3 px-4 py-3 bg-[#1C1C1F] rounded-xl border border-[#2A2A2E]">
            <div className="w-9 h-9 rounded-lg bg-[#202024] flex items-center justify-center text-zinc-200 shrink-0">
              <UserIcon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">
                {profile?.full_name || 'Staff Member'}
              </p>
              <p className="text-[10px] text-zinc-500 truncate uppercase tracking-[0.18em]">
                {profile?.role || 'Staff'}
              </p>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-sm font-semibold text-zinc-400 hover:bg-white/[0.04] hover:text-white transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Logout
        </button>
      </div>
    </>
  );
}

export default function Sidebar({ profile, company, mobileOpen = false, onCloseMobile }: SidebarProps) {
  return (
    <>
      <aside className="hidden lg:flex w-72 app-sidebar relative border-r border-[#2A2A2E] flex-col min-h-screen overflow-hidden">
        <SidebarContent profile={profile} company={company} />
      </aside>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={onCloseMobile}
            className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
          />
          <aside className="relative z-10 h-full w-[88vw] max-w-sm app-sidebar border-r border-[#2A2A2E] flex flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#2A2A2E]">
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-400 font-semibold">Navigation</p>
              <button
                type="button"
                aria-label="Close navigation"
                onClick={onCloseMobile}
                className="rounded-xl border border-[#2A2A2E] bg-[#1C1C1F] p-2 text-zinc-300 hover:bg-white/[0.06]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <SidebarContent profile={profile} company={company} onNavigate={onCloseMobile} />
          </aside>
        </div>
      )}
    </>
  );
}
