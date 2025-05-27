
import type { PlaylistItem } from '@/lib/constants'; // PlaylistItemType removed as it's not directly used here.
import { normalizeText as normalizeForComparison } from '@/lib/utils'; // Renamed for clarity

/**
 * Extracts base channel name and quality from a channel title.
 * Example: "ESPN HD" -> { baseChannelName: "ESPN", quality: "HD" }
 * Example: "HBO 2 4K" -> { baseChannelName: "HBO 2", quality: "4K" }
 * Example: "Discovery" -> { baseChannelName: "Discovery", quality: undefined }
 */
export function extractChannelDetails(name: string): { baseChannelName: string; quality?: string } {
  const qualityPatterns = /\s+(4K|UHD|FHD|HD|SD|1080P|720P|HEVC)(\s+\(.*\)|$)/i;
  const qualityMatch = name.match(qualityPatterns);
  let baseChannelName = name;
  let quality;

  if (qualityMatch) {
    quality = qualityMatch[1].toUpperCase();
    // Remove the quality and any subsequent parenthesized text from the base name
    baseChannelName = name.substring(0, qualityMatch.index).trim();
  }
  
  // If baseChannelName became empty, it means the original name was just the quality or quality + suffix.
  // Try to reconstruct a meaningful baseChannelName or default to the original name if all else fails.
  if (baseChannelName === '' && name.includes(quality || '')) {
      baseChannelName = name.replace(quality || '', '').replace(/\(\)/, '').trim();
  }
  if (baseChannelName === '') baseChannelName = name; 

  return { baseChannelName, quality };
}

/**
 * Extracts series title, season, and episode number from a title.
 * Example: "Batalha das Solteiras S01E06" -> { seriesTitle: "Batalha das Solteiras", seasonNumber: 1, episodeNumber: 6 }
 */
