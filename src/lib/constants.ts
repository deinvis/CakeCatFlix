
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

export type PlaylistItemType = 'channel' | 'movie' | 'series_episode';

export interface PlaylistItem {
  id?: number; // Auto-incrementing primary key from IndexedDB
  playlistDbId: string; // Foreign key to the playlist's ID

  itemType: PlaylistItemType;
  title: string; // Original title from M3U (e.g., full episode title or movie title)
  streamUrl: string;
  logoUrl?: string; // tvg-logo
  
  groupTitle?: string; // Normalized group title (genre/category)
  originalGroupTitle?: string; // Raw group-title from M3U

  tvgId?: string;
  tvgName?: string; // Often the same as title, or a variation

  genre?: string; // Extracted/normalized genre, could be same as groupTitle or refined

  // Channel specific
  baseChannelName?: string; // e.g., "ESPN" from "ESPN FHD"
  quality?: string; // e.g., "FHD", "HD", "SD"

  // Series specific
  seriesTitle?: string; // e.g., "My Awesome Show"
  seasonNumber?: number;
  episodeNumber?: number;
}

// This interface is for what ContentCard expects
export interface ContentItemForCard {
  id: string; 
  title: string; 
  imageUrl?: string; 
  type: 'movie' | 'series' | 'channel'; 
  genre?: string; 
  dataAiHint: string;
  streamUrl?: string; 
  
  // For aggregated channels
  qualities?: string[]; 
  sourceCount?: number; // Number of original streams for an aggregated channel
  // For series cards (representing the whole series, not an episode)
  seriesId?: string; // Could be PlaylistItem.tvgId or a derived series ID
}

export interface PlaylistSourceDetailsFile {
  type: 'file';
  fileName: string;
}
export interface PlaylistSourceDetailsUrl {
  type: 'url';
  url: string;
}
export interface PlaylistSourceDetailsXtream {
  type: 'xtream';
  host: string;
  username: string;
  password?: string; 
}
export type PlaylistSourceDetails = PlaylistSourceDetailsFile | PlaylistSourceDetailsUrl | PlaylistSourceDetailsXtream;


export interface PlaylistMetadata {
  id: string; 
  name: string;
  sourceType: 'file' | 'url' | 'xtream';
  sourceDetails: PlaylistSourceDetails; 
  
  itemCount?: number;
  channelCount?: number;
  movieCount?: number;
  seriesCount?: number; 
  seriesEpisodeCount?: number; 

  status?: 'pending' | 'processing' | 'completed' | 'failed'; 
  statusMessage?: string;

  createdAt: number; 
  lastUpdatedAt?: number; 
  lastSuccessfulUpdateAt?: number; 
}


// MOCK_CONTENT_ITEMS will be replaced by DB queries.
export const MOCK_CONTENT_ITEMS = (count = 12, hint = "abstract scene"): ContentItemForCard[] => Array.from({ length: count }, (_, i) => ({
  id: `${hint.replace(/\s+/g, '-')}-${i + 1}`,
  title: `${hint.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} #${i + 1}`,
  imageUrl: `https://placehold.co/300x450.png`,
  dataAiHint: hint,
  type: 'movie', // Default type for mock
}));

export const MOCK_MOVIE_GENRES = ["Action", "Comedy", "Drama", "Sci-Fi", "Horror", "Thriller"];
export const MOCK_SERIES_GENRES = ["Animation", "Crime", "Documentary", "Fantasy", "Mystery", "Sitcom"];

// LocalStorage keys
export const LOCALSTORAGE_STARTUP_PAGE_KEY = 'catcakeflix_startup_page';
export const LOCALSTORAGE_THEME_KEY = 'catcakeflix_theme';
export const LOCALSTORAGE_PARENTAL_CONTROL_KEY = 'catcakeflix_parental_control_enabled';
export const LOCALSTORAGE_APP_OPEN_COUNT_KEY = 'catcakeflix_app_open_count';
export const LOCALSTORAGE_LAST_REFRESH_ATTEMPT_KEY_PREFIX = 'catcakeflix_last_refresh_'; 

// IndexedDB constants
export const DB_NAME = 'CatCakeFlixDB'; 
export const DB_VERSION = 2; 
export const PLAYLIST_METADATA_STORE = 'playlists';
export const PLAYLIST_ITEMS_STORE = 'playlistItems';

export const FILE_PLAYLIST_ITEM_LIMIT = 50; 

// Auto-refresh settings
export const REFRESH_INTERVAL_MINUTES = 60; 
export const REFRESH_APP_OPEN_TRIGGER_COUNT = 3;
