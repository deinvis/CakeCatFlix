import type { LucideIcon } from 'lucide-react';
import { Tv2, Film, Clapperboard, Settings as SettingsIcon, History, Heart } from 'lucide-react';

export const APP_NAME = "CatCakeFlix";

interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_LINKS: NavLink[] = [
  { href: "/app/channels", label: "Canais", icon: Tv2 },
  { href: "/app/movies", label: "Filmes", icon: Film },
  { href: "/app/series", label: "Séries", icon: Clapperboard },
  { href: "/app/recentes", label: "Recentes", icon: History },
  { href: "/app/favoritos", label: "Favoritos", icon: Heart },
];

export const SETTINGS_NAV_LINK: NavLink = { href: "/app/settings", label: "Configurações", icon: SettingsIcon };

export const STARTUP_PAGES = [
  { value: "channels", label: "Canais" },
  { value: "movies", label: "Filmes" },
  { value: "series", label: "Séries" },
  { value: "recentes", label: "Recentes" },
  { value: "favoritos", label: "Favoritos" },
];

export const MOCK_PLAYLISTS = [
  { id: "1", name: "My Awesome IPTV" },
  { id: "2", name: "Movie Night Specials" },
  { id: "3", name: "Binge Watch Series" },
];

// Set to empty array to test "no playlists configured" state
// export const MOCK_PLAYLISTS = [];


export interface MockContentItem {
  id: string;
  title: string;
  imageUrl: string;
  dataAiHint: string;
}

export const MOCK_CONTENT_ITEMS = (count = 12, hint = "abstract scene"): MockContentItem[] => Array.from({ length: count }, (_, i) => ({
  id: `${hint.replace(/\s+/g, '-')}-${i + 1}`,
  title: `${hint.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} #${i + 1}`,
  imageUrl: `https://placehold.co/300x450.png`, // Aspect ratio 2:3 for posters
  dataAiHint: hint,
}));

export const MOCK_MOVIE_GENRES = ["Action", "Comedy", "Drama", "Sci-Fi", "Horror", "Thriller"];
export const MOCK_SERIES_GENRES = ["Animation", "Crime", "Documentary", "Fantasy", "Mystery", "Sitcom"];

// LocalStorage keys
export const LOCALSTORAGE_PLAYLISTS_KEY = 'catcakestream_playlists';
export const LOCALSTORAGE_STARTUP_PAGE_KEY = 'catcakestream_startup_page';
export const LOCALSTORAGE_THEME_KEY = 'catcakestream_theme';
export const LOCALSTORAGE_PARENTAL_CONTROL_KEY = 'catcakestream_parental_control_enabled';
