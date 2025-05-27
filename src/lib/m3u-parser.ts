
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
  // These patterns should ideally match standalone tags.
  const qualityPatterns: { regex: RegExp; qualityLabel: string }[] = [
    // Combined and specific (like 4K UHD)
    { regex: /\b4K\s*UHD\b/gi, qualityLabel: "4K UHD" }, // More specific
    { regex: /\bUHD\s*4K\b/gi, qualityLabel: "UHD 4K" },
    { regex: /\b(4K|UHD)\b/gi, qualityLabel: "$1" }, // Matches 4K or UHD

    // Full HD and variants
    { regex: /\bFULL\s*HD\b/gi, qualityLabel: "FHD" },
    { regex: /\b(FHD|FULLHD)\b/gi, qualityLabel: "FHD" },
    { regex: /\b1080P\b/gi, qualityLabel: "1080P" },
    { regex: /\b1080I\b/gi, qualityLabel: "1080I" },

    // HD and variants
    { regex: /\bHDTV\b/gi, qualityLabel: "HD" },
    { regex: /\bHD\b/gi, qualityLabel: "HD" }, // General HD
    { regex: /\b720P\b/gi, qualityLabel: "720P" },
    { regex: /\b720I\b/gi, qualityLabel: "720I" },
    
    // SD and variants
    { regex: /\bSDTV\b/gi, qualityLabel: "SD" },
    { regex: /\bSD\b/gi, qualityLabel: "SD" }, // General SD
    { regex: /\b576P\b/gi, qualityLabel: "576P" },
    { regex: /\b576I\b/gi, qualityLabel: "576I" },
    { regex: /\b480P\b/gi, qualityLabel: "480P" },
    { regex: /\b480I\b/gi, qualityLabel: "480I" },

    // Codecs
    { regex: /\b(H265|X265|H\.265|HEVC)\b/gi, qualityLabel: "H265" },
    { regex: /\b(H264|X264|H\.264|AVC)\b/gi, qualityLabel: "H264" },
    
    // Special symbols often indicating quality variation or secondary stream
    { regex: /\b([²³¹⁰-⁹]|[①-⑩]|[❶-❿])\b/g, qualityLabel: "$1" }
  ];

  // Iteratively remove quality tags from the workName
  for (const { regex, qualityLabel } of qualityPatterns) {
    workName = workName.replace(regex, (match, p1) => {
      let quality = qualityLabel;
      if (p1 && qualityLabel.includes("$1")) { // If qualityLabel uses a capture group
        quality = p1;
      }
      
      // Normalize common variations within the label itself
      if (quality.toUpperCase() === "4K UHD" || quality.toUpperCase() === "UHD 4K") quality = "4K";
      else if (quality.toUpperCase() === "FULLHD") quality = "FHD";
      else if (quality.toUpperCase() === "HDTV") quality = "HD";
      else if (quality.toUpperCase() === "SDTV") quality = "SD";
      else if (quality.toUpperCase() === "H.265" || quality.toUpperCase() === "X265") quality = "H265";
      else if (quality.toUpperCase() === "H.264" || quality.toUpperCase() === "X264") quality = "H264";

      if (!extractedQualities.includes(quality.toUpperCase())) {
        extractedQualities.push(quality.toUpperCase());
      }
      return ''; // Remove the matched part
    });
    workName = workName.trim(); // Trim after each replacement
  }

  // Clean up common separators (multiple spaces, dots, hyphens, underscores) ONLY if they are now at the end or appear as multiple
  workName = workName.replace(/[._\-\s]+$/g, '').trim(); // Remove trailing separators
  workName = workName.replace(/^[._\-\s]+/g, '').trim(); // Remove leading separators
  workName = workName.replace(/\s+/g, ' ').trim(); // Normalize multiple internal spaces

  // Remove parentheses only if they are now empty or surround only spaces after quality removal
  workName = workName.replace(/\(\s*\)/g, '').trim();
  // Remove brackets similarly
  workName = workName.replace(/\[\s*\]/g, '').trim();

  // If workName becomes empty, fallback to a processed version of original name
  const finalBaseChannelName = workName || name.trim().split(/[|(]/)[0].trim();

  // Sort qualities for consistency (e.g., FHD H265 vs H265 FHD)
  const finalQuality = extractedQualities.sort().join(' ').trim() || undefined;

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
      seriesTitle = match[1]?.trim() || titleFromM3U; // Fallback to full title if series part is empty
      const seasonStr = match[2];
      const episodeStr = match[3];
      episodeTitle = match[4]?.trim();

      if (seasonStr) seasonNumber = parseInt(seasonStr, 10);
      if (episodeStr) episodeNumber = parseInt(episodeStr, 10);
      
      // Clean up seriesTitle if it matched too much (e.g. if original was "S01E01 - My Show - Episode Name")
      if (seriesTitle.toUpperCase().startsWith(`S${String(seasonNumber||'').padStart(2,'0')}E${String(episodeNumber||'').padStart(2,'0')}`) || 
          seriesTitle.toUpperCase().startsWith(`SEASON ${seasonNumber||''} EPISODE ${episodeNumber||''}`) ||
          seriesTitle.toUpperCase().startsWith(`${seasonNumber||''}X${episodeNumber||''}`)
      ) {
        seriesTitle = titleFromM3U.split(match[0].replace(match[1],'').trim())[0].trim() || "Unknown Series"; // Try to get part before SxxExx
      }


      if (seriesTitle === "" && episodeTitle) { // If title was "S01E01 - Episode Name"
          seriesTitle = "Unknown Series"; // Cannot determine series name from this format alone
      }
      
      // If episodeTitle is just the seriesTitle repeated, or part of it.
      if (episodeTitle && seriesTitle !== "Unknown Series" && episodeTitle.toLowerCase().includes(seriesTitle.toLowerCase())) {
          episodeTitle = episodeTitle.replace(new RegExp(seriesTitle, "ig"), "").trim().replace(/^[\s._-]+/, "").trim();
      }
      if(episodeTitle === "") episodeTitle = undefined;


      // Ensure seriesTitle is not empty if we extracted season/episode
      seriesTitle = seriesTitle || "Unknown Series";
      episodeTitle = episodeTitle || `Ep. ${episodeNumber || 'Desconhecido'}`;
      break; 
    }
  }
  if (!seasonNumber && !episodeNumber && streamUrl.toLowerCase().includes('/series/')) {
      // If it's a series URL but no S/E parsed from title, title is likely series title.
      // This helps with Xtream 'series' type that are overviews.
      seriesTitle = titleFromM3U;
      episodeTitle = undefined; // No specific episode info
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
    // Matches (YYYY) or YYYY if it's a standalone 4-digit number not part of a larger number
    const yearPattern = /(?:\((\d{4})\)|(?<=\s|^)(\d{4})(?=\s|$|\.\w{3,4}$))/; // Added check for end of string or file extension
    const match = title.match(yearPattern);
    if (match) {
        const yearStr = match[1] || match[2];
        if (yearStr) {
            const year = parseInt(yearStr, 10);
            // Basic sanity check for year range
            if (year > 1880 && year < new Date().getFullYear() + 5) {
                return year;
            }
        }
    }
    return undefined;
}


