
"use client";

import { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/page-header';
import { PlaceholderContent } from '@/components/placeholder-content';
import { ContentGroupRow } from '@/components/content-group-row';
import { getAllPlaylistsMetadata, getPlaylistItems, getAllGenresForPlaylist, type ChannelItem } from '@/lib/db';
import type { ContentItemForCard } from '@/lib/constants';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { normalizeText } from '@/lib/utils';

const ITEMS_PER_ROW_PREVIEW = 6;

// Helper to aggregate individual ChannelItems (potentially from different playlists or qualities)
// into a single ContentItemForCard representing one unique channel (e.g., "ESPN")
const aggregateChannelItemsToCard = (baseName: string, items: ChannelItem[]): ContentItemForCard => {
  if (items.length === 0) {
    // This case should ideally not happen if items are pre-filtered
    return {
      id: baseName, // Use baseName as ID for aggregated channel card
      title: baseName,
      type: 'channel',
      dataAiHint: `channel ${baseName}`.substring(0, 50).trim().toLowerCase(),
      imageUrl: `https://placehold.co/300x450.png`,
    };
  }
  // Try to find a representative item, e.g., one with a logo or a common quality
  const representativeItem = items.find(i => i.logoUrl) || items[0];
  const uniqueQualities = Array.from(new Set(items.map(i => i.quality).filter(Boolean) as string[])).sort();

  return {
    id: baseName, // Use baseName as ID
    title: baseName, // Display baseName as title
    imageUrl: representativeItem.logoUrl,
    type: 'channel',
    dataAiHint: `channel ${baseName}`.substring(0, 50).trim().toLowerCase(),
    qualities: uniqueQualities.length > 0 ? uniqueQualities : undefined,
    sourceCount: items.length, // Number of different stream URLs/qualities for this base channel
  };
};


interface GroupedChannels {
  groupTitle: string; // The original, display-friendly group title
  items: ContentItemForCard[];
}

export default function ChannelsPage() {
  const [allRawChannelItems, setAllRawChannelItems] = useState<ChannelItem[]>([]);
  const [allChannelGroupTitles, setAllChannelGroupTitles] = useState<string[]>([]);
  const [displayedGroupedChannelItems, setDisplayedGroupedChannelItems] = useState<GroupedChannels[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [hasPlaylistsConfigured, setHasPlaylistsConfigured] = useState<boolean | null>(null);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchAllChannelData = useCallback(async (playlistId: string) => {
    if (!playlistId) return;
    setIsLoading(true);
    try {
      const rawItemsFromDB = await getPlaylistItems(playlistId, 'channel') as ChannelItem[];
      setAllRawChannelItems(rawItemsFromDB);

      const groupTitlesFromDB = await getAllGenresForPlaylist(playlistId, 'channel');
      setAllChannelGroupTitles(groupTitlesFromDB);

    } catch (error) {
      console.error("Failed to fetch channel data:", error);
      setAllRawChannelItems([]);
      setAllChannelGroupTitles([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    async function initializePage() {
      setHasPlaylistsConfigured(null); // Reset for accurate loading state
      setIsLoading(true);
      setSearchTerm(''); 
      try {
        const playlists = await getAllPlaylistsMetadata();
        if (playlists.length > 0 && playlists[0]?.id) {
          setHasPlaylistsConfigured(true);
          const firstPlaylistId = playlists[0].id;
          setActivePlaylistId(firstPlaylistId);
          await fetchAllChannelData(firstPlaylistId);
        } else {
          setHasPlaylistsConfigured(false);
          setAllRawChannelItems([]);
          setAllChannelGroupTitles([]);
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Failed to initialize channels page:", error);
        setHasPlaylistsConfigured(false);
        setIsLoading(false);
      }
    }
    initializePage();
  }, [fetchAllChannelData]);

  // Effect for grouping and filtering channels
  useEffect(() => {
    if (isLoading) return;

    // Filter group titles first if searchTerm is for groups
    const normalizedSearchTerm = normalizeText(searchTerm);
    const relevantGroupTitles = searchTerm
      ? allChannelGroupTitles.filter(title => normalizeText(title).includes(normalizedSearchTerm))
      : allChannelGroupTitles;

    const groups: GroupedChannels[] = relevantGroupTitles.map(groupTitle => {
      // Filter raw channel items that belong to this original groupTitle (before normalization for map key)
      const channelsInOriginalGroup = allRawChannelItems.filter(ch => 
        ch.groupTitle === groupTitle
      );

      // Aggregate channels within this group by baseChannelName
      const channelAggregates = new Map<string, ChannelItem[]>();
      channelsInOriginalGroup.forEach(item => {
        if (item.baseChannelName) {
          if (!channelAggregates.has(item.baseChannelName)) {
            channelAggregates.set(item.baseChannelName, []);
          }
          channelAggregates.get(item.baseChannelName)!.push(item);
        }
      });
      
      const aggregatedCardsForGroup: ContentItemForCard[] = [];
      channelAggregates.forEach((items, baseName) => {
        aggregatedCardsForGroup.push(aggregateChannelItemsToCard(baseName, items));
      });

      return {
        groupTitle: groupTitle, // Use the original group title for display
        items: aggregatedCardsForGroup.sort((a, b) => a.title.localeCompare(b.title))
      };
    }).filter(group => group.items.length > 0);
    
    // Groups are already effectively sorted by allChannelGroupTitles if no search,
    // or by filtered relevantGroupTitles. If further sorting of groups is needed, apply here.
    setDisplayedGroupedChannelItems(groups);

  }, [searchTerm, allRawChannelItems, allChannelGroupTitles, isLoading]);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  if (hasPlaylistsConfigured === null || (isLoading && allRawChannelItems.length === 0 && allChannelGroupTitles.length === 0)) {
    return (
      <div className="container mx-auto px-0">
        <PageHeader title="Canais ao Vivo" description="Assista seus canais de TV favoritos."/>
        <Skeleton className="h-10 w-full sm:w-72 mb-6 rounded-md" /> 
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="mb-8 md:mb-12">
            <Skeleton className="h-8 w-1/4 mb-4 rounded-md" />
            <div className="flex overflow-x-auto space-x-4 pb-4">
              {Array.from({ length: ITEMS_PER_ROW_PREVIEW }).map((_, j) => (
                <div key={j} className="w-[150px] sm:w-[160px] md:w-[180px] flex-shrink-0">
                  <div className="aspect-[2/3] w-full">
                    <Skeleton className="h-full w-full rounded-lg" />
                  </div>
                  <Skeleton className="h-4 w-3/4 mt-2 rounded-md" />
                  <Skeleton className="h-3 w-1/2 mt-1 rounded-md" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="container mx-auto px-0">
      <PageHeader title="Canais ao Vivo" description="Assista seus canais de TV favoritos, organizados por categoria."/>
      <div className="mb-6">
        <Input
          type="search"
          placeholder="Buscar por grupos de canais..."
          className="w-full sm:w-72"
          value={searchTerm}
          onChange={handleSearchChange}
        />
      </div>
      {hasPlaylistsConfigured ? (
        (displayedGroupedChannelItems.length > 0) ? (
          displayedGroupedChannelItems.map(group => (
            <ContentGroupRow
              key={group.groupTitle} // Use original group title as key
              title={`${group.groupTitle} (${group.items.length})`}
              items={group.items}
              viewAllLink={`/app/channels/group/${encodeURIComponent(group.groupTitle)}`} // Use original for link
              itemType="channel"
            />
          ))
        ) : (
          !isLoading && searchTerm && <p className="text-muted-foreground text-center py-8">Nenhum grupo de canais encontrado para "{searchTerm}".</p>
        ) || (
          !isLoading && <p className="text-muted-foreground text-center py-8">Nenhum canal encontrado nas suas playlists configuradas.</p>
        )
      ) : (
        <PlaceholderContent type="canais" />
      )}
    </div>
  );
}
