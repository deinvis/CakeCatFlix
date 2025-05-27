
import type { PlaylistItem } from '@/lib/constants';
import { normalizeText } from '@/lib/utils'; 

/**
 * Extracts base channel name and quality from a channel title.
 */
export function extractChannelDetails(name: string): { baseChannelName: string; quality?: string } {
  if (!name || typeof name !== 'string') return { baseChannelName: '', quality: undefined };

  let workName = name.trim();
  const extractedQualities: string[] = [];

  // Prioritize longer, more specific patterns first
  const qualityCodecPatterns: { pattern: RegExp, quality: (match: RegExpMatchArray) => string | null }[] = [
    // Common 4K/UHD variations
    { pattern: /\b(4K UHD|UHD 4K|4K|UHD)\b/i, quality: (match) => match[1].toUpperCase().replace(/\s/g, "") },
    // Common FHD/1080p variations
    { pattern: /\b(FHD|FULLHD|FULL HD|1080P|1080I)\b/i, quality: (match) => match[1].toUpperCase().replace("FULLHD", "FHD").replace("FULL HD", "FHD").replace("1080I", "1080P") },
    // Common HD/720p variations
    { pattern: /\b(HDTV|HD|720P|720I)\b/i, quality: (match) => match[1].toUpperCase().replace("HDTV", "HD").replace("720I", "720P") },
    // Common SD variations
    { pattern: /\b(SD|576P|576I|480P|480I)\b/i, quality: (match) => match[1].toUpperCase().replace("576I", "576P").replace("480I", "480P") },
    // Codecs (often appear with quality tags)
    { pattern: /\b(H265|X265|H\.265|HEVC)\b/i, quality: (match) => match[1].toUpperCase().replace("H.265", "H265").replace("X265", "H265") },
    { pattern: /\b(H264|X264|H\.264|AVC)\b/i, quality: (match) => match[1].toUpperCase().replace("H.264", "H264").replace("X264", "H264") },
     // Superscripts, circled numbers, or simple numbers if they are standalone at the end or after quality
    { pattern: /(?:[FHD|HD|SD|4K|UHD]|\b)\s*([²³¹⁰-⁹①-⑩❶-❿]|[1-9])\b/i, quality: (match) => match[1] }, // Handles number after quality or standalone
    { pattern: /\b([²³¹⁰-⁹①-⑩❶-❿])\b/i, quality: (match) => match[1] }, // Standalone special numbers
  ];
  
  let changedInIteration;
  do {
    changedInIteration = false;
    for (const qc of qualityCodecPatterns) {
      const match = workName.match(qc.pattern);
      if (match && match.index !== undefined) {
        const qualityValue = qc.quality(match);
        if (qualityValue !== null) {
            // Avoid adding duplicates or too generic numbers if better quality already found
            if (!extractedQualities.includes(qualityValue) && !(extractedQualities.length > 0 && /^[1-9]$/.test(qualityValue))) {
                 extractedQualities.unshift(qualityValue);
            }
            workName = workName.substring(0, match.index) + (match.index + match[0].length < workName.length ? workName.substring(match.index + match[0].length) : '');
            workName = workName.trim().replace(/--+/g, '-').replace(/-$/, '').trim(); // Clean up leftovers
            changedInIteration = true;
        }
      }
    }
  } while (changedInIteration);
  
  // Further cleanup of common separators or noise, preserve channel numbers
  workName = workName.replace(/[\s._-]+$/, '').trim(); // Remove trailing separators
  workName = workName.replace(/[\[\]()]/g, ' ').replace(/\s+/g, ' ').trim(); // Remove brackets, normalize spaces
  
  // Ensure channel names like "ESPN 2" are not reduced to "ESPN"
  // This part is tricky; the goal is to preserve numbers that are part of the name, not quality.
  // The regex based removal above should handle most quality indicators.
  // What remains is likely the base name.

  const finalBaseChannelName = workName || name.split(',')[0].trim(); // Fallback to original name part if everything is stripped
  const finalQuality = extractedQualities.length > 0 ? extractedQualities.sort().join(' ').trim() : undefined;
  
  return { baseChannelName: finalBaseChannelName, quality: finalQuality };
}


