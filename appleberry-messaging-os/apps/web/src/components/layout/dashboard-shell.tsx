'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  BarChart3,
  MessageSquare,
  Settings,
  Users,
  Mail,
  Workflow,
  Key,
  ShieldAdmin,
  LayoutDashboard,
  Menu,
  X,
  LogOut,
  Bell,
} from 'lucide-react';
import { useState, useEffect } from 'react';

import { useSessionStore } from '../../stores/session-store';
import { NotificationPanel } from './notification-panel';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Accounts', href: '/accounts', icon: Users },
  { name: 'Campaigns', href: '/campaigns', icon: Mail },
  { name: 'Contacts', href: '/contacts', icon: Users },
  { name: 'Templates', href: '/templates', icon: MessageSquare },
  { name: 'Flows', href: '/flows', icon: Workflow },
  { name: 'Inbox', href: '/inbox', icon: Mail },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'API Center', href: '/api-center', icon: Key },
  { name: 'Settings', href: '/settings', icon: Settings },
  { name: 'Admin', href: '/admin', icon: ShieldAdmin },
];

export function DashboardShell({
  children,
  title = 'Workspace',
  eyebrow = 'Operations',
}: {
  children: React.ReactNode;
  title?: string;
  eyebrow?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useSessionStore((state) => state.user);
  const clearSession = useSessionStore((state) => state.clearSession);
  const activeWorkspaceId = useSessionStore((state) => state.activeWorkspaceId);
  const setActiveWorkspaceId = useSessionStore((state) => state.setActiveWorkspaceId);
  const memberships = user?.memberships ?? [];
  const activeMembership =
    memberships.find((membership) => membership.workspace.id === activeWorkspaceId) ?? memberships[0];

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = () => {
    clearSession();
    router.push('/login');
  };

  // Only render after hydration to avoid mismatch
  if (!mounted) {
    return <div className="flex h-screen bg-slate-50" />;
  }

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-72' : 'w-20'
        } bg-white border-r border-slate-200 overflow-y-auto transition-all duration-300 ease-in-out flex flex-col`}
      >
        {/* Logo Area */}
        <div className="border-b border-slate-100 px-4 py-6 flex items-center justify-between">
          {sidebarOpen && (
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-sm">
                <span className="text-white font-bold text-lg">A</span>
              </div>
              <div>
                <h1 className="text-base font-bold text-slate-900">Appleberry</h1>
                <p className="text-xs text-slate-500 font-medium">OS</p>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors flex-shrink-0"
          >
            {sidebarOpen ? (
              <X className="w-5 h-5 text-slate-600" />
            ) : (
              <Menu className="w-5 h-5 text-slate-600" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            const IconComponent = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center space-x-3 px-3 py-3 rounded-[10px] transition-all duration-200 group ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-600 shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
                title={!sidebarOpen ? item.name : undefined}
              >
                <div
                  className={`flex-shrink-0 transition-colors ${
                    isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-500'
                  }`}
                >
                  <IconComponent className="w-6 h-6" />
                </div>
                {sidebarOpen && (
                  <span className="text-sm font-medium whitespace-nowrap">{item.name}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Section */}
        <div className="border-t border-slate-100 p-3">
          {sidebarOpen ? (
            <div className="space-y-3">
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-[12px] p-3 border border-slate-200">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Current Workspace
                </p>
                {activeMembership && (
                  <select
                    aria-label="Switch workspace"
                    value={activeMembership.workspace.id}
                    onChange={(event) => setActiveWorkspaceId(event.target.value)}
                    className="mt-2 w-full text-sm font-medium text-slate-900 bg-white border border-slate-200 rounded-[8px] px-2 py-1.5 cursor-pointer"
                  >
                    {memberships.map((membership) => (
                      <option key={membership.workspace.id} value={membership.workspace.id}>
                        {membership.workspace.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-[8px] transition-colors font-medium"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center justify-center p-2.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-[8px] transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{eyebrow}</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotificationOpen(!notificationOpen)}
                className="relative p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                title="Notifications"
              >
                <Bell className="w-5 h-5" />
                <span className="absolute right-1 top-1 h-2 w-2 bg-rose-500 rounded-full" />
              </button>
              {notificationOpen && (
                <NotificationPanel onClose={() => setNotificationOpen(false)} />
              )}
            </div>
            <div className="h-6 w-px bg-slate-200" />
            <div className="flex items-center space-x-3">
              <div className="text-right">
                <p className="text-sm font-medium text-slate-900">{user?.firstName} {user?.lastName}</p>
                <p className="text-xs text-slate-500 capitalize">{user?.globalRole?.toLowerCase()}</p>
              </div>
              <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-semibold text-sm shadow-sm">
                {user?.firstName?.charAt(0)}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <div className="p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
