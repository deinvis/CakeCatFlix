
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

// This is the generic interface returned by the M3U parser
export interface PlaylistItem {
  id?: number; // May not be needed for parser output if DB assigns it
  playlistDbId: string; 

  itemType: PlaylistItemType;
  title: string; 
  streamUrl: string;
  logoUrl?: string; 
  
  groupTitle?: string; 
  originalGroupTitle?: string; 

  tvgId?: string;
  tvgName?: string; 

  genre?: string; 
  year?: number; 

  // Channel specific
  baseChannelName?: string; 
  quality?: string; 

  // Series specific (extracted from episode context)
  seriesTitle?: string; 
  seasonNumber?: number;
  episodeNumber?: number;
}

// Specific item types for normalized DB stores
export interface ChannelItem {
  id?: number; // Auto-incrementing primary key
  playlistDbId: string;
  title: string;
  streamUrl: string;
  logoUrl?: string;
  groupTitle?: string;
  originalGroupTitle?: string;
  tvgId?: string;
  tvgName?: string;
  baseChannelName?: string;
  quality?: string;
}

export interface MovieItem {
  id?: number; // Auto-incrementing primary key
  playlistDbId: string;
  title: string;
  streamUrl: string;
  logoUrl?: string;
  groupTitle?: string;
  originalGroupTitle?: string;
  tvgId?: string;
  tvgName?: string;
  genre?: string;
  year?: number;
}

export interface SeriesItem {
  id?: number; // Auto-incrementing primary key for the series itself
  playlistDbId: string;
  title: string; // Series title
  logoUrl?: string; // Series cover art
  groupTitle?: string; // Genre for the series
  originalGroupTitle?: string;
  tvgId?: string; // Series tvg-id (if available)
  genre?: string;
  year?: number; // Year series started
  // Potentially add other series-specific metadata here like plot, cast, etc.
}

export interface EpisodeItem {
  id?: number; // Auto-incrementing primary key for the episode
  playlistDbId: string;
  seriesDbId: number; // Foreign key to SeriesItem.id
  title: string; // Episode title (e.g., "S01E01 - Pilot")
  streamUrl: string;
  logoUrl?: string; // Episode-specific logo, or inherit from series
  seasonNumber?: number;
  episodeNumber?: number;
  tvgId?: string; // Episode-specific tvg-id (if available)
  // Potentially add other episode-specific metadata here like plot, airDate, etc.
}


// This interface is for what ContentCard expects
// Will need review after DB normalization
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
  sourceCount?: number; 
  // For series cards
  seriesId?: string; // This could be the SeriesItem.id from the DB
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
  
  itemCount?: number; // Total items initially parsed
  channelCount?: number;
  movieCount?: number;
  seriesCount?: number; // Count of unique series titles
  episodeCount?: number; // Count of individual episodes

  status?: 'pending' | 'processing' | 'completed' | 'failed'; 
  statusMessage?: string;

  createdAt: number; 
  lastUpdatedAt?: number; 
  lastSuccessfulUpdateAt?: number; 
}


export const MOCK_CONTENT_ITEMS = (count = 12, hint = "abstract scene"): ContentItemForCard[] => Array.from({ length: count }, (_, i) => ({
  id: `${hint.replace(/\s+/g, '-')}-${i + 1}`,
  title: `${hint.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} #${i + 1}`,
  imageUrl: `https://placehold.co/300x450.png`,
  dataAiHint: hint,
  type: 'movie', 
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
export const DB_VERSION = 4; // Incremented DB_VERSION for schema change
export const PLAYLIST_METADATA_STORE = 'playlists';

// New store names
export const CHANNELS_STORE = 'channels';
export const MOVIES_STORE = 'movies';
export const SERIES_STORE = 'series';
export const EPISODES_STORE = 'episodes';

// Old store name (to be removed)
export const LEGACY_PLAYLIST_ITEMS_STORE = 'playlistItems';


export const FILE_PLAYLIST_ITEM_LIMIT = 50; 

// Auto-refresh settings
export const REFRESH_INTERVAL_MINUTES = 60; 
export const REFRESH_APP_OPEN_TRIGGER_COUNT = 3;
