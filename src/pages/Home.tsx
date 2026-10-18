import { Link } from 'react-router-dom';
import { Profile } from '../types';
import { hasPermission } from '../lib/permissions';
import { HOME_TILES } from '../lib/navigation';

// Launcher grid shown after login, laid out like Cellstore's Home so staff find modules in the same place.
export default function Home({ profile }: { profile: Profile | null }) {
  const tiles = HOME_TILES.filter((tile) => hasPermission(profile, tile.permission));

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 max-w-5xl">
      {tiles.map((tile) => (
        <Link
          key={tile.path}
          to={tile.path}
          className="aspect-square flex flex-col items-center justify-center gap-2 rounded-lg bg-[#2f6f9f] p-2 text-center text-white shadow-sm transition-colors hover:bg-[#265d86] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#93C5FD]"
        >
          <tile.icon className="w-7 h-7 md:w-8 md:h-8" />
          <span className="text-xs md:text-sm font-semibold leading-tight">{tile.label}</span>
        </Link>
      ))}
    </div>
  );
}
