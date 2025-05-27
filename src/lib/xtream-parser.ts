
'use server';
/**
 * @fileOverview Xtream Codes API interaction and parsing logic.
 */
import type { PlaylistItem } from '@/lib/constants';
import { FILE_PLAYLIST_ITEM_LIMIT } from '@/lib/constants';
import {
  extractChannelDetails,
  extractSeriesDetails, // Not directly used for get_series, but could be for get_series_info
  extractMovieYear,
  normalizeGroupTitle
} from '@/lib/m3u-parser';

const XTREAM_API_PATH = '/player_api.php';

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
  stream_type: 'movie';
  stream_id: number;
  stream_icon: string | null;
  added: string;
  category_id: string;
  container_extension: string;
  custom_sid: string | null;
  rating: string | number | null;
  rating_5based: number | null;
  direct_source: string;
  year?: string; // Typically a string from Xtream API
  plot?: string;
  cast?: string;
  director?: string;
  genre?: string; // Genre string, sometimes comma-separated
  duration_secs?: number;
  duration?: string;
  releaseDate?: string;
}

interface XtreamSeriesInfo {
  num: number;
  name: string;
  series_id: number;
  cover: string | null;
  plot: string | null;
  cast: string | null;
  director: string | null;
  genre: string | null; // Genre string, sometimes comma-separated
  releaseDate: string;
  last_modified: string;
  rating: string | number | null;
  rating_5based: number | null;
  backdrop_path: string[] | null;
  youtube_trailer: string | null;
  episode_run_time: string;
  category_id: string;
  // Season and episode data usually fetched with action=get_series_info&series_id=
  // For get_series, we get the series overview.
}


function normalizeXtreamHost(host: string): string {
  let normalizedHost = host.trim();
  if (!normalizedHost.startsWith('http://') && !normalizedHost.startsWith('https://')) {
    normalizedHost = `http://${normalizedHost}`;
  }
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
    // Use a proxy for the API call itself to avoid potential CORS issues on the client-side request if this were client-side
    // However, since this is 'use server', it runs on the server, so direct fetch is fine.
    // If this were ever moved to client-side, a proxy for player_api.php calls might be needed.
    const response = await fetch(fullUrl, {
        headers: { 'User-Agent': 'CatCakeFlix/1.0 (XtreamParser)'}
    });

    if (!response.ok) {
      // Try to get more details from the response if possible
      let errorBody = '';
      try {
        errorBody = await response.text();
      } catch (e) { /* ignore if can't read body */ }
      throw new Error(`Xtream API request failed for action ${action}: ${response.status} ${response.statusText}. Body: ${errorBody}`);
    }
    
    const textContent = await response.text();
    if (!textContent) {
        console.warn(`Xtream API: Empty response for action ${action}, URL: ${fullUrl}`);
        return [];
    }
    const data = JSON.parse(textContent);

    if (data && data.user_info && data.user_info.auth === 0) {
        throw new Error(`Xtream API authentication failed for action ${action}. Check credentials.`);
    }
    if (data === null || (typeof data === 'object' && !Array.isArray(data) && Object.keys(data).length === 0) ) {
        console.warn(`Xtream API: Null or empty object response for action ${action}, URL: ${fullUrl}`);
        return [];
    }
    return data;
  } catch (error) {
    console.error(`Error fetching Xtream action ${action} (URL: ${fullUrl}):`, error);
    throw error;
  }
}

