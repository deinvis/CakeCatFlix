
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

// This interface is for what ContentCard expects, and will need to be adapted from PlaylistItem
export interface ContentItemForCard {
  id: string; // Needs to be string for ContentCard key and link construction (usually PlaylistItem.id.toString())
  title: string; // Could be PlaylistItem.title, PlaylistItem.seriesTitle (for series card), or PlaylistItem.baseChannelName (for channel card)
  imageUrl?: string; // logoUrl
  type: 'movie' | 'series' | 'channel'; // Derived from itemType, or a broader category for display
  genre?: string; // groupTitle or refined genre
  dataAiHint: string;
  streamUrl?: string; // Main stream URL or representative URL
  // For aggregated channels
  qualities?: string[]; 
  sourceCount?: number;
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
  password?: string; // Optional, as some Xtream setups might not require it or it's part of host
}
export type PlaylistSourceDetails = PlaylistSourceDetailsFile | PlaylistSourceDetailsUrl | PlaylistSourceDetailsXtream;


export interface PlaylistMetadata {
  id: string; // Unique ID for the playlist
  name: string;
  sourceType: 'file' | 'url' | 'xtream';
  sourceDetails: PlaylistSourceDetails; // Replaces sourceValue, more structured
  
  itemCount?: number;
  channelCount?: number;
  movieCount?: number;
  seriesCount?: number; // Counts series titles, not episodes
  seriesEpisodeCount?: number; // Counts individual series_episode items

  status?: 'pending' | 'processing' | 'completed' | 'failed'; // statusDoProcessamento
  statusMessage?: string;

  createdAt: number; // data de adição
  lastUpdatedAt?: number; // data da última atualização (tentativa)
  lastSuccessfulUpdateAt?: number; // data da última atualização bem-sucedida
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
export const LOCALSTORAGE_LAST_REFRESH_ATTEMPT_KEY_PREFIX = 'catcakeflix_last_refresh_'; // Append playlist ID

// IndexedDB constants
export const DB_NAME = 'CatCakeFlixDB'; // Updated DB Name
export const DB_VERSION = 2; // Increment version due to schema changes
export const PLAYLIST_METADATA_STORE = 'playlists';
export const PLAYLIST_ITEMS_STORE = 'playlistItems';

export const FILE_PLAYLIST_ITEM_LIMIT = 2000; // Updated limit

// Auto-refresh settings
export const REFRESH_INTERVAL_MINUTES = 60; // 1 hour
export const REFRESH_APP_OPEN_TRIGGER_COUNT = 3;
