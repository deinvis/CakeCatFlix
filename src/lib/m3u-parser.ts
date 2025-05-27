
import type { PlaylistItem, PlaylistItemType } from '@/lib/constants';

/**
 * Extracts base channel name and quality from a channel title.
 * Example: "ESPN FHD" -> { baseChannelName: "ESPN", quality: "FHD" }
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
    // Remove the quality and any subsequent parenthesized text from the base name
    baseChannelName = name.substring(0, match.index).trim();
  }
  
  // Ensure "Channel Name 2" doesn't become just "2" if quality is at the end.
  // The regex should handle most cases, but this is a fallback.
  if (baseChannelName === '' && name.includes(quality || '')) {
      baseChannelName = name.replace(quality || '', '').trim();
  }
  if (baseChannelName === '') baseChannelName = name; // if all else fails


  return { baseChannelName, quality };
}

/**
 * Extracts series title, season, and episode number from a title.
 * Example: "The Simpsons S01E02 - Episode Name" -> { seriesTitle: "The Simpsons", seasonNumber: 1, episodeNumber: 2, episodeTitle: "Episode Name" }
 * Example: "Loki S01 E03" -> { seriesTitle: "Loki", seasonNumber: 1, episodeNumber: 3, episodeTitle: "Loki S01 E03" }
 */
export function extractSeriesDetails(title: string): { seriesTitle: string; seasonNumber?: number; episodeNumber?: number; episodeTitle: string } {
  // Regex to capture Series Title, SxxExx pattern, and optional episode title part
  // Supports "S01E01", "S1E1", "Season 1 Episode 1", "S01 E01"
  const seriesPattern = /^(.*?)(?:s(\d{1,2})e(\d{1,2})|season\s*(\d{1,2})\s*episode\s*(\d{1,2})|\s-\sS(\d{1,2})\sE(\d{1,2}))(?:\s*-\s*(.*)|$|\s*:?\s*(.*))/i;
  const match = title.match(seriesPattern);

  if (match) {
    const seriesTitle = (match[1] || '').trim();
    const seasonNumber = parseInt(match[2] || match[4] || match[6], 10);
    const episodeNumber = parseInt(match[3] || match[5] || match[7], 10);
    // Episode title could be after " - " or if nothing, use the original title.
    let episodeTitle = (match[8] || match[9] || '').trim();
    if (!episodeTitle) {
        // If no specific episode title found after SxxExx, reconstruct a basic one or use original.
        // For "Loki S01 E03", seriesTitle would be "Loki", episodeTitle might be empty.
        // It's better to use the full original title if no specific episode title is parsed.
        episodeTitle = title;
    } else {
        // If we have seriesTitle and episodeTitle, make sure episodeTitle is just the suffix
        if (seriesTitle && title.startsWith(seriesTitle) && title.includes(episodeTitle)) {
            // This is to handle cases like "Series Name - S01E01 - Actual Episode Title"
            // where match[1] is "Series Name - ", match[8] is "Actual Episode Title"
        }
    }
    
    return {
      seriesTitle: seriesTitle || title.split(/s\d{1,2}e\d{1,2}/i)[0].trim() || title, // Fallback for series title
      seasonNumber: isNaN(seasonNumber) ? undefined : seasonNumber,
      episodeNumber: isNaN(episodeNumber) ? undefined : episodeNumber,
      episodeTitle: episodeTitle || title, // Fallback for episode title
    };
  }
  // If no SxxExx pattern, assume it's a movie or a series without clear season/episode in title
  return { seriesTitle: title, episodeTitle: title };
}

/**
 * Normalizes group titles.
 * - Removes "|"
 * - Converts to uppercase
 * - Prefixes "CANAIS " for channels
 * - Removes prefixes like "FILMES | " or "SERIES | " for movies/series
 */
