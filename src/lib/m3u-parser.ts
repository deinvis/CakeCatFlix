
import type { PlaylistItem, PlaylistItemType } from '@/lib/constants';

/**
 * Extracts base channel name and quality from a channel title.
 * Example: "ESPN HD" -> { baseChannelName: "ESPN", quality: "HD" }
 * Example: "HBO 2 4K" -> { baseChannelName: "HBO 2", quality: "4K" }
 * Example: "Discovery" -> { baseChannelName: "Discovery", quality: undefined }
 */
export function extractChannelDetails(name: string): { baseChannelName: string; quality?: string } {
  const qualityPatterns = /\s+(4K|UHD|FHD|HD|SD|1080P|720P|HEVC)(\s+\(.*\)|$)/i;
  const match = name.match(qualityPatterns);
  let baseChannelName = name;
  let quality;

  if (match) {
    quality = match[1].toUpperCase();
    baseChannelName = name.substring(0, match.index).trim();
  }
  
  if (baseChannelName === '' && name.includes(quality || '')) {
      baseChannelName = name.replace(quality || '', '').trim();
  }
  if (baseChannelName === '') baseChannelName = name; 

  return { baseChannelName, quality };
}

/**
 * Extracts series title, season, and episode number from a title.
 * Example: "Batalha das Solteiras S01E06" -> { seriesTitle: "Batalha das Solteiras", seasonNumber: 1, episodeNumber: 6 }
 */
export function extractSeriesDetails(title: string): { seriesTitle: string; seasonNumber?: number; episodeNumber?: number } {
  const seriesPattern = /^(.*?)(?:s(\d{1,2})e(\d{1,2})|season\s*(\d{1,2})\s*episode\s*(\d{1,2})|\s-\sS(\d{1,2})\sE(\d{1,2}))(?:\s*-\s*(.*)|$|\s*:?\s*(.*))/i;
  const match = title.match(seriesPattern);

  if (match) {
    const seriesTitle = (match[1] || '').trim();
    const seasonNumber = parseInt(match[2] || match[4] || match[6], 10);
    const episodeNumber = parseInt(match[3] || match[5] || match[7], 10);
    
    return {
      seriesTitle: seriesTitle || title.split(/s\d{1,2}e\d{1,2}/i)[0].trim() || title,
      seasonNumber: isNaN(seasonNumber) ? undefined : seasonNumber,
      episodeNumber: isNaN(episodeNumber) ? undefined : episodeNumber,
    };
  }
  // If no SxxExx pattern, it might be a movie mistaken for a series, or series title without episode info
  return { seriesTitle: title };
}

/**
 * Extracts year from a movie title if present in (YYYY) format.
 * Example: "10 Coisas Que Eu Odeio em Você (1999)" -> 1999
 */
export function extractMovieYear(title: string): number | undefined {
    const yearPattern = /\((\d{4})\)/;
    const match = title.match(yearPattern);
    if (match && match[1]) {
        return parseInt(match[1], 10);
    }
    return undefined;
}


/**
 * Normalizes group titles.
 * - Removes "|" and extra spaces
 * - Converts to uppercase
 * - Specific prefixes for item types:
 *   - Channels: Prefixes with "CANAIS " if not already present.
 *   - Movies: Removes "FILMES ", "MOVIES ", "FILME " prefixes.
 *   - Series: Removes "SERIES ", "SERIE ", "TV SHOWS " prefixes.
 */
export function normalizeGroupTitle(rawGroupTitle: string | undefined, itemType?: PlaylistItemType): string | undefined {
  if (!rawGroupTitle) return undefined;

  let normalized = rawGroupTitle.replace(/\|/g, ' ').replace(/\s+/g, ' ').toUpperCase().trim();

  if (itemType === 'channel') {
    if (!normalized.startsWith('CANAIS ') && !normalized.startsWith('CANAL ')) {
      normalized = `CANAIS ${normalized}`;
    }
  } else if (itemType === 'movie') {
    normalized = normalized.replace(/^(FILMES|MOVIES|FILME)\s*/i, '').trim();
  } else if (itemType === 'series_episode') {
    normalized = normalized.replace(/^(SERIES|SERIE|TV SHOWS)\s*/i, '').trim();
  }
  return normalized;
}

/**
 * Parses M3U content string into a list of structured playlist items.
 * @param m3uString The M3U content as a string.
 * @param playlistDbId The ID of the playlist this item belongs to.
 * @param limit Optional limit on the number of items to parse.
 * @returns An array of PlaylistItem.
 */