/**
 * Normalizes a raw group title from M3U.
 * Aims to produce cleaner category names for display.
 */
export function normalizeGroupTitle(rawGroupTitle: string | undefined, itemTypeHint?: PlaylistItem['itemType']): string {
  if (!rawGroupTitle || typeof rawGroupTitle !== 'string') {
    return itemTypeHint === 'channel' ? 'CANAIS DIVERSOS' :
           itemTypeHint === 'movie' ? 'FILMES DIVERSOS' :
           itemTypeHint === 'series_episode' ? 'SÉRIES DIVERSAS' :
           'OUTROS';
  }

  let currentTitle = normalizeText(rawGroupTitle).toUpperCase(); // Normalize accents and case first

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
    // More generic terms after specific ones with separators
    "CANAIS ", "CANAL ", "TV ", "CHANNELS ", "CHANNEL ",
    "FILMES ", "FILME ", "MOVIES ", "MOVIE ", "PELICULAS ", "PELICULA ",
    "SERIES ", "SÉRIES ", "SERIE ", "SÉRIE ", "TV SERIES ", "WEB SERIES ",
    "ANIMES ", "ANIME ", "DORAMAS ", "DORAMA ",
  ];

  let prefixStripped;
  do {
    prefixStripped = false;
    for (const prefix of prefixesToStrip) {
      if (currentTitle.startsWith(prefix)) {
        currentTitle = currentTitle.substring(prefix.length).trim();
        prefixStripped = true;
        break; // Restart with the new shorter title to check prefixes again
      }
    }
  } while (prefixStripped && currentTitle !== '');

  // Replace all remaining pipe characters (and surrounding spaces) with a single space
  currentTitle = currentTitle.replace(/\s*\|\s*/g, ' ').trim();
  
  // Remove common suffixes that might indicate quality or type (already handled for channels mostly)
  // This is more for group titles that might embed such info.
  const suffixesToRemove = [
    /\s\(ADULTOS\)$/i, /\sXXX$/, /\sADULTOS$/,
    /\s\(HD\)$/i, /\sHD$/, /\s\(FHD\)$/i, /\sFHD$/, /\s\(SD\)$/i, /\sSD$/,
    /\s\(4K\)$/i, /\s4K$/, /\s\(UHD\)$/i, /\sUHD$/,
    /\sPT-BR$/, /\sDUBLADO$/, /\sLEGENDADO$/, /\sLATINO$/,
  ];
  for (const suffixRegex of suffixesToRemove) {
    currentTitle = currentTitle.replace(suffixRegex, '').trim();
  }

  // Normalize multiple spaces to a single space
  currentTitle = currentTitle.replace(/\s+/g, ' ').trim();

  if (currentTitle === '') {
    let fallback = normalizeText(rawGroupTitle).toUpperCase().replace(/\s*\|\s*/g, ' ').replace(/\s+/g, ' ').trim();
    // Attempt a more aggressive fallback cleanup if primary logic resulted in empty string
    for (const prefix of prefixesToStrip) {
        if (fallback.startsWith(prefix)) {
            fallback = fallback.substring(prefix.length).trim();
        }
    }
    fallback = fallback.replace(/\s*\|\s*/g, ' ').trim();

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
  let m3uTitleFromLine: string = ''; // The text after the last comma in #EXTINF
  let streamUrlFromLine: string = '';

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith('#EXTINF:')) {
      currentRawAttributes = {};
      streamUrlFromLine = ''; 
      const infoLineContent = trimmedLine.substring(8); // Content after #EXTINF:
      const lastCommaIndex = infoLineContent.lastIndexOf(',');
      
      // Title is the part after the last comma
      m3uTitleFromLine = lastCommaIndex > -1 ? infoLineContent.substring(lastCommaIndex + 1).trim() : '';
      // Attributes are before the last comma (or the whole string if no comma after duration)
      const attributesString = lastCommaIndex > -1 ? infoLineContent.substring(0, lastCommaIndex) : infoLineContent.replace(/^-1\s*/, '');


      const attributeRegex = /([a-zA-Z0-9\-._]+)=("[^"]*"|[^\s,]+)/g;
      let match;
      while ((match = attributeRegex.exec(attributesString)) !== null) {
        currentRawAttributes[match[1].toLowerCase()] = match[2].replace(/^"|"$/g, '').trim();
      }
      
      // If m3uTitleFromLine is empty (e.g. #EXTINF:-1 tvg-name="Title"), prioritize tvg-name
      if (!m3uTitleFromLine && currentRawAttributes['tvg-name']) {
        m3uTitleFromLine = currentRawAttributes['tvg-name'];
      } else if (!m3uTitleFromLine && !currentRawAttributes['tvg-name']) {
        m3uTitleFromLine = "Título Desconhecido"; // Fallback if no title info
      }

    } else if (trimmedLine && !trimmedLine.startsWith('#') && !trimmedLine.startsWith('##')) {
      streamUrlFromLine = trimmedLine; // This is the stream URL

      if (!m3uTitleFromLine) { 
         console.warn("M3U Parser: Stream URL found without preceding #EXTINF title. Using URL as title.", streamUrlFromLine);
         m3uTitleFromLine = streamUrlFromLine.split('/').pop() || "Título Desconhecido";
      }

      // Use m3uTitleFromLine as the primary source for display and detail extraction.
      // tvg-name is stored separately for reference or EPG.
      const titleForProcessing = m3uTitleFromLine;
      const tvgNameFromAttr = currentRawAttributes['tvg-name']?.trim();
      
      const originalGroupTitle = currentRawAttributes['group-title']?.trim();
      const lowerStreamUrl = streamUrlFromLine.toLowerCase();
      const normalizedTitleForProcessing = normalizeText(titleForProcessing); 
      const normalizedOriginalGroupTitle = normalizeText(originalGroupTitle || "");

      let itemType: PlaylistItem['itemType'];
      let extractedChannelDetails = { baseChannelName: titleForProcessing, quality: undefined };

      // 1. Definite Channel Indicators
      if (lowerStreamUrl.endsWith('.ts') || 
          normalizedTitleForProcessing.includes('24h') || 
          normalizedOriginalGroupTitle.includes('canal') || // "canal" or "canais"
          normalizedOriginalGroupTitle.includes('radio') // "radio" or "radios"
         ) {
        itemType = 'channel';
        extractedChannelDetails = extractChannelDetails(titleForProcessing);
      }
      // 2. Definite Series Indicators (SxxExx pattern)
      else if (titleForProcessing.match(/[Ss]\d{1,3}[._\s-]*[EeXx]\d{1,3}/i)) {
        itemType = 'series_episode';
      }
      // 3. Channel-like name (even with .mp4 URL or other extensions)
      // This is a heuristic - checks if extractChannelDetails found a quality tag or if name is short & uppercase.
      else if (
        !titleForProcessing.match(/[Ss]\d{1,3}[._\s-]*[EeXx]\d{1,3}/i) && // Not already classified as series
        (titleForProcessing.match(/\b(FHD|HD|SD|4K|UHD|H265|H264|HEVC|AVC|1080P|720P)\b/i) ||
         (titleForProcessing === titleForProcessing.toUpperCase() && titleForProcessing.length < 35 && !titleForProcessing.match(/\(\d{4}\)$/)))
        ) {
        extractedChannelDetails = extractChannelDetails(titleForProcessing);
        // If baseName significantly differs from original (meaning quality was stripped) or group is channel-like
        if (extractedChannelDetails.baseChannelName.toUpperCase() !== titleForProcessing.toUpperCase() || normalizedOriginalGroupTitle.includes('tv')) {
          itemType = 'channel';
        } else if (normalizedOriginalGroupTitle.includes('filme') || normalizedOriginalGroupTitle.includes('movie') || normalizedOriginalGroupTitle.includes('pelicula')) {
            itemType = 'movie';
        } else if (normalizedOriginalGroupTitle.includes('serie') || normalizedOriginalGroupTitle.includes('dorama') || normalizedOriginalGroupTitle.includes('anime')) {
            itemType = 'series_episode';
        } else {
           itemType = 'channel'; // Default to channel if name is channel-like but group is generic
        }
      }
      // 4. Group-title based for .mp4 (if not series by SxxExx or channel-like name)
      else if (lowerStreamUrl.includes('.mp4') || lowerStreamUrl.includes('.mkv') || lowerStreamUrl.includes('.avi')) {
        if (normalizedOriginalGroupTitle.includes('serie') || normalizedOriginalGroupTitle.includes('dorama') || normalizedOriginalGroupTitle.includes('anime')) {
          itemType = 'series_episode';
        } else if (normalizedOriginalGroupTitle.includes('filme') || normalizedOriginalGroupTitle.includes('movie') || normalizedOriginalGroupTitle.includes('pelicula')) {
          itemType = 'movie';
        } 
        // 5. Fallback for .mp4 if no strong group indicators but has year -> movie
        else if (extractMovieYear(titleForProcessing) !== undefined) {
           itemType = 'movie';
        } else {
           // Default .mp4 without strong indicators to movie
           itemType = 'movie'; 
        }
      }
      // 6. Default for other stream types (not .ts, not common video extensions if not caught above)
      else {
        itemType = 'channel'; // Default to channel for unknown stream types
        extractedChannelDetails = extractChannelDetails(titleForProcessing);
      }

      const item: Partial<PlaylistItem> = {
        playlistDbId,
        title: titleForProcessing, 
        streamUrl: streamUrlFromLine,
        logoUrl: currentRawAttributes['tvg-logo'],
        originalGroupTitle: originalGroupTitle,
        tvgId: currentRawAttributes['tvg-id'],
        tvgName: tvgNameFromAttr, 
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
        item.title = episodeTitle || titleForProcessing; // Use specific episode title if available
        item.genre = item.groupTitle;
        item.year = extractMovieYear(seriesTitle); // Series might have a release year
      } else if (item.itemType === 'movie') {
        item.year = extractMovieYear(titleForProcessing);
        item.genre = item.groupTitle; 
        // Movie title is already titleForProcessing
      }
      
      if (item.streamUrl && item.title && item.itemType) {
        // Ensure critical fields for specific types are present, e.g. baseChannelName for channels
        if (item.itemType === 'channel' && !item.baseChannelName) {
            item.baseChannelName = extractChannelDetails(item.title).baseChannelName.toUpperCase();
        }
        if (item.itemType === 'series_episode' && !item.seriesTitle) {
            item.seriesTitle = extractSeriesDetails(item.title, item.streamUrl).seriesTitle.toUpperCase();
        }
        items.push(item as PlaylistItem);
      }

      // Reset for next #EXTINF block
      currentRawAttributes = {}; 
      m3uTitleFromLine = '';
      streamUrlFromLine = '';
    }
  }
  return items;
}

    