export function extractSeriesDetails(title: string): { seriesTitle: string; seasonNumber?: number; episodeNumber?: number } {
  const seriesPattern = /^(.*?)(?:s(\d{1,3})e(\d{1,3})|season\s*(\d{1,3})\s*episode\s*(\d{1,3})|\s-\sS(\d{1,3})\sE(\d{1,3}))(?:\s*-\s*(.*)|$|\s*:?\s*(.*))/i;
  const match = title.match(seriesPattern);

  if (match) {
    const seriesTitle = (match[1] || '').trim();
    const seasonStr = match[2] || match[4] || match[6];
    const episodeStr = match[3] || match[5] || match[7];
    
    const seasonNumber = seasonStr ? parseInt(seasonStr, 10) : undefined;
    const episodeNumber = episodeStr ? parseInt(episodeStr, 10) : undefined;
    
    return {
      seriesTitle: seriesTitle || title.split(/s\d{1,3}e\d{1,3}/i)[0].trim() || title,
      seasonNumber: isNaN(seasonNumber as number) ? undefined : seasonNumber,
      episodeNumber: isNaN(episodeNumber as number) ? undefined : episodeNumber,
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
 * Normalizes group titles for consistent categorization.
 * - Converts to uppercase.
 * - Removes "CANAL |", "CANAIS |", "FILMES |", "SÉRIES |" prefixes and similar variations.
 * - Trims extra spaces.
 * - Specific handling for item types can be added if needed, but for now, focuses on general cleanup.
 */
export function normalizeGroupTitle(rawGroupTitle: string | undefined, itemType?: PlaylistItem['itemType']): string | undefined {
  if (!rawGroupTitle) return undefined;

  let normalized = rawGroupTitle.toUpperCase().trim();

  // Remove common prefixes and separators used in group titles
  normalized = normalized.replace(/^(CANAIS|CANAL|FILMES|SÉRIES|SERIES|MOVIES|TV SHOWS)\s*(\||-)?\s*/i, '');
  normalized = normalized.replace(/\s*(\||-)\s*$/, ''); // Remove trailing separators
  normalized = normalized.replace(/\s+/g, ' ').trim(); // Normalize spaces

  // Optional: Re-add a generic prefix based on itemType if desired, for example:
  // if (itemType === 'channel' && !normalized.startsWith('CANAIS')) {
  //   normalized = `CANAIS ${normalized}`;
  // }
  return normalized || rawGroupTitle.trim(); // Fallback to original trimmed if normalization results in empty
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
      const m3uTitle = currentTitleLine; 
      const tvgName = currentRawAttributes['tvg-name'] || m3uTitle; 
      const originalGroupTitle = currentRawAttributes['group-title'];
      
      const lowerUrl = streamUrl.toLowerCase();
      const lowerTvgName = normalizeForComparison(tvgName); // Normalize for pattern matching
      const lowerGroupTitle = normalizeForComparison(originalGroupTitle);

      let itemType: PlaylistItem['itemType'] | undefined = undefined;

      // 1. Determine Item Type based on new rules
      if (lowerUrl.endsWith('.ts') || lowerGroupTitle.includes('canal') || lowerTvgName.includes('24h')) {
        itemType = 'channel';
      } else if (lowerUrl.includes('.mp4') || lowerUrl.includes('.mkv') || lowerUrl.includes('.avi')) { // Common video extensions
        if (tvgName.match(/s\d{1,3}e\d{1,3}/i)) { // Strong indicator for series
          itemType = 'series_episode';
        } else {
          // If tvg-name looks like a channel (e.g., "ESPN HD", "AMC FHD")
          const { quality: extractedQualityFromName } = extractChannelDetails(tvgName);
          const isLikelyChannelName = extractedQualityFromName || 
                                     (tvgName.toUpperCase() === tvgName && tvgName.length < 15 && !tvgName.includes('(') && !tvgName.match(/\d{4}/)); // Heuristic for channel-like names

          if (isLikelyChannelName && !tvgName.match(/s\d{1,3}e\d{1,3}/i)) {
            itemType = 'channel';
          } else if (lowerGroupTitle.includes('filme')) {
            itemType = 'movie';
          } else if (lowerGroupTitle.includes('serie')) { // Weaker indicator if SxxExx didn't match
            itemType = 'series_episode';
          } else if (lowerGroupTitle.includes('documentario')) { // Example for specific group titles
             itemType = 'movie'; // Or 'series_episode' if applicable
          } else {
            // Fallback: if it has a year in parentheses, likely a movie. Otherwise, could be a series without SxxExx.
            // Or if group-title is very generic, might be a channel if tvg-name is short.
            if (extractMovieYear(tvgName) !== undefined) {
                itemType = 'movie';
            } else if (isLikelyChannelName) { // Re-check for channel if group title was too generic
                itemType = 'channel';
            } else {
                 // If still undecided, and no SxxExx, and group title isn't specific, it's more likely a movie or a series title without episode info.
                 // Let's default to movie if it's not a series episode and not clearly a channel
                 itemType = 'movie'; 
            }
          }
        }
      }
      // Fallback if still undefined based on stream type not being .ts or video-like
      if (!itemType) {
        if (tvgName.match(/s\d{1,3}e\d{1,3}/i) || lowerGroupTitle.includes('serie')) {
            itemType = 'series_episode';
        } else if (lowerGroupTitle.includes('filme')) {
            itemType = 'movie';
        } else if (lowerGroupTitle.includes('canal') || lowerTvgName.includes('24h')) {
            itemType = 'channel';
        } else {
            itemType = 'movie'; // Defaulting to movie if no other clues
        }
      }


      const item: Partial<PlaylistItem> = {
        playlistDbId,
        title: tvgName, 
        streamUrl,
        logoUrl: currentRawAttributes['tvg-logo'],
        originalGroupTitle: originalGroupTitle,
        tvgId: currentRawAttributes['tvg-id'],
        tvgName: currentRawAttributes['tvg-name'], 
        itemType,
      };
      
      // Group title normalization happens *after* item type detection, as type might influence normalization
      item.groupTitle = normalizeGroupTitle(originalGroupTitle, item.itemType);

      if (item.itemType === 'channel') {
        const { baseChannelName, quality } = extractChannelDetails(tvgName);
        item.baseChannelName = baseChannelName;
        item.quality = quality;
        item.genre = item.groupTitle; 
      } else if (item.itemType === 'series_episode') {
        const { seriesTitle, seasonNumber, episodeNumber } = extractSeriesDetails(tvgName);
        item.seriesTitle = seriesTitle;
        item.seasonNumber = seasonNumber;
        item.episodeNumber = episodeNumber;
        item.genre = item.groupTitle; 
        item.year = extractMovieYear(tvgName); // Series might also have a release year in their "episode" M3U title
      } else if (item.itemType === 'movie') {
        item.year = extractMovieYear(tvgName);
        item.genre = item.groupTitle; 
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