/**
 * Extracts series title, season, and episode number from a title.
 */
export function extractSeriesDetails(titleFromM3U: string, streamUrl: string): { seriesTitle: string; seasonNumber?: number; episodeNumber?: number, episodeTitle?: string } {
  if (!titleFromM3U) return { seriesTitle: "Unknown Series" };

  // Prioritize SxxExx patterns first
  const sxxExxPattern = /^(.*?)(?:[._\s-]*[Ss](\d{1,3})[._\s-]*[EeXx](\d{1,3}))(?:\s*-\s*(.+)|$)/i;
  let match = titleFromM3U.match(sxxExxPattern);

  if (match) {
    let seriesTitle = match[1]?.trim();
    const seasonStr = match[2];
    const episodeStr = match[3];
    let episodeTitle = match[4]?.trim();

    // If seriesTitle is empty after SxxExx match, try to infer it (e.g. if title was "S01E01 - My Episode")
    if (!seriesTitle && titleFromM3U.toUpperCase().startsWith(`S${seasonStr?.padStart(2, '0')}E${episodeStr?.padStart(2,'0')}`)) {
        seriesTitle = "Unknown Series"; // Placeholder if we can't determine it
    } else if (!seriesTitle) {
        seriesTitle = titleFromM3U.split(new RegExp(`[Ss]${seasonStr}[EeXx]${episodeStr}`, "i"))[0].trim() || "Unknown Series";
    }
    
    // Cleanup episode title
    if (episodeTitle && seriesTitle && episodeTitle.toLowerCase().startsWith(seriesTitle.toLowerCase())) {
      episodeTitle = episodeTitle.substring(seriesTitle.length).replace(/^[\s._-]+/, '').trim();
    }
     if (episodeTitle === "") episodeTitle = undefined;


    return {
      seriesTitle: seriesTitle || "Unknown Series",
      seasonNumber: seasonStr ? parseInt(seasonStr, 10) : undefined,
      episodeNumber: episodeStr ? parseInt(episodeStr, 10) : undefined,
      episodeTitle: episodeTitle || `Episódio ${episodeStr || 'N/A'}`,
    };
  }

  // Fallback for titles like "Series Name - Episode Name" or "Series Name: Episode Name"
  // Or even just "Series Name Episode Title" if no strong SxxExx pattern
  const generalSplitPatterns = [
    /(.*?)[\s._-]+[Ss](?:eason)?[\s._]*(\d{1,2})[\s._-]+[Ee](?:pisode)?[\s._]*(\d{1,3})(?:[\s._-]+(.*))?$/i, // Series - Season 01 - Episode 001 - Ep Title
    /(.*?)[\s._-]+(\d{1,2})[xX](\d{1,3})(?:[\s._-]+(.*))?$/i, // Series - 01x01 - Ep Title
    /(.*?)(?:[\s._(]+)?(?:T(\d{1,2}))?[\s._E]+(\d{1,3})(?:[\s.)_-]+(.*))?$/i, // Series T01 E01 Ep Title or Series E01 Ep Title
  ];

  for (const pattern of generalSplitPatterns) {
    match = titleFromM3U.match(pattern);
    if (match) {
      let seriesTitle = match[1]?.trim() || "Unknown Series";
      let seasonStr = match[2];
      let episodeStr = match[3];
      let episodeTitle = match[4]?.trim();

      if (episodeTitle === "") episodeTitle = undefined;

      return {
        seriesTitle: seriesTitle,
        seasonNumber: seasonStr ? parseInt(seasonStr, 10) : undefined, // Season might be optional here
        episodeNumber: episodeStr ? parseInt(episodeStr, 10) : undefined,
        episodeTitle: episodeTitle || `Episódio ${episodeStr || 'N/A'}`,
      };
    }
  }
  
  // If no pattern matched, assume the whole title is the series title (less ideal for episodes)
  // Or, if the URL suggests it's a series episode, we might still try to parse.
  if (streamUrl.toLowerCase().includes('/series/') || streamUrl.toLowerCase().includes(':serie:')) {
     // If it's clearly a series URL but title parsing failed, treat title as series title
     return { seriesTitle: titleFromM3U, episodeTitle: "Episódio Desconhecido" };
  }

  return { seriesTitle: titleFromM3U }; // Default if no series pattern found
}


