
import type { PlaylistItem } from '@/lib/constants';
import { normalizeText as normalizeForComparison } from '@/lib/utils';

/**
 * Extracts base channel name and quality from a channel title.
 * Example: "ESPN HD" -> { baseChannelName: "ESPN", quality: "HD" }
 * Example: "HBO 2 4K" -> { baseChannelName: "HBO 2", quality: "4K" }
 * Example: "Discovery" -> { baseChannelName: "Discovery", quality: undefined }
 * Example: "ANIMAL PLANET FHD H265" -> { baseChannelName: "ANIMAL PLANET", quality: "FHD H265" }
 * Example: "ANIMAL PLANET HD²" -> { baseChannelName: "ANIMAL PLANET", quality: "HD²" }
 */
export function extractChannelDetails(name: string): { baseChannelName: string; quality?: string } {
  if (!name) return { baseChannelName: '', quality: undefined };

  let workName = name.trim();
  const extractedQualities: string[] = [];

  // Define patterns for qualities and codecs, order can be important
  const qualityCodecPatterns = [
    { pattern: /\s+(4K UHD|UHD 4K|4K|UHD)\b/i, quality: (match: RegExpMatchArray) => match[1].toUpperCase().replace(/\s/g, "") },
    { pattern: /\s+(FHD|FULLHD|FULL HD|1080P|1080i)\b/i, quality: (match: RegExpMatchArray) => match[1].toUpperCase().replace("FULLHD", "FHD").replace("FULL HD", "FHD") },
    { pattern: /\s+(HD|720P|720i)\b/i, quality: (match: RegExpMatchArray) => match[1].toUpperCase() },
    { pattern: /\s+(SD|576P|576i|480P|480i)\b/i, quality: (match: RegExpMatchArray) => match[1].toUpperCase() },
    { pattern: /\s+(H265|X265|H\.265|HEVC)\b/i, quality: (match: RegExpMatchArray) => match[1].toUpperCase().replace("H.265", "H265") },
    { pattern: /\s+(H264|X264|H\.264|AVC)\b/i, quality: (match: RegExpMatchArray) => match[1].toUpperCase().replace("H.264", "H264") },
    // Corrected pattern for superscript and circled numbers
    { pattern: /\s*([⁰¹²³⁴⁵⁶⁷⁸⁹\u2460-\u2469\u2776-\u277F]+)\b/i, quality: (match: RegExpMatchArray) => match[1].toUpperCase() },
    { pattern: /(\b(?:4K|UHD|FHD|HD|SD)\s*\d+)\b/i, quality: (match: RegExpMatchArray) => match[1].toUpperCase()}, // Catches "HD 2", "FHD 3"
    { pattern: /\s+([1-9]\d*)$/i, quality: (match: RegExpMatchArray) => {
        if (!match || match.index === undefined) return null;
        const beforeNum = workName.substring(0, match.index).trim();
        if (!beforeNum.match(/\d$/) && beforeNum.length > 2) {
           return match[1];
        }
        return null;
      }
    }
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
  
  workName = workName.replace(/[^a-zA-Z0-9\s\(\)\-\.\:]+$/, '').trim();
  workName = workName.replace(/\s*-\s*$/, '').trim(); 

  if (workName.toUpperCase().endsWith(" H265")) {
      if (!extractedQualities.includes("H265")) extractedQualities.unshift("H265");
      workName = workName.substring(0, workName.length - 5).trim();
  }

  const finalBaseChannelName = workName || name;
  const finalQuality = extractedQualities.length > 0 ? extractedQualities.join(' ').trim() : undefined;
  
  return { baseChannelName: finalBaseChannelName, quality: finalQuality };
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
  const originalNormalized = normalized; 

  const channelPrefixes = ['CANAL', 'CANAIS'];
  const moviePrefixes = ['FILME', 'FILMES', 'MOVIE', 'MOVIES'];
  const seriesPrefixes = ['SERIE', 'SERIES', 'TV SHOWS', 'TV SHOW', 'SERIES TV', 'DORAMA', 'ANIMES', 'ANIME']; // Added DORAMA, ANIMES

  let typePrefixesToRemove: string[] = [];
  let addPrefix: string | null = null;

  if (itemType === 'channel') {
    typePrefixesToRemove = [...moviePrefixes, ...seriesPrefixes]; // Remove movie/series prefixes from channel groups
    // No prefix to add for channels by default via this normalization, group as is.
  } else if (itemType === 'movie') {
    typePrefixesToRemove = [...channelPrefixes, ...seriesPrefixes];
    // No prefix to add for movies, genre is usually what remains.
  } else if (itemType === 'series_episode') {
    typePrefixesToRemove = [...channelPrefixes, ...moviePrefixes];
     // No prefix to add for series, genre is usually what remains.
  } else { // Generic, try to remove any known prefix
    typePrefixesToRemove = [...channelPrefixes, ...moviePrefixes, ...seriesPrefixes];
  }
  
  for (const prefix of typePrefixesToRemove) {
    if (normalized.startsWith(prefix + ' |') || normalized.startsWith(prefix + ' -') || normalized.startsWith(prefix + ':')) {
      normalized = normalized.substring(prefix.length).replace(/^(\s*(\||-|:)\s*)/, '').trim();
      break; 
    } else if (normalized.startsWith(prefix + ' ')) {
        normalized = normalized.substring(prefix.length + 1).trim();
        break;
    }
  }
  
  // If no specific type prefix was removed, try a general removal (less aggressive for mixed groups)
  if (normalized === originalNormalized) {
    const generalPrefixPattern = /^(CANAIS|CANAL|FILMES|FILME|SÉRIES|SERIES|MOVIE|MOVIES|TV SHOWS|TV SHOW|SERIES TV|DORAMA|ANIMES|ANIME)\s*([|-])?\s*/i;
    normalized = normalized.replace(generalPrefixPattern, '');
  }

  if (addPrefix && !normalized.startsWith(addPrefix)) {
    normalized = `${addPrefix} ${normalized}`.trim();
  }
  
  normalized = normalized.replace(/\s*(\||-)\s*$/, ''); 
  normalized = normalized.replace(/\s+/g, ' ').trim(); 

  if (!normalized && rawGroupTitle) { 
    return rawGroupTitle.trim().toUpperCase(); 
  }
  
  return normalized || rawGroupTitle.trim().toUpperCase(); 
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
    } else if (trimmedLine && !trimmedLine.startsWith('#') && !trimmedLine.startsWith('##')) {
      const streamUrl = trimmedLine;
      const m3uTitle = currentTitleLine; 
      const tvgName = currentRawAttributes['tvg-name'] || m3uTitle; 
      const originalGroupTitle = currentRawAttributes['group-title'];
      
      const lowerStreamUrl = streamUrl.toLowerCase();
      const normalizedTvgName = normalizeForComparison(tvgName);
      const normalizedOriginalGroupTitle = normalizeForComparison(originalGroupTitle || "");

      let itemType: PlaylistItem['itemType'];
      
      // 1. Definitive Channel Indicators
      const isTsStream = lowerStreamUrl.endsWith('.ts');
      const has24hInName = normalizedTvgName.includes('24h');
      const hasCanalInGroup = normalizedOriginalGroupTitle.includes('canal');
      
      if (isTsStream || has24hInName || hasCanalInGroup) {
        itemType = 'channel';
      }
      // 2. Definitive Series Indicator (SxxExx in tvg-name)
      else if (tvgName.match(/s\d{1,3}e\d{1,3}/i)) {
        itemType = 'series_episode';
      }
      // 3. Name looks like a channel (heuristic, after definitive series check)
      else {
        const { baseChannelName: tempBaseNameForClassification } = extractChannelDetails(tvgName);
        const isChannelLikeName = tempBaseNameForClassification !== tvgName || // if extractChannelDetails changed the name
                                   (tvgName === tvgName.toUpperCase() && 
                                    tvgName.length < 35 && 
                                    !tvgName.match(/\(\d{4}\)$/)); 

        if (isChannelLikeName) {
            itemType = 'channel';
        }
        // 4. Group title based classification (more specific checks)
        else if (normalizedOriginalGroupTitle.includes('serie') || normalizedOriginalGroupTitle.includes('dorama') || normalizedOriginalGroupTitle.includes('anime')) {
            itemType = 'series_episode';
        }
        else if (normalizedOriginalGroupTitle.includes('filme') || normalizedOriginalGroupTitle.includes('movie')) {
            itemType = 'movie';
        }
        // 5. Fallback for likely video extensions
        else if (lowerStreamUrl.endsWith('.mp4') || lowerStreamUrl.endsWith('.mkv') || lowerStreamUrl.endsWith('.avi')) {
            if (extractMovieYear(tvgName) !== undefined) {
                itemType = 'movie';
            } else { // Default for generic video files without other strong clues
                itemType = 'movie'; 
            }
        }
        // 6. Final Fallback
        else {
            itemType = 'channel'; 
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
