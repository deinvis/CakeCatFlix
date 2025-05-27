
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

  // Define explicit quality indicators and codecs to remove.
  // Order matters: more specific/longer ones first.
  const qualityCodecPatterns: { regex: RegExp; qualityLabel: string }[] = [
    { regex: /\b(4K\s*UHD|UHD\s*4K|4K|ULTRA\s*HD|UHD)\b/gi, qualityLabel: "4K" },
    { regex: /\b(FULL\s*HD|FULLHD|FHD|1080P|1080I)\b/gi, qualityLabel: "FHD" },
    { regex: /\b(HDTV|HD|720P|720I)\b/gi, qualityLabel: "HD" },
    { regex: /\b(SDTV|SD|576P|576I|480P|480I)\b/gi, qualityLabel: "SD" },
    { regex: /\b(HEVC|H265|H\.265|X265)\b/gi, qualityLabel: "H265" },
    { regex: /\b(AVC|H264|H\.264|X264)\b/gi, qualityLabel: "H264" },
    // Superscripts and circled numbers - ensure these are treated as quality if they appear quality-like
    { regex: /\b([²³¹⁰¹²³⁴⁵⁶⁷⁸⁹])\b/g, qualityLabel: "$1" },
    { regex: /\b([①②③④⑤⑥⑦⑧⑨⑩])\b/g, qualityLabel: "$1" },
    { regex: /\b([❶❷❸❹❺❻❼❽❾❿])\b/g, qualityLabel: "$1" },
  ];

  for (const { regex, qualityLabel } of qualityCodecPatterns) {
    workName = workName.replace(regex, (match, p1) => {
      let quality = qualityLabel;
      if (p1 && qualityLabel.includes("$1")) { 
        quality = qualityLabel.replace("$1", p1.toUpperCase());
      }
      if (!extractedQualities.includes(quality.toUpperCase())) {
        extractedQualities.push(quality.toUpperCase());
      }
      return ''; 
    });
  }
  
  // Clean up: remove extra spaces, leading/trailing non-alphanumeric for base name
  // Preserve numbers if they are part of the channel name (e.g., "ESPN 2")
  let baseChannelName = workName
    .replace(/[|()[\]]/g, ' ') // Replace common separators with space
    .replace(/\s+/g, ' ')    // Normalize multiple spaces to one
    .trim();

  // If baseChannelName is empty after all removals, fall back to the original name,
  // trying to strip just the very end if it looks like a quality pattern that was missed.
  if (!baseChannelName) {
    const originalNameParts = name.trim().split(/[|(]/);
    baseChannelName = originalNameParts[0].trim();
    if (!baseChannelName) baseChannelName = name.trim(); // Ultimate fallback
  }

  // Sort qualities for consistent representation
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
  // More robust patterns to capture series title before SxxExx or similar
  const patterns = [
    // SxxExx - Episode Title (captures series name before SxxExx)
    /^(.*?)(?:[\s._-]*[Ss](\d{1,3})[._\s-]*[EeXx](\d{1,3}))(?:[\s._-]*(.+))?$/i,
    // Series Title - Season X - Episode Y - Episode Title (captures series name before "Season X")
    /^(.*?)(?:[\s._-]+(?:TEMPORADA|SEASON|T)(\d{1,2}))(?:[\s._-]+(?:EPIS[OÓ]DIO|EPISODE|EP|E)(\d{1,3}))(?:[\s._-]+(.+))?$/i,
    // Series Title - XxY - Episode Title (captures series name before "XxY")
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

      // If seriesTitle is still empty or generic, but we have an episode title, try to infer series from original
      if ((seriesTitle === "Unknown Series" || seriesTitle === "") && episodeTitle) {
          seriesTitle = titleFromM3U.replace(episodeTitle, "").trim();
          // Further clean up if SxxExx part is still in seriesTitle
          const sxxExxMatch = seriesTitle.match(/[Ss]\d{1,3}[._\s-]*[EeXx]\d{1,3}/i);
          if (sxxExxMatch) {
              seriesTitle = seriesTitle.replace(sxxExxMatch[0], "").trim();
          }
      }
      
      seriesTitle = seriesTitle || "Unknown Series";
      // Ensure episodeTitle is set if episodeNumber is present
      if (episodeNumber !== undefined && episodeTitle === undefined) {
          episodeTitle = `Ep. ${episodeNumber}`;
      }

      break; 
    }
  }
  
  // Final fallback for series title if only episode info was found and series title is generic
  if ((seriesTitle === "Unknown Series" || seriesTitle === "") && (seasonNumber !== undefined || episodeNumber !== undefined)) {
      const parts = titleFromM3U.split(/[\s._-]+[Ss]\d{1,3}[._\s-]*[EeXx]\d{1,3}|[\s._-]+(?:TEMPORADA|SEASON|T)\d{1,2}|[\s._-]+(?:\d{1,2})[xX](\d{1,3})/i);
      if (parts[0] && parts[0].trim() !== "") {
          seriesTitle = parts[0].trim();
      }
  }
  
  if (!seasonNumber && !episodeNumber && streamUrl.toLowerCase().includes('/series/')) {
      // If it's from a /series/ path and no SxxExx, assume title is series title, no specific episode info
      seriesTitle = titleFromM3U;
      episodeTitle = undefined; // No specific episode title in this case
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
    // Pattern looks for (YYYY) or YYYY at the end of a word/string or before extension
    const yearPattern = /(?:\((\d{4})\)|(?<=\s|^)(\d{4})(?=\s|$|\.\w{3,4}$))/;
    const match = title.match(yearPattern);
    if (match) {
        const yearStr = match[1] || match[2];
        if (yearStr) {
            const year = parseInt(yearStr, 10);
            // Validate year range (e.g., >1880 and < current year + 5)
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

  const prefixesToStrip = [
    "FILMES |", "FILMES :", "FILMES -", "FILMES",
    "CANAIS |", "CANAIS :", "CANAIS -", "CANAIS",
    "CANAL |", "CANAL :", "CANAL -", "CANAL",
    "SERIES |", "SERIES :", "SERIES -", "SERIES", // Covers "SÉRIES" due to normalizeText
    "SERIE |", "SERIE :", "SERIE -", "SERIE",   // Covers "SÉRIE"
    "TV SERIES", "WEB SERIES", "TV",
    "DORAMAS |", "DORAMAS", "DORAMA |", "DORAMA",
    "ANIMES |", "ANIMES", "ANIME |", "ANIME",
    "CATEGORIA:", "CATEGORIA", "GRUPO:", "GRUPO", "GROUP:", "GROUP",
    "TODOS OS", "TODAS AS", "ALL",
    "LISTA DE", "LISTA", "LIST OF", "LIST",
    "PAY-PER-VIEW |", "PAY-PER-VIEW", "PPV",
    "REDE |", "REDE",
    // Numerical prefixes
    /^\s*-\s*\d+\s*-\s*/, /^\s*\d+\s*-\s*/, /^\s*\d+\s*[\.:]\s*/, /^\s*\d+\s+/,
    /^\s*-\s*\d+\s*/, // For cases like "- 1 FOO"
    /^\s*-\s+/ // For cases like "- FOO"
  ];

  let titleChanged;
  do {
    titleChanged = false;
    for (const prefix of prefixesToStrip) {
      if (typeof prefix === 'string') {
        if (currentTitle.startsWith(prefix)) {
          currentTitle = currentTitle.substring(prefix.length).trim();
          titleChanged = true;
          break; 
        }
      } else { // Regex prefix
        const match = currentTitle.match(prefix);
        if (match && match.index === 0) {
          currentTitle = currentTitle.substring(match[0].length).trim();
          titleChanged = true;
          break;
        }
      }
    }
  } while (titleChanged && currentTitle !== '');

  // Replace all occurrences of pipe (with or without spaces) with a single space
  currentTitle = currentTitle.replace(/\s*\|\s*/g, ' ').trim();
  
  // Remove trailing special characters like /, -, .
  currentTitle = currentTitle.replace(/[\/\-._\s]+$/g, '').trim();
  // Remove leading special characters again after numerical prefix removal
  currentTitle = currentTitle.replace(/^[\/\-._\s]+/g, '').trim();


  const suffixesToRemove = [
    /\s\(ADULTOS\)$/i, /\sXXX$/, /\sADULTOS$/,
    /\s\(HD\)$/i, /\sHD$/, /\s\(FHD\)$/i, /\sFHD$/, /\s\(SD\)$/i, /\sSD$/,
    /\s\(4K\)$/i, /\s4K$/, /\s\(UHD\)$/i, /\sUHD$/,
    /\sPT-BR$/, /\sDUBLADO$/, /\sLEGENDADO$/, /\sLATINO$/, /\sNACIONAL$/,
    /\sON DEMAND$/i, /\sVOD$/i,
    /\sONLINE$/i
  ];
  for (const suffixRegex of suffixesToRemove) {
    currentTitle = currentTitle.replace(suffixRegex, '').trim();
  }

  // Final cleanup of multiple spaces
  currentTitle = currentTitle.replace(/\s+/g, ' ').trim();

  if (currentTitle === '' || currentTitle === '-' || currentTitle === '/') {
    // More intelligent fallback if normalization results in empty or meaningless string
    let fallback = normalizeText(rawGroupTitle).toUpperCase();
    // Try to strip original prefixes if they exist in the raw, for a cleaner fallback
    const simplePrefixes = ["FILMES", "CANAIS", "SERIES", "CANAL", "ANIME", "DORAMA", "CATEGORIA", "GRUPO"];
    for (const sp of simplePrefixes) {
        if (fallback.startsWith(sp + " |") || fallback.startsWith(sp + " -") || fallback.startsWith(sp + " :")) {
            fallback = fallback.substring(sp.length + 3).trim();
            break;
        } else if (fallback.startsWith(sp + " ")) {
             fallback = fallback.substring(sp.length + 1).trim();
             break;
        }
    }
    fallback = fallback.replace(/^\s*-\s*\d+\s*-\s*/, '').replace(/^\s*\d+\s*-\s*/, '').replace(/^\s*\d+\s*[\.:]\s*/, '').replace(/^\s*\d+\s+/, '').trim();
    fallback = fallback.replace(/\s*\|\s*/g, ' ').trim();
    fallback = fallback.replace(/[\/\-._\s]+$/g, '').trim();
    fallback = fallback.replace(/^[\/\-._\s]+/g, '').trim();
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
      
      // If m3uTitleFromLine is empty, try tvg-name
      if (!m3uTitleFromLine && currentRawAttributes['tvg-name']) {
        m3uTitleFromLine = currentRawAttributes['tvg-name'];
      }
      // If still empty, it will be derived from URL later

    } else if (trimmedLine && !trimmedLine.startsWith('#') && !trimmedLine.startsWith('##')) {
      streamUrlFromLine = trimmedLine;

      // If m3uTitleFromLine is STILL empty here (no title after comma, no tvg-name)
      // then derive a fallback title from the URL.
      if (!m3uTitleFromLine) { 
         const urlParts = streamUrlFromLine.split('/');
         const lastUrlSegment = urlParts.pop() || '';
         // Remove common extensions and then replace separators with space
         const titleFromUrl = lastUrlSegment.replace(/\.(mp4|mkv|avi|ts|m3u8)$/i, '').replace(/[._\-\s+]/g, ' ').trim();
         m3uTitleFromLine = titleFromUrl || "Título Desconhecido";
      }

      const titleForProcessing = m3uTitleFromLine; // This is the primary title for parsing details
      const tvgNameFromAttr = currentRawAttributes['tvg-name']?.trim() || titleForProcessing; // Fallback tvgName to titleForProcessing
      const originalGroupTitle = currentRawAttributes['group-title']?.trim();
      const lowerStreamUrl = streamUrlFromLine.toLowerCase();
      const lowerTitleForProcessing = normalizeText(titleForProcessing);
      const lowerOriginalGroupTitle = normalizeText(originalGroupTitle || "");
      
      let itemType: PlaylistItem['itemType'];
      let extractedChannelDetails: { baseChannelName: string; quality?: string } | undefined;
      
      const seriesMatch = titleForProcessing.match(/[Ss](\d{1,3})[._\s-]*[EeXx](\d{1,3})/i);
      const isChannelNameLike = (name: string): boolean => {
        const upperName = name.toUpperCase();
        return /\b(FHD|HD|SD|4K|UHD|HEVC|H264|H265|X264|X265|AVC)\b/.test(upperName) || 
               (name.length < 35 && !name.match(/\(\d{4}\)$/)); // Short, often all caps, not like a movie title with year
      };

      // 1. Definitive Channel indicators
      if (lowerStreamUrl.endsWith('.ts') || 
          lowerTitleForProcessing.includes('24h') ||
          lowerOriginalGroupTitle.includes('canal')) {
        itemType = 'channel';
      } 
      // 2. Definitive Series indicator
      else if (seriesMatch) {
        itemType = 'series_episode';
      }
      // 3. Looks like a channel name, even if .mp4
      else if (isChannelNameLike(titleForProcessing)) {
        itemType = 'channel';
      }
      // 4. Group title based differentiation for video files
      else if (lowerStreamUrl.endsWith('.mp4') || lowerStreamUrl.endsWith('.mkv') || lowerStreamUrl.endsWith('.avi')) {
        if (lowerOriginalGroupTitle.includes('serie')) {
          itemType = 'series_episode';
        } else if (lowerOriginalGroupTitle.includes('filme')) {
          itemType = 'movie';
        } else if (extractMovieYear(titleForProcessing)) { // If it has a year, likely a movie
          itemType = 'movie';
        } else {
          itemType = 'movie'; // Default for generic video files if not series
        }
      }
      // 5. Fallback for other stream types
      else {
        itemType = 'channel'; // Default for unknown stream types
      }
      
      const item: Partial<PlaylistItem> = {
        playlistDbId,
        title: titleForProcessing, // This will be the episode title for series, movie title for movies, or full channel name
        streamUrl: streamUrlFromLine,
        logoUrl: currentRawAttributes['tvg-logo'],
        originalGroupTitle: originalGroupTitle,
        tvgId: currentRawAttributes['tvg-id'],
        tvgName: tvgNameFromAttr, 
        itemType,
      };
      
      // This must use originalGroupTitle for normalization context
      item.groupTitle = normalizeGroupTitle(originalGroupTitle, item.itemType);

      if (item.itemType === 'channel') {
        // Pass titleForProcessing to extractChannelDetails
        extractedChannelDetails = extractChannelDetails(titleForProcessing);
        item.baseChannelName = extractedChannelDetails.baseChannelName;
        item.quality = extractedChannelDetails.quality;
        item.genre = item.groupTitle; // For channels, genre can be their normalized group
      } else if (item.itemType === 'series_episode') {
        // Pass titleForProcessing to extractSeriesDetails
        const { seriesTitle, seasonNumber, episodeNumber, episodeTitle: parsedEpisodeTitle } = extractSeriesDetails(titleForProcessing, streamUrlFromLine);
        item.seriesTitle = seriesTitle; // This is the title of the Series itself
        item.seasonNumber = seasonNumber;
        item.episodeNumber = episodeNumber;
        // Override item.title with just the episode-specific title if found
        if (parsedEpisodeTitle) {
            item.title = parsedEpisodeTitle;
        }
        item.genre = item.groupTitle; // For series, genre is their normalized group
        item.year = extractMovieYear(seriesTitle); // Year of the series, if parseable from series title
      } else if (item.itemType === 'movie') {
        item.year = extractMovieYear(titleForProcessing);
        item.genre = item.groupTitle; // For movies, genre is their normalized group
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
