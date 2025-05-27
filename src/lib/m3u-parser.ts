
import type { PlaylistItem } from '@/lib/constants';
import { normalizeText as normalizeForComparison } from '@/lib/utils';

/**
 * Extracts base channel name and quality from a channel title.
 * Example: "ESPN HD" -> { baseChannelName: "ESPN", quality: "HD" }
 * Example: "ESPN 2 FHD" -> { baseChannelName: "ESPN 2", quality: "FHD" }
 * Example: "HBO 2 4K" -> { baseChannelName: "HBO 2", quality: "4K" }
 * Example: "Discovery" -> { baseChannelName: "Discovery", quality: undefined }
 * Example: "ANIMAL PLANET FHD H265" -> { baseChannelName: "ANIMAL PLANET", quality: "FHD H265" }
 * Example: "ANIMAL PLANET HD²" -> { baseChannelName: "ANIMAL PLANET", quality: "HD²" }
 * Example: "mega - 2 FHD" -> { baseChannelName: "mega - 2", quality: "FHD"}
 */
export function extractChannelDetails(name: string): { baseChannelName: string; quality?: string } {
  if (!name) return { baseChannelName: '', quality: undefined };

  let workName = name.trim();
  const extractedQualities: string[] = [];

  // Define patterns for qualities and codecs, order can be important
  // More specific (e.g., FHD) should come before less specific (e.g., HD)
  const qualityCodecPatterns = [
    { pattern: /\s+(4K UHD|UHD 4K|4K|UHD)\b/i, quality: (match: RegExpMatchArray) => match[1].toUpperCase().replace(/\s/g, "") },
    { pattern: /\s+(FHD|FULLHD|FULL HD|1080P|1080I)\b/i, quality: (match: RegExpMatchArray) => match[1].toUpperCase().replace("FULLHD", "FHD").replace("FULL HD", "FHD").replace("1080I", "1080p") },
    { pattern: /\s+(HD|720P|720I)\b/i, quality: (match: RegExpMatchArray) => match[1].toUpperCase().replace("720I", "720p") },
    { pattern: /\s+(SD|576P|576I|480P|480I)\b/i, quality: (match: RegExpMatchArray) => match[1].toUpperCase().replace("576I", "576p").replace("480I", "480p") },
    { pattern: /\s+(H265|X265|H\.265|HEVC)\b/i, quality: (match: RegExpMatchArray) => match[1].toUpperCase().replace("H.265", "H265") },
    { pattern: /\s+(H264|X264|H\.264|AVC)\b/i, quality: (match: RegExpMatchArray) => match[1].toUpperCase().replace("H.264", "H264") },
    // Pattern for superscripts, circled numbers, etc. - these are almost always quality/variation indicators
    { pattern: /\s*([\u2070\u00B9\u00B2\u00B3\u2074-\u2079\u2460-\u2473\u2776-\u2793]+)\b/i, quality: (match: RegExpMatchArray) => match[1] },
  ];

  let changedInIteration;
  do {
    changedInIteration = false;
    for (const qc of qualityCodecPatterns) {
      const match = workName.match(qc.pattern);
      if (match && match.index !== undefined) {
        const qualityValue = qc.quality(match);
        if (qualityValue !== null) {
            extractedQualities.unshift(qualityValue); // Add to beginning to keep order like "FHD H265"
            workName = workName.substring(0, match.index) + workName.substring(match.index + match[0].length);
            workName = workName.trim();
            changedInIteration = true;
        }
      }
    }
  } while (changedInIteration);
  
  // Cleanup remaining string (baseChannelName)
  // Remove trailing non-alphanumeric chars (excluding common name chars like '.', ':', '(', ')', '-')
  // This regex means: one or more characters NOT in the set [a-zA-Z0-9À-ÖØ-öø-ÿ\s().:-] at the end of the string.
  // Added À-ÖØ-öø-ÿ to support more Latin characters in names.
  workName = workName.replace(/[^a-zA-Z0-9À-ÖØ-öø-ÿ\s().:-]+$/, '').trim();
  // Remove trailing hyphen if it's possibly left over and isolated
  workName = workName.replace(/\s*-\s*$/, '').trim(); 

  const finalBaseChannelName = workName || name; // Fallback to original name if workName becomes empty
  const finalQuality = extractedQualities.length > 0 ? extractedQualities.join(' ').trim() : undefined;
  
  return { baseChannelName: finalBaseChannelName, quality: finalQuality };
}


