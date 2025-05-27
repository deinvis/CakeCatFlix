
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

// This MOCK_PLAYLISTS is now for UI testing if DB is empty or for fallback.
// Actual playlist metadata will be in IndexedDB.
export const MOCK_PLAYLISTS_INITIAL_FOR_DEMO_ONLY = [
  { id: "1", name: "My Awesome IPTV" },
  { id: "2", name: "Movie Night Specials" },
  { id: "3", name: "Binge Watch Series" },
];

export interface PlaylistItemCore {
  id?: number; // Auto-incrementing primary key from IndexedDB
  playlistDbId: string; // Foreign key to the playlist's ID
  tvgId?: string;
  tvgName?: string;
  tvgLogo?: string;
  groupTitle?: string;
  displayName: string;
  url: string;
  itemType: 'channel' | 'movie' | 'series' | 'unknown';
}

// This interface is for what ContentCard expects, adapted from PlaylistItemCore
export interface ContentItemForCard {
  id: string; // Needs to be string for ContentCard key and link construction
  title: string;
  imageUrl?: string; // tvgLogo
  type: 'movie' | 'series' | 'channel'; // Derived from itemType
  genre?: string; // groupTitle
  dataAiHint: string; // Will need to be generated or defaulted
  streamUrl?: string; // url from PlaylistItemCore
}


// MOCK_CONTENT_ITEMS will be replaced by DB queries.
// It can be kept for placeholder generation logic if needed.
export const MOCK_CONTENT_ITEMS = (count = 12, hint = "abstract scene"): ContentItemForCard[] => Array.from({ length: count }, (_, i) => ({
  id: `${hint.replace(/\s+/g, '-')}-${i + 1}`,
  title: `${hint.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} #${i + 1}`,
  imageUrl: `https://placehold.co/300x450.png`,
  dataAiHint: hint,
  type: 'movie', // Default type for mock
}));

export const MOCK_MOVIE_GENRES = ["Action", "Comedy", "Drama", "Sci-Fi", "Horror", "Thriller"];
export const MOCK_SERIES_GENRES = ["Animation", "Crime", "Documentary", "Fantasy", "Mystery", "Sitcom"];

// LocalStorage keys (some might be deprecated or work alongside IndexedDB)
export const LOCALSTORAGE_PLAYLISTS_KEY_DEPRECATED = 'catcakestream_playlists_deprecated'; // Mark as deprecated
export const LOCALSTORAGE_STARTUP_PAGE_KEY = 'catcakestream_startup_page';
export const LOCALSTORAGE_THEME_KEY = 'catcakestream_theme';
export const LOCALSTORAGE_PARENTAL_CONTROL_KEY = 'catcakestream_parental_control_enabled';

// IndexedDB constants
export const DB_NAME = 'CatCakeStreamDB';
export const DB_VERSION = 1;
export const PLAYLIST_METADATA_STORE = 'playlists';
export const PLAYLIST_ITEMS_STORE = 'playlistItems';

export const FILE_PLAYLIST_ITEM_LIMIT = 50;

    