export function parseM3U(m3uString: string, playlistDbId: string, limit?: number): PlaylistItem[] {
  const lines = m3uString.split(/\r?\n/);
  const items: PlaylistItem[] = [];
  let currentRawAttributes: Record<string, string> = {};
  let currentTitleLine: string = '';

  for (const line of lines) {
    if (limit && items.length >= limit) break;

    const trimmedLine = line.trim();

    if (trimmedLine.startsWith('#EXTINF:')) {
      currentRawAttributes = {};
      const info = trimmedLine.substring(8); 
      const commaIndex = info.lastIndexOf(',');
      
      const attributesString = info.substring(0, commaIndex);
      currentTitleLine = info.substring(commaIndex + 1).trim();

      const attributeRegex = /([a-zA-Z0-9\-]+)="([^"]*)"/g;
      let match;
      while ((match = attributeRegex.exec(attributesString)) !== null) {
        currentRawAttributes[match[1].toLowerCase()] = match[2];
      }
    } else if (trimmedLine && !trimmedLine.startsWith('#')) {
      const streamUrl = trimmedLine;
      const m3uTitle = currentTitleLine; // Title after the comma in #EXTINF
      const tvgName = currentRawAttributes['tvg-name'] || m3uTitle; // Prefer tvg-name, fallback to M3U title
      const originalGroupTitle = currentRawAttributes['group-title'];
      const lowerUrl = streamUrl.toLowerCase();
      const lowerTvgName = tvgName.toLowerCase();
      const lowerGroupTitle = originalGroupTitle?.toLowerCase() || '';

      let itemType: PlaylistItemType | undefined = undefined;

      // 1. Determine Item Type based on new rules
      if (lowerUrl.endsWith('.ts') || lowerGroupTitle.includes('canal') || lowerTvgName.includes('24h')) {
        itemType = 'channel';
      } else if (lowerUrl.endsWith('.mp4')) { // Common for movies and series episodes
        if (lowerTvgName.match(/s\d{1,2}e\d{1,2}/i) || lowerGroupTitle.includes('serie')) {
          itemType = 'series_episode';
        } else if (lowerGroupTitle.includes('filme')) {
          itemType = 'movie';
        }
      }
      // Fallback if still undefined (e.g. .mkv, .avi, or other M3U formats)
      if (!itemType) {
        if (lowerTvgName.match(/s\d{1,2}e\d{1,2}/i) || lowerGroupTitle.includes('serie')) {
            itemType = 'series_episode';
        } else if (lowerGroupTitle.includes('filme')) {
            itemType = 'movie';
        } else if (lowerGroupTitle.includes('canal') || lowerTvgName.includes('24h')) {
            itemType = 'channel';
        } else {
            // Default or further heuristics can be added. For now, skip if type is truly unknown.
            // Or default to 'channel' if it has a group title, 'movie' if not.
            itemType = originalGroupTitle ? 'channel' : 'movie'; // A somewhat arbitrary fallback
        }
      }


      const item: Partial<PlaylistItem> = {
        playlistDbId,
        title: tvgName, // Use tvg-name as the primary title, or m3u title if tvg-name is missing
        streamUrl,
        logoUrl: currentRawAttributes['tvg-logo'],
        originalGroupTitle: originalGroupTitle,
        tvgId: currentRawAttributes['tvg-id'],
        tvgName: currentRawAttributes['tvg-name'], // Storing raw tvg-name
        itemType,
      };
      
      item.groupTitle = normalizeGroupTitle(originalGroupTitle, item.itemType);

      if (item.itemType === 'channel') {
        const { baseChannelName, quality } = extractChannelDetails(tvgName);
        item.baseChannelName = baseChannelName;
        item.quality = quality;
        item.genre = item.groupTitle; // For channels, genre can be the group
      } else if (item.itemType === 'series_episode') {
        const { seriesTitle, seasonNumber, episodeNumber } = extractSeriesDetails(tvgName);
        item.seriesTitle = seriesTitle;
        item.seasonNumber = seasonNumber;
        item.episodeNumber = episodeNumber;
        // item.title remains tvgName (which is already episode specific like "Batalha das Solteiras S01E06")
        item.genre = item.groupTitle; // For series, genre can be the group title
      } else if (item.itemType === 'movie') {
        item.year = extractMovieYear(tvgName);
        item.genre = item.groupTitle; // For movies, genre can be the group title
      }
      
      if (item.streamUrl && item.title && item.itemType) {
        items.push(item as PlaylistItem);
      }

      currentRawAttributes = {};
      currentTitleLine = '';
    }
  }
  return items;
}