/**
 * Extracts series title, season, and episode number from a title.
 * Example: "Batalha das Solteiras S01E06" -> { seriesTitle: "Batalha das Solteiras", seasonNumber: 1, episodeNumber: 6 }
 */
export function extractSeriesDetails(title: string): { seriesTitle: string; seasonNumber?: number; episodeNumber?: number, episodeTitle?: string } {
  // Pattern tries to capture: Series Name (SXXEXX or Season X Episode Y) - Optional Episode Title
  const seriesPattern = /^(.*?)(?:[Ss](\d{1,3})[EeXx](\d{1,3})|[Ss]eason\s*(\d{1,3})\s*[Ee]pisode\s*(\d{1,3})|\s-\s[Ss](\d{1,3})\s[Ee](\d{1,3}))(?:\s*-\s*(.*|E\d{1,3}\s+.*)|\s*:?\s*(.*)|$)/i;
  const match = title.match(seriesPattern);

  if (match) {
    let seriesTitle = (match[1] || '').trim();
    const seasonStr = match[2] || match[4] || match[6];
    const episodeStr = match[3] || match[5] || match[7];
    let episodeTitle = (match[8] || match[9] || '').trim();

    // If seriesTitle is empty but we have SxxExx, means title was "S01E01 - Episode Name"
    if (!seriesTitle && (seasonStr && episodeStr)) {
        seriesTitle = title.split(match[0])[0].trim() || title; // Fallback if split fails
    }
    
    // If episodeTitle seems to be just the SXXEXX part again, clear it
    if (episodeTitle.match(/^[Ss]\d{1,3}[EeXx]\d{1,3}/i) && episodeTitle.length < 10) {
        episodeTitle = '';
    }
     // Remove series title from episode title if it's redundantly there
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
  // Fallback for titles that might just be "Series Name - Episode Name" without SxxExx
  const parts = title.split(/\s+-\s+|\s+–\s+/); // Split by ' - ' or ' – '
  if (parts.length > 1) {
    // Assume the last part is the episode title and the rest is the series title
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
    // Regex looks for (YYYY) but not if it's part of something like (1999-2005)
    const yearPattern = /(?<![-\d])\((\d{4})\)(?![-\d])/;
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

  const channelPrefixes = ['CANAL', 'CANAIS', 'TV']; // Added TV
  const moviePrefixes = ['FILME', 'FILMES', 'MOVIE', 'MOVIES', 'PELICULA', 'PELICULAS']; // Added Spanish
  const seriesPrefixes = ['SERIE', 'SERIES', 'TV SHOWS', 'TV SHOW', 'SERIES TV', 'DORAMA', 'ANIMES', 'ANIME', 'WEB SERIES']; // Added WEB SERIES

  let typePrefixesToRemove: string[] = [];
  
  // Determine which prefixes to try removing based on itemType
  if (itemType === 'channel') {
    typePrefixesToRemove = [...moviePrefixes, ...seriesPrefixes];
  } else if (itemType === 'movie') {
    typePrefixesToRemove = [...channelPrefixes, ...seriesPrefixes];
  } else if (itemType === 'series_episode') {
    typePrefixesToRemove = [...channelPrefixes, ...moviePrefixes];
  } else { // Generic, try to remove any known prefix if itemType is unknown
    typePrefixesToRemove = [...channelPrefixes, ...moviePrefixes, ...seriesPrefixes];
  }
  
  let prefixRemoved = false;
  for (const prefix of typePrefixesToRemove) {
    if (normalized.startsWith(prefix + ' |') || normalized.startsWith(prefix + ' -') || normalized.startsWith(prefix + ':')) {
      normalized = normalized.substring(prefix.length).replace(/^(\s*(\||-|:)\s*)/, '').trim();
      prefixRemoved = true;
      break; 
    } else if (normalized.startsWith(prefix + ' ')) {
        normalized = normalized.substring(prefix.length + 1).trim();
        prefixRemoved = true;
        break;
    }
  }
  
  // If no type-specific prefix was removed, try a more general removal
  // (e.g., "FILMES | AÇÃO" -> "AÇÃO", but "FILMES AÇÃO" -> "AÇÃO")
  if (!prefixRemoved) {
    const generalPrefixPattern = /^(?:CANAL(?:IS)?|FILME(?:S)?|S[ÉE]RIE(?:S)?|MOVIE(?:S)?|TV(?: SHOWS?)?|PELICULA(?:S)?|DORAMA|ANIME(?:S)?|WEB SERIES)\s*(?:[|:-]\s*)?/i;
    const testNormalized = rawGroupTitle.toUpperCase().replace(generalPrefixPattern, '').trim();
    if (testNormalized.length < rawGroupTitle.length && testNormalized.length > 0) { // Ensure something was removed and not everything
        normalized = testNormalized;
    } else {
        normalized = rawGroupTitle.toUpperCase().trim(); // Fallback to original if general pattern is too aggressive
    }
  }
  
  // Remove trailing separators or common non-descriptive suffixes
  normalized = normalized.replace(/\s*(\||-)\s*$/, ''); 
  normalized = normalized.replace(/\s*\(\s*(?:SD|HD|FHD|4K|UHD)\s*\)\s*$/i, ''); // Remove (HD), (SD) etc. from end
  normalized = normalized.replace(/\s+TODO(S)?$/i, ''); // Remove TODOS
  normalized = normalized.replace(/\s+/g, ' ').trim(); 

  // Fallback if normalization resulted in an empty string but original had content
  if (!normalized && rawGroupTitle) { 
    return rawGroupTitle.trim().toUpperCase(); 
  }
  
  return normalized || rawGroupTitle.trim().toUpperCase(); 
}


export function parseM3U(m3uString: string, playlistDbId: string, limit?: number): PlaylistItem[] {
  const lines = m3uString.split(/\r?\n/);
  const items: PlaylistItem[] = [];
  let currentRawAttributes: Record<string, string> = {};
  let currentTitleLine: string = ''; // This is the title after the last comma in #EXTINF

  for (const line of lines) {
    if (limit && items.length >= limit) break;

    const trimmedLine = line.trim();

    if (trimmedLine.startsWith('#EXTINF:')) {
      currentRawAttributes = {}; // Reset for each new #EXTINF
      const info = trimmedLine.substring(8); 
      const commaIndex = info.lastIndexOf(',');
      
      const attributesString = commaIndex > -1 ? info.substring(0, commaIndex) : info; // Handle cases without comma
      currentTitleLine = commaIndex > -1 ? info.substring(commaIndex + 1).trim() : '';


      const attributeRegex = /([a-zA-Z0-9\-._]+)="([^"]*)"/g; // Allow . and _ in attribute names
      let match;
      while ((match = attributeRegex.exec(attributesString)) !== null) {
        currentRawAttributes[match[1].toLowerCase()] = match[2];
      }
      // If currentTitleLine is empty from #EXTINF, use tvg-name if present as a fallback
      if (!currentTitleLine && currentRawAttributes['tvg-name']) {
        currentTitleLine = currentRawAttributes['tvg-name'];
      }

    } else if (trimmedLine && !trimmedLine.startsWith('#') && !trimmedLine.startsWith('##')) {
      const streamUrl = trimmedLine;
      
      // Determine the primary title for processing. Prioritize the title from the #EXTINF line.
      const m3uTitleFromLine = currentTitleLine;
      const tvgNameFromAttr = currentRawAttributes['tvg-name'];
      
      let titleForProcessing = m3uTitleFromLine;
      if (!titleForProcessing || (tvgNameFromAttr && tvgNameFromAttr.length > titleForProcessing.length && tvgNameFromAttr.includes(titleForProcessing))) {
        // If m3uTitle is short/generic and tvg-name is more descriptive & contains it, prefer tvg-name
        titleForProcessing = tvgNameFromAttr || m3uTitleFromLine;
      }
      if (!titleForProcessing && tvgNameFromAttr) titleForProcessing = tvgNameFromAttr;
      if (!titleForProcessing) titleForProcessing = 'Unknown Item';


      const originalGroupTitle = currentRawAttributes['group-title'];
      const lowerStreamUrl = streamUrl.toLowerCase();
      const normalizedTitleForProcessing = normalizeForComparison(titleForProcessing);
      const normalizedOriginalGroupTitle = normalizeForComparison(originalGroupTitle || "");

      let itemType: PlaylistItem['itemType'];
      
      // 1. Definitive Channel Indicators
      const isTsStream = lowerStreamUrl.endsWith('.ts') || lowerStreamUrl.endsWith('.m3u8'); // Added .m3u8 as channel indicator
      const has24hInName = normalizedTitleForProcessing.includes('24h');
      const hasCanalInGroup = normalizedOriginalGroupTitle.includes('canal') || normalizedOriginalGroupTitle.includes('tv');
      
      if (isTsStream || has24hInName || hasCanalInGroup) {
        itemType = 'channel';
      }
      // 2. Definitive Series Indicator (SxxExx in titleForProcessing)
      else if (titleForProcessing.match(/[Ss]\d{1,3}\s*[EeXx]\s*\d{1,3}/i)) {
        itemType = 'series_episode';
      }
      // 3. Name looks like a channel (heuristic, after definitive series check)
      else {
        const { baseChannelName: tempBaseNameForClassification } = extractChannelDetails(titleForProcessing);
        const isChannelLikeName = tempBaseNameForClassification !== titleForProcessing || // if extractChannelDetails changed the name by stripping quality
                                   (titleForProcessing === titleForProcessing.toUpperCase() && 
                                    titleForProcessing.length < 35 && 
                                    !titleForProcessing.match(/\(\d{4}\)$/)); // Not like a movie with (YEAR)

        if (isChannelLikeName && !(normalizedOriginalGroupTitle.includes('film') || normalizedOriginalGroupTitle.includes('movie') || normalizedOriginalGroupTitle.includes('serie'))) {
            itemType = 'channel';
        }
        // 4. Group title based classification (more specific checks)
        else if (normalizedOriginalGroupTitle.includes('serie') || normalizedOriginalGroupTitle.includes('dorama') || normalizedOriginalGroupTitle.includes('anime')) {
            itemType = 'series_episode';
        }
        else if (normalizedOriginalGroupTitle.includes('film') || normalizedOriginalGroupTitle.includes('movie') || normalizedOriginalGroupTitle.includes('pelicula')) {
            itemType = 'movie';
        }
        // 5. Fallback for likely video extensions
        else if (lowerStreamUrl.endsWith('.mp4') || lowerStreamUrl.endsWith('.mkv') || lowerStreamUrl.endsWith('.avi')) {
            if (extractMovieYear(titleForProcessing) !== undefined) {
                itemType = 'movie';
            } else { 
                itemType = 'movie'; // Default for generic video files if not clearly series
            }
        }
        // 6. Final Fallback (if stream URL is not .ts/.m3u8 and not a common video file extension)
        else {
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
        tvgName: tvgNameFromAttr, // Store the raw tvg-name separately
        itemType,
      };
      
      item.groupTitle = normalizeGroupTitle(originalGroupTitle, item.itemType);

      if (item.itemType === 'channel') {
        const { baseChannelName, quality } = extractChannelDetails(titleForProcessing); // Use titleForProcessing
        item.baseChannelName = baseChannelName;
        item.quality = quality;
        // For channels, genre can be their groupTitle
        item.genre = item.groupTitle; 
      } else if (item.itemType === 'series_episode') {
        const { seriesTitle, seasonNumber, episodeNumber, episodeTitle } = extractSeriesDetails(titleForProcessing); // Use titleForProcessing
        item.seriesTitle = seriesTitle;
        item.seasonNumber = seasonNumber;
        item.episodeNumber = episodeNumber;
        item.title = episodeTitle ? `${seriesTitle} - ${episodeTitle}` : titleForProcessing; // Update item title to be more specific if episodeTitle found
        item.genre = item.groupTitle;
        item.year = extractMovieYear(titleForProcessing); // Series might have a start year in some formats
      } else if (item.itemType === 'movie') {
        item.year = extractMovieYear(titleForProcessing);
        item.genre = item.groupTitle; 
      }
      
      if (item.streamUrl && item.title && item.itemType) {
        items.push(item as PlaylistItem);
      }

      currentRawAttributes = {}; // Reset for the next #EXTINF
      currentTitleLine = '';
    }
  }
  return items;
}

