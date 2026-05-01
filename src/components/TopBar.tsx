import { Home, Menu } from 'lucide-react';
import { GlobalSearch } from './GlobalSearch';
import { Profile, Company } from '../types';

type TopBarProps = {
  profile: Profile | null;
  company: Company | null | undefined;
  onOpenMobile?: () => void;
};

export default function TopBar({ profile, company, onOpenMobile }: TopBarProps) {
  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-4 shrink-0 sticky top-0 z-30">
      {/* Mobile menu button */}
      <button
        type="button"
        className="lg:hidden p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
        onClick={onOpenMobile}
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Company name */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-[#3B7DC8] flex items-center justify-center">
          <Home className="w-4 h-4 text-white" />
        </div>
        <span className="font-bold text-[#1a2e4a] text-sm hidden sm:block">
          {company?.name || 'Appleberry OS'}
        </span>
      </div>

      {/* Search — center */}
      <div className="flex-1 max-w-lg mx-auto">
        <GlobalSearch profile={profile} topBar />
      </div>

      {/* User */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-8 h-8 rounded-full bg-[#3B7DC8] flex items-center justify-center text-white text-sm font-bold">
          {(profile?.full_name || 'U').charAt(0).toUpperCase()}
        </div>
        <span className="text-sm font-semibold text-gray-700 hidden sm:block">
          {profile?.full_name?.split(' ')[0] || 'User'}
        </span>
      </div>
    </header>
  );
}
