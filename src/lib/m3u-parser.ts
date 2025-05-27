import type { PlaylistItemCore } from '@/lib/constants';

export interface ParsedM3UItem {
  attributes: Record<string, string>;
  title: string;
  url: string;
}

/**
 * Parses M3U content string into a list of items.
 * @param m3uString The M3U content as a string.
 * @param playlistDbId The ID of the playlist this item belongs to.
 * @param limit Optional limit on the number of items to parse.
 * @returns An array of PlaylistItemCore.
 */
export function parseM3U(m3uString: string, playlistDbId: string, limit?: number): PlaylistItemCore[] {
  const lines = m3uString.split(/\r?\n/);
  const items: PlaylistItemCore[] = [];
  let currentItem: Partial<PlaylistItemCore> = { playlistDbId };

  for (const line of lines) {
    if (items.length === limit) break;

    const trimmedLine = line.trim();
    if (trimmedLine.startsWith('#EXTINF:')) {
      currentItem = { playlistDbId }; // Reset for new item
      const info = trimmedLine.substring(8); // Remove #EXTINF:
      const commaIndex = info.lastIndexOf(',');
      
      const attributesString = info.substring(0, commaIndex);
      currentItem.displayName = info.substring(commaIndex + 1).trim();

      // Parse attributes (tvg-id, tvg-name, tvg-logo, group-title)
      const attributeRegex = /([a-zA-Z0-9\-]+)="([^"]*)"/g;
      let match;
      while ((match = attributeRegex.exec(attributesString)) !== null) {
        const key = match[1].toLowerCase();
        const value = match[2];
        if (key === 'tvg-id') currentItem.tvgId = value;
        else if (key === 'tvg-name') currentItem.tvgName = value;
        else if (key === 'tvg-logo') currentItem.tvgLogo = value;
        else if (key === 'group-title') currentItem.groupTitle = value;
      }
      // If tvgName is not present, use displayName from after comma
      if (!currentItem.tvgName && currentItem.displayName) {
        currentItem.tvgName = currentItem.displayName;
      }


    } else if (trimmedLine && !trimmedLine.startsWith('#')) {
      // This line should be the URL for the current item
      currentItem.url = trimmedLine;
      
      // Infer item type (basic heuristic)
      let itemType: PlaylistItemCore['itemType'] = 'unknown';
      const groupTitleLower = currentItem.groupTitle?.toLowerCase() || '';
      const urlLower = currentItem.url?.toLowerCase() || '';
      const nameLower = currentItem.tvgName?.toLowerCase() || currentItem.displayName?.toLowerCase() || '';

      if (groupTitleLower.includes('series') || urlLower.includes('/series/') || nameLower.match(/s\d{1,2}e\d{1,2}/)) {
        itemType = 'series';
      } else if (groupTitleLower.includes('movie') || groupTitleLower.includes('filme') || urlLower.includes('/movie/')) {
        itemType = 'movie';
      } else if (groupTitleLower || urlLower) { // If it has a group or URL, assume channel if not movie/series
        itemType = 'channel';
      }
      currentItem.itemType = itemType;

      // Finalize and add item if URL and display name are present
      if (currentItem.url && currentItem.displayName) {
        items.push(currentItem as PlaylistItemCore);
      }
      currentItem = { playlistDbId }; // Reset for next item
    }
  }
  return items;
}
