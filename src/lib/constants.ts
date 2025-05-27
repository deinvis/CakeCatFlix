
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

// Interface for items parsed from M3U/Xtream, before DB insertion
// This is the common structure produced by the parsers.
export interface PlaylistItem {
  playlistDbId: string; // ID of the playlist this item belongs to
  itemType: 'channel' | 'movie' | 'series_episode' | 'series'; // 'series' type for series overview from Xtream

  title: string; // Primary display title (channel name, movie title, episode title, series title)
  streamUrl: string;
  logoUrl?: string;

  originalGroupTitle?: string; // group-title original from M3U or category from Xtream
  groupTitle?: string; // group-title NORMALIZED (used as genre for movies/series, category for channels)

  tvgId?: string; // tvg-id from M3U or stream_id/series_id from Xtream
  tvgName?: string; // tvg-name original from M3U or name from Xtream

  // Common fields, potentially derived
  genre?: string; // Normalized genre (often derived from groupTitle)
  year?: number; // For movies and potentially series (release year)

  // Channel specific
  baseChannelName?: string; // e.g., "ESPN" from "ESPN FHD"
  quality?: string; // e.g., "FHD"

  // Series specific (for 'series_episode' type from M3U, or for 'series' type from Xtream)
  seriesTitle?: string; // Title of the series itself
  seasonNumber?: number; // For 'series_episode'
  episodeNumber?: number; // For 'series_episode'
}


// DB Item Interfaces
export interface ChannelItem {
  id?: number; // Auto-incremented DB ID
  playlistDbId: string;
  title: string;
  streamUrl: string;
  logoUrl?: string;
  groupTitle?: string; // Normalized group title
  originalGroupTitle?: string;
  tvgId?: string;
  tvgName?: string;
  baseChannelName?: string;
  quality?: string;
}

export interface MovieItem {
  id?: number; // Auto-incremented DB ID
  playlistDbId: string;
  title: string;
  streamUrl: string;
  logoUrl?: string;
  groupTitle?: string; // Normalized, often used as genre
  originalGroupTitle?: string;
  tvgId?: string;
  tvgName?: string;
  genre?: string; // Normalized genre
  year?: number;
}

export interface SeriesItem {
  id?: number; // Auto-incremented DB ID for the series
  playlistDbId: string;
  title: string; // Title of the series
  logoUrl?: string;
  groupTitle?: string; // Normalized, often used as genre
  originalGroupTitle?: string;
  tvgId?: string; // Can be series_id from Xtream or a common tvg-id for the series from M3U
  genre?: string; // Normalized genre
  year?: number; // Release year of the series
}

export interface EpisodeItem {
  id?: number; // Auto-incremented DB ID for the episode
  playlistDbId: string;
  seriesDbId: number; // FK to SeriesItem.id
  title: string; // Title of the episode (e.g., "S01E01 - Pilot" or just "Pilot")
  streamUrl: string;
  logoUrl?: string; // Episode-specific thumbnail
  seasonNumber?: number;
  episodeNumber?: number;
  tvgId?: string; // Episode-specific tvg-id from M3U if available
}


// Interface for what the ContentCard expects
export interface ContentItemForCard {
  id: string; // Unique ID for the card (can be baseChannelName for channels, MovieItem.id for movies, SeriesItem.id for series)
  title: string;
  imageUrl?: string;
  type: 'movie' | 'series' | 'channel';
  genre?: string;
  dataAiHint: string;
  streamUrl?: string; // May not be directly playable for aggregated channels/series

  qualities?: string[]; // For aggregated channels
  sourceCount?: number; // For aggregated channels (sources/qualities) or series (episode count)

  seriesId?: string; // Should be the SeriesItem.id (as string) for navigation to series player
  year?: number; // Movie or Series year
}

// Interface for what the VideoPlayer component expects
export interface MediaItemForPlayer {
  id: string | number; // Unique ID of the content being played (movie id, series id + episode key, channel name + stream url)
  streamUrl: string | null;
  itemTitle?: string; // Display title for the player
  itemType?: 'channel' | 'movie' | 'series_episode'; // Type of content, 'series_episode' for series playback
  posterUrl?: string;
}


// Detalhes da fonte da Playlist
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

  itemCount?: number;         // Total raw items parsed from source
  channelCount?: number;    // Count of unique ChannelItem stored
  movieCount?: number;      // Count of unique MovieItem stored
  seriesCount?: number;     // Count of unique SeriesItem stored
  episodeCount?: number;    // Count of unique EpisodeItem stored (sum of all episodes for all series)

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
export const DB_VERSION = 5; // Incremented due to potential new indices or store changes
export const PLAYLIST_METADATA_STORE = 'playlists';

export const CHANNELS_STORE = 'channels';
export const MOVIES_STORE = 'movies';
export const SERIES_STORE = 'series';
export const EPISODES_STORE = 'episodes';

export const LEGACY_PLAYLIST_ITEMS_STORE = 'playlistItems'; // Name of the old flat store

// Set to a very large number to effectively remove the limit for M3U file processing.
// Browser/system memory will be the practical limit.
export const FILE_PLAYLIST_ITEM_LIMIT = Number.MAX_SAFE_INTEGER;

// Auto-refresh settings
export const REFRESH_INTERVAL_MINUTES = 60;
export const REFRESH_APP_OPEN_TRIGGER_COUNT = 3;
