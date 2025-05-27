
"use client";

import { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/page-header';
import { PlaceholderContent } from '@/components/placeholder-content';
import { ContentGroupRow } from '@/components/content-group-row';
import { getAllPlaylistsMetadata, getPlaylistItems, getAllGenresForPlaylist, type ChannelItem } from '@/lib/db';
import type { ContentItemForCard } from '@/lib/constants';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input'; // Import Input

const ITEMS_PER_ROW_PREVIEW = 6;

const aggregateChannelItemsToCard = (baseName: string, items: ChannelItem[]): ContentItemForCard => {
  if (items.length === 0) {
    return {
      id: baseName,
      title: baseName,
      type: 'channel',
      dataAiHint: `channel ${baseName}`.substring(0, 50).trim().toLowerCase(),
      imageUrl: `https://placehold.co/300x450.png`,
    };
  }
  const representativeItem = items[0];
  const uniqueQualities = Array.from(new Set(items.map(i => i.quality).filter(Boolean) as string[])).sort();

  return {
    id: baseName,
    title: baseName,
    imageUrl: representativeItem.logoUrl,
    type: 'channel',
    dataAiHint: `channel ${baseName}`.substring(0, 50).trim().toLowerCase(),
    qualities: uniqueQualities.length > 0 ? uniqueQualities : undefined,
    sourceCount: items.length,
  };
};

interface GroupedChannels {
  groupTitle: string;
  items: ContentItemForCard[];
}

export default function ChannelsPage() {
  const [allGroupedChannelItems, setAllGroupedChannelItems] = useState<GroupedChannels[]>([]);
  const [displayedGroupedChannelItems, setDisplayedGroupedChannelItems] = useState<GroupedChannels[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasPlaylistsConfigured, setHasPlaylistsConfigured] = useState<boolean | null>(null);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState(''); // State for search term

  const fetchAndGroupChannels = useCallback(async (playlistId: string) => {
    if (!playlistId) return;
    setIsLoading(true);
    try {
      const rawChannelItemsFromDB = await getPlaylistItems(playlistId, 'channel') as ChannelItem[];
      const groupTitles = await getAllGenresForPlaylist(playlistId, 'channel');

      const groups: GroupedChannels[] = groupTitles.map(groupTitle => {
        const channelsInGroup = rawChannelItemsFromDB.filter(ch => ch.groupTitle === groupTitle);
        const channelAggregates = new Map<string, ChannelItem[]>();
        channelsInGroup.forEach(item => {
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
          groupTitle: groupTitle,
          items: aggregatedCardsForGroup.sort((a,b) => a.title.localeCompare(b.title))
        };
      }).filter(group => group.items.length > 0);

      const sortedGroups = groups.sort((a,b) => a.groupTitle.localeCompare(b.groupTitle));
      setAllGroupedChannelItems(sortedGroups);
      setDisplayedGroupedChannelItems(sortedGroups); // Initially display all

    } catch (error) {
      console.error("Failed to fetch or group channel items:", error);
      setAllGroupedChannelItems([]);
      setDisplayedGroupedChannelItems([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    async function initializePage() {
      setHasPlaylistsConfigured(null);
      setIsLoading(true);
      setSearchTerm('');
      try {
        const playlists = await getAllPlaylistsMetadata();
        if (playlists.length > 0 && playlists[0]?.id) {
          setHasPlaylistsConfigured(true);
          const firstPlaylistId = playlists[0].id;
          setActivePlaylistId(firstPlaylistId);
          await fetchAndGroupChannels(firstPlaylistId);
        } else {
          setHasPlaylistsConfigured(false);
          setAllGroupedChannelItems([]);
          setDisplayedGroupedChannelItems([]);
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Failed to initialize channels page:", error);
        setHasPlaylistsConfigured(false);
        setIsLoading(false);
      }
    }
    initializePage();
  }, [fetchAndGroupChannels]);

  // Effect for filtering groups based on searchTerm
  useEffect(() => {
    if (isLoading) return;
    if (!searchTerm) {
      setDisplayedGroupedChannelItems(allGroupedChannelItems);
      return;
    }
    const filtered = allGroupedChannelItems.filter(group =>
      group.groupTitle.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setDisplayedGroupedChannelItems(filtered);
  }, [searchTerm, allGroupedChannelItems, isLoading]);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  if (hasPlaylistsConfigured === null || (isLoading && allGroupedChannelItems.length === 0)) {
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
              key={group.groupTitle}
              title={`${group.groupTitle} (${group.items.length})`}
              items={group.items}
              viewAllLink={`/app/channels/group/${encodeURIComponent(group.groupTitle.toLowerCase())}`}
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

    