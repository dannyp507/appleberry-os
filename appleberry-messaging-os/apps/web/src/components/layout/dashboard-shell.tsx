'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, ChevronDown, Menu, Search } from 'lucide-react';

import { navigation, whatsappFeatureNavigation } from '../../lib/navigation';
import { useSessionStore } from '../../stores/session-store';

export function DashboardShell({
  children,
  title = 'Whatsapp',
  eyebrow = 'Channel Operations',
}: {
  children: React.ReactNode;
  title?: string;
  eyebrow?: string;
}) {
  const pathname = usePathname();
  const user = useSessionStore((state) => state.user);
  const activeWorkspaceId = useSessionStore((state) => state.activeWorkspaceId);
  const setActiveWorkspaceId = useSessionStore((state) => state.setActiveWorkspaceId);
  const memberships = user?.memberships ?? [];
  const activeMembership =
    memberships.find((membership) => membership.workspace.id === activeWorkspaceId) ?? memberships[0];

  return (
    <main className="min-h-screen text-slate-900">
      <div className="mx-auto min-h-screen max-w-[1600px] px-3 py-3 lg:px-4">
        <div className="flex min-h-[calc(100vh-24px)] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <aside className="hidden w-[58px] shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col lg:items-center lg:py-4">
            <div className="mb-5 flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-500 text-white shadow-sm">
              <Menu className="h-4 w-4" />
            </div>
            <nav className="flex flex-1 flex-col items-center gap-3">
              {navigation.map(({ label, href, icon: Icon }) => (
                <Link
                  key={label}
                  href={href}
                  className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${
                    pathname === href ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
                  }`}
                  title={label}
                >
                  <Icon className="h-4 w-4" />
                </Link>
              ))}
            </nav>
          </aside>

          <aside className="hidden w-[272px] shrink-0 border-r border-slate-200 bg-slate-50/70 lg:block">
            <div className="border-b border-slate-200 px-4 py-4">
              <p className="text-sm font-medium text-slate-500">Appleberry OS</p>
              <div className="mt-4 flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-slate-400 shadow-sm ring-1 ring-slate-200">
                <Search className="h-4 w-4" />
                <span className="text-sm">Search</span>
              </div>
            </div>

            <div className="px-4 py-5">
              <h2 className="text-3xl font-semibold tracking-tight text-slate-900">{title}</h2>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Features</p>

              <nav className="mt-4 space-y-2">
                {whatsappFeatureNavigation.map(({ label, description, href, icon: Icon }) => (
                  <Link
                    key={`${label}-${href}`}
                    href={href}
                    className={`flex items-start gap-3 rounded-2xl px-3 py-3 transition ${
                      pathname === href ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200' : 'text-slate-600 hover:bg-white/80'
                    }`}
                  >
                    <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-500">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{label}</p>
                      <p className="truncate text-xs text-slate-400">{description}</p>
                    </div>
                  </Link>
                ))}
              </nav>
            </div>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col bg-[#f8fafc]">
            <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:px-6">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700">
                  <select
                    className="bg-transparent outline-none"
                    value={activeMembership?.workspace.id}
                    onChange={(event) => setActiveWorkspaceId(event.target.value)}
                  >
                    {memberships.map((membership) => (
                      <option key={membership.workspace.id} value={membership.workspace.id}>
                        {membership.workspace.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-lg">🇺🇸</span>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-500 text-sm font-semibold text-white">
                  {user ? `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}` : 'JA'}
                </div>
                <button type="button" className="rounded-full p-2 text-slate-500 hover:bg-slate-100">
                  <Bell className="h-4 w-4" />
                </button>
              </div>
            </header>

            <section className="min-w-0 flex-1 overflow-auto px-4 py-5 lg:px-6">
              <div className="mb-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{eyebrow}</p>
              </div>
              {children}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
