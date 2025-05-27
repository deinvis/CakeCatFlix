
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

// Generic interface for items parsed from M3U before normalization
export interface PlaylistItem {
  playlistDbId: string; // Will be assigned when storing
  itemType: 'channel' | 'movie' | 'series_episode'; // Type inferred by parser
  
  title: string; // Typically tvg-name or the title after the last comma in #EXTINF
  streamUrl: string;
  logoUrl?: string; // From tvg-logo
  
  originalGroupTitle?: string; // Raw group-title from M3U
  groupTitle?: string; // Normalized group title (used as genre for movies/series)

  tvgId?: string;
  tvgName?: string; // Raw tvg-name
  
  // Common fields, might be populated based on itemType and parsing
  genre?: string; // Usually derived from normalized groupTitle
  year?: number; // For movies

  // Channel specific
  baseChannelName?: string; // e.g., "ESPN" from "ESPN FHD"
  quality?: string; // e.g., "FHD"

  // Series specific (for series_episode type)
  seriesTitle?: string; // Title of the series itself
  seasonNumber?: number;
  episodeNumber?: number;
}


// Specific item types for normalized DB stores
export interface ChannelItem {
  id?: number; // Auto-incrementing primary key
  playlistDbId: string;
  title: string; // This is usually the full channel name including quality, e.g., "ESPN FHD"
  streamUrl: string;
  logoUrl?: string;
  groupTitle?: string; // Normalized group title
  originalGroupTitle?: string;
  tvgId?: string;
  tvgName?: string; // Raw tvg-name
  baseChannelName?: string; // e.g., "ESPN"
  quality?: string; // e.g., "FHD"
}

export interface MovieItem {
  id?: number; // Auto-incrementing primary key
  playlistDbId: string;
  title: string; // Movie title, year might be part of it or in 'year' field
  streamUrl: string;
  logoUrl?: string;
  groupTitle?: string; // Normalized, often used as genre
  originalGroupTitle?: string;
  tvgId?: string;
  tvgName?: string; // Raw tvg-name
  genre?: string; // Normalized genre
  year?: number;
}

export interface SeriesItem {
  id?: number; // Auto-incrementing primary key for the series itself
  playlistDbId: string;
  title: string; // Series title, e.g., "Breaking Bad"
  logoUrl?: string; // Series cover art
  groupTitle?: string; // Normalized, often used as genre
  originalGroupTitle?: string;
  tvgId?: string; // Series tvg-id (if available)
  genre?: string; // Normalized genre
  year?: number; // Year series started
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
}


// This interface is for what ContentCard expects
export interface ContentItemForCard {
  id: string; 
  title: string; 
  imageUrl?: string; 
  type: 'movie' | 'series' | 'channel'; 
  genre?: string; 
  dataAiHint: string;
  streamUrl?: string; // For direct play movies or single-source channels
  
  // For aggregated channels
  qualities?: string[]; 
  sourceCount?: number; // Count of different playlists or quality variants for a channel
  
  // For series cards
  seriesId?: string; // This should be the SeriesItem.id from the DB
}

// Playlist Source Details
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
  
  itemCount?: number; // Total items initially parsed from M3U
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
export const DB_VERSION = 5; // Incremented for new index in series player
export const PLAYLIST_METADATA_STORE = 'playlists';

export const CHANNELS_STORE = 'channels';
export const MOVIES_STORE = 'movies';
export const SERIES_STORE = 'series';
export const EPISODES_STORE = 'episodes';

export const LEGACY_PLAYLIST_ITEMS_STORE = 'playlistItems'; // Name of the old, single store

export const FILE_PLAYLIST_ITEM_LIMIT = 5000; 

// Auto-refresh settings
export const REFRESH_INTERVAL_MINUTES = 60; 
export const REFRESH_APP_OPEN_TRIGGER_COUNT = 3;
