
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
    { regex: /\b(HEVC|H265|H\.265|X265)\b/gi, qualityLabel: "H265" },
    { regex: /\b(AVC|H264|H\.264|X264)\b/gi, qualityLabel: "H264" },
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
      const upperQuality = quality.toUpperCase();
      if (!extractedQualities.includes(upperQuality)) {
        extractedQualities.push(upperQuality);
      }
      return '';
    });
  }

  // Clean up: remove extra spaces, common separators
  let baseChannelName = workName
    .replace(/[|()[\]]/g, ' ') // Replace common separators with space
    .replace(/\s+/g, ' ')    // Normalize multiple spaces to one
    .replace(/[\s-]+$/g, '') // Remove trailing spaces or hyphens
    .replace(/^[\s-]+/g, '')  // Remove leading spaces or hyphens
    .trim();

  if (!baseChannelName) {
    const originalNameParts = name.trim().split(/[|(]/);
    baseChannelName = originalNameParts[0].trim();
    if (!baseChannelName) baseChannelName = name.trim();
  }

  // Preserve numbers if they appear to be part of the channel name (e.g., "ESPN 2", "SPORTV 3")
  // This check is tricky. The current approach relies on quality patterns being specific enough.
  // If baseChannelName ends with a number and the original name started with the baseChannelName + quality,
  // it's likely the number is part of the name.

  const finalQuality = extractedQualities.length > 0 ? extractedQualities.sort((a,b) => a.localeCompare(b)).join(' ').trim() : undefined;
  // Ensure base name is uppercase after all processing
  baseChannelName = baseChannelName.toUpperCase();


  return { baseChannelName: baseChannelName, quality: finalQuality };
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

  const patterns = [
    /^(.*?)(?:[\s._-]*[Ss](\d{1,3})[._\s-]*[EeXx](\d{1,3}))(?:[\s._-]*(.+))?$/i,
    /^(.*?)(?:[\s._-]+(?:TEMPORADA|SEASON|T)\s*(\d{1,2}))(?:[\s._-]+(?:EPIS[OÓ]DIO|EPISODE|EP|E)\s*(\d{1,3}))(?:[\s._-]+(.+))?$/i,
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
          episodeTitle = episodeTitle.replace(new RegExp(seriesTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "ig"), "").trim().replace(/^[\s._-]+/, "").trim();
      }
      if(episodeTitle === "") episodeTitle = undefined;

      if ((seriesTitle === "Unknown Series" || seriesTitle === "") && episodeTitle) {
          seriesTitle = titleFromM3U.replace(episodeTitle, "").trim();
          const sxxExxMatch = seriesTitle.match(/[Ss]\d{1,3}[._\s-]*[EeXx]\d{1,3}/i);
          if (sxxExxMatch) {
              seriesTitle = seriesTitle.replace(sxxExxMatch[0], "").trim();
          }
      }
      
      seriesTitle = seriesTitle || "Unknown Series";
      if (episodeNumber !== undefined && episodeTitle === undefined) {
          episodeTitle = `Ep. ${episodeNumber}`;
      }

      break; 
    }
  }
  
  if ((seriesTitle === "Unknown Series" || seriesTitle === "") && (seasonNumber !== undefined || episodeNumber !== undefined)) {
      const parts = titleFromM3U.split(/[\s._-]+[Ss]\d{1,3}[._\s-]*[EeXx]\d{1,3}|[\s._-]+(?:TEMPORADA|SEASON|T)\d{1,2}|[\s._-]+(?:\d{1,2})[xX](\d{1,3})/i);
      if (parts[0] && parts[0].trim() !== "") {
          seriesTitle = parts[0].trim();
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
            if (year > 1880 && year < new Date().getFullYear() + 10) { // Increased upper limit slightly
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
    // More specific prefixes first
    "FILMES | ", "FILMES : ", "FILMES - ", "FILMES → ", "FILMES ~ ",
    "SERIES | ", "SERIES : ", "SERIES - ", "SERIES → ", "SERIES ~ ",
    "SÉRIES | ", "SÉRIES : ", "SÉRIES - ", "SÉRIES → ", "SÉRIES ~ ", // With accent
    "CANAIS | ", "CANAIS : ", "CANAIS - ", "CANAIS → ", "CANAIS ~ ",
    "CANAL | ", "CANAL : ", "CANAL - ", "CANAL → ", "CANAL ~ ",
    "TV | ", "TV : ", "TV - ", "TV → ", "TV ~ ",
    "DORAMAS | ", "DORAMAS : ", "DORAMAS - ", "DORAMAS → ", "DORAMAS ~ ",
    "ANIMES | ", "ANIMES : ", "ANIMES - ", "ANIMES → ", "ANIMES ~ ",
    "CATEGORIA:", "GRUPO:", "GROUP:", "TODOS OS", "TODAS AS", "ALL",
    "LISTA DE", "LIST OF", "PAY-PER-VIEW |", "REDE |",
    "FILMES", "SERIES", "SÉRIES", "CANAIS", "CANAL", "TV", "DORAMAS", "ANIMES",
    "CATEGORIA", "GRUPO", "GROUP", "LISTA", "PAY-PER-VIEW", "REDE", "PPV"
  ];

  // Numerical/symbol prefixes to remove
  const numericalSymbolPrefixesRegex = /^\s*[-\s]*\d+\s*[-\s.:]*\s*|^\s*[-\s#@]+\s*/;

  let titleChanged;
  do {
    titleChanged = false;
    // Try removing numerical/symbol prefixes first as they are very distinct
    const numericalMatch = currentTitle.match(numericalSymbolPrefixesRegex);
    if (numericalMatch) {
      currentTitle = currentTitle.substring(numericalMatch[0].length).trim();
      titleChanged = true;
    }

    for (const prefix of prefixesToStrip) {
      if (currentTitle.startsWith(prefix.toUpperCase())) {
        currentTitle = currentTitle.substring(prefix.toUpperCase().length).trim();
        // Attempt to remove a separator if the prefix itself didn't include one
        if (currentTitle.match(/^[\s-:\→~|]+/)) {
            currentTitle = currentTitle.replace(/^[\s-:\→~|]+/, '').trim();
        }
        titleChanged = true;
        break; 
      }
    }
  } while (titleChanged && currentTitle !== '');

  // Replace all occurrences of pipe (with or without spaces) with a single space
  currentTitle = currentTitle.replace(/\s*\|\s*/g, ' ').trim();
  
  // Remove trailing special characters like /, -, ., digits, and specific words after normalization
  currentTitle = currentTitle.replace(/[\/\-._\s]+$|(\s*\b(HD|FHD|SD|4K|UHD|ADULTOS|XXX|PT-BR|DUBLADO|LEGENDADO|LATINO|NACIONAL|ON DEMAND|VOD|ONLINE)\b)+$/gi, '').trim();
  
  // Remove leading special characters again after numerical prefix removal
  currentTitle = currentTitle.replace(/^[\/\-._\s#@]+/g, '').trim();
  
  // Remove trailing slashes specifically
  currentTitle = currentTitle.replace(/\/+$/g, '').trim();

  // Final cleanup of multiple spaces
  currentTitle = currentTitle.replace(/\s+/g, ' ').trim();

  // If after all this, the title is empty or just a symbol, try a simpler fallback
  if (currentTitle === '' || currentTitle === '-' || currentTitle === '/' || /^\d+$/.test(currentTitle)) {
    let fallback = normalizeText(rawGroupTitle).toUpperCase();
    // Simpler prefix removal for fallback
    const simplePrefixes = ["FILMES", "CANAIS", "SERIES", "SÉRIES", "CANAL", "ANIME", "DORAMA", "CATEGORIA", "GRUPO"];
    for (const sp of simplePrefixes) {
        const spUpper = sp.toUpperCase();
        if (fallback.startsWith(spUpper + " |") || fallback.startsWith(spUpper + " -") || fallback.startsWith(spUpper + " :")) {
            fallback = fallback.substring(spUpper.length + 3).trim();
            break;
        } else if (fallback.startsWith(spUpper + " ")) {
             fallback = fallback.substring(spUpper.length + 1).trim();
             break;
        } else if (fallback === spUpper) {
            fallback = ""; // If the whole title was just "FILMES", make it empty to trigger default
            break;
        }
    }
    fallback = fallback.replace(numericalSymbolPrefixesRegex, '').trim();
    fallback = fallback.replace(/\s*\|\s*/g, ' ').trim();
    fallback = fallback.replace(/[\/\-._\s]+$|(\s*\b(HD|FHD|SD|4K|UHD)\b)+$/gi, '').trim();
    fallback = fallback.replace(/^[\/\-._\s#@]+/g, '').trim();
    fallback = fallback.replace(/\/+$/g, '').trim();
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
      }
      

    } else if (trimmedLine && !trimmedLine.startsWith('#') && !trimmedLine.startsWith('##')) {
      streamUrlFromLine = trimmedLine;

      if (!m3uTitleFromLine) { 
         const urlParts = streamUrlFromLine.split('/');
         const lastUrlSegment = urlParts.pop() || '';
         const titleFromUrl = lastUrlSegment.replace(/\.(mp4|mkv|avi|ts|m3u8)$/i, '').replace(/[._\-\s+]/g, ' ').trim();
         m3uTitleFromLine = titleFromUrl || "Título Desconhecido";
      }

      const titleForProcessing = m3uTitleFromLine;
      const tvgNameFromAttr = currentRawAttributes['tvg-name']?.trim() || titleForProcessing;
      const originalGroupTitle = currentRawAttributes['group-title']?.trim();
      
      const lowerStreamUrl = streamUrlFromLine.toLowerCase();
      const normalizedTvgName = normalizeText(tvgNameFromAttr); // Normalize tvg-name for checks
      const normalizedOriginalGroupTitle = normalizeText(originalGroupTitle || "");
      
      let itemType: PlaylistItem['itemType'];
      let extractedChannelDetails: { baseChannelName: string; quality?: string } | undefined;
      
      const isChannelLikeName = (name: string): boolean => {
        const upperName = name.toUpperCase();
        return /\b(FHD|HD|SD|4K|UHD|HEVC|H264|H265|X264|X265|AVC)\b/.test(upperName) ||
               /\b(24H|24\s*HORAS)\b/i.test(name) || // Added 24h check for name directly
               (name.length < 40 && !name.match(/\(\d{4}\)$/) && !name.match(/[Ss]\d{1,3}[._\s-]*[EeXx]\d{1,3}/i));
      };

      const seriesPatternMatch = tvgNameFromAttr.match(/[Ss](\d{1,3})[._\s-]*[EeXx](\d{1,3})/i);

      if (lowerStreamUrl.endsWith('.ts') || normalizedOriginalGroupTitle.includes('canal')) {
        itemType = 'channel';
      } else if (seriesPatternMatch) {
        itemType = 'series_episode';
      } else if (isChannelLikeName(tvgNameFromAttr)) {
        itemType = 'channel';
      } else if (normalizedOriginalGroupTitle.includes('filme') && !normalizedOriginalGroupTitle.includes('serie')) {
        itemType = 'movie';
      } else if (normalizedOriginalGroupTitle.includes('serie') && !normalizedOriginalGroupTitle.includes('filme')) {
        itemType = 'series_episode';
      } else if (lowerStreamUrl.endsWith('.mp4') || lowerStreamUrl.endsWith('.mkv') || lowerStreamUrl.endsWith('.avi')) {
        if (extractMovieYear(tvgNameFromAttr)) {
            itemType = 'movie';
        } else if (normalizedOriginalGroupTitle.includes('serie')) {
            itemType = 'series_episode';
        } else if (normalizedOriginalGroupTitle.includes('filme')) {
            itemType = 'movie';
        } else {
            itemType = 'movie'; // Default for video files if group is generic
        }
      } else {
        itemType = 'channel'; // Default for other streams
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
        extractedChannelDetails = extractChannelDetails(titleForProcessing); // Use titleForProcessing for details
        item.baseChannelName = extractedChannelDetails.baseChannelName;
        item.quality = extractedChannelDetails.quality;
        item.genre = item.groupTitle; 
      } else if (item.itemType === 'series_episode') {
        const { seriesTitle, seasonNumber, episodeNumber, episodeTitle: parsedEpisodeTitle } = extractSeriesDetails(titleForProcessing, streamUrlFromLine);
        item.seriesTitle = seriesTitle;
        item.seasonNumber = seasonNumber;
        item.episodeNumber = episodeNumber;
        if (parsedEpisodeTitle) {
            item.title = parsedEpisodeTitle; // Override item.title with specific episode title
        }
        item.genre = item.groupTitle; 
        item.year = extractMovieYear(seriesTitle); // Year of the series
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

