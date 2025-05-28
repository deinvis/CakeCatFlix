
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

  // Order matters: more specific/longer patterns first
  const qualityCodecPatterns: { regex: RegExp; qualityLabel: string }[] = [
    { regex: /\b(4K\s*UHD|UHD\s*4K|4K|ULTRA\s*HD|ULTRAHD|UHD)\b/gi, qualityLabel: "4K" },
    { regex: /\b(FULL\s*HD|FULLHD|FHD|1080P|1080I)\b/gi, qualityLabel: "FHD" },
    { regex: /\b(HDTV|HD|720P|720I)\b/gi, qualityLabel: "HD" },
    { regex: /\b(SDTV|SD|576P|576I|480P|480I)\b/gi, qualityLabel: "SD" },
    { regex: /\b(HEVC|H\.265|H265|X265)\b/gi, qualityLabel: "H265" },
    { regex: /\b(AVC|H\.264|H264|X264)\b/gi, qualityLabel: "H264" },
    // Specific symbols/superscripts - ensure they are properly escaped if needed or part of a broader pattern
    { regex: /\b([²³¹⁰¹²³⁴⁵⁶⁷⁸⁹])\b/g, qualityLabel: "$1" }, // Superscript numbers
    { regex: /\b([①②③④⑤⑥⑦⑧⑨⑩])\b/g, qualityLabel: "$1" }, // Circled numbers
    { regex: /\b([❶❷❸❹❺❻❼❽❾❿])\b/g, qualityLabel: "$1" }, // Dingbat circled numbers
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
      return ''; // Remove the matched quality string
    });
  }
  
  // Clean up: remove extra spaces, common separators, and trailing/leading hyphens/spaces
  let baseChannelName = workName
    .replace(/[|()[\]]/g, ' ')    // Replace common separators with space
    .replace(/\s+/g, ' ')         // Normalize multiple spaces to one
    .replace(/[\s-]+$/g, '')      // Remove trailing spaces or hyphens
    .replace(/^[\s-]+/g, '')       // Remove leading spaces or hyphens
    .trim();

  // If baseChannelName becomes empty, try to take the part before the first quality-like pattern
  if (!baseChannelName) {
    const originalNameParts = name.trim().split(/(\b(?:4K|UHD|FHD|HD|SD|HEVC|H265|H264|AVC)\b)/i);
    baseChannelName = originalNameParts[0]?.trim() || name.trim();
  }
  
  // Ensure base name is uppercase after all processing
  baseChannelName = baseChannelName.toUpperCase();

  const finalQuality = extractedQualities.length > 0 ? extractedQualities.sort().join(' ').trim() : undefined;

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

  // Patterns to match SxxExx, TxxExx, Season xx Episode xx, xxXxx
  // Prioritize more specific patterns first.
  const patterns = [
    // Matches: "Series Name S01E01 Episode Title", "Series Name - S01E01 - Episode Title"
    /^(.*?)(?:[\s._-]*[Ss](\d{1,3})[._\s-]*[EeXx](\d{1,3}))(?:[\s._-]*(.+))?$/i,
    // Matches: "Series Name Season 01 Episode 01 Episode Title"
    /^(.*?)(?:[\s._-]+(?:TEMPORADA|SEASON|T)\s*(\d{1,2}))(?:[\s._-]+(?:EPIS[OÓ]DIO|EPISODE|EP|E)\s*(\d{1,3}))(?:[\s._-]+(.+))?$/i,
    // Matches: "Series Name 01x01 Episode Title"
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
      
      // Clean up seriesTitle if it inadvertently captured part of SxxExx
      if (seriesTitle.toUpperCase().endsWith(`S${String(seasonNumber||'').padStart(2,'0')}`) ||
          seriesTitle.toUpperCase().endsWith(`SEASON ${seasonNumber||''}`) ||
          seriesTitle.toUpperCase().endsWith(`${seasonNumber||''}X`)) {
             seriesTitle = seriesTitle.substring(0, seriesTitle.lastIndexOf(match[0].substring(match[1].length, match[0].length - (episodeTitle ? episodeTitle.length : 0)).trim())).trim();
      }
      
      if (!seriesTitle && episodeTitle) { // If series title became empty but there's an episode title
          seriesTitle = titleFromM3U.replace(episodeTitle, "").trim()
                                    .replace(/[Ss]\d{1,3}[._\s-]*[EeXx]\d{1,3}.*$/i, "").trim()
                                    .replace(/(?:TEMPORADA|SEASON|T)\s*\d{1,2}.*$/i, "").trim()
                                    .replace(/\d{1,2}[xX]\d{1,3}.*$/i, "").trim();
      }
      
      // If episodeTitle is just the SxxExx part or too generic
      if (episodeTitle && (episodeTitle.match(/^[Ss]\d{1,3}[._\s-]*[EeXx]\d{1,3}$/i) || episodeTitle.match(/^EP\s*\d+$/i)) ) {
          episodeTitle = undefined; // Let it be auto-generated if numbers are present
      }

      if (episodeTitle && seriesTitle !== "Unknown Series" && episodeTitle.toLowerCase().includes(seriesTitle.toLowerCase())) {
          episodeTitle = episodeTitle.replace(new RegExp(seriesTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "ig"), "").trim().replace(/^[\s._-]+/, "").trim();
      }
      
      if(!episodeTitle && episodeNumber !== undefined) {
        episodeTitle = `Episódio ${episodeNumber}`;
      }
      if(episodeTitle === "") episodeTitle = undefined;

      break; 
    }
  }
  
  // If no pattern matched but SxxExx is present anywhere, assume it's a series
  if (seasonNumber === undefined && episodeNumber === undefined) {
    const sxxExxAnywhereMatch = titleFromM3U.match(/[Ss](\d{1,3})[._\s-]*[EeXx](\d{1,3})/);
    if (sxxExxAnywhereMatch) {
      seasonNumber = parseInt(sxxExxAnywhereMatch[1], 10);
      episodeNumber = parseInt(sxxExxAnywhereMatch[2], 10);
      // Attempt to extract series title by removing the SxxExx part and anything after
      seriesTitle = titleFromM3U.substring(0, sxxExxAnywhereMatch.index).trim();
      if (!seriesTitle) { // If SxxExx was at the beginning
          const potentialEpTitle = titleFromM3U.substring(sxxExxAnywhereMatch[0].length + (sxxExxAnywhereMatch.index || 0)).trim();
          if (potentialEpTitle && potentialEpTitle.toLowerCase() !== "completo") episodeTitle = potentialEpTitle;
      }
       if(!episodeTitle && episodeNumber !== undefined) episodeTitle = `Episódio ${episodeNumber}`;
    }
  }
  
  seriesTitle = seriesTitle.trim().toUpperCase() || "UNKNOWN SERIES";


  return {
    seriesTitle,
    seasonNumber,
    episodeNumber,
    episodeTitle: episodeTitle?.trim(),
  };
}

