
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

// Interface para os itens brutos retornados pelo parser M3U
export interface PlaylistItem {
  playlistDbId: string;
  itemType: 'channel' | 'movie' | 'series_episode';
  
  title: string; // Título principal do item (nome do canal, nome do episódio de série, nome do filme)
  streamUrl: string;
  logoUrl?: string;
  
  originalGroupTitle?: string; // group-title original do M3U
  groupTitle?: string; // group-title normalizado (usado como gênero para filmes/séries)

  tvgId?: string;
  tvgName?: string; // tvg-name original do M3U
  
  genre?: string; // Gênero normalizado (derivado de groupTitle)
  year?: number; // Para filmes

  // Channel specific
  baseChannelName?: string; // e.g., "ESPN" from "ESPN FHD"
  quality?: string; // e.g., "FHD"

  // Series specific (para series_episode type)
  seriesTitle?: string; // Título da série em si
  seasonNumber?: number;
  episodeNumber?: number;
}


// Interfaces para os itens normalizados no DB
export interface ChannelItem {
  id?: number;
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
  id?: number;
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
  id?: number; // ID da série no banco
  playlistDbId: string;
  title: string; // Título da série
  logoUrl?: string;
  groupTitle?: string; // Normalized, often used as genre
  originalGroupTitle?: string;
  tvgId?: string;
  genre?: string; // Normalized genre
  year?: number;
}

export interface EpisodeItem {
  id?: number; // ID do episódio no banco
  playlistDbId: string;
  seriesDbId: number; // FK para SeriesItem.id
  title: string; // Título do episódio (ex: "S01E01 - Pilot")
  streamUrl: string;
  logoUrl?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  tvgId?: string;
}


// Interface para o que o ContentCard espera
export interface ContentItemForCard {
  id: string; // ID único para o card (pode ser baseChannelName para canais, MovieItem.id para filmes, SeriesItem.id para séries)
  title: string; 
  imageUrl?: string; 
  type: 'movie' | 'series' | 'channel'; 
  genre?: string; 
  dataAiHint: string;
  streamUrl?: string;
  
  qualities?: string[]; 
  sourceCount?: number;
  
  seriesId?: string; // Deve ser o SeriesItem.id para navegação
}

// Interface para o que o VideoPlayer espera
export interface MediaItemForPlayer {
  id: string | number;
  streamUrl: string | null;
  title?: string;
  type?: 'channel' | 'movie' | 'series_episode';
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
  
  itemCount?: number;
  channelCount?: number;
  movieCount?: number;
  seriesCount?: number; 
  episodeCount?: number;

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
export const DB_VERSION = 5; 
export const PLAYLIST_METADATA_STORE = 'playlists';

export const CHANNELS_STORE = 'channels';
export const MOVIES_STORE = 'movies';
export const SERIES_STORE = 'series';
export const EPISODES_STORE = 'episodes';

export const LEGACY_PLAYLIST_ITEMS_STORE = 'playlistItems';

// Set to a very large number to effectively remove the limit for M3U file processing.
// Browser/system memory will be the practical limit.
export const FILE_PLAYLIST_ITEM_LIMIT = Number.MAX_SAFE_INTEGER; 

// Auto-refresh settings
export const REFRESH_INTERVAL_MINUTES = 60; 
export const REFRESH_APP_OPEN_TRIGGER_COUNT = 3;
