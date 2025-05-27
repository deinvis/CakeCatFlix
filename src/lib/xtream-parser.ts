
'use server';
/**
 * @fileOverview Xtream Codes API interaction and parsing logic.
 */
import type { PlaylistItemCore, PlaylistMetadata } from '@/lib/constants';

const XTREAM_API_PATH = '/player_api.php';
// Apply a limit to prevent fetching an overwhelming number of items from Xtream.
// This can be adjusted. It's a safeguard.
const XTREAM_ITEM_FETCH_LIMIT = 2000;


interface XtreamCategory {
  category_id: string;
  category_name: string;
  parent_id: number;
}

interface XtreamLiveStream {
  num: number;
  name: string;
  stream_type: 'live';
  stream_id: number;
  stream_icon: string | null;
  epg_channel_id: string | null;
  added: string;
  category_id: string;
  custom_sid: string | null;
  tv_archive: number;
  direct_source: string;
  tv_archive_duration: number;
}

interface XtreamVodStream {
  num: number;
  name: string;
  stream_type: 'movie'; // or 'series' if series are listed like VODs by some panels
  stream_id: number;
  stream_icon: string | null;
  added: string;
  category_id: string;
  container_extension: string;
  custom_sid: string | null;
  rating: string | number | null; // Can be string like "7.2" or number
  rating_5based: number | null;
  direct_source: string;
  // Movies might have releaseDate, plot, cast, director, genre, duration_secs, duration, etc.
  // For simplicity, we'll focus on core fields for PlaylistItemCore
  year?: string;
  plot?: string;
  cast?: string;
  director?: string;
  genre?: string;
  duration_secs?: number;
  duration?: string;
  releaseDate?: string; // Sometimes available
}

interface XtreamSeriesInfo {
  num: number; // Often not present directly in series list, but for consistency
  name: string;
  series_id: number; // Different from stream_id for episodes
  cover: string | null; // Equivalent to stream_icon
  plot: string | null;
  cast: string | null;
  director: string | null;
  genre: string | null;
  releaseDate: string; // Or release_date
  last_modified: string;
  rating: string | number | null;
  rating_5based: number | null;
  backdrop_path: string[] | null;
  youtube_trailer: string | null;
  episode_run_time: string;
  category_id: string;
  // Season and episode data usually fetched with action=get_series_info&series_id=
}


function normalizeXtreamHost(host: string): string {
  let normalizedHost = host.trim();
  if (!normalizedHost.startsWith('http://') && !normalizedHost.startsWith('https://')) {
    normalizedHost = `http://${normalizedHost}`;
  }
  // Remove trailing slash if present, before appending API path
  if (normalizedHost.endsWith('/')) {
    normalizedHost = normalizedHost.slice(0, -1);
  }
  return normalizedHost;
}

async function fetchFromXtreamAPI(
  baseApiUrl: string,
  action: string,
  params: Record<string, string> = {}
): Promise<any> {
  const urlParams = new URLSearchParams({ action, ...params });
  const fullUrl = `${baseApiUrl}&${urlParams.toString()}`;

  try {
    const response = await fetch(fullUrl);
    if (!response.ok) {
      throw new Error(`Xtream API request failed for action ${action}: ${response.status} ${response.statusText}`);
    }
    // Xtream APIs sometimes return empty body for "no content" which results in JSON parse error
    // or can return an object like {user_info: null, server_info: null} for auth failure
    const textContent = await response.text();
    if (!textContent) {
        return []; // Treat empty response as empty list
    }
    const data = JSON.parse(textContent);

    // Handle auth failure specifically for some panels
    if (data && data.user_info && data.user_info.auth === 0) {
        throw new Error(`Xtream API authentication failed for action ${action}. Check credentials.`);
    }
    // If data is an object but not an array (e.g. error object), or null
    if (data === null || (typeof data === 'object' && !Array.isArray(data) && Object.keys(data).length === 0) ) {
        return [];
    }


    return data;
  } catch (error) {
    console.error(`Error fetching Xtream action ${action}:`, error);
    throw error; // Re-throw to be caught by the caller
  }
}

