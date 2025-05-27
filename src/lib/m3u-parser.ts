
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

  // Define explicit quality/codec patterns. Order can matter: longer/more specific first.
  const qualityCodecPatterns: { regex: RegExp; qualityLabel: string }[] = [
    // Combined and specific (like 4K UHD)
    { regex: /\b(4K\s*UHD|UHD\s*4K|4K|UHD)\b/gi, qualityLabel: "4K" },
    { regex: /\b(FULL\s*HD|FULLHD|FHD|1080P|1080I)\b/gi, qualityLabel: "FHD" },
    { regex: /\b(HDTV|HD|720P|720I)\b/gi, qualityLabel: "HD" },
    { regex: /\b(SDTV|SD|576P|576I|480P|480I)\b/gi, qualityLabel: "SD" },
    { regex: /\b(H265|X265|H\.265|HEVC)\b/gi, qualityLabel: "H265" },
    { regex: /\b(H264|X264|H\.264|AVC)\b/gi, qualityLabel: "H264" },
    // Special symbols often indicating quality variation or secondary stream
    // Matches: ², ¹, ³, ⁰-⁹ (superscript numbers), ①-⑩ (circled numbers), ❶-❿ (dingbat circled numbers)
    { regex: /([²¹³⁰¹²³⁴⁵⁶⁷⁸⁹]|[①②③④⑤⑥⑦⑧⑨⑩]|[❶❷❸❹❺❻❼❽❾❿])\b?/gi, qualityLabel: "$1" }
  ];


  for (const { regex, qualityLabel } of qualityCodecPatterns) {
    workName = workName.replace(regex, (match, p1) => {
      let quality = qualityLabel;
      if (p1 && qualityLabel.includes("$1") && qualityLabel !== "$1") { // Avoid if label is just the capture
         quality = qualityLabel.replace("$1", p1.toUpperCase());
      } else if (p1 && qualityLabel === "$1"){
         quality = p1.toUpperCase();
      }

      if (!extractedQualities.includes(quality.toUpperCase())) {
        extractedQualities.push(quality.toUpperCase());
      }
      return ''; // Remove the matched part
    });
    workName = workName.replace(/\s+/g, ' ').trim(); // Trim after each replacement
  }

  // Clean up common separators only if they are now at the end or appear as multiple
  workName = workName.replace(/[._\-\s]+$/g, '').trim();
  workName = workName.replace(/^[._\-\s]+/g, '').trim();
  
  // Remove parentheses/brackets only if they are now empty or surround only spaces
  workName = workName.replace(/\(\s*\)/g, '').trim();
  workName = workName.replace(/\[\s*\]/g, '').trim();
  
  // Preserve channel names like "ESPN 2", "SPORTV 3"
  // The main name part, including numbers that are part of the name, should remain.
  // This logic assumes quality tags are already removed.
  const baseChannelName = workName.replace(/\s+/g, ' ').trim(); // Normalize multiple internal spaces

  const finalBaseChannelName = baseChannelName || name.trim().split(/[|(]/)[0].trim();
  const finalQuality = extractedQualities.length > 0 ? extractedQualities.sort().join(' ').trim() : undefined;

  return { baseChannelName: finalBaseChannelName.toUpperCase(), quality: finalQuality };
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
      
      if (seriesTitle.toUpperCase().startsWith(`S${String(seasonNumber||'').padStart(2,'0')}E${String(episodeNumber||'').padStart(2,'0')}`) || 
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
    seriesTitle: seriesTitle.trim(),
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

  // More comprehensive list of prefixes, including those with numbers and separators
  const prefixesToStrip = [
    "CANAIS | ", "CANAL | ", "TV | ", "CHANNELS | ", "CHANNEL | ",
    "FILMES | ", "FILME | ", "MOVIES | ", "MOVIE | ", "PELICULAS | ", "PELICULA | ",
    "SERIES | ", "SÉRIES | ", "SERIE | ", "SÉRIE | ", "TV SERIES | ", "TV SHOWS | ", "WEB SERIES | ",
    "ANIMES | ", "ANIME | ", "DORAMAS | ", "DORAMA | ",
    "CANAIS:", "CANAL:", "TV:", "CHANNELS:", "CHANNEL:",
    "FILMES:", "FILME:", "MOVIES:", "MOVIE:", "PELICULAS:", "PELICULA:",
    "SERIES:", "SÉRIES:", "SERIE:", "SÉRIE:", "TV SERIES:", "WEB SERIES:",
    "ANIMES:", "ANIME:", "DORAMAS:", "DORAMA:",
    "CATEGORIA:", "GRUPO:", "GROUP:", "CATEGORY:", "TODOS OS ", "TODAS AS ", "ALL ",
    // Generic terms after specific ones with separators
    "CANAIS ", "CANAL ", "TV ", "CHANNELS ", "CHANNEL ",
    "FILMES ", "FILME ", "MOVIES ", "MOVIE ", "PELICULAS ", "PELICULA ",
    "SERIES ", "SÉRIES ", "SERIE ", "SÉRIE ", "TV SERIES ", "WEB SERIES ",
    "ANIMES ", "ANIME ", "DORAMAS ", "DORAMA ",
    // Numerical and hyphen/dash prefixes
    /^\s*-\s*\d+\s*-\s*/, /^\s*-\s*\d+\s*/, 
    /^\s*\d+\s*-\s*/, /^\s*\d+\s*–\s*/, // en-dash
    /^\s*\d+\s*:\s*/, /^\s*\d+\s*\|\s*/,
    /^\s*\d+\s+/, // Numbers followed by space
    /^\s*-\s*/, // Leading hyphen and space
    /^\s*\[\w+\]\s*/, // Prefixes like [BR]
  ];

  let prefixStripped;
  do {
    prefixStripped = false;
    for (const prefix of prefixesToStrip) {
      if (typeof prefix === 'string') {
        if (currentTitle.startsWith(prefix.toUpperCase())) {
          currentTitle = currentTitle.substring(prefix.length).trim();
          prefixStripped = true;
          break; 
        }
      } else { // Regex prefix
        const match = currentTitle.match(prefix);
        if (match && currentTitle.startsWith(match[0])) {
          currentTitle = currentTitle.substring(match[0].length).trim();
          prefixStripped = true;
          break;
        }
      }
    }
  } while (prefixStripped && currentTitle !== '');
  
  // Replace all remaining pipe characters (and surrounding spaces) with a single space
  currentTitle = currentTitle.replace(/\s*\|\s*/g, ' ').trim();
  // Remove trailing slashes and then trim
  currentTitle = currentTitle.replace(/\s*\/{1,}\s*$/g, '').trim();


  // Remove common suffixes
  const suffixesToRemove = [
    /\s\(ADULTOS\)$/i, /\sXXX$/, /\sADULTOS$/,
    /\s\(HD\)$/i, /\sHD$/, /\s\(FHD\)$/i, /\sFHD$/, /\s\(SD\)$/i, /\sSD$/,
    /\s\(4K\)$/i, /\s4K$/, /\s\(UHD\)$/i, /\sUHD$/,
    /\sPT-BR$/, /\sDUBLADO$/, /\sLEGENDADO$/, /\sLATINO$/,
  ];
  for (const suffixRegex of suffixesToRemove) {
    currentTitle = currentTitle.replace(suffixRegex, '').trim();
  }

  // Final cleanup of spaces
  currentTitle = currentTitle.replace(/\s+/g, ' ').trim();

  if (currentTitle === '') {
    let fallback = normalizeText(rawGroupTitle).toUpperCase();
    // Re-run a simplified prefix strip on fallback
    for (const prefix of ["CANAIS | ", "FILMES | ", "SERIES | ", "CANAL ", "FILME ", "SERIE "]) {
        if (fallback.startsWith(prefix.toUpperCase())) {
            fallback = fallback.substring(prefix.length).trim();
        }
    }
    fallback = fallback.replace(/\s*\|\s*/g, ' ').trim();
    fallback = fallback.replace(/\s*\/{1,}\s*$/g, '').trim();
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
        m3uTitleFromLine = "Título Desconhecido";
      }

    } else if (trimmedLine && !trimmedLine.startsWith('#') && !trimmedLine.startsWith('##')) {
      streamUrlFromLine = trimmedLine;

      if (!m3uTitleFromLine) { 
         m3uTitleFromLine = streamUrlFromLine.split('/').pop() || "Título Desconhecido";
      }

      const titleForProcessing = m3uTitleFromLine; 
      const tvgNameFromAttr = currentRawAttributes['tvg-name']?.trim();
      const originalGroupTitle = currentRawAttributes['group-title']?.trim();
      const lowerStreamUrl = streamUrlFromLine.toLowerCase();
      const lowerTitleForProcessing = normalizeText(titleForProcessing);
      const lowerOriginalGroupTitle = normalizeText(originalGroupTitle || "");
      
      let itemType: PlaylistItem['itemType'];
      let extractedChannelDetails: { baseChannelName: string; quality?: string } = { baseChannelName: titleForProcessing, quality: undefined };
      
      const isChannelByName = () => lowerTitleForProcessing.includes('24h') || (titleForProcessing.match(/\b(FHD|HD|SD|4K|UHD|H265|H264|HEVC|AVC|1080P|720P)\b/i) || (titleForProcessing === titleForProcessing.toUpperCase() && titleForProcessing.length < 35 && !titleForProcessing.match(/\(\d{4}\)$/)));
      const isSeriesByName = () => !!titleForProcessing.match(/[Ss]\d{1,3}[._\s-]*[EeXx]\d{1,3}/i);

      if (lowerStreamUrl.endsWith('.ts') || lowerOriginalGroupTitle.includes('canal') || lowerTitleForProcessing.includes('24h')) {
        itemType = 'channel';
        extractedChannelDetails = extractChannelDetails(titleForProcessing);
      } else if (isSeriesByName()) {
        itemType = 'series_episode';
      } else if (isChannelByName() && !lowerOriginalGroupTitle.includes('filme') && !lowerOriginalGroupTitle.includes('serie')) {
        itemType = 'channel';
        extractedChannelDetails = extractChannelDetails(titleForProcessing);
      } else if (lowerStreamUrl.includes('.mp4') || lowerStreamUrl.includes('.mkv') || lowerStreamUrl.includes('.avi')) {
        if (lowerOriginalGroupTitle.includes('serie') || lowerOriginalGroupTitle.includes('dorama') || lowerOriginalGroupTitle.includes('anime')) {
          itemType = 'series_episode';
        } else if (lowerOriginalGroupTitle.includes('filme') || lowerOriginalGroupTitle.includes('movie') || lowerOriginalGroupTitle.includes('pelicula')) {
          itemType = 'movie';
        } else if (extractMovieYear(titleForProcessing) !== undefined) {
           itemType = 'movie';
        } else {
           itemType = 'movie'; 
        }
      } else {
        itemType = 'channel'; // Default for unknown stream types
        extractedChannelDetails = extractChannelDetails(titleForProcessing);
      }

      const item: Partial<PlaylistItem> = {
        playlistDbId,
        title: titleForProcessing, 
        streamUrl: streamUrlFromLine,
        logoUrl: currentRawAttributes['tvg-logo'],
        originalGroupTitle: originalGroupTitle,
        tvgId: currentRawAttributes['tvg-id'],
        tvgName: tvgNameFromAttr || titleForProcessing, // Fallback tvgName to title if not present
        itemType,
      };
      
      item.groupTitle = normalizeGroupTitle(originalGroupTitle, item.itemType);

      if (item.itemType === 'channel') {
        item.baseChannelName = extractedChannelDetails.baseChannelName.toUpperCase();
        item.quality = extractedChannelDetails.quality;
        item.genre = item.groupTitle; 
      } else if (item.itemType === 'series_episode') {
        const { seriesTitle, seasonNumber, episodeNumber, episodeTitle } = extractSeriesDetails(titleForProcessing, streamUrlFromLine);
        item.seriesTitle = seriesTitle.toUpperCase();
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
        if (item.itemType === 'channel' && !item.baseChannelName) {
            item.baseChannelName = extractChannelDetails(item.title).baseChannelName.toUpperCase();
        }
        if (item.itemType === 'series_episode' && !item.seriesTitle) {
            item.seriesTitle = extractSeriesDetails(item.title, item.streamUrl).seriesTitle.toUpperCase();
        }
        items.push(item as PlaylistItem);
      }

      currentRawAttributes = {}; 
      m3uTitleFromLine = '';
      streamUrlFromLine = '';
    }
  }
  return items;
}

    