/**
 * Extracts year from a movie title if present in (YYYY) format or as YYYY.
 */
export function extractMovieYear(title: string): number | undefined {
    // Matches (YYYY) or YYYY if it's a standalone 4-digit number not part of a larger number
    const yearPattern = /(?:\((\d{4})\)|(?<=\s|^)(\d{4})(?=\s|$))/;
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
export function normalizeGroupTitle(rawGroupTitle: string | undefined, itemTypeHint?: PlaylistItem['itemType']): string | undefined {
  if (!rawGroupTitle || typeof rawGroupTitle !== 'string') {
    return itemTypeHint === 'channel' ? 'CANAIS DIVERSOS' : 
           itemTypeHint === 'movie' ? 'FILMES DIVERSOS' :
           itemTypeHint === 'series_episode' ? 'SÉRIES DIVERSAS' : 
           'OUTROS';
  }
  
  let currentTitle = rawGroupTitle.trim();
  if (currentTitle === '') {
    return itemTypeHint === 'channel' ? 'CANAIS DIVERSOS' : 
           itemTypeHint === 'movie' ? 'FILMES DIVERSOS' :
           itemTypeHint === 'series_episode' ? 'SÉRIES DIVERSAS' : 
           'OUTROS';
  }

  // Apply initial normalization (accents, case)
  currentTitle = normalizeText(currentTitle).toUpperCase();

  // Iteratively remove known prefixes
  const prefixesToStrip = [
    "CANAIS | ", "CANAL | ", "TV | ", "TV CHANNELS | ", "CHANNELS | ",
    "FILMES | ", "FILME | ", "MOVIES | ", "MOVIE | ", "PELICULAS | ", "PELICULA | ",
    "SERIES | ", "SÉRIES | ", "SERIE | ", "SÉRIE | ", "TV SERIES | ", "TV SHOWS | ", "WEB SERIES | ",
    "ANIMES | ", "ANIME | ", "DORAMAS | ", "DORAMA | ",
    "CANAIS:", "CANAL:", "TV:", "CHANNELS:",
    "FILMES:", "FILME:", "MOVIES:", "MOVIE:", "PELICULAS:", "PELICULA:",
    "SERIES:", "SÉRIES:", "SERIE:", "SÉRIE:",
    "CATEGORIA:", "GRUPO:", "GROUP:", "CATEGORY:", "TODOS OS ", "TODAS AS ",
    "CANAIS ", "CANAL ", "TV ", "CHANNELS ",
    "FILMES ", "FILME ", "MOVIES ", "MOVIE ", "PELICULAS ", "PELICULA ",
    "SERIES ", "SÉRIES ", "SERIE ", "SÉRIE "
  ];

  let prefixStrippedInLastPass;
  do {
    prefixStrippedInLastPass = false;
    for (const prefix of prefixesToStrip) {
      if (currentTitle.startsWith(prefix)) {
        currentTitle = currentTitle.substring(prefix.length).trim();
        prefixStrippedInLastPass = true;
      }
    }
  } while (prefixStrippedInLastPass && currentTitle !== '');


  // Replace all pipe characters (and surrounding spaces) with a single space
  currentTitle = currentTitle.replace(/\s*\|\s*/g, ' ').trim();
  
  // Remove common suffixes that might indicate quality or type if they were not part of a prefix
  const suffixesToRemove = [
    /\s\(ADULTOS\)$/i, /\sXXX$/, /\sADULTOS$/,
    /\s\(HD\)$/i, /\sHD$/, /\s\(FHD\)$/i, /\sFHD$/, /\s\(SD\)$/i, /\sSD$/,
    /\s\(4K\)$/i, /\s4K$/, /\s\(UHD\)$/i, /\sUHD$/
  ];
  for (const suffixRegex of suffixesToRemove) {
    currentTitle = currentTitle.replace(suffixRegex, '').trim();
  }

  // Normalize multiple spaces to a single space
  currentTitle = currentTitle.replace(/\s+/g, ' ').trim();

  if (currentTitle === '') {
    // If everything was stripped, try a simpler normalization of the original
    let fallback = normalizeText(rawGroupTitle).toUpperCase().replace(/\s*\|\s*/g, ' ').replace(/\s+/g, ' ').trim();
    if (fallback.startsWith("CANAIS ") || fallback.startsWith("FILMES ") || fallback.startsWith("SERIES ")) {
        fallback = fallback.substring(fallback.indexOf(" ") + 1).trim();
    }
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
      streamUrlFromLine = ''; // Reset for the new item
      const infoLineContent = trimmedLine.substring(8);
      const lastCommaIndex = infoLineContent.lastIndexOf(',');
      
      m3uTitleFromLine = lastCommaIndex > -1 ? infoLineContent.substring(lastCommaIndex + 1).trim() : '';
      const attributesString = lastCommaIndex > -1 ? infoLineContent.substring(0, lastCommaIndex) : infoLineContent;

      const attributeRegex = /([a-zA-Z0-9\-._]+)=("[^"]*"|[^\s,]+)/g; // Handle quoted and unquoted attributes
      let match;
      while ((match = attributeRegex.exec(attributesString)) !== null) {
        currentRawAttributes[match[1].toLowerCase()] = match[2].replace(/^"|"$/g, '').trim();
      }
       // If m3uTitleFromLine is empty, it means #EXTINF:-1, (no title after comma)
      // in this case, tvg-name might be intended as the primary title.
      if (!m3uTitleFromLine && currentRawAttributes['tvg-name']) {
        m3uTitleFromLine = currentRawAttributes['tvg-name'];
      } else if (!m3uTitleFromLine && !currentRawAttributes['tvg-name']) {
        m3uTitleFromLine = "Título Desconhecido"; // Fallback if no title info at all
      }


    } else if (trimmedLine && !trimmedLine.startsWith('#') && !trimmedLine.startsWith('##')) {
      streamUrlFromLine = trimmedLine; // This is the stream URL

      if (!m3uTitleFromLine) { // Should have been set by #EXTINF
         console.warn("M3U Parser: Stream URL found without preceding #EXTINF title. Skipping or using fallback.", streamUrlFromLine);
         m3uTitleFromLine = "Título Desconhecido"; // Or skip this item
      }

      // At this point, we have m3uTitleFromLine, currentRawAttributes, and streamUrlFromLine
      // Now, determine itemType and create the PlaylistItem

      const tvgNameFromAttr = currentRawAttributes['tvg-name']?.trim();
      // Prioritize m3uTitleFromLine for processing, as it's often more complete or intended for display
      const titleForProcessing = m3uTitleFromLine || tvgNameFromAttr || "Título Desconhecido";
      
      const originalGroupTitle = currentRawAttributes['group-title']?.trim();
      const lowerStreamUrl = streamUrlFromLine.toLowerCase();
      const normalizedTitleForProcessing = normalizeText(titleForProcessing); // For keyword checks
      const normalizedOriginalGroupTitle = normalizeText(originalGroupTitle || ""); // For keyword checks

      let itemType: PlaylistItem['itemType'];
      
      // 1. Definite Channel Indicators
      if (lowerStreamUrl.endsWith('.ts') || 
          normalizedTitleForProcessing.includes('24h') || 
          normalizedOriginalGroupTitle.includes('canal')) {
        itemType = 'channel';
      }
      // 2. Definite Series Indicators (SxxExx pattern)
      else if (titleForProcessing.match(/[Ss]\d{1,3}[._\s-]*[EeXx]\d{1,3}/i)) {
        itemType = 'series_episode';
      }
      // 3. Channel-like name (even with .mp4 URL)
      else if (lowerStreamUrl.endsWith('.mp4') || lowerStreamUrl.includes('/live/')) { // Consider /live/ as channel too
        const { baseChannelName: tempBaseName } = extractChannelDetails(titleForProcessing);
        const isChannelLike = (tempBaseName.toUpperCase() !== titleForProcessing.toUpperCase() && tempBaseName.length > 0 && tempBaseName.length < titleForProcessing.length -1 ) ||
                              (titleForProcessing === titleForProcessing.toUpperCase() && titleForProcessing.length < 35 && !titleForProcessing.match(/\(\d{4}\)$/)) ||
                              normalizedOriginalGroupTitle.includes('radio');
        
        if (isChannelLike && !(normalizedOriginalGroupTitle.includes('film') || normalizedOriginalGroupTitle.includes('movie') || normalizedOriginalGroupTitle.includes('serie') || normalizedOriginalGroupTitle.includes('dorama') || normalizedOriginalGroupTitle.includes('anime'))) {
          itemType = 'channel';
        }
        // 4. Group-title based for .mp4 (if not series by SxxExx or channel-like name)
        else if (normalizedOriginalGroupTitle.includes('serie') || normalizedOriginalGroupTitle.includes('dorama') || normalizedOriginalGroupTitle.includes('anime')) {
          itemType = 'series_episode';
        } else if (normalizedOriginalGroupTitle.includes('film') || normalizedOriginalGroupTitle.includes('movie') || normalizedOriginalGroupTitle.includes('pelicula')) {
          itemType = 'movie';
        } 
        // 5. Fallback for .mp4 if no strong indicators
        else if (extractMovieYear(titleForProcessing) !== undefined) {
           itemType = 'movie';
        } else {
           // If it's an .mp4 but doesn't fit other categories strongly, default to movie if group is generic, otherwise channel if group hints at it
           if (normalizedOriginalGroupTitle.length === 0 || normalizedOriginalGroupTitle.includes("diversos") || normalizedOriginalGroupTitle.includes("variedades")) {
             itemType = 'movie'; // Generic .mp4 could be a movie
           } else {
             itemType = 'channel'; // Or a channel with an mp4 stream in a specific group
           }
        }
      }
      // 6. Default for other stream types (not .ts, not common video extensions if not caught above)
      else {
        itemType = 'channel'; 
      }

      const item: Partial<PlaylistItem> = {
        playlistDbId,
        title: titleForProcessing, // Use the more complete title for the item itself
        streamUrl: streamUrlFromLine,
        logoUrl: currentRawAttributes['tvg-logo'],
        originalGroupTitle: originalGroupTitle,
        tvgId: currentRawAttributes['tvg-id'],
        tvgName: tvgNameFromAttr, // Store the specific tvg-name attribute if present
        itemType,
      };
      
      item.groupTitle = normalizeGroupTitle(originalGroupTitle, item.itemType);

      if (item.itemType === 'channel') {
        const { baseChannelName, quality } = extractChannelDetails(titleForProcessing); // Process the display title
        item.baseChannelName = baseChannelName;
        item.quality = quality;
        item.genre = item.groupTitle; // Channel's "genre" is its normalized group
      } else if (item.itemType === 'series_episode') {
        const { seriesTitle, seasonNumber, episodeNumber, episodeTitle } = extractSeriesDetails(titleForProcessing, streamUrlFromLine);
        item.seriesTitle = seriesTitle;
        item.seasonNumber = seasonNumber;
        item.episodeNumber = episodeNumber;
        item.title = episodeTitle || titleForProcessing; // Use specific episode title if available, else full title
        item.genre = item.groupTitle;
        item.year = extractMovieYear(titleForProcessing); // Some series might have a general year in their M3U entry title
      } else if (item.itemType === 'movie') {
        item.year = extractMovieYear(titleForProcessing);
        item.genre = item.groupTitle; 
      }
      
      if (item.streamUrl && item.title && item.itemType) {
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

