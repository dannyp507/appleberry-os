import { NavLink } from 'react-router-dom';
import {
  Megaphone, MessageSquareMore, ShoppingCart, Package, Wrench,
  Users, Search, FileText, Truck, ClipboardList, Smartphone, CheckSquare,
  Database, Settings, Calendar, ShoppingBag, BarChart2, DollarSign,
  ArrowLeftRight, SunMedium, LogOut,
} from 'lucide-react';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { cn } from '../lib/utils';
import { Company, Profile } from '../types';
import { PermissionKey, hasPermission } from '../lib/permissions';

const navItems = [
  { icon: ShoppingCart, label: 'Cash Register', path: '/pos', permission: 'pos.use' as PermissionKey },
  { icon: Wrench, label: 'Repairs', path: '/repairs', permission: 'repairs.view' as PermissionKey },
  { icon: FileText, label: 'Invoices', path: '/invoices', permission: 'invoices.view' as PermissionKey },
  { icon: Users, label: 'Customers', path: '/customers', permission: 'customers.view' as PermissionKey },
  { icon: Package, label: 'Products', path: '/inventory', permission: 'inventory.view' as PermissionKey },
  { icon: Smartphone, label: 'Devices', path: '/devices', permission: 'devices.view' as PermissionKey },
  { icon: ShoppingBag, label: 'Orders', path: '/orders', permission: 'orders.view' as PermissionKey },
  { icon: Truck, label: 'Purchase Orders', path: '/purchase-orders', permission: 'purchase_orders.view' as PermissionKey },
  { icon: CheckSquare, label: 'Stock Take', path: '/stock-take', permission: 'stock_take.view' as PermissionKey },
  { icon: ArrowLeftRight, label: 'Transfers', path: '/transfer', permission: 'transfer.view' as PermissionKey },
  { icon: DollarSign, label: 'Expenses', path: '/expenses', permission: 'expenses.view' as PermissionKey },
  { icon: SunMedium, label: 'End of Day', path: '/end-of-day', permission: 'end_of_day.view' as PermissionKey },
  { icon: Calendar, label: 'Appointments', path: '/appointments', permission: 'appointments.view' as PermissionKey },
  { icon: BarChart2, label: 'Reports', path: '/reports/sales', permission: 'reports.sales' as PermissionKey },
  { icon: Megaphone, label: 'Campaigns', path: '/campaigns', permission: 'marketing.view' as PermissionKey },
  { icon: MessageSquareMore, label: 'WhatsApp', path: '/whatsapp-studio', permission: 'marketing.view' as PermissionKey },
  { icon: Search, label: 'IMEI', path: '/imei', permission: 'imei.view' as PermissionKey },
  { icon: ClipboardList, label: 'Activity', path: '/activity', permission: 'activity.view' as PermissionKey },
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

function SidebarContent({ profile, onNavigate }: { profile: Profile | null; onNavigate?: () => void }) {
  const visibleNavItems = navItems.filter(item => hasPermission(profile, item.permission));

  return (
    <div className="flex flex-col h-full">
      {/* Logo mark */}
      <div className="flex items-center justify-center py-4 border-b border-white/10">
        <NavLink to="/" onClick={onNavigate} className="flex flex-col items-center gap-1">
          <div className="w-10 h-10 rounded-xl brand-badge flex items-center justify-center text-white font-black text-lg">
            A
          </div>
        </NavLink>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto py-2">
        {visibleNavItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            onClick={onNavigate}
            title={item.label}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-1 px-1 py-2.5 mx-1 rounded-lg transition-all cursor-pointer',
                isActive
                  ? 'bg-white/20 text-white'
                  : 'text-white/50 hover:bg-white/10 hover:text-white/90'
              )
            }
          >
            <item.icon className="w-5 h-5 shrink-0" />
            <span className="text-[9px] font-semibold text-center leading-tight max-w-[64px] truncate">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Sign out */}
      <div className="py-2 border-t border-white/10">
        <button
          onClick={() => { signOut(auth); onNavigate?.(); }}
          title="Sign out"
          className="flex flex-col items-center gap-1 px-1 py-2.5 mx-1 rounded-lg w-[calc(100%-8px)] text-white/40 hover:bg-white/10 hover:text-white/80 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-[9px] font-semibold">Sign out</span>
        </button>
      </div>
    </div>
  );
}

export default function Sidebar({ profile, company, mobileOpen = false, onCloseMobile }: SidebarProps) {
  return (
    <>
      {/* Desktop narrow sidebar */}
      <aside className="hidden lg:flex w-[78px] flex-col min-h-screen bg-[#2B3748] border-r border-white/10 overflow-hidden shrink-0">
        <SidebarContent profile={profile} />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <button type="button" aria-label="Close" onClick={onCloseMobile} className="absolute inset-0 bg-black/50" />
          <aside className="relative z-10 h-full w-[78px] bg-[#2B3748] border-r border-white/10 flex flex-col overflow-hidden shadow-2xl">
            <SidebarContent profile={profile} onNavigate={onCloseMobile} />
          </aside>
        </div>
      )}
    </>
  );
}
