
import type { PlaylistItem } from '@/lib/constants';
import { normalizeText } from '@/lib/utils';

/**
 * Extracts base channel name and quality from a channel title.
 * Ensures that numbers or words part of a distinct channel name (e.g., "ESPN 2", "ESPN Extra") are preserved.
 */
export function extractChannelDetails(name: string): { baseChannelName: string; quality?: string } {
  if (!name || typeof name !== 'string') return { baseChannelName: '', quality: undefined };

  let workName = name.trim();
  const extractedQualities: string[] = [];

  const qualityCodecPatterns: { regex: RegExp; qualityLabel: string }[] = [
    { regex: /\b(4K\s*UHD|UHD\s*4K|4K|ULTRA\s*HD|UHD)\b/gi, qualityLabel: "4K" },
    { regex: /\b(FULL\s*HD|FULLHD|FHD|1080P|1080I)\b/gi, qualityLabel: "FHD" },
    { regex: /\b(HDTV|HD|720P|720I)\b/gi, qualityLabel: "HD" },
    { regex: /\b(SDTV|SD|576P|576I|480P|480I)\b/gi, qualityLabel: "SD" },
    { regex: /\b(H265|X265|H\.265|HEVC)\b/gi, qualityLabel: "H265" },
    { regex: /\b(H264|X264|H\.264|AVC)\b/gi, qualityLabel: "H264" },
    // Superscripts and circled numbers, more specific matching
    { regex: /\b([²³¹⁰¹²³⁴⁵⁶⁷⁸⁹])\b/g, qualityLabel: "$1" }, 
    { regex: /\b([①②③④⑤⑥⑦⑧⑨⑩])\b/g, qualityLabel: "$1" },
    { regex: /\b([❶❷❸❹❺❻❼❽❾❿])\b/g, qualityLabel: "$1" },
  ];

  for (const { regex, qualityLabel } of qualityCodecPatterns) {
    workName = workName.replace(regex, (match, p1) => {
      let quality = qualityLabel;
       if (p1 && qualityLabel.includes("$1")) { // If label uses captured group
        quality = qualityLabel.replace("$1", p1.toUpperCase());
      }
      if (!extractedQualities.includes(quality.toUpperCase())) {
        extractedQualities.push(quality.toUpperCase());
      }
      return ''; 
    });
  }
  
  // Clean up remaining common separators or characters often used with quality, but only if they are at the end
  // and might have been left after specific quality tags were removed.
  workName = workName.replace(/[._\-\s]+$/g, '').trim();
  workName = workName.replace(/^[._\-\s]+/g, '').trim(); // Also from beginning

  // Remove parentheses/brackets only if they are now empty or surround only spaces
  workName = workName.replace(/\(\s*\)/g, '').trim();
  workName = workName.replace(/\[\s*\]/g, '').trim();
  
  let baseChannelName = workName.replace(/\s+/g, ' ').trim(); 

  // If baseChannelName is empty after all removals, fall back to the original name
  // or a part of it, trying to be smarter.
  if (!baseChannelName) {
    const originalNameParts = name.trim().split(/[|(]/);
    baseChannelName = originalNameParts[0].trim();
    if (!baseChannelName) baseChannelName = name.trim(); // Ultimate fallback
  }

  const finalQuality = extractedQualities.length > 0 ? extractedQualities.sort().join(' ').trim() : undefined;

  return { baseChannelName: baseChannelName.toUpperCase(), quality: finalQuality };
}


/**
 * Extracts series title, season, and episode number from a title.
 */
export function extractSeriesDetails(titleFromM3U: string, streamUrl: string): { seriesTitle: string; seasonNumber?: number; episodeNumber?: number, episodeTitle?: string } {
  if (!titleFromM3U) return { seriesTitle: "Unknown Series" };

  let seriesTitle = titleFromM3U;
  let seasonNumber: number | undefined;
  let episodeNumber: number | undefined;
  let episodeTitle: string | undefined;

  // Common patterns: SxxExx, Season X Episode Y, XxY
  const patterns = [
    // SxxExx - Episode Title
    /^(.*?)(?:[\s._-]*[Ss](\d{1,3})[._\s-]*[EeXx](\d{1,3}))(?:[\s._-]*(.+))?$/i,
    // Series Title - Season X - Episode Y - Episode Title
    /^(.*?)(?:[\s._-]+(?:TEMPORADA|SEASON|T)(\d{1,2}))(?:[\s._-]+(?:EPIS[OÓ]DIO|EPISODE|EP|E)(\d{1,3}))(?:[\s._-]+(.+))?$/i,
     // Series Title - XxY - Episode Title (XxY often for anime or compact series notations)
    /^(.*?)(?:[\s._-]+(\d{1,2})[xX](\d{1,3}))(?:[\s._-]+(.+))?$/i,
  ];

  for (const pattern of patterns) {
    const match = titleFromM3U.match(pattern);
    if (match) {
      seriesTitle = match[1]?.trim() || titleFromM3U; 
      const seasonStr = match[2];
      const episodeStr = match[3];
      episodeTitle = match[4]?.trim();

      if (seasonStr) seasonNumber = parseInt(seasonStr, 10);
      if (episodeStr) episodeNumber = parseInt(episodeStr, 10);
      
      if (seriesTitle.toUpperCase().startsWith(`S${String(seasonNumber||'').padStart(2,'0')}E${String(episodeNumber||''}`) || 
          seriesTitle.toUpperCase().startsWith(`SEASON ${seasonNumber||''} EPISODE ${episodeNumber||''}`) ||
          seriesTitle.toUpperCase().startsWith(`${seasonNumber||''}X${episodeNumber||''}`)
      ) {
        seriesTitle = titleFromM3U.split(match[0].replace(match[1],'').trim())[0].trim() || "Unknown Series";
      }

      if (seriesTitle === "" && episodeTitle) { 
          seriesTitle = "Unknown Series";
      }
      
      if (episodeTitle && seriesTitle !== "Unknown Series" && episodeTitle.toLowerCase().includes(seriesTitle.toLowerCase())) {
          episodeTitle = episodeTitle.replace(new RegExp(seriesTitle, "ig"), "").trim().replace(/^[\s._-]+/, "").trim();
      }
      if(episodeTitle === "") episodeTitle = undefined;

      seriesTitle = seriesTitle || "Unknown Series";
      episodeTitle = episodeTitle || `Ep. ${episodeNumber || 'Desconhecido'}`;
      break; 
    }
  }
  if (!seasonNumber && !episodeNumber && streamUrl.toLowerCase().includes('/series/')) {
      seriesTitle = titleFromM3U;
      episodeTitle = undefined;
  }

  return {
    seriesTitle: seriesTitle.trim().toUpperCase(),
    seasonNumber,
    episodeNumber,
    episodeTitle: episodeTitle?.trim(),
  };
}


/**
 * Extracts year from a movie title if present in (YYYY) format or as YYYY.
 */
export function extractMovieYear(title: string): number | undefined {
    const yearPattern = /(?:\((\d{4})\)|(?<=\s|^)(\d{4})(?=\s|$|\.\w{3,4}$))/;
    const match = title.match(yearPattern);
    if (match) {
        const yearStr = match[1] || match[2];
        if (yearStr) {
            const year = parseInt(yearStr, 10);
            if (year > 1880 && year < new Date().getFullYear() + 5) {
                return year;
            }
        }
    }
    return undefined;
}


/**
 * Normalizes a raw group title from M3U.
 */
export function normalizeGroupTitle(rawGroupTitle: string | undefined, itemTypeHint?: PlaylistItem['itemType']): string {
  if (!rawGroupTitle || typeof rawGroupTitle !== 'string' || rawGroupTitle.trim() === '') {
    return itemTypeHint === 'channel' ? 'CANAIS DIVERSOS' :
           itemTypeHint === 'movie' ? 'FILMES DIVERSOS' :
           itemTypeHint === 'series_episode' ? 'SÉRIES DIVERSAS' :
           'OUTROS';
  }

  let currentTitle = normalizeText(rawGroupTitle).toUpperCase(); // Normalize accents and case first

  const genericPrefixes = [
    "CANAIS", "CANAL", "TV", "CHANNELS", "CHANNEL",
    "FILMES", "FILME", "MOVIES", "MOVIE", "PELICULAS", "PELICULA",
    "SERIES", "SÉRIES", "SERIE", "SÉRIE", "TV SERIES", "WEB SERIES", "DORAMAS", "DORAMA",
    "ANIMES", "ANIME",
    "CATEGORIA", "GRUPO", "GROUP", "CATEGORY", "TODOS OS", "TODAS AS", "ALL",
    "LISTA", "LIST",
  ];

  let prefixStripped;
  do {
    prefixStripped = false;
    for (const prefix of genericPrefixes) {
      // Match prefix followed by common separators like space, |, :, -, or just the prefix itself if it's at the end of the string
      const regex = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s*[|:\\-–]\\s*|\\s+)?`, 'i');
      const match = currentTitle.match(regex);
      if (match) {
        currentTitle = currentTitle.substring(match[0].length).trim();
        prefixStripped = true;
        break; 
      }
    }
  } while (prefixStripped && currentTitle !== '');

  // Remove leading numerical/hyphen prefixes like "1 - ", "- 1 ", "01.", etc.
  currentTitle = currentTitle.replace(/^[\s._\-–]*\d+[\s._\-–:]*/, '').trim();
  currentTitle = currentTitle.replace(/^[\s._\-–]+/, '').trim(); // Clean up any remaining leading separators

  // Replace all remaining pipe characters (and surrounding spaces) or multiple hyphens/dashes with a single space
  currentTitle = currentTitle.replace(/\s*[|]\s*/g, ' ').trim();
  currentTitle = currentTitle.replace(/\s*[-–]{2,}\s*/g, ' ').trim(); // Multiple hyphens/dashes to one space

  // Remove trailing slashes, hyphens, or dots
  currentTitle = currentTitle.replace(/[\s\/\\._\-–]+$/g, '').trim();
  // Remove leading slashes, hyphens, or dots (again after numerical prefix removal)
  currentTitle = currentTitle.replace(/^[\s\/\\._\-–]+/g, '').trim();


  // Remove common suffixes often related to quality or language, if not already handled
  const suffixesToRemove = [
    /\s\(ADULTOS\)$/i, /\sXXX$/, /\sADULTOS$/,
    /\s\(HD\)$/i, /\sHD$/, /\s\(FHD\)$/i, /\sFHD$/, /\s\(SD\)$/i, /\sSD$/,
    /\s\(4K\)$/i, /\s4K$/, /\s\(UHD\)$/i, /\sUHD$/,
    /\sPT-BR$/, /\sDUBLADO$/, /\sLEGENDADO$/, /\sLATINO$/,
    /\sON DEMAND$/i, /\sVOD$/i
  ];
  for (const suffixRegex of suffixesToRemove) {
    currentTitle = currentTitle.replace(suffixRegex, '').trim();
  }

  // Final cleanup of spaces
  currentTitle = currentTitle.replace(/\s+/g, ' ').trim();

  if (currentTitle === '') {
    let fallback = normalizeText(rawGroupTitle).toUpperCase();
    for (const prefix of genericPrefixes) { // Simple re-strip for fallback
        const regex = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s*[|:\\-–]\\s*|\\s+)?`, 'i');
        const match = fallback.match(regex);
        if (match) {
            fallback = fallback.substring(match[0].length).trim();
        }
    }
    fallback = fallback.replace(/^[\s._\-–]*\d+[\s._\-–:]*/, '').trim();
    fallback = fallback.replace(/\s*[|]\s*/g, ' ').trim();
    fallback = fallback.replace(/[\s\/\\._\-–]+$/g, '').trim();
    fallback = fallback.replace(/^[\s\/\\._\-–]+/g, '').trim();
    fallback = fallback.replace(/\s+/g, ' ').trim();

    return fallback || (itemTypeHint === 'channel' ? 'CANAIS DIVERSOS' :
                        itemTypeHint === 'movie' ? 'FILMES DIVERSOS' :
                        itemTypeHint === 'series_episode' ? 'SÉRIES DIVERSAS' :
                        'OUTROS');
  }
  return currentTitle;
}