export async function fetchXtreamPlaylistItems(
  playlistId: string,
  host: string,
  username: string,
  password: string
): Promise<PlaylistItemCore[]> {
  const normalizedHost = normalizeXtreamHost(host);
  const baseApiUrl = `${normalizedHost}${XTREAM_API_PATH}?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;

  const allItems: PlaylistItemCore[] = [];
  const categoryMap = new Map<string, string>();

  try {
    // Fetch Categories to map IDs to names
    const liveCategories: XtreamCategory[] = await fetchFromXtreamAPI(baseApiUrl, 'get_live_categories') || [];
    liveCategories.forEach(cat => categoryMap.set(cat.category_id, cat.category_name));

    const vodCategories: XtreamCategory[] = await fetchFromXtreamAPI(baseApiUrl, 'get_vod_categories') || [];
    vodCategories.forEach(cat => categoryMap.set(cat.category_id, cat.category_name));
    
    const seriesCategories: XtreamCategory[] = await fetchFromXtreamAPI(baseApiUrl, 'get_series_categories') || [];
    seriesCategories.forEach(cat => categoryMap.set(cat.category_id, cat.category_name));

    // Fetch Live Streams
    const liveStreams: XtreamLiveStream[] = await fetchFromXtreamAPI(baseApiUrl, 'get_live_streams') || [];
    for (const item of liveStreams) {
      if (allItems.length >= XTREAM_ITEM_FETCH_LIMIT) break;
      allItems.push({
        playlistDbId: playlistId,
        tvgId: item.epg_channel_id || item.stream_id.toString(),
        tvgName: item.name,
        tvgLogo: item.stream_icon || undefined,
        groupTitle: categoryMap.get(item.category_id) || 'Live Channels',
        displayName: item.name,
        url: `${normalizedHost}/live/${username}/${password}/${item.stream_id}.ts`, // .ts is common, .m3u8 might also be an option
        itemType: 'channel',
      });
    }

    // Fetch VOD Streams (Movies)
    if (allItems.length < XTREAM_ITEM_FETCH_LIMIT) {
      const vodStreams: XtreamVodStream[] = await fetchFromXtreamAPI(baseApiUrl, 'get_vod_streams') || [];
      for (const item of vodStreams) {
        if (allItems.length >= XTREAM_ITEM_FETCH_LIMIT) break;
        allItems.push({
          playlistDbId: playlistId,
          tvgId: item.stream_id.toString(),
          tvgName: item.name,
          tvgLogo: item.stream_icon || undefined,
          groupTitle: categoryMap.get(item.category_id) || 'Movies',
          displayName: item.name,
          url: `${normalizedHost}/movie/${username}/${password}/${item.stream_id}.${item.container_extension || 'mp4'}`,
          itemType: 'movie',
        });
      }
    }

    // Fetch Series
    if (allItems.length < XTREAM_ITEM_FETCH_LIMIT) {
      const seriesList: XtreamSeriesInfo[] = await fetchFromXtreamAPI(baseApiUrl, 'get_series') || [];
      for (const item of seriesList) {
        if (allItems.length >= XTREAM_ITEM_FETCH_LIMIT) break;
        // For series, the direct URL is not for playback of the whole series.
        // It's more of an identifier. Real playback requires fetching episodes.
        // For now, the URL can be symbolic or empty.
        const seriesStreamUrl = `${normalizedHost}/series/${username}/${password}/${item.series_id}`; // This isn't a playable stream but an identifier path

        allItems.push({
          playlistDbId: playlistId,
          tvgId: item.series_id.toString(),
          tvgName: item.name,
          tvgLogo: item.cover || undefined,
          groupTitle: categoryMap.get(item.category_id) || 'Series',
          displayName: item.name,
          url: seriesStreamUrl, // Placeholder-like URL, special handling needed by player
          itemType: 'series',
        });
      }
    }
    
  } catch (error) {
    console.error("Failed to fetch or parse Xtream playlist items:", error);
    // Re-throw the error so it can be caught in PlaylistManagement and shown to the user
    throw error;
  }

  return allItems.slice(0, XTREAM_ITEM_FETCH_LIMIT);
}