/**
 * Extracts year from a movie title if present in (YYYY) format or as YYYY.
 */
export function extractMovieYear(title: string): number | undefined {
    const yearPattern = /(?:\((\d{4})\)|(?<=\s|^)(\d{4})(?=\s|\.\w{3,4}$|$))/; // Added $ to match end of string
    const match = title.match(yearPattern);
    if (match) {
        const yearStr = match[1] || match[2];
        if (yearStr) {
            const year = parseInt(yearStr, 10);
            // Reasonable range for movie years
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
    // Return a default based on itemTypeHint if rawGroupTitle is entirely missing or empty
    switch (itemTypeHint) {
      case 'channel': return 'CANAIS DIVERSOS';
      case 'movie': return 'FILMES DIVERSOS';
      case 'series_episode': return 'SÉRIES DIVERSAS';
      case 'series': return 'SÉRIES DIVERSAS';
      default: return 'OUTROS';
    }
  }

  let currentTitle = normalizeText(rawGroupTitle).toUpperCase();

  const prefixesToStrip = [
    // More specific first to avoid partial matches from generic ones
    "FILMES |", "FILMES :", "FILMES -", "FILMES →", "FILMES ~", "FILMES",
    "SÉRIES |", "SÉRIES :", "SÉRIES -", "SÉRIES →", "SÉRIES ~", "SÉRIES",
    "SERIES |", "SERIES :", "SERIES -", "SERIES →", "SERIES ~", "SERIES",
    "CANAIS |", "CANAIS :", "CANAIS -", "CANAIS →", "CANAIS ~", "CANAIS",
    "CANAL |", "CANAL :", "CANAL -", "CANAL →", "CANAL ~", "CANAL",
    "TV |", "TV :", "TV -", "TV →", "TV ~", "TV",
    "DORAMAS |", "DORAMAS :", "DORAMAS -", "DORAMAS →", "DORAMAS ~", "DORAMAS",
    "ANIMES |", "ANIMES :", "ANIMES -", "ANIMES →", "ANIMES ~", "ANIMES",
    "CATEGORIA:", "GRUPO:", "GROUP:", "TODOS OS", "TODAS AS", "ALL",
    "LISTA DE", "LIST OF", "PAY-PER-VIEW |", "PAY-PER-VIEW", "REDE |", "REDE",
    "PPV", "IPTV", "BRASIL", "BRAZIL", "PORTUGAL", "LATINO", "ONLINE"
  ];

  const numericalSymbolPrefixesRegex = /^\s*[-\s#@!~.]*(\d+[-\s.:#@!~.]*)*/;

  let titleChanged;
  do {
    titleChanged = false;
    const initialLength = currentTitle.length;

    // Attempt to remove numerical/symbol prefixes
    currentTitle = currentTitle.replace(numericalSymbolPrefixesRegex, '').trim();
    if (currentTitle.length < initialLength) titleChanged = true;

    for (const prefix of prefixesToStrip) {
      const pUpper = prefix.toUpperCase();
      if (currentTitle.startsWith(pUpper)) {
        currentTitle = currentTitle.substring(pUpper.length).trim();
        // Attempt to remove a separator if the prefix itself didn't include one and it's at the start
        currentTitle = currentTitle.replace(/^[\s\-:\→~|#@!~.]+/,'').trim();
        titleChanged = true;
        break; 
      }
    }
  } while (titleChanged && currentTitle !== '');

  // Replace all occurrences of pipe (with or without spaces) or other common separators with a single space
  currentTitle = currentTitle.replace(/\s*[\-|:\→~]+\s*|\s*\|\s*/g, ' ').trim();
  
  // Remove trailing special characters, digits, and specific words after normalization
  // Also remove leading special characters again after numerical prefix removal
  currentTitle = currentTitle
    .replace(/[\/\-._\s#@!~.]+$/g, '') // Trailing symbols
    .replace(/^[\/\-._\s#@!~.]+/g, '')  // Leading symbols
    .replace(/(\s*\b(HD|FHD|SD|4K|UHD|ADULTOS|XXX|PT-BR|DUBLADO|LEGENDADO|LATINO|NACIONAL|ON DEMAND|VOD|ONLINE|TODOS)\b)+$/gi, '')
    .trim();
  
  // Final cleanup of multiple spaces and ensure it's not just a number
  currentTitle = currentTitle.replace(/\s+/g, ' ').trim();
  if (/^\d+$/.test(currentTitle) && currentTitle.length <= 3) currentTitle = ''; // Remove if only numbers (e.g., category "1")

  if (currentTitle === '') {
    switch (itemTypeHint) {
      case 'channel': return 'CANAIS DIVERSOS';
      case 'movie': return 'FILMES DIVERSOS';
      case 'series_episode': return 'SÉRIES DIVERSAS';
      case 'series': return 'SÉRIES DIVERSAS';
      default:
        // As a very last resort, try to use a "cleaner" version of the raw title if it was complex
        const cleanedRaw = normalizeText(rawGroupTitle).toUpperCase().replace(/\s*[\-|:\→~]+\s*|\s*\|\s*/g, ' ').trim();
        return cleanedRaw || 'OUTROS';
    }
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
      currentRawAttributes = {}; // Reset for each new #EXTINF
      streamUrlFromLine = '';    // Reset for each new #EXTINF
      const infoLineContent = trimmedLine.substring(8); 
      const lastCommaIndex = infoLineContent.lastIndexOf(',');
      
      m3uTitleFromLine = lastCommaIndex > -1 ? infoLineContent.substring(lastCommaIndex + 1).trim() : '';
      const attributesString = lastCommaIndex > -1 ? infoLineContent.substring(0, lastCommaIndex) : infoLineContent.replace(/^-1\s*/, '');

      const attributeRegex = /([a-zA-Z0-9\-._]+)=("[^"]*"|[^\s,]+)/g;
      let match;
      while ((match = attributeRegex.exec(attributesString)) !== null) {
        currentRawAttributes[match[1].toLowerCase()] = match[2].replace(/^"|"$/g, '').trim();
      }
      
      // If m3uTitleFromLine is empty, try to use tvg-name from attributes
      if (!m3uTitleFromLine && currentRawAttributes['tvg-name']) {
        m3uTitleFromLine = currentRawAttributes['tvg-name'];
      }
      

    } else if (trimmedLine && !trimmedLine.startsWith('#') && !trimmedLine.startsWith('##')) {
      streamUrlFromLine = trimmedLine;

      // If m3uTitleFromLine is still empty (e.g. from #EXTVLCOPT or just a URL line), derive from URL
      if (!m3uTitleFromLine) { 
         const urlParts = streamUrlFromLine.split('/');
         const lastUrlSegment = urlParts.pop() || '';
         const titleFromUrl = decodeURIComponent(lastUrlSegment.replace(/\.(mp4|mkv|avi|ts|m3u8)$/i, '').replace(/[._\-\s+]/g, ' ').trim());
         m3uTitleFromLine = titleFromUrl || "Título Desconhecido";
      }

      // Determine the primary title to use for parsing details (channel name, series name, movie year)
      // Prefer the title directly from the M3U line after comma, then tvg-name attribute, then derived from URL
      const titleForProcessing = m3uTitleFromLine || currentRawAttributes['tvg-name'] || "Título Desconhecido";
      const tvgNameFromAttr = currentRawAttributes['tvg-name']?.trim() || titleForProcessing; // Ensure tvgName is also robust
      
      let originalGroupTitle = currentRawAttributes['group-title']?.trim();
      
      const lowerStreamUrl = streamUrlFromLine.toLowerCase();
      const normalizedTvgName = normalizeText(tvgNameFromAttr);
      const sxxExxPatternMatch = titleForProcessing.match(/[Ss](\d{1,3})[._\s-]*[EeXx](\d{1,3})/i);

      let itemType: PlaylistItem['itemType'];

      // 1. Series Check (Highest Priority)
      if (sxxExxPatternMatch) {
        itemType = 'series_episode';
      }
      // 2. Channel Check (High Priority)
      else if (lowerStreamUrl.endsWith('.ts') ||
               normalizeText(titleForProcessing).includes('canais') || // "CANAIS" in title
               (originalGroupTitle && normalizeText(originalGroupTitle).includes('canal')) || // "canal" in group-title
               normalizedTvgName.includes('24h')) { // "24h" in tvg-name (kept from previous logic as a strong channel indicator)
        itemType = 'channel';
      }
      // 3. Movie Check (Medium Priority - if .mp4 and not series/channel)
      else if (lowerStreamUrl.endsWith('.mp4')) {
          itemType = 'movie';
      }
      // 4. Secondary Series Check (Medium Priority - if group-title contains 'serie')
      else if (originalGroupTitle && normalizeText(originalGroupTitle).includes('serie')) {
          itemType = 'series_episode';
      }
       // 5. Secondary Movie Check (Medium Priority - if group-title contains 'filme')
      else if (originalGroupTitle && normalizeText(originalGroupTitle).includes('filme')) {
          itemType = 'movie';
      }
      // 6. Fallback for everything else (default to channel or guess based on file extension if any)
      else {
         // Fallback based on common video extensions if not classified yet
         if (lowerStreamUrl.endsWith('.mkv') || lowerStreamUrl.endsWith('.avi') || extractMovieYear(titleForProcessing)) {
             itemType = 'movie';
         } else {
             itemType = 'channel'; // Default fallback
         }
      }

      // If originalGroupTitle is missing, assign a default before normalization
      if (!originalGroupTitle || originalGroupTitle.trim() === '') {
        switch (itemType) {
          case 'channel': originalGroupTitle = 'CANAIS DIVERSOS'; break;
          case 'movie': originalGroupTitle = 'FILMES DIVERSOS'; break;
          case 'series_episode': originalGroupTitle = 'SÉRIES DIVERSAS'; break;
          default: originalGroupTitle = 'OUTROS';
        }
      }      
      
      const item: Partial<PlaylistItem> = {
        playlistDbId,
        title: titleForProcessing, 
        streamUrl: streamUrlFromLine,
        logoUrl: currentRawAttributes['tvg-logo'],
        originalGroupTitle: originalGroupTitle, // Store the potentially defaulted original
        tvgId: currentRawAttributes['tvg-id'],
        tvgName: tvgNameFromAttr, 
        itemType,
      };
      
      // Normalize the group title using the determined itemType as a hint
      item.groupTitle = normalizeGroupTitle(originalGroupTitle, item.itemType);

      if (item.itemType === 'channel') {
        const details = extractChannelDetails(titleForProcessing);
        item.baseChannelName = details.baseChannelName;
        item.quality = details.quality;
        item.genre = item.groupTitle; 
      } else if (item.itemType === 'series_episode') {
        const { seriesTitle, seasonNumber, episodeNumber, episodeTitle: parsedEpisodeTitle } = extractSeriesDetails(titleForProcessing, streamUrlFromLine);
        item.seriesTitle = seriesTitle;
        item.seasonNumber = seasonNumber;
        item.episodeNumber = episodeNumber;
        item.title = parsedEpisodeTitle || titleForProcessing; // Use specific episode title if found, else full M3U title
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