export function normalizeGroupTitle(rawGroupTitle: string | undefined, itemType: PlaylistItemType): string | undefined {
  if (!rawGroupTitle) return undefined;

  let normalized = rawGroupTitle.replace(/\|/g, ' ').replace(/\s+/g, ' ').toUpperCase().trim();

  if (itemType === 'channel') {
    if (!normalized.startsWith('CANAIS')) {
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
      // Reset for new item, but keep playlistDbId implicitly
      currentRawAttributes = {};
      const info = trimmedLine.substring(8); // Remove #EXTINF:
      const commaIndex = info.lastIndexOf(',');
      
      const attributesString = info.substring(0, commaIndex);
      currentTitleLine = info.substring(commaIndex + 1).trim();

      const attributeRegex = /([a-zA-Z0-9\-]+)="([^"]*)"/g;
      let match;
      while ((match = attributeRegex.exec(attributesString)) !== null) {
        currentRawAttributes[match[1].toLowerCase()] = match[2];
      }
    } else if (trimmedLine && !trimmedLine.startsWith('#')) {
      // This line is the URL
      const streamUrl = trimmedLine;
      const tvgNameAttr = currentRawAttributes['tvg-name'];
      const originalTitle = tvgNameAttr || currentTitleLine; // Prefer tvg-name if available, else the line title

      let itemType: PlaylistItemType = 'unknown' as PlaylistItemType; // Temp assignment
      const groupTitleAttr = currentRawAttributes['group-title'];
      const lowerUrl = streamUrl.toLowerCase();
      const lowerOriginalTitle = originalTitle.toLowerCase();
      const lowerGroupTitle = groupTitleAttr?.toLowerCase() || '';

      // 1. Categorization
      if (lowerUrl.endsWith('.ts') || lowerUrl.includes('/live/')) {
        itemType = 'channel';
      } else if (lowerOriginalTitle.match(/s\d{1,2}e\d{1,2}/i) || lowerGroupTitle.includes('series') || lowerGroupTitle.includes('série') || lowerUrl.includes('/series/')) {
        itemType = 'series_episode';
      } else if (lowerGroupTitle.includes('filme') || lowerGroupTitle.includes('movie') || lowerUrl.includes('/movie/')) {
        itemType = 'movie';
      } else if (itemType === ('unknown' as PlaylistItemType) && groupTitleAttr) { // if still unknown, but has group, default to channel
        itemType = 'channel';
      }


      const item: Partial<PlaylistItem> = {
        playlistDbId,
        title: originalTitle,
        streamUrl,
        logoUrl: currentRawAttributes['tvg-logo'],
        originalGroupTitle: groupTitleAttr,
        tvgId: currentRawAttributes['tvg-id'],
        tvgName: tvgNameAttr, // May be different from title after comma
        itemType, // Determined above
      };
      
      item.groupTitle = normalizeGroupTitle(groupTitleAttr, item.itemType);
      // For movies, genre can be the same as normalized group title.
      if (item.itemType === 'movie') {
        item.genre = item.groupTitle;
      }


      if (item.itemType === 'channel') {
        const { baseChannelName, quality } = extractChannelDetails(originalTitle);
        item.baseChannelName = baseChannelName;
        item.quality = quality;
        // For channels, use baseChannelName as primary display title if different from original,
        // but keep originalTitle in `item.title`
      } else if (item.itemType === 'series_episode') {
        const { seriesTitle, seasonNumber, episodeNumber, episodeTitle } = extractSeriesDetails(originalTitle);
        item.seriesTitle = seriesTitle;
        item.seasonNumber = seasonNumber;
        item.episodeNumber = episodeNumber;
        item.title = episodeTitle; // Overwrite item.title with specific episode title
        item.genre = item.groupTitle; // For series, genre can be the group title
      }
      
      // Ensure essential fields are present
      if (item.streamUrl && item.title && item.itemType !== ('unknown' as PlaylistItemType)) {
        items.push(item as PlaylistItem);
      }

      // Reset for next potential item
      currentRawAttributes = {};
      currentTitleLine = '';
    }
  }
  return items;
}
