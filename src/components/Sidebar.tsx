import { NavLink } from 'react-router-dom';
import { LogOut, Home, X } from 'lucide-react';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { cn } from '../lib/utils';
import { Company, Profile } from '../types';
import { hasPermission } from '../lib/permissions';
import { HOME_TILES, RAIL_ITEMS } from '../lib/navigation';

type SidebarProps = {
  profile: Profile | null;
  company?: Company | null;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
};

async function handleLogout(onNavigate?: () => void) {
  await signOut(auth);
  onNavigate?.();
}

// Desktop: a narrow rail with the icon above the label, like Cellstore's left bar.
// The logo at the top is the way back to the Home tile grid.
function DesktopRail({ profile }: { profile: Profile | null }) {
  const visibleItems = RAIL_ITEMS.filter((item) => hasPermission(profile, item.permission));

  return (
    <aside className="hidden lg:flex w-24 app-sidebar relative border-r border-[#2A2A2E] flex-col min-h-screen overflow-hidden">
      <NavLink
        to="/"
        end
        title="Home"
        className={({ isActive }) =>
          cn(
            'flex flex-col items-center justify-center gap-1 py-4 border-b border-[#2A2A2E] transition-colors',
            isActive ? 'bg-[#1C1C1F] text-white' : 'text-zinc-300 hover:bg-white/[0.04] hover:text-white'
          )
        }
      >
        <div className="w-10 h-10 rounded-xl brand-badge flex items-center justify-center text-white font-black text-lg">
          A
        </div>
        <span className="text-[11px] font-semibold">Home</span>
      </NavLink>

      <nav className="flex-1 overflow-y-auto">
        {visibleItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center gap-1.5 px-1 py-4 text-center border-b border-[#2A2A2E] transition-colors',
                isActive
                  ? 'bg-[#1C1C1F] text-white shadow-[inset_3px_0_0_#ed1978]'
                  : 'text-zinc-400 hover:bg-white/[0.04] hover:text-white'
              )
            }
          >
            <item.icon className="w-6 h-6 shrink-0" />
            <span className="text-[11px] font-semibold leading-tight">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-[#2A2A2E] px-1 py-3 text-center">
        <p className="truncate text-[10px] font-semibold text-zinc-300" title={profile?.full_name || ''}>
          {profile?.full_name?.split(' ')[0] || 'Staff'}
        </p>
        <button
          onClick={() => handleLogout()}
          className="mt-2 inline-flex flex-col items-center gap-1 text-[10px] font-semibold text-zinc-500 hover:text-white"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </aside>
  );
}

// Mobile: a full-height drawer listing the rail items, then everything on the Home grid.
function MobileDrawer({
  profile,
  company,
  onClose,
}: {
  profile: Profile | null;
  company?: Company | null;
  onClose?: () => void;
}) {
  const sections = [
    { title: null, items: [{ icon: Home, label: 'Home', path: '/', permission: 'dashboard.view' as const }] },
    { title: 'Daily', items: RAIL_ITEMS },
    { title: 'More', items: HOME_TILES },
  ];

  return (
    <div className="lg:hidden fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close navigation"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
      />
      <aside className="relative z-10 h-full w-[88vw] max-w-sm app-sidebar border-r border-[#2A2A2E] flex flex-col overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2A2A2E]">
          <div className="min-w-0">
            <p className="font-black text-white truncate">Appleberry OS</p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 truncate">{company?.name || 'Navigation'}</p>
          </div>
          <button
            type="button"
            aria-label="Close navigation"
            onClick={onClose}
            className="rounded-xl border border-[#2A2A2E] bg-[#1C1C1F] p-2 text-zinc-300 hover:bg-white/[0.06]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-4">
          {sections.map((section) => {
            const items = section.title === null
              ? section.items
              : section.items.filter((item) => hasPermission(profile, item.permission));
            if (items.length === 0) return null;
            return (
              <div key={section.title || 'home'}>
                {section.title && (
                  <p className="px-3 pb-1 text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-semibold">{section.title}</p>
                )}
                {items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/'}
                    onClick={onClose}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors',
                        isActive ? 'bg-[#1C1C1F] text-white' : 'text-zinc-400 hover:bg-white/[0.04] hover:text-white'
                      )
                    }
                  >
                    <item.icon className="w-5 h-5 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="border-t border-[#2A2A2E] p-4">
          <p className="text-sm font-bold text-white truncate">{profile?.full_name || 'Staff Member'}</p>
          <button
            onClick={() => handleLogout(onClose)}
            className="mt-2 flex items-center gap-2 text-sm font-semibold text-zinc-400 hover:text-white"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>
    </div>
  );
}

export default function Sidebar({ profile, company, mobileOpen = false, onCloseMobile }: SidebarProps) {
  return (
    <>
      <DesktopRail profile={profile} />
      {mobileOpen && <MobileDrawer profile={profile} company={company} onClose={onCloseMobile} />}
    </>
  );
}