export function parseM3U(m3uString: string, playlistDbId: string): PlaylistItem[] {
  const lines = m3uString.split(/\r?\n/);
  const items: PlaylistItem[] = [];
  let currentRawAttributes: Record<string, string> = {};
  let m3uTitleFromLine: string = ''; 
  let streamUrlFromLine: string = '';

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith('#EXTINF:')) {
      currentRawAttributes = {};
      streamUrlFromLine = ''; 
      const infoLineContent = trimmedLine.substring(8); 
      const lastCommaIndex = infoLineContent.lastIndexOf(',');
      
      m3uTitleFromLine = lastCommaIndex > -1 ? infoLineContent.substring(lastCommaIndex + 1).trim() : '';
      const attributesString = lastCommaIndex > -1 ? infoLineContent.substring(0, lastCommaIndex) : infoLineContent.replace(/^-1\s*/, '');

      const attributeRegex = /([a-zA-Z0-9\-._]+)=("[^"]*"|[^\s,]+)/g;
      let match;
      while ((match = attributeRegex.exec(attributesString)) !== null) {
        currentRawAttributes[match[1].toLowerCase()] = match[2].replace(/^"|"$/g, '').trim();
      }
      
      if (!m3uTitleFromLine && currentRawAttributes['tvg-name']) {
        m3uTitleFromLine = currentRawAttributes['tvg-name'];
      } else if (!m3uTitleFromLine && !currentRawAttributes['tvg-name']) {
         // Try to extract a title from the URL if all else fails for this line
        const urlParts = streamUrlFromLine.split('/');
        const lastUrlSegment = urlParts.pop() || '';
        const titleFromUrl = lastUrlSegment.split('.')[0].replace(/[_.-]/g, ' ');
        m3uTitleFromLine = titleFromUrl || "Título Desconhecido";
      }

    } else if (trimmedLine && !trimmedLine.startsWith('#') && !trimmedLine.startsWith('##')) {
      streamUrlFromLine = trimmedLine;

      // If m3uTitleFromLine is still empty here, it means #EXTINF was missing a title and tvg-name
      if (!m3uTitleFromLine) { 
         const urlParts = streamUrlFromLine.split('/');
         const lastUrlSegment = urlParts.pop() || '';
         const titleFromUrl = lastUrlSegment.split('.')[0].replace(/[_.-]/g, ' ');
         m3uTitleFromLine = titleFromUrl || "Título Desconhecido";
      }

      const titleForProcessing = m3uTitleFromLine;
      const tvgNameFromAttr = currentRawAttributes['tvg-name']?.trim();
      const originalGroupTitle = currentRawAttributes['group-title']?.trim();
      const lowerStreamUrl = streamUrlFromLine.toLowerCase();
      const lowerTitleForProcessing = normalizeText(titleForProcessing); // Normalized for keyword checking
      const lowerOriginalGroupTitle = normalizeText(originalGroupTitle || ""); // Normalized for keyword checking
      
      let itemType: PlaylistItem['itemType'];
      let extractedChannelDetails: { baseChannelName: string; quality?: string } | undefined;
      
      // Heuristic: If a name looks like a channel (short, often all caps, may contain quality)
      const isChannelLikeName = (name: string): boolean => {
        const upperName = name.toUpperCase();
        // Check for common quality indicators or if it's short and all caps
        return /\b(FHD|HD|SD|4K|UHD)\b/.test(upperName) || (upperName === name && name.length < 35 && !name.match(/\(\d{4}\)$/));
      };
      const hasSeriesPattern = (name: string): boolean => !!name.match(/[Ss]\d{1,3}[._\s-]*[EeXx]\d{1,3}/i);


      if (lowerStreamUrl.endsWith('.ts') || lowerStreamUrl.endsWith('.m3u8')) { // .m3u8 for HLS channels
        itemType = 'channel';
      } else if (lowerTitleForProcessing.includes('24h')) {
        itemType = 'channel';
      } else if (lowerOriginalGroupTitle.includes('canal')) {
        itemType = 'channel';
      } else if (hasSeriesPattern(titleForProcessing)) {
        itemType = 'series_episode';
      } else if (lowerOriginalGroupTitle.includes('serie') || lowerOriginalGroupTitle.includes('dorama') || lowerOriginalGroupTitle.includes('anime')) {
        itemType = 'series_episode';
      } else if (lowerStreamUrl.includes('.mp4') || lowerStreamUrl.includes('.mkv') || lowerStreamUrl.includes('.avi')) {
        if (isChannelLikeName(titleForProcessing) && !lowerOriginalGroupTitle.includes('filme')) {
          itemType = 'channel';
        } else if (lowerOriginalGroupTitle.includes('filme') || lowerOriginalGroupTitle.includes('movie') || lowerOriginalGroupTitle.includes('pelicula') || extractMovieYear(titleForProcessing) !== undefined) {
          itemType = 'movie';
        } else { // If it's a video file and not clearly movie or channel, default to movie if no other strong indicator.
          itemType = 'movie'; 
        }
      } else {
        // Default for unknown stream types, or if other heuristics point to channel
        if (isChannelLikeName(titleForProcessing)) {
            itemType = 'channel';
        } else {
            itemType = 'channel'; // Fallback default
        }
      }
      
      const item: Partial<PlaylistItem> = {
        playlistDbId,
        title: titleForProcessing, 
        streamUrl: streamUrlFromLine,
        logoUrl: currentRawAttributes['tvg-logo'],
        originalGroupTitle: originalGroupTitle,
        tvgId: currentRawAttributes['tvg-id'],
        tvgName: tvgNameFromAttr || titleForProcessing, 
        itemType,
      };
      
      item.groupTitle = normalizeGroupTitle(originalGroupTitle, item.itemType);

      if (item.itemType === 'channel') {
        extractedChannelDetails = extractChannelDetails(titleForProcessing);
        item.baseChannelName = extractedChannelDetails.baseChannelName;
        item.quality = extractedChannelDetails.quality;
        item.genre = item.groupTitle; 
      } else if (item.itemType === 'series_episode') {
        const { seriesTitle, seasonNumber, episodeNumber, episodeTitle } = extractSeriesDetails(titleForProcessing, streamUrlFromLine);
        item.seriesTitle = seriesTitle;
        item.seasonNumber = seasonNumber;
        item.episodeNumber = episodeNumber;
        item.title = episodeTitle || titleForProcessing; 
        item.genre = item.groupTitle;
        item.year = extractMovieYear(seriesTitle); 
      } else if (item.itemType === 'movie') {
        item.year = extractMovieYear(titleForProcessing);
        item.genre = item.groupTitle; 
      }
      
      if (item.streamUrl && item.title && item.itemType) {
        items.push(item as PlaylistItem);
      }

      currentRawAttributes = {}; 
      m3uTitleFromLine = '';
      streamUrlFromLine = '';
    }
  }
  return items;
}