export async function fetchXtreamPlaylistItems(
  playlistId: string,
  host: string,
  username: string,
  password?: string // Password can be optional for some Xtream setups
): Promise<PlaylistItem[]> {
  const normalizedHost = normalizeXtreamHost(host);
  const pwParam = password ? `&password=${encodeURIComponent(password)}` : '';
  const baseApiUrl = `${normalizedHost}${XTREAM_API_PATH}?username=${encodeURIComponent(username)}${pwParam}`;

  const allItems: PlaylistItem[] = [];
  const categoryMap = new Map<string, string>();

  try {
    const liveCategories: XtreamCategory[] = await fetchFromXtreamAPI(baseApiUrl, 'get_live_categories') || [];
    liveCategories.forEach(cat => categoryMap.set(cat.category_id, cat.category_name));

    const vodCategories: XtreamCategory[] = await fetchFromXtreamAPI(baseApiUrl, 'get_vod_categories') || [];
    vodCategories.forEach(cat => categoryMap.set(cat.category_id, cat.category_name));
    
    const seriesCategories: XtreamCategory[] = await fetchFromXtreamAPI(baseApiUrl, 'get_series_categories') || [];
    seriesCategories.forEach(cat => categoryMap.set(cat.category_id, cat.category_name));

    // Fetch Live Streams
    const liveStreams: XtreamLiveStream[] = await fetchFromXtreamAPI(baseApiUrl, 'get_live_streams') || [];
    for (const item of liveStreams) {
      if (allItems.length >= FILE_PLAYLIST_ITEM_LIMIT) break;
      
      const originalGroupName = categoryMap.get(item.category_id) || 'Live Channels';
      const { baseChannelName, quality } = extractChannelDetails(item.name);
      const normGroupTitle = normalizeGroupTitle(originalGroupName, 'channel');

      allItems.push({
        playlistDbId: playlistId,
        itemType: 'channel',
        title: item.name, 
        streamUrl: `${normalizedHost}/live/${username}/${password || ''}/${item.stream_id}.ts`,
        logoUrl: item.stream_icon || undefined,
        originalGroupTitle: originalGroupName,
        groupTitle: normGroupTitle,
        tvgId: item.epg_channel_id || item.stream_id.toString(),
        tvgName: item.name,
        baseChannelName: baseChannelName,
        quality: quality,
        genre: normGroupTitle,
      });
    }

    // Fetch VOD Streams (Movies)
    if (allItems.length < FILE_PLAYLIST_ITEM_LIMIT) {
      const vodStreams: XtreamVodStream[] = await fetchFromXtreamAPI(baseApiUrl, 'get_vod_streams') || [];
      for (const item of vodStreams) {
        if (allItems.length >= FILE_PLAYLIST_ITEM_LIMIT) break;

        const originalGroupName = categoryMap.get(item.category_id) || 'Movies';
        // Xtream API might provide 'year' as string, or 'releaseDate'. Prefer 'year' if number-like, else parse from 'releaseDate' or 'name'.
        let movieYearNum: number | undefined = item.year ? parseInt(item.year, 10) : undefined;
        if (isNaN(movieYearNum as number) && item.releaseDate) {
            movieYearNum = new Date(item.releaseDate).getFullYear();
        }
        if (isNaN(movieYearNum as number)) {
            movieYearNum = extractMovieYear(item.name);
        }
        const normGroupTitle = normalizeGroupTitle(originalGroupName, 'movie');
        // Xtream 'genre' for VOD is often a string, sometimes comma-separated. We take it as is for now.
        // The m3u-parser's normalizeGroupTitle used for `normGroupTitle` is often better for UI grouping.
        const itemGenre = item.genre || normGroupTitle;


        allItems.push({
          playlistDbId: playlistId,
          itemType: 'movie',
          title: item.name,
          streamUrl: `${normalizedHost}/movie/${username}/${password || ''}/${item.stream_id}.${item.container_extension || 'mp4'}`,
          logoUrl: item.stream_icon || undefined,
          originalGroupTitle: originalGroupName,
          groupTitle: normGroupTitle, 
          tvgId: item.stream_id.toString(),
          tvgName: item.name,
          year: isNaN(movieYearNum as number) ? undefined : movieYearNum,
          genre: itemGenre,
        });
      }
    }

    // Fetch Series (Series Overviews)
    if (allItems.length < FILE_PLAYLIST_ITEM_LIMIT) {
      const seriesList: XtreamSeriesInfo[] = await fetchFromXtreamAPI(baseApiUrl, 'get_series') || [];
      for (const item of seriesList) {
        if (allItems.length >= FILE_PLAYLIST_ITEM_LIMIT) break;
        
        const originalGroupName = categoryMap.get(item.category_id) || 'Series';
        let seriesYearNum: number | undefined = undefined;
        if (item.releaseDate) {
            const parsedYear = new Date(item.releaseDate).getFullYear();
            if (!isNaN(parsedYear)) seriesYearNum = parsedYear;
        }
        const normGroupTitle = normalizeGroupTitle(originalGroupName, 'series_episode'); // Use 'series_episode' type for group title normalization consistency
        const itemGenre = item.genre || normGroupTitle;

        allItems.push({
          playlistDbId: playlistId,
          itemType: 'series', // This represents a series overview
          title: item.name,
          streamUrl: `${normalizedHost}/series/${username}/${password || ''}/${item.series_id}`, // This is a symbolic URL, not directly playable as a single stream
          logoUrl: item.cover || undefined,
          originalGroupTitle: originalGroupName,
          groupTitle: normGroupTitle,
          tvgId: item.series_id.toString(),
          tvgName: item.name,
          seriesTitle: item.name, // For series type, seriesTitle is the main title
          genre: itemGenre,
          year: seriesYearNum,
          // seasonNumber and episodeNumber are not applicable for a series overview
        });
      }
    }
    
  } catch (error) {
    console.error("Failed to fetch or parse Xtream playlist items:", error);
    throw error; 
  }

  // The FILE_PLAYLIST_ITEM_LIMIT is checked within the loops.
  return allItems;
}
