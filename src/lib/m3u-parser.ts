
import type { PlaylistItem } from '@/lib/constants';
import { normalizeText } from '@/lib/utils'; // Renomeado normalizeForComparison para normalizeText

/**
 * Extracts base channel name and quality from a channel title.
 */
export function extractChannelDetails(name: string): { baseChannelName: string; quality?: string } {
  if (!name) return { baseChannelName: '', quality: undefined };

  let workName = name.trim();
  const extractedQualities: string[] = [];

  const qualityCodecPatterns = [
    { pattern: /\s+(4K UHD|UHD 4K|4K|UHD)\b/i, quality: (match: RegExpMatchArray) => match[1].toUpperCase().replace(/\s/g, "") },
    { pattern: /\s+(FHD|FULLHD|FULL HD|1080P|1080I)\b/i, quality: (match: RegExpMatchArray) => match[1].toUpperCase().replace("FULLHD", "FHD").replace("FULL HD", "FHD").replace("1080I", "1080p") },
    { pattern: /\s+(HDTV|HD|720P|720I)\b/i, quality: (match: RegExpMatchArray) => match[1].toUpperCase().replace("720I", "720p") }, // Added HDTV
    { pattern: /\s+(SD|576P|576I|480P|480I)\b/i, quality: (match: RegExpMatchArray) => match[1].toUpperCase().replace("576I", "576p").replace("480I", "480p") },
    { pattern: /\s+(H265|X265|H\.265|HEVC)\b/i, quality: (match: RegExpMatchArray) => match[1].toUpperCase().replace("H.265", "H265") },
    { pattern: /\s+(H264|X264|H\.264|AVC)\b/i, quality: (match: RegExpMatchArray) => match[1].toUpperCase().replace("H.264", "H264") },
    { pattern: /\s*([\u00AA\u00BA\u2070\u00B9\u00B2\u00B3\u2074-\u2079\u2460-\u24FF\u2776-\u2793]+)\b/i, quality: (match: RegExpMatchArray) => match[1] }, // Corrected and expanded superscript/circled pattern
  ];

  let changedInIteration;
  do {
    changedInIteration = false;
    for (const qc of qualityCodecPatterns) {
      const match = workName.match(qc.pattern);
      if (match && match.index !== undefined) {
        const qualityValue = qc.quality(match);
        if (qualityValue !== null) {
            extractedQualities.unshift(qualityValue);
            workName = workName.substring(0, match.index) + workName.substring(match.index + match[0].length);
            workName = workName.trim();
            changedInIteration = true;
        }
      }
    }
  } while (changedInIteration);

  workName = workName.replace(/[^a-zA-Z0-9À-ÖØ-öø-ÿ\s().:\-+&']/g, ' ').replace(/\s+/g, ' ').trim(); // Allow more chars in name like + & '
  workName = workName.replace(/\s*-\s*$/, '').trim();

  const finalBaseChannelName = workName || name;
  const finalQuality = extractedQualities.length > 0 ? extractedQualities.join(' ').trim() : undefined;
  
  return { baseChannelName: finalBaseChannelName, quality: finalQuality };
}


/**
 * Extracts series title, season, and episode number from a title.
 */
export function extractSeriesDetails(title: string): { seriesTitle: string; seasonNumber?: number; episodeNumber?: number, episodeTitle?: string } {
  const seriesPattern = /^(.*?)(?:[Ss](\d{1,3})[EeXx](\d{1,3})|[Ss]eason\s*(\d{1,3})\s*[Ee]pisode\s*(\d{1,3})|\s-\s[Ss](\d{1,3})\s[Ee](\d{1,3}))(?:\s*-\s*(.*|E\d{1,3}\s+.*)|\s*:?\s*(.*)|$)/i;
  const match = title.match(seriesPattern);

  if (match) {
    let seriesTitle = (match[1] || '').trim();
    const seasonStr = match[2] || match[4] || match[6];
    const episodeStr = match[3] || match[5] || match[7];
    let episodeTitle = (match[8] || match[9] || '').trim();

    if (!seriesTitle && (seasonStr && episodeStr)) {
        seriesTitle = title.split(match[0])[0].trim() || title; 
    }
    
    if (episodeTitle.match(/^[Ss]\d{1,3}[EeXx]\d{1,3}/i) && episodeTitle.length < 10) {
        episodeTitle = '';
    }
    if (seriesTitle && episodeTitle.toLowerCase().startsWith(seriesTitle.toLowerCase())) {
        episodeTitle = episodeTitle.substring(seriesTitle.length).replace(/^(\s*-\s*|\s*:\s*)/, '').trim();
    }

    const seasonNumber = seasonStr ? parseInt(seasonStr, 10) : undefined;
    const episodeNumber = episodeStr ? parseInt(episodeStr, 10) : undefined;
    
    return {
      seriesTitle: seriesTitle || title.split(/[Ss]\d{1,3}[EeXx]\d{1,3}/i)[0].trim() || title,
      seasonNumber: isNaN(seasonNumber as number) ? undefined : seasonNumber,
      episodeNumber: isNaN(episodeNumber as number) ? undefined : episodeNumber,
      episodeTitle: episodeTitle || undefined,
    };
  }
  const parts = title.split(/\s+-\s+|\s+–\s+/); 
  if (parts.length > 1) {
    const potentialEpisodeTitle = parts.pop()?.trim();
    const potentialSeriesTitle = parts.join(' - ').trim();
    if (potentialSeriesTitle && potentialEpisodeTitle) {
      return { seriesTitle: potentialSeriesTitle, episodeTitle: potentialEpisodeTitle };
    }
  }
  return { seriesTitle: title };
}

/**
 * Extracts year from a movie title if present in (YYYY) format.
 */
export function extractMovieYear(title: string): number | undefined {
    const yearPattern = /(?<![-\d])\((\d{4})\)(?![-\d])/;
    const match = title.match(yearPattern);
    if (match && match[1]) {
        return parseInt(match[1], 10);
    }
    return undefined;
}

/**
 * Normalizes a raw group title from M3U.
 * - Removes common prefixes like "CANAIS | ", "FILMES - ", etc.
 * - Replaces " | " with a single space.
 * - Converts to uppercase and trims.
 */
export function normalizeGroupTitle(rawGroupTitle: string | undefined, itemTypeHint?: PlaylistItem['itemType']): string | undefined {
  if (!rawGroupTitle || typeof rawGroupTitle !== 'string' || rawGroupTitle.trim() === '') {
    return undefined;
  }

  // Step 1: Basic normalization (accents, case) then toUpperCase for consistent prefix matching
  let currentTitle = normalizeText(rawGroupTitle).toUpperCase();

  // Step 2: Define prefixes to strip. Order might matter if one is a substring of another.
  // Include common separators.
  const prefixesToStrip = [
    "CANAIS OFFLINE | ", "CANAIS OFFLINE - ", "CANAIS OFFLINE : ",
    "CANAIS | ", "CANAL | ", "TV | ", "TV CHANNELS | ",
    "FILMES | ", "FILME | ", "MOVIES | ", "MOVIE | ", "PELICULAS | ", "PELICULA | ",
    "SERIES | ", "SÉRIES | ", "SERIE | ", "SÉRIE | ", "TV SERIES | ", "TV SHOWS | ", "WEB SERIES | ",
    "ANIMES | ", "ANIME | ", "DORAMAS | ", "DORAMA | ",
    // Prefixes without trailing space, assuming the separator will handle it
    "CANAIS:", "CANAL:", "TV:",
    "FILMES:", "FILME:", "MOVIES:", "MOVIE:",
    "SERIES:", "SÉRIES:", "SERIE:", "SÉRIE:",
    // Consider generic prefixes as well
    "CATEGORIA:", "GRUPO:", "GROUP:", "CATEGORY:",
  ];

  for (const prefix of prefixesToStrip) {
    if (currentTitle.startsWith(prefix)) {
      currentTitle = currentTitle.substring(prefix.length).trim();
      // Important: If a prefix is stripped, we might want to stop
      // to avoid stripping parts of a "multi-level" prefix incorrectly.
      // For now, we strip the first one found.
      break; 
    }
  }
  
  // Step 3: Replace remaining " | " or standalone "|" (with spaces around) with a single space.
  // This addresses "Nao quero '|' no nome" more directly for internal separators.
  currentTitle = currentTitle.replace(/\s*\|\s*/g, ' ').trim();

  // Step 4: Final cleanup of multiple spaces
  currentTitle = currentTitle.replace(/\s+/g, ' ').trim();

  // If after all this, the title is empty, revert to a simplified original (uppercase, trimmed)
  if (currentTitle === '') {
    return rawGroupTitle.trim().toUpperCase() || undefined;
  }

  return currentTitle;
}


export function parseM3U(m3uString: string, playlistDbId: string, limit?: number): PlaylistItem[] {
  const lines = m3uString.split(/\r?\n/);
  const items: PlaylistItem[] = [];
  let currentRawAttributes: Record<string, string> = {};
  let m3uTitleFromLine: string = '';

  for (const line of lines) {
    if (limit && items.length >= limit) break;
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith('#EXTINF:')) {
      currentRawAttributes = {};
      const info = trimmedLine.substring(8);
      const commaIndex = info.lastIndexOf(',');
      const attributesString = commaIndex > -1 ? info.substring(0, commaIndex) : info;
      m3uTitleFromLine = commaIndex > -1 ? info.substring(commaIndex + 1).trim() : '';

      const attributeRegex = /([a-zA-Z0-9\-._]+)="([^"]*)"/g;
      let match;
      while ((match = attributeRegex.exec(attributesString)) !== null) {
        currentRawAttributes[match[1].toLowerCase()] = match[2];
      }
    } else if (trimmedLine && !trimmedLine.startsWith('#') && !trimmedLine.startsWith('##')) {
      const streamUrl = trimmedLine;
      
      const tvgNameFromAttr = currentRawAttributes['tvg-name']?.trim();
      const titleForProcessing = tvgNameFromAttr || m3uTitleFromLine || 'Unknown Item';
      
      const originalGroupTitle = currentRawAttributes['group-title']?.trim();
      const lowerStreamUrl = streamUrl.toLowerCase();
      const normalizedTitleForProcessing = normalizeText(titleForProcessing);
      const normalizedOriginalGroupTitle = normalizeText(originalGroupTitle || "");

      let itemType: PlaylistItem['itemType'];
      
      const isTsStream = lowerStreamUrl.endsWith('.ts');
      const has24hInName = normalizedTitleForProcessing.includes('24h');
      const hasCanalInGroup = normalizedOriginalGroupTitle.includes('canal');
      const hasTvgId = !!currentRawAttributes['tvg-id']?.trim();


      if (isTsStream || has24hInName || hasCanalInGroup || (hasTvgId && !lowerStreamUrl.includes('/movie/') && !lowerStreamUrl.includes('/series/'))) {
        itemType = 'channel';
      } else if (titleForProcessing.match(/[Ss]\d{1,3}\s*[EeXx]\s*\d{1,3}/i) || lowerStreamUrl.includes('/series/')) {
        itemType = 'series_episode';
      } else if (lowerStreamUrl.includes('/movie/')) {
        itemType = 'movie';
      } else {
        const { baseChannelName: tempBaseName } = extractChannelDetails(titleForProcessing);
        const isChannelLikeName = (tempBaseName !== titleForProcessing && tempBaseName.length > 0) ||
                                   (titleForProcessing === titleForProcessing.toUpperCase() && titleForProcessing.length < 35 && !titleForProcessing.match(/\(\d{4}\)$/));
        
        if (isChannelLikeName && !(normalizedOriginalGroupTitle.includes('film') || normalizedOriginalGroupTitle.includes('movie') || normalizedOriginalGroupTitle.includes('serie'))) {
            itemType = 'channel';
        } else if (normalizedOriginalGroupTitle.includes('serie') || normalizedOriginalGroupTitle.includes('dorama') || normalizedOriginalGroupTitle.includes('anime')) {
            itemType = 'series_episode';
        } else if (normalizedOriginalGroupTitle.includes('film') || normalizedOriginalGroupTitle.includes('movie') || normalizedOriginalGroupTitle.includes('pelicula')) {
            itemType = 'movie';
        } else if (lowerStreamUrl.endsWith('.mp4') || lowerStreamUrl.endsWith('.mkv') || lowerStreamUrl.endsWith('.avi')) {
            if (extractMovieYear(titleForProcessing) !== undefined || normalizedOriginalGroupTitle.includes('film') || normalizedOriginalGroupTitle.includes('movie')) {
                itemType = 'movie';
            } else if (normalizedOriginalGroupTitle.includes('serie')) {
                itemType = 'series_episode';
            } else {
                 itemType = 'movie'; // Default for generic video files if not clearly series
            }
        } else {
            itemType = 'channel'; 
        }
      }

      const item: Partial<PlaylistItem> = {
        playlistDbId,
        title: titleForProcessing, 
        streamUrl,
        logoUrl: currentRawAttributes['tvg-logo'],
        originalGroupTitle: originalGroupTitle,
        tvgId: currentRawAttributes['tvg-id'],
        tvgName: tvgNameFromAttr, 
        itemType,
      };
      
      item.groupTitle = normalizeGroupTitle(originalGroupTitle, item.itemType);

      if (item.itemType === 'channel') {
        const { baseChannelName, quality } = extractChannelDetails(titleForProcessing);
        item.baseChannelName = baseChannelName;
        item.quality = quality;
        item.genre = item.groupTitle; 
      } else if (item.itemType === 'series_episode') {
        const { seriesTitle, seasonNumber, episodeNumber, episodeTitle } = extractSeriesDetails(titleForProcessing);
        item.seriesTitle = seriesTitle;
        item.seasonNumber = seasonNumber;
        item.episodeNumber = episodeNumber;
        if (episodeTitle) item.title = episodeTitle; // Use specific episode title if available
        item.genre = item.groupTitle;
        item.year = extractMovieYear(titleForProcessing); 
      } else if (item.itemType === 'movie') {
        item.year = extractMovieYear(titleForProcessing);
        item.genre = item.groupTitle; 
      }
      
      if (item.streamUrl && item.title && item.itemType) {
        items.push(item as PlaylistItem);
      }

      currentRawAttributes = {}; 
      m3uTitleFromLine = '';
    }
  }
  return items;
}
