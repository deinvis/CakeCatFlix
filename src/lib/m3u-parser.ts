
import type { PlaylistItem } from '@/lib/constants';
import { normalizeText as normalizeForComparison } from '@/lib/utils';

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
    baseChannelName = name.substring(0, qualityMatch.index).trim();
  }
  
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
  return { seriesTitle: title };
}

/**
 * Extracts year from a movie title if present in (YYYY) format.
 */
export function extractMovieYear(title: string): number | undefined {
    const yearPattern = /\((\d{4})\)/;
    const match = title.match(yearPattern);
    if (match && match[1]) {
        return parseInt(match[1], 10);
    }
    return undefined;
}


export function normalizeGroupTitle(rawGroupTitle: string | undefined, itemType?: PlaylistItem['itemType']): string | undefined {
  if (!rawGroupTitle) return undefined;

  let normalized = normalizeForComparison(rawGroupTitle).toUpperCase();

  const typePrefixesToRemove = ['CANAL', 'CANAIS', 'FILME', 'FILMES', 'MOVIE', 'MOVIES', 'SERIE', 'SERIES', 'TV SHOWS', 'TV SHOW'];
  
  for (const prefix of typePrefixesToRemove) {
    if (normalized.startsWith(prefix + ' |') || normalized.startsWith(prefix + ' -') || normalized.startsWith(prefix + ':')) {
      normalized = normalized.substring(prefix.length).replace(/^(\s*(\||-|:)\s*)/, '').trim();
      break; 
    } else if (normalized.startsWith(prefix + ' ')) {
        normalized = normalized.substring(prefix.length + 1).trim();
        break;
    }
  }
   // Remove general prefixes if no specific type prefix matched
  normalized = normalized.replace(/^(CANAIS|CANAL|FILMES|SÉRIES|SERIES|MOVIES|TV SHOWS)\s*(\||-)?\s*/i, '');
  normalized = normalized.replace(/\s*(\||-)\s*$/, '');
  normalized = normalized.replace(/\s+/g, ' ').trim();

  if (!normalized && rawGroupTitle) {
    return rawGroupTitle.trim().toUpperCase(); // Fallback to original (trimmed, uppercased) if normalization results in empty
  }
  
  // Optional: Re-add a generic prefix based on itemType if desired, after primary normalization
  // This part can be tricky if original group was e.g. "CANAIS FILMES"
  // For now, the above clean-up is primary. Specific prefixing might be better handled by UI grouping.

  return normalized || rawGroupTitle.trim().toUpperCase(); // Final fallback
}


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
      
      const lowerStreamUrl = streamUrl.toLowerCase();
      const lowerTvgName = normalizeForComparison(tvgName);
      const lowerOriginalGroupTitle = normalizeForComparison(originalGroupTitle);

      let itemType: PlaylistItem['itemType'];

      // --- Determine Item Type based on revised rules ---
      const isTsStream = lowerStreamUrl.endsWith('.ts');
      const has24hInName = lowerTvgName.includes('24h');
      const hasCanalInGroup = lowerOriginalGroupTitle.includes('canal'); // "canal" will match "CANAIS", "Canal"

      const isSeriesPatternInName = !!tvgName.match(/s\d{1,3}e\d{1,3}/i);
      // More specific group checks:
      const isExclusiveSerieGroup = lowerOriginalGroupTitle.includes('serie') && !lowerOriginalGroupTitle.includes('filme');
      const isExclusiveFilmeGroup = lowerOriginalGroupTitle.includes('filme') && !lowerOriginalGroupTitle.includes('serie');
      
      const isLikelyVideoExtension = lowerStreamUrl.includes('.mp4') || lowerStreamUrl.includes('.mkv') || lowerStreamUrl.includes('.avi');

      const { quality: extractedQualityFromName } = extractChannelDetails(tvgName);
      const isChannelLikeName = !!extractedQualityFromName || 
                                 (tvgName === tvgName.toUpperCase() && 
                                  tvgName.length < 30 && 
                                  !tvgName.includes('(') && 
                                  !tvgName.match(/\(\d{4}\)$/));

      // Priority 1: Definitive Channel Indicators
      if (isTsStream || has24hInName || hasCanalInGroup) {
        itemType = 'channel';
      }
      // Priority 2: Definitive Series Indicator (SxxExx in tvg-name)
      else if (isSeriesPatternInName) {
        itemType = 'series_episode';
      }
      // Priority 3: If name looks like a channel (and not SxxExx from Priority 2)
      else if (isChannelLikeName) {
        itemType = 'channel';
      }
      // Priority 4: Group title based classification (exclusive checks first)
      else if (isExclusiveSerieGroup) { // group is "SERIES" (and not "FILMES")
        itemType = 'series_episode';
      }
      else if (isExclusiveFilmeGroup) { // group is "FILMES" (and not "SERIES")
        itemType = 'movie';
      }
      // Priority 5: If group was mixed (e.g., "FILMES E SERIES") or generic, rely on name or default for extension
      else if (isLikelyVideoExtension) {
        // This covers cases where:
        // - Not .ts, no "24h", no "canal" in group.
        // - No SxxExx in name.
        // - Name doesn't strongly look like a channel (e.g., "My Movie (2023)").
        // - Group was mixed (e.g., "FILMES E SERIES") or generic (e.g., "VARIADOS").
        if (extractMovieYear(tvgName) !== undefined) { // If name has (YYYY), good chance it's a movie
          itemType = 'movie';
        } 
        // If group title (even mixed) contained "serie", lean towards series_episode
        else if (lowerOriginalGroupTitle.includes('serie')) { 
          itemType = 'series_episode';
        }
        // If group title (even mixed) contained "filme", lean towards movie
        else if (lowerOriginalGroupTitle.includes('filme')) {
          itemType = 'movie';
        }
        // Default for video files without other strong clues: movie
        else {
          itemType = 'movie';
        }
      }
      // Priority 6: Fallback for completely unknown stream types (not .ts, not common video extension, no strong indicators from name/group)
      else {
        itemType = 'channel'; // Default to channel if no other rule applies (e.g., plain http stream with no extension)
      }
      // --- End Item Type Determination ---

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
        item.year = extractMovieYear(tvgName); 
